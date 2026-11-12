"""La version du code dans l'adresse des modules 3D (deploy/version_assets.py)."""

import shutil
from pathlib import Path

from deploy import version_assets

FV3D = Path(version_assets.__file__).resolve().parent.parent / "static" / "fv3d"


def test_les_imports_relatifs_recoivent_la_version():
    source = ('import * as THREE from "./three.module.min.js";\n'
              "import { Pass } from '../../three.module.min.js';\n"
              'const m = await import("./motion.js");\n'
              "const n = import(`./motion.js${VERSION}`);\n"   # déjà versionné : intact
              'import x from "./deja.js?v=1";\n'                 # déjà versionné : intact
              'import y from "three";\n')                        # pas un chemin relatif : intact
    out = version_assets.stamp(source, "abc")
    assert 'from "./three.module.min.js?v=abc"' in out and "from '../../three.module.min.js?v=abc'" in out
    assert 'import("./motion.js?v=abc")' in out and "`./motion.js${VERSION}`" in out
    assert '"./deja.js?v=1"' in out and 'from "three"' in out
    assert version_assets.stamp(out, "abc") == out  # une deuxième fois : sans effet


def test_les_vrais_modules_sont_tous_versionnes(tmp_path):
    copy = tmp_path / "fv3d"
    shutil.copytree(FV3D, copy)
    version = version_assets.main(copy)
    texts = {p.relative_to(copy).as_posix(): p.read_text(encoding="utf-8") for p in copy.rglob("*.js")}
    assert f'from "./vitrines.js?v={version}"' in texts["engine.js"]
    assert all(not version_assets.IMPORT.search(text) for text in texts.values())  # plus aucun import sans version
    assert f"three.module.min.js?v={version}" in texts["addons/postprocessing/EffectComposer.js"]
