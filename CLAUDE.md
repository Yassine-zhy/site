# Consignes pour Claude

## Répartir le travail entre les modèles

La session principale garde ce qui demande du jugement : direction artistique, architecture, moteur 3D, décisions de
design, relecture finale. Le reste part à un sous-agent moins cher (skill `agent-routing`, consignes prêtes à l'emploi
avec `down-skilling`) :

| Travail | Sous-agent |
| --- | --- |
| Lancer les tests ou `tools/ux_audit.py` et rapporter le résultat, décrire des captures d'écran, chercher dans le code | `haiku` |
| Corriger un défaut précis, appliquer un changement décrit, rédiger une section de guide à partir de notes | `sonnet-low` |
| Écrire un module à partir d'une spécification, relire un diff pour y trouver des bugs | `sonnet-high` |

- Donner au sous-agent tout ce qu'il lui faut dans la consigne : chemins, commandes exactes (interpréteur compris),
  format de réponse. Il n'hérite de rien.
- Vérifier soi-même ce qu'il rend (tests, captures) : un sous-agent dit toujours avoir fini.
- Sur un échec : même modèle avec le résultat de l'échec, puis un cran au-dessus.

## Le projet

- L'application est dans `finveille/` ; chaque étape a son guide dans `finveille/guide/` et un commit.
- Les clés d'API vont seulement dans `finveille/.streamlit/secrets.toml` (ignoré par Git) ; ne jamais en committer.
- La branche en ligne `finveille-app` se met à jour par `git subtree split --prefix finveille` puis une fusion
  (jamais de `push --force` : elle contient un commit de l'auteur).
