"""Page « Simulateurs » : épargne, investissement programmé, crédit immobilier et inflation."""

from datetime import date

import altair as alt
import streamlit as st

import theme
from core import simulators as sim
from core.macro import real_rate
from theme import esc
from ui import company_choices, current_user, load_closes, load_macro

BLUE, ORANGE = "#3987e5", "#d95926"  # palette validée (couleurs des séries)
DCA_ASSETS = {
    "^FCHI": "CAC 40",
    "^GSPC": "S&P 500",
    "URTH": "MSCI World (ETF)",
    "^IXIC": "Nasdaq",
    "GC=F": "Or",
    "BTC-EUR": "Bitcoin",
}


def euros(value: float) -> str:
    return f"{theme.fr_number(value, 0)} €"


def kpis(items: list[tuple[str, str, str]]) -> None:
    """Une rangée de chiffres clés : (titre, valeur, précision)."""
    st.html('<div class="fv-kpis">' + "".join(
        f'<div class="fv-kpi"><div class="fv-kpi-label">{esc(label)}</div><div class="fv-kpi-value">{value}</div>'
        f'<div class="fv-kpi-sub">{sub}</div></div>' for label, value, sub in items) + "</div>")


def chart(layer, key: str) -> None:
    with st.container(key=f"fvchart_{key}"):
        st.altair_chart(theme.french(layer.properties(background="transparent")), width="stretch")


# --- Épargne à intérêts composés -----------------------------------------------------------------


def savings_view() -> None:
    a, b, c, d = st.columns(4)
    initial = a.number_input("Capital de départ (€)", min_value=0, value=1_000, step=500)
    monthly = b.number_input("Versement mensuel (€)", min_value=0, value=200, step=50)
    rate = c.slider("Rendement annuel (%)", 0.0, 12.0, 5.0, 0.5,
                    help="Ordres de grandeur historiques, avant inflation : livret 1 à 3 %, obligations 2 à 4 %, "
                         "actions mondiales 6 à 8 % (avec de fortes variations d'une année à l'autre).")
    years = d.slider("Durée (années)", 1, 40, 20)
    fees = st.slider("Frais annuels (%)", 0.0, 3.0, 0.5, 0.1,
                     help="Frais de gestion d'un contrat d'assurance vie, d'un fonds ou d'un ETF, retirés chaque année.")

    plan = sim.savings_plan(initial, monthly, rate, years, fees)
    final = plan.iloc[-1]
    without_fees = sim.savings_plan(initial, monthly, rate, years)["valeur"].iloc[-1]
    rule, exact = sim.doubling_time(rate - fees)
    kpis([
        ("Valeur finale", euros(final["valeur"]), f"au bout de {years} an{'s' if years > 1 else ''}"),
        ("Total versé", euros(final["versé"]), f"{euros(initial)} + {euros(monthly)} × {years * 12} mois"),
        ("Intérêts gagnés", euros(final["intérêts"]),
         f"{final['intérêts'] / final['valeur']:.0%} de la valeur finale" if final["valeur"] else "—"),
        ("Coût des frais", euros(without_fees - final["valeur"]), f"{theme.fr_number(fees, 1)} % par an"),
    ])
    long = plan.melt("année", value_vars=["versé", "intérêts"], var_name="part", value_name="montant")
    layer = alt.Chart(long).mark_area(opacity=0.85).encode(
        x=alt.X("année:Q", title="Années", axis=alt.Axis(tickMinStep=1, grid=False, domainOpacity=0.4)),
        y=alt.Y("montant:Q", title=None, stack="zero", axis=alt.Axis(format=",.0f", gridOpacity=0.18, domain=False)),
        color=alt.Color("part:N", scale=alt.Scale(domain=["versé", "intérêts"], range=[theme.NEUTRAL, BLUE]),
                        legend=alt.Legend(title=None, orient="top", labelExpr="datum.label == 'versé' ? "
                                          "'Sommes versées' : 'Intérêts composés'")),
        tooltip=[alt.Tooltip("année:Q", title="Année"), alt.Tooltip("part:N", title="Part"),
                 alt.Tooltip("montant:Q", title="Montant (€)", format=",.0f")],
    ).properties(height=300)
    chart(layer, "savings")
    if rate - fees > 0:
        st.caption(f"À {theme.fr_number(rate - fees, 1)} % net par an, un capital double en "
                   f"{theme.fr_number(exact, 1)} ans (règle de 72 : 72 ÷ {theme.fr_number(rate - fees, 1)} = "
                   f"{theme.fr_number(rule, 1)} ans). Les intérêts produisent eux-mêmes des intérêts : c'est l'effet "
                   "boule de neige des intérêts composés.")
    with st.expander("Voir le tableau année par année", icon=":material/table:"):
        st.dataframe(plan.set_index("année").round(0), column_config={
            col: st.column_config.NumberColumn(format="%.0f €") for col in ["versé", "intérêts", "valeur"]})


# --- Investissement programmé (DCA) ----------------------------------------------------------------


def dca_view() -> None:
    choices = DCA_ASSETS | {s: n for s, n in company_choices(current_user()).items() if s not in DCA_ASSETS}
    a, b, c = st.columns([1.4, 1, 1])
    symbol = a.selectbox("Actif", list(choices), format_func=lambda s: f"{choices[s]} · {s}")
    monthly = b.number_input("Chaque mois (€)", min_value=10, value=200, step=50)
    start_year = c.selectbox("Depuis", list(range(date.today().year - 1, 1999, -1)), index=9)

    closes = load_closes((symbol,), "max")
    if closes is None or closes.empty or symbol not in closes:
        st.warning("Historique indisponible pour le moment.", icon=":material/cloud_off:")
        return
    series = closes[symbol]
    table = sim.dollar_cost_averaging(series, monthly, f"{start_year}-01-01")
    if table.empty:
        st.info("Pas de cours sur cette période : choisis une date plus récente.")
        return
    first_day = table.index[0]
    invested, value = table["investi"].iloc[-1], table["valeur"].iloc[-1]
    lump = sim.lump_sum(series, invested, first_day)
    gain = value - invested
    kpis([
        ("Total investi", euros(invested), f"{int(invested // monthly)} achats depuis {theme.fr_day(first_day)} "
                                           f"{first_day.year}"),
        ("Valeur aujourd'hui", euros(value), theme.change(gain / invested * 100) + " au total"),
        ("Plus-value", theme.change(gain, "€", 0), "avant impôts et frais"),
        ("Tout investir au début", euros(lump), "même somme placée en une fois le premier jour"),
    ])
    monthly_table = table.resample("ME").last()  # un point par mois suffit pour le graphique
    year_step = 1 if date.today().year - start_year <= 12 else 2 if date.today().year - start_year <= 25 else 5
    long = monthly_table.reset_index(names="date").melt("date", value_vars=["investi", "valeur"],
                                                        var_name="série", value_name="montant")
    layer = alt.Chart(long).mark_line(strokeWidth=2).encode(
        x=alt.X("date:T", title=None, axis=alt.Axis(format="%Y", grid=False, labelAngle=0, domainOpacity=0.4,
                                                    tickCount={"interval": "year", "step": year_step})),
        y=alt.Y("montant:Q", title=None, axis=alt.Axis(format=",.0f", gridOpacity=0.18, domain=False)),
        color=alt.Color("série:N", scale=alt.Scale(domain=["investi", "valeur"], range=[theme.NEUTRAL, BLUE]),
                        legend=alt.Legend(title=None, orient="top", labelExpr="datum.label == 'investi' ? "
                                          "'Sommes investies' : 'Valeur du placement'")),
        tooltip=[alt.Tooltip("date:T", title="Mois", format="%m/%Y"), alt.Tooltip("série:N", title="Série"),
                 alt.Tooltip("montant:Q", title="Montant", format=",.0f")],
    ).properties(height=300)
    chart(layer, "dca")
    st.caption("Investissement programmé (« DCA ») : on investit la même somme chaque mois, quel que soit le cours. "
               "On achète plus de parts quand c'est bas, moins quand c'est haut, et on évite de devoir choisir le bon "
               "moment. Les indices (CAC 40, S&P 500, Nasdaq) sont ici hors dividendes : un fonds qui les réinvestit "
               "aurait fait mieux. Les actifs cotés en dollars sont simulés sans effet de change. Les performances "
               "passées ne préjugent pas des performances futures.")


# --- Crédit immobilier -----------------------------------------------------------------------------


def loan_view() -> None:
    a, b, c, d = st.columns(4)
    principal = a.number_input("Montant emprunté (€)", min_value=10_000, value=200_000, step=10_000)
    rate = b.number_input("Taux annuel (%)", min_value=0.0, max_value=15.0, value=3.5, step=0.05, format="%.2f")
    years = c.select_slider("Durée (années)", options=[7, 10, 12, 15, 20, 25], value=20)
    insurance = d.number_input("Assurance (% par an)", min_value=0.0, max_value=1.0, value=0.30, step=0.05,
                               format="%.2f", help="Taux annuel de l'assurance emprunteur, appliqué au capital emprunté.")
    income = st.number_input("Revenus nets du foyer, par mois (€)", min_value=0, value=4_000, step=100,
                             help="Pour calculer le taux d'endettement. Laisse 0 pour l'ignorer.")

    table = sim.amortization(principal, rate, years, insurance)
    payment = sim.loan_payment(principal, rate, years)
    monthly_insurance = principal * insurance / 100 / 12
    total_interest, total_insurance = table["intérêts"].sum(), table["assurance"].sum()
    items = [
        ("Mensualité", euros(payment + monthly_insurance),
         f"dont {theme.fr_number(monthly_insurance, 0)} € d'assurance"),
        ("Coût total du crédit", euros(total_interest + total_insurance),
         f"intérêts {euros(total_interest)} · assurance {euros(total_insurance)}"),
        ("Total remboursé", euros(principal + total_interest + total_insurance),
         f"{(total_interest + total_insurance) / principal:.0%} du montant emprunté"),
    ]
    if income:
        ratio = (payment + monthly_insurance) / income * 100
        verdict = "dans la limite de 35 %" if ratio <= 35 else "au-delà de la limite de 35 %"
        items.append(("Taux d'endettement", f"{theme.fr_number(ratio, 1)} %", verdict))
    kpis(items)

    long = table.melt("année", value_vars=["capital", "intérêts", "assurance"], var_name="part", value_name="montant")
    layer = alt.Chart(long).mark_bar().encode(
        x=alt.X("année:O", title="Année du crédit", axis=alt.Axis(labelAngle=0)),
        y=alt.Y("montant:Q", title=None, stack="zero", axis=alt.Axis(format=",.0f", gridOpacity=0.18, domain=False)),
        color=alt.Color("part:N", scale=alt.Scale(domain=["capital", "intérêts", "assurance"],
                                                  range=[BLUE, ORANGE, theme.NEUTRAL]),
                        legend=alt.Legend(title=None, orient="top")),
        order=alt.Order("part:N", sort="ascending"),
        tooltip=[alt.Tooltip("année:O", title="Année"), alt.Tooltip("part:N", title="Part"),
                 alt.Tooltip("montant:Q", title="Payé dans l'année (€)", format=",.0f")],
    ).properties(height=280)
    chart(layer, "loan")
    st.caption("Chaque mensualité est la même, mais sa composition change : au début, on paie surtout des intérêts "
               "(ils portent sur tout le capital restant dû) ; à la fin, surtout du capital.")

    if income:
        theme.section("Combien puis-je emprunter ?", "règle des 35 % du HCSF")
        rows = "".join(
            f"<tr><td>{duration} ans</td><td>{euros(sim.borrowing_capacity(income, rate, duration, insurance))}</td>"
            f"<td>{euros(income * 0.35)}</td></tr>"
            for duration in [15, 20, 25]
        )
        st.html(theme.table(["Durée", "Montant maximal", "Mensualité maximale"], rows))
        st.caption("En France, le Haut Conseil de stabilité financière demande aux banques de limiter la mensualité "
                   "(assurance comprise) à 35 % des revenus nets, sur 25 ans au plus. Simulation indicative.")
    with st.expander("Voir le tableau d'amortissement (par année)", icon=":material/table:"):
        st.dataframe(table.set_index("année").round(0), column_config={
            col: st.column_config.NumberColumn(format="%.0f €") for col in ["capital", "intérêts", "assurance",
                                                                             "restant dû"]})


# --- Inflation ----------------------------------------------------------------------------------


def inflation_view() -> None:
    macro_data, _ = load_macro(f"{date.today().year - 10}-01-01")
    latest = float(macro_data["infl_ea"].iloc[-1]) if "infl_ea" in macro_data else 2.0
    a, b, c = st.columns(3)
    amount = a.number_input("Somme (€)", min_value=0, value=10_000, step=1_000)
    inflation = b.slider("Inflation annuelle (%)", 0.0, 10.0, round(latest * 2) / 2, 0.5,
                         help=f"Par défaut, l'inflation actuelle de la zone euro ({theme.fr_number(latest, 1)} %).")
    years = c.slider("Durée (années)", 1, 40, 10, key="inflation_years")
    nominal = st.slider("Rendement de ton placement (%)", 0.0, 10.0, 3.0, 0.25,
                        help="Exemple : le taux d'un livret, d'un fonds en euros ou d'une obligation.")

    table = sim.purchasing_power(amount, inflation, years)
    after = table["pouvoir d'achat"].iloc[-1]
    real = real_rate(nominal, inflation)
    kpis([
        ("Pouvoir d'achat final", euros(after), f"en euros d'aujourd'hui, dans {years} ans"),
        ("Perte de pouvoir d'achat", theme.change((after / amount - 1) * 100 if amount else 0),
         f"il faudra {euros(amount * (1 + inflation / 100) ** years)} pour acheter la même chose"),
        ("Rendement réel du placement", theme.change(real), f"{theme.fr_number(nominal, 2)} % − inflation "
                                                             f"{theme.fr_number(inflation, 1)} % (Fisher)"),
    ])
    layer = alt.Chart(table).mark_line(strokeWidth=2, color=ORANGE).encode(
        x=alt.X("année:Q", title="Années", axis=alt.Axis(tickMinStep=1, grid=False, domainOpacity=0.4)),
        y=alt.Y("pouvoir d'achat:Q", title=None, scale=alt.Scale(zero=True),
                axis=alt.Axis(format=",.0f", gridOpacity=0.18, domain=False)),
        tooltip=[alt.Tooltip("année:Q", title="Année"),
                 alt.Tooltip("pouvoir d'achat:Q", title="Pouvoir d'achat (€)", format=",.0f")],
    ).properties(height=260)
    chart(layer, "inflation")
    st.caption("Un placement dont le rendement est inférieur à l'inflation fait perdre du pouvoir d'achat, même si "
               "son solde augmente : c'est le rendement réel qui compte.")


# --- La page ----------------------------------------------------------------------------------
theme.page_header("Simulateurs", "Épargne, investissement programmé, crédit immobilier, inflation : fais tes "
                  "calculs et vois l'effet de chaque paramètre. Simulations pédagogiques, sans conseil.",
                  eyebrow="Outils")
SIMULATORS = {"Épargne": savings_view, "Investissement programmé": dca_view, "Crédit immobilier": loan_view,
              "Inflation": inflation_view}
choice = st.segmented_control("Simulateur", list(SIMULATORS), default="Épargne", key="simulator",
                              label_visibility="collapsed")
SIMULATORS[choice or "Épargne"]()
