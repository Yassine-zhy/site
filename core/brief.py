"""Le brief : une édition du jour rédigée automatiquement, à lire en deux minutes ou à télécharger."""

from __future__ import annotations

import html
from dataclasses import dataclass, field
from datetime import date, timedelta

from core import analytics
from core.models import Article

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

    def to_html(self, site_url: str = "") -> str:
        """Le brief en HTML pour un e-mail : styles écrits dans chaque balise (les messageries ignorent souvent
        les feuilles de style), une seule colonne de 600 pixels, lisible sur téléphone."""
        esc = html.escape
        font = "font-family:Arial,Helvetica,sans-serif;color:#0f1724"
        muted = "font-family:Arial,Helvetica,sans-serif;color:#5b6677;font-size:13px"

        def title(text: str) -> str:
            return f'<h2 style="{font};font-size:16px;margin:26px 0 8px;border-top:1px solid #e4e8ee;padding-top:16px">{esc(text)}</h2>'

        def items(rows: list[str]) -> str:
            return '<ul style="padding-left:18px;margin:0">' + "".join(
                f'<li style="{font};font-size:15px;line-height:1.5;margin:0 0 8px">{row}</li>' for row in rows) + "</ul>"

        parts = [
            '<div style="max-width:600px;margin:0 auto;padding:24px 20px;background:#ffffff">',
            f'<p style="{font};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#1f4ed8;margin:0">'
            f"FinVeille · le brief</p>",
            f'<h1 style="{font};font-size:24px;margin:6px 0 4px">{esc(self.date_label.capitalize())}</h1>',
            title("Les marchés"),
            f'<p style="{font};font-size:16px;line-height:1.55;margin:0">{esc(self.market or "—")}</p>',
        ]
        if self.headlines:
            parts += [title("À la une"), items([
                f'<b>{esc(rubric)}</b> · <a href="{esc(url)}" style="color:#1f4ed8">{esc(headline)}</a> '
                f'<span style="{muted}">({esc(source)})</span>'
                for rubric, headline, source, url in self.headlines])]
        if self.topics:
            parts += [title("Les sujets qui montent"),
                      items([f"{esc(term)} <span style='{muted}'>· {count} dépêches en 24 h</span>"
                             for term, count, _ in self.topics])]
        if self.companies:
            parts += [title("Mes entreprises"), items([f"{esc(name)} : <b>{esc(change)}</b>"
                                                       for name, change in self.companies])]
        if self.agenda:
            parts += [title("Agenda"), items([f"<b>{esc(day)}</b> · {esc(event)}" for day, event in self.agenda])]
        if self.word:
            parts += [title("Le mot du jour"),
                      f'<p style="{font};font-size:15px;line-height:1.5;margin:0"><b>{esc(self.word[0])}</b> : '
                      f"{esc(self.word[1])}</p>"]
        link = f' · <a href="{esc(site_url)}" style="color:#1f4ed8">Ouvrir FinVeille</a>' if site_url else ""
        parts += [f'<p style="{muted};margin-top:28px;border-top:1px solid #e4e8ee;padding-top:12px">Brief rédigé '
                  f"automatiquement à partir de sources publiques, sans conseil en investissement{link}. Pour ne plus "
                  "le recevoir : Réglages → Notifications par e-mail.</p></div>"]
        return "".join(parts)


def front_page(recent: list[Article], categories: dict[str, str]) -> list[tuple[str, Article, int]]:
    """Dans chaque rubrique, l'histoire reprise par le plus de sources : (rubrique, article, autres sources)."""
    page = []
    for key, label in categories.items():
        ranked = analytics.most_covered([a for a in recent if a.category == key])
        if ranked:
            article, echoes = ranked[0]
            page.append((label, article, echoes))
    return page


def upcoming_events(calendars: dict[str, dict], names: dict[str, str], today: date,
                    days: int = 45) -> list[tuple[date, str]]:
    """Les résultats et détachements de dividende à venir dans les `days` prochains jours, par date."""
    agenda = []
    for symbol, calendar in calendars.items():
        for key, event in [("earnings", "publie ses résultats"), ("ex_dividend", "détache son dividende")]:
            day = calendar.get(key)
            if day and today <= day <= today + timedelta(days=days):
                agenda.append((day, f"{names.get(symbol, symbol)} {event}"))
    return sorted(agenda)
