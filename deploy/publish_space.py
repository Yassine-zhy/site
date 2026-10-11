"""Publie FinVeille sur Hugging Face Spaces (guide 25), sans aucune manipulation sur le site de Hugging Face.

Utilisé par GitHub Actions à chaque mise à jour du code ; utilisable aussi à la main, depuis le dossier finveille/ :
    pip install huggingface_hub
    python deploy/publish_space.py --dry-run          # liste ce qui serait envoyé, sans rien envoyer
    HF_TOKEN=hf_... python deploy/publish_space.py    # publie

Ce que fait le script :
1. crée le Space (type Docker, gratuit) s'il n'existe pas encore : HF_SPACE, sinon « <ton-pseudo>/finveille » ;
2. recopie dans le Space les secrets présents dans l'environnement (clés d'IA, base en ligne, e-mails…) : on ne
   les règle qu'à un seul endroit, les secrets GitHub. Seuls leurs NOMS sont affichés, jamais leurs valeurs ;
3. envoie le code, sans le guide, les tests, les captures ni aucun fichier secret, avec la fiche du Space
   (deploy/huggingface-README.md) comme README.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # le dossier finveille/
EXCLUDED_DIRS = {".git", ".github", "docs", "guide", "tests", "tools", "data", "__pycache__", ".pytest_cache",
                 ".venv", "venv", "node_modules"}
EXCLUDED_FILES = {".streamlit/secrets.toml", ".env", "requirements-dev.txt"}
EXCLUDED_SUFFIXES = {".pyc", ".db", ".db-wal", ".db-shm"}
SECRETS = [
    "GEMINI_API_KEY", "GROQ_API_KEY", "GEMINI_MODEL", "GROQ_MODEL",  # IA (guides 8 et 24)
    "DATABASE_URL", "DB_POOL_SIZE",  # base en ligne (guide 20) : indispensable pour garder les comptes
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "SITE_URL",  # e-mails (guide 21)
    "ADMIN_EMAILS", "SECRETS_TOML",  # administration, connexion Google (guides 22 et 25)
    "FINNHUB_API_KEY", "NEWSAPI_API_KEY", "MARKETAUX_API_KEY", "ALPHAVANTAGE_API_KEY",  # sources (guide 4)
    "AI_DAILY_LIMIT", "AI_VISITOR_LIMIT", "AI_PER_MINUTE", "RENDER_SLOTS",  # réglages de charge (guides 24, 25)
]


def files_to_send(root: Path = ROOT) -> list[Path]:
    """Les fichiers du site, en chemins relatifs à finveille/."""
    found = []
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if (path.is_dir() or any(part in EXCLUDED_DIRS for part in relative.parts)
                or relative.as_posix() in EXCLUDED_FILES or path.suffix in EXCLUDED_SUFFIXES):
            continue
        found.append(relative)
    return found


def stage(destination: Path, root: Path = ROOT) -> list[Path]:
    """Copie les fichiers à envoyer dans `destination`, avec la fiche du Space à la place du README."""
    files = files_to_send(root)
    for relative in files:
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(root / relative, target)
    shutil.copy2(root / "deploy" / "huggingface-README.md", destination / "README.md")
    return files


def space_url(space: str) -> str:
    """« Yassine_20/finveille » → « https://yassine-20-finveille.hf.space » (l'adresse directe du site)."""
    host = "".join(char if char.isalnum() else "-" for char in space.replace("/", "-")).lower()
    return f"https://{host}.hf.space"


def main() -> int:
    parser = argparse.ArgumentParser(description="Publie FinVeille sur Hugging Face Spaces.")
    parser.add_argument("--dry-run", action="store_true", help="liste les fichiers sans rien envoyer")
    args = parser.parse_args()

    if args.dry_run:
        files = files_to_send()
        for relative in files:
            print(relative.as_posix())
        print(f"\n{len(files)} fichiers seraient envoyés ; secrets présents dans l'environnement : "
              f"{', '.join(name for name in SECRETS if os.environ.get(name)) or 'aucun'}")
        return 0

    token = os.environ.get("HF_TOKEN")
    if not token:
        print("HF_TOKEN manquant : crée un jeton « Write » sur https://huggingface.co/settings/tokens (guide 25).")
        return 1
    from huggingface_hub import HfApi  # importé ici : inutile pour --dry-run
    from huggingface_hub.utils import HfHubHTTPError

    api = HfApi(token=token)
    try:
        owner = api.whoami()["name"]
        space = os.environ.get("HF_SPACE") or f"{owner}/finveille"
        api.create_repo(space, repo_type="space", space_sdk="docker", exist_ok=True)
        copied = []
        for name in SECRETS:
            if value := os.environ.get(name):
                api.add_space_secret(space, name, value)
                copied.append(name)
        with tempfile.TemporaryDirectory() as folder:
            files = stage(Path(folder))
            commit = os.environ.get("GITHUB_SHA", "")[:7] or "manuel"
            api.upload_folder(folder_path=folder, repo_id=space, repo_type="space",
                              commit_message=f"FinVeille {commit}")
    except HfHubHTTPError as error:  # le message de Hugging Face (jeton refusé, nom pris…) ne contient pas le jeton
        print(f"Hugging Face a refusé la publication : {error}")
        if "402" in str(error):
            print("\n→ Ton compte Hugging Face n'a pas l'abonnement PRO, désormais exigé pour un Space Docker.\n"
                  "  Mise en ligne gratuite : Streamlit Community Cloud (guide 25, § 6).")
        return 1
    print(f"{len(files)} fichiers envoyés vers https://huggingface.co/spaces/{space}")
    print(f"Secrets recopiés : {', '.join(copied) or 'aucun'}")
    print(f"Le site sera en ligne d'ici quelques minutes (construction de l'image) : {space_url(space)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
