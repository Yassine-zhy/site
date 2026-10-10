# FinVeille dans un conteneur Docker (guide 25) : le même environnement sur ton ordinateur, sur Hugging Face
# Spaces, Render ou n'importe quel serveur.
#   docker build -t finveille .
#   docker run -p 8501:8501 --env-file .env finveille        → http://localhost:8501
FROM python:3.13-slim

# - pas de fichiers .pyc ni de sorties retenues en mémoire (les journaux s'affichent tout de suite) ;
# - en production, le visiteur ne voit jamais le détail technique d'une erreur (il reste dans les journaux).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    STREAMLIT_SERVER_HEADLESS=true \
    STREAMLIT_CLIENT_SHOW_ERROR_DETAILS=none \
    FINVEILLE_DB=/app/data/finveille.db

# Un utilisateur sans droits d'administration (plus sûr, et exigé par Hugging Face Spaces : identifiant 1000)
RUN useradd --create-home --uid 1000 finveille
WORKDIR /app

# Les bibliothèques d'abord : tant que requirements.txt ne change pas, Docker réutilise cette étape (plus rapide)
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY --chown=finveille:finveille . .
RUN mkdir -p data && chown finveille:finveille data && chmod +x deploy/entrypoint.sh
USER finveille

EXPOSE 8501
# Docker vérifie toutes les 30 s que le site répond ; sinon, l'hébergeur peut le redémarrer
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://localhost:{os.environ.get(\"PORT\", 8501)}/_stcore/health', timeout=4)"
ENTRYPOINT ["deploy/entrypoint.sh"]
