"""La fiche d'une valeur : logique pure (performances, analystes, résultats, dividendes, actualités) et pages."""

from datetime import date

import pandas as pd
import pytest

from conftest import make_article
from core import company, market


def series(values, start="2020-01-01", freq="D", tz="Europe/Paris"):
    return pd.Series(values, index=pd.date_range(start, periods=len(values), freq=freq, tz=tz), dtype=float)


# --- Quelle sorte de valeur ? ---------------------------------------------------------------------


def test_symbole_lu_dans_l_adresse():
    assert company.normalize_symbol(" mc.pa ") == "MC.PA"
    assert company.normalize_symbol(["aapl", "x"]) == "AAPL"
    assert company.normalize_symbol(None) == "" and company.normalize_symbol([]) == ""


@pytest.mark.parametrize("symbol, expected", [("MC.PA", "EQUITY"), ("AAPL", "EQUITY"), ("^FCHI", "INDEX"),
                                              ("EURUSD=X", "CURRENCY"), ("GC=F", "FUTURE"), ("BTC-USD", "CRYPTOCURRENCY")])
def test_type_estime_d_apres_le_symbole(symbol, expected):
    assert company.guess_type(symbol) == expected


def test_action_ou_autre_selon_le_type_yahoo():
    assert company.quote_type("MC.PA", {"quoteType": "equity"}) == "EQUITY"
    assert company.quote_type("^FCHI", {}) == "INDEX"  # Yahoo muet : on devine
    assert company.quote_type("^FCHI", {"quoteType": "EQUITY"}) == "EQUITY"  # Yahoo a le dernier mot
    assert company.is_stock("EQUITY") and company.is_stock("ETF")
    assert not any(company.is_stock(kind) for kind in ["INDEX", "CURRENCY", "FUTURE", "CRYPTOCURRENCY"])


def test_noms_connus_et_valeurs_du_secteur():
    assert company.known_name("MC.PA") == "LVMH" and company.known_name("GC=F") == "Or"
    assert company.known_name("ZZZZ") is None
    peers = dict(company.sector_peers("MC.PA"))
    assert "RMS.PA" in peers and "MC.PA" not in peers  # le luxe parisien, sans LVMH
    assert all(market.place_of(s) == "france" for s in peers)
    assert company.sector_peers("ZZZZ") == [] and company.sector_peers("EURUSD=X") == []


def test_indice_d_une_place():
    assert company.place_of_index("^FCHI") == "france"
    assert company.place_of_index("^GSPTSX") == "canada"
    assert company.place_of_index("^DJI") == "usa"
    assert company.place_of_index("^GSPC") is None


def test_valeur_de_la_fiche_presélectionnee_dans_les_formulaires():
    assert company.with_symbol(["A", "B"], "") == (["A", "B"], None)
    assert company.with_symbol(["A", "B"], "B") == (["A", "B"], 1)
    assert company.with_symbol(["A", "B"], "EURUSD=X") == (["EURUSD=X", "A", "B"], 0)  # absente : ajoutée en tête


# --- Performances ---------------------------------------------------------------------------------


def test_performances_sur_une_serie_simulee():
    # 6 ans de séances quotidiennes, le cours monte de 1 par jour
    closes = series(range(100, 100 + 2200), start="2020-01-01")
    last_day = closes.index[-1]
    result = dict(company.performances(closes))
    last = closes.iloc[-1]
    assert list(result) == ["1 semaine", "1 mois", "3 mois", "6 mois", "Depuis le 1er janvier", "1 an", "5 ans"]
    assert result["1 semaine"] == pytest.approx((last / closes[last_day - pd.DateOffset(weeks=1)] - 1) * 100)
    assert result["1 an"] == pytest.approx((last / closes[last_day - pd.DateOffset(years=1)] - 1) * 100)
    ytd_start = closes[: pd.Timestamp(year=last_day.year - 1, month=12, day=31, hour=23, tz="Europe/Paris")].iloc[-1]
    assert result["Depuis le 1er janvier"] == pytest.approx((last / ytd_start - 1) * 100)
    assert all(value > 0 for value in result.values())


def test_performances_avec_un_historique_trop_court():
    closes = series([100, 101, 102, 103, 104, 105, 106, 107, 108, 109], start="2026-10-01")
    result = dict(company.performances(closes))
    assert result["1 semaine"] == pytest.approx((109 / 102 - 1) * 100)
    assert result["1 an"] is None and result["5 ans"] is None  # pas assez d'historique
    assert company.performances(series([100])) == []  # un seul cours : rien à comparer


def test_performances_week_end_et_sans_fuseau():
    # Le jour voulu tombe un week-end : on prend la dernière séance avant
    days = pd.bdate_range("2026-08-03", "2026-10-09")
    closes = pd.Series(range(len(days)), index=days, dtype=float) + 100
    result = dict(company.performances(closes))
    target = days[-1] - pd.DateOffset(months=1)  # 9 septembre 2026, un mercredi
    assert result["1 mois"] == pytest.approx((closes.iloc[-1] / closes[:target].iloc[-1] - 1) * 100)


def test_performances_d_un_taux_en_points_de_base():
    closes = series([4.0, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9], start="2026-10-01")
    assert dict(company.performances(closes, "pb"))["1 semaine"] == pytest.approx((4.9 - 4.2) * 100)


# --- Analystes ------------------------------------------------------------------------------------


@pytest.mark.parametrize("mean, label", [(1.0, "achat fort"), (1.49, "achat fort"), (1.5, "achat"), (2.4, "achat"),
                                         (2.5, "conserver"), (3.4, "conserver"), (3.5, "vente"), (4.4, "vente"),
                                         (4.5, "vente forte"), (5.0, "vente forte")])
def test_recommandation_traduite(mean, label):
    assert company.recommendation_label(mean) == label


def test_recommandation_absente():
    assert company.recommendation_label(None) is None


def test_note_moyenne_d_apres_la_repartition_des_avis():
    mean, count = company.mean_from_counts({"strongBuy": 3, "buy": 14, "hold": 10, "sell": 0, "strongSell": 0})
    assert count == 27 and mean == pytest.approx((3 + 28 + 30) / 27)
    assert company.recommendation_label(mean) == "achat"
    assert company.mean_from_counts({}) == (None, 0)


def test_potentiel_jusqu_a_l_objectif():
    assert company.upside(100, 125) == pytest.approx(25)
    assert company.upside(100, 80) == pytest.approx(-20)
    assert company.upside(0, 80) is None and company.upside(100, None) is None


def test_synthese_des_analystes():
    profile = {"recommendationMean": 1.9, "numberOfAnalystOpinions": 27, "targetLowPrice": 415.0,
               "targetMeanPrice": 498.0, "targetHighPrice": 594.7, "regularMarketPrice": 388.6}
    summary = company.analyst_summary(profile)
    assert summary["label"] == "achat" and summary["count"] == 27
    assert summary["upside"] == pytest.approx((498 / 388.6 - 1) * 100)
    assert company.analyst_summary({}) is None  # Yahoo ne donne rien : pas de section


def test_synthese_des_analystes_avec_les_donnees_de_secours():
    extra = {"counts": {"strongBuy": 1, "buy": 1, "hold": 0, "sell": 0, "strongSell": 0},
             "targets": {"low": 90.0, "mean": 120.0, "high": 150.0, "current": 100.0}}
    summary = company.analyst_summary({}, extra)
    assert summary["label"] == "achat" and summary["count"] == 2 and summary["upside"] == pytest.approx(20)
    assert (summary["low"], summary["high"], summary["current"]) == (90.0, 150.0, 100.0)


def test_barre_des_objectifs_de_cours():
    spots = company.target_positions(low=90, target=120, high=150, current=100)
    assert all(0 < value < 100 for value in spots.values())  # une marge de chaque côté
    assert spots["low"] < spots["current"] < spots["target"] < spots["high"]
    assert company.target_positions(100, 100, 100, 100)["current"] == pytest.approx(50)  # tout au même endroit


# --- Résultats et dividendes ----------------------------------------------------------------------


def test_resultats_annuels():
    columns = pd.to_datetime(["2025-12-31", "2024-12-31", "2023-12-31", "2022-12-31", "2021-12-31"])
    income = pd.DataFrame({"Total Revenue": [80.0, 84.0, 86.0, 79.0, float("nan")],
                           "Net Income": [10.0, 12.0, 15.0, 14.0, float("nan")]}, index=columns).T
    rows = company.yearly_results(income)
    assert [r["year"] for r in rows] == [2022, 2023, 2024, 2025]  # du plus ancien au plus récent, 4 exercices
    assert rows[-1] == {"year": 2025, "revenue": 80.0, "net": 10.0, "margin": pytest.approx(12.5)}
    assert company.yearly_results(None) == [] and company.yearly_results(pd.DataFrame()) == []
    assert company.yearly_results(pd.DataFrame({"Net Income": [1.0]}, index=["x"]).T) == []  # pas de chiffre d'affaires


def test_resultat_net_absent():
    income = pd.DataFrame({"Total Revenue": [50.0]}, index=pd.to_datetime(["2025-12-31"])).T
    assert company.yearly_results(income) == [{"year": 2025, "revenue": 50.0, "net": None, "margin": None}]


PAYMENTS = [("2020-04-20", 3.0), ("2020-12-02", 4.0), ("2021-04-20", 4.0), ("2021-12-02", 4.5), ("2022-12-02", 5.0),
            ("2023-12-02", 5.5), ("2024-12-02", 6.0), ("2025-12-02", 6.5), ("2026-04-24", 3.5)]


def test_dividendes_par_annee_complete():
    result = company.annual_dividends(PAYMENTS, today=date(2026, 10, 21))
    assert result == [(2021, 8.5), (2022, 5.0), (2023, 5.5), (2024, 6.0), (2025, 6.5)]  # 5 ans, sans 2026 (incomplète)
    assert company.annual_dividends([], today=date(2026, 10, 21)) == []


def test_rendement_sur_douze_mois():
    # Sur les 12 derniers mois avant le 21/10/2026 : 6,5 (déc. 2025) + 3,5 (avril 2026) = 10 sur un cours de 200
    assert company.trailing_yield(PAYMENTS, 200.0, today=date(2026, 10, 21)) == pytest.approx(5.0)
    assert company.trailing_yield(PAYMENTS, 0, today=date(2026, 10, 21)) is None
    assert company.trailing_yield([], 200.0) is None


# --- Actualités -----------------------------------------------------------------------------------


def test_une_depeche_parle_de_l_entreprise():
    by_name = make_article("LVMH shares jump after earnings")
    by_ticker = make_article("Luxury stocks rise", tickers=["MC.PA"])
    accent = make_article("Le groupe L'Oréal progresse")
    inside_word = make_article("Metallurgy outlook")  # « Meta » ne doit pas matcher « Metallurgy »
    other = make_article("Bitcoin rebounds")
    assert company.mentions(by_name, "MC.PA", ["LVMH"])
    assert company.mentions(by_ticker, "MC.PA", ["LVMH"])
    assert company.mentions(accent, "OR.PA", ["L'Oreal"])  # sans tenir compte des accents
    assert not company.mentions(inside_word, "META", ["Meta"])
    assert not company.mentions(other, "MC.PA", ["LVMH"])
    assert not company.mentions(by_name, "MC.PA", ["", "ab"])  # un nom trop court n'est pas cherché


def test_actualites_dedoublonnees_et_les_plus_recentes():
    feed = [make_article("LVMH results", url="https://a/1", hours_ago=5), make_article("Bitcoin up", hours_ago=1),
            make_article("LVMH opens a store", url="https://a/2", hours_ago=3)]
    yahoo = [make_article("LVMH results", url="https://y/1", hours_ago=4),  # même titre que le fil : doublon
             make_article("Luxury outlook", url="https://y/2", hours_ago=2)]
    news = company.related_news(feed, yahoo, "MC.PA", ["LVMH"])
    assert [a.title for a in news] == ["Luxury outlook", "LVMH opens a store", "LVMH results"]
    assert len(company.related_news(feed, yahoo, "MC.PA", ["LVMH"], limit=2)) == 2


def test_plus_fortes_hausses_et_baisses():
    changes = [("A", "A", 3.0), ("B", "B", -2.0), ("C", "C", 0.5), ("D", "D", -0.1), ("E", "E", 0.0)]
    ups, downs = company.movers(changes, count=2)
    assert [s for s, *_ in ups] == ["A", "C"] and [s for s, *_ in downs] == ["B", "D"]
    assert company.movers([("A", "A", 1.0)]) == ([("A", "A", 1.0)], [])  # une valeur ne figure pas des deux côtés


# --- Les pages (données factices, aucun réseau) ---------------------------------------------------

from test_app import app  # noqa: E402,F401  (la fixture qui monte le site complet avec des données factices)


@pytest.fixture
def yahoo(monkeypatch):
    """Yahoo Finance factice : un historique de 5 ans, des résultats, des dividendes, des avis d'analystes."""
    days = pd.bdate_range(end=pd.Timestamp.today().normalize(), periods=1300, tz="Europe/Paris")
    history = pd.DataFrame({"Close": [100 + n * 0.1 for n in range(len(days))]}, index=days)
    monkeypatch.setattr(market, "price_history", lambda symbol, period="6mo": history.tail(
        {"1mo": 22, "6mo": 130, "1y": 260, "5y": 1300}.get(period, 130)) if symbol != "ZZZZZZ" else history.iloc[:0])
    monkeypatch.setattr(market, "company_profile", lambda symbol: {} if symbol == "ZZZZZZ" else {
        "shortName": symbol, "longName": f"{symbol} SA", "currency": "EUR", "quoteType": company.guess_type(symbol),
        "regularMarketPrice": 110.0, "fiftyTwoWeekLow": 90.0, "fiftyTwoWeekHigh": 130.0, "recommendationMean": 2.0,
        "numberOfAnalystOpinions": 12, "targetLowPrice": 100.0, "targetMeanPrice": 125.0, "targetHighPrice": 150.0,
        "dividendYield": 2.5})
    columns = pd.to_datetime(["2025-12-31", "2024-12-31", "2023-12-31"])
    income = pd.DataFrame({"Total Revenue": [80e9, 84e9, 86e9], "Net Income": [10e9, 12e9, 15e9]}, index=columns).T
    monkeypatch.setattr(company, "fetch_income", lambda symbol: company.yearly_results(income))
    monkeypatch.setattr(company, "fetch_dividends", lambda symbol: PAYMENTS)
    monkeypatch.setattr(company, "fetch_analysts", lambda symbol: {})
    from core import sources
    monkeypatch.setattr(sources, "fetch_yahoo_ticker_news", lambda ticker: [])


def test_fiche_d_une_action(app, yahoo):
    app.query_params["s"] = "MC.PA"
    app.run()
    app.switch_page("views/quote.py").run()
    assert not app.exception
    titles = " ".join(h.value for h in app.get("html"))
    for section in ["Performances", "Résultats", "Ce qu&#x27;en pensent les analystes", "Dividendes", "Actualités"]:
        assert section in titles
    assert any(b.label == "Suivre" for b in app.button)  # mode local : on est connecté


def test_fiche_d_un_indice_sans_les_sections_d_entreprise(app, yahoo):
    app.query_params["s"] = "^FCHI"
    app.run()
    app.switch_page("views/quote.py").run()
    assert not app.exception
    titles = " ".join(h.value for h in app.get("html"))
    assert "Performances" in titles and "Dans le CAC 40" in titles
    assert "Résultats" not in titles and "Dividendes" not in titles


def test_fiche_sans_symbole_ou_avec_un_symbole_inconnu(app, yahoo):
    app.run()
    app.switch_page("views/quote.py").run()
    assert not app.exception and any("Quelques fiches" in h.value for h in app.get("html"))
    app.query_params["s"] = "ZZZZZZ"
    app.switch_page("views/quote.py").run()
    assert not app.exception and any("ne connaît pas" in w.value for w in app.warning)


def test_alerte_depuis_une_fiche(app, yahoo):
    app.query_params["s"] = "EURUSD=X"
    app.run()
    app.switch_page("views/alerts.py").run()
    assert not app.exception
    assert app.selectbox[0].value == "EURUSD=X"  # présélectionnée, bien qu'absente de la liste habituelle


def test_mes_suivis_garde_sa_fiche(app, yahoo, db):
    db.add_follow(db.LOCAL_USER, "company", "MC.PA", "LVMH")
    app.run()
    app.switch_page("views/following.py").run()
    app.pills(key="follow_view").set_value("company|MC.PA").run()
    assert not app.exception
    assert any("Indicateurs clés" in h.value for h in app.get("html"))
