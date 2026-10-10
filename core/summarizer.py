"""Résumé automatique des articles.

Trois moteurs, du plus simple au plus avancé :
- « local » : résumé **extractif** (on garde les phrases les plus représentatives), sans Internet ni clé ;
- Gemini (Google) ou Groq : un modèle de langage rédige un résumé en français (offres gratuites, clé requise).
Si un moteur en ligne échoue (quota, panne), on retombe automatiquement sur le résumé local.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import asdict, dataclass

import requests
import trafilatura

from core.config import REQUEST_TIMEOUT
from core.filters import normalize
from core.models import Article

# Les sites d'information refusent souvent les robots : on se présente comme un navigateur classique.
BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
    "Accept-Language": "fr,en;q=0.8",
}
MAX_LLM_CHARS = 12_000  # au-delà, on coupe le texte envoyé au modèle (quota et rapidité)

DEFAULT_MODELS = {"gemini": "gemini-flash-latest", "groq": "llama-3.3-70b-versatile"}

PROMPT = """Tu es un journaliste financier. Résume l'article ci-dessous pour un étudiant en finance.

Réponds en français, exactement dans ce format :
- (premier point clé, une phrase factuelle)
- (deuxième point clé)
- (troisième point clé)
Pourquoi c'est important : (une phrase sur la portée pour les marchés ou l'économie)

N'invente aucun chiffre : utilise seulement ceux de l'article.

Titre : {title}
Article :
{text}"""

# Mots trop fréquents pour être informatifs (« mots vides »), en anglais et en français
STOPWORDS = set(
    """a an and are as at be been but by for from has have he her his i in is it its of on or our said she that the
    their them they this to was we were which who will with would you not also more than after over about into up out
    le la les un une des de du et en est que qui dans pour par sur au aux avec ce ces cette il elle ils elles sont ont
    ne pas plus se sa son ses leur leurs mais ou comme été être fait a y d l qu c s n à""".split()
)
_SENTENCE_RE = re.compile(r"(?<=[.!?…])\s+(?=[\"«“A-ZÀ-ÖØ-Þ0-9])")
_WORD_RE = re.compile(r"[a-z0-9']+")


@dataclass
class Summary:
    points: list[str]
    why: str | None  # « Pourquoi c'est important » (seulement avec un modèle de langage)
    engine: str  # « Gemini », « Groq » ou « Résumé local »
    based_on: str  # « article complet » ou « chapeau seulement »
    note: str | None = None  # explication si on a dû se rabattre sur un autre moteur

    def to_dict(self) -> dict:
        return asdict(self)


class SummaryError(Exception):
    """Le moteur de résumé en ligne n'a pas pu répondre."""


def extract_text(url: str) -> str | None:
    """Texte principal d'une page web (sans menus ni publicités), ou None si le site refuse."""
    try:
        response = requests.get(url, headers=BROWSER_HEADERS, timeout=REQUEST_TIMEOUT)
    except requests.RequestException:
        return None
    if not response.ok:  # 403 (robots refusés), 402 (article payant)…
        return None
    return trafilatura.extract(response.text, include_comments=False, include_tables=False, favor_precision=True)


def split_sentences(text: str) -> list[str]:
    # Les lignes très courtes sont des restes de mise en page (« - Published », « Share »…) : on les retire.
    text = " ".join(line for line in text.splitlines() if len(line.strip()) >= 25) or text
    sentences = _SENTENCE_RE.split(re.sub(r"\s+", " ", text).strip())
    return [s.strip() for s in sentences if 40 <= len(s.strip()) <= 400]  # ni bribes, ni pavés


def summarize_local(text: str, count: int = 3) -> list[str]:
    """Résumé extractif « à la Luhn » (1958) : on note chaque phrase selon la fréquence de ses mots.

    1. On compte les mots du texte (sauf les mots vides) : les plus fréquents portent le sujet.
    2. Le score d'une phrase = somme des fréquences de ses mots ÷ nombre de mots (pour ne pas favoriser les longues).
    3. On garde les `count` meilleures phrases, dans leur ordre d'origine.
    """
    sentences = split_sentences(text)
    if len(sentences) <= count:
        return sentences or ([text.strip()] if text.strip() else [])

    def words(sentence: str) -> list[str]:
        return [w for w in _WORD_RE.findall(normalize(sentence)) if w not in STOPWORDS and len(w) > 2]

    frequencies = Counter(w for sentence in sentences for w in words(sentence))
    top = max(frequencies.values(), default=1)

    def score(item: tuple[int, str]) -> float:
        index, sentence = item
        tokens = words(sentence)
        position_bonus = 1.15 if index < 3 else 1.0  # dans la presse, l'essentiel est souvent au début
        return position_bonus * sum(frequencies[w] / top for w in tokens) / (len(tokens) or 1)

    best = sorted(enumerate(sentences), key=score, reverse=True)[:count]
    return [sentence for _, sentence in sorted(best)]  # remet dans l'ordre du texte


def _parse_llm_answer(answer: str) -> tuple[list[str], str | None]:
    """Sépare les points (« - … ») et la ligne « Pourquoi c'est important : … »."""
    points, why = [], None
    for line in answer.splitlines():
        line = line.strip()
        if line.lower().startswith("pourquoi c'est important"):
            why = line.split(":", 1)[-1].strip()
        elif line.startswith(("-", "•", "*")):
            points.append(line.lstrip("-•* ").strip())
    if not points:  # le modèle n'a pas respecté le format : on garde le texte brut
        points = [answer.strip()]
    return points, why


def summarize_gemini(title: str, text: str, api_key: str, model: str | None = None) -> str:
    """Appelle l'API Gemini de Google (offre gratuite : https://aistudio.google.com/apikey)."""
    model = model or DEFAULT_MODELS["gemini"]
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        headers={"x-goog-api-key": api_key},  # clé dans l'en-tête, jamais dans l'URL
        json={
            "contents": [{"parts": [{"text": PROMPT.format(title=title, text=text[:MAX_LLM_CHARS])}]}],
            "generationConfig": {"temperature": 0.2, "maxOutputTokens": 500},
        },
        timeout=30,
    )
    if not response.ok:
        raise SummaryError(f"Gemini a répondu {response.status_code}")
    try:
        return response.json()["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:  # réponse vide (ex. contenu filtré)
        raise SummaryError("Gemini n'a pas renvoyé de texte") from exc


def summarize_groq(title: str, text: str, api_key: str, model: str | None = None) -> str:
    """Appelle l'API de Groq, compatible avec le format « chat completions » (https://console.groq.com/keys)."""
    model = model or DEFAULT_MODELS["groq"]
    response = requests.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": model,
            "messages": [{"role": "user", "content": PROMPT.format(title=title, text=text[:MAX_LLM_CHARS])}],
            "temperature": 0.2,
            "max_tokens": 500,
        },
        timeout=30,
    )
    if not response.ok:
        raise SummaryError(f"Groq a répondu {response.status_code}")
    try:
        return response.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError) as exc:
        raise SummaryError("Groq n'a pas renvoyé de texte") from exc


def summarize(article: Article, ai_keys: dict[str, str | None], engine: str = "auto") -> Summary:
    """Résume un article avec le meilleur moteur disponible.

    `engine` : "auto" (Gemini, sinon Groq, sinon local) ou "local" (jamais d'appel en ligne).
    """
    full_text = extract_text(article.url)
    text = full_text or f"{article.title}. {article.summary}"
    based_on = "article complet" if full_text else "chapeau seulement (le site refuse la lecture automatique)"

    note = None
    if engine == "auto":
        engines = [
            ("Gemini", summarize_gemini, ai_keys.get("GEMINI_API_KEY"), ai_keys.get("GEMINI_MODEL")),
            ("Groq", summarize_groq, ai_keys.get("GROQ_API_KEY"), ai_keys.get("GROQ_MODEL")),
        ]
        for name, function, key, model in engines:
            if not key:
                continue
            try:
                points, why = _parse_llm_answer(function(article.title, text, key, model))
                return Summary(points, why, name, based_on)
            except (requests.RequestException, SummaryError, ValueError) as exc:
                note = f"{name} indisponible ({exc.__class__.__name__ if not isinstance(exc, SummaryError) else exc})"

    return Summary(summarize_local(text), None, "Résumé local", based_on, note)
