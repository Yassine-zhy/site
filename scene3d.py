"""Le monde 3D de FinVeille (guide 30) : un décor en relief derrière chaque page.

Le moteur (static/fv3d/engine.js, avec Three.js) tourne dans le navigateur du visiteur : le serveur n'envoie que le
nom du décor et quelques données (les tours du CAC 40, les places boursières, les derniers titres…). Les fichiers du
dossier static/ sont servis par Streamlit (server.enableStaticServing, .streamlit/config.toml) et gardés en cache par
le navigateur : la page n'attend jamais la 3D.

Sans WebGL (vieux navigateur, carte graphique désactivée), rien ne change : les illustrations de l'étape 29 restent.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import streamlit as st
from streamlit.errors import StreamlitAPIException

STATIC = Path(__file__).parent / "static" / "fv3d"
# La version du moteur : elle change avec ses fichiers et oblige le navigateur à recharger la nouvelle version
VERSION = hashlib.sha256(b"".join(path.read_bytes() for path in sorted(STATIC.glob("*.js")))).hexdigest()[:12]

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

# Le décor des pages sans données propres (la clé est le nom de l'illustration de la page, art.py)
PAGES = {
    "brief": ("terrain", {"shape": "dawn"}),          # un soleil qui se lève : le brief du jour
    "assistant": ("orb", {}),                          # une sphère qui respire : l'IA
    "quiz": ("orb", {"variant": "quiz"}),
    "stats": ("towers", {"layout": "bars"}),           # un histogramme en relief
    "compare": ("towers", {"layout": "duel"}),         # deux quartiers face à face
    "portfolio": ("towers", {"layout": "ring"}),       # la répartition, en anneau
    "simulators": ("towers", {"layout": "stairs"}),    # l'escalier des intérêts composés
    "economy": ("terrain", {"shape": "ridges"}),       # des courbes des taux en crêtes
    "alerts": ("terrain", {"shape": "ripples"}),       # des ondes autour d'un seuil
    "following": ("galaxy", {"hue": "blue"}),
    "favorites": ("galaxy", {"hue": "violet"}),
    "glossary": ("terrain", {"shape": "waves"}),
    "settings": ("terrain", {"shape": "calm"}),
    "account": ("terrain", {"shape": "calm"}),
    "setup": ("terrain", {"shape": "calm"}),
    "about": ("globe", {}),                            # la Terre, sans les places : une veille mondiale
}

# Ordre de grandeur du poids de chaque valeur dans le CAC 40 (en %) : il donne la hauteur des tours de la ville.
# Un décor, pas une donnée affichée : une approximation suffit.
WEIGHTS = {
    "MC.PA": 10.5, "SU.PA": 7.0, "AIR.PA": 6.5, "TTE.PA": 6.0, "SAN.PA": 5.6, "SAF.PA": 5.6, "AI.PA": 5.4,
    "OR.PA": 5.2, "RMS.PA": 4.6, "BNP.PA": 4.6, "CS.PA": 4.4, "EL.PA": 4.2, "DG.PA": 3.4, "BN.PA": 2.4,
    "SGO.PA": 2.4, "GLE.PA": 2.1, "ENGI.PA": 1.7, "ORA.PA": 1.6, "HO.PA": 1.6, "ACA.PA": 1.5, "LR.PA": 1.4,
    "DSY.PA": 1.3, "RI.PA": 1.2, "STLAP.PA": 1.2, "PUB.PA": 1.2, "CAP.PA": 1.1, "ML.PA": 1.1, "VIE.PA": 1.0,
    "KER.PA": 0.9, "STMPA.PA": 0.9, "MT.AS": 0.8, "RNO.PA": 0.6, "EN.PA": 0.6, "AC.PA": 0.6, "BVI.PA": 0.6,
    "CA.PA": 0.5, "ERF.PA": 0.5, "URW.PA": 0.5, "EDEN.PA": 0.3, "TEP.PA": 0.2,
}
PLACES = ("^FCHI", "^GDAXI", "^FTSE", "^GSPC", "^N225", "^HSI", "000001.SS")  # les places du globe (engine.js)


def show(scene: str, key: str = "fv3d", **data) -> None:
    """Installe le décor `scene` derrière la page : city, globe, chain, orb, towers, terrain ou galaxy.

    `key` : une autre clé pour remplacer le décor plus loin dans la même page (Streamlit refuse deux fois la même)."""
    global _component
    try:
        _component(key=key, data={"scene": scene, "v": VERSION, **data})
    except StreamlitAPIException:  # un nouvel environnement Streamlit (les tests) : on l'enregistre à nouveau
        _component = _register()
        _component(key=key, data={"scene": scene, "v": VERSION, **data})


def city_data(articles, quotes) -> dict:
    """La ville du fil : une tour par valeur du CAC 40 (hauteur : son poids ; couleur : la séance si on la connaît)
    et les derniers titres, qui défilent sur les bandeaux lumineux des plus hautes tours."""
    from core import market

    change = {quote.symbol: round(quote.change, 2) for quote in quotes}
    towers = [{"n": name, "w": WEIGHTS.get(symbol, 0.5), "c": change.get(symbol)} for symbol, name, _ in market.CAC40]
    headlines = [article.title[:110] for article in articles[:14]]
    return {"towers": towers, "headlines": headlines}


def page(name: str | None) -> None:
    """Le décor d'une page, d'après son nom (art.py) : avec ses données pour Marchés et Crypto."""
    from ui import load_quotes

    if name == "markets":   # le globe : une colonne lumineuse par place boursière, sa couleur suit la séance
        markers = [{"symbol": q.symbol, "name": q.name, "c": round(q.change, 2)}
                   for q in load_quotes() if q.symbol in PLACES]
        show("globe", markers=markers)
    elif name == "crypto":  # la chaîne : un bloc par jour, sa taille et sa couleur suivent le bitcoin ce jour-là
        bitcoin = next((q for q in load_quotes() if q.symbol == "BTC-USD"), None)
        returns = [] if bitcoin is None else [round(v * 100, 2) for v in bitcoin.history.pct_change().dropna().tail(24)]
        show("chain", returns=returns)
    elif name in PAGES:
        scene, data = PAGES[name]
        show(scene, **data)
