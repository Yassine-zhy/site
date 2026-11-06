"""La version du code dans l'adresse de chaque fichier 3D (static/fv3d), réécrite à la construction de l'image Docker.

Streamlit sert static/ sans consigne de cache : un téléphone gardait parfois l'ancienne copie d'un module
(vitrines.js, kit.js…) même après une mise en ligne et un rechargement, et le site mélangeait deux versions. Chaque
import relatif reçoit donc « ?v=<empreinte des fichiers> » : un code changé a une adresse neuve, jamais une copie
périmée. Toutes les adresses d'une version portent la même empreinte : un module importé de deux endroits
(three.module.min.js) reste un seul module.

    python deploy/version_assets.py        # depuis finveille/ ; une deuxième fois, sans effet
"""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

FV3D = Path(__file__).resolve().parent.parent / "static" / "fv3d"
# from "./x.js", import "./x.js", import("./x.js") : un chemin relatif sans « ? » (les adresses déjà versionnées, ou
# construites avec ${VERSION}, ne sont pas touchées)
IMPORT = re.compile(r"""(\b(?:from|import)\s*\(?\s*)(["'])(\.{1,2}/[^"'?\s]+?\.js)\2""")


def fingerprint(files: list[Path]) -> str:
    digest = hashlib.sha256()
    for path in sorted(files):
        digest.update(path.read_bytes())
    return digest.hexdigest()[:12]


def stamp(source: str, version: str) -> str:
    return IMPORT.sub(lambda m: f"{m[1]}{m[2]}{m[3]}?v={version}{m[2]}", source)


def main(root: Path = FV3D) -> str:
    files = sorted(root.rglob("*.js"))
    version = fingerprint(files)
    for path in files:
        source = path.read_text(encoding="utf-8")
        if (stamped := stamp(source, version)) != source:
            path.write_text(stamped, encoding="utf-8")
    print(f"Modules 3D versionnés : ?v={version} ({len(files)} fichiers)")
    return version


if __name__ == "__main__":
    main()
