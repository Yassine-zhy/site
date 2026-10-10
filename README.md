# FinVeille

**La veille financière et économique mondiale, dans une interface de plateforme professionnelle, mise à jour en continu.**

FinVeille rassemble l'actualité de 12 flux RSS et de 4 API financières, la classe par rubrique, suit les
entreprises et les thèmes de son utilisateur, affiche les cours des marchés mondiaux et résume les articles par IA.
Application web en Python (Streamlit), construite pas à pas : chaque étape est un commit, documenté dans
[`guide/`](guide/README.md).

![Le fil d'actualité de FinVeille, thème clair](docs/screenshots/fil-clair.jpg)

## Fonctionnalités

| | |
| --- | --- |
| **Agrégation** | 12 flux RSS gratuits (CNBC, BBC, Le Monde, BFM Bourse, The Economist, Fed, BCE, CoinDesk…) + Finnhub, NewsAPI, Marketaux et Alpha Vantage si les clés sont renseignées. Téléchargement en parallèle, dédoublonnage. |
| **Le fil** | « À la une » (l'histoire reprise par le plus de sources) et « En continu », rubriques Marchés / Crypto / Entreprises / Macro (classement par mots-clés), tendances cliquables, filtre par source, recherche avancée (`"expression exacte"`, `-exclure`, `source:cnbc`), vue compacte, mise à jour automatique toutes les 5 minutes. |
| **Le brief** | L'édition du jour rédigée automatiquement : la séance en une phrase, l'histoire la plus reprise de chaque rubrique, les sujets qui montent, l'agenda de mes entreprises, le mot du jour. Téléchargeable en Markdown. |
| **Comptes** | Connexion avec Google, ou par e-mail et Facebook via Auth0 (OpenID Connect, aucun mot de passe stocké). Chaque utilisateur a ses propres favoris, suivis, portefeuille et alertes ; export et suppression de ses données (RGPD). Sans configuration, mode local à un utilisateur. |
| **Favoris, lu, masqué** | Enregistrés dans une base SQLite, conservés d'une session à l'autre ; notes personnelles ; export CSV des favoris. |
| **Mes suivis** | Entreprises (recherche par nom) et thèmes, avec un fil dédié pour chacun. |
| **Fiches entreprises** | Logo, cours, graphique interactif (1 mois à 5 ans) avec les dépêches placées sur la courbe, 10 indicateurs clés expliqués (PER, VE/EBITDA, ROE, rendement, bêta…), fourchette sur 52 semaines, agenda (résultats, dividende, consensus). |
| **Marchés** | Bandeau défilant des cours sur toutes les pages ; 20 instruments mondiaux avec mini-courbes et carte des performances ; carte du CAC 40 par secteur (40 valeurs, palmarès) ; convertisseur de devises. |
| **Économie** | Tableau de bord des statistiques officielles (BCE, Réserve fédérale) : inflation et inflation sous-jacente, taux directeurs et taux réels, taux à 10 ans, chômage, croissance, pour la zone euro, la France et les États-Unis ; courbes des taux avec détection d'inversion. |
| **Comparer** | Jusqu'à 4 entreprises en base 100, rendement annualisé, volatilité, perte maximale, valorisation et matrice de corrélation. |
| **Portefeuille virtuel** | Positions multidevises valorisées en euros, plus-values latentes, répartition, performance comparée au CAC 40, portefeuille d'exemple. |
| **Alertes** | Seuils de cours ou de variation du jour, bandeau d'alerte sur toutes les pages. |
| **Glossaire** | 55 termes de la finance expliqués simplement, recherche, mot du jour. |
| **En chiffres** | Tableau de bord du flux : dépêches par heure et par rubrique, entreprises les plus citées, tonalité par rubrique. |
| **Résumé par IA** | « L'essentiel » en 3 points : Gemini ou Groq (offres gratuites) en français, ou résumé extractif local sans clé ; repli automatique en cas d'erreur, résumés mis en cache. |
| **Apparence** | Thèmes clair et sombre (bleu nuit) avec une palette propre à chacun (`light-dark()` en CSS), cartes, tableaux de données, responsive ordinateur / mobile, contrastes vérifiés par un test automatique, couleurs adaptées au daltonisme. |

## Aperçu

| Le brief du jour | Carte du CAC 40 |
| --- | --- |
| ![Le brief du jour](docs/screenshots/brief.jpg) | ![Carte du CAC 40 par secteur](docs/screenshots/cac40.jpg) |
| **Comparateur** | **Portefeuille virtuel** |
| ![Comparateur d'entreprises](docs/screenshots/comparer.jpg) | ![Portefeuille virtuel](docs/screenshots/portefeuille.jpg) |
| **Marchés** | **En chiffres (thème sombre)** |
| ![Tableau de bord des marchés](docs/screenshots/marches.jpg) | ![Tableau de bord de l'actualité](docs/screenshots/en-chiffres.jpg) |
| **Fiche entreprise** | **Mobile** |
| ![Fiche entreprise LVMH](docs/screenshots/fiche-entreprise.jpg) | ![Version mobile](docs/screenshots/mobile.jpg) |

## Architecture

```
 Navigateur (ordinateur / mobile)
        │
 ┌──────▼─────────────────────────────────────────────────────────────┐
 │ Interface Streamlit   app.py · views/*.py · ui.py · theme.py         │
 └──────┬─────────────────────────────────────────────────────────────┘
        │ appelle                                   (aucun code Streamlit en dessous)
 ┌──────▼─────────────────────────────────────────────────────────────┐
 │ core/  sources → aggregator → classifier · filters · analytics       │
 │        market · summarizer · storage                                 │
 └──┬──────────────────┬──────────────────┬──────────────────┬───────┘
    ▼                  ▼                  ▼                  ▼
 RSS, Finnhub,     Yahoo Finance,     Gemini / Groq     SQLite
 NewsAPI, Marketaux, BCE, FRED       (résumés)         data/finveille.db
 Alpha Vantage
```

- **Logique et affichage séparés :** `core/` ne dépend pas de Streamlit. Tout y est testable sans navigateur.
- **Un format unique :** chaque source est convertie en `Article` dès la réception.
- **Robustesse :** une source en panne n'arrête jamais l'application ; les erreurs affichées ne révèlent jamais une
  clé API.
- **Sobriété :** caches calibrés sur les quotas gratuits (15 min pour les actualités, 2 min pour les cours, 6 h pour
  les fiches), résumés calculés une seule fois.

## Stack

Python 3.11+ · Streamlit (+ OpenID Connect) · requests · feedparser · yfinance · pandas · Altair · trafilatura · SQLite · pytest

16 étapes documentées dans [`guide/`](guide/README.md), une par commit.

## Lancer le projet

```bash
git clone <adresse-du-dépôt> && cd finveille
python -m venv .venv
source .venv/bin/activate            # Windows : .venv\Scripts\Activate.ps1
pip install -r requirements.txt
streamlit run app.py
```

L'application fonctionne **sans aucune clé**. Pour activer les API et le résumé par IA, copie
`.streamlit/secrets.toml.example` en `.streamlit/secrets.toml` et renseigne les clés gratuites voulues.

Tests :

```bash
pip install -r requirements-dev.txt
pytest
```

## Structure

```
app.py            point d'entrée : thème, bandeau des cours, navigation
ui.py             éléments partagés : chargement en cache, carte d'article, résumé
theme.py          design : jetons de couleur clair/sombre, cartes, tuiles, tableaux, mise en forme française
assets/           le logo (SVG)
views/            une page par fichier (fil, brief, en chiffres, marchés, économie, comparer, suivis, portefeuille,
                  alertes, favoris, glossaire, réglages, mon compte)
core/             logique métier : sources, agrégation, classement, statistiques, marché, indicateurs de
                  risque, portefeuille, alertes, brief, économie (BCE, FRED), résumé, stockage
tests/            107 tests pytest (sources, recherche, base et comptes, résumé, indicateurs, portefeuille, alertes,
                  brief, chaque page)
guide/            le guide de construction, étape par étape
```

## Choix de conception

- **Un design de plateforme financière** : barre d'application avec logo, cartes, tableaux, chiffres en police à
  chasse fixe, une seule couleur de marque (le bleu). Interface en IBM Plex Sans, titres d'articles en Newsreader
  pour garder une touche éditoriale. La couleur des données est réservée à la hausse, la baisse et aux rubriques.
- **Deux vraies palettes** : Streamlit indique le thème actif au navigateur (`color-scheme`), la fonction CSS
  `light-dark()` choisit la bonne couleur sans relancer le script.
- **Accessibilité :** contraste WCAG vérifié par un test (texte ≥ 7:1, boutons ≥ 4,5:1, dans les deux thèmes),
  palette validée pour les principales formes de daltonisme, jamais d'information portée par la seule couleur
  (▲/▼ et signes, noms de rubrique), tableau de données à côté de chaque visualisation, animations désactivées si le
  système le demande.
- **Sécurité :** HTML systématiquement échappé, liens non web refusés, requêtes SQL paramétrées, clés dans les
  secrets et transmises par en-tête HTTP quand l'API le permet.

## Limites connues

- Les cours Yahoo Finance sont différés et la bibliothèque yfinance n'est pas officielle.
- La tonalité est estimée par un lexique simple (inspiré de Loughran et McDonald) : elle ne comprend ni la négation
  ni l'ironie.
- Hébergée gratuitement, la base SQLite peut être réinitialisée au redémarrage du serveur (comptes compris) : une
  base hébergée (Supabase, Neon, Turso) est la suite logique, le schéma est prêt (`user_id` partout).

*Projet personnel et pédagogique. Les informations affichées ne constituent pas un conseil en investissement.*
