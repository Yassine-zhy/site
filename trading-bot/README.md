# Bot de swing trading crypto (Python + ccxt)

Bot autonome qui trade **un actif au choix** : une crypto (BTC, ETH, SOL...)
sur Kraken ou Binance, ou **une action ou un ETF américain** (Nvidia, Apple,
Tesla, S&P 500...) via le courtier Alpaca. Il travaille sur des bougies de 4 h
ou d'un jour : peu d'ordres, donc peu de frais, ce qui compte beaucoup avec un
capital de 100 $.

Deux façons de prendre les décisions, au choix dans le `.env` :

* **`STRATEGY=ai`** : à chaque consultation, **Claude** (l'IA d'Anthropic) lit
  les prix, cherche l'actualité sur le web et décide d'acheter, de vendre ou
  d'attendre, avec une explication en français. Payant (voir section 3).
* **`STRATEGY=indicators`** : des règles fixes RSI + EMA 50/200. Gratuit.

Dans les deux cas, le stop-loss, le take-profit et la taille maximale des
positions sont appliqués par le code : l'IA ne peut pas les contourner.

> **Avertissement.** Ce bot n'est pas une machine à gagner de l'argent. Aucune
> stratégie ne gagne à tous les coups, et un bon backtest ne garantit rien pour
> l'avenir. Testez-le plusieurs semaines en paper trading, puis n'engagez que
> de l'argent que vous acceptez de perdre en totalité.

---

## 1. Arborescence

```
trading-bot/
├── bot.py               ← script principal : boucle, journal, gestion des erreurs
├── ai_advisor.py        ← le conseiller IA : contexte envoyé à Claude, recherche web, décision
├── strategy.py          ← les règles fixes : RSI, EMA 50/200, check_buy_sell_signals(df)
├── risk.py              ← taille de position, stop-loss, take-profit
├── broker.py            ← connexion ccxt, ordres réels (LiveTrader) ou simulés (PaperTrader)
├── stocks.py            ← actions et ETF via Alpaca (même interface que broker.py)
├── config.py            ← lecture et validation du fichier .env
├── state.py             ← mémoire du bot (position ouverte, prix d'achat) dans un JSON
├── backtest.py          ← rejoue la stratégie sur l'historique
├── .env.example         ← modèle de configuration à copier en .env
├── requirements.txt     ← dépendances
├── requirements-dev.txt ← dépendances + pytest pour les tests
├── tests/               ← tests automatiques (faux exchange, aucun accès réseau)
└── .gitignore           ← exclut .env, journaux et fichiers d'état
```

Fichiers créés par le bot lors de son fonctionnement (jamais publiés sur GitHub) :

| Fichier | Rôle |
| --- | --- |
| `.env` | votre configuration et vos clés API |
| `bot_trading.log` | journal horodaté de chaque action (5 Mo max, 5 archives) |
| `state_paper.json`, `state_testnet.json`, `state_live.json` | position ouverte et bilan, un fichier par mode |

Chaque module a un seul rôle : pour changer d'indicateurs, on ne modifie que
`strategy.py` ; pour changer d'exchange, une ligne du `.env`.

## 2. `requirements.txt`

```
ccxt>=4.4,<5
pandas>=2.0
numpy>=1.24
ta>=0.11,<0.12
python-dotenv>=1.0
anthropic>=1.12,<2
alpaca-py>=0.40
```

Testé avec Python 3.13, ccxt 4.5, pandas 3.0, ta 0.11 et anthropic 1.12.
**Python 3.10 ou plus récent est nécessaire.** La bibliothèque `ta` a été préférée à `pandas_ta`, moins
bien maintenue et souvent incompatible avec les versions récentes de numpy.

## 3. Le mode IA : Claude décide en temps réel

### Comment ça marche

Toutes les 15 minutes, le bot regarde le marché. Il **consulte Claude** :

* à chaque nouvelle bougie de 4 h (`AI_INTERVAL_MINUTES=240`) ;
* **plus tôt si le prix bouge fortement**, de plus de 3 % depuis la dernière
  consultation (`AI_PRICE_TRIGGER_PCT=3`).

À chaque consultation, Claude reçoit :

* les prix : 3 jours de bougies 4 h, 30 jours de clôtures, les variations sur 4 h, 24 h, 7 j et 30 j ;
* les indicateurs RSI et EMA ;
* la position ouverte (prix d'achat, gain ou perte, stop-loss), le portefeuille, les frais ;
* ses 5 dernières décisions, pour garder le fil.

Claude **cherche ensuite l'actualité sur le web** (régulation, ETF, piratages,
annonces économiques...) et renvoie une décision structurée : action, confiance
sur 100, taille de position et explication en français. Le tout est écrit dans
le journal :

```
Consultation de l'IA (claude-opus-5-5, effort medium) : première consultation...
Réponse de l'IA : BUY | confiance 72/100 | taille 60 % du maximum | coût estimé 0.140 $ (2 recherche(s) web), total 0.14 $
  Raisonnement : Le prix rebondit après un repli dans une tendance haussière et aucune mauvaise nouvelle majeure n'est sortie. Achat prudent avec une taille réduite.
  Actualités : Entrées nettes positives sur les ETF Bitcoin hier ; pas d'incident sur les exchanges.
Décision : BUY (IA, confiance 72/100)
Signal BUY : achat au marché pour 30.00 USDT (30 % de 100.00 USDT disponibles).
```

(Exemple produit par les tests, avec un prix fictif.)

### Ce que l'IA ne peut pas faire

Le code garde le dernier mot :

* **le stop-loss (-3 %) et le take-profit (+8 %)** sont vérifiés par le code
  toutes les 60 s, même si l'IA est en panne ou injoignable ;
* l'IA ne peut pas investir plus que `POSITION_SIZE_PCT` du solde, ni ouvrir
  plusieurs positions ;
* une décision dont la confiance est sous `AI_MIN_CONFIDENCE` (60) est ignorée ;
* l'IA n'a aucun accès à vos clés d'exchange, ni à la moindre fonction de retrait ;
* si la clé Anthropic est refusée, le bot désactive l'IA mais continue de protéger la position.

### Ce que ça coûte

L'API d'Anthropic est **payante, et facturée à part** d'un éventuel abonnement
Claude. Le prix dépend du nombre de mots lus et écrits par l'IA, plus 0,01 $
par recherche web. Ordres de grandeur par consultation (le bot affiche le coût
estimé de chaque consultation et le total) :

| Modèle (`AI_MODEL`) | Par consultation (environ) | Par mois, avec 6 consultations par jour |
| --- | --- | --- |
| `claude-opus-5-5` (par défaut, le plus capable) | 0,10 à 0,20 $ | 20 à 35 $ |
| `claude-sonnet-5-5` | 0,05 à 0,10 $ | 10 à 18 $ |
| `claude-haiku-5-5` | moins de 0,02 $ | 1 à 3 $ |

**Avec un capital de 100 $, la facture de l'IA peut dépasser les gains.** Pour
la réduire, vous pouvez :

* espacer les consultations (`AI_INTERVAL_MINUTES=480`) ;
* baisser `AI_MAX_CALLS_PER_DAY` ;
* choisir un modèle moins cher, ou couper la recherche web (`AI_WEB_SEARCH=non`).

Fixez aussi une limite de dépense mensuelle dans la console Anthropic.

### Obtenir une clé API Anthropic

1. Créez un compte sur <https://console.anthropic.com>.
2. Achetez quelques dollars de crédit (section *Billing*).
3. Dans *API Keys*, créez une clé et copiez-la dans le `.env` : `ANTHROPIC_API_KEY=sk-ant-...`.

### Pourquoi on ne peut pas faire de backtest du mode IA

Pour rejouer le passé honnêtement, il faudrait que l'IA ignore ce qui s'est
passé ensuite. Or Claude connaît déjà l'historique jusqu'à sa date
d'entraînement, et il faudrait aussi reconstituer l'actualité de chaque jour.
**La seule façon fiable de juger le mode IA est le paper trading**, sur
plusieurs semaines : l'argent du trading reste fictif, mais les consultations
de l'IA sont payées.

Soyons honnêtes : rien ne prouve qu'une IA qui lit l'actualité batte le marché.
Les nouvelles importantes sont intégrées dans les prix en quelques secondes par
des professionnels bien plus rapides. Le mode IA est une expérience
intéressante, pas une garantie de gain.

## 4. Les règles fixes (`STRATEGY=indicators`)

Le bot décide **uniquement sur des bougies clôturées** : la bougie en cours
change jusqu'à sa clôture et ferait « clignoter » le signal.

| Signal | Condition (réglable dans le `.env`) |
| --- | --- |
| **BUY** | Tendance de fond haussière (EMA 50 > EMA 200 **et** clôture > EMA 200) **et** RSI qui repasse au-dessus de 40 : un repli se termine. |
| **SELL** | RSI ≥ 70 (surachat) **ou** EMA 50 passée sous l'EMA 200 (la tendance se retourne). |
| **HOLD** | Tous les autres cas. |

Pourquoi 40 et pas 30 ? En tendance haussière, le RSI descend rarement sous 30 :
il oscille plutôt entre 40 et 80, et 40 joue le rôle de zone de survente.

**Gestion des risques, prioritaire sur les signaux :**

* chaque achat engage **50 %** du solde disponible (`POSITION_SIZE_PCT`), une seule position à la fois ;
* **stop-loss -3 %** et **take-profit +8 %** sur le prix d'achat réel ; le prix
  est contrôlé **toutes les 60 s**, et la vente au marché part dès qu'un seuil est franchi ;
* après une sortie, le bot ne rachète pas sur le même signal (même bougie), ce qui évite de payer des frais en boucle ;
* l'achat est annulé s'il est sous le minimum imposé par l'exchange (environ 5 $ selon la paire).

**Ce que coûtent les frais** (un achat + une vente au marché) :

| Exchange | Frais par ordre | Stop-loss -3 % devient | Take-profit +8 % devient |
| --- | --- | --- | --- |
| Kraken Pro | ~0,40 % | ~ -3,8 % | ~ +7,2 % |
| Binance | ~0,10 % | ~ -3,2 % | ~ +7,8 % |

Avec 100 $, Binance coûte environ quatre fois moins cher en frais. Les frais
exacts dépendent de votre volume et de votre pays : vérifiez la grille de
votre compte.

**Résultats du backtest sur données réelles** (Binance, octobre 2022 à
octobre 2026, 100 $ de départ, réglages par défaut sauf mention) :

| Variante | Frais 0,10 % | Frais 0,40 % | Garder sans rien faire | Pire baisse du bot | Pire baisse en gardant |
| --- | --- | --- | --- | --- | --- |
| BTC/USDT 4h, SL 3 % / TP 8 % (défaut) | **+2,5 %** | **-13,9 %** | +379 % | -11,6 % | -53 % |
| BTC/USDT 1d, SL 3 % / TP 8 % | +1,5 % | -4,1 % | +183 % | -6,0 % | -53 % |
| ETH/USDT 4h, SL 3 % / TP 8 % | +9,5 % | -6,7 % | +93 % | -12,3 % | -68 % |
| BTC/USDT 4h, SL 5 % / TP 15 % | -2,4 % | -15,8 % | +379 % | -12,6 % | -53 % |

Ce qu'il faut en retenir :

* sur cette période, **aucune variante ne bat le simple fait de garder la crypto** ;
* avec les frais de Kraken (0,40 %), la stratégie **perd de l'argent** ;
  avec ceux de Binance (0,10 %), elle fait à peu près zéro ;
* son seul atout est de **limiter les baisses** (environ -12 % au pire, contre
  -53 % en gardant le BTC). En contrepartie, elle n'est investie que
  16 % du temps, avec la moitié du capital.

Ces chiffres décrivent le passé et ne prédisent rien. Ne cherchez pas les
réglages qui auraient « gagné » sur l'historique : c'est le meilleur moyen
d'obtenir une stratégie qui échoue ensuite.

## 5. Trader des actions : Nvidia, Apple, S&P 500...

Kraken et Binance ne proposent que des cryptos. Pour les actions et les ETF
américains, le bot passe par **Alpaca**, un courtier en ligne avec une API :

* **aucune commission**, et achat de **fractions d'action** : avec 50 $, on
  achète 50 $ de Nvidia, même si une action coûte bien plus cher ;
* un **compte d'entraînement gratuit** (argent fictif), idéal pour tester ;
* tout le reste du bot fonctionne pareil : le mode IA, les règles fixes, le
  stop-loss, le take-profit et le journal.

### Mise en place

1. Créez un compte sur <https://alpaca.markets>. Alpaca accepte des clients
   de nombreux pays, mais pas tous : vérifiez le vôtre. Le compte
   d'entraînement (*Paper Trading*) suffit pour commencer.
2. Dans le tableau de bord *Paper Trading*, générez une clé API (*API Keys*,
   puis *Generate*).
3. Dans `.env` :
   ```ini
   EXCHANGE=alpaca
   SYMBOL=NVDA
   TIMEFRAME=1d
   API_KEY=votre_cle_alpaca
   API_SECRET=votre_secret_alpaca
   PAPER_FEE_PCT=0.05
   MODE=testnet
   ```
4. Lancez `python bot.py --once`, puis `python bot.py`.

Avec Alpaca, les trois modes signifient :

| `MODE` | Avec Alpaca |
| --- | --- |
| `paper` | Prix réels, ordres simulés par le bot lui-même (clés d'entraînement suffisantes) |
| `testnet` | Vrais ordres sur le **compte d'entraînement** d'Alpaca (argent fictif) : le plus réaliste pour tester |
| `live` | Vrais ordres sur votre compte réel (clés du compte réel, `CONFIRM_LIVE=OUI`) |

Pour le backtest d'une action : `python backtest.py --days 1460` (clés Alpaca
nécessaires, même d'entraînement).

### Ce qui change par rapport aux cryptos

* **La Bourse ferme.** Elle est ouverte en semaine, de 15 h 30 à 22 h (heure
  de Paris, une heure plus tôt quelques semaines par an au changement d'heure),
  hors jours fériés américains. En dehors de ces heures, le bot
  attend et l'écrit dans le journal (`Marché fermé : ...`).
* **Risque de trou à l'ouverture.** Le stop-loss ne peut agir que pendant la
  séance. Si l'action baisse de 10 % pendant la nuit (mauvais résultats, par
  exemple), la vente se fera à l'ouverture, bien au-delà de -3 %.
* **Bougies d'un jour conseillées** (`TIMEFRAME=1d`). L'EMA 200 demande alors
  200 séances, soit environ 10 mois d'historique : le bot les télécharge seul.
* **Cours ajustés.** Les divisions d'actions (Nvidia a divisé la sienne par 10
  en 2024) sont corrigées dans l'historique : sans ça, les indicateurs seraient faux.
* **Règle américaine des « day trades ».** Sur un compte de moins de 25 000 $,
  pas plus de 3 achats-ventes dans la même journée sur 5 jours. Le bot fait du
  swing trading, il est donc rarement concerné ; un stop-loss déclenché le jour
  même de l'achat compte pourtant comme un day trade.
* **Prix gratuits.** Le flux gratuit d'Alpaca (IEX) suffit pour des bougies
  d'un jour ; `ALPACA_DATA_FEED=sip` utilise le flux complet, réservé aux
  abonnés payants.

## 6. Installation

```bash
cd trading-bot
python -m venv .venv
# Windows :        .venv\Scripts\activate
# macOS / Linux :  source .venv/bin/activate
pip install -r requirements.txt
```

Puis copiez le modèle de configuration :

```bash
cp .env.example .env        # Windows : copy .env.example .env
```

---

## 7. Guide pas à pas : tester sans argent réel

Il y a trois niveaux de test, du plus sûr au plus réaliste. Ne passez à
l'étape suivante que si la précédente vous convient.

### Étape 1 : backtest des règles fixes (5 minutes, aucune clé)

Rejoue les règles RSI + EMA sur l'historique, avec les frais (le mode IA ne
peut pas être backtesté, voir section 3) :

```bash
python backtest.py --days 730 --exchange binance
```

Kraken ne fournit que les 720 dernières bougies (120 jours en 4 h). Pour un
historique plus long, utilisez `--exchange binance` : les données publiques
suffisent, sans compte. Si Binance est inaccessible depuis votre pays, lancez
`python backtest.py` (Kraken, 120 jours) ou fournissez un fichier avec
`--csv bougies.csv`.

Comparez surtout trois lignes du rapport :

* **Capital** contre **Buy & hold** : la stratégie fait-elle mieux que d'acheter et d'attendre ?
* **Pire baisse** : êtes-vous prêt à voir votre compte perdre autant ?
* **Frais payés** : avec 100 $, ils peuvent manger une grande partie des gains.

Vous pouvez modifier `STOP_LOSS_PCT`, `TAKE_PROFIT_PCT`, `RSI_BUY_LEVEL` ou
`TIMEFRAME=1d` dans le `.env`, puis relancer. Méfiez-vous du sur-ajustement :
un réglage qui brille sur le passé échoue souvent sur l'avenir.

### Étape 2 : paper trading en direct (2 à 4 semaines, aucune clé d'exchange)

Le bot tourne normalement avec les **vrais prix du marché**, mais les ordres
sont **simulés** sur un portefeuille virtuel de 100 $ (frais et glissement
de prix compris). Aucune clé d'exchange n'est nécessaire, et aucune n'est
transmise à l'exchange dans ce mode.

En mode IA (`STRATEGY=ai`), il faut en revanche la clé Anthropic
(`ANTHROPIC_API_KEY`), et **les consultations de l'IA sont réellement
facturées**, même en paper trading. Sans clé, passez `STRATEGY=indicators`.

1. Dans `.env`, laissez `MODE=paper`. Choisissez `EXCHANGE` et `SYMBOL`, et
   réglez `PAPER_FEE_PCT` sur les frais de votre exchange (0.4 Kraken, 0.1 Binance).
2. Test rapide (une seule analyse) :
   ```bash
   python bot.py --once
   ```
   Le journal doit afficher une ligne `Analyse BTC/USDT 4h | ...`, puis `Décision : HOLD/BUY/SELL (raison)`.
3. Lancement en continu (`Ctrl+C` pour arrêter proprement) :
   ```bash
   python bot.py
   ```
4. Suivez `bot_trading.log`. Exemple de journal (produit par les tests, avec des prix fictifs) :
   ```
   2026-10-08 19:33:52 | INFO     | Analyse BTC/USDT 4h | bougie du 2024-01-05 08:00 UTC | clôture 308.10 | RSI 45.2 | EMA50 303.70 | EMA200 244.62
   2026-10-08 19:33:52 | INFO     | Décision : BUY (tendance haussière et RSI qui rebondit (37.5 -> 45.2, seuil 40))
   2026-10-08 19:33:52 | INFO     | Signal BUY : achat au marché pour 50.00 USDT (50 % de 100.00 USDT disponibles).
   2026-10-08 19:33:52 | INFO     | ACHAT exécuté : 0.16163686 BTC à 308.10 (coût 50.00 USDT, frais inclus). Stop-loss 298.85 | Take-profit 332.74.
   2026-10-08 19:33:52 | WARNING  | STOP-LOSS déclenché : prix 298.24, soit -3.20 % depuis l'achat à 308.10. Vente au marché immédiate.
   2026-10-08 19:33:52 | INFO     | VENTE (STOP-LOSS) exécutée : 0.16163686 BTC à 298.24 -> 48.01 USDT reçus | résultat -1.99 USDT (-3.97 %) | bilan : 1 trade(s), 0 gagnant(s), -1.99 USDT.
   ```
5. En swing trading, il peut se passer **plusieurs jours sans aucun trade** :
   c'est normal. Laissez tourner au moins 2 à 4 semaines pour juger.
6. Pour repartir de zéro : arrêtez le bot et supprimez `state_paper.json`.

### Étape 3 (facultative) : testnet Binance, de vrais ordres sur de l'argent fictif

Cette étape vérifie ce que le paper trading ne peut pas vérifier : vos clés,
les permissions, les ordres réellement acceptés par l'exchange. Kraken n'a pas
de testnet spot, cette étape se fait donc sur Binance.

1. Allez sur <https://testnet.binance.vision>, connectez-vous avec un compte
   GitHub, puis cliquez sur **Generate HMAC_SHA256 Key**. Notez l'API Key et la
   Secret Key : ce sont des clés de **test**, différentes de celles d'un vrai compte.
2. Dans `.env` :
   ```ini
   MODE=testnet
   EXCHANGE=binance
   API_KEY=votre_cle_de_test
   API_SECRET=votre_secret_de_test
   MAX_ORDER_COST=50
   ```
   Le testnet crédite des milliers d'USDT fictifs. `MAX_ORDER_COST=50` limite
   chaque achat à 50 $, comme sur un compte réel de 100 $.
3. Lancez `python bot.py --once`, puis `python bot.py`.

Les prix du testnet ne suivent pas exactement le vrai marché, et le testnet est
remis à zéro de temps en temps. Il sert à tester la mécanique, pas la rentabilité.

### Étape 4 : passage à l'argent réel (100 $)

À ne faire qu'après plusieurs semaines de paper trading satisfaisantes.

1. **Créez une clé API sur votre vrai compte** avec le strict minimum :
   * **Kraken** (Settings → API) : *Query Funds*, *Query Open Orders & Trades*,
     *Query Closed Orders & Trades*, *Create & Modify Orders* ;
   * **Binance** (Gestion des API) : *Enable Reading*, *Enable Spot & Margin Trading*.
   * **Ne cochez JAMAIS la permission de retrait (Withdraw).** Même si la clé
     fuite, personne ne pourra sortir vos fonds.
   * Si possible, limitez la clé à l'adresse IP de la machine qui fait tourner le bot.
2. Dans `.env` :
   ```ini
   MODE=live
   CONFIRM_LIVE=OUI
   EXCHANGE=kraken
   API_KEY=votre_vraie_cle
   API_SECRET=votre_vrai_secret
   MAX_ORDER_COST=0
   ```
   Sans `CONFIRM_LIVE=OUI`, le bot refuse de démarrer en réel.
3. Déposez vos 100 $ dans la monnaie de la paire (USDT pour BTC/USDT).
4. Lancez `python bot.py --once` et vérifiez dans le journal la ligne
   `Portefeuille : ...` (solde lu sur votre compte), puis lancez `python bot.py`.

Le bot ne vend que la quantité qu'il a lui-même achetée : les cryptos déjà
présentes sur votre compte ne sont pas touchées.

---

## 8. Faire tourner le bot 24 h/24

Le stop-loss est surveillé **par le bot**. Si l'ordinateur est éteint ou en
veille, plus rien ne protège la position. Pour du réel, utilisez une machine
toujours allumée : petit serveur VPS (environ 5 $/mois) ou Raspberry Pi.

Sur Linux, un service systemd relance le bot automatiquement après un plantage
ou un redémarrage. Créez `/etc/systemd/system/trading-bot.service` (adaptez
les chemins et l'utilisateur) :

```ini
[Unit]
Description=Bot de swing trading crypto
After=network-online.target
Wants=network-online.target

[Service]
User=pi
WorkingDirectory=/home/pi/trading-bot
ExecStart=/home/pi/trading-bot/.venv/bin/python bot.py
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now trading-bot
journalctl -u trading-bot -f      # suivre le journal en direct
```

Le bot enregistre sa position dans `state_<mode>.json` : après un redémarrage,
il reprend la position ouverte, avec son stop-loss et son take-profit.

## 9. Robustesse : ce que le bot gère tout seul

| Situation | Réaction |
| --- | --- |
| Coupure Internet, timeout, exchange en maintenance | Nouvel essai après 30 s, 60 s, 120 s..., plafonné à 5 min pour garder le stop-loss sous contrôle |
| Timeout **pendant** un ordre | Vérifie les soldes pour savoir si l'ordre est passé, et n'achète jamais deux fois |
| Fonds insuffisants, ordre refusé | Journalisé, ordre abandonné, nouvel essai à l'analyse suivante |
| Clé API invalide ou révoquée | Arrêt du bot avec un message clair (insister ne servirait à rien) |
| IA injoignable, crédit Anthropic épuisé | Décision HOLD, nouvel essai à l'analyse suivante ; le stop-loss reste actif |
| Clé Anthropic refusée | IA désactivée, le bot continue de protéger la position |
| Bourse fermée (actions) | Aucun ordre, le bot attend la séance suivante |
| Erreur imprévue | Journalisée avec le détail technique, le bot continue |
| Position vendue à la main sur le site | Détectée, la position du bot est remise à zéro |
| Fichier d'état corrompu | Arrêt du bot, plutôt que d'oublier une position ouverte |
| `Ctrl+C` ou arrêt du service | Fin du cycle en cours, puis arrêt propre |

## 10. Limites à connaître

* **Stop-loss logiciel.** La vente part au marché dès que le seuil est franchi.
  En cas de chute brutale, elle peut s'exécuter un peu sous -3 %. Si le bot
  est arrêté, rien ne protège la position.
* **USDT en Europe.** Depuis la réglementation MiCA (2025), l'USDT est
  restreint pour les résidents de l'Espace économique européen sur plusieurs
  plateformes, dont Binance et Kraken. Si c'est votre cas, utilisez
  `SYMBOL=BTC/USDC` ou `SYMBOL=BTC/EUR`.
* **Une seule position à la fois.** Les 50 % restants servent de réserve.
* **Petit capital.** Avec 100 $, un trade gagnant rapporte quelques dollars.
  Le but de cette première étape est d'apprendre et de valider la méthode,
  pas de s'enrichir.
* **Impôts.** Les plus-values sur cryptomonnaies peuvent être imposables :
  renseignez-vous sur les règles de votre pays.

## 11. Personnaliser

* **Réglages simples** (seuils RSI, EMA, stop-loss, unité de temps) : fichier `.env`.
* **Nouvel indicateur** (MACD, bandes de Bollinger...) : ajoutez la colonne
  dans `add_indicators()` et la règle dans `evaluate_signal()` (`strategy.py`).
  Le bot et le backtest utilisent automatiquement la nouvelle logique.
* Relancez le backtest et les tests après chaque modification.

## 12. Tests automatiques

```bash
pip install -r requirements-dev.txt
pytest
```

Ces tests utilisent un faux exchange, un faux courtier Alpaca et un faux
client Anthropic : aucun accès réseau, aucun ordre réel, aucun coût.
Ils vérifient les signaux, le stop-loss et le take-profit, les frais, la
reprise après redémarrage, et la résistance aux coupures réseau (y compris un
timeout pendant un ordre).
