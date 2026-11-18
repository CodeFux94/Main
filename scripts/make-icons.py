# Erzeugt die App-Icons aus scripts/icon.png (1024×1024). Ergebnis wird committet.
# Aufruf: python3 scripts/make-icons.py (benötigt Pillow)
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
src = Image.open(root / "icon.png").convert("RGB")
out = root.parent / "public" / "icons"
out.mkdir(parents=True, exist_ok=True)

# Das Motiv ist randlos, daher auch als "maskable" ohne Rand nutzbar.
for name, size in [
    ("icon-192.png", 192),
    ("icon-512.png", 512),
    ("apple-touch-icon.png", 180),
    ("icon-maskable-512.png", 512),
    ("favicon-32.png", 32),
]:
    src.resize((size, size), Image.LANCZOS).save(out / name, optimize=True)
print("Icons erzeugt in public/icons")
