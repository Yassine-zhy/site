"""La banque de bruitages de la publicité « Pixel » (composition Remotion `Pixel`, video/src/pixel/son.tsx), composée par le code :
rien sous droits, rien à télécharger. Tout est synthétisé (ondes carrées 8 bits, modulation de fréquence, bruit filtré) puis écrit
dans video/public/sfx-pixel/ : WAV 48 kHz 16 bits stéréo, crête normalisée à -1 dBFS, fondus de 3 ms au début et à la fin
(donc jamais de clic), aucune saturation (rien n'est écrêté : le signal est mis à l'échelle, jamais coupé).

Les sons de la carte (son.tsx) sont réglés en volume au cas par cas : ici tous les fichiers ont la même crête, c'est le
mixage qui fait le premier plan et le fond.

    nom          durée    ce que c'est
    blip1..5     60-90 ms petit « pop » 8 bits : onde carrée (rapport cyclique 50 % ou 25 %) dont la hauteur glisse vers le haut ;
                          ré5, fa#5, la5, do#6, mi6 ; un par icône qui surgit
    coin         350 ms   la pièce classique : deux notes carrées, si5 puis mi6
    chime        1,7 s    cloche de notification claire (synthèse FM, attaque nette, longue résonance de 1,5 s)
    chime_soft   1,2 s    la même, douce : attaque arrondie, moins de brillance, moins d'harmoniques
    whoosh_up    450 ms   souffle : bruit filtré passe-bande dont la fréquence monte, de la gauche vers la droite ; sommet aux 3/4
    whoosh_down  400 ms   souffle qui descend en fréquence, de la droite vers la gauche ; sommet au premier quart
    riser        1,2 s    montée de tension : bruit + ton qui montent, trémolo qui accélère, crescendo ; le sommet est la DERNIÈRE
                          image du fichier : on le place pour qu'il finisse pile sur le temps fort
    impact       1,4 s    coup sourd de cinéma : sinus de 55 Hz qui chute + clic de transitoire + queue de réverbération courte
    sub_drop     600 ms   grave qui tombe de 100 à 40 Hz
    glitch1      180 ms   dissolution en pixels : rafale de bruit « bitcrushé » hachée en marches (hauteur, résolution et niveau
    glitch2      240 ms   changent toutes les 8 à 25 ms)
    tick         15 ms    petit clic doux et sec, pour l'apparition d'un mot
    swish_loop   2 s      souffle d'air continu et modulé, BOUCLABLE (bruit filtré dans le domaine de Fourier : la fin retombe
                          exactement sur le début, et un creux de souffle tombe à la jointure)
    pop_logo     800 ms   apparition du logo : « bloop » rond puis scintillement aigu
    letters      820 ms   neuf petites notes 8 bits qui montent vite (gamme pentatonique de do, do5 à sol6), une par lettre
    stamp        110 ms   « tchak » sec : un souffle aigu, puis un clac plus mat

Mesures, relues dans les WAV écrits (à chaque exécution le script les refait et signale toute règle enfreinte) :
    toutes les crêtes valent -1,00 dBFS ; le premier et le dernier échantillon valent 0 (fondus de 3 ms) ; aucune plage
    de plus de 16 échantillons consécutifs à la crête (pas d'écrêtage : la plus longue, 9, est le sommet arrondi du sub_drop).
    durées : blip1 62 ms, blip2 70, blip3 78, blip4 84, blip5 90, coin 350, chime 1700, chime_soft 1200, whoosh_up 450,
    whoosh_down 400, riser 1200, impact 1400, sub_drop 600, glitch1 180, glitch2 240, tick 15, swish_loop 2000, pop_logo 800,
    letters 820, stamp 110 (millisecondes). swish_loop : écart entre la fin et le début avant les fondus = 0,048 de la crête,
    soit un pas ordinaire du signal (0,049) : la boucle ne fait pas de saut.

Depuis le dossier finveille/ (scipy est nécessaire) :
    python tools/pixel_sfx.py
"""

import wave
from pathlib import Path

import numpy as np
from scipy import signal

SR = 48000
PEAK_DB = -1.0
OUT = Path(__file__).resolve().parent.parent / "video" / "public" / "sfx-pixel"


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


def square(freq: np.ndarray, duty: float = 0.5) -> np.ndarray:
    """Onde carrée (ou rectangulaire) à fréquence variable : l'oscillateur d'une console 8 bits."""
    phase = np.cumsum(freq) / SR
    return np.where(phase % 1.0 < duty, 1.0, -1.0)


def steps(env: np.ndarray, levels: int = 15) -> np.ndarray:
    """Enveloppe en marches, comme le volume à 4 bits d'une console (15 niveaux)."""
    return np.round(env * levels) / levels


def taper(x: np.ndarray, ms: float) -> np.ndarray:
    """Une fin en demi-cosinus sur les dernières `ms` millisecondes (pour les queues longues)."""
    k = int(ms / 1000 * SR)
    x = x.copy()
    x[..., -k:] *= 0.5 * (1 + np.cos(np.linspace(0, np.pi, k)))
    return x


def make_ir(rt: float, seed: int, predelay: float = 0.01) -> np.ndarray:
    n = int((rt + predelay) * SR)
    t = np.arange(n) / SR
    ir = rng(seed).standard_normal(n) * np.exp(-np.maximum(t - predelay, 0) * 6.9 / rt)
    ir[t < predelay] = 0
    return lowpass(ir, 6500)


def reverb(x: np.ndarray, rt: float, seed: int, tail: float | None = None) -> np.ndarray:
    """Réverbération par convolution, une réponse différente par oreille ; le résultat est allongé de `tail` secondes."""
    pad = int((tail if tail is not None else rt) * SR)
    xp = np.concatenate([x, np.zeros((x.shape[0], pad))], axis=1)
    return np.stack([signal.fftconvolve(xp[c], make_ir(rt, seed + c), mode="full")[:xp.shape[1]] * 0.12 for c in range(x.shape[0])])


def pad_to(x: np.ndarray, n: int) -> np.ndarray:
    return np.concatenate([x, np.zeros((x.shape[0], n - x.shape[1]))], axis=1) if x.shape[1] < n else x


def finish(name: str, audio: np.ndarray, fade_ms: float = 3.0) -> None:
    """Fondu de 3 ms au début et à la fin, crête à -1 dBFS, WAV 48 kHz 16 bits stéréo."""
    audio = audio.copy()
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
def blip(f0: float, dur: float, glide: float, duty: float, pan: float) -> np.ndarray:
    """Un « pop » 8 bits : la hauteur glisse vers le haut (de f0 à f0 x glide), vite au début ; volume en marches, qui retombe."""
    t = axis(dur)
    freq = f0 * (1 + (glide - 1) * (1 - np.exp(-t / (dur * 0.38))))
    env = steps(np.clip(1 - t / dur, 0, 1) ** 1.3)
    return stereo(lowpass(square(freq, duty) * env, 9000), pan)


def sfx_coin() -> np.ndarray:
    """Si5 (987,77 Hz) pendant 85 ms, puis mi6 (1318,5 Hz) qui tient puis s'éteint : 350 ms en tout."""
    t = axis(0.35)
    freq = np.where(t < 0.085, 987.77, 1318.51)
    env = np.where(t < 0.085, 1.0, np.clip(1 - (t - 0.185) / 0.165, 0, 1) ** 1.0)
    env = steps(np.where((t >= 0.085) & (t < 0.185), 1.0, env))
    return stereo(lowpass(square(freq, 0.5) * env, 9000), 0.0)


def fm_bell(dur: float, voices: list, tilt: float, attack: float, rt: float, rv: float, rv_mix: float) -> np.ndarray:
    """Cloche FM : chaque voix (hauteur, rapport modulateur/porteuse, indice, durée de l'indice, durée du son, niveau)
    est jouée un peu désaccordée à gauche et à droite, pour l'élargissement."""
    t = axis(dur)
    out = np.zeros((2, len(t)))
    for side, detune in enumerate((0.9993, 1.0007)):
        for f, ratio, index, tau_i, tau_a, amp in voices:
            f *= detune
            mod = np.sin(2 * np.pi * f * ratio * t) * index * np.exp(-t / tau_i)
            out[side] += np.sin(2 * np.pi * f * t + mod) * np.exp(-t / tau_a) * amp
    out *= np.minimum(1, t / attack)
    out = lowpass(out, tilt)
    return taper(out + reverb(out, rv, 20)[:, :len(t)] * rv_mix, 120)


def sfx_chime() -> np.ndarray:
    """Mi6 avec un attaque nette (indice de 4.5 qui retombe en 0,12 s) ; résonance de 1,5 s ; une octave au-dessus pour l'éclat."""
    return fm_bell(1.7, [(1318.5, 2.0, 4.5, 0.12, 0.55, 1.0), (2637.0, 1.5, 2.0, 0.08, 0.32, 0.30), (3951.0, 1.0, 1.0, 0.05, 0.18, 0.10)],
                   tilt=9000, attack=0.0008, rt=1.2, rv=1.0, rv_mix=0.35)


def sfx_chime_soft() -> np.ndarray:
    """Do6 doux : attaque arrondie (6 ms), indice faible, coupée au-dessus de 4 kHz."""
    return fm_bell(1.2, [(1046.5, 2.0, 1.6, 0.20, 0.40, 1.0), (2093.0, 1.0, 0.6, 0.12, 0.22, 0.18)],
                   tilt=4200, attack=0.006, rt=0.9, rv=0.8, rv_mix=0.30)


def whoosh(dur: float, f0: float, f1: float, peak: float, pan0: float, pan1: float, seed: int, q: float = 1.5) -> np.ndarray:
    """Un souffle : bruit (différent à gauche et à droite) filtré passe-bande dont la fréquence glisse de f0 à f1 (exponentielle) ;
    l'enveloppe monte jusqu'à `peak` (fraction de la durée) puis retombe vite ; le placement stéréo va de pan0 à pan1."""
    t = axis(dur)
    u = t / dur
    freqs = f0 * (f1 / f0) ** (u ** 0.85)
    env = np.where(u < peak, (u / peak) ** 2.2, ((1 - u) / (1 - peak)) ** 1.6)
    r = rng(seed)
    out = np.stack([sweep_band(r.standard_normal(len(t)), freqs, q) for _ in range(2)])
    # le placement : de la gauche vers la droite (ou l'inverse), à puissance constante, adouci
    s = u * u * (3 - 2 * u)
    th = (pan0 + (pan1 - pan0) * s + 1) * np.pi / 4
    mono = (out[0] + out[1]) * 0.5
    wide = np.stack([mono * np.cos(th), mono * np.sin(th)]) * 0.75 + out * 0.25
    return wide * env


def sfx_riser() -> np.ndarray:
    """1,2 s : bruit qui monte de 250 à 7000 Hz + ton (scie et sinus) qui monte de 180 à 1500 Hz, avec un trémolo qui accélère
    (6 → 34 Hz) ; le niveau suit u^2.4 : le sommet est la dernière image."""
    dur = 1.2
    t = axis(dur)
    u = t / dur
    r = rng(31)
    nf = 250 * (7000 / 250) ** (u ** 1.1)
    noise = np.stack([sweep_band(r.standard_normal(len(t)), nf, 1.1) for _ in range(2)])
    tf = 180 * (1500 / 180) ** (u ** 1.3)
    ph = np.cumsum(tf) / SR
    saw = 2 * (ph % 1.0) - 1
    tone = lowpass(0.55 * np.sin(2 * np.pi * ph) + 0.30 * saw + 0.15 * np.sin(4 * np.pi * ph), 5000)
    trem = 1 - 0.35 * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(6 + 28 * u ** 1.5) / SR))
    crescendo = 0.04 + 0.96 * u ** 2.4
    out = (noise * 0.8 + stereo(tone, 0.0) * 0.55) * (trem * crescendo)
    return out


def sfx_impact() -> np.ndarray:
    """Coup sourd : sinus de 55 Hz (qui chute de 150 Hz en 0,12 s) + son plus aigu pour les petits haut-parleurs, clic de
    transitoire, queue de réverbération courte."""
    dur = 1.4
    t = axis(dur)
    freq = 55 + 95 * np.exp(-t / 0.035)
    ph = np.cumsum(freq) / SR
    body = np.tanh(1.7 * np.sin(2 * np.pi * ph)) * np.exp(-t / 0.38) * 0.75
    body += np.sin(2 * np.pi * np.cumsum(110 + 120 * np.exp(-t / 0.03)) / SR) * np.exp(-t / 0.16) * 0.35
    click = highpass(rng(41).standard_normal(len(t)), 1800) * np.exp(-t / 0.004) * 0.55
    thump = np.sin(2 * np.pi * 210 * t) * np.exp(-t / 0.018) * 0.5
    mono = body + click + thump
    dry = stereo(mono, 0.0)
    wet = reverb(highpass(dry, 130), 0.8, 50, tail=0.3)[:, :len(t)] * 1.3
    return taper(dry + wet, 200)


def sfx_sub_drop() -> np.ndarray:
    """Grave qui tombe de 100 à 40 Hz en 600 ms ; une harmonique douce pour qu'on l'entende aussi sur un petit haut-parleur."""
    t = axis(0.6)
    u = t / 0.6
    freq = 100 * (0.4 ** (u ** 0.75))
    ph = np.cumsum(freq) / SR
    env = np.minimum(1, t / 0.006) * np.exp(-t / 0.28)
    mono = np.tanh(0.9 * np.sin(2 * np.pi * ph)) * env
    return taper(stereo(mono, 0.0), 90)


def sfx_glitch(dur: float, seed: int, step_ms: tuple) -> np.ndarray:
    """Une rafale de bruit « bitcrushé » hachée en marches : toutes les 8 à 25 ms, le pas d'échantillonnage (le bruit est tenu
    pendant 4 à 90 échantillons), la résolution (2 à 4 bits), le niveau et parfois un ton carré changent."""
    n = int(dur * SR)
    r = rng(seed)
    out = np.zeros((2, n))
    pos = 0
    while pos < n:
        ln = int(r.uniform(*step_ms) / 1000 * SR)
        hold = int(r.choice([4, 9, 16, 30, 60, 90]))
        bits = int(r.choice([2, 3, 4]))
        gain = float(r.choice([1.0, 0.7, 0.35, 0.0, 0.8]))
        tone_f = float(r.uniform(300, 2600)) if r.random() < 0.35 else 0.0
        seg = min(ln, n - pos)
        for c in range(2):
            raw = r.uniform(-1, 1, seg // hold + 1)
            held = np.repeat(raw, hold)[:seg]
            lv = 2 ** (bits - 1)
            x = np.round(held * lv) / lv
            if tone_f:
                x = 0.6 * x + 0.5 * square(np.full(seg, tone_f), 0.25) * 0.6
            out[c, pos:pos + seg] = x * gain
        pos += seg
    u = np.arange(n) / n
    out *= (1 - 0.55 * u)
    return highpass(lowpass(out, 12000), 300)


def sfx_tick() -> np.ndarray:
    """15 ms : un clic doux et sec (sinus amorti à 2,2 kHz, harmonique à 3,6 kHz, grain de bruit)."""
    t = axis(0.015)
    mono = np.sin(2 * np.pi * 2200 * t) * np.exp(-t / 0.0032) + 0.4 * np.sin(2 * np.pi * 3600 * t) * np.exp(-t / 0.002)
    mono += lowpass(rng(61).standard_normal(len(t)), 5000) * np.exp(-t / 0.0012) * 0.25
    return stereo(lowpass(mono, 6500), 0.0)


def sfx_swish_loop() -> np.ndarray:
    """2 s d'air en boucle : bruit mis en forme dans le domaine de Fourier (donc périodique), en trois bandes (grave, médium,
    aigu) que des oscillations lentes — 1, 2 et 3 cycles par boucle, déphasées à gauche et à droite — font respirer ; un creux de
    souffle (x 0,3) tombe à la jointure. Le début et la fin se raccordent sans saut, avant même les fondus de 3 ms."""
    dur = 2.0
    n = int(dur * SR)
    t = np.arange(n) / SR
    freqs = np.fft.rfftfreq(n, 1 / SR)

    def band(lo: float, hi: float, seed: int) -> np.ndarray:
        spec = np.fft.rfft(np.random.default_rng(seed).standard_normal(n))
        shape = np.exp(-0.5 * (np.log(np.maximum(freqs, 1) / np.sqrt(lo * hi)) / np.log(hi / lo) * 2.4) ** 2)
        return np.fft.irfft(spec * shape, n)

    out = np.zeros((2, n))
    for c, dphi in enumerate((0.0, 0.9)):
        low = band(250, 800, 100 + c) * (0.65 + 0.35 * np.cos(2 * np.pi * t / dur + dphi))
        mid = band(800, 2800, 110 + c) * (0.55 + 0.45 * np.sin(2 * np.pi * 2 * t / dur + 1.3 + dphi))
        high = band(2800, 7500, 120 + c) * (0.40 + 0.35 * np.sin(2 * np.pi * 3 * t / dur + 0.4 - dphi))
        x = low * 1.0 + mid * 1.2 + high * 1.5
        out[c] = x
    out *= (0.3 + 0.7 * np.sin(np.pi * t / dur) ** 2)
    return out


def sfx_pop_logo() -> np.ndarray:
    """Un « bloop » rond (sinus qui monte de 220 à 640 Hz) puis un scintillement : quatre petites notes aiguës qui se suivent."""
    dur = 0.8
    t = axis(dur)
    mono = np.zeros(len(t))
    tb = t[: int(0.25 * SR)]
    fb = 640 - 420 * np.exp(-tb / 0.035)
    pb = np.cumsum(fb) / SR
    bloop = (np.sin(2 * np.pi * pb) + 0.25 * np.sin(4 * np.pi * pb)) * np.minimum(1, tb / 0.002) * np.exp(-tb / 0.075)
    mono[: len(tb)] += bloop * 0.95
    out = stereo(mono, 0.0)
    for k, (f, at, amp, pan) in enumerate(((2637.0, 0.07, 0.36, -0.5), (3322.4, 0.115, 0.32, 0.5), (3951.1, 0.16, 0.28, -0.3), (5274.0, 0.215, 0.24, 0.4))):
        tt = np.maximum(t - at, 0)
        ping = np.sin(2 * np.pi * f * t) * (t >= at) * np.exp(-tt / 0.13) * np.minimum(1, tt / 0.001)
        out += stereo(ping * amp, pan)
    return taper(out + reverb(highpass(out, 600), 0.5, 80, tail=0.0) * 0.5, 120)


def sfx_letters() -> np.ndarray:
    """Neuf notes carrées (25 %) qui montent en gamme pentatonique de do, une toutes les 85 ms : une par lettre de « finveille »."""
    notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98]
    n = int(0.82 * SR)
    out = np.zeros((2, n))
    for i, f in enumerate(notes):
        at = int(i * 0.085 * SR)
        ln = int((0.13 if i < 8 else 0.14) * SR)
        t = np.arange(ln) / SR
        env = steps(np.clip(1 - t / (ln / SR), 0, 1) ** 1.2)
        out[:, at:at + ln] += stereo(lowpass(square(np.full(ln, f), 0.25) * env, 9000), -0.35 + 0.7 * i / 8)[:, :min(ln, n - at)]
    return out


def sfx_stamp() -> np.ndarray:
    """Un « tchak » sec : un souffle aigu de 25 ms, puis à 24 ms un clac plus mat avec un coup grave court."""
    n = int(0.11 * SR)
    t = np.arange(n) / SR
    r = rng(91)
    tch = bandpass(r.standard_normal(n), 2500, 8000) * np.exp(-t / 0.008)
    t2 = np.maximum(t - 0.024, 0)
    clack = bandpass(r.standard_normal(n), 900, 3500) * (t >= 0.024) * np.exp(-t2 / 0.011)
    thump = np.sin(2 * np.pi * np.cumsum(190 - 90 * np.minimum(t2 / 0.04, 1)) / SR) * (t >= 0.024) * np.exp(-t2 / 0.026) * 0.9
    return stereo(tch * 0.7 + clack * 1.1 + thump, 0.0)


# --- L'écriture et les mesures -------------------------------------------------------------------------------------
def banque() -> dict:
    """Le nom du fichier (sans .wav) → le signal stéréo (2, n)."""
    bank = {}
    for i, (f0, dur, glide, duty, pan) in enumerate((
        (587.33, 0.062, 1.50, 0.50, -0.25),   # blip1 : ré5
        (739.99, 0.070, 1.40, 0.25, 0.20),    # blip2 : fa#5
        (880.00, 0.078, 1.50, 0.50, -0.10),   # blip3 : la5
        (1108.73, 0.084, 1.35, 0.25, 0.30),   # blip4 : do#6
        (1318.51, 0.090, 1.45, 0.50, 0.0),    # blip5 : mi6
    ), start=1):
        bank[f"blip{i}"] = blip(f0, dur, glide, duty, pan)
    bank["coin"] = sfx_coin()
    bank["chime"] = sfx_chime()
    bank["chime_soft"] = sfx_chime_soft()
    bank["whoosh_up"] = whoosh(0.45, 320, 5600, 0.75, -1.0, 1.0, 11)
    bank["whoosh_down"] = whoosh(0.40, 6000, 260, 0.25, 1.0, -1.0, 12)
    bank["riser"] = sfx_riser()
    bank["impact"] = sfx_impact()
    bank["sub_drop"] = sfx_sub_drop()
    bank["glitch1"] = sfx_glitch(0.18, 5, (8, 20))
    bank["glitch2"] = sfx_glitch(0.24, 6, (12, 25))
    bank["tick"] = sfx_tick()
    bank["swish_loop"] = sfx_swish_loop()
    bank["pop_logo"] = sfx_pop_logo()
    bank["letters"] = sfx_letters()
    bank["stamp"] = sfx_stamp()
    return bank


def mesure(path: Path) -> tuple:
    """Relit le WAV écrit : (durée en s, crête en dBFS, |premier échantillon|, |dernier échantillon|, plus longue plage consécutive
    à 99,9 % de la crête, en échantillons)."""
    with wave.open(str(path), "rb") as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (2, 2, SR), path.name
        pcm = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").reshape(-1, 2).astype(float) / 32768
    peak = np.abs(pcm).max()
    hot = (np.abs(pcm).max(axis=1) >= peak * 0.999).astype(int)
    run = max((len(g) for g in np.split(hot, np.flatnonzero(np.diff(hot)) + 1) if g[0] == 1), default=0)
    return pcm.shape[0] / SR, 20 * np.log10(peak), np.abs(pcm[0]).max(), np.abs(pcm[-1]).max(), run


def main() -> None:
    bank = banque()
    for name, audio in bank.items():
        assert np.isfinite(audio).all(), name
        finish(f"{name}.wav", audio)
    print(f"{'fichier':<14}{'durée':>8}{'crête':>10}{'début':>9}{'fin':>9}{'plage':>7}")
    ok = True
    for name in bank:
        dur, peak, first, last, run = mesure(OUT / f"{name}.wav")
        bad = abs(peak - PEAK_DB) > 0.05 or first > 0.003 or last > 0.003 or run > 16
        ok &= not bad
        print(f"{name + '.wav':<14}{dur * 1000:>6.0f}ms{peak:>8.2f}dB{first:>9.4f}{last:>9.4f}{run:>7}{'   <-- À VÉRIFIER' if bad else ''}")
    print(f"bilan : {len(bank)} fichiers dans {OUT}, " + ("toutes les règles sont respectées (crête -1 dBFS, fondus, pas de saturation)" if ok else "UNE RÈGLE EST ENFREINTE"))

    # La boucle : l'écart entre la fin et le début avant les fondus (continuité de la boucle)
    sw = bank["swish_loop"]
    jump = np.abs(sw[:, 0] - sw[:, -1]).max() / np.abs(sw).max()
    print(f"swish_loop : écart fin/début avant fondus = {jump:.4f} de la crête (un pas normal vaut {np.abs(np.diff(sw, axis=1)).mean() / np.abs(sw).max():.4f})")


if __name__ == "__main__":
    main()
