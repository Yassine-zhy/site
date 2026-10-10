"""Le brief : une édition du jour rédigée automatiquement, à lire en deux minutes ou à télécharger."""

from __future__ import annotations

from dataclasses import dataclass, field

# Les instruments cités dans le brief : symbole -> (nom dans une phrase, nom court pour un tableau)
HEADLINE_INSTRUMENTS = {
    "^FCHI": ("le CAC 40", "CAC 40"),
    "^GSPC": ("le S&P 500", "S&P 500"),
    "EURUSD=X": ("l'euro face au dollar", "EUR/USD"),
    "BZ=F": ("le pétrole Brent", "Pétrole Brent"),
    "GC=F": ("l'or", "Or"),
    "BTC-USD": ("le bitcoin", "Bitcoin"),
}


def fr_pct(value: float) -> str:
    """« 0,95 % » (sans signe : le verbe dit le sens)."""
    return f"{abs(value):.2f}".replace(".", ",") + " %"


def verb(change: float) -> str:
    """Le verbe qui décrit une variation : « gagne », « cède », « est stable »."""
    if change >= 1.5:
        return "s'envole de"
    if change > 0.05:
        return "gagne"
    if change <= -1.5:
        return "chute de"
    if change < -0.05:
        return "cède"
    return "est stable"


def market_sentence(changes: dict[str, float]) -> str:
    """Résume la séance en une ou deux phrases à partir des variations du jour ({symbole: variation en %}).

    Exemple : « Séance de hausse à Paris : le CAC 40 gagne 0,95 %. Ailleurs, le S&P 500 gagne 0,59 %, … »
    """
    known = {s: c for s, c in changes.items() if s in HEADLINE_INSTRUMENTS}
    if not known:
        return ""

    def clause(symbol: str) -> str:
        name, _ = HEADLINE_INSTRUMENTS[symbol]
        change = known[symbol]
        action = verb(change)
        return f"{name} {action}" + ("" if action == "est stable" else f" {fr_pct(change)}")

    parts = []
    if "^FCHI" in known:
        cac = known["^FCHI"]
        mood = "hausse" if cac > 0.05 else "baisse" if cac < -0.05 else "stabilité"
        parts.append(f"Séance de {mood} à Paris : {clause('^FCHI')}.")
    others = [clause(symbol) for symbol in HEADLINE_INSTRUMENTS if symbol in known and symbol != "^FCHI"]
    if others:
        listing = ", ".join(others[:-1]) + (" et " if len(others) > 1 else "") + others[-1]
        parts.append(f"{'Ailleurs' if parts else 'Sur les marchés'}, {listing}.")
    sentence = " ".join(parts)
    return sentence[0].upper() + sentence[1:]


@dataclass
class Brief:
    """Le contenu du brief, sous forme de données simples (facile à afficher, à tester et à exporter)."""

    date_label: str
    market: str
    headlines: list[tuple[str, str, str, str]] = field(default_factory=list)  # (rubrique, titre, source, lien)
    topics: list[tuple[str, int, int]] = field(default_factory=list)  # (sujet, dépêches récentes, avant)
    companies: list[tuple[str, str]] = field(default_factory=list)  # (entreprise, variation formatée)
    agenda: list[tuple[str, str]] = field(default_factory=list)  # (date formatée, événement)
    word: tuple[str, str] | None = None  # (terme, définition)

    def to_markdown(self) -> str:
        """Le brief au format Markdown : un fichier texte lisible partout (et joli sur GitHub ou Notion)."""
        lines = [f"# FinVeille · Le brief du {self.date_label}", "", "## Les marchés", "", self.market or "—", ""]
        if self.headlines:
            lines += ["## À la une", ""] + [f"- **{rubric}** · [{title}]({url}) ({source})"
                                            for rubric, title, source, url in self.headlines] + [""]
        if self.topics:
            lines += ["## Les sujets qui montent", ""] + [f"- {term} : {count} dépêches en 24 h"
                                                          for term, count, _ in self.topics] + [""]
        if self.companies:
            lines += ["## Mes entreprises", ""] + [f"- {name} : {change}" for name, change in self.companies] + [""]
        if self.agenda:
            lines += ["## Agenda", ""] + [f"- {day} · {event}" for day, event in self.agenda] + [""]
        if self.word:
            lines += ["## Le mot du jour", "", f"**{self.word[0]}** : {self.word[1]}", ""]
        lines += ["---", "Brief rédigé automatiquement par FinVeille à partir de sources publiques. "
                  "Ce n'est pas un conseil en investissement."]
        return "\n".join(lines)
