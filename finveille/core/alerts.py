"""Alertes de cours : prévenir quand un cours franchit un seuil ou bouge fortement dans la journée."""

from __future__ import annotations

KINDS = {
    "above": "Au-dessus de",
    "below": "En dessous de",
    "move": "Variation du jour d'au moins (en %)",
}


def is_triggered(alert: dict, last: float, change_pct: float) -> bool:
    """Vrai si la condition de l'alerte est remplie avec ce cours et cette variation du jour."""
    if alert["kind"] == "above":
        return last >= alert["threshold"]
    if alert["kind"] == "below":
        return last <= alert["threshold"]
    return abs(change_pct) >= alert["threshold"]  # "move" : hausse OU baisse d'au moins X %


def describe(alert: dict) -> str:
    """Phrase lisible : « LVMH au-dessus de 400 », « Airbus : variation du jour d'au moins 3 % »."""
    threshold = f"{alert['threshold']:g}".replace(".", ",")
    if alert["kind"] == "above":
        return f"{alert['label']} au-dessus de {threshold}"
    if alert["kind"] == "below":
        return f"{alert['label']} en dessous de {threshold}"
    return f"{alert['label']} : variation du jour d'au moins {threshold} %"


def check(alerts: list[dict], quotes: dict) -> list[tuple[dict, object]]:
    """Les alertes déclenchées, avec la cotation correspondante. `quotes` : {symbole: Quote}."""
    fired = []
    for alert in alerts:
        quote = quotes.get(alert["symbol"])
        if quote is not None and is_triggered(alert, quote.last, quote.change):
            fired.append((alert, quote))
    return fired
