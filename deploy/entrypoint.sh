#!/bin/sh
# Démarrage du conteneur (Dockerfile).
# Les hébergeurs transmettent les secrets en variables d'environnement : ui.get_secret les lit directement
# (DATABASE_URL, GEMINI_API_KEY, SMTP_…). Seule la connexion Google / Auth0 (sections [auth] de st.login) exige un
# vrai fichier secrets.toml : s'il est fourni dans la variable SECRETS_TOML, on l'écrit au démarrage.
set -e
if [ -n "$SECRETS_TOML" ]; then
    mkdir -p .streamlit
    printf '%s\n' "$SECRETS_TOML" > .streamlit/secrets.toml
fi
# PORT : imposé par certains hébergeurs (Render…) ; 8501 sinon
exec streamlit run app.py --server.port="${PORT:-8501}" --server.address=0.0.0.0
