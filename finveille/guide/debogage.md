# Mémo de débogage

## La méthode, en 5 réflexes

1. **Lis le message d'erreur en partant du bas.** La dernière ligne dit *quoi* (`KeyError: 'title'`), les lignes
   au-dessus disent *où* (fichier et numéro de ligne). Repère la première ligne qui pointe vers **ton** code
   (pas vers `site-packages/`).
2. **Regarde ce que contiennent vraiment tes variables.** Ajoute `st.write(variable)` dans la page, ou
   `print(variable)` (le résultat s'affiche dans le terminal), juste avant la ligne qui plante.
3. **Isole le problème.** Teste la fonction seule dans un terminal Python, sans Streamlit :
   ```bash
   python -c "from core.sources import fetch_rss; from core.config import RSS_FEEDS; print(fetch_rss(RSS_FEEDS[0])[:2])"
   ```
4. **Vérifie l'environnement.** `(.venv)` affiché ? Bon dossier (`finveille/`) ? `pip install -r requirements.txt`
   relancé après une modification ?
5. **Cherche le message exact** (entre guillemets) sur un moteur de recherche : quelqu'un a presque toujours eu le
   même problème.

## Erreurs d'environnement

| Symptôme | Solution |
| --- | --- |
| `ModuleNotFoundError: No module named 'core'` | Lance Streamlit depuis le dossier `finveille/`. |
| `ModuleNotFoundError: No module named 'xxx'` | Active le venv puis `pip install -r requirements.txt`. Dans VS Code, choisis l'interpréteur `.venv`. |
| `streamlit: command not found` / `'streamlit' n'est pas reconnu` | Venv non activé, ou utilise `python -m streamlit run app.py`. |
| `Port 8501 is already in use` | Une autre instance tourne : ferme-la, ou `--server.port 8502`. |
| Le code modifié ne change rien | Clique sur **Rerun** (en haut à droite) ou appuie sur `R` dans la page. |

## Erreurs réseau (sources d'actualité)

| Symptôme | Solution |
| --- | --- |
| `ConnectTimeout`, `ReadTimeout` | Le site est lent ou bloqué. Réessaie plus tard ; vérifie ta connexion. |
| `403 Forbidden` | Le site refuse les robots : change de flux. |
| `404 Not Found` | L'adresse du flux a changé : cherche la nouvelle. |
| Toutes les sources en erreur | Pas d'Internet ou réseau filtré (école, entreprise) : teste avec le partage de connexion du téléphone. |

## Erreurs d'affichage Streamlit

| Symptôme | Solution |
| --- | --- |
| Un titre s'affiche en formule mathématique ou en italique bizarre | Caractères Markdown (`$`, `*`, `_`) : passe le texte dans `md_escape`. |
| Les données ne se rafraîchissent pas | C'est le cache : bouton « 🔄 Actualiser » ou menu ⋮ → *Clear cache*. |
