# Bot de swing trading crypto (Python + ccxt)

Bot autonome qui trade **une paire** (BTC/USDT par défaut) sur Kraken ou Binance,
avec des bougies de **4 h** : peu d'ordres, donc peu de frais, ce qui compte
beaucoup avec un capital de 100 $.

> **Avertissement.** Ce bot n'est pas une machine à gagner de l'argent. Aucune
> stratégie ne gagne à tous les coups, et un bon backtest ne garantit rien pour
> l'avenir. Testez-le plusieurs semaines en paper trading, puis n'engagez que
> de l'argent que vous acceptez de perdre en totalité.

---

## 1. Arborescence

```
trading-bot/
├── bot.py               ← script principal : boucle, journal, gestion des erreurs
├── strategy.py          ← le « cerveau » : RSI, EMA 50/200, check_buy_sell_signals(df)
├── risk.py              ← taille de position, stop-loss, take-profit
├── broker.py            ← connexion ccxt, ordres réels (LiveTrader) ou simulés (PaperTrader)
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
```

Testé avec Python 3.13, ccxt 4.5, pandas 3.0 et ta 0.11. Python 3.10 ou plus
récent est recommandé. La bibliothèque `ta` a été préférée à `pandas_ta`, moins
bien maintenue et souvent incompatible avec les versions récentes de numpy.

## 3. La stratégie

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

## 4. Installation

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

## 5. Guide pas à pas : tester sans argent réel

Il y a trois niveaux de test, du plus sûr au plus réaliste. Ne passez à
l'étape suivante que si la précédente vous convient.

### Étape 1 : backtest (5 minutes, aucune clé)

Rejoue la stratégie sur l'historique, avec les frais :

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

### Étape 2 : paper trading en direct (2 à 4 semaines, aucune clé)

Le bot tourne normalement avec les **vrais prix du marché**, mais les ordres
sont **simulés** sur un portefeuille virtuel de 100 $ (frais et glissement
de prix compris). Aucune clé API n'est nécessaire, et aucune n'est transmise
à l'exchange dans ce mode.

1. Dans `.env`, laissez `MODE=paper`. Choisissez `EXCHANGE` et `SYMBOL`, et
   réglez `PAPER_FEE_PCT` sur les frais de votre exchange (0.4 Kraken, 0.1 Binance).
2. Test rapide (une seule analyse) :
   ```bash
   python bot.py --once
   ```
   Le journal doit afficher une ligne `Analyse BTC/USDT 4h | ... -> HOLD/BUY/SELL (raison)`.
3. Lancement en continu (`Ctrl+C` pour arrêter proprement) :
   ```bash
   python bot.py
   ```
4. Suivez `bot_trading.log`. Exemple de journal (produit par les tests, avec des prix fictifs) :
   ```
   2026-10-08 19:33:52 | INFO     | Analyse BTC/USDT 4h | bougie du 2024-01-05 08:00 UTC | clôture 308.10 | RSI 45.2 | EMA50 303.70 | EMA200 244.62 -> BUY (tendance haussière et RSI qui rebondit (37.5 -> 45.2, seuil 40))
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

## 6. Faire tourner le bot 24 h/24

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

## 7. Robustesse : ce que le bot gère tout seul

| Situation | Réaction |
| --- | --- |
| Coupure Internet, timeout, exchange en maintenance | Nouvel essai après 30 s, 60 s, 120 s..., plafonné à 5 min pour garder le stop-loss sous contrôle |
| Timeout **pendant** un ordre | Vérifie les soldes pour savoir si l'ordre est passé, et n'achète jamais deux fois |
| Fonds insuffisants, ordre refusé | Journalisé, ordre abandonné, nouvel essai à l'analyse suivante |
| Clé API invalide ou révoquée | Arrêt du bot avec un message clair (insister ne servirait à rien) |
| Erreur imprévue | Journalisée avec le détail technique, le bot continue |
| Position vendue à la main sur le site | Détectée, la position du bot est remise à zéro |
| Fichier d'état corrompu | Arrêt du bot, plutôt que d'oublier une position ouverte |
| `Ctrl+C` ou arrêt du service | Fin du cycle en cours, puis arrêt propre |

## 8. Limites à connaître

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

## 9. Personnaliser

* **Réglages simples** (seuils RSI, EMA, stop-loss, unité de temps) : fichier `.env`.
* **Nouvel indicateur** (MACD, bandes de Bollinger...) : ajoutez la colonne
  dans `add_indicators()` et la règle dans `evaluate_signal()` (`strategy.py`).
  Le bot et le backtest utilisent automatiquement la nouvelle logique.
* Relancez le backtest et les tests après chaque modification.

## 10. Tests automatiques

```bash
pip install -r requirements-dev.txt
pytest
```

Ces tests utilisent un faux exchange : aucun accès réseau, aucun ordre réel.
Ils vérifient les signaux, le stop-loss et le take-profit, les frais, la
reprise après redémarrage, et la résistance aux coupures réseau (y compris un
timeout pendant un ordre).
