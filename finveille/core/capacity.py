"""Tenir la charge : une file d'attente pour l'affichage des pages.

Pourquoi ? Streamlit exécute le script de chaque visiteur dans son propre fil d'exécution (« thread »), mais Python
n'exécute qu'un seul fil à la fois (le « GIL »). Avec 100 visiteurs qui arrivent ensemble, les 100 scripts avancent
tous en même temps… donc tous lentement : tout le monde attend la fin, et le serveur, trop occupé, ne répond plus
aux signaux de vie des navigateurs (les « pings ») : les connexions sont coupées.

Avec une file d'attente, seuls quelques scripts tournent à la fois (4 par défaut) ; les autres attendent leur tour
sans consommer de processeur. Les premiers arrivés sont servis tout de suite, le serveur reste réactif, et plus
personne n'est déconnecté. C'est le principe d'un guichet : mieux vaut 4 guichets qui avancent qu'un seul guichetier
qui sert 100 personnes « en même temps ».

Une longue attente réseau (la réponse de l'IA) rend sa place le temps de l'attente (`released`).
"""

from __future__ import annotations

import threading
import time
from collections import OrderedDict
from contextlib import contextmanager
from typing import Any, Callable, Iterator

DEFAULT_SLOTS = 4
DEFAULT_WAIT = 45  # au-delà, on affiche quand même la page (mieux vaut lent que jamais)


class RenderQueue:
    """Au plus `slots` affichages de page en même temps ; les suivants attendent leur tour."""

    def __init__(self, slots: int = DEFAULT_SLOTS):
        self.slots = max(1, slots)
        self._semaphore = threading.Semaphore(self.slots)
        self._lock = threading.Lock()
        self._local = threading.local()  # la place est tenue par un fil d'exécution précis
        self.waiting = self.running = self.served = self.max_waiting = 0
        self.longest_wait = 0.0

    def _holding(self) -> bool:
        return getattr(self._local, "held", False)

    @contextmanager
    def slot(self, timeout: float = DEFAULT_WAIT, on_wait: Callable[[], None] | None = None) -> Iterator[bool]:
        """Attend une place, l'occupe pendant le bloc `with`, puis la libère (même en cas d'erreur ou de st.rerun).

        Réentrant : un fragment affiché pendant la page ne demande pas une seconde place (sinon, blocage).
        `on_wait` est appelée si la file est pleine (pour afficher « ta page arrive »).
        """
        if self._holding():
            yield True
            return
        acquired = self._semaphore.acquire(blocking=False)
        if not acquired:
            started = time.monotonic()
            with self._lock:
                self.waiting += 1
                self.max_waiting = max(self.max_waiting, self.waiting)
            if on_wait:
                on_wait()
            try:
                acquired = self._semaphore.acquire(timeout=timeout)
            finally:
                with self._lock:
                    self.waiting -= 1
                    self.longest_wait = max(self.longest_wait, time.monotonic() - started)
        self._local.held = acquired
        with self._lock:
            self.running += 1
        try:
            yield acquired
        finally:
            with self._lock:
                self.running -= 1
                self.served += 1
            if self._local.held:
                self._semaphore.release()
            self._local.held = False

    @contextmanager
    def released(self) -> Iterator[None]:
        """Rend sa place pendant une attente sans calcul (réponse de l'IA), puis la reprend."""
        if not self._holding():
            yield
            return
        self._local.held = False
        self._semaphore.release()
        try:
            yield
        finally:
            self._local.held = self._semaphore.acquire(timeout=DEFAULT_WAIT)

    def stats(self) -> dict:
        with self._lock:
            return {"slots": self.slots, "running": self.running, "waiting": self.waiting, "served": self.served,
                    "max_waiting": self.max_waiting, "longest_wait": round(self.longest_wait, 1)}


class Memory:
    """Une mémoire partagée par tous les visiteurs, **bornée** : au plus `max_entries` valeurs, chacune gardée `ttl`
    secondes. Quand elle est pleine, la valeur la plus ancienne est oubliée : la mémoire du serveur ne peut pas
    grossir sans fin (une fuite de mémoire finit toujours par un crash quand les visiteurs se multiplient)."""

    def __init__(self, max_entries: int = 500, ttl: float = 1800):
        self.max_entries, self.ttl = max_entries, ttl
        self._items: OrderedDict[str, tuple[float, Any]] = OrderedDict()  # clé → (heure d'expiration, valeur)
        self._lock = threading.Lock()

    def get(self, key: str, now: float | None = None) -> Any | None:
        now = time.monotonic() if now is None else now
        with self._lock:
            item = self._items.get(key)
            if item is None:
                return None
            if now >= item[0]:
                del self._items[key]
                return None
            return item[1]

    def put(self, key: str, value: Any, now: float | None = None, ttl: float | None = None) -> None:
        now = time.monotonic() if now is None else now
        with self._lock:
            self._items[key] = (now + (self.ttl if ttl is None else ttl), value)
            self._items.move_to_end(key)
            while len(self._items) > self.max_entries:
                self._items.popitem(last=False)

    def __len__(self) -> int:
        return len(self._items)


QUEUE = RenderQueue()
_configured = False


def configure(slots: int) -> None:
    """Fixe le nombre de places (secret RENDER_SLOTS) au premier affichage ; les appels suivants ne changent rien."""
    global QUEUE, _configured
    if not _configured:
        _configured = True
        if slots != QUEUE.slots:
            QUEUE = RenderQueue(slots)
