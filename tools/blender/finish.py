"""Prépare les rendus pour le site (guide 42), après city.py, globe.py et coins.py :

    python tools/blender/finish.py

- les images passent en WebP (dix fois plus légères), et le voile presque transparent que le sol laisse autour de
  l'ombre est retiré (sur une page claire, il dessinait un rectangle pâle) ;
- les masques des villes restent en PNG sans transparence : leurs couleurs doivent être exactes.
"""

from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent.parent / "static" / "renders"
for png in sorted(OUT.glob("*.png")):
    if png.name.endswith("-mask.png"):
        Image.open(png).convert("RGB").save(png, optimize=True)
        continue
    pixels = np.asarray(Image.open(png).convert("RGBA")).astype(np.float32)
    alpha = pixels[..., 3] / 255
    pixels[..., 3] = np.clip((alpha - 0.1) / 0.9, 0, 1) * 255   # le voile du sol disparaît ; l'objet et son ombre restent
    Image.fromarray(pixels.astype(np.uint8), "RGBA").save(png.with_suffix(".webp"), quality=90, method=6)
    png.unlink()
for path in sorted(OUT.iterdir()):
    print(path.name, path.stat().st_size // 1024, "ko")
