"""Paramètres de l'application, regroupés en un seul endroit pour être faciles à modifier."""

# Les catégories du fil : clé technique -> libellé affiché
CATEGORIES = {
    "marches": "Marchés",
    "crypto": "Crypto",
    "entreprises": "Entreprises",
    "macro": "Macro",
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
    {"name": "Nasdaq", "url": "https://www.nasdaq.com/feed/rssoutbound?category=Markets", "category": "entreprises"},
    {"name": "The Economist", "url": "https://www.economist.com/finance-and-economics/rss.xml", "category": "macro"},
    {"name": "Réserve fédérale (Fed)", "url": "https://www.federalreserve.gov/feeds/press_all.xml", "category": "macro"},
    {"name": "BCE", "url": "https://www.ecb.europa.eu/rss/press.html", "category": "macro"},
    {"name": "CoinDesk", "url": "https://www.coindesk.com/arc/outboundfeeds/rss/", "category": "crypto"},
    {"name": "Cointelegraph", "url": "https://cointelegraph.com/rss", "category": "crypto"},
]

MAX_ARTICLES_PER_FEED = 25  # on garde les N articles les plus récents de chaque flux
REQUEST_TIMEOUT = 10  # secondes d'attente maximum par requête
USER_AGENT = "Mozilla/5.0 (compatible; FinVeille/1.0; projet etudiant)"

# Mots-clés qui signalent une catégorie (en minuscules, sans accents ; anglais et français).
# Sert à reclasser les articles des flux généralistes (voir core/classifier.py).
CATEGORY_KEYWORDS = {
    "crypto": [
        "bitcoin", "btc", "ethereum", "ether", "crypto", "cryptos", "cryptocurrency", "cryptomonnaie",
        "blockchain", "stablecoin", "stablecoins", "token", "solana", "binance", "coinbase", "nft", "defi",
    ],
    "macro": [
        "inflation", "fed", "federal reserve", "reserve federale", "ecb", "bce", "central bank",
        "banque centrale", "interest rate", "interest rates", "taux directeur", "rate cut", "rate hike",
        "gdp", "pib", "recession", "unemployment", "chomage", "jobs report", "payrolls", "cpi",
        "tariff", "tariffs", "droits de douane", "budget", "public debt", "dette publique", "deficit",
        "imf", "fmi", "treasury", "economy", "economie", "croissance", "growth",
    ],
    "entreprises": [
        "earnings", "resultats", "revenue", "chiffre d'affaires", "ceo", "pdg", "acquisition",
        "acquire", "merger", "fusion", "rachat", "ipo", "introduction en bourse", "layoffs",
        "licenciements", "profit", "benefice", "guidance", "dividend", "dividende", "buyback",
    ],
    "marches": [
        "stocks", "stock market", "actions", "s&p 500", "nasdaq", "dow", "cac 40", "dax", "index",
        "indice", "bonds", "obligations", "yield", "yields", "oil", "petrole", "gold", "forex",
        "wall street", "bourse", "rally", "sell-off", "futures", "etf", "shares",
    ],
}

# --- API d'actualités (clés gratuites, à mettre dans .streamlit/secrets.toml) ----------------
# Nom de la clé -> description et page d'inscription
API_KEYS = {
    "FINNHUB_API_KEY": ("Finnhub", "https://finnhub.io/register"),
    "NEWSAPI_API_KEY": ("NewsAPI", "https://newsapi.org/register"),
    "MARKETAUX_API_KEY": ("Marketaux", "https://www.marketaux.com/register"),
    "ALPHAVANTAGE_API_KEY": ("Alpha Vantage", "https://www.alphavantage.co/support/#api-key"),
}

# Clés des moteurs de résumé par IA (optionnelles ; sans elles, résumé local)
AI_KEYS = {
    "GEMINI_API_KEY": ("Google Gemini", "https://aistudio.google.com/apikey"),
    "GROQ_API_KEY": ("Groq", "https://console.groq.com/keys"),
}

# Catégories d'actualités Finnhub -> nos catégories
FINNHUB_CATEGORIES = {"general": "marches", "merger": "entreprises", "forex": "macro", "crypto": "crypto"}

# Thèmes Alpha Vantage -> nos catégories (le premier thème reconnu l'emporte)
ALPHAVANTAGE_TOPICS = {
    "blockchain": "crypto",
    "economy_macro": "macro",
    "economy_monetary": "macro",
    "economy_fiscal": "macro",
    "earnings": "entreprises",
    "ipo": "entreprises",
    "mergers_and_acquisitions": "entreprises",
    "financial_markets": "marches",
}

# Grandes entreprises reconnues dans les titres : ticker -> (nom, domaine du site, mots qui la désignent).
# Les mots sont en minuscules et sans accents (comparés au texte normalisé).
COMPANIES = {
    "AAPL": ("Apple", "apple.com", ["apple", "iphone"]),
    "MSFT": ("Microsoft", "microsoft.com", ["microsoft"]),
    "NVDA": ("Nvidia", "nvidia.com", ["nvidia"]),
    "GOOGL": ("Alphabet", "abc.xyz", ["alphabet", "google"]),
    "AMZN": ("Amazon", "amazon.com", ["amazon"]),
    "META": ("Meta", "meta.com", ["meta platforms", "facebook", "instagram"]),
    "TSLA": ("Tesla", "tesla.com", ["tesla"]),
    "AVGO": ("Broadcom", "broadcom.com", ["broadcom"]),
    "ORCL": ("Oracle", "oracle.com", ["oracle"]),
    "NFLX": ("Netflix", "netflix.com", ["netflix"]),
    "PLTR": ("Palantir", "palantir.com", ["palantir"]),
    "AMD": ("AMD", "amd.com", ["amd"]),
    "INTC": ("Intel", "intel.com", ["intel"]),
    "JPM": ("JPMorgan", "jpmorganchase.com", ["jpmorgan", "jp morgan"]),
    "GS": ("Goldman Sachs", "goldmansachs.com", ["goldman sachs", "goldman"]),
    "MS": ("Morgan Stanley", "morganstanley.com", ["morgan stanley"]),
    "BA": ("Boeing", "boeing.com", ["boeing"]),
    "XOM": ("ExxonMobil", "exxonmobil.com", ["exxon", "exxonmobil"]),
    "WMT": ("Walmart", "walmart.com", ["walmart"]),
    "COIN": ("Coinbase", "coinbase.com", ["coinbase"]),
    "ASML": ("ASML", "asml.com", ["asml"]),
    "SAP": ("SAP", "sap.com", ["sap"]),
    "MC.PA": ("LVMH", "lvmh.com", ["lvmh", "louis vuitton"]),
    "TTE.PA": ("TotalEnergies", "totalenergies.com", ["totalenergies", "total energies"]),
    "AIR.PA": ("Airbus", "airbus.com", ["airbus"]),
    "BNP.PA": ("BNP Paribas", "bnpparibas.com", ["bnp paribas", "bnp"]),
    "SAN.PA": ("Sanofi", "sanofi.com", ["sanofi"]),
    "OR.PA": ("L'Oréal", "loreal.com", ["l'oreal", "loreal"]),
    "RMS.PA": ("Hermès", "hermes.com", ["hermes"]),
    "STLAP.PA": ("Stellantis", "stellantis.com", ["stellantis"]),
    "RNO.PA": ("Renault", "renaultgroup.com", ["renault"]),
    "GLE.PA": ("Société Générale", "societegenerale.com", ["societe generale"]),
    "SAF.PA": ("Safran", "safran-group.com", ["safran"]),
    "SU.PA": ("Schneider Electric", "se.com", ["schneider electric"]),
    "KER.PA": ("Kering", "kering.com", ["kering"]),
}
