#!/bin/bash
# Double-cliquez sur ce fichier pour installer puis lancer le bot (Mac).
# Si le Mac refuse de l'ouvrir : clic droit sur le fichier, puis « Ouvrir ».
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python n'est pas installé : téléchargez-le sur https://www.python.org/downloads"
  read -r -p "Appuyez sur Entrée pour fermer..."
  exit 1
fi
if ! python3 installer.py; then
  echo
  echo "Installation impossible : lisez le message ci-dessus."
  read -r -p "Appuyez sur Entrée pour fermer..."
  exit 1
fi
echo
echo "Le bot démarre. Pour l'arrêter : Ctrl+C, ou fermez cette fenêtre."
echo
.venv/bin/python bot.py
read -r -p "Appuyez sur Entrée pour fermer..."
