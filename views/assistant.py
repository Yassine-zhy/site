"""Page « Assistant IA » : des questions en langage courant sur l'actualité, les marchés et la finance ; des
réponses qui citent les dépêches du moment (core/assistant.py)."""

from pathlib import Path

import streamlit as st

import theme
from core import assistant
from ui import (
    ai_count,
    ai_keys,
    ai_quota,
    api_keys,
    current_user,
    load_articles,
    load_quotes,
    local_mode,
    stream_ai,
)

LOGO = str(Path(__file__).parent.parent / "assets" / "logo.svg")
SUGGESTIONS = [
    "Que s'est-il passé sur les marchés aujourd'hui ?",
    "Où en est l'inflation en zone euro ?",
    "Quelles sont les dernières nouvelles sur le bitcoin ?",
    "Que fait la Fed en ce moment ?",
    "Explique-moi ce qu'est le PER",
    "Qu'est-ce qui fait bouger le pétrole ?",
]

user = current_user()
articles, _, collected_at = load_articles(api_keys())
engines = assistant.available_engines(ai_keys())
history: list[dict] = st.session_state.setdefault("fv_chat", [])


def ask(question: str) -> None:
    st.session_state["fv_chat_pending"] = question


def new_conversation() -> None:
    st.session_state["fv_chat"] = []


def show_turn(turn: dict) -> None:
    """Un message de la conversation : la question, ou la réponse avec ses sources."""
    if turn["role"] == "user":
        with st.chat_message("user", avatar=":material/person:"):
            st.markdown(turn["content"].replace("$", "\\$"))
        return
    with st.chat_message("assistant", avatar=LOGO):
        sources = [assistant.Source(**s) for s in turn["sources"]]
        st.markdown(assistant.linkify(turn["content"], sources))
        show_sources(turn)


def show_sources(turn: dict) -> None:
    sources = [assistant.Source(**s) for s in turn["sources"]]
    shown = assistant.cited(turn["content"], sources) if turn["engine"] != "Sans IA" else sources
    if shown:
        st.html(theme.sources_html([s.to_dict() for s in shown],
                                   "Sources citées" if turn["engine"] != "Sans IA" else "Dépêches trouvées"))
    caption = {"Sans IA": "Recherche dans les dépêches et le glossaire, sans IA"}.get(turn["engine"],
                                                                                    f"Rédigé par {turn['engine']}")
    if turn.get("cached"):
        caption += " · réponse déjà préparée pour une question identique"
    if turn.get("note"):
        caption += f" · {turn['note']}"
    st.caption(caption + ". Pas un conseil en investissement : vérifie dans les articles.")


def answer(question: str) -> dict:
    """Prépare, puis affiche la réponse au fur et à mesure ; renvoie le message à garder dans la conversation."""
    model_history = [{"role": t["role"], "content": t["content"]} for t in history]
    prepared = assistant.prepare(question, model_history, articles, load_quotes())
    sources = [s.to_dict() for s in prepared.sources]
    turn = {"role": "assistant", "sources": sources, "engine": "Sans IA", "content": "", "note": None}
    with st.chat_message("assistant", avatar=LOGO):
        if engines:
            # La même question, en début de conversation, sur les mêmes dépêches : on ressert la réponse en mémoire
            key = assistant.cache_key("chat", question, prepared.sources) if not history else None
            if key and (cached := assistant.CACHE.get(key)):
                turn |= {"content": cached["text"], "engine": cached["engine"], "cached": True}
                st.markdown(assistant.linkify(cached["text"], prepared.sources))
            else:
                left, _ = ai_quota(user)
                if left == 0:
                    turn["note"] = "quota de questions à l'IA atteint pour aujourd'hui"
                else:
                    with st.spinner("Lecture des dépêches…"):
                        placeholder = st.empty()
                        result = stream_ai(prepared.messages, prepared.sources, placeholder)
                    if result["text"]:
                        ai_count(user)
                        turn |= {"content": result["text"], "engine": result["engine"], "note": result["note"]}
                        if key and not result["note"]:
                            assistant.CACHE.put(key, {"text": result["text"], "engine": result["engine"]})
                    else:
                        placeholder.empty()
                        turn["note"] = result["note"]
        if not turn["content"]:  # sans IA (pas de clé, quota, panne) : la recherche dans les dépêches
            turn["content"] = assistant.offline_answer(prepared)
            turn["engine"] = "Sans IA"
            st.markdown(turn["content"].replace("$", "\\$"))
        show_sources(turn)
    return turn


# --- La page ----------------------------------------------------------------------------------------
theme.page_header("Pose ta question,", "En français, sur l'actualité, les marchés ou un terme financier : l'assistant "
                  "répond à partir des dépêches du moment.", eyebrow="Assistant IA", accent="l'IA cite ses sources.")

# st.chat_input reste en bas de l'écran, où qu'on l'appelle : on le lit d'abord, pour savoir quoi afficher
question = st.chat_input("Pose ta question : « Pourquoi le pétrole monte ? », « C'est quoi un ETF ? »…",
                         max_chars=assistant.MAX_QUESTION_CHARS)
question = question or st.session_state.pop("fv_chat_pending", None)

if not history and not question:
    st.html(theme.assistant_hero_html(" puis ".join(engines) if engines else None, len(articles)))
    theme.section("Pour commencer")
    with st.container(horizontal=True, gap="small", key="fvsuggest"):
        for number, suggestion in enumerate(SUGGESTIONS):
            st.button(suggestion, key=f"suggest_{number}", on_click=ask, args=(suggestion,))
    if not engines:
        st.caption("Pour des réponses rédigées, ajoute une clé gratuite GEMINI_API_KEY ou GROQ_API_KEY dans les "
                   "secrets (guide 24). En attendant, l'assistant cherche dans les dépêches et le glossaire.")

for turn in history:
    show_turn(turn)
if question:
    show_turn({"role": "user", "content": question})
    reply = answer(question)
    history += [{"role": "user", "content": question}, reply]

if history:
    with st.container(horizontal=True, gap="small", vertical_alignment="center"):
        st.button("Nouvelle conversation", icon=":material/add_comment:", on_click=new_conversation)
        if engines and not local_mode():
            left, limit = ai_quota(user)
            st.caption(f"{left} question{'s' if left > 1 else ''} à l'IA sur {limit} "
                       f"{'aujourd’hui' if user else 'pour cette visite : connecte-toi pour en avoir plus'}.")
