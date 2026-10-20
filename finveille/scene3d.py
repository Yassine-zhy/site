"""Le monde 3D de FinVeille (guides 30 et 33) : une ambiance derrière les pages, et des maquettes dans les pages.

Le moteur (static/fv3d/, avec Three.js) tourne dans le navigateur du visiteur : le serveur n'envoie que des noms et
quelques données. Derrière la page, une étendue de particules (engine.js). Dans la page, depuis l'étape 33, un objet
par page, posé dans son en-tête : la ville du CAC 40, le globe des places, les pièces des cryptomonnaies… (vitrines.js,
models.js, atelier.js). Les fichiers du dossier static/ sont servis par Streamlit (server.enableStaticServing,
.streamlit/config.toml) et gardés en cache par le navigateur : la page n'attend jamais la 3D.

Sans WebGL (vieux navigateur, carte graphique désactivée), rien ne manque : les illustrations de l'étape 29 restent.
"""

from __future__ import annotations

import hashlib
import json
from html import escape
from pathlib import Path

import streamlit as st
from streamlit.errors import StreamlitAPIException

STATIC = Path(__file__).parent / "static" / "fv3d"
# La version du moteur : elle change avec ses fichiers et oblige le navigateur à recharger la nouvelle version
VERSION = hashlib.sha256(b"".join(path.read_bytes() for path in sorted(STATIC.rglob("*.js")))).hexdigest()[:12]

# Le composant ne contient que ce petit chargeur : le moteur arrive par une adresse à part, mise en cache.
LOADER = """
export default async function (component) {
  const { data } = component;
  // L'adresse du site : celle du programme de Streamlit, sans « static/js/… » (fonctionne aussi dans un sous-dossier,
  // comme sur Streamlit Community Cloud)
  const script = document.querySelector('script[src*="static/js/index"]');
  const base = script ? script.src.split("static/js/")[0] : location.origin + "/";
  try {
    const engine = await import(`${base}app/static/fv3d/engine.js?v=${data.v}`);
    return engine.show(data);
  } catch (error) {
    console.warn("FinVeille : décor 3D indisponible", error);
  }
}
"""


def _register():
    return st.components.v2.component("fv3d", js=LOADER, isolate_styles=False)


_component = _register()

# La maquette de chaque page (guide 33) : son modèle (static/fv3d/), ses réglages, sa description pour les lecteurs
# d'écran et, si elle encode des données, une légende qui dit comment la lire.
OBJECTS = {
    "markets": ("globe", {}, "Un globe de bureau : une épingle par grande place boursière.",
                "Une épingle par place : verte si l'indice monte, rouge s'il baisse."),
    "about": ("logo", {}, "Le logo de FinVeille, en relief.", ""),
    "crypto": ("coins", {}, "Trois pièces gravées : les trois premières cryptomonnaies.",
               "Le filet autour de chaque pièce : vert si elle monte sur 24 h, rouge si elle baisse."),
    "assistant": ("orb", {}, "Une sphère dans un anneau bleu, entourée de fiches : l'assistant et ses sources.", ""),
    "quiz": ("orb", {"variant": "quiz"}, "Quatre cartes en éventail : la bonne réponse se lève.", ""),
    "brief": ("paper", {}, "Une pile de journaux du matin, devant le soleil qui se lève.", ""),
    "stats": ("bars", {}, "Un histogramme en relief : les dépêches heure par heure.", ""),
    "compare": ("duel", {}, "Deux quartiers de tours face à face.", ""),
    "portfolio": ("ring", {}, "Un anneau découpé en parts : la répartition d'un portefeuille.", ""),
    "simulators": ("stairs", {}, "Un escalier de colonnes : le capital versé et les intérêts qui s'y ajoutent.", ""),
    "economy": ("ridges", {}, "Des courbes des taux en relief, l'une derrière l'autre.", ""),
    "alerts": ("bell", {}, "Une cloche et les ondes qu'elle fait naître : une alerte qui sonne.", ""),
    "following": ("lens", {}, "Une loupe au-dessus d'un quartier de tours : les entreprises que tu suis.", ""),
    "favorites": ("bookmark", {}, "Des articles et un marque-page : à lire plus tard.", ""),
    "glossary": ("books", {}, "Une pile de livres : le vocabulaire de la finance.", ""),
    "settings": ("gear", {}, "Des engrenages : les réglages.", ""),
    "account": ("gear", {}, "Des engrenages : ton compte.", ""),
    "setup": ("gear", {}, "Des engrenages : la configuration du site.", ""),
}
# Ordre de grandeur du poids de chaque valeur dans le CAC 40 (en %) : il donne la hauteur des tours de la maquette.
# Elle montre des ordres de grandeur, pas des décimales : une approximation suffit.
WEIGHTS = {
    "MC.PA": 10.5, "SU.PA": 7.0, "AIR.PA": 6.5, "TTE.PA": 6.0, "SAN.PA": 5.6, "SAF.PA": 5.6, "AI.PA": 5.4,
    "OR.PA": 5.2, "RMS.PA": 4.6, "BNP.PA": 4.6, "CS.PA": 4.4, "EL.PA": 4.2, "DG.PA": 3.4, "BN.PA": 2.4,
    "SGO.PA": 2.4, "GLE.PA": 2.1, "ENGI.PA": 1.7, "ORA.PA": 1.6, "HO.PA": 1.6, "ACA.PA": 1.5, "LR.PA": 1.4,
    "DSY.PA": 1.3, "RI.PA": 1.2, "STLAP.PA": 1.2, "PUB.PA": 1.2, "CAP.PA": 1.1, "ML.PA": 1.1, "VIE.PA": 1.0,
    "KER.PA": 0.9, "STMPA.PA": 0.9, "MT.AS": 0.8, "RNO.PA": 0.6, "EN.PA": 0.6, "AC.PA": 0.6, "BVI.PA": 0.6,
    "CA.PA": 0.5, "ERF.PA": 0.5, "URW.PA": 0.5, "EDEN.PA": 0.3, "TEP.PA": 0.2,
}
PLACES = ("^FCHI", "^GDAXI", "^FTSE", "^GSPC", "^N225", "^HSI", "000001.SS")  # les places du globe (models.js)


def show(scene: str, key: str = "fv3d", **data) -> None:
    """Installe le décor `scene` derrière la page (depuis l'étape 33, seulement « terrain », une ambiance).

    `key` : une autre clé pour remplacer le décor plus loin dans la même page (Streamlit refuse deux fois la même)."""
    global _component
    try:
        _component(key=key, data={"scene": scene, "v": VERSION, **data})
    except StreamlitAPIException:  # un nouvel environnement Streamlit (les tests) : on l'enregistre à nouveau
        _component = _register()
        _component(key=key, data={"scene": scene, "v": VERSION, **data})


def city_data(quotes) -> dict:
    """La maquette du CAC 40 (le récit de l'accueil) : une tour par valeur, sa hauteur suit son poids dans l'indice,
    son toit la séance si on la connaît."""
    from core import market

    change = {quote.symbol: round(quote.change, 2) for quote in quotes}
    return {"towers": [{"n": name, "w": WEIGHTS.get(symbol, 0.5), "c": change.get(symbol)}
                       for symbol, name, _ in market.CAC40]}


def vitrine(kind: str, data: dict | None = None, label: str = "", caption: str = "", fallback: str | None = None,
            classes: str = "") -> str:
    """L'emplacement d'une maquette dans la page : le moteur (vitrines.js) y dessine l'objet `kind` avec ses données.

    `label` décrit l'objet aux lecteurs d'écran ; `caption`, visible, dit comment lire ses couleurs ; `fallback` : une
    image pour les navigateurs sans WebGL (l'illustration de l'étape 29)."""
    payload = escape(json.dumps(data or {}, ensure_ascii=False, separators=(",", ":")))
    image = f'<img class="fv-obj-fallback" src="{escape(fallback)}" alt="">' if fallback else ""
    note = f"<figcaption>{escape(caption)}</figcaption>" if caption else ""
    return (f'<figure class="fv-obj-wrap {escape(classes)}"><div class="fv-obj" data-obj="{escape(kind)}" data-obj-data="{payload}" '
            f'role="img" aria-label="{escape(label)}">{image}</div>{note}</figure>')


def page_object(name: str | None, data: dict | None = None, fallback: str | None = None) -> str:
    """La maquette de la page `name` (OBJECTS), avec ses données : les places du globe pour Marchés."""
    if name not in OBJECTS:
        return ""
    kind, settings, label, caption = OBJECTS[name]
    payload = {**settings, **(data or {})}
    if name == "markets" and "markers" not in payload:
        payload["markers"] = markers()
    return vitrine(kind, payload, label, caption, fallback)


def markers() -> list[dict]:
    """Les places du globe : leur indice et sa séance."""
    from ui import load_quotes

    return [{"symbol": q.symbol, "name": q.name, "c": round(q.change, 2)} for q in load_quotes() if q.symbol in PLACES]


def page(name: str | None) -> None:
    """L'ambiance derrière la page : la même partout, calme ; les données sont dans la maquette de l'en-tête."""
    show("terrain", shape="calm")
