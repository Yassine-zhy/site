"""Calculs de marché et mise en forme à la française."""

from datetime import datetime, timezone
from types import SimpleNamespace

import pandas as pd

import theme
from core.market import Quote


def make_quote(values, unit="%"):
    history = pd.Series(values, dtype=float)
    return Quote("X", "X", "G", unit, values[-1], values[-2], history)


def test_variation_en_pourcentage_et_sur_periode():
    quote = make_quote([100, 104, 110])
    assert round(quote.change, 4) == round((110 / 104 - 1) * 100, 4)
    assert round(quote.change_over(2), 6) == 10.0


def test_variation_d_un_taux_en_points_de_base():
    quote = make_quote([5.20, 5.23, 5.24], unit="pb")
    assert round(quote.change, 6) == 1.0


def test_nombres_signes_et_montants_a_la_francaise():
    assert theme.fr_number(8012.345) == "8 012,35"
    assert theme.signed(-1.2) == "−1,20 %"
    assert theme.signed(3.04, "pb") == "+3,0 pb"
    assert theme.compact_money(187_326_775_296, "EUR") == "187,3 Md€"


def test_echappement_html_et_liens_surs():
    assert theme.esc('<img src=x onerror="alert(1)">') == "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    assert theme.safe_url("javascript:alert(1)") == "#"
    assert theme.safe_url("https://example.com/?a=1&b=2") == "https://example.com/?a=1&amp;b=2"


def test_horloges_des_places_boursieres():
    tuesday_noon_paris = datetime(2026, 10, 6, 10, 0, tzinfo=timezone.utc)  # 12:00 à Paris
    status = {city: is_open for city, _, is_open in theme.exchange_status(tuesday_noon_paris)}
    assert status["Paris"] and status["Londres"] and not status["New York"]
    saturday = datetime(2026, 10, 10, 10, 0, tzinfo=timezone.utc)
    assert not any(is_open for _, _, is_open in theme.exchange_status(saturday))


# --- Refonte du design (étape 15) ----------------------------------------------------------------


def contrast(color_a: str, color_b: str) -> float:
    """Rapport de contraste WCAG entre deux couleurs « #RRGGBB » (de 1 à 21)."""
    def luminance(color: str) -> float:
        channels = [int(color.lstrip("#")[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        r, g, b = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    light, dark = sorted([luminance(color_a), luminance(color_b)], reverse=True)
    return (light + 0.05) / (dark + 0.05)


def test_les_boutons_principaux_restent_lisibles_en_clair_et_en_sombre():
    """Streamlit écrit en blanc sur la couleur principale : elle doit être assez foncée dans les DEUX thèmes."""
    import tomllib
    from pathlib import Path

    config = tomllib.loads((Path(__file__).parent.parent / ".streamlit" / "config.toml").read_text())
    for mode in ("light", "dark"):
        palette = config["theme"][mode]
        assert contrast(palette["primaryColor"], "#FFFFFF") >= 4.5, mode  # texte du bouton
        assert contrast(palette["primaryColor"], palette["backgroundColor"]) >= 3, mode  # bouton visible sur le fond
        assert contrast(palette["textColor"], palette["backgroundColor"]) >= 7, mode  # texte courant


def test_variation_coloree_carte_et_tableau():
    assert theme.change(1.2) == '<span class="fv-up">+1,20 %</span>'
    assert theme.change(-0.5).startswith('<span class="fv-down">')
    html = theme.table(["A", "B"], "<tr><td>x</td><td>y</td></tr>")
    assert html.startswith('<div class="fv-table-wrap">') and "<th>A</th><th>B</th>" in html
    assert theme.card("<p>corps</p>", "Titre").startswith('<section class="fv-card"><h3 class="fv-card-title">Titre')  # h3 : sous une section h2
    assert "<script>" not in theme.card("", "<script>")  # le titre est échappé


# --- L'accueil raconte la séance (étape 32) --------------------------------------------------------


def test_le_recit_de_la_seance_en_chapitres():
    def quote(name, last, previous):
        return Quote(name, name, "G", "%", last, previous, pd.Series([previous, last], dtype=float))

    index = quote("CAC 40", 7859.74, 7868.40)
    cac40 = [quote("Sanofi", 102.9, 100), quote("Accor", 102, 100), quote("Legrand", 98, 100),
             quote("Schneider Electric", 97, 100)]
    lead = SimpleNamespace(title="La Fed <b>baisse</b> ses taux")
    html = theme.story_html(index, cac40, lead, echoes=3, now=datetime(2026, 10, 20, 12, 0, tzinfo=timezone.utc))
    assert html.count('<article class="fv-ch') == 4  # la séance, la hausse, la baisse, l'actualité
    assert html.count('aria-hidden="false"') == 1  # un seul chapitre lu à la fois
    assert "Mardi 20 octobre, 14 h 00" in html and "Le CAC 40 recule de" in html
    assert "Sanofi, " in html and "Schneider Electric, " in html
    assert "2 valeurs en hausse, 2 en baisse" in html and "Reprise par 3 autres sources" in html
    assert "&lt;b&gt;baisse&lt;/b&gt;" in html  # le titre de la dépêche est échappé
    # sans les cours des 40 valeurs ni dépêche, il reste la séance
    assert theme.story_html(index).count('<article class="fv-ch') == 1


# --- Les maquettes 3D (étape 33) ---------------------------------------------------------------------------------


def test_les_emplacements_des_maquettes():
    import scene3d

    html = scene3d.vitrine("globe", {"markers": [{"name": 'S&P "500"'}]}, label="Un globe <3D>", caption="Légende")
    assert 'data-obj="globe"' in html and 'role="img"' in html and "&lt;3D&gt;" in html
    assert "&quot;S&amp;P \\&quot;500\\&quot;&quot;" in html  # les données JSON, échappées dans l'attribut
    assert "<figcaption>Légende</figcaption>" in html
    assert scene3d.page_object("inconnue") == ""
    index = Quote("CAC 40", "CAC 40", "G", "%", 7859.74, 7868.40, pd.Series([7868.40, 7859.74], dtype=float))
    story = theme.story_html(index, city={"towers": [{"n": "Sanofi", "w": 5.6, "c": 2.9}]})
    assert 'data-obj="city"' in story and "fv-story has-obj" in story


def test_chaque_maquette_a_une_action():
    import scene3d

    for name, (_, settings, _, _) in scene3d.OBJECTS.items():
        act = settings["act"]
        assert act["type"] in {"search", "reveal", "ask", "next"}, name
        assert (act.get("hintAll") or act["hint"]).startswith("Cliquer"), name  # le survol annonce le clic
        if act["type"] == "reveal":
            assert act["in"] and act["keyed"], name
    assert scene3d.CITY_ACT["type"] == "search" and scene3d.CITY_ACT["then"] == "#fv-fil"


def test_le_plein_ecran_libere_ses_ancetres():
    """Pendant le plein écran, les ancêtres du cadre perdent leurs effets (verre dépoli, transformation…), sinon le
    cadre « fixé à l'écran » se cale sur eux. Le bouton s'appelle « Close fullscreen », suivi de la description de
    l'élément s'il en a une (« Close fullscreen: Cours et variations… ») : la règle vise le début de l'étiquette."""
    assert 'button[aria-label^="Close fullscreen"]' in theme.CSS
    rule = theme.CSS.split('button[aria-label^="Close fullscreen"]', 1)[1].split("}", 1)[0]
    assert ':not([data-testid="stFullScreenFrame"])' in rule  # le cadre garde son propre z-index
    for effect in ("backdrop-filter: none", "transform: none", "filter: none", "animation: none"):
        assert effect in rule
