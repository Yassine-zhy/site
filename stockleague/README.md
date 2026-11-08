# StockLeague

**La bourse, version championnat entre amis.** Crée une ligue privée, investis un capital fictif de 10 000 $ sur de vraies actions et pronostique si les entreprises vont battre ou manquer les attentes de leurs résultats trimestriels. Une saison, un classement, un gagnant.

> Argent fictif — à but ludique et éducatif — ceci n'est pas un conseil en investissement.

🚧 Projet en cours de construction, phase par phase (voir la [feuille de route](#feuille-de-route)).

📱 **Application mobile** : voir [`mobile/`](mobile/README.md). La démo Android installable (v0.5) est dans `mobile/android/release/`.

## Stack

| Rôle | Choix | Pourquoi |
| --- | --- | --- |
| Application | Next.js 16 (App Router) + TypeScript strict | Pages serveur, Server Actions, routes API et images Open Graph dans un seul projet |
| Interface | Tailwind CSS 4, shadcn/ui, lucide-react, Recharts | Composants accessibles, thème clair / sombre |
| Base de données et authentification | Supabase (Postgres, Auth, Row Level Security, Realtime) | Sécurité appliquée dans la base elle-même : un joueur ne lit que ses ligues |
| Données de marché | Finnhub (offre gratuite), isolé derrière `lib/market-data/` | Fournisseur remplaçable sans toucher au reste |
| Tâches planifiées | Supabase pg_cron → routes `/api/cron/*` protégées par secret | Vercel gratuit limite les crons à 1 par jour |
| Hébergement | Vercel | Déploiement à chaque push |

### Principes de conception

- **Aucun calcul d'argent côté navigateur.** Achats, ventes, pronostics et résolutions passent par des fonctions Postgres atomiques.
- **Montants en `numeric`**, jamais en `float`.
- **RLS sur toutes les tables**, testée automatiquement (`supabase/tests/`).
- **Règles du jeu centralisées** dans `src/lib/config/scoring.ts`. Le nom de l'app est dans `src/lib/config/app.ts`.

## Identité visuelle

L'habillage d'une retransmission sportive croisé avec un courtier : encre marine, gris craie froid, un seul accent (le jaune du tableau d'affichage, réservé au leader et aux repères). La typographie repose sur une seule famille, Archivo : condensée pour les titres et les scores, normale pour le texte, avec des chiffres tabulaires. Le vert et le rouge sont réservés aux gains et aux pertes, toujours accompagnés d'un signe + / - et d'une flèche.

## Installation locale

Prérequis : Node.js 22+, un projet Supabase (gratuit).

```bash
cd stockleague
npm install
cp .env.example .env.local   # puis remplis les valeurs
npm run dev                  # http://localhost:3000
```

### Mettre en place la base Supabase

1. Dans Supabase, ouvre **SQL Editor**.
2. Colle et exécute, dans l'ordre, chaque fichier de `supabase/migrations/`.

Ou bien, avec la CLI : `npx supabase link --project-ref <ref>` puis `npx supabase db push`.

### Variables d'environnement

| Variable | Où la trouver | Phase |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API | 1 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase > Project Settings > API Keys (clé « publishable ») | 1 |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` en local, l'URL Vercel en production | 1 |
| `SUPABASE_SECRET_KEY` | Supabase > API Keys (clé « secret », serveur uniquement) | 3 |
| `FINNHUB_API_KEY` | finnhub.io > Dashboard | 3 |
| `CRON_SECRET` | chaîne aléatoire longue | 4 |

## Scripts

| Commande | Effet |
| --- | --- |
| `npm run dev` | serveur de développement |
| `npm test` | tests unitaires (Vitest) |
| `npm run test:db` | applique les migrations sur un Postgres local vierge et lance les tests SQL de sécurité |
| `npm run typecheck` / `npm run lint` | vérifications TypeScript et ESLint |

## Feuille de route

- [x] **Phase 1** : projet, identité visuelle, schéma complet + RLS, connexion (lien magique + Google), profil, « Mes ligues »
- [x] **Maquette mobile complète** : tous les écrans, données de démo, APK Android installable
- [ ] Phase 2 : ligues et invitations (branchement de l’appli mobile sur Supabase)
- [ ] Phase 3 : données de marché, portefeuille, achat / vente
- [ ] Phase 4 : relevés quotidiens, classements, points de portefeuille
- [ ] Phase 5 : calendrier des résultats, pronostics, verrouillage, résolution
- [ ] Phase 6 : titres, fil d'activité, badges, temps réel
- [ ] Phase 7 : fin de saison et récap partageable
- [ ] Phase 8 : landing page, mode démo, README final, déploiement
