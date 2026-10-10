"""Test de charge : simule des dizaines de visiteurs qui ouvrent FinVeille en même temps.

Chaque « visiteur virtuel » parle à Streamlit comme un navigateur : il ouvre la connexion WebSocket
(/_stcore/stream), demande l'affichage d'une page, puis attend la fin du script (message « script_finished »).
On mesure le temps d'affichage, les erreurs, et la mémoire du serveur. Un navigateur complet (Playwright) coûte
150 Mo par visiteur ; un visiteur virtuel, quelques kilo-octets : on peut en lancer des centaines.

Usage, l'appli tournant dans un autre terminal (streamlit run app.py) :
    python tools/load_test.py --visitors 50                 # 50 visiteurs sur l'accueil, en même temps
    python tools/load_test.py --visitors 100 --pages markets brief assistant --pid 12345
    python tools/load_test.py --visitors 200 --ramp 20 --hold 30

--pid : numéro du processus Streamlit (commande `pgrep -f "streamlit run"`), pour mesurer sa mémoire.
--ramp : étale les arrivées sur N secondes (plus réaliste qu'une arrivée simultanée).
--hold : garde les sessions ouvertes N secondes après l'affichage (des visiteurs qui lisent la page).
"""

from __future__ import annotations

import argparse
import asyncio
import random
import statistics
import time
from pathlib import Path

import websockets
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg

FINISHED = {"FINISHED_SUCCESSFULLY", "FINISHED_EARLY_FOR_RERUN"}


def rss_mb(pid: int | None) -> float | None:
    """Mémoire réellement occupée par le processus (Linux : /proc/<pid>/status, ligne VmRSS)."""
    if not pid:
        return None
    try:
        for line in Path(f"/proc/{pid}/status").read_text().splitlines():
            if line.startswith("VmRSS:"):
                return int(line.split()[1]) / 1024
    except OSError:
        return None
    return None


async def visit(host: str, page: str, hold: float, timeout: float) -> dict:
    """Un visiteur : connexion, affichage d'une page, attente de la fin du script. Renvoie ses mesures."""
    start = time.perf_counter()
    result = {"page": page or "accueil", "ok": False, "seconds": None, "exceptions": 0, "error": None}
    try:
        async with websockets.connect(f"ws://{host}/_stcore/stream", subprotocols=["streamlit"],
                                      origin=f"http://{host}", max_size=None, open_timeout=timeout,
                                      ping_interval=None) as ws:  # comme un navigateur : pas de « ping »
            message = BackMsg()
            message.rerun_script.query_string = ""
            message.rerun_script.page_name = page  # « markets », « brief »… ; vide = la page d'accueil
            await ws.send(message.SerializeToString())
            while True:
                data = await asyncio.wait_for(ws.recv(), timeout=timeout)
                forward = ForwardMsg()
                forward.ParseFromString(data)
                kind = forward.WhichOneof("type")
                if kind == "delta" and forward.delta.WhichOneof("type") == "new_element":
                    if forward.delta.new_element.WhichOneof("type") == "exception":
                        result["exceptions"] += 1
                elif kind == "script_finished":
                    status = ForwardMsg.ScriptFinishedStatus.Name(forward.script_finished)
                    if status.startswith("FINISHED_FRAGMENT"):
                        continue  # un fragment (bandeau des cours) qui se rafraîchit : on attend le script complet
                    result["ok"] = status in FINISHED and not result["exceptions"]
                    result["status"] = status
                    break
            result["seconds"] = time.perf_counter() - start
            if hold:
                await asyncio.sleep(hold)  # le visiteur lit la page : sa session reste ouverte
    except (OSError, asyncio.TimeoutError, websockets.WebSocketException) as error:
        result["error"] = type(error).__name__
    return result


async def run(args) -> list[dict]:
    async def delayed(n: int) -> dict:
        if args.ramp:
            await asyncio.sleep(random.uniform(0, args.ramp))
        return await visit(args.host, args.pages[n % len(args.pages)], args.hold, args.timeout)

    return await asyncio.gather(*(delayed(n) for n in range(args.visitors)))


def percentile(values: list[float], share: float) -> float:
    values = sorted(values)
    return values[min(int(share * len(values)), len(values) - 1)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--host", default="localhost:8501")
    parser.add_argument("--visitors", type=int, default=20)
    parser.add_argument("--pages", nargs="*", default=[""], help="noms de pages (markets, brief…) ; vide = accueil")
    parser.add_argument("--ramp", type=float, default=0, help="arrivées étalées sur N secondes")
    parser.add_argument("--hold", type=float, default=0, help="secondes passées sur la page après l'affichage")
    parser.add_argument("--timeout", type=float, default=120)
    parser.add_argument("--pid", type=int, help="processus Streamlit, pour mesurer sa mémoire")
    args = parser.parse_args()
    args.pages = args.pages or [""]

    before = rss_mb(args.pid)
    started = time.perf_counter()
    results = asyncio.run(run(args))
    elapsed = time.perf_counter() - started
    after = rss_mb(args.pid)

    times = [r["seconds"] for r in results if r["ok"]]
    failures = [r for r in results if not r["ok"]]
    print(f"{args.visitors} visiteurs · pages : {', '.join(p or 'accueil' for p in args.pages)} · "
          f"durée totale {elapsed:.1f} s")
    print(f"  réussis : {len(times)} / {len(results)}")
    if times:
        print(f"  temps d'affichage : médian {statistics.median(times):.2f} s · 95 % en moins de "
              f"{percentile(times, 0.95):.2f} s · le plus long {max(times):.2f} s")
    if failures:
        reasons = {}
        for failure in failures:
            reason = failure["error"] or failure.get("status") or f"{failure['exceptions']} exception(s)"
            reasons[reason] = reasons.get(reason, 0) + 1
        print(f"  échecs : {reasons}")
    if before is not None and after is not None:
        print(f"  mémoire du serveur : {before:.0f} Mo avant, {after:.0f} Mo après "
              f"(+{(after - before) / max(args.visitors, 1):.1f} Mo par visiteur)")


if __name__ == "__main__":
    main()
