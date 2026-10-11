"""Tests de l'assistant IA : recherche des dépêches, messages pour le modèle, réponses en flux, limiteur, quotas,
mémoire partagée, lecture automatique des indicateurs. Aucun appel réseau : les API sont simulées."""

import io
import json
import threading
import time
from datetime import date, datetime, timedelta, timezone

import pytest
import requests

from conftest import make_article
from core import assistant
from core.market import Quote

NOW = datetime(2026, 10, 10, 12, 0, tzinfo=timezone.utc)


def at(hours_ago: float) -> datetime:
    return NOW - timedelta(hours=hours_ago)


ARTICLES = [
    make_article("Fed officials see another rate hike coming", source="CNBC", summary="Minutes of the FOMC."),
    make_article("Eurozone inflation slows to 2.1% in September", source="Reuters", summary="ECB target in sight."),
    make_article("Bitcoin jumps above $80,000", source="CoinDesk", summary="Crypto rally."),
    make_article("Bitcoin miners sell coins", source="CoinDesk"),
    make_article("Bitcoin ETF inflows hit record", source="CoinDesk"),
    make_article("Ether lags bitcoin", source="Cointelegraph"),
    make_article("Oil prices climb as OPEC cuts output", source="BBC"),
    make_article("CAC 40 : l'indice parisien ouvre la séance en hausse", source="BFM Bourse"),
]
for article, hours in zip(ARTICLES, [2, 3, 1, 4, 5, 6, 2, 1]):
    article.published = at(hours)


# --- Recherche ------------------------------------------------------------------------------------


def test_concepts_translate_and_group_phrases():
    ideas = assistant.concepts("Où en est l'inflation en zone euro ?")
    assert ideas[0]["inflation"] == 1.0 and ideas[0]["price"] == assistant.SYNONYM_WEIGHT
    assert ideas[1]["zoneeuro"] == 1.0 and "eurozone" in ideas[1]  # « zone euro » : une seule idée
    assert assistant.concepts("Quelles sont les dernières nouvelles ?") == []  # que des mots de question
    assert "per" not in assistant.question_terms("Explique-moi le PER")  # « per » anglais : traductions seules


def test_rank_articles_finds_the_story_in_english():
    found = assistant.rank_articles("Où en est l'inflation en zone euro ?", ARTICLES, now=NOW)
    assert found[0].title.startswith("Eurozone inflation")  # les deux idées : devant
    assert assistant.rank_articles("Que fait la Fed ?", ARTICLES, now=NOW)[0].source == "CNBC"
    assert assistant.rank_articles("le pétrole", ARTICLES, now=NOW)[0].title.startswith("Oil")


def test_rank_articles_keeps_two_stories_per_source_and_falls_back_to_recent():
    found = assistant.rank_articles("bitcoin", ARTICLES, now=NOW)
    assert [a.source for a in found].count("CoinDesk") == 2  # au plus 2 par source
    assert "Cointelegraph" in [a.source for a in found]
    latest = assistant.rank_articles("Quoi de neuf ?", ARTICLES, limit=2, now=NOW)
    assert [a.published for a in latest] == sorted((a.published for a in ARTICLES), reverse=True)[:2]
    assert assistant.rank_articles("bitcoin", [], now=NOW) == []


def test_glossary_hits_prefers_the_longest_term():
    hits = [term for term, _ in assistant.glossary_hits("C'est quoi l'inversion de la courbe des taux ?")]
    assert hits == ["Inversion de la courbe des taux"]
    assert [t for t, _ in assistant.glossary_hits("Explique-moi le PER")] == ["PER"]
    assert assistant.is_definition("C'est quoi un ETF ?") and not assistant.is_definition("Le bitcoin monte ?")


# --- Messages pour le modèle ----------------------------------------------------------------------


def test_prepare_builds_numbered_documents_and_short_history():
    quotes = [Quote("^FCHI", "CAC 40", "Europe", "%", 7803.3, 7729.7, None)]
    history = [{"role": "user" if n % 2 == 0 else "assistant", "content": f"message {n}"} for n in range(10)]
    prepared = assistant.prepare("Que fait la Fed ?" + " " * 600, history, ARTICLES, quotes, now=NOW)
    system, *previous, last = prepared.messages
    assert system["role"] == "system" and "samedi 10 octobre 2026" in system["content"]  # le jour, pas à deviner
    assert [m["content"] for m in previous] == [f"message {n}" for n in range(4, 10)]  # les 6 derniers
    assert "[1] Fed officials see another rate hike coming — CNBC, " in last["content"]
    assert "CAC 40 : 7 803,30 (+0,95 % sur la séance)" in last["content"]
    assert last["content"].endswith("QUESTION : Que fait la Fed ?")  # espaces retirés, question bornée
    assert prepared.glossary and prepared.glossary[0][0] == "Fed"


def test_definition_questions_get_few_sources_and_an_honest_offline_answer():
    prepared = assistant.prepare("Explique-moi ce qu'est le bitcoin", [], ARTICLES, now=NOW)
    assert len(prepared.sources) <= 3
    text = assistant.offline_answer(prepared)
    assert text.startswith("**Bitcoin** :") and "Pour aller plus loin" in text
    nothing = assistant.prepare("tulipes hollandaises", [], ARTICLES, now=NOW)
    assert "Je n'ai trouvé aucune dépêche" in assistant.offline_answer(nothing)


def test_cited_and_linkify():
    sources = assistant.make_sources(ARTICLES[:2])
    text = "La Fed hésite [1]. L'inflation ralentit [2][9]. Coût : 5 $ ![x](https://evil.example/p.png)"
    assert [s.n for s in assistant.cited(text, sources)] == [1, 2]
    linked = assistant.linkify(text, sources)
    assert f"[[1]]({ARTICLES[0].url})" in linked and "[9]" in linked and "[[9]]" not in linked
    assert "\\$" in linked and "![" not in linked  # pas de formule mathématique, pas d'image
    grouped = "Deux sources [1, 2] ; une troisième inconnue [1; 9]."
    assert [s.n for s in assistant.cited(grouped, sources)] == [1, 2]
    assert f"[[1]]({ARTICLES[0].url})[[2]]({ARTICLES[1].url})" in assistant.linkify(grouped, sources)
    assert "[1; 9]" in assistant.linkify(grouped, sources)  # un numéro inconnu : on ne touche à rien
    odd = assistant.Source(1, "t", "s", "https://a.com/x (1)", NOW.isoformat())
    assert "(https://a.com/x%20%281%29)" in assistant.linkify("[1]", [odd])


# --- Réponses en flux (API simulées) --------------------------------------------------------------------


class FakeStream:
    def __init__(self, status: int, lines: list[str] = ()):
        self.status_code, self.lines, self.encoding, self.closed = status, list(lines), None, False

    @property
    def ok(self):
        return self.status_code < 400

    def iter_lines(self, decode_unicode=False):
        yield from self.lines

    def close(self):
        self.closed = True

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()


def groq_lines(*pieces):
    return [f"data: {json.dumps({'choices': [{'delta': {'content': p}}]})}" for p in pieces] + ["", "data: [DONE]"]


def gemini_lines(*pieces):
    return [f"data: {json.dumps({'candidates': [{'content': {'parts': [{'text': p}]}}]})}" for p in pieces]


def test_groq_stream_is_read_piece_by_piece(monkeypatch):
    sent = {}

    def fake_post(url, headers, json, stream, timeout):
        sent.update(url=url, headers=headers, body=json)
        return FakeStream(200, groq_lines("La Fed ", "hésite [1].") + ['data: {"choices": [{"delta": {}}]}'])

    monkeypatch.setattr(assistant.requests, "post", fake_post)
    pieces = list(assistant.open_groq([{"role": "user", "content": "?"}], "cle-secrete"))
    assert pieces == ["La Fed ", "hésite [1]."]
    assert sent["body"]["stream"] is True and sent["headers"]["Authorization"] == "Bearer cle-secrete"


def test_gemini_gets_the_system_prompt_apart_and_the_key_in_a_header(monkeypatch):
    sent = {}

    def fake_post(url, headers, json, stream, timeout):
        sent.update(url=url, headers=headers, body=json)
        return FakeStream(200, gemini_lines("Bonjour", " !"))

    monkeypatch.setattr(assistant.requests, "post", fake_post)
    messages = [{"role": "system", "content": "Règles"}, {"role": "user", "content": "Q1"},
                {"role": "assistant", "content": "R1"}, {"role": "user", "content": "Q2"}]
    assert "".join(assistant.open_gemini(messages, "cle-secrete")) == "Bonjour !"
    assert sent["body"]["systemInstruction"]["parts"][0]["text"] == "Règles"
    assert [c["role"] for c in sent["body"]["contents"]] == ["user", "model", "user"]
    assert "cle-secrete" not in sent["url"] and sent["headers"]["x-goog-api-key"] == "cle-secrete"


def real_stream(body: bytes, content_type: str = "text/event-stream") -> requests.Response:
    """Une vraie réponse requests (et son décodage), comme celle d'un serveur."""
    response = requests.Response()
    response.status_code, response.raw = 200, io.BytesIO(body)
    response.headers["Content-Type"] = content_type
    response.encoding = requests.utils.get_encoding_from_headers(response.headers)  # « ISO-8859-1 » par défaut
    return response


def test_stream_keeps_accents_even_when_the_server_announces_no_charset():
    body = "\n".join(groq_lines("La Réserve fédérale ", "relève ses taux — à 5 %")).encode("utf-8")
    pieces = assistant._sse(real_stream(body), lambda event: event["choices"][0]["delta"].get("content"))
    assert "".join(pieces) == "La Réserve fédérale relève ses taux — à 5 %"


@pytest.fixture(autouse=True)
def fresh_thinking_memory(monkeypatch):
    from core import summarizer
    monkeypatch.setattr(summarizer, "_thinking_choice", {})


def test_gemini_thinks_as_little_as_possible_and_hides_its_thoughts(monkeypatch):
    sent = []

    def fake_post(url, headers, json, stream, timeout):
        sent.append(json["generationConfig"])
        lines = ['data: {"candidates": [{"content": {"parts": [{"text": "brouillon", "thought": true}, '
                 '{"text": "Réponse"}]}}]}']
        return FakeStream(200, lines)

    monkeypatch.setattr(assistant.requests, "post", fake_post)
    assert "".join(assistant.open_gemini([{"role": "user", "content": "?"}], "cle")) == "Réponse"
    assert sent[0]["thinkingConfig"] == {"thinkingLevel": "minimal"}  # sinon la réflexion coupe la réponse


def test_gemini_tries_longer_thinking_when_refused_and_remembers(monkeypatch):
    sent = []

    class Refused(FakeStream):
        text = "Thinking level MINIMAL is not supported for this model."

    def fake_post(url, headers, json, stream, timeout):
        config = json["generationConfig"]
        sent.append(config)
        if config.get("thinkingConfig", {}).get("thinkingLevel") == "minimal":
            return Refused(400)
        return FakeStream(200, gemini_lines("ok"))

    monkeypatch.setattr(assistant.requests, "post", fake_post)
    assert "".join(assistant.open_gemini([{"role": "user", "content": "?"}], "cle", max_tokens=900)) == "ok"
    assert [c.get("thinkingConfig") for c in sent] == [{"thinkingLevel": "minimal"}, {"thinkingLevel": "low"}]
    assert sent[1]["maxOutputTokens"] == 900 + 2048  # de la place pour réfléchir ET répondre
    sent.clear()
    assert "".join(assistant.open_gemini([{"role": "user", "content": "?"}], "cle")) == "ok"
    assert [c.get("thinkingConfig") for c in sent] == [{"thinkingLevel": "low"}]  # le refus n'est pas répété


@pytest.mark.parametrize("status", [429, 503])
def test_gemini_falls_back_to_the_other_model_when_busy(monkeypatch, status):
    urls = []

    def fake_post(url, headers, json, stream, timeout):
        urls.append(url)
        return FakeStream(status) if "flash-lite" in url else FakeStream(200, gemini_lines("Réponse de secours"))

    monkeypatch.setattr(assistant.requests, "post", fake_post)
    assert "".join(assistant.open_gemini([{"role": "user", "content": "?"}], "cle")) == "Réponse de secours"
    assert "gemini-flash-lite-latest" in urls[0] and "gemini-flash-latest" in urls[1]
    urls.clear()  # un modèle choisi dans les secrets : le modèle par défaut prend le relais
    assert "".join(assistant.open_gemini([{"role": "user", "content": "?"}], "cle", "gemini-pro-latest")) == "Réponse de secours"
    assert "gemini-pro-latest" in urls[0] and len(urls) == 1


def test_a_truncated_answer_is_flagged():
    lines = gemini_lines("La Fed hésite, car l'inflation sur de") + [
        'data: {"candidates": [{"content": {"parts": []}, "finishReason": "MAX_TOKENS"}]}']
    received = []
    with pytest.raises(assistant.Truncated):
        for piece in assistant._sse(FakeStream(200, lines), assistant.gemini_text):
            received.append(piece)
    assert received == ["La Fed hésite, car l'inflation sur de"]  # le début reste affichable
    groq = groq_lines("Début")[:-2] + ['data: {"choices": [{"delta": {}, "finish_reason": "length"}]}', "data: [DONE]"]
    with pytest.raises(assistant.Truncated):
        list(assistant._sse(FakeStream(200, groq), lambda e: e["choices"][0]["delta"].get("content")))
    assert list(assistant._sse(FakeStream(200, gemini_lines("Fin normale")), assistant.gemini_text)) == ["Fin normale"]


def test_gemini_does_not_retry_a_real_error(monkeypatch):
    urls = []
    monkeypatch.setattr(assistant.requests, "post", lambda url, **kwargs: urls.append(url) or FakeStream(403))
    with pytest.raises(assistant.AssistantError, match="Gemini a répondu 403"):
        assistant.open_gemini([{"role": "user", "content": "?"}], "cle-invalide")
    assert len(urls) == 1  # clé refusée : inutile d'insister


def test_open_stream_falls_back_to_groq_and_never_shows_the_key(monkeypatch):
    def fake_post(url, **kwargs):
        if "googleapis" in url:
            return FakeStream(429)
        raise requests.ConnectionError("https://api.groq.com?key=cle-groq-secrete")

    monkeypatch.setattr(assistant.requests, "post", fake_post)
    keys = {"GEMINI_API_KEY": "cle-gemini-secrete", "GROQ_API_KEY": "cle-groq-secrete"}
    with pytest.raises(assistant.AssistantError) as error:
        assistant.open_stream([{"role": "user", "content": "?"}], keys)
    assert str(error.value) == "Gemini a répondu 429 ; Groq injoignable (ConnectionError)"
    assert "secrete" not in str(error.value)

    monkeypatch.setattr(assistant.requests, "post",
                        lambda url, **kwargs: FakeStream(503) if "googleapis" in url else FakeStream(200, groq_lines("ok")))
    engine, stream = assistant.open_stream([{"role": "user", "content": "?"}], keys)
    assert engine == "Groq" and list(stream) == ["ok"]
    with pytest.raises(assistant.AssistantError, match="Aucune clé"):
        assistant.open_stream([], {})


# --- Tenir la charge ---------------------------------------------------------------------------------


def test_rate_limiter_counts_a_sliding_minute():
    limiter = assistant.RateLimiter(per_minute=3)
    assert [limiter.try_acquire(now=t) for t in (0, 1, 2)] == [0, 0, 0]
    assert limiter.try_acquire(now=30) == 30.0  # la plus ancienne question libère sa place à t = 60
    assert limiter.try_acquire(now=60.5) == 0


def test_rate_limiter_is_safe_with_many_visitors_at_once():
    limiter = assistant.RateLimiter(per_minute=20)
    allowed = []
    threads = [threading.Thread(target=lambda: allowed.append(limiter.try_acquire() == 0)) for _ in range(100)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert sum(allowed) == 20


def test_answer_cache_expires_and_stays_small():
    cache = assistant.AnswerCache(max_entries=2, ttl=10)
    cache.put("a", {"text": "A"}, now=0)
    assert cache.get("a", now=5) == {"text": "A"} and cache.get("a", now=11) is None
    for key in "bcd":
        cache.put(key, {"text": key}, now=20)
    assert len(cache) == 2 and cache.get("b", now=21) is None  # la plus ancienne est oubliée


def test_get_or_compute_calls_the_model_once_for_fifty_visitors():
    cache, calls = assistant.AnswerCache(), []

    def slow_answer():
        calls.append(1)
        time.sleep(0.05)
        return {"text": "Réponse"}

    results = []
    threads = [threading.Thread(target=lambda: results.append(cache.get_or_compute("q", slow_answer)))
               for _ in range(50)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert len(calls) == 1 and results == [{"text": "Réponse"}] * 50


def test_get_or_compute_remembers_a_failure_briefly():
    cache, calls = assistant.AnswerCache(), []
    failing = lambda: calls.append(1) or {"text": None, "note": "panne"}  # noqa: E731
    cache.get_or_compute("q", failing, failure_ttl=60)
    cache.get_or_compute("q", failing, failure_ttl=60)
    assert len(calls) == 1  # pas de nouvel essai à chaque visite


def test_cache_key_ignores_case_accents_and_punctuation():
    sources = assistant.make_sources(ARTICLES[:2])
    assert assistant.cache_key("chat", "Que fait la FED ?", sources) == assistant.cache_key("chat", "que fait la fed", sources)
    assert assistant.cache_key("chat", "que fait la fed", sources) != assistant.cache_key("chat", "que fait la fed", [])


def test_daily_quota_resets_each_day():
    today = date(2026, 10, 10)
    usage = None
    for _ in range(3):
        usage = assistant.count_use(usage, today)
    assert usage == {"day": "2026-10-10", "count": 3}
    assert assistant.quota_left(usage, 30, today) == 27
    assert assistant.quota_left(usage, 30, today + timedelta(days=1)) == 30
    assert assistant.quota_left({"day": "2026-10-10", "count": 99}, 30, today) == 0


# --- Entreprise et édito --------------------------------------------------------------------------------


def test_company_offline_reads_the_indicators():
    profile = {"sector": "Technology", "trailingPE": 45.0, "profitMargins": 0.25, "revenueGrowth": 0.3, "beta": 1.6}
    text = assistant.company_offline("Nvidia", profile, {"Variation sur la période affichée (%)": 12.5,
                                                         "Position dans la fourchette sur 52 semaines (%)": 95})
    strengths, warnings = text.split("**Points de vigilance**")
    assert "Marge nette de 25,0 %" in strengths and "en hausse de 30,0 %" in strengths
    assert "PER de 45,0" in warnings and "Bêta de 1,60" in warnings and "plus haut sur un an" in warnings
    assert text.startswith("**En bref** : Nvidia (Technology), +12,5 % sur la période affichée.")
    empty = assistant.company_offline("X", {}, {})
    assert "Aucun indicateur ne ressort" in empty and "Aucun signal" in empty


def test_company_and_digest_messages_contain_the_data():
    profile = {"trailingPE": 22.14, "sector": "Luxe", "returnOnEquity": 0.16586, "marketCap": 187.3e9, "beta": "?"}
    messages, sources = assistant.company_messages("LVMH", "MC.PA", profile, {"Période affichée": "1 an"}, ARTICLES)
    prompt = messages[0]["content"]
    assert "LVMH (MC.PA)" in prompt and "PER (12 derniers mois) : 22,1" in prompt and "Période affichée : 1 an" in prompt
    assert "ROE : 16,6 %" in prompt and "Capitalisation : 187,3 milliards" in prompt and "Bêta" not in prompt
    assert len(sources) == 6 and "[6]" in prompt
    messages, sources = assistant.digest_messages(ARTICLES, [], now=NOW)
    assert "samedi 10 octobre 2026" in messages[0]["content"] and len(sources) == assistant.MAX_SOURCES
