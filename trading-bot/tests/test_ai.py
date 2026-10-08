"""Tests du mode IA avec un faux client Anthropic : aucun appel réel, aucun coût."""

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import anthropic
import httpx2
import pytest

from ai_advisor import ClaudeAdvisor, build_market_context
from config import AISettings, ConfigError, load_settings
from strategy import add_indicators

from conftest import FakeExchange, make_bot, make_ohlcv, make_settings, uptrend_with_pullback

API_REQUEST = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")


def usage(searches=2):
    return SimpleNamespace(input_tokens=20_000, output_tokens=2_000, cache_creation_input_tokens=0,
                           cache_read_input_tokens=0,
                           server_tool_use=SimpleNamespace(web_search_requests=searches, web_fetch_requests=0))


def decision(action, confidence=80, size=100, reasoning="Raison de test.", news="aucune"):
    block = SimpleNamespace(type="tool_use", name="submit_decision", id="toolu_1",
                            input={"action": action, "confidence": confidence, "position_size_pct": size,
                                   "reasoning": reasoning, "news_summary": news})
    return SimpleNamespace(stop_reason="tool_use", content=[block], usage=usage())


class FakeMessages:
    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = []

    def create(self, **params):
        self.calls.append(params)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


class FakeAnthropic:
    def __init__(self, *replies):
        self.beta = SimpleNamespace(messages=FakeMessages(replies))

    @property
    def calls(self):
        return self.beta.messages.calls


@pytest.fixture
def candles():
    return make_ohlcv(uptrend_with_pullback()[:310])


def ai_bot(tmp_path, candles, client, **ai_overrides):
    settings = make_settings(tmp_path, strategy_mode="ai", ai=AISettings(**ai_overrides))
    fake = FakeExchange(candles)
    return make_bot(settings, fake, ClaudeAdvisor(settings, client)), fake


def test_request_shape_and_scaled_buy(tmp_path, candles):
    client = FakeAnthropic(decision("BUY", confidence=80, size=50))
    bot, _ = ai_bot(tmp_path, candles, client)
    bot.run_cycle()

    params = client.calls[0]
    assert params["model"] == "claude-opus-5-5"
    assert params["output_config"] == {"effort": "medium"}
    assert params["fallbacks"] == "default" and params["betas"] == ["server-side-fallback-2026-07-01"]
    assert params["tools"][0] == {"type": "web_search_20260209", "name": "web_search", "max_uses": 3}
    assert params["tools"][1]["name"] == "submit_decision" and params["tools"][1]["strict"] is True
    assert "tool_choice" not in params      # le choix forcé d'outil est refusé par ce modèle
    context = params["messages"][0]["content"]
    assert "Prix actuel" in context and "Position : aucune" in context

    # 50 % de la taille maximale (50 % du solde) = 25 % de 100 USDT
    assert bot.state["in_position"]
    assert bot.state["entry_cost"] == pytest.approx(25, abs=0.01)
    assert bot.state["ai_calls_count"] == 1
    assert bot.state["ai_cost_total"] == pytest.approx(0.08 + 0.04 + 0.02)
    assert bot.state["ai_history"][0]["action"] == "BUY"


def test_low_confidence_is_ignored(tmp_path, candles):
    bot, _ = ai_bot(tmp_path, candles, FakeAnthropic(decision("BUY", confidence=40)))
    bot.run_cycle()
    assert not bot.state["in_position"]


def test_not_consulted_again_before_interval(tmp_path, candles):
    client = FakeAnthropic(decision("HOLD"))
    bot, _ = ai_bot(tmp_path, candles, client)
    bot.run_cycle()
    bot._next_analysis = 0
    bot.run_cycle()
    assert len(client.calls) == 1


def test_consulted_early_when_price_moves(tmp_path, candles):
    client = FakeAnthropic(decision("HOLD"), decision("HOLD"))
    bot, fake = ai_bot(tmp_path, candles, client)
    bot.run_cycle()
    fake.price *= 1.035                      # +3,5 % : au-delà du seuil de 3 %
    bot._next_analysis = 0
    bot.run_cycle()
    assert len(client.calls) == 2


def test_consulted_again_after_interval(tmp_path, candles):
    client = FakeAnthropic(decision("HOLD"), decision("HOLD"))
    bot, _ = ai_bot(tmp_path, candles, client)
    bot.run_cycle()
    past = datetime.now(timezone.utc) - timedelta(minutes=241)
    bot.state["ai_last_call"] = past.isoformat()
    bot._next_analysis = 0
    bot.run_cycle()
    assert len(client.calls) == 2


def test_daily_cap(tmp_path, candles):
    client = FakeAnthropic(decision("BUY"))
    bot, _ = ai_bot(tmp_path, candles, client, max_calls_per_day=2)
    bot.state["ai_calls_day"] = datetime.now(timezone.utc).date().isoformat()
    bot.state["ai_calls_count"] = 2
    bot.run_cycle()
    assert client.calls == [] and not bot.state["in_position"]


def test_pause_turn_is_resumed(tmp_path, candles):
    paused = SimpleNamespace(stop_reason="pause_turn",
                             content=[SimpleNamespace(type="server_tool_use", name="web_search", id="srv_1")],
                             usage=usage(1))
    client = FakeAnthropic(paused, decision("BUY"))
    bot, _ = ai_bot(tmp_path, candles, client)
    bot.run_cycle()
    assert len(client.calls) == 2
    assert client.calls[1]["messages"][-1] == {"role": "assistant", "content": paused.content}
    assert bot.state["in_position"]


def test_refusal_means_hold(tmp_path, candles):
    refusal = SimpleNamespace(stop_reason="refusal", content=[], usage=usage(0))
    bot, _ = ai_bot(tmp_path, candles, FakeAnthropic(refusal))
    bot.run_cycle()
    assert not bot.state["in_position"]


def test_ai_sell_closes_position(tmp_path, candles):
    bot, fake = ai_bot(tmp_path, candles, FakeAnthropic(decision("BUY"), decision("SELL", confidence=75)))
    bot.run_cycle()
    assert bot.state["in_position"]
    fake.price *= 1.04                       # +4 % : consultation anticipée, sans toucher le take-profit
    bot._next_analysis = 0
    bot.run_cycle()
    assert not bot.state["in_position"] and bot.state["trades"] == 1


def test_bad_key_disables_ai_but_stop_loss_still_works(tmp_path, candles):
    error = anthropic.AuthenticationError("invalid x-api-key", response=httpx2.Response(401, request=API_REQUEST),
                                          body=None)
    client = FakeAnthropic(decision("BUY"), error)
    bot, fake = ai_bot(tmp_path, candles, client)
    bot.run_cycle()
    fake.price *= 1.05                       # consultation anticipée -> clé refusée
    bot._next_analysis = 0
    bot.run_cycle()
    assert bot._ai_disabled and bot.state["in_position"]
    fake.price = bot.state["entry_price"] * 0.96
    bot.run_cycle()                          # le stop-loss reste appliqué par le code
    assert not bot.state["in_position"]


def test_network_error_retries_at_next_analysis(tmp_path, candles):
    client = FakeAnthropic(anthropic.APIConnectionError(request=API_REQUEST), decision("BUY"))
    bot, _ = ai_bot(tmp_path, candles, client)
    bot.run_cycle()
    assert not bot.state["in_position"] and bot.state["ai_last_call"] is None
    bot._next_analysis = 0
    bot.run_cycle()
    assert bot.state["in_position"]


def test_cheaper_model_uses_basic_search_without_fallback(tmp_path, candles):
    client = FakeAnthropic(decision("HOLD"))
    bot, _ = ai_bot(tmp_path, candles, client, model="claude-haiku-5-5")
    bot.run_cycle()
    params = client.calls[0]
    assert params["tools"][0]["type"] == "web_search_20250305"
    assert "fallbacks" not in params


def test_market_context_describes_position(tmp_path, candles):
    from strategy import ohlcv_to_dataframe
    settings = make_settings(tmp_path, strategy_mode="ai")
    df = add_indicators(ohlcv_to_dataframe(candles), settings.strategy)
    state = {"in_position": True, "entry_price": 300.0, "amount": 0.1, "entry_time": "2024-01-05T08:00:00+00:00",
             "ai_history": [{"time": "2024-01-05 08:00 UTC", "price": 300.0, "action": "BUY",
                             "confidence": 70, "reasoning": "test"}]}
    text = build_market_context(df, 309.0, state, settings, (50.0, 0.1))
    assert "Position ouverte" in text and "+3.00 %" in text
    assert "stop-loss à 291.00" in text and "take-profit à 324.00" in text
    assert "Tes dernières décisions" in text and "Clôtures journalières" in text


def test_ai_strategy_requires_anthropic_key(monkeypatch):
    monkeypatch.setattr("config.load_dotenv", lambda *_a, **_k: None)
    monkeypatch.setenv("STRATEGY", "ai")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(ConfigError, match="ANTHROPIC_API_KEY"):
        load_settings()
