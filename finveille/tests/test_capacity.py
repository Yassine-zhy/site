"""Tests de la tenue de charge : file d'attente des pages, mémoire bornée, repli sur les dernières données."""

import threading
import time

import pytest

import ui
from core import capacity


def run_threads(count: int, target) -> None:
    threads = [threading.Thread(target=target) for _ in range(count)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()


def test_queue_never_runs_more_pages_than_slots():
    queue, running, peak, lock = capacity.RenderQueue(slots=3), [0], [0], threading.Lock()

    def visitor():
        with queue.slot():
            with lock:
                running[0] += 1
                peak[0] = max(peak[0], running[0])
            time.sleep(0.02)
            with lock:
                running[0] -= 1

    run_threads(30, visitor)
    stats = queue.stats()
    assert peak[0] == 3 and stats["served"] == 30 and stats["running"] == 0 and stats["waiting"] == 0
    assert stats["max_waiting"] > 0  # des visiteurs ont bien attendu leur tour


def test_queue_tells_the_visitor_to_wait_and_frees_the_slot_after_an_error():
    queue, told = capacity.RenderQueue(slots=1), []
    entered, leave = threading.Event(), threading.Event()

    def first():
        with queue.slot():
            entered.set()
            leave.wait(2)

    thread = threading.Thread(target=first)
    thread.start()
    entered.wait(2)
    threading.Timer(0.05, leave.set).start()
    with pytest.raises(RuntimeError):
        with queue.slot(on_wait=lambda: told.append("ta page arrive")):
            raise RuntimeError("erreur dans la page")  # comme st.rerun() ou un bug : la place est rendue
    thread.join()
    assert told == ["ta page arrive"]
    with queue.slot(timeout=0.1) as acquired:  # la place est libre
        assert acquired


def test_queue_is_reentrant_and_releases_during_network_waits():
    queue = capacity.RenderQueue(slots=1)
    with queue.slot():
        with queue.slot() as again:  # un fragment dans la page : pas de seconde place, pas de blocage
            assert again
        other = []
        with queue.released():  # l'IA rédige : un autre visiteur peut passer pendant ce temps
            thread = threading.Thread(target=lambda: other.append(queue._semaphore.acquire(timeout=1)))
            thread.start()
            thread.join()
            queue._semaphore.release()
        assert other == [True]
    assert queue.stats()["running"] == 0


def test_queue_shows_the_page_anyway_after_the_timeout():
    queue = capacity.RenderQueue(slots=1)
    queue._semaphore.acquire()  # une page bloquée
    with queue.slot(timeout=0.05) as acquired:
        assert acquired is False  # on affiche quand même : mieux vaut lent que jamais
    queue._semaphore.release()
    with queue.slot(timeout=0.05) as acquired:
        assert acquired  # et la place n'a pas été « rendue » deux fois


def test_memory_is_bounded_and_expires():
    memory = capacity.Memory(max_entries=3, ttl=10)
    for n in range(5):
        memory.put(f"k{n}", n, now=0)
    assert len(memory) == 3 and memory.get("k0", now=1) is None and memory.get("k4", now=1) == 4
    assert memory.get("k4", now=10) is None  # expirée
    memory.put("court", "x", now=0, ttl=1)
    assert memory.get("court", now=0.5) == "x" and memory.get("court", now=2) is None


def test_resilient_serves_the_last_good_answer(monkeypatch):
    monkeypatch.setattr(ui, "LAST_GOOD", capacity.Memory())
    answers = iter([[1, 2, 3], RuntimeError("429 Too Many Requests")])

    def fetch(symbol):
        answer = next(answers)
        if isinstance(answer, Exception):
            raise answer
        return answer

    assert ui._resilient("quotes", fetch, "MC.PA", empty=[]) == [1, 2, 3]
    assert ui._resilient("quotes", fetch, "MC.PA", empty=[]) == [1, 2, 3]  # Yahoo en panne : le dernier connu
    assert ui._resilient("quotes", lambda s: 1 / 0, "AIR.PA", empty=[]) == []  # jamais réussi : vide
    with pytest.raises(LookupError):
        ui._not_empty([])  # une réponse vide n'est pas gardée en cache : on réessaiera


def test_symbol_quotes_are_shared_between_visitors(monkeypatch):
    calls = []

    def fake_fetch(watchlist):
        calls.append([symbol for symbol, *_ in watchlist])
        return [ui.market.Quote(symbol, label, group, unit, 10.0, 9.0, None) for symbol, label, group, unit in watchlist]

    monkeypatch.setattr(ui, "fetch_quotes", fake_fetch)
    monkeypatch.setattr(ui, "SYMBOL_QUOTES", capacity.Memory())
    monkeypatch.setattr(ui, "LAST_GOOD", capacity.Memory())
    assert set(ui.load_symbol_quotes(("MC.PA", "AIR.PA"))) == {"MC.PA", "AIR.PA"}  # Alice
    assert set(ui.load_symbol_quotes(("AIR.PA", "TTE.PA"))) == {"AIR.PA", "TTE.PA"}  # Bob : Airbus déjà connu
    assert calls == [["MC.PA", "AIR.PA"], ["TTE.PA"]]


def test_scrypt_runs_at_most_four_at_a_time(monkeypatch):
    from core import accounts

    running, peak, lock = [0], [0], threading.Lock()
    real_scrypt = accounts.hashlib.scrypt

    def counting_scrypt(*args, **kwargs):
        with lock:
            running[0] += 1
            peak[0] = max(peak[0], running[0])
        time.sleep(0.01)
        with lock:
            running[0] -= 1
        return real_scrypt(*args, **kwargs)

    monkeypatch.setattr(accounts.hashlib, "scrypt", counting_scrypt)
    run_threads(12, lambda: accounts.hash_password("motdepasse123"))
    assert peak[0] <= 4


def test_caches_with_parameters_are_bounded():
    """Un cache qui dépend d'un paramètre (symbole, recherche…) sans limite finirait par saturer la mémoire."""
    for name in ["_followed", "_search", "_profile", "_history", "_calendar", "_closes", "_articles", "load_trends",
                 "load_macro", "_yield_curves"]:
        assert getattr(ui, name)._info.max_entries is not None, name
