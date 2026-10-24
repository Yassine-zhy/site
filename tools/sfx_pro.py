"""Les bruitages enregistrés de la bande-annonce « TrailerPro » (video/src/TrailerPro.tsx), téléchargés depuis Mixkit.

Licence Mixkit (sons) : libres dans une vidéo, même commerciale, sans citer l'auteur, mais interdit de redistribuer les
fichiers seuls : ils ne sont donc pas dans le dépôt (video/.gitignore) ; ce script les télécharge et les prépare.

Pour chaque son : téléchargement, conversion en WAV 48 kHz stéréo, silence de tête retiré, extrait éventuel, crête
ramenée à -1 dBFS, fondus de 5 ms. Le script affiche ensuite, pour chaque son, sa durée et l'instant de sa crête (en images
à 60 im/s) : TrailerPro.tsx s'en sert pour que le sommet d'un souffle tombe pile sur la coupe.

    python tools/sfx_pro.py          # depuis finveille/, quelques dizaines de secondes
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
import urllib.request
import wave
from pathlib import Path

import numpy as np

OUT = Path(__file__).resolve().parent.parent / "video" / "public" / "sfx-pro"
URL = "https://assets.mixkit.co/active_storage/sfx/{id}/{id}-preview.mp3"

# nom : (numéro Mixkit, titre Mixkit, début de l'extrait en s, durée de l'extrait en s ; None = tout)
SOUNDS: dict[str, tuple[int, str, float, float | None]] = {
    "logo_appear": (2350, "Magic sparkle whoosh", 0, None),
    "logo_click": (3124, "Modern technology select", 0, None),
    "app_open": (2608, "Air zoom vacuum", 0, None),
    "tr_actu_marches": (1492, "Cinematic whoosh fast transition", 0, None),
    "tr_marches_eco": (166, "Fast small sweep transition", 0, None),
    "tr_eco_outils": (772, "Quick zoom impact", 0, None),
    "tr_outils_partout": (3120, "Technology transition slide", 0, None),
    "tr_partout_fin": (2903, "Movie whoosh impact presentation", 0, None),
    "fil_swirl": (1493, "Swirling whoosh", 0, None),
    "fil_pop": (3005, "Explainer video pops whoosh light pop", 0, None),
    "card_click": (1124, "Plastic bubble click", 0, None),
    "heatmap_sweep": (3115, "Fast transitions swoosh", 0, None),
    "data_tone": (2866, "Digital quick tone", 0, None),
    "tile_check": (1120, "Modern click box check", 0, None),
    "eco_sweep": (2638, "Magic transition sweep presentation", 0, None),
    "coins": (1993, "Clinking coins", 0, 1.6),
    "typing": (1387, "Fast keyboard typing", 2.0, 1.3),
    "send": (2573, "Interface option select", 0, None),
    "answer": (911, "Interface hint notification", 0, None),
    "bell": (933, "Bell notification", 0, None),
    "alert2": (2356, "Dry pop up notification alert", 0, None),
    "tools_sweep": (168, "Fast air sweep transition", 0, None),
    "portfolio_ok": (951, "Positive notification", 0, None),
    "device_sweep": (2639, "Quick metal transition sweep", 0, None),
    "theme_switch": (2585, "On or off light switch tap", 0, None),
    "tile_tick": (2577, "Interface device click", 0, None),
    "riser": (790, "Cinematic trailer riser", 0, None),
    "fly_away": (1471, "Cinematic wind swoosh", 0, None),
    "logo_sting": (2574, "Software interface start", 0, None),
    "final_hit": (498, "Deep heartbeat impact", 0, None),
}


def ffmpeg(*args: str) -> None:
    subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True)


def read(path: Path) -> np.ndarray:
    with wave.open(str(path)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).reshape(-1, 2).astype(np.float64) / 32768


def write(path: Path, x: np.ndarray) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2), w.setsampwidth(2), w.setframerate(48000)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


def prepare(name: str, sid: int, start: float, length: float | None, tmp: Path) -> tuple[float, int]:
    mp3 = tmp / f"{sid}.mp3"
    urllib.request.urlretrieve(URL.format(id=sid), mp3)
    raw = tmp / f"{name}.wav"
    cut = ["-ss", str(start)] + (["-t", str(length)] if length else [])
    ffmpeg("-i", str(mp3), *cut, "-af", "silenceremove=start_periods=1:start_threshold=-50dB", "-ar", "48000", "-ac", "2",
           str(raw))
    x = read(raw)
    x *= 10 ** (-1 / 20) / max(np.abs(x).max(), 1e-9)  # crête à -1 dBFS
    fade = 240  # 5 ms
    x[:fade] *= np.linspace(0, 1, fade)[:, None]
    x[-fade:] *= np.linspace(1, 0, fade)[:, None]
    write(OUT / f"{name}.wav", x)
    env = np.abs(x).max(1)
    peak = int(np.argmax(np.convolve(env, np.ones(480) / 480, "same")))  # crête de l'enveloppe lissée (10 ms)
    return len(x) / 48000, round(peak / 48000 * 60)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    print("// nom : [durée en images, crête en images] (60 im/s)")
    with tempfile.TemporaryDirectory() as t:
        for name, (sid, title, start, length) in SOUNDS.items():
            seconds, peak = prepare(name, sid, start, length, Path(t))
            print(f'  {name}: [{round(seconds * 60)}, {peak}],  // {title} ({seconds:.2f} s)')
    sys.stdout.flush()


if __name__ == "__main__":
    main()
