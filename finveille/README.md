# FinVeille

**La veille financière et économique mondiale, mise en page comme un quotidien et mise à jour en continu.**

FinVeille rassemble l'actualité de 12 flux RSS et de 4 API financières, la classe par rubrique, suit les
entreprises et les thèmes de son utilisateur, affiche les cours des marchés mondiaux et résume les articles par IA.
Application web en Python (Streamlit), construite pas à pas : chaque étape est un commit, documenté dans
[`guide/`](guide/README.md).

![Le fil d'actualité de FinVeille, thème clair](docs/screenshots/fil-clair.jpg)

## Fonctionnalités

| | |
| --- | --- |
| **Agrégation** | 12 flux RSS gratuits (CNBC, BBC, Le Monde, BFM Bourse, The Economist, Fed, BCE, CoinDesk…) + Finnhub, NewsAPI, Marketaux et Alpha Vantage si les clés sont renseignées. Téléchargement en parallèle, dédoublonnage. |
| **Le fil** | « À la une » et « En continu », rubriques Marchés / Crypto / Entreprises / Macro (classement par mots-clés), filtre par source, recherche sans accents par mot-clé ou entreprise, mise à jour automatique toutes les 5 minutes. |
| **Favoris, lu, masqué** | Enregistrés dans une base SQLite, conservés d'une session à l'autre ; export CSV des favoris. |
| **Mes suivis** | Entreprises (recherche par nom) et thèmes, avec un fil dédié pour chacun. |
| **Fiches entreprises** | Logo, cours, graphique interactif (1 mois à 5 ans), 10 indicateurs clés expliqués (PER, VE/EBITDA, ROE, rendement, bêta…), fourchette sur 52 semaines. |
| **Marchés** | Bandeau défilant des cours sur toutes les pages ; tableau de bord de 20 instruments (indices, devises, taux, matières premières, crypto) avec mini-courbes et carte des performances sur 1 séance à 3 mois. |
| **En chiffres** | Tableau de bord du flux : dépêches par heure et par rubrique, entreprises les plus citées, tonalité par rubrique. |
| **Résumé par IA** | « L'essentiel » en 3 points : Gemini ou Groq (offres gratuites) en français, ou résumé extractif local sans clé ; repli automatique en cas d'erreur, résumés mis en cache. |
| **Apparence** | Thème clair (papier) et sombre (ardoise), responsive ordinateur / mobile, couleurs vérifiées pour le daltonisme. |

## Aperçu

| Marchés | En chiffres (thème sombre) |
| --- | --- |
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
 RSS, Finnhub,     Yahoo Finance      Gemini / Groq     SQLite
 NewsAPI, Marketaux, (yfinance)        (résumés)         data/finveille.db
 Alpha Vantage
```

- **Logique et affichage séparés :** `core/` ne dépend pas de Streamlit. Tout y est testable sans navigateur.
- **Un format unique :** chaque source est convertie en `Article` dès la réception.
- **Robustesse :** une source en panne n'arrête jamais l'application ; les erreurs affichées ne révèlent jamais une
  clé API.
- **Sobriété :** caches calibrés sur les quotas gratuits (15 min pour les actualités, 2 min pour les cours, 6 h pour
  les fiches), résumés calculés une seule fois.

## Stack

Python 3.11+ · Streamlit · requests · feedparser · yfinance · pandas · Altair · trafilatura · SQLite · pytest

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
theme.py          identité visuelle : CSS, bandeau de titre, tuiles, mise en forme française
views/            une page par fichier (fil, marchés, en chiffres, suivis, favoris, réglages)
core/             logique métier : sources, agrégation, classement, marché, résumé, stockage
tests/            39 tests pytest (sources, classement, base, résumé, marché, pages)
guide/            le guide de construction, étape par étape
```

## Choix de conception

- **Une identité éditoriale** plutôt qu'un tableau de bord générique : titres en Newsreader, interface en IBM Plex,
  filets et rubriques en petites capitales, l'encre comme couleur de marque. La couleur est réservée aux données.
- **Accessibilité :** palette validée pour les principales formes de daltonisme, jamais d'information portée par la
  seule couleur (▲/▼ et signes, noms de rubrique), tableau de données à côté de chaque visualisation, animations
  désactivées si le système le demande.
- **Sécurité :** HTML systématiquement échappé, liens non web refusés, requêtes SQL paramétrées, clés dans les
  secrets et transmises par en-tête HTTP quand l'API le permet.

## Limites connues

- Les cours Yahoo Finance sont différés et la bibliothèque yfinance n'est pas officielle.
- La tonalité est estimée par un lexique simple (inspiré de Loughran et McDonald) : elle ne comprend ni la négation
  ni l'ironie.
- Hébergée gratuitement, la base SQLite est partagée par tous les visiteurs et peut être réinitialisée au
  redémarrage du serveur.

*Projet personnel et pédagogique. Les informations affichées ne constituent pas un conseil en investissement.*
