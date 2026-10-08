"""
Sauvegarde de l'état du bot dans un fichier JSON.

Grâce à ce fichier, un redémarrage (coupure de courant, mise à jour...) ne
fait pas oublier la position ouverte ni son prix d'achat : le stop-loss et
le take-profit continuent de s'appliquer.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def default_state(paper_start_balance: float) -> dict[str, Any]:
    """État initial : aucune position ouverte."""
    return {
        "symbol": None,
        "in_position": False,
        "entry_price": None,       # prix moyen d'achat
        "amount": 0.0,             # quantité de crypto détenue par le bot
        "entry_cost": 0.0,         # USDT dépensés à l'achat, frais inclus
        "entry_time": None,
        "last_buy_candle": None,   # bougie dont le signal a déjà servi à acheter
        "pending_buy": None,       # achat interrompu par le réseau, à vérifier
        "realized_pnl": 0.0,       # gains / pertes cumulés (en USDT)
        "trades": 0,
        "wins": 0,
        # Conseiller IA (STRATEGY=ai).
        "ai_last_call": None,      # date de la dernière consultation (UTC)
        "ai_last_price": None,     # prix à ce moment-là
        "ai_calls_day": None,      # jour en cours...
        "ai_calls_count": 0,       # ...et nombre de consultations ce jour-là
        "ai_cost_total": 0.0,      # dépense estimée cumulée, en dollars
        "ai_history": [],          # dernières décisions, renvoyées à l'IA
        # Portefeuille virtuel, utilisé uniquement en mode paper.
        "paper_quote": paper_start_balance,
        "paper_base": 0.0,
    }


class StateStore:
    """Lit et écrit l'état du bot dans un fichier JSON."""

    def __init__(self, path: Path, paper_start_balance: float):
        self.path = Path(path)
        self.paper_start_balance = paper_start_balance

    def load(self) -> dict[str, Any]:
        state = default_state(self.paper_start_balance)
        if not self.path.exists():
            return state
        try:
            saved = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            # On préfère s'arrêter plutôt que d'oublier une position ouverte.
            raise RuntimeError(
                f"Fichier d'état illisible : {self.path} ({exc}). "
                "Corrigez-le ou supprimez-le si aucune position n'est ouverte."
            ) from exc
        state.update(saved)
        return state

    def save(self, state: dict[str, Any]) -> None:
        # Écriture dans un fichier temporaire puis remplacement : si le PC
        # s'éteint pendant l'écriture, l'ancien fichier reste intact.
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self.path)
