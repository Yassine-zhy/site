"""La musique de la bande-annonce (étape 37), montée sur la grille du film.

Depuis le dossier finveille/ :
    python tools/trailer_assets.py            # video/public/music/edit.wav

« Expressive Courage », sur Mixkit (licence Mixkit : libre dans une vidéo, même commerciale, sans citer l'auteur ;
interdit de redistribuer le fichier seul, d'où son absence du dépôt). Le script le télécharge une fois, puis le monte :
127 battements par minute, un temps = 0,4724 s, une mesure = 4 temps ; la mesure 0 (le drop) est à 16,03 s du morceau.
- 3 mesures d'intro (10,36 → 16,03 s du morceau) ; aux temps 8 et 9 du film la musique se coupe (une seconde de
  silence : l'appui sur le logo), elle repart au temps 10 (l'application s'ouvre) ;
- 15 mesures pleines (→ 44,38 s du morceau), puis raccord sur la mesure 31 (74,61 s) : même place dans le cycle de
  quatre accords que la mesure qui aurait suivi, ce qui saute le passage creux du milieu ;
- la seconde partie jusqu'à l'arrêt final (90,67 s du morceau, le temps 106 du film) et la cymbale qui s'éteint ;
- le film dure 53 s ; fondu de sortie sur la dernière seconde et demie.
"""

import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "video" / "public"
TRACK_URL = "https://assets.mixkit.co/music/468/468.mp3"

BEAT = 0.4724  # s
GRID0 = 16.0315  # le temps 0 du morceau : la mesure du drop
FILM = 3180 / 60  # la durée du film, en secondes
T = lambda beat: GRID0 + beat * BEAT  # noqa: E731 - l'instant d'un temps du morceau (négatif : l'intro)


def music() -> Path:
    """Télécharge le morceau (une seule fois) et écrit le montage, en WAV 48 kHz stéréo."""
    src = PUBLIC / "music" / "468.mp3"
    src.parent.mkdir(parents=True, exist_ok=True)
    if not src.exists():
        urllib.request.urlretrieve(TRACK_URL, src)
    a0, a1 = T(-12), T(60)  # l'intro, le drop et la première partie
    b0 = T(124)  # la mesure 31 de la seconde partie, jusqu'à la fin
    b1 = b0 + FILM - (a1 - a0)
    xf = 0.02  # un fondu enchaîné très court, centré sur le raccord
    out = src.parent / "edit.wav"
    graph = (f"[0]atrim={a0:.4f}:{a1 + xf / 2:.4f},asetpts=N/SR/TB[a];"
             f"[0]atrim={b0 - xf / 2:.4f}:{b1:.4f},asetpts=N/SR/TB[b];"
             f"[a][b]acrossfade=d={xf}:c1=qsin:c2=qsin,afade=t=in:d=0.02,"
             f"afade=t=out:st={FILM - 1.5:.3f}:d=1.5,aresample=48000[m]")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(src), "-filter_complex", graph, "-map", "[m]",
                    "-ac", "2", "-c:a", "pcm_s16le", str(out)], check=True)
    return out


if __name__ == "__main__":
    print("musique :", music())
