"""La musique et le mur des maquettes de la bande-annonce (étape 36).

Depuis le dossier finveille/ :
    python tools/trailer_assets.py            # video/public/music/edit.wav et video/public/models-grid.mp4

1. La musique : « Uplifting Bass » de Lily J, sur Mixkit (licence Mixkit : libre pour une vidéo, même commerciale, sans
   citer l'auteur ; interdit de redistribuer le fichier seul, d'où son absence du dépôt). Le script la télécharge,
   puis la monte sur sa grille : 67 battements par minute (des triolets de charleston par-dessus), un temps =
   0,89555 s, une mesure = 4 temps ; le drop tombe à 14,34 s du morceau.
   - 1 mesure d'intro calme, puis le drop et 6 mesures pleines (10,76 → 35,83 s du morceau) ;
   - raccord sur la mesure 18 après le drop (78,82 s), même accord que la mesure qui aurait suivi : la dernière
     mesure de batterie, puis l'accord final (82,40 s du morceau), qui tombe sur le logo (le temps 32 du film) ;
   - le film dure 33,33 s ; l'accord s'éteint en fondu sur la dernière seconde et demie.
2. Le mur : 15 des 17 maquettes filmées par tools/vitrines_film.py (video/public/models/), recadrées en tuiles de
   600 × 390 et rangées en 5 × 3 (54 px d'écart) dans une seule vidéo, que la scène incline en 3D : une seule vidéo à
   décoder au lieu de quinze.
"""

import subprocess
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "video" / "public"
TRACK_URL = "https://assets.mixkit.co/music/726/726.mp3"

BEAT = 0.89555  # s
GRID0 = 14.3388  # le temps 0 du morceau : le drop
FILM = 2000 / 60  # la durée du film, en secondes
T = lambda beat: GRID0 + beat * BEAT  # noqa: E731 - l'instant d'un temps du morceau (négatif : l'intro)

# Le mur : l'ordre des tuiles, ligne par ligne (la sphère de l'assistant au centre, la cloche à sa droite)
WALL = ["city", "paper", "globe", "coins", "ridges",
        "lens", "bars", "orb", "bell", "duel",
        "books", "ring", "stairs", "bookmark", "gear"]
TILE, GAP, COLS = (600, 390), 54, 5


def music() -> Path:
    """Télécharge le morceau (une seule fois) et écrit le montage, en WAV 48 kHz stéréo."""
    src = PUBLIC / "music" / "726.mp3"
    src.parent.mkdir(parents=True, exist_ok=True)
    if not src.exists():
        urllib.request.urlretrieve(TRACK_URL, src)
    a0, a1 = T(-4), T(24)  # la mesure d'intro, le drop et 6 mesures
    b0 = T(72)  # la dernière mesure de batterie, puis l'accord final
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


def wall() -> Path:
    """Les 15 maquettes en une seule vidéo de 8 s (chaque plan de 2,5 s tourne en boucle)."""
    w, h = TILE
    inputs, chains = [], []
    for i, name in enumerate(WALL):
        clip = PUBLIC / "models" / f"{name}.mp4"
        if not clip.exists():
            raise SystemExit(f"{clip} manque : lancer d'abord python tools/vitrines_film.py")
        inputs += ["-stream_loop", "-1", "-t", "8", "-i", str(clip)]
        chains.append(f"[{i}]scale=-2:{h},crop={w}:{h},setsar=1[t{i}]")
    layout = "|".join(f"{(i % COLS) * (w + GAP)}_{(i // COLS) * (h + GAP)}" for i in range(len(WALL)))
    graph = ";".join(chains) + ";" + "".join(f"[t{i}]" for i in range(len(WALL))) + \
        f"xstack=inputs={len(WALL)}:layout={layout}:fill=black[v]"
    out = PUBLIC / "models-grid.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[v]", "-t", "8",
                    "-r", "30", "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p",
                    "-movflags", "+faststart", str(out)], check=True)
    return out


if __name__ == "__main__":
    print("musique :", music())
    print("mur :", wall())
