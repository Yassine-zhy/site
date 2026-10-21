"""La musique et l'habillage sonore de la bande-annonce (guide 34), composés par le code : rien sous droits, rien à télécharger.

Un morceau de bande-annonce à 120 battements par minute, en ré mineur : une mesure dure 2 secondes, soit 60 images de la
vidéo. La mesure n commence exactement à (n-1) x 2 s : les coupes du montage tombent sur un temps fort. Le plan suit les
sections de la vidéo (PLAN plus bas) :
    m.  1-4   accroche    nappe filtrée qui s'ouvre, tic-tac discret (charleston en doubles croches + bois), sous-basse
                          qui gonfle, cymbale inversée qui aspire vers m. 5 ; pas de batterie
    m.  5-6   logo        IMPACT au premier temps de m. 5, puis nappe et basse tenue ; respiration, pas de batterie
    m.  7-12  s'informer  grosse caisse dès m. 7, basse en croches, clap et arpège dès m. 9
    m. 13-18  marchés     groove complet, mélodie (m. 13-16, puis m. 17-18), petit roulement de caisse claire
                          à la fin de m. 12 et de m. 16
    m. 19-20  montée      batterie coupée sauf une caisse claire qui accélère (croches, doubles, triples croches),
                          bruit blanc qui monte, filtre de la nappe qui s'ouvre ; SILENCE TOTAL sur le dernier demi-temps
                          de m. 20 (de 39,75 s à 40,00 s, réverbération comprise)
    m. 21-24  drop        accords larges (supersaw), pompe forte, crash au premier temps de m. 21
    m. 25-26  galerie     accord tenu, batterie plus légère (grosse caisse douce, pas de clap), crash
    m. 27-30  outils      demi-tempo (grosse caisse sur 1 et 3, caisse claire sur 3), mélodie pincée
    m. 31-34  signature   impact au premier temps de m. 31, nappe, dernier accord qui s'éteint, longue réverbération ;
                          pas de batterie
Le fichier dure 68 s (34 mesures) plus 3,5 s de queue de réverbération ; le montage fond le son à la fin.

Le son : basse ronde et grosse caisse en mono (sinus à chute de hauteur, sans saturation), nappes et accords en stéréo
large (scies désaccordées, polyBLEP : pas de repliement), réverbération par convolution sur les éléments mélodiques,
compression des nappes déclenchée par la grosse caisse, fondus de quelques ms à chaque coupure, limiteur à
anticipation sur la crête vraie (suréchantillonnée) en sortie.

Le mixage suit l'arc du montage : une automation de volume met le développement en retrait (-3 dB pour « s'informer »,
-1,5 dB pour les marchés), remonte pendant la montée, et laisse le drop au niveau plein. Volume par section du morceau
livré (RMS) : logo -16,4 dB, s'informer -19,6, marchés -16,6, montée -16,8, drop -14,4, galerie -18,8, outils -18,0.
Mesuré par ffmpeg (filtre ebur128) sur le MP3 écrit : -13,9 LUFS intégrés, crête vraie -1,1 dBTP (la dernière ligne
affichée à chaque exécution redonne ces valeurs).

Habillage sonore (video/public/sfx/*.wav, WAV 48 kHz 16 bits stéréo, crête à -3 dBFS, attaque à l'échantillon 0) :
    whoosh.wav   0,7 s   bruit filtré dont la coupure et le niveau montent ; SOMMET À 0,5 s EXACTEMENT (échantillon 24 000 :
                         l'enveloppe vaut 1 à cet échantillon et c'est aussi l'échantillon le plus fort du fichier),
                         puis il s'éteint en 0,2 s. Le montage le place 0,5 s avant la coupe : le sommet tombe sur la coupe.
                         Il démarre sans silence mais très bas (le niveau monte comme t puissance 4).
    impact.wav   2,5 s   sous-basse qui tombe (110 vers 34 Hz) + éclat de bruit + queue de réverbération
    click.wav    0,08 s  clic d'interface net et doux
    bell.wav     2,5 s   cloche par modulation de fréquence (La 5), claire et sans partiel criard
    keys.wav     0,06 s  une frappe de clavier (le montage la répète)
    tick.wav     0,1 s   petit tic métallique discret pour la galerie

Depuis le dossier finveille/ :
    python tools/music.py              # écrit video/public/music.mp3 et video/public/sfx/*.wav (numpy, scipy, ffmpeg)
    python tools/music.py --sfx-only   # n'écrit que les effets
"""

import argparse
import re
import subprocess
import tempfile
import wave
from itertools import groupby
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d

SR = 48_000
BPM = 120
BEAT = 60 / BPM            # 0,5 s
BAR = 4 * BEAT             # 2 s
PUBLIC = Path(__file__).resolve().parent.parent / "video" / "public"
OUT = PUBLIC / "music.mp3"
SFX_DIR = PUBLIC / "sfx"
TARGET_LUFS = -14.0        # le niveau des plateformes
TAIL = 3.5                 # secondes de queue de réverbération après la dernière mesure

# Le plan, en mesures (il doit suivre les sections du montage, video/src/Trailer.tsx)
# Étape 34 bis : la bande-annonce racontée. accroche (« Chaque jour… »), logo (« Alors voici FinVeille »), informer (ce que
# fait le site), marches (Inès, Hugo, Sami), montee, drop (« Un seul site »), galerie (« Et ce site ? »), outils, signature
PLAN = [("accroche", 6), ("logo", 1), ("informer", 3), ("marches", 13), ("montee", 2), ("drop", 3), ("galerie", 1),
        ("outils", 2), ("signature", 2)]
BARS = sum(bars for _, bars in PLAN)
START = {}                 # première mesure de chaque section, comptée depuis 0 (m. 1 = mesure 0)
LENGTH = dict(PLAN)
_at = 0
for _name, _bars in PLAN:
    START[_name] = _at
    _at += _bars
assert BARS == 33 and START["logo"] == 6 and START["drop"] == 25 and START["signature"] == 31

# Ré mineur : (basse, accord) en notes MIDI. i – VI – iv – V pour l'accroche, i – VI – III – VII pour le groove
CHORDS = {
    "Dm": (38, [50, 57, 60, 64, 65]),
    "Bb": (34, [46, 53, 57, 62, 65]),
    "F": (41, [53, 57, 60, 64, 69]),
    "C": (36, [48, 55, 60, 62, 67]),
    "Gm": (43, [55, 58, 62, 65, 69]),
    "A7": (45, [52, 57, 61, 64, 67]),
    "Dm+": (38, [50, 57, 64, 65, 69, 74]),   # le dernier accord, large
}
BAR_CHORDS = (["Dm", "Bb", "Gm", "A7", "Gm", "A7"] + ["Dm"] + ["Dm", "Bb", "F"]
              + ["C", "Dm", "Bb", "F", "C", "Dm", "Bb", "F", "C", "Dm", "Bb", "F", "C"] + ["Gm", "A7"] + ["Dm", "Bb", "F"]
              + ["C"] + ["Bb"] * 2 + ["Dm+", "Dm+"])
assert len(BAR_CHORDS) == BARS

# Mélodies : (temps depuis le début de la phrase, note MIDI, durée en temps)
MELODY_A = [(0, 69, 1.5), (1.5, 74, .5), (2, 72, 1), (3, 69, 1), (4, 74, 1.5), (5.5, 72, .5), (6, 70, 1), (7, 69, 1),
            (8, 72, 1.5), (9.5, 69, .5), (10, 65, 1), (11, 69, 1), (12, 76, 1.5), (13.5, 74, .5), (14, 72, 1), (15, 67, 1)]
MELODY_B = [(0, 70, 1.5), (1.5, 74, .5), (2, 77, 1), (3, 74, 1), (4, 73, 1.5), (5.5, 76, .5), (6, 69, 2)]
PLUCKED = [(0, 81), (.5, 77), (1, 74), (2, 76), (2.5, 77), (3, 81), (4, 82), (4.5, 77), (5, 74), (6, 72), (6.5, 74),
           (7, 77), (8, 79), (8.5, 74), (9, 70), (10, 72), (10.5, 74), (11, 79), (12, 76), (12.5, 73), (13, 69),
           (14, 76), (14.5, 81), (16, 86)]

hz = lambda note: 440 * 2 ** ((note - 69) / 12)
rng = np.random.default_rng(34)
N = int((BARS * BAR + TAIL + 0.5) * SR)


def t_of(bar: float, beat: float = 0) -> int:
    """Échantillon du temps `beat` de la mesure `bar` (comptée depuis 0)."""
    return int(round((bar * BAR + beat * BEAT) * SR))


# Chaque mesure n (de 1 à 34) commence à (n-1) x 2 s : les coupes du montage en dépendent
assert all(t_of(n - 1) == (n - 1) * 2 * SR for n in range(1, BARS + 1))


# --- Les outils du signal ----------------------------------------------------------------------------------------
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
    return signal.sosfilt(signal.butter(order, cutoff, "low", fs=SR, output="sos"), x, axis=-1)


def highpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    return signal.sosfilt(signal.butter(order, cutoff, "high", fs=SR, output="sos"), x, axis=-1)


def bandpass(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return signal.sosfilt(signal.butter(2, [lo, hi], "band", fs=SR, output="sos"), x, axis=-1)


def sweep(x: np.ndarray, kind: str, times: list, freqs: list, block: int = 480) -> np.ndarray:
    """Filtre d'ordre 2 dont la coupure suit une courbe (interpolée en log), par blocs de 10 ms en gardant l'état."""
    x = np.atleast_2d(x)
    out = np.empty_like(x)
    logs = np.log(freqs)
    zi = None
    for a in range(0, x.shape[1], block):
        fc = float(np.exp(np.interp((a + block / 2) / SR, times, logs)))
        sos = signal.butter(2, min(max(fc, 20), SR * 0.45), kind, fs=SR, output="sos")
        if zi is None:
            zi = np.zeros((sos.shape[0], x.shape[0], 2))
        out[:, a:a + block], zi = signal.sosfilt(sos, x[:, a:a + block], axis=-1, zi=zi)
    return out


def env(n: int, attack: float, decay: float) -> np.ndarray:
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def automation(points: list, n: int = N) -> np.ndarray:
    """Une courbe de gain décrite en (secondes, dB), interpolée linéairement en dB sur toute la durée."""
    secs, dbs = zip(*points)
    gain = 10 ** (np.interp(np.arange(n) / SR, secs, dbs) / 20)
    return gain * (np.interp(np.arange(n) / SR, secs, dbs) > -89)


def place(bus: np.ndarray, sound: np.ndarray, at: int, gain: float = 1.0, pan: float = 0.0) -> None:
    """Ajoute un son à un bus (mono : 1 dimension ; stéréo : 2 x N), avec de courts fondus aux deux bouts."""
    if at >= bus.shape[-1]:
        return
    if bus.ndim == 2 and sound.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sound = np.stack([sound * np.sqrt(2) * np.cos(a), sound * np.sqrt(2) * np.sin(a)])
    n = min(sound.shape[-1], bus.shape[-1] - at)
    seg = sound[..., :n] * gain
    head, tail = min(12, n), min(144, n // 2)   # 0,25 ms à l'entrée, 3 ms à la sortie : pas de clic
    seg[..., :head] *= np.linspace(0, 1, head)
    seg[..., n - tail:] *= np.linspace(1, 0, tail)
    bus[..., at:at + n] += seg


def pingpong(x: np.ndarray, delay: float, gains=(0.42, 0.2)) -> np.ndarray:
    """L'écho : des répétitions qui passent d'un côté à l'autre."""
    d = int(delay * SR)
    out = np.zeros_like(x)
    for k, g in enumerate(gains, 1):
        s = k * d
        if k % 2:
            out[0, s:] += x[1, :-s] * g
            out[1, s:] += x[0, :-s] * g
        else:
            out[:, s:] += x[:, :-s] * g
    return out


def make_ir(rt: float, seed: int, predelay: float = 0.015) -> np.ndarray:
    """Une réponse impulsionnelle stéréo synthétique : un souffle décorrélé à gauche et à droite, aigus qui s'éteignent
    plus vite que les graves. `rt` : durée pour perdre 60 dB."""
    r = np.random.default_rng(seed)
    m = int(rt * 1.1 * SR)
    t = np.arange(m) / SR
    k = 6.9 / rt
    ir = np.zeros((2, m + int(predelay * SR)))
    for c in range(2):
        low = lowpass(r.standard_normal(m), 1500) * np.exp(-t * k)
        high = highpass(lowpass(r.standard_normal(m), 9000), 1500) * np.exp(-t * k * 2.4)
        ir[c, int(predelay * SR):] = (low + 0.6 * high) * (1 - np.exp(-t / 0.006))
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))


def reverb(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    """Réverbération par convolution (stéréo), tronquée à la durée du signal."""
    return np.stack([signal.fftconvolve(x[c], ir[c])[:x.shape[1]] for c in range(2)])


# --- Les instruments ---------------------------------------------------------------------------------------------
def kick() -> np.ndarray:
    """Une grosse caisse propre : un sinus dont la hauteur tombe de 170 à 48 Hz, un petit claquement, aucune saturation."""
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    phase = 2 * np.pi * np.cumsum(48 + 125 * np.exp(-t / 0.028)) / SR
    body = np.sin(phase) * np.exp(-t / 0.2) + 0.18 * np.sin(2 * phase) * np.exp(-t / 0.03)
    click = highpass(rng.standard_normal(n), 2500) * np.exp(-t / 0.003) * 0.2
    out = (body + click) * np.minimum(1, t / 0.0006)
    return out / np.abs(out).max()


def hat(open_: bool = False) -> np.ndarray:
    n = int((0.25 if open_ else 0.08) * SR)
    return highpass(rng.standard_normal(n), 7000, 4) * env(n, 0.001, 0.09 if open_ else 0.025)


def wood(freq: float) -> np.ndarray:
    """Le « tic » ou le « tac » : un bloc de bois, bref."""
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.011) + 0.3 * bandpass(rng.standard_normal(n), 2500, 6000)
            * np.exp(-t / 0.003)) * np.minimum(1, t / 0.0004)


def clap() -> np.ndarray:
    n = int(0.35 * SR)
    noise = bandpass(rng.standard_normal(n), 900, 3200)
    shape = np.zeros(n)
    for k, delay in enumerate((0, 0.011, 0.022)):   # trois mains presque ensemble
        i = int(delay * SR)
        shape[i:] += env(n - i, 0.0005, 0.012 if k < 2 else 0.16)
    return noise * shape * 0.8


def snare() -> np.ndarray:
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * np.cumsum(175 + 70 * np.exp(-t / 0.012)) / SR) * np.exp(-t / 0.055)
    noise = bandpass(rng.standard_normal(n), 1400, 9000) * np.exp(-t / 0.085)
    return (tone * 0.6 + noise * 0.9) * np.minimum(1, t / 0.0004)


def crash(length: float = 3.2) -> np.ndarray:
    """Une cymbale : du bruit clair en stéréo, deux étages de décroissance."""
    n = int(length * SR)
    t = np.arange(n) / SR
    shape = (0.55 * np.exp(-t / 0.28) + 0.45 * np.exp(-t / 1.1)) * np.minimum(1, t / 0.0015)
    return highpass(rng.standard_normal((2, n)), 3200) * shape


def rev_cymbal(length: float) -> np.ndarray:
    """La cymbale inversée : une cymbale à l'envers, qui aspire vers l'instant où elle s'arrête."""
    n = int(length * SR)
    t = np.arange(n) / SR
    noise = highpass(rng.standard_normal((2, n)), 3500)
    return (noise * np.exp(-(length - t) / (length * 0.38)) * np.minimum(1, (length - t) / 0.0008))


def pluck(freq: float, length: float = 0.5, bright: float = 1.0) -> np.ndarray:
    """Une note pincée : des harmoniques qui s'éteignent d'autant plus vite qu'elles sont aiguës (additif : pas de repliement)."""
    n = int(length * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, 11):
        if freq * k > 9000:
            break
        out += np.sin(2 * np.pi * freq * k * t + 0.4 * k) * np.exp(-t * (7 + 5.5 * (k - 1) / bright)) / k ** 1.15
    return out * np.minimum(1, t / 0.0015)


def bass_note(freq: float, dur: float, tone: float = 1.0) -> np.ndarray:
    """Une basse ronde : sinus plus deux harmoniques douces pour se faire entendre sur de petites enceintes."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    ph = 2 * np.pi * freq * t
    x = np.sin(ph) + 0.28 * tone * np.sin(2 * ph + 0.6) + 0.1 * tone * np.sin(3 * ph)
    return x * np.minimum(1, t / 0.004) * np.minimum(1, (dur - t) / 0.012) * (0.75 + 0.25 * np.exp(-t / 0.3))


def boom(length: float, f0: float = 34, f1: float = 110, tf: float = 0.08, ta: float = 0.8) -> np.ndarray:
    """Une sous-basse qui tombe de f1 à f0."""
    n = int(length * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(f0 + (f1 - f0) * np.exp(-t / tf)) / SR) * np.exp(-t / ta) * np.minimum(1, t / 0.0005)


def burst(length: float, cutoff: float = 7000, tau: float = 0.3) -> np.ndarray:
    """Un éclat de bruit stéréo."""
    n = int(length * SR)
    t = np.arange(n) / SR
    return lowpass(rng.standard_normal((2, n)), cutoff) * np.exp(-t / tau) * np.minimum(1, t / 0.0003)


def snare_roll(bus: np.ndarray, bar: int) -> None:
    """Le roulement des mesures 19-20 : croches, puis doubles croches, puis triples croches, de plus en plus fort."""
    beats = list(np.arange(0, 4, 0.5)) + list(np.arange(4, 6, 0.25)) + list(np.arange(6, 7.5, 0.125))
    for i, b in enumerate(beats):
        place(bus, snare(), t_of(bar, b), 0.13 + 0.5 * (i / (len(beats) - 1)) ** 1.3)


# --- La partition ------------------------------------------------------------------------------------------------
def pad_voices(notes: list, n: int, attack: float, release: float, sustain_n: int, voices: int = 3, spread: float = 11) -> np.ndarray:
    """Des scies désaccordées par note, des détunes différents à gauche et à droite : une nappe stéréo large."""
    out = np.zeros((2, n))
    offsets = np.linspace(-spread, spread, 2 * voices)
    for note in notes:
        for k, cents in enumerate(offsets):
            out[k % 2] += saw(hz(note + cents / 100), n, rng.random())
    t = np.arange(n) / SR
    shape = np.minimum(1, t / attack) * np.minimum(1, np.maximum(0, (sustain_n + int(release * SR) - np.arange(n)) / (release * SR)))
    return out * shape


def supersaw(notes: list, n: int, attack: float, release: float, sustain_n: int) -> np.ndarray:
    """Le supersaw du drop : sept scies par note, très désaccordées, réparties de gauche à droite."""
    out = np.zeros((2, n))
    cents = [-22, -13, -5, 0, 5, 13, 22]
    pans = [-1, 0.55, -0.35, 0, 0.35, -0.55, 1]
    for note in notes:
        for c, p in zip(cents, pans):
            a = (p + 1) * np.pi / 4
            v = saw(hz(note + c / 100), n, rng.random())
            out[0] += v * np.cos(a)
            out[1] += v * np.sin(a)
    t = np.arange(n) / SR
    shape = np.minimum(1, t / attack) * np.minimum(1, np.maximum(0, (sustain_n + int(release * SR) - np.arange(n)) / (release * SR)))
    return out * shape


def lead_note(note: float, dur: float) -> np.ndarray:
    """La mélodie : deux scies désaccordées de chaque côté, filtrées, avec une enveloppe qui se pose."""
    f = hz(note)
    n = int((dur + 0.3) * SR)
    t = np.arange(n) / SR
    left = saw(f * 0.9965, n, rng.random()) + saw(f * 1.002, n, rng.random())
    right = saw(f * 1.0035, n, rng.random()) + saw(f * 0.998, n, rng.random())
    out = lowpass(np.stack([left, right]), 3400)
    shape = np.minimum(1, t / 0.012) * (0.55 + 0.45 * np.exp(-t / 0.15)) * np.where(t < dur, 1, np.exp(-(t - dur) / 0.07))
    return out * shape


def pump_curve(events: list, n: int = N) -> np.ndarray:
    """La compression déclenchée par la grosse caisse : le gain plonge à chaque coup puis remonte."""
    g = np.ones(n)
    for at, depth, tau in events:
        m = int(min(0.6, tau * 5) * SR)
        t = np.arange(m) / SR
        shape = 1 - depth * (1 - np.exp(-t / 0.002)) * np.exp(-t / tau)
        end = min(n, at + m)
        g[at:end] = np.minimum(g[at:end], shape[:end - at])
    return g


def compose(parts: dict | None = None) -> np.ndarray:
    z = lambda: np.zeros((2, N))
    pad, sup, lead, arp, drum, perc, fx, tic = z(), z(), z(), z(), z(), z(), z(), z()
    low, bass = np.zeros(N), np.zeros(N)   # la grosse caisse et la basse, en mono
    pumps = []                             # (échantillon, profondeur, relâchement) de chaque coup de grosse caisse
    KICK = kick()
    K = START

    def kick_at(bar: int, beat: float, gain: float, depth: float, tau: float = 0.14) -> None:
        place(low, KICK, t_of(bar, beat), gain)
        pumps.append((t_of(bar, beat), depth, tau))

    def arpeggio(bar: int, sixteenths: bool, octave_up: bool, gain: float) -> None:
        tones = CHORDS[BAR_CHORDS[bar]][1][1:] + [CHORDS[BAR_CHORDS[bar]][1][2] + 12]
        for step in range(16):
            if not sixteenths and step % 2:
                continue
            note = tones[(step * 3 + bar) % len(tones)] + (12 if octave_up and step % 4 == 0 else 0)
            place(arp, pluck(hz(note), 0.4), t_of(bar, step / 4), gain * (1.25 if step % 4 == 0 else 1), pan=-0.55 if step % 2 == 0 else 0.55)

    # L'accroche : le tic-tac d'une salle de marché (doubles croches et blocs de bois) et la sous-basse qui gonfle
    for bar in range(K["accroche"], K["logo"]):
        for step in range(16):
            accent = 1.7 if step % 4 == 0 else (1.0 if step % 2 == 0 else 0.65)
            place(tic, hat(), t_of(bar, step / 4), 0.15 * accent, pan=0.3 if step % 2 else -0.3)
        for beat in range(4):
            place(tic, wood(1800 if beat % 2 == 0 else 1280), t_of(bar, beat), 0.4, pan=-0.35 if beat % 2 == 0 else 0.35)
    n_drone = t_of(K["informer"])    # la sous-basse (ré) gonfle jusqu'à l'impact puis tient jusqu'à la grosse caisse
    t = np.arange(n_drone) / SR
    ph = 2 * np.pi * hz(26) * t
    drone = (np.sin(ph) + 0.55 * np.sin(2 * ph) + 0.16 * np.sin(3 * ph)) * np.minimum(1, (t / (K["logo"] * BAR)) ** 2.5) * 0.24
    place(bass, drone, 0, 1.0)
    place(fx, rev_cymbal(1.6), t_of(K["logo"]) - int(1.6 * SR), 0.3)
    for bar, name in ((K["logo"], "impact"), (K["signature"], "impact")):
        place(low, boom(3.2), t_of(bar), 0.85 if bar == K["logo"] else 0.8)
        place(fx, burst(2.2, 7500, 0.35), t_of(bar), 0.9)
        place(fx, crash(2.2), t_of(bar), 0.3)

    # S'informer et les marchés : la grosse caisse, la basse en croches, le clap et l'arpège
    for bar in range(K["informer"], K["montee"]):
        marches = bar >= K["marches"]
        root = hz(CHORDS[BAR_CHORDS[bar]][0])
        for e in range(8):
            place(bass, bass_note(root * (2 if e == 7 else 1), 0.235), t_of(bar, e / 2), 0.26)
        for beat in range(4):
            kick_at(bar, beat, 0.55 if not marches else 0.62, 0.30 if not marches else 0.38)
            place(drum, hat(open_=beat % 2 == 1), t_of(bar, beat + 0.5), 0.45, pan=0.25)
            if marches:
                for step in (1, 3):
                    place(drum, hat(), t_of(bar, beat + step / 4), 0.16, pan=-0.2)
            if bar > K["informer"] and beat in (1, 3):
                place(perc, clap(), t_of(bar, beat), 0.6)
        if bar > K["informer"]:
            arpeggio(bar, sixteenths=marches, octave_up=marches, gain=0.15 if marches else 0.12)
    place(fx, rev_cymbal(0.9), t_of(K["informer"]) - int(0.9 * SR), 0.3)
    for bar, steps in ((K["marches"] - 1, 4), (K["marches"] + 4, 6), (K["marches"] + 9, 6)):   # un roulement avant chaque personnage
        for i in range(steps):
            place(perc, snare(), t_of(bar, 4 - steps / 4 + i / 4), 0.3 + 0.5 * i / (steps - 1))
    for i, (b, note, dur) in enumerate(MELODY_A):                       # m. 13-16
        place(lead, lead_note(note, dur * BEAT), t_of(K["marches"], b), 0.12)   # sous la voix : discrète
    for b, note, dur in MELODY_B:                                       # m. 17-18
        place(lead, lead_note(note, dur * BEAT), t_of(K["marches"] + 4, b), 0.12)

    # La montée : une caisse claire qui accélère, du bruit blanc qui monte, puis le silence (appliqué à la fin)
    snare_roll(perc, K["montee"])
    t0, t1 = t_of(K["montee"]), t_of(K["drop"]) - int(0.25 * SR)
    noise = rng.standard_normal((2, t1 - t0 + SR // 4))
    noise = sweep(noise, "high", [0, (t1 - t0) / SR], [250, 11000])
    place(fx, noise, t0, 0.3)
    fx[:, t0:t0 + noise.shape[1]] *= automation([(0, -34), (3.75, 0)], noise.shape[1])
    for k, bar in enumerate((K["montee"], K["montee"] + 1)):
        place(bass, bass_note(hz(CHORDS[BAR_CHORDS[bar]][0]), BAR - 0.02), t_of(bar), 0.3 + 0.1 * k)

    # Le drop et la galerie : accords larges, pompe forte ; plus léger pour l'accord tenu
    place(fx, crash(), t_of(K["drop"]), 0.6)
    place(fx, crash(), t_of(K["galerie"]), 0.4)
    for bar in range(K["drop"], K["outils"]):
        galerie = bar >= K["galerie"]
        root = hz(CHORDS[BAR_CHORDS[bar]][0])
        place(bass, bass_note(root, BAR - 0.02, 1.2), t_of(bar), 0.45 if not galerie else 0.25)
        if not galerie:
            for beat in range(4):
                kick_at(bar, beat, 1.0, 0.72, 0.17)
                place(drum, hat(open_=True), t_of(bar, beat + 0.5), 0.5, pan=0.25)
                for step in range(4):
                    place(drum, hat(), t_of(bar, beat + step / 4), 0.28, pan=-0.25 if step % 2 else 0.25)
                if beat in (1, 3):
                    place(perc, clap(), t_of(bar, beat), 0.8)
                    place(perc, snare(), t_of(bar, beat), 0.5)
            arpeggio(bar, sixteenths=True, octave_up=True, gain=0.26)
        else:
            for beat in range(4):
                kick_at(bar, beat, 0.5, 0.34, 0.15)
                place(drum, hat(), t_of(bar, beat + 0.5), 0.25, pan=0.25)
            arpeggio(bar, sixteenths=False, octave_up=False, gain=0.13)

    # Tes outils : le demi-tempo, la mélodie pincée
    for bar in range(K["outils"], K["signature"]):
        root = hz(CHORDS[BAR_CHORDS[bar]][0])
        for beat in (0, 2):
            kick_at(bar, beat, 0.75, 0.45, 0.16)
            place(bass, bass_note(root, 1.45 * BEAT), t_of(bar, beat), 0.4)
        place(perc, snare(), t_of(bar, 2), 0.8)
        place(perc, clap(), t_of(bar, 2), 0.45)
        for e in range(8):
            place(drum, hat(), t_of(bar, e / 2), 0.2 if e % 2 else 0.12, pan=0.25)
    for b, note in (x for x in PLUCKED if x[0] < LENGTH["outils"] * 4):   # la mélodie pincée tient dans la section
        place(lead, pluck(hz(note), 0.9, 1.4), t_of(K["outils"], b), 0.3, pan=0.35 if int(b * 2) % 2 else -0.35)

    # La signature : une note qui répond à l'impact, puis le dernier accord et ses étincelles
    place(lead, pluck(hz(86), 1.8, 0.8), t_of(K["signature"]), 0.14, pan=-0.3)
    place(lead, pluck(hz(81), 1.8, 0.8), t_of(K["signature"], 3), 0.1, pan=0.3)
    place(lead, pluck(hz(81), 2.5, 0.8), t_of(K["signature"] + 1), 0.12, pan=0.25)
    place(lead, pluck(hz(86), 3.0, 0.8), t_of(K["signature"] + 1, 1), 0.1, pan=-0.25)
    place(bass, bass_note(hz(26), 2 * BAR * 2 + 2.5, 0.0) * np.minimum(1, np.exp(-np.arange(int((2 * BAR * 2 + 2.5) * SR)) / SR / 3.5)), t_of(K["signature"]), 0.3)

    # Les nappes et les accords, une note longue par suite de mesures identiques
    bar = 0
    for name, grp in groupby(BAR_CHORDS):
        bars = len(list(grp))
        notes = CHORDS[name][1]
        final = bar + bars == BARS
        release = 4.0 if final else 0.6
        n = int((bars * BAR + release) * SR) + 1
        place(pad, pad_voices(notes, n, 0.45 if bar != K["logo"] else 0.08, release, int(bars * BAR * SR)), t_of(bar), 0.17)
        if K["drop"] <= bar < K["outils"]:
            wide = [k for k in notes[1:]] + [k + 12 for k in notes[1:3]]
            place(sup, supersaw(wide, n, 0.05, 0.25, int(bars * BAR * SR)), t_of(bar), 0.19)
        bar += bars

    # La nappe : sa coupure suit l'arc (elle s'ouvre dans l'accroche et la montée, se referme à la fin)
    sec = lambda name, off=0.0: K[name] * BAR + off   # le début d'une section, en secondes
    end = BARS * BAR
    cut_t = [0, sec("logo", -0.1), sec("logo"), sec("informer"), sec("marches"), sec("montee"), sec("drop", -0.25),
             sec("drop"), sec("outils"), sec("signature"), end, end + 4]
    cut_f = [320, 1700, 2600, 1800, 2300, 2700, 9500, 4500, 3000, 1800, 1300, 600]
    pad = sweep(pad, "low", cut_t, cut_f)
    pad = highpass(pad, 130)
    sup = highpass(lowpass(sup, 7500), 170)
    pad *= automation([(0, -17), (sec("logo", -0.1), -8), (sec("logo"), -4), (sec("informer"), -7), (sec("montee"), -5),
                       (sec("drop", -0.25), -2), (sec("drop"), -14), (sec("outils"), -11), (sec("signature"), -7),
                       (sec("signature", 2), -5), (end, -11), (end + 3.5, -40)])
    sup *= automation([(0, -90), (sec("drop", -0.1), -90), (sec("drop"), 0), (sec("galerie", -0.1), 0), (sec("galerie"), -8),
                       (sec("outils", -1.1), -8), (sec("outils"), -90)])

    # La pompe : nappe, accords, mélodie et arpège se creusent à chaque coup de grosse caisse ; la basse plus vite encore
    duck = pump_curve(pumps)
    pad, sup = pad * duck, sup * duck
    soft = 1 - (1 - duck) * 0.55
    lead, arp = lead * soft, arp * soft
    bass = bass * pump_curve([(at, min(0.85, d + 0.25), 0.07) for at, d, _ in pumps])
    lead = lead + pingpong(lead, 0.75 * BEAT)
    arp = arp + pingpong(arp, 0.75 * BEAT, (0.45, 0.22))
    lead = highpass(lead, 180)
    arp = highpass(arp, 180)
    fx = highpass(fx, 60)

    # La réverbération : une salle courte pour les percussions et l'arpège, une grande salle pour le reste
    room_in = highpass(perc * 0.55 + arp * 0.35 + lead * 0.2, 250)
    hall_in = highpass(pad * 0.34 + sup * 0.16 + lead * 0.55 + fx * 0.42 + arp * 0.2, 220)
    wet = reverb(room_in, make_ir(1.1, 1)) * 0.5 + reverb(lowpass(hall_in, 9000), make_ir(4.2, 2)) * 0.6

    mix = pad + sup + lead + arp + drum + perc + fx + tic + wet
    if parts is not None:   # les bus séparés, pour régler les niveaux
        parts.update(pad=pad, sup=sup, lead=lead, arp=arp, drum=drum, perc=perc, fx=fx, tic=tic, wet=wet,
                     low=np.stack([low, low]), bass=np.stack([bass, bass]))
    mix += (low + bass)[None]
    # L'arc du mixage, en dB par section : le développement en retrait, la montée qui remonte, le drop au niveau plein.
    # La normalisation à -14 LUFS remonte ensuite l'ensemble : le drop ressort de 2 à 3 dB au-dessus du reste
    at = lambda name, end=False: (START[name] + (LENGTH[name] if end else 0)) * BAR - (0.05 if end else 0)
    arc = automation([(0, 0), (at("logo", True), 0), (at("informer"), -3), (at("informer", True), -3),
                      (at("marches"), -1.5), (at("montee"), -1.5), (at("montee", True) - 0.2, 0), (at("drop", True), 0),
                      (at("galerie"), -2), (at("galerie", True), -2), (at("outils"), -2.5), (at("outils", True), -2.5),
                      (at("signature"), 0), (N / SR, 0)])
    return mix * arc[None]


def master(mix: np.ndarray, gain_db: float, ceiling_db: float) -> np.ndarray:
    """Coupe les très graves, ouvre le silence de la montée, applique le gain puis le limiteur à anticipation."""
    x = highpass(mix, 28)
    a, b = t_of(K_DROP_SILENCE[0]), t_of(K_DROP_SILENCE[1])
    ramp = int(0.004 * SR)
    gate = np.ones(x.shape[1])
    gate[a:b] = 0
    gate[a - ramp:a] = np.linspace(1, 0, ramp)   # un fondu de 4 ms : le silence est net mais sans clic
    x = x * gate
    end = int((BARS * BAR + TAIL) * SR)
    x = x[:, :end]
    x[:, :int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    x[:, -int(1.5 * SR):] *= np.linspace(1, 0, int(1.5 * SR)) ** 2
    x = x * 10 ** (gain_db / 20)
    return limiter(x, ceiling_db)


# Le silence de la montée : le dernier demi-temps de m. 20, en mesures depuis 0 (de 39,75 s à 40,00 s)
K_DROP_SILENCE = (START["drop"] - 0.125, START["drop"])


def limiter(x: np.ndarray, ceiling_db: float, look: float = 0.010) -> np.ndarray:
    """Limiteur à anticipation (10 ms) calé sur la crête vraie (suréchantillonnage x4)."""
    ceil = 10 ** (ceiling_db / 20)
    peak = np.zeros(x.shape[1])
    for c in range(2):
        up = signal.resample_poly(x[c], 4, 1)
        peak = np.maximum(peak, np.abs(up).reshape(-1, 4).max(axis=1))
    need = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    w = int(look * SR)
    g = minimum_filter1d(need, size=2 * w + 1, mode="nearest")
    g = uniform_filter1d(uniform_filter1d(g, w + 1, mode="nearest"), w + 1, mode="nearest")
    return x * g


# --- La mesure et l'écriture -------------------------------------------------------------------------------------
def write_wav(path: Path, audio: np.ndarray) -> None:
    pcm = np.clip(np.round(audio.T * 32767), -32768, 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def measure(path: Path) -> tuple[float, float]:
    """(LUFS intégrés, crête vraie en dBTP) mesurés par le filtre ebur128 de ffmpeg."""
    out = subprocess.run(["ffmpeg", "-nostats", "-hide_banner", "-i", str(path), "-filter_complex", "ebur128=peak=true",
                          "-f", "null", "-"], capture_output=True, text=True, check=True).stderr
    summary = out[out.rindex("Summary:"):]
    lufs = float(re.search(r"I:\s+(-?[\d.]+) LUFS", summary).group(1))
    peak = float(re.search(r"Peak:\s+(-?[\d.]+) dBFS", summary).group(1))
    return lufs, peak


def encode_mp3(wav: Path, out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-c:a", "libmp3lame", "-b:a", "256k", str(out)], check=True)


def write_music() -> None:
    mix = compose()
    gain_db, ceiling = 0.0, -1.5
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "music.wav"
        lufs = peak = 0.0
        for _ in range(8):   # on règle le gain jusqu'à -14 LUFS, puis le plafond jusqu'à une crête vraie <= -1 dBTP sur le MP3
            audio = master(mix, gain_db, ceiling)
            write_wav(wav, audio)
            encode_mp3(wav, OUT)
            lufs, peak = measure(OUT)
            if abs(lufs - TARGET_LUFS) <= 0.1 and peak <= -1.0:
                break
            gain_db += TARGET_LUFS - lufs
            if peak > -1.0:
                ceiling -= peak + 1.05
    print(f"{OUT.name} : {audio.shape[1] / SR:.2f} s, {BARS} mesures à {BPM} battements par minute, "
          f"{lufs:.1f} LUFS intégrés, crête vraie {peak:.2f} dBTP (gain {gain_db:+.1f} dB, plafond {ceiling:.1f} dB)")


# --- L'habillage sonore ------------------------------------------------------------------------------------------
def finish_sfx(name: str, audio: np.ndarray, fade_ms: float = 8) -> None:
    """Fondu de sortie, crête à -3 dBFS, WAV 48 kHz 16 bits stéréo."""
    audio = audio.copy()
    f = int(fade_ms / 1000 * SR)
    audio[:, -f:] *= np.linspace(1, 0, f)
    audio = audio / np.abs(audio).max() * 10 ** (-3 / 20)
    SFX_DIR.mkdir(parents=True, exist_ok=True)
    write_wav(SFX_DIR / name, audio)
    print(f"sfx/{name} : {audio.shape[1] / SR:.3f} s, crête {20 * np.log10(np.abs(np.round(audio * 32767)).max() / 32767):.2f} dBFS")


def sfx_whoosh() -> np.ndarray:
    """Le sommet tombe à 0,5 s exactement (échantillon 24 000) : on retire des bruits jusqu'à ce que l'échantillon le
    plus fort du fichier soit celui-là ; la coupure du filtre et le niveau montent jusqu'à lui, puis tout s'éteint."""
    n, top = int(0.7 * SR), int(0.5 * SR)
    t = np.arange(n) / SR
    shape = np.where(t <= 0.5, np.maximum(t, 0) / 0.5, 1.0) ** 4 * np.where(t <= 0.5, 1, np.exp(-(t - 0.5) / 0.045))
    r = np.random.default_rng(7)
    for _ in range(200):
        x = sweep(r.standard_normal((2, n)), "low", [0, 0.5, 0.7], [350, 5500, 3000])
        x = sweep(x, "high", [0, 0.5, 0.7], [120, 900, 600])
        flat = x / np.sqrt(uniform_filter1d(x ** 2, 240) + 1e-12)          # bruit à niveau constant : l'enveloppe décide
        k = np.argmax(np.abs(flat[:, top - 2400:top + 2400]).max(axis=0)) + top - 2400
        flat = np.roll(flat, top - k, axis=1)                                # le plus fort échantillon tombe sur le sommet
        out = flat * shape
        if np.argmax(np.abs(out).max(axis=0)) == top:
            return out
    raise RuntimeError("whoosh : sommet introuvable")


def sfx_impact() -> np.ndarray:
    n = int(2.5 * SR)
    body = np.zeros((2, n))
    place(body, boom(2.5, 34, 110, 0.08, 0.7), 0, 1.0)
    place(body, burst(0.8, 8000, 0.12), 0, 0.55)
    place(body, highpass(burst(1.5, 6000, 0.4), 300), 0, 0.25)
    wet = reverb(highpass(body, 200), make_ir(1.9, 5)) * 0.9
    return body + wet


def sfx_click() -> np.ndarray:
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * np.cumsum(1500 + 1100 * np.exp(-t / 0.004)) / SR) * np.exp(-t / 0.011)
    snap = bandpass(np.random.default_rng(3).standard_normal(n), 3000, 8000) * np.exp(-t / 0.0015) * 0.35
    mono = lowpass(tone + snap, 9000) * np.minimum(1, t / 0.0004)
    dry = np.stack([mono, np.roll(mono, int(0.0004 * SR)) * 0.97])
    return dry + reverb(dry, make_ir(0.12, 6, 0.002)) * 0.5


def sfx_bell() -> np.ndarray:
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for side, detune in enumerate((0.9993, 1.0007)):
        for f, ratio, index, tau, amp in ((880, 3.5, 3.0, 0.5, 1.0), (1760, 3.5, 1.5, 0.3, 0.3), (2217, 2.0, 1.0, 0.25, 0.14)):
            f *= detune
            mod = np.sin(2 * np.pi * f * ratio * t) * index * np.exp(-t / tau)
            out[side] += np.sin(2 * np.pi * f * t + mod) * np.exp(-t / (0.9 * tau / 0.5 if f < 1000 else tau * 1.2)) * amp
    out = lowpass(out, 7000) * np.minimum(1, t / 0.0006)
    return out + reverb(out, make_ir(1.4, 8)) * 0.4


def sfx_keys() -> np.ndarray:
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(9)
    common = bandpass(r.standard_normal(n), 1500, 5200)
    noise = np.stack([common * 0.8 + bandpass(r.standard_normal(n), 1500, 5200) * 0.3,
                      common * 0.8 + bandpass(r.standard_normal(n), 1500, 5200) * 0.3]) * np.exp(-t / 0.006)
    thump = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.014) * 0.7
    return (noise + thump[None]) * np.minimum(1, t / 0.0003)


def sfx_tick() -> np.ndarray:
    n = int(0.1 * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for side, detune in enumerate((1.0, 1.012)):
        for f, amp, tau in ((2930, 1.0, 0.022), (4310, 0.6, 0.016), (6180, 0.35, 0.011)):
            out[side] += np.sin(2 * np.pi * f * detune * t) * np.exp(-t / tau) * amp
    out = highpass(out, 1500) * np.minimum(1, t / 0.0004)
    return out + reverb(out, make_ir(0.1, 10, 0.002)) * 0.3


def write_sfx() -> None:
    finish_sfx("whoosh.wav", sfx_whoosh(), 6)
    finish_sfx("impact.wav", sfx_impact(), 500)
    finish_sfx("click.wav", sfx_click(), 12)
    finish_sfx("bell.wav", sfx_bell(), 400)
    finish_sfx("keys.wav", sfx_keys(), 6)
    finish_sfx("tick.wav", sfx_tick(), 15)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--sfx-only", action="store_true", help="n'écrire que les effets sonores")
    args = parser.parse_args()
    write_sfx()
    if not args.sfx_only:
        write_music()


if __name__ == "__main__":
    main()
