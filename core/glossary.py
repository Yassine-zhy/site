"""Glossaire de la finance : les termes qu'on croise dans l'actualité et sur les fiches entreprises."""

from __future__ import annotations

from datetime import date

# terme -> (rubrique, définition)
GLOSSARY: dict[str, tuple[str, str]] = {
    # --- Marchés -------------------------------------------------------------------------------
    "Action": ("Marchés", "Titre de propriété d'une part du capital d'une entreprise. Il donne droit à une part des "
               "bénéfices (dividende) et, en général, à un droit de vote en assemblée générale."),
    "Obligation": ("Marchés", "Titre de dette : l'investisseur prête à un État ou une entreprise, qui verse des "
                   "intérêts (le coupon) puis rembourse le capital à l'échéance."),
    "Indice boursier": ("Marchés", "Panier d'actions dont la valeur résume l'évolution d'un marché. Le CAC 40 suit "
                        "40 grandes valeurs de la Bourse de Paris, le S&P 500 les 500 plus grandes entreprises "
                        "américaines."),
    "Capitalisation boursière": ("Marchés", "Valeur d'une entreprise en Bourse : cours de l'action × nombre "
                                 "d'actions en circulation."),
    "Dividende": ("Marchés", "Part du bénéfice qu'une entreprise reverse à ses actionnaires, en général une ou deux "
                  "fois par an."),
    "Date de détachement": ("Marchés", "Jour à partir duquel acheter l'action ne donne plus droit au prochain "
                            "dividende. Le cours baisse mécaniquement d'environ le montant du dividende ce jour-là."),
    "Volatilité": ("Marchés", "Ampleur des variations d'un cours. On la mesure par l'écart-type des rendements, "
                   "souvent annualisé : 20 % de volatilité annuelle signifie des écarts typiques de ±20 % sur un an."),
    "VIX": ("Marchés", "« Indice de la peur » : volatilité attendue du S&P 500 sur 30 jours, calculée à partir du prix "
            "des options. Sous 15, marché serein ; au-dessus de 30, forte inquiétude."),
    "ETF": ("Marchés", "Fonds coté en Bourse qui réplique un indice (le CAC 40, le S&P 500, l'or…). Il permet "
            "d'investir dans tout un marché en une seule transaction, avec des frais faibles."),
    "Contrat à terme": ("Marchés", "Engagement d'acheter ou de vendre un actif à un prix et une date fixés à "
                        "l'avance. Les cours du pétrole Brent ou de l'or affichés sont souvent ceux de ces contrats "
                        "(futures)."),
    "Option": ("Marchés", "Droit, et non obligation, d'acheter (call) ou de vendre (put) un actif à un prix fixé, "
               "avant une date donnée, en échange d'une prime."),
    "Vente à découvert": ("Marchés", "Vendre un titre emprunté en pariant sur sa baisse, pour le racheter moins "
                          "cher plus tard. Aussi appelée « short »."),
    "Point de base": ("Marchés", "Un centième de point de pourcentage : un taux qui passe de 3,00 % à 3,25 % monte "
                      "de 25 points de base (pb)."),
    "Spread": ("Marchés", "Écart entre deux taux ou deux prix. Exemple : l'écart entre les taux d'emprunt à 10 ans de "
               "l'Italie et de l'Allemagne mesure le risque perçu sur la dette italienne."),
    "Marché haussier": ("Marchés", "Période de hausse durable des cours (bull market). On parle souvent de marché "
                        "haussier après une hausse de 20 % depuis un point bas."),
    "Marché baissier": ("Marchés", "Période de baisse durable (bear market), conventionnellement une chute de 20 % ou "
                        "plus depuis un sommet."),
    "Liquidité": ("Marchés", "Facilité à acheter ou vendre un actif rapidement sans faire bouger son prix. Une grande "
                  "capitalisation du CAC 40 est très liquide, une petite valeur l'est beaucoup moins."),
    # --- Valorisation --------------------------------------------------------------------------
    "PER": ("Valorisation", "Price Earnings Ratio : cours ÷ bénéfice par action. Un PER de 20 signifie que le marché "
            "paie 20 années de bénéfices actuels. Élevé : forte croissance attendue (ou survalorisation)."),
    "BPA": ("Valorisation", "Bénéfice par action : bénéfice net ÷ nombre d'actions. C'est le dénominateur du PER."),
    "Valeur d'entreprise": ("Valorisation", "Capitalisation boursière + dette nette. C'est le prix total qu'il "
                            "faudrait payer pour racheter l'entreprise, dettes comprises."),
    "EBITDA": ("Valorisation", "Excédent brut d'exploitation : résultat avant intérêts, impôts, dépréciations et "
               "amortissements. Il approche la rentabilité de l'activité elle-même."),
    "VE / EBITDA": ("Valorisation", "Valeur d'entreprise ÷ EBITDA. Permet de comparer des entreprises plus ou moins "
                    "endettées, contrairement au PER."),
    "Cours / valeur comptable": ("Valorisation", "Capitalisation ÷ capitaux propres (Price to Book). Sous 1, le "
                                 "marché valorise l'entreprise moins que ses actifs nets comptables."),
    "Rendement du dividende": ("Valorisation", "Dividende annuel ÷ cours de l'action. Un rendement de 3 % : 3 € de "
                               "dividende par an pour 100 € investis."),
    "Bêta": ("Valorisation", "Sensibilité d'une action aux mouvements du marché. Bêta de 1,2 : l'action amplifie en "
             "moyenne les mouvements de l'indice de 20 %. Bêta de 0,8 : elle les amortit."),
    "Consensus": ("Valorisation", "Moyenne des prévisions des analystes (bénéfice, chiffre d'affaires…). Une "
                  "entreprise qui publie au-dessus du consensus « bat les attentes »."),
    # --- Entreprise ----------------------------------------------------------------------------
    "Chiffre d'affaires": ("Entreprise", "Total des ventes sur une période. En anglais : revenue ou sales."),
    "Marge nette": ("Entreprise", "Bénéfice net ÷ chiffre d'affaires : la part de chaque euro vendu qui reste en "
                    "bénéfice."),
    "ROE": ("Entreprise", "Return on Equity, rentabilité des capitaux propres : bénéfice net ÷ capitaux propres. Ce "
            "que l'entreprise gagne avec l'argent de ses actionnaires."),
    "Flux de trésorerie disponible": ("Entreprise", "Free cash-flow : l'argent généré par l'activité après les "
                                      "investissements. C'est ce qui peut financer dividendes, rachats d'actions ou "
                                      "désendettement."),
    "Dette nette": ("Entreprise", "Dettes financières moins la trésorerie disponible."),
    "Publication de résultats": ("Entreprise", "Annonce trimestrielle ou semestrielle des comptes d'une entreprise. "
                                 "Les cours bougent souvent fortement ce jour-là."),
    "Rachat d'actions": ("Entreprise", "L'entreprise rachète ses propres actions, ce qui augmente la part de chaque "
                         "actionnaire restant et le bénéfice par action."),
    "Introduction en Bourse": ("Entreprise", "Première cotation des actions d'une entreprise sur un marché (IPO, "
                               "Initial Public Offering)."),
    "Fusion-acquisition": ("Entreprise", "Rapprochement de deux entreprises ou rachat de l'une par l'autre (M&A, "
                           "Mergers and Acquisitions)."),
    # --- Macroéconomie -------------------------------------------------------------------------
    "Inflation": ("Macroéconomie", "Hausse générale et durable des prix. Mesurée en France par l'Insee, en zone euro "
                  "par l'indice IPCH. La BCE vise 2 % par an."),
    "Taux directeur": ("Macroéconomie", "Taux auquel la banque centrale prête aux banques (ou rémunère leurs dépôts). "
                       "En le montant, elle renchérit le crédit pour freiner l'inflation."),
    "BCE": ("Macroéconomie", "Banque centrale européenne, à Francfort. Elle fixe les taux directeurs de la zone euro "
            "et a pour mission principale la stabilité des prix."),
    "Fed": ("Macroéconomie", "Réserve fédérale américaine. Son comité de politique monétaire (FOMC) se réunit huit "
            "fois par an pour fixer les taux. Double mandat : prix stables et plein emploi."),
    "PIB": ("Macroéconomie", "Produit intérieur brut : la valeur de tout ce qui est produit dans un pays sur une "
            "période. Sa variation mesure la croissance économique."),
    "Récession": ("Macroéconomie", "Recul de l'activité économique. Définition courante : deux trimestres "
                  "consécutifs de baisse du PIB."),
    "Courbe des taux": ("Macroéconomie", "Taux d'intérêt d'un même emprunteur selon la durée (3 mois, 2 ans, 10 ans…). "
                        "Normalement, plus c'est long, plus c'est cher."),
    "Inversion de la courbe des taux": ("Macroéconomie", "Quand les taux courts dépassent les taux longs. "
                                        "Historiquement, aux États-Unis, ce signal a souvent précédé une récession."),
    "Assouplissement quantitatif": ("Macroéconomie", "Achats massifs d'obligations par une banque centrale pour faire "
                                    "baisser les taux longs et soutenir l'économie (QE, Quantitative Easing)."),
    "Politique budgétaire": ("Macroéconomie", "Utilisation des dépenses publiques et des impôts par l'État pour "
                             "influencer l'économie. À distinguer de la politique monétaire, menée par la banque "
                             "centrale."),
    "Chômage": ("Macroéconomie", "Part de la population active sans emploi et qui en cherche un. Aux États-Unis, le "
                "rapport mensuel sur l'emploi (payrolls) fait souvent bouger les marchés."),
    # --- Crypto --------------------------------------------------------------------------------
    "Bitcoin": ("Crypto", "Première cryptomonnaie (2009), dont l'offre est plafonnée à 21 millions d'unités. Ses "
                "transactions sont enregistrées dans une blockchain publique."),
    "Blockchain": ("Crypto", "Registre partagé et infalsifiable de transactions, tenu par de nombreux ordinateurs "
                   "au lieu d'une autorité centrale."),
    "Stablecoin": ("Crypto", "Cryptomonnaie dont la valeur est adossée à une monnaie classique (souvent 1 dollar), "
                   "par exemple USDT ou USDC."),
    # --- Gestion de portefeuille ---------------------------------------------------------------
    "Diversification": ("Portefeuille", "Répartir son investissement entre des actifs qui ne varient pas ensemble, "
                        "pour réduire le risque sans forcément réduire le rendement attendu."),
    "Corrélation": ("Portefeuille", "Mesure, de -1 à +1, de la tendance de deux actifs à varier ensemble. Deux "
                    "actifs peu corrélés se diversifient bien."),
    "Indice de référence": ("Portefeuille", "Benchmark : l'indice auquel on compare la performance d'un portefeuille "
                            "(le CAC 40 pour des actions françaises, par exemple)."),
    "Perte maximale": ("Portefeuille", "Max drawdown : la plus forte baisse entre un sommet et le point bas suivant "
                       "sur une période. Elle répond à la question « combien aurais-je pu perdre au pire moment ? »."),
    "Rendement annualisé": ("Portefeuille", "Rendement ramené à une base annuelle pour comparer des placements sur des "
                            "durées différentes."),
    "Plus-value latente": ("Portefeuille", "Gain sur une position pas encore vendue : (cours actuel − prix d'achat) × "
                           "quantité. Elle n'est « réalisée » qu'à la vente."),
}

SECTIONS = ["Marchés", "Valorisation", "Entreprise", "Macroéconomie", "Crypto", "Portefeuille"]


def term_of_the_day(today: date | None = None) -> str:
    """Un terme différent chaque jour, le même pour tout le monde (calculé à partir de la date)."""
    terms = sorted(GLOSSARY)
    return terms[(today or date.today()).toordinal() % len(terms)]
