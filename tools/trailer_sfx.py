"""La banque de bruitages de la bande-annonce « TrailerSfx » (composition Remotion `TrailerSfx`, video/src/TrailerSfx.tsx), sans
musique : tout est synthétisé par le code (rien sous droits, rien à télécharger) dans un style « interface premium / cinéma »
(sinus, modulation de fréquence, bruit filtré, réverbération par convolution ; aucun son 8 bits), puis écrit dans
video/public/sfx-trailer/ : WAV 48 kHz 16 bits stéréo, crête normalisée à -1 dBFS, fondus de 3 ms au début et à la fin (donc jamais
de clic), aucune saturation (le signal est mis à l'échelle, jamais coupé).
Tous les fichiers ont la même crête : c'est le mixage (TrailerSfx.tsx) qui fait le premier plan et le fond.

    nom            durée    ce que c'est
    whoosh_soft    900 ms   souffle doux de glissé : bruit filtré passe-bande qui monte de 450 à 3 800 Hz, de la droite vers la gauche (comme un glissé
                            vers la gauche) ; sommet à 450 ms (la moitié) : on le cale pour que le sommet tombe sur la frontière de la scène
    whoosh_hard    1,1 s    souffle de zoom : même principe, de 200 à 7 500 Hz, la stéréo qui traverse de gauche à droite, avec un
                            roulement grave dessous et un voile d'air aigu ; sommet à 650 ms
    swipe          300 ms   petit glissé rapide, de la droite vers la gauche, plus étroit et plus aigu ; sommet à 150 ms
    ui_click       130 ms   clic d'interface net : transitoire aigu, ton à 2,1 kHz, petit corps grave (260 Hz qui descend) et un grain de salle
    ui_tap         110 ms   appui plus doux et plus rond : corps à 190 Hz, ton à 1,1 kHz, transitoire voilé
    type1..type4   90 ms    frappes de clavier douces : un coup de touche (bruit passe-bande + « thock » grave) puis le relâchement,
                            quatre touches différentes (hauteur du corps 150 à 230 Hz, bande de bruit, placement stéréo)
    send           450 ms   validation : sinus qui monte vite de 330 à 990 Hz (« bloop » montant), un « pip » aigu à 1 760 Hz qui suit
    notif          1,3 s    notification claire à deux notes (si5 puis mi6, 110 ms d'écart), cloche douce à modulation de fréquence
    chime          2,8 s    cloche cristalline à modulation de fréquence (mi6, partiels inharmoniques), longue résonance et réverbe
    glass_tink     650 ms   petit tintement de verre (partiels à x1, x2,76 et x5,4 qui s'éteignent vite), 3 hauteurs :
    glass_tink2             glass_tink (2 800 Hz), glass_tink2 (3 500 Hz), glass_tink3 (4 200 Hz)
    glass_tink3
    riser          1,5 s    montée de tension : bruit et ton qui montent (200 → 9 000 Hz), houle grave, crescendo ; le SOMMET est la
                            dernière image du fichier : on le place pour qu'il finisse pile sur le temps fort
    impact         2,2 s    coup sourd de cinéma : sinus de 50 Hz qui chute de 130 Hz + transitoire + queue de réverbération de 1,3 s
    sub_hit        700 ms   grave court et rond (45 Hz, attaque de 4 ms), sans queue
    tick           25 ms    tic très léger, sec et aigu
    sparkle        1,0 s    scintillement : neuf notes aiguës (5 à 9 kHz) qui s'égrènent sur 0,55 s, placées au hasard dans le champ
    data_blips     1,0 s    petits bips rapides de données qui défilent : quinze notes sinus (gamme de mi pentatonique, 1,3 à 2,6 kHz)
                            de 30 ms, en rafale irrégulière, alternées gauche-droite, avec un écho léger
    logo_reveal    2,5 s    accord doux et large qui s'ouvre (mi sus2 sur cinq octaves, voix désaccordées) : l'attaque dure 0,55 s, le
                            filtre s'ouvre de 700 à 6 000 Hz, un scintillement à la fin de l'attaque, réverbération de 1,8 s
    outro_tail     3,0 s    traînée ambiante qui s'éteint : nappe grave (mi2, si2, mi3, si3) qui gonfle en 0,8 s puis décroît, souffle
                            filtré, réverbération de 2 s ; elle est à zéro à la dernière image
    room_tone      8 s      souffle grave de salle, BOUCLABLE (bruit mis en forme dans le domaine de Fourier : la fin retombe sur le
                            début sans saut, donc ni fondu ni clic à la jointure ; une respiration lente de 2 cycles par boucle) ; posé
                            à un volume de 0,08 sous toute la vidéo

Mesures (relues dans les WAV écrits, à chaque exécution) : durée, crête, |premier| et |dernier échantillon|, plus longue plage à la
crête ; la ligne « bilan » dit si une règle est enfreinte. Les durées sont aussi écrites dans video/src/TrailerSfx.tsx (table DUR) :
si tu en changes une ici, mets-la à jour là-bas.

Depuis le dossier finveille/ (numpy et scipy sont nécessaires) :
    python tools/trailer_sfx.py
"""

import wave
from pathlib import Path

import numpy as np
from scipy import signal

SR = 48000
PEAK_DB = -1.0
OUT = Path(__file__).resolve().parent.parent / "video" / "public" / "sfx-trailer"
LOOPS = ("room_tone",)  # les fichiers bouclables : pas de fondu, la jointure est exacte


# --- Les outils ----------------------------------------------------------------------------------------------------
def rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


def axis(dur: float) -> np.ndarray:
    return np.arange(int(round(dur * SR))) / SR


def stereo(mono: np.ndarray, pan: float = 0.0) -> np.ndarray:
    """Un signal mono placé entre la gauche (-1) et la droite (+1), à puissance constante."""
    th = (pan + 1) * np.pi / 4
    return np.stack([mono * np.cos(th), mono * np.sin(th)])


def lowpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    return signal.sosfilt(signal.butter(order, cutoff, "low", fs=SR, output="sos"), x, axis=-1)


def highpass(x: np.ndarray, cutoff: float, order: int = 2) -> np.ndarray:
    return signal.sosfilt(signal.butter(order, cutoff, "high", fs=SR, output="sos"), x, axis=-1)


def bandpass(x: np.ndarray, lo: float, hi: float) -> np.ndarray:
    return signal.sosfilt(signal.butter(2, [lo, hi], "band", fs=SR, output="sos"), x, axis=-1)


def sweep_band(x: np.ndarray, freqs: np.ndarray, q: float, block: int = 64) -> np.ndarray:
    """Filtre passe-bande à fréquence variable (biquad RBJ, l'état passe d'un bloc au suivant). `freqs` : un Hz par échantillon.
    Un gain en (1500 / f)^0.4 évite que le grave sonne bien plus faible que l'aigu (la bande est plus étroite)."""
    out = np.empty_like(x)
    z = np.zeros(2)
    for s in range(0, len(x), block):
        f0 = float(np.clip(freqs[s:s + block].mean(), 40, SR * 0.45))
        w0 = 2 * np.pi * f0 / SR
        al = np.sin(w0) / (2 * q)
        b = np.array([al, 0, -al]) / (1 + al)
        a = np.array([1, -2 * np.cos(w0) / (1 + al), (1 - al) / (1 + al)])
        out[s:s + block], z = signal.lfilter(b, a, x[s:s + block], zi=z)
    return out * (1500 / np.clip(freqs, 40, SR * 0.45)) ** 0.4


def taper(x: np.ndarray, ms: float) -> np.ndarray:
    """Une fin en demi-cosinus sur les dernières `ms` millisecondes (pour les queues longues)."""
    k = int(ms / 1000 * SR)
    x = x.copy()
    x[..., -k:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, k)))
    return x


def smooth(u: np.ndarray) -> np.ndarray:
    """Marche douce de 0 à 1 (u de 0 à 1)."""
    u = np.clip(u, 0, 1)
    return u * u * (3 - 2 * u)


def make_ir(rt: float, seed: int, predelay: float = 0.012, damp: float = 6500) -> np.ndarray:
    n = int((rt + predelay) * SR)
    t = np.arange(n) / SR
    ir = rng(seed).standard_normal(n) * np.exp(-np.maximum(t - predelay, 0) * 6.9 / rt)
    ir[t < predelay] = 0
    return lowpass(ir, damp)


def reverb(x: np.ndarray, rt: float, seed: int, damp: float = 6500) -> np.ndarray:
    """Réverbération par convolution (une réponse différente par oreille), même longueur que le signal ; à mélanger au sec."""
    return np.stack([signal.fftconvolve(x[c], make_ir(rt, seed + c, damp=damp), mode="full")[:x.shape[1]] * 0.12 for c in range(x.shape[0])])


def with_tail(x: np.ndarray, tail: float) -> np.ndarray:
    return np.concatenate([x, np.zeros((x.shape[0], int(tail * SR)))], axis=1)


def finish(name: str, audio: np.ndarray, fade_ms: float = 3.0) -> None:
    """Fondu de 3 ms au début et à la fin (sauf pour les boucles), crête à -1 dBFS, WAV 48 kHz 16 bits stéréo."""
    audio = audio.copy()
    if name[:-4] not in LOOPS:
        f = int(fade_ms / 1000 * SR)
        audio[:, :f] *= np.linspace(0, 1, f)
        audio[:, -f:] *= np.linspace(1, 0, f)
    audio = audio / np.abs(audio).max() * 10 ** (PEAK_DB / 20)
    OUT.mkdir(parents=True, exist_ok=True)
    pcm = np.round(audio.T * 32767).astype("<i2")
    with wave.open(str(OUT / name), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


# --- Les sons ------------------------------------------------------------------------------------------------------
def whoosh(dur: float, f0: float, f1: float, peak: float, pan0: float, pan1: float, seed: int, q: float, rumble: float = 0.0, air: float = 0.0) -> np.ndarray:
    """Un souffle : bruit (différent à gauche et à droite) filtré passe-bande dont la fréquence glisse de f0 à f1 (exponentielle) ;
    l'enveloppe monte jusqu'à `peak` (fraction de la durée) puis retombe ; le placement stéréo traverse de pan0 à pan1.
    `rumble` : niveau du roulement grave (bruit sous 220 Hz), `air` : niveau du voile aigu (bruit au-dessus de 5 kHz)."""
    t = axis(dur)
    u = t / dur
    freqs = f0 * (f1 / f0) ** (u ** 0.85)
    env = np.where(u < peak, np.sin(0.5 * np.pi * u / peak) ** 2.4, np.cos(0.5 * np.pi * (u - peak) / (1 - peak)) ** 2.0)
    r = rng(seed)
    out = np.stack([sweep_band(r.standard_normal(len(t)), freqs, q) for _ in range(2)])
    if rumble:
        out += np.stack([lowpass(r.standard_normal(len(t)), 220, 3) * 6.0 * rumble for _ in range(2)])
    if air:
        out += np.stack([highpass(r.standard_normal(len(t)), 5000, 2) * 0.5 * air for _ in range(2)])
    s = smooth(u)
    th = (pan0 + (pan1 - pan0) * s + 1) * np.pi / 4
    mono = (out[0] + out[1]) * 0.5
    wide = np.stack([mono * np.cos(th), mono * np.sin(th)]) * 0.7 + out * 0.3
    return wide * env


def sfx_ui_click() -> np.ndarray:
    """130 ms : transitoire aigu (bruit passe-haut, 1,5 ms), ton à 2,1 kHz (6 ms), corps grave de 260 Hz qui descend (30 ms), salle courte."""
    t = axis(0.13)
    click = highpass(rng(7).standard_normal(len(t)), 2500) * np.exp(-t / 0.0016) * 0.55
    tone = np.sin(2 * np.pi * 2100 * t) * np.exp(-t / 0.006) * 0.45
    body = np.sin(2 * np.pi * np.cumsum(260 - 100 * (1 - np.exp(-t / 0.012))) / SR) * np.exp(-t / 0.03) * 0.95
    dry = stereo(lowpass(click + tone + body, 9000), 0.0)
    return taper(dry + reverb(dry, 0.18, 70) * 0.5, 30)


def sfx_ui_tap() -> np.ndarray:
    """110 ms : appui plus rond et plus doux (corps de 190 Hz qui descend, ton de 1,1 kHz, transitoire voilé)."""
    t = axis(0.11)
    click = lowpass(rng(8).standard_normal(len(t)), 4200) * np.exp(-t / 0.0022) * 0.4
    tone = np.sin(2 * np.pi * 1100 * t) * np.exp(-t / 0.008) * 0.35
    body = np.sin(2 * np.pi * np.cumsum(190 - 70 * (1 - np.exp(-t / 0.015))) / SR) * np.exp(-t / 0.026) * 1.0
    dry = stereo(lowpass(click + tone + body, 7000), 0.0)
    return taper(dry + reverb(dry, 0.15, 72) * 0.4, 25)


def sfx_type(seed: int, body_hz: float, band: tuple, pan: float, rel_gain: float) -> np.ndarray:
    """90 ms : une frappe de clavier douce. Le coup de touche (bruit passe-bande de 5 ms + « thock » grave de `body_hz` qui descend), puis
    à 55 ms le relâchement, plus petit (`rel_gain`)."""
    t = axis(0.09)
    r = rng(seed)
    n = bandpass(r.standard_normal(len(t)), *band)
    down = n * np.exp(-t / 0.0035) * 0.9
    thock = np.sin(2 * np.pi * np.cumsum(body_hz * (1 + 0.35 * np.exp(-t / 0.008))) / SR) * np.exp(-t / 0.017) * 0.85
    t2 = np.maximum(t - 0.055, 0)
    up = bandpass(r.standard_normal(len(t)), band[0] * 1.2, band[1]) * (t >= 0.055) * np.exp(-t2 / 0.0028) * rel_gain
    return stereo(lowpass(down + thock + up, 7500), pan)


def sfx_send() -> np.ndarray:
    """450 ms : « bloop » montant — un sinus qui glisse de 330 à 990 Hz en 120 ms (avec son octave), puis un « pip » aigu à 1 760 Hz."""
    t = axis(0.45)
    u = np.clip(t / 0.12, 0, 1)
    freq = 330 * 3 ** (1 - (1 - u) ** 2)
    ph = np.cumsum(freq) / SR
    env = np.minimum(1, t / 0.004) * np.exp(-t / 0.085)
    bloop = (np.sin(2 * np.pi * ph) + 0.22 * np.sin(4 * np.pi * ph)) * env
    t2 = np.maximum(t - 0.11, 0)
    pip = np.sin(2 * np.pi * 1760 * t) * (t >= 0.11) * np.minimum(1, t2 / 0.002) * np.exp(-t2 / 0.11) * 0.38
    dry = stereo(lowpass(bloop + pip, 8000), 0.0)
    return taper(dry + reverb(dry, 0.5, 80) * 0.5, 100)


def fm_voices(t: np.ndarray, voices: list, detune: float = 0.0007, at: float = 0.0) -> np.ndarray:
    """Cloche FM stéréo : chaque voix (hauteur, rapport modulateur/porteuse, indice, durée de l'indice, durée du son, niveau) est jouée
    un peu désaccordée à gauche et à droite ; `at` : l'instant de la note (s)."""
    out = np.zeros((2, len(t)))
    tt = np.maximum(t - at, 0)
    on = (t >= at).astype(float)
    for side, d in enumerate((1 - detune, 1 + detune)):
        for f, ratio, index, tau_i, tau_a, amp in voices:
            f = f * d
            mod = np.sin(2 * np.pi * f * ratio * tt) * index * np.exp(-tt / tau_i)
            out[side] += np.sin(2 * np.pi * f * tt + mod) * np.exp(-tt / tau_a) * amp * on * np.minimum(1, tt / 0.0012)
    return out


def sfx_notif() -> np.ndarray:
    """1,3 s : deux notes de cloche douce, si5 (987,8 Hz) puis mi6 (1 318,5 Hz) 110 ms plus tard ; résonance de 0,8 s."""
    t = axis(1.3)
    voices = lambda f: [(f, 2.0, 2.2, 0.10, 0.34, 1.0), (f * 2, 1.0, 0.8, 0.08, 0.16, 0.22)]  # noqa: E731
    out = fm_voices(t, voices(987.77), at=0.0) * 0.8 + fm_voices(t, voices(1318.51), at=0.11)
    out = lowpass(out, 8500)
    return taper(out + reverb(out, 1.0, 90) * 0.55, 150)


def sfx_chime() -> np.ndarray:
    """2,8 s : cloche cristalline (mi6, FM, indice de 3,6 qui retombe en 0,2 s, partiels inharmoniques à x2, x3,01 et x4,2), résonance
    longue (0,9 s pour la fondamentale), réverbération de 2 s."""
    t = axis(2.8)
    voices = [(1318.51, 2.0, 3.6, 0.20, 0.95, 1.0), (1318.51 * 2.01, 1.5, 1.6, 0.12, 0.55, 0.34), (1318.51 * 3.01, 1.0, 0.8, 0.08, 0.30, 0.16),
              (1318.51 * 4.2, 1.0, 0.4, 0.05, 0.16, 0.07), (659.26, 2.0, 1.0, 0.25, 1.1, 0.30)]
    out = lowpass(fm_voices(t, voices, detune=0.0010), 11000)
    return taper(out + reverb(out, 2.0, 100, damp=7500) * 0.7, 300)


def sfx_glass_tink(f0: float, pan: float, seed: int) -> np.ndarray:
    """650 ms : un tintement de verre — trois partiels (x1, x2,76 et x5,4 de `f0`) qui s'éteignent en 120, 70 et 40 ms, un grain de bruit à
    l'attaque, réverbération courte et claire."""
    t = axis(0.65)
    mono = np.zeros(len(t))
    for ratio, tau, amp in ((1.0, 0.12, 1.0), (2.76, 0.07, 0.45), (5.4, 0.04, 0.25)):
        mono += np.sin(2 * np.pi * f0 * ratio * t) * np.exp(-t / tau) * amp
    mono *= np.minimum(1, t / 0.0004)
    mono += highpass(rng(seed).standard_normal(len(t)), 5000) * np.exp(-t / 0.0014) * 0.3
    dry = stereo(lowpass(mono, 14000), pan)
    return taper(dry + reverb(dry, 0.55, seed + 5, damp=9000) * 0.9, 120)


def sfx_riser() -> np.ndarray:
    """1,5 s : bruit qui monte de 200 à 9 000 Hz + ton (sinus et harmonique) qui monte de 220 à 2 400 Hz + houle grave, avec un trémolo
    qui accélère (5 → 30 Hz) ; le niveau suit u^2.2 : le sommet est la dernière image."""
    dur = 1.5
    t = axis(dur)
    u = t / dur
    r = rng(31)
    nf = 200 * (9000 / 200) ** (u ** 1.15)
    noise = np.stack([sweep_band(r.standard_normal(len(t)), nf, 1.0) for _ in range(2)])
    tf = 220 * (2400 / 220) ** (u ** 1.3)
    ph = np.cumsum(tf) / SR
    tone = lowpass(0.7 * np.sin(2 * np.pi * ph) + 0.25 * np.sin(4 * np.pi * ph) + 0.12 * np.sin(6 * np.pi * ph), 6000)
    swell = np.sin(2 * np.pi * np.cumsum(60 + 70 * u ** 1.5) / SR) * 0.6
    trem = 1 - 0.3 * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(5 + 25 * u ** 1.5) / SR))
    crescendo = 0.03 + 0.97 * u ** 2.2
    out = (noise * 0.85 + stereo(tone, 0.0) * 0.5 + stereo(swell, 0.0) * 0.4) * (trem * crescendo)
    return out


def sfx_impact() -> np.ndarray:
    """2,2 s : coup sourd de cinéma — sinus de 50 Hz qui chute de 130 Hz en 0,05 s (saturé en douceur), un étage à 100 Hz, un transitoire,
    un « poum » à 210 Hz, puis une queue de réverbération de 1,3 s (sans le grave extrême)."""
    dur = 2.2
    t = axis(dur)
    freq = 50 + 80 * np.exp(-t / 0.05)
    ph = np.cumsum(freq) / SR
    body = np.tanh(1.6 * np.sin(2 * np.pi * ph)) * np.exp(-t / 0.42) * 0.8
    body += np.sin(2 * np.pi * np.cumsum(100 + 110 * np.exp(-t / 0.035)) / SR) * np.exp(-t / 0.17) * 0.4
    click = highpass(rng(41).standard_normal(len(t)), 1800) * np.exp(-t / 0.005) * 0.5
    thump = np.sin(2 * np.pi * 210 * t) * np.exp(-t / 0.02) * 0.5
    dry = stereo(body + click + thump, 0.0)
    wet = reverb(highpass(dry, 140), 1.3, 50, damp=3500) * 1.6
    return taper(dry + wet, 400)


def sfx_sub_hit() -> np.ndarray:
    """700 ms : un grave court et rond — sinus de 45 Hz qui tombe de 90 Hz en 40 ms, attaque de 4 ms, une harmonique à 90 Hz, pas de queue."""
    t = axis(0.7)
    freq = 45 + 45 * np.exp(-t / 0.012)
    ph = np.cumsum(freq) / SR
    env = np.minimum(1, t / 0.004) * np.exp(-t / 0.2)
    mono = (np.sin(2 * np.pi * ph) + 0.25 * np.sin(4 * np.pi * ph)) * env
    return taper(stereo(mono, 0.0), 150)


def sfx_tick() -> np.ndarray:
    """25 ms : un tic très léger, sec (sinus amorti à 3 kHz, harmonique à 4,6 kHz, grain de bruit)."""
    t = axis(0.025)
    mono = np.sin(2 * np.pi * 3000 * t) * np.exp(-t / 0.0028) + 0.35 * np.sin(2 * np.pi * 4600 * t) * np.exp(-t / 0.0018)
    mono += highpass(rng(61).standard_normal(len(t)), 3500) * np.exp(-t / 0.0009) * 0.3
    return stereo(lowpass(mono, 8500), 0.0)


def sfx_sparkle() -> np.ndarray:
    """1,0 s : neuf notes aiguës (5 à 9 kHz) qui s'égrènent sur 0,55 s, de plus en plus faibles, placées au hasard dans le champ stéréo ;
    réverbération claire."""
    dur = 1.0
    t = axis(dur)
    r = rng(22)
    pitches = [5274.0, 6272.0, 7040.0, 8372.0, 9397.0, 6272.0, 7459.0, 5588.0, 8000.0]
    out = np.zeros((2, len(t)))
    for k, f in enumerate(pitches):
        at = 0.06 * k + r.uniform(0, 0.025)
        tt = np.maximum(t - at, 0)
        ping = np.sin(2 * np.pi * f * t) * (t >= at) * np.minimum(1, tt / 0.001) * np.exp(-tt / r.uniform(0.07, 0.16)) * (1 - 0.07 * k)
        out += stereo(ping, r.uniform(-0.8, 0.8))
    return taper(out + reverb(out, 0.7, 120, damp=10000) * 1.0, 200)


def sfx_data_blips() -> np.ndarray:
    """1,0 s : quinze petits bips sinus de 30 ms (gamme de mi pentatonique de 1,3 à 2,6 kHz) en rafale irrégulière, qui défilent de gauche à
    droite et de droite à gauche, avec un écho léger : des données qui s'affichent. Enveloppe d'ensemble en cloche douce."""
    dur = 1.0
    t = axis(dur)
    r = rng(33)
    scale = [1318.5, 1480.0, 1661.2, 1975.5, 2217.5, 2637.0]
    out = np.zeros((2, len(t)))
    at = 0.03
    for k in range(15):
        f = scale[int(r.integers(0, len(scale)))]
        tt = np.maximum(t - at, 0)
        env = (t >= at) * np.minimum(1, tt / 0.0025) * np.exp(-tt / 0.011)
        amp = r.uniform(0.55, 1.0) * np.sin(np.pi * (0.1 + 0.8 * at / dur)) ** 0.8
        out += stereo((np.sin(2 * np.pi * f * t) + 0.15 * np.sin(4 * np.pi * f * t)) * env * amp, -0.6 + 1.2 * ((k % 2) * 0.5 + 0.25 * r.random()))
        at += r.uniform(0.045, 0.085)
    echo = np.zeros_like(out)
    d = int(0.11 * SR)
    echo[:, d:] = out[:, :-d] * 0.28
    mix = lowpass(out + echo, 6500)
    return taper(mix + reverb(mix, 0.4, 130) * 0.5, 100)


def sfx_logo_reveal() -> np.ndarray:
    """2,5 s : un accord doux et large qui s'ouvre — mi sus2 (mi3, si3, fa#4, sol#4, si4, mi5), chaque note en trois voix désaccordées
    placées dans le champ ; l'attaque dure 0,55 s, le filtre s'ouvre de 700 à 6 000 Hz en 1,2 s, un scintillement à la fin de l'attaque,
    réverbération de 1,8 s ; à zéro à la dernière image."""
    dur = 2.5
    t = axis(dur)
    notes = [(164.81, -0.5, 1.0), (246.94, 0.4, 0.85), (369.99, -0.3, 0.7), (415.30, 0.3, 0.55), (493.88, -0.6, 0.5), (659.26, 0.6, 0.35)]
    env = smooth(t / 0.55) * np.where(t < 1.0, 1.0, np.exp(-(t - 1.0) / 0.55)) * smooth((dur - t) / 0.35)
    pad = np.zeros((2, len(t)))
    for f, pan, amp in notes:
        voice = np.zeros(len(t))
        for dt in (0.9972, 1.0, 1.0029):
            ph = np.cumsum(np.full(len(t), f * dt)) / SR
            voice += np.sin(2 * np.pi * ph) + 0.35 * np.sin(4 * np.pi * ph) + 0.12 * (2 * (ph % 1.0) - 1)
        pad += stereo(voice * amp / 3, pan)
    op = smooth(t / 1.2)
    pad = (lowpass(pad, 700) * (1 - op) + lowpass(pad, 6000) * op) * env
    shine = np.zeros((2, len(t)))
    for k, (f, at, amp, pan) in enumerate(((2637.0, 0.5, 0.2, -0.4), (3322.4, 0.58, 0.17, 0.4), (3951.1, 0.66, 0.15, -0.2), (5274.0, 0.76, 0.12, 0.5))):
        tt = np.maximum(t - at, 0)
        shine += stereo(np.sin(2 * np.pi * f * t) * (t >= at) * np.minimum(1, tt / 0.002) * np.exp(-tt / 0.25) * amp, pan)
    mix = pad + shine * smooth((dur - t) / 0.4)
    return taper(mix + reverb(mix, 1.8, 140, damp=7000) * 1.1, 200)


def sfx_outro_tail() -> np.ndarray:
    """3,0 s : une traînée ambiante qui s'éteint — nappe grave (mi2, si2, mi3, si3) qui gonfle en 0,8 s puis décroît, souffle filtré
    (300 à 1 800 Hz) qui respire, réverbération de 2 s ; la dernière image est à zéro."""
    dur = 3.0
    t = axis(dur)
    env = smooth(t / 0.8) * np.exp(-np.maximum(t - 0.8, 0) / 0.95) * smooth((dur - t) / 0.5)
    pad = np.zeros((2, len(t)))
    for f, pan, amp in ((82.41, -0.3, 1.0), (123.47, 0.3, 0.8), (164.81, -0.5, 0.6), (246.94, 0.5, 0.45)):
        voice = np.zeros(len(t))
        for dt in (0.9985, 1.0015):
            ph = np.cumsum(np.full(len(t), f * dt)) / SR
            voice += np.sin(2 * np.pi * ph) + 0.3 * np.sin(4 * np.pi * ph)
        pad += stereo(voice * amp / 2, pan)
    r = rng(51)
    breath = np.stack([bandpass(r.standard_normal(len(t)), 300, 1800) for _ in range(2)]) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.7 * t + 1.0)) * 0.8
    mix = lowpass(pad * 0.9 + breath * 0.7, 2500) * env
    return taper(mix + reverb(mix, 2.0, 150, damp=4500) * 1.2, 300)


def sfx_room_tone() -> np.ndarray:
    """8 s de souffle grave, périodique : un bruit mis en forme dans le domaine de Fourier (pente en 1/f entre 40 et 320 Hz, une trace d'air
    autour de 3 kHz), différent à gauche et à droite ; le volume respire (2 cycles par boucle). Le début et la fin se raccordent sans saut."""
    dur = 8.0
    n = int(dur * SR)
    t = np.arange(n) / SR
    fr = np.fft.rfftfreq(n, 1 / SR)
    low = 1 / np.sqrt(np.maximum(fr, 40) / 40) * (fr >= 25) * 1 / (1 + (fr / 320) ** 4)
    air = 0.012 * np.exp(-0.5 * (np.log(np.maximum(fr, 1) / 3000) / 0.5) ** 2)
    shape = low + air
    out = np.zeros((2, n))
    for c in range(2):
        out[c] = np.fft.irfft(np.fft.rfft(rng(200 + c).standard_normal(n)) * shape, n)
        out[c] *= 1 + 0.18 * np.sin(2 * np.pi * 2 * t / dur + 1.7 * c)
    return out


# --- L'écriture et les mesures -------------------------------------------------------------------------------------
def banque() -> dict:
    """Le nom du fichier (sans .wav) → le signal stéréo (2, n)."""
    bank = {}
    bank["whoosh_soft"] = whoosh(0.9, 450, 3800, 0.5, 0.8, -0.8, 11, q=0.9, rumble=0.05)
    bank["whoosh_hard"] = whoosh(1.1, 200, 7500, 0.55, -1.0, 1.0, 12, q=1.3, rumble=0.2, air=0.25)
    bank["swipe"] = whoosh(0.3, 1200, 6000, 0.5, 0.7, -0.7, 13, q=2.0)
    bank["ui_click"] = sfx_ui_click()
    bank["ui_tap"] = sfx_ui_tap()
    for i, (seed, body, band, pan, rel) in enumerate((
        (301, 150, (1800, 5500), -0.25, 0.28), (302, 190, (1400, 4800), 0.15, 0.22),
        (303, 230, (2200, 6500), -0.1, 0.30), (304, 170, (1600, 5200), 0.30, 0.20),
    ), start=1):
        bank[f"type{i}"] = sfx_type(seed, body, band, pan, rel)
    bank["send"] = sfx_send()
    bank["notif"] = sfx_notif()
    bank["chime"] = sfx_chime()
    bank["glass_tink"] = sfx_glass_tink(2800.0, -0.25, 401)
    bank["glass_tink2"] = sfx_glass_tink(3500.0, 0.3, 411)
    bank["glass_tink3"] = sfx_glass_tink(4200.0, -0.1, 421)
    bank["riser"] = sfx_riser()
    bank["impact"] = sfx_impact()
    bank["sub_hit"] = sfx_sub_hit()
    bank["tick"] = sfx_tick()
    bank["sparkle"] = sfx_sparkle()
    bank["data_blips"] = sfx_data_blips()
    bank["logo_reveal"] = sfx_logo_reveal()
    bank["outro_tail"] = sfx_outro_tail()
    bank["room_tone"] = sfx_room_tone()
    return bank


def mesure(path: Path) -> tuple:
    """Relit le WAV écrit : (durée en s, crête en dBFS, |premier échantillon|, |dernier échantillon|, plus longue plage consécutive
    à 99,9 % de la crête, en échantillons, niveau efficace en dBFS)."""
    with wave.open(str(path), "rb") as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (2, 2, SR), path.name
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, 2).astype(float) / 32768
    peak = np.abs(pcm).max()
    hot = (np.abs(pcm).max(axis=1) >= peak * 0.999).astype(int)
    run = max((len(g) for g in np.split(hot, np.flatnonzero(np.diff(hot)) + 1) if g[0] == 1), default=0)
    rms = 20 * np.log10(np.sqrt((pcm ** 2).mean()) + 1e-12)
    return pcm.shape[0] / SR, 20 * np.log10(peak), np.abs(pcm[0]).max(), np.abs(pcm[-1]).max(), run, rms


def main() -> None:
    bank = banque()
    for name, audio in bank.items():
        assert np.isfinite(audio).all(), name
        finish(f"{name}.wav", audio)
    print(f"{'fichier':<18}{'durée':>8}{'crête':>10}{'efficace':>10}{'début':>9}{'fin':>9}{'plage':>7}")
    ok = True
    for name in bank:
        dur, peak, first, last, run, rms = mesure(OUT / f"{name}.wav")
        loop = name in LOOPS
        bad = abs(peak - PEAK_DB) > 0.05 or (not loop and (first > 0.003 or last > 0.003)) or run > 16
        ok &= not bad
        print(f"{name + '.wav':<18}{dur * 1000:>6.0f}ms{peak:>8.2f}dB{rms:>8.1f}dB{first:>9.4f}{last:>9.4f}{run:>7}{'   <-- À VÉRIFIER' if bad else ''}")
    print(f"bilan : {len(bank)} fichiers dans {OUT}, " + ("toutes les règles sont respectées (crête -1 dBFS, fondus, pas de saturation)" if ok else "UNE RÈGLE EST ENFREINTE"))

    # La boucle : l'écart entre la fin et le début (continuité), à comparer à un pas normal du signal
    rt = bank["room_tone"]
    jump = np.abs(rt[:, 0] - rt[:, -1]).max() / np.abs(rt).max()
    print(f"room_tone : écart fin/début = {jump:.4f} de la crête (un pas normal vaut {np.abs(np.diff(rt, axis=1)).mean() / np.abs(rt).max():.4f})")


if __name__ == "__main__":
    main()
