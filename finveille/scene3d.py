"""Les maquettes 3D de FinVeille (guides 30, 33 et 41) : des objets posés dans les pages.

Le moteur (static/fv3d/, avec Three.js) tourne dans le navigateur du visiteur : le serveur n'envoie que des noms et
quelques données. Trois pages ont une maquette, parce qu'elle y montre des données : la ville de l'indice sur
l'accueil (une tour par valeur), le globe des places sur Marchés, les pièces sur Crypto (vitrines.js, models.js). Ce
sont des objets de plâtre et d'acier, comme une maquette d'architecte : ni halo, ni particules. Les autres pages n'ont
pas d'objet : un décor qui ne dit rien alourdit la page. Les fichiers du dossier static/ sont servis par Streamlit
(server.enableStaticServing, .streamlit/config.toml).

Sans WebGL (vieux navigateur, carte graphique désactivée), rien ne manque : la page s'affiche sans la maquette.
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

# La maquette d'une page : son modèle (static/fv3d/models.js), ses réglages, sa description pour les lecteurs d'écran
# et une légende qui dit comment lire ses données. Chaque maquette sert à quelque chose : son action (« act », exécutée
# par vitrines.js au clic) et le texte qui l'annonce au survol.
OBJECTS = {
    "markets": ("globe", {"act": {"type": "reveal", "in": ".fv-tile", "keyed": True, "hint": "Cliquer : sa tuile de cours",
                                  "hintAll": "Cliquer : les indices"}},
                "Un globe de bureau : une épingle par grande place boursière.",
                "Une épingle par place : verte si l'indice monte, rouge s'il baisse. Clique-la pour voir son cours."),
    "crypto": ("coins", {"act": {"type": "reveal", "in": ".fv-table tbody tr", "keyed": True,
                                 "hint": "Cliquer : sa ligne du classement", "hintAll": "Cliquer : le classement"}},
               "Trois pièces gravées : les trois premières cryptomonnaies.",
               "Le filet autour de chaque pièce : vert si elle monte sur 24 h, rouge si elle baisse."),
}
# La maquette du CAC 40 (le récit de l'accueil) : une tour cliquée cherche ses dépêches dans le fil
CITY_ACT = {"type": "search", "input": "Rechercher", "keyed": True, "then": "#fv-fil", "hint": "Cliquer : ses dépêches",
            "hintAll": "Cliquer : aller au fil"}

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
# Idem pour le S&P/TSX 60 et le Dow Jones (avec cinq géants de la tech) : la capitalisation approximative, en milliards
# de dollars américains. Les unités n'ont pas besoin d'être les mêmes d'une table à l'autre : la hauteur d'une tour suit
# la racine carrée de son poids relatif dans sa propre table.
TSX_WEIGHTS = {
    "RY.TO": 180, "TD.TO": 125, "BMO.TO": 80, "BNS.TO": 68, "CM.TO": 65, "NA.TO": 40, "MFC.TO": 55, "SLF.TO": 35,
    "IFC.TO": 37, "GWO.TO": 37, "POW.TO": 25, "FFH.TO": 40, "BN.TO": 100, "BAM.TO": 90, "X.TO": 8, "ENB.TO": 100,
    "CNQ.TO": 65, "SU.TO": 50, "TRP.TO": 50, "CVE.TO": 30, "IMO.TO": 40, "TOU.TO": 15, "CCO.TO": 30, "AEM.TO": 70,
    "ABX.TO": 40, "WPM.TO": 45, "FNV.TO": 35, "K.TO": 25, "AGI.TO": 15, "TECK-B.TO": 20, "FM.TO": 15, "NTR.TO": 28,
    "CCL-B.TO": 10, "CNR.TO": 63, "CP.TO": 70, "WCN.TO": 48, "WSP.TO": 25, "CAE.TO": 8, "TFII.TO": 7, "SHOP.TO": 190,
    "CSU.TO": 70, "GIB-A.TO": 22, "OTEX.TO": 8, "CLS.TO": 30, "TRI.TO": 80, "ATD.TO": 50, "L.TO": 50, "DOL.TO": 40,
    "QSR.TO": 30, "MRU.TO": 13, "WN.TO": 22, "SAP.TO": 8, "CTC-A.TO": 7, "MG.TO": 12, "BCE.TO": 22, "T.TO": 23,
    "RCI-B.TO": 15, "FTS.TO": 25, "EMA.TO": 12, "H.TO": 22,
}
USA_WEIGHTS = {
    "AAPL": 3500, "MSFT": 3800, "NVDA": 4400, "GOOGL": 2800, "META": 1900, "AVGO": 1500, "CSCO": 270, "IBM": 250,
    "CRM": 240, "AMZN": 2400, "TSLA": 1300, "WMT": 820, "HD": 380, "MCD": 220, "NKE": 100, "KO": 300, "PG": 370,
    "NFLX": 520, "DIS": 210, "VZ": 180, "JPM": 830, "GS": 220, "V": 680, "AXP": 220, "TRV": 60, "UNH": 300, "JNJ": 420,
    "MRK": 210, "AMGN": 160, "CAT": 200, "BA": 170, "HON": 140, "MMM": 85, "SHW": 90, "CVX": 300,
}
# Par place : la table des poids et le poids d'une valeur qui n'y figure pas (une petite valeur)
CITY_WEIGHTS = {"france": (WEIGHTS, 0.5), "canada": (TSX_WEIGHTS, 8), "usa": (USA_WEIGHTS, 60)}
CITY_TOWERS = 40  # la maquette n'a que 8 × 5 cases (models.js::city)
PLACES = ("^FCHI", "^GDAXI", "^FTSE", "^GSPC", "^N225", "^HSI", "000001.SS")  # les places du globe (models.js)


def show(key: str = "fv3d") -> None:
    """Charge le moteur dans la page : les maquettes, et les petits comportements du site (liens, raccourci de
    recherche, horloges des places…)."""
    global _component
    try:
        _component(key=key, data={"v": VERSION})
    except StreamlitAPIException:  # un nouvel environnement Streamlit (les tests) : on l'enregistre à nouveau
        _component = _register()
        _component(key=key, data={"v": VERSION})


def city_data(quotes, place: str = "france") -> dict:
    """La maquette d'une place (le récit de l'accueil) : une tour par valeur, sa hauteur suit son poids dans l'indice,
    son toit la séance si on la connaît. Elle n'a que 40 cases : on garde les plus lourdes, mais toujours les 3 plus
    fortes hausses et les 3 plus fortes baisses de la séance, que la caméra du récit vise (parmi les tours)."""
    from core import market

    place = place if place in market.PLACES else "france"
    weights, default = CITY_WEIGHTS[place]
    change = {quote.symbol: round(quote.change, 2) for quote in quotes}
    towers = [{"n": name, "w": weights.get(symbol, default), "c": change.get(symbol)}
              for symbol, name, _ in market.PLACES[place][3]]
    if len(towers) > CITY_TOWERS:
        moved = sorted((tower for tower in towers if tower["c"] is not None), key=lambda tower: tower["c"])
        must = {id(tower) for tower in moved[:3] + moved[-3:]}
        heaviest = sorted((tower for tower in towers if id(tower) not in must), key=lambda tower: -tower["w"])
        kept = {id(tower) for tower in heaviest[:CITY_TOWERS - len(must)]} | must
        towers = [tower for tower in towers if id(tower) in kept]
    return {"towers": towers, "act": CITY_ACT}


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
    """Le moteur de la page `name` (le même partout)."""
    show()
