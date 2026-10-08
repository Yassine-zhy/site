"""
Installation automatique, lancée par demarrer.bat (Windows) ou demarrer.command (Mac).

1. Crée un environnement Python privé au bot (dossier .venv), une seule fois.
2. Installe les bibliothèques de requirements.txt (seulement si elles ont changé).
3. Crée le fichier .env à partir de .env.example, en mode sans risque :
   argent fictif (MODE=paper) et règles fixes (STRATEGY=indicators).
"""

from __future__ import annotations

import os
import subprocess
import sys
import venv
from pathlib import Path

HERE = Path(__file__).resolve().parent
VENV = HERE / ".venv"
VENV_PYTHON = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
MARKER = VENV / "requirements-installees.txt"


def main() -> int:
    if sys.version_info < (3, 10):
        print(f"Python {sys.version_info.major}.{sys.version_info.minor} est trop ancien : "
              "installez Python 3.10 ou plus récent depuis https://www.python.org/downloads")
        return 1

    if not VENV_PYTHON.exists():
        print("Création de l'environnement Python du bot (une seule fois)...")
        venv.create(VENV, with_pip=True)

    requirements = (HERE / "requirements.txt").read_text(encoding="utf-8")
    if not MARKER.exists() or MARKER.read_text(encoding="utf-8") != requirements:
        print("Installation des bibliothèques (1 à 3 minutes la première fois)...")
        subprocess.check_call([str(VENV_PYTHON), "-m", "pip", "install", "--quiet",
                               "--disable-pip-version-check", "-r", str(HERE / "requirements.txt")])
        MARKER.write_text(requirements, encoding="utf-8")

    env_file = HERE / ".env"
    if not env_file.exists():
        text = (HERE / ".env.example").read_text(encoding="utf-8")
        # Premier lancement : rien à configurer, aucun compte, aucun argent.
        text = text.replace("\nSTRATEGY=ai\n", "\nSTRATEGY=indicators\n", 1)
        env_file.write_text(text, encoding="utf-8")
        print()
        print("Fichier .env créé : argent fictif (MODE=paper) et règles RSI + EMA.")
        print("Pour activer l'IA plus tard : ouvrez .env avec le Bloc-notes, mettez")
        print("STRATEGY=ai et collez votre clé Anthropic après ANTHROPIC_API_KEY=")
        print()
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except subprocess.CalledProcessError:
        print("L'installation des bibliothèques a échoué : vérifiez votre connexion Internet, puis relancez.")
        sys.exit(1)
