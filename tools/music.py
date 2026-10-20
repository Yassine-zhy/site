"""La musique de la bande-annonce (guide 33), composée par le code : aucun morceau sous droits, rien à télécharger.

Un morceau électronique calme, à 120 battements par minute : une mesure dure 2 secondes, soit 60 images de la vidéo.
Les scènes du montage (video/src/Trailer.tsx) commencent toutes sur une mesure : chaque coupe tombe sur un temps fort.
Le plan des mesures ci-dessous suit les scènes : l'ouverture sans batterie, l'entrée du logo sur un impact, le récit
avec le rythme complet, une montée avant la fin, puis la signature sur un dernier accord qui s'éteint.

Depuis le dossier finveille/ :
    python tools/music.py                     # écrit video/public/music.mp3 (il faut numpy, scipy et ffmpeg)
"""

import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np
from scipy import signal

SR = 48_000
BPM = 120
BEAT = 60 / BPM            # 0,5 s
BAR = 4 * BEAT             # 2 s
OUT = Path(__file__).resolve().parent.parent / "video" / "public" / "music.mp3"

# Les scènes, en mesures (elles doivent suivre SCENES dans video/src/Trailer.tsx)
PLAN = [("open", 2), ("brand", 2), ("story", 6), ("movers", 2), ("feed", 2), ("markets", 3), ("crypto", 2),
        ("ai", 2), ("outro", 3)]
BARS = sum(bars for _, bars in PLAN)
START = {}
_at = 0
for _name, _bars in PLAN:
    START[_name] = _at
    _at += _bars

# Ré mineur : i – VI – III – VII, un accord par mesure (fréquences des notes MIDI)
CHORDS = [[50, 57, 60, 64, 65], [46, 53, 57, 62, 65], [53, 57, 60, 64, 69], [48, 55, 60, 62, 67]]
hz = lambda note: 440 * 2 ** ((note - 69) / 12)
rng = np.random.default_rng(33)
N = int((BARS * BAR + 3) * SR)   # 3 s de queue pour la réverbération


def t_of(bar: float, beat: float = 0) -> int:
    return int((bar * BAR + beat * BEAT) * SR)


def saw(freq: float, n: int, phase0: float = 0) -> np.ndarray:
    """Une dent de scie sans repliement (polyBLEP)."""
    dt = freq / SR
    ph = (phase0 + dt * np.arange(n)) % 1
    out = 2 * ph - 1
    lo, hi = ph < dt, ph > 1 - dt
    x = ph[lo] / dt
    out[lo] -= x + x - x * x - 1
    x = (ph[hi] - 1) / dt
    out[hi] -= x * x + x + x + 1
    return out


def lowpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    return signal.sosfilt(signal.butter(order, cutoff, "low", fs=SR, output="sos"), x)


def highpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    return signal.sosfilt(signal.butter(order, cutoff, "high", fs=SR, output="sos"), x)


def bandpass(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return signal.sosfilt(signal.butter(2, [lo, hi], "band", fs=SR, output="sos"), x)


def env(n: int, attack: float, decay: float) -> np.ndarray:
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def place(track: np.ndarray, sound: np.ndarray, at: int, gain: float = 1.0) -> None:
    end = min(len(track), at + len(sound))
    if at < end:
        track[at:end] += sound[:end - at] * gain


# --- Les instruments --------------------------------------------------------------------------------------------
def kick() -> np.ndarray:
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    freq = 45 + 110 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.22)
    click = highpass(rng.standard_normal(n), 2000) * np.exp(-t / 0.004) * 0.25
    return body + click


def hat(open_: bool = False) -> np.ndarray:
    n = int((0.25 if open_ else 0.08) * SR)
    return highpass(rng.standard_normal(n), 7000, 4) * env(n, 0.001, 0.09 if open_ else 0.025)


def clap() -> np.ndarray:
    n = int(0.35 * SR)
    noise = bandpass(rng.standard_normal(n), 900, 3200)
    shape = np.zeros(n)
    for k, delay in enumerate((0, 0.011, 0.022)):   # trois mains presque ensemble
        i = int(delay * SR)
        shape[i:] += env(n - i, 0.0005, 0.012 if k < 2 else 0.16)
    return noise * shape * 0.8


def pluck(freq: float, length: float = 0.35) -> np.ndarray:
    n = int(length * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(4 * np.pi * freq * t) + 0.12 * np.sin(6 * np.pi * freq * t)
    return tone * env(n, 0.002, 0.11)


def impact() -> np.ndarray:
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 60 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.9)
    crash = lowpass(rng.standard_normal(n), 5000) * env(n, 0.001, 0.45) * 0.3
    return boom + crash


def riser(length: float) -> np.ndarray:
    n = int(length * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    for k in range(8):   # un souffle dont le filtre monte, par tranches
        a, b = k * n // 8, (k + 1) * n // 8
        centre = 400 * 2 ** (k * 0.7)
        out[a:b] = bandpass(noise[a:b], centre * 0.7, min(centre * 1.4, SR / 2 - 100))
    return out * (t / length) ** 2


# --- La partition ------------------------------------------------------------------------------------------------
def compose() -> tuple[np.ndarray, np.ndarray]:
    pad_l, pad_r = np.zeros(N), np.zeros(N)
    bass, drums, arp_l, arp_r, fx = np.zeros(N), np.zeros(N), np.zeros(N), np.zeros(N), np.zeros(N)
    grooving = lambda bar: START["story"] <= bar < START["outro"]
    for bar in range(BARS + 1):
        chord = CHORDS[bar % len(CHORDS)] if bar < BARS else CHORDS[0]
        n = int(BAR * SR) if bar < BARS else int(4 * SR)   # le dernier accord tient
        at = t_of(bar)
        # la nappe : trois scies désaccordées par note, filtrées, attaque lente
        cutoff = 900 + 1600 * (START["story"] <= bar < START["outro"])
        for note in chord[1:]:
            for detune, side in ((-0.06, 0), (0.0, 2), (0.07, 1)):
                voice = saw(hz(note + detune), n, rng.random())
                voice = lowpass(voice, cutoff) * env(n, 0.35, 6 if bar < BARS else 1.6)
                if side in (0, 2):
                    place(pad_l, voice, at, 0.045)
                if side in (1, 2):
                    place(pad_r, voice, at, 0.045)
        if bar >= BARS:
            continue
        root = hz(chord[0] - 12)
        # la basse : des croches pendant le rythme, une note tenue sinon
        if grooving(bar):
            for eighth in range(8):
                m = int(BEAT / 2 * SR)
                note = saw(root, m) * 0.6 + np.sin(2 * np.pi * root * np.arange(m) / SR)
                place(bass, lowpass(note, 700) * env(m, 0.003, 0.18), at + eighth * m, 0.32)
        else:
            m = int(BAR * SR)
            place(bass, np.sin(2 * np.pi * root * np.arange(m) / SR) * env(m, 0.2, 2.5), at, 0.22)
        # la batterie
        for beat in range(4):
            b = at + int(beat * BEAT * SR)
            if grooving(bar) or bar == START["outro"] - 1:
                place(drums, kick(), b, 0.9)
                place(drums, hat(open_=beat % 2 == 1), b + int(BEAT / 2 * SR), 0.22)
                if bar >= START["movers"] and beat in (1, 3):
                    place(drums, clap(), b, 0.45)
            elif bar < START["brand"]:   # l'ouverture : une trotteuse, le tic-tac du tableau de cotation
                place(drums, hat(), b, 0.16)
                place(drums, hat(), b + int(BEAT / 2 * SR), 0.08)
        # l'arpège : des doubles croches sur les notes de l'accord, un écho à gauche et à droite
        if bar >= START["brand"]:
            tones = chord[1:] + [chord[2] + 12]
            for step in range(16):
                if not grooving(bar) and step % 2:
                    continue
                note = tones[(step * 3 + bar) % len(tones)] + (12 if bar >= START["markets"] and step % 4 == 0 else 0)
                b = at + int(step * BEAT / 4 * SR)
                gain = 0.07 if grooving(bar) else 0.05
                place(arp_l if step % 2 == 0 else arp_r, pluck(hz(note)), b, gain)
    # les effets : une montée avant le logo et avant la fin, un impact sur le logo et sur la signature
    place(fx, riser(2 * BEAT), t_of(START["brand"]) - int(2 * BEAT * SR), 0.18)
    place(fx, impact(), t_of(START["brand"]), 0.55)
    place(fx, riser(4 * BEAT), t_of(START["outro"]) - int(4 * BEAT * SR), 0.16)
    place(fx, impact(), t_of(START["outro"]), 0.5)

    # le rythme fait respirer la nappe et la basse (compression déclenchée par la grosse caisse)
    pump = np.ones(N)
    for bar in range(BARS):
        if grooving(bar):
            for beat in range(4):
                b = t_of(bar, beat)
                m = int(BEAT * SR)
                pump[b:b + m] = np.minimum(pump[b:b + m], 1 - 0.45 * np.exp(-np.arange(m) / SR / 0.12))
    pad_l, pad_r, bass = pad_l * pump, pad_r * pump, bass * pump

    # la réverbération : une réponse impulsionnelle synthétique (un souffle qui s'éteint en 2,4 s)
    m = int(2.4 * SR)
    tail = np.exp(-np.arange(m) / SR / 0.55)
    ir_l = lowpass(rng.standard_normal(m), 6000) * tail
    ir_r = lowpass(rng.standard_normal(m), 6000) * tail
    ir_l, ir_r = ir_l / np.sqrt((ir_l ** 2).sum()), ir_r / np.sqrt((ir_r ** 2).sum())
    send_l = pad_l * 0.5 + arp_l + fx * 0.6
    send_r = pad_r * 0.5 + arp_r + fx * 0.6
    wet_l = signal.fftconvolve(send_l, ir_l)[:N] * 0.35
    wet_r = signal.fftconvolve(send_r, ir_r)[:N] * 0.35
    # l'écho de l'arpège : une croche pointée, de l'autre côté
    d = int(0.75 * BEAT * SR)
    echo_l, echo_r = np.zeros(N), np.zeros(N)
    echo_l[d:] = arp_r[:-d] * 0.45
    echo_r[d:] = arp_l[:-d] * 0.45
    left = pad_l + bass + drums + arp_l + echo_l + fx + wet_l
    right = pad_r + bass + drums + arp_r + echo_r + fx + wet_r
    return left, right


def master(left: np.ndarray, right: np.ndarray) -> np.ndarray:
    mix = np.stack([highpass(left, 30), highpass(right, 30)])
    mix = np.tanh(mix * 1.4) / np.tanh(1.4)   # une saturation douce, qui arrondit les crêtes
    end = int((BARS * BAR + 2.5) * SR)
    mix = mix[:, :end]
    fade = int(0.04 * SR)
    mix[:, :fade] *= np.linspace(0, 1, fade)
    mix[:, -int(2.5 * SR):] *= np.linspace(1, 0, int(2.5 * SR)) ** 2
    return mix / np.abs(mix).max() * 10 ** (-4.5 / 20)   # crête à -4,5 dB : environ -14 LUFS, le niveau des plateformes


def main() -> None:
    audio = master(*compose())
    pcm = (audio.T * 32767).astype("<i2")
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "music.wav"
        with wave.open(str(wav), "wb") as w:
            w.setnchannels(2)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        OUT.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "192k", str(OUT)], check=True)
    print(f"{OUT.name} : {audio.shape[1] / SR:.1f} s, {BARS} mesures à {BPM} battements par minute")


if __name__ == "__main__":
    main()
