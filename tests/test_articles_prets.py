"""Les dépêches toujours prêtes (ui.load_articles) : le visiteur n'attend jamais une recollecte."""

import threading
import time

import ui
from core.models import Article
from datetime import datetime, timezone

KEYS = {"FINNHUB_API_KEY": None}


def article(title: str) -> Article:
    return Article(title=title, url=f"https://exemple.fr/{title}", source="Exemple",
                   published=datetime.now(timezone.utc))


def setup(monkeypatch, collect):
    ui.ARTICLES.clear()
    monkeypatch.setattr(ui, "collect_articles", collect)
    monkeypatch.setattr(ui, "_articles_warmer", lambda: None)
    monkeypatch.setattr(ui, "warm_favicons", lambda urls: list(urls))


def test_premiere_visite_attend_puis_la_suite_est_immediate(monkeypatch):
    calls = []
    setup(monkeypatch, lambda keys: (calls.append(1), ([article("A")], []))[1])
    assert [a.title for a in ui.load_articles(KEYS)[0]] == ["A"] and len(calls) == 1
    assert [a.title for a in ui.load_articles(KEYS)[0]] == ["A"] and len(calls) == 1  # pas de nouvelle collecte


def test_collecte_perimee_servie_aussitot_et_rafraichie_en_arriere_plan(monkeypatch):
    titles = iter(["Ancienne", "Nouvelle"])
    done = threading.Event()

    def slow_collect(keys):
        title = next(titles)
        if title == "Nouvelle":
            time.sleep(0.3)  # une collecte lente : le visiteur ne doit pas l'attendre
            done.set()
        return [article(title)], []

    setup(monkeypatch, slow_collect)
    ui.load_articles(KEYS)
    key = ui._articles_key(KEYS)
    at, value = ui.ARTICLES.get(key)
    ui.ARTICLES.put(key, (at - ui.ARTICLES_EVERY - 1, value))  # la collecte a plus de 15 minutes
    start = time.monotonic()
    assert [a.title for a in ui.load_articles(KEYS)[0]] == ["Ancienne"]  # servie tout de suite
    assert time.monotonic() - start < 0.2
    assert done.wait(2)
    time.sleep(0.05)
    assert [a.title for a in ui.load_articles(KEYS)[0]] == ["Nouvelle"]


def test_une_collecte_ratee_garde_la_precedente(monkeypatch):
    setup(monkeypatch, lambda keys: ([article("A")], []))
    ui.load_articles(KEYS)
    monkeypatch.setattr(ui, "collect_articles", lambda keys: ([], ["tout est en panne"]))
    ui.refresh_articles(KEYS)
    assert [a.title for a in ui.load_articles(KEYS)[0]] == ["A"]


def test_sans_aucune_source_un_fil_vide_et_un_message(monkeypatch):
    setup(monkeypatch, lambda keys: ([], ["panne"]))
    articles, errors, _ = ui.load_articles(KEYS)
    assert articles == [] and errors == ui._NO_ARTICLES


def test_actualiser_refait_une_collecte(monkeypatch):
    calls = []
    setup(monkeypatch, lambda keys: (calls.append(1), ([article("A")], []))[1])
    ui.load_articles(KEYS)
    ui.load_articles.clear()
    ui.load_articles(KEYS)
    assert len(calls) == 2
