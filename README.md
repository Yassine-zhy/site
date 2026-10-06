# Aetheria — L’Archipel des Échos

Un MMO 3D qui tourne entièrement dans le navigateur. Au-dessus d’une mer de nuages, une Brume violette relève les morts en squelettes. Les joueurs rallument ensemble cinq Phares, tracent des runes à la souris ou au doigt pour lancer leurs sorts, et discutent avec des habitants qui répondent vraiment, grâce à Claude.

**Jouer :** [Aetheria sur claude.ai](https://claude.ai/artifact/U4r2fFJdTL7Sb6eVSLEnpc) (le lien doit être partagé depuis le menu *Partager* de la page pour que d’autres joueurs puissent entrer).

![Village de Havrelumière vu du ciel](docs/screenshots/village.jpg)

## Ce qui rend Aetheria différent

| Idée | Ce que ça change |
| --- | --- |
| **Un monde qui se souvient, partagé par tous** | Les cinq Phares sont un objectif commun à tous les joueurs. Chaque squelette vaincu près d’un phare, chaque rune *Lux*, chaque canalisation lui rend de la lumière. La lumière s’éteint lentement **en temps réel** (10 à 18 h) : le monde a besoin de ses héros. Quand un phare atteint 100 %, tous les joueurs voient la Brume reculer, l’herbe reverdir et les fleurs repousser. |
| **La magie des runes dessinées** | Maintenez le clic droit et tracez une forme d’un seul geste : triangle (*Ignis*, boule de feu), éclair (*Fulgur*, foudre en chaîne), cercle (*Vita*, soin de groupe), V (*Aegis*, bouclier), spirale (*Ventus*, propulsion dans les airs), trait vertical (*Lux*, rayon qui nourrit les phares). Un algorithme de reconnaissance de gestes ($P Point-Cloud) mesure la précision du tracé : plus il est juste, plus le sort est puissant. |
| **Des habitants qui pensent** | Maëlis, Brom, Sir Aldric, Lysa et l’Oracle des Échos répondent librement à ce que vous leur dites (via Claude), dans leur caractère, en connaissant l’état du monde, votre progression et vos quêtes. Ils se souviennent de vos échanges. L’Oracle invente des quêtes uniques, validées et récompensées par le jeu. Sans IA disponible, un repli scénarisé prend le relais. |
| **Les Échos** | Gravez des messages dans le monde pour les autres joueurs (« Attention : une embuscade droit devant »). Ceux qui les trouvent utiles les font résonner. Quand un héros tombe, une tache rouge marque l’endroit : en l’approchant, on revoit son fantôme rejouer ses dernières secondes. |
| **Vrai multijoueur, sans serveur dédié** | Chaque joueur publie son état complet dans une salle temps réel. Le joueur le plus ancien devient l’hôte et simule les squelettes pour tout le monde ; s’il part, un autre reprend la main sans perdre la partie. |
| **Voler entre les îles** | Double saut pour ouvrir la paravoile, colonnes de vent visibles de loin pour gagner de l’altitude, îlots flottants avec coffres célestes et un phare perché au-dessus des nuages. |

![Phare de l’Aube rallumé](docs/screenshots/phare.jpg)

## Contenu

- **4 classes** jouables (Chevalier, Barbare, Mage, Rôdeuse), 16 compétences débloquées au fil des niveaux, attaques de base en combo.
- **5 types d’ennemis** (serviteurs, guerriers à bouclier, rôdeurs archers, nécromanciens qui invoquent) dont des élites, et un **boss** au sommet du Pic du Silence, *le Roi Sans Lumière*, avec attaques annoncées au sol et une phase enragée. Ses points de vie s’adaptent au nombre de joueurs présents.
- **9 quêtes principales** scénarisées, des quêtes secondaires, et des quêtes infinies générées par l’Oracle.
- **Butin** à quatre raretés (commun, rare, épique, légendaire), équipement, amélioration d’armes chez le forgeron, élixirs chez la marchande.
- **Monde** : île principale (village, lac, forêt, ruines, montagne) et cinq îlots flottants, cycle jour/nuit synchronisé sur l’heure réelle (une journée = 24 minutes, identique pour tous), aurores boréales la nuit.
- **Audio 100 % procédural** : musique générative qui change entre le jour, la nuit, le combat et le boss ; bruitages synthétisés en temps réel ; vent, oiseaux et grillons.
- **Mobile** : joystick, caméra au doigt, boutons d’action en arc, tracé des runes au doigt.

![Vol plané au coucher du soleil](docs/screenshots/vol-plane.jpg)

## Commandes

| Action | Clavier / souris | Tactile |
| --- | --- | --- |
| Se déplacer | ZQSD ou WASD | joystick |
| Regarder | souris (cliquer pour capturer, Échap pour libérer) | glisser sur l’écran |
| Attaquer | clic gauche | bouton épée |
| Compétences | 1 · 2 · 3 · 4 | boutons en arc |
| Tracer une rune | clic droit maintenu (ou X) | bouton rune, puis dessiner |
| Sauter · paravoile | Espace · Espace en l’air | bouton saut |
| Sprint · esquive | Maj · C | pousser le joystick au bord · bouton esquive |
| Élixir de vie | R | bouton élixir |
| Parler, canaliser un phare, ouvrir un coffre | E | bouton « Interagir » |
| Discuter · graver un écho · saluer | Entrée · T · G | bouton bulle |
| Carte · sac · quêtes · légendes · guide | M · I · J · K · H | boutons à gauche |

## Lancer le projet

```bash
npm install
npm run dev            # http://localhost:5173
```

- **Multijoueur local** : ouvrez le jeu dans plusieurs onglets du même navigateur, ils se voient automatiquement.
- **Multijoueur sur votre propre serveur** : `npm run relay` (port 8787, relais WebSocket sans dépendance), puis ouvrez le jeu avec `?server=ws://votre-hote:8787`.
- **Raccourcis de test** : `?play=mage` saute l’écran titre, `?q=low|medium|high|ultra` force la qualité graphique.

### Construire

```bash
npm run build            # site statique dans dist/ (GitHub Pages, n'importe quel hébergeur)
npm run build:artifact   # page unique dans artifact/ pour claude.ai (modèles 3D publiés en base64)
```

Sur claude.ai, la page déclare les capacités `room` (salle temps réel), `db` (Phares, échos, fantômes, classement, sauvegardes), `user` (identité) et `sample` (Claude pour les habitants). Chaque joueur n’écrit que dans ses propres documents (règles `{self}`). Hors de claude.ai, le jeu fonctionne en solo avec sauvegarde locale, en multi-onglets, ou via le relais WebSocket.

## Architecture

```
src/
  main.js               démarrage, écrans, reprise à chaud après mise à jour
  config.js             monde, classes, ennemis, phares, zones
  engine/               rendu (bloom, étalonnage, 4 qualités), entrées, audio procédural, chargement des modèles
  world/                îles flottantes, ciel jour/nuit, mer de nuages, lac, herbe GPU, forêts, village, phares, colonnes de vent
  entities/             personnage animé à deux couches (haut/bas du corps), joueur, caméra, squelettes, autres joueurs
  game/                 combat, compétences, runes ($P), butin, quêtes, PNJ, échos, état partagé du monde, boss, sauvegarde
  net/                  plateforme Claude, transports (salle, onglets, WebSocket), synchronisation par présence
  ai/Mind.js            dialogues libres et quêtes de l'Oracle via Claude, avec repli scénarisé
  ui/                   HUD, minicarte, fenêtres, dialogues, discussion, commandes tactiles, icônes rendues en 3D
server/relay.mjs        relais WebSocket minimal
tools/build-assets.mjs  pipeline des modèles KayKit (fusion des animations, quantification : 37 Mo → 6,8 Mo)
tools/make-artifact.mjs construction de la page claude.ai
```

Quelques choix techniques :

- **Personnages** : les morceaux de chaque modèle sont fusionnés au chargement en un seul maillage animé et une bibliothèque d’animations unique (76 clips) est partagée par tous les personnages. Chaque animation est découpée en deux couches pour attaquer en courant.
- **Décors** : forêts et rochers instanciés, bâtiments fusionnés par matériau. Environ 80 appels de rendu en qualité basse, 150 en haute.
- **Herbe** : un seul maillage instancié qui s’enroule autour du joueur, hauteur et couleur lues dans des textures du monde, courbée par le vent et les personnages.
- **La Brume** : une carte de corruption recalculée depuis la lumière des phares teinte le sol, l’herbe et les arbres en direct.
- **Simulation** à pas fixes découplée de l’affichage, stable même quand l’image ralentit.

## Crédits

- Modèles 3D : [KayKit](https://kaylousberg.itch.io/) par Kay Lousberg — Character Pack Adventurers, Skeletons, Medieval Hexagon, Dungeon Remastered (licence CC0).
- Moteur 3D : [three.js](https://threejs.org/) (MIT).
- Polices : Uncial Antiqua, Alegreya, Alegreya Sans (SIL Open Font License), via Google Fonts.
- Reconnaissance de gestes : algorithme $P Point-Cloud (Vatavu, Anthony, Wobbrock, 2012), réimplémenté.

![Combat de nuit dans les Cendres](docs/screenshots/combat-nuit.jpg)
