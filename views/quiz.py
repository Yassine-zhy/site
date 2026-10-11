"""Page « Quiz » : tester son vocabulaire de la finance à partir du glossaire."""

import random

import streamlit as st

import theme
from core import storage
from core.glossary import GLOSSARY, SECTIONS
from core.quiz import make_quiz, verdict
from theme import esc
from ui import current_user, end_page

user = current_user()  # None : visiteur non connecté (il joue, mais son meilleur score n'est pas enregistré)
state = st.session_state


def start(count: int, sections: list[str]) -> None:
    """Callback « Commencer » : un nouveau quiz, tiré au hasard."""
    state.quiz = make_quiz(count, seed=random.randrange(1_000_000), sections=sections or None)
    state.quiz_index, state.quiz_answers = 0, []


def answer(choice: str) -> None:
    state.quiz_answers.append(choice)


def next_question() -> None:
    state.quiz_index += 1
    if state.quiz_index == len(state.quiz) and user:  # fin du quiz : on garde le meilleur score
        score = sum(given == q.answer for given, q in zip(state.quiz_answers, state.quiz))
        best = storage.get_setting(user, "quiz_best", {"score": 0, "total": 0})
        if best["total"] == 0 or score / len(state.quiz) > best["score"] / best["total"]:
            storage.set_setting(user, "quiz_best", {"score": score, "total": len(state.quiz)})
        storage.set_setting(user, "quiz_played", storage.get_setting(user, "quiz_played", 0) + 1)


def restart() -> None:
    for key in ("quiz", "quiz_index", "quiz_answers"):
        state.pop(key, None)


theme.page_header("Teste ton vocabulaire", f"Teste ton vocabulaire de la finance : une définition, quatre propositions. "
                  f"{len(GLOSSARY)} termes à découvrir.", eyebrow="Quiz", accent="de la finance.", art="quiz")

# --- Écran d'accueil -------------------------------------------------------------------------------
if "quiz" not in state:
    with st.container(key="fvbox_quizstart", width=560):
        st.html('<h3 class="fv-box-title">Nouveau quiz</h3><p class="fv-box-text">Choisis les rubriques (aucune = '
                "toutes) et le nombre de questions.</p>")
        sections = st.pills("Rubriques", SECTIONS, selection_mode="multi", label_visibility="collapsed")
        count = st.segmented_control("Nombre de questions", [5, 10, 15], default=10,
                                     format_func=lambda n: f"{n} questions")
        st.button("Commencer", type="primary", icon=":material/play_arrow:", on_click=start,
                  args=(count or 10, sections), width="stretch")
        if user:
            best = storage.get_setting(user, "quiz_best")
            played = storage.get_setting(user, "quiz_played", 0)
            if best:
                st.caption(f"Ton meilleur score : {best['score']}/{best['total']} · {played} quiz joué(s).")
        else:
            st.caption("Connecte-toi pour enregistrer ton meilleur score.")
    end_page()

quiz, index, answers = state.quiz, state.quiz_index, state.quiz_answers

# --- Résultats -------------------------------------------------------------------------------------
if index >= len(quiz):
    score = sum(given == q.answer for given, q in zip(answers, quiz))
    st.html(
        '<div class="fv-kpis">'
        f'<div class="fv-kpi"><div class="fv-kpi-label">Ton score</div>'
        f'<div class="fv-kpi-value">{score} / {len(quiz)}</div><div class="fv-kpi-sub">{esc(verdict(score, len(quiz)))}'
        "</div></div></div>"
    )
    mistakes = [(given, q) for given, q in zip(answers, quiz) if given != q.answer]
    if mistakes:
        theme.section("À revoir", f"{len(mistakes)} erreur{'s' if len(mistakes) > 1 else ''}")
        items = "".join(
            f"<dt>{esc(q.answer)}<small>{esc(q.section)}</small></dt>"
            f"<dd>{esc(GLOSSARY[q.answer][1])}<br><span class='fv-quiz-wrong'>Ta réponse : {esc(given)}</span></dd>"
            for given, q in mistakes
        )
        st.html(theme.card(f'<dl class="fv-gloss">{items}</dl>'))
    st.button("Rejouer", type="primary", icon=":material/replay:", on_click=restart)
    end_page()

# --- Une question ----------------------------------------------------------------------------------
question = quiz[index]
answered = len(answers) > index
st.progress(index / len(quiz), text=f"Question {index + 1} sur {len(quiz)} · {question.section}")
st.html(f'<section class="fv-card fv-quiz-question"><small>Quel terme correspond à cette définition ?</small>'
        f"<p>{esc(question.definition)}</p></section>")

columns = st.columns(2)
for position, choice in enumerate(question.choices):
    with columns[position % 2]:
        if not answered:
            st.button(choice, key=f"choice_{index}_{position}", on_click=answer, args=(choice,), width="stretch")
        else:
            # Après la réponse : la bonne en vert, la mauvaise choisie en rouge (avec ✓ et ✗ : pas la couleur seule)
            kind = "is-right" if choice == question.answer else "is-wrong" if choice == answers[index] else ""
            mark = "✓ " if kind == "is-right" else "✗ " if kind == "is-wrong" else ""
            st.html(f'<div class="fv-quiz-choice {kind}">{mark}{esc(choice)}</div>')

if answered:
    correct = answers[index] == question.answer
    st.html(f'<p class="fv-quiz-feedback {"is-right" if correct else "is-wrong"}">'
            + ("Bonne réponse !" if correct else f"Raté : la bonne réponse était « {esc(question.answer)} ».")
            + "</p>")
    last = index + 1 == len(quiz)
    st.button("Voir mon score" if last else "Question suivante", type="primary",
              icon=":material/flag:" if last else ":material/arrow_forward:", on_click=next_question)
st.button("Abandonner ce quiz", type="tertiary", on_click=restart)
