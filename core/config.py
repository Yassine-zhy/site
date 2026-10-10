"""Paramètres de l'application, regroupés en un seul endroit pour être faciles à modifier."""

# Les catégories du fil : clé technique -> libellé affiché
CATEGORIES = {
    "marches": "📈 Marchés",
    "crypto": "🪙 Crypto",
    "entreprises": "🏢 Entreprises",
    "macro": "🌍 Macro",
}

# Les flux RSS gratuits (aucune clé nécessaire).
# "category" est la catégorie par défaut des articles de ce flux.
_CNBC = "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id="
RSS_FEEDS = [
    {"name": "CNBC Marchés", "url": _CNBC + "10000664", "category": "marches"},
    {"name": "CNBC Économie", "url": _CNBC + "20910258", "category": "macro"},
    {"name": "CNBC Entreprises", "url": _CNBC + "10001147", "category": "entreprises"},
    {"name": "BFM Bourse", "url": "https://www.tradingsat.com/rssbourse.xml", "category": "marches"},
    {"name": "Le Monde Économie", "url": "https://www.lemonde.fr/economie/rss_full.xml", "category": "macro"},
    {"name": "BBC Business", "url": "https://feeds.bbci.co.uk/news/business/rss.xml", "category": "entreprises"},
    {"name": "Nasdaq", "url": "https://www.nasdaq.com/feed/rssoutbound?category=Markets", "category": "marches"},
    {"name": "The Economist", "url": "https://www.economist.com/finance-and-economics/rss.xml", "category": "macro"},
    {"name": "Réserve fédérale (Fed)", "url": "https://www.federalreserve.gov/feeds/press_all.xml", "category": "macro"},
    {"name": "BCE", "url": "https://www.ecb.europa.eu/rss/press.html", "category": "macro"},
    {"name": "CoinDesk", "url": "https://www.coindesk.com/arc/outboundfeeds/rss/", "category": "crypto"},
    {"name": "Cointelegraph", "url": "https://cointelegraph.com/rss", "category": "crypto"},
]

MAX_ARTICLES_PER_FEED = 25  # on garde les N articles les plus récents de chaque flux
REQUEST_TIMEOUT = 10  # secondes d'attente maximum par requête
USER_AGENT = "Mozilla/5.0 (compatible; FinVeille/1.0; projet etudiant)"
