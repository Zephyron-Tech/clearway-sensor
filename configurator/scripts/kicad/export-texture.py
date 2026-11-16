"""Textura desky CB3 pro 3D model v konfigurátoru: měď pod maskou, odkryté plošky a potisk.

Z hardware/cb3/cb3.kicad_pcb vyexportuje přes kicad-cli černobílé SVG vrstev mědi, masky a potisku
(stejný výřez = obrys desky), převede je na bitmapy (rsvg-convert) a složí do barevného obrázku:
  public/models/cb3-top.jpg     horní strana při pohledu shora
  public/models/cb3-bottom.jpg  spodní strana, také při pohledu shora (bez zrcadlení), aby seděly
                                souřadnice x, z modelu
  python3 scripts/kicad/export-texture.py
"""
import os
import subprocess
import tempfile

from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
PCB = os.path.join(ROOT, 'hardware', 'cb3', 'cb3.kicad_pcb')
OUT = os.path.join(ROOT, 'configurator', 'public', 'models')
KICAD = os.environ.get('KICAD', os.path.expanduser('~/Applications/KiCad/KiCad.app'))
CLI = os.path.join(KICAD, 'Contents', 'MacOS', 'kicad-cli')
PX_PER_MM = 10

# barvy: maska nad holým laminátem / nad mědí, odkryté plošky (ENIG), potisk
MASK = (24, 74, 42)
MASK_CU = (44, 110, 62)
PAD = (214, 178, 96)
SILK = (236, 238, 232)


def layer_mask(layer, tmp, width):
    svg = os.path.join(tmp, layer.replace('.', '_') + '.svg')
    png = svg[:-4] + '.png'
    subprocess.run([CLI, 'pcb', 'export', 'svg', '--layers', f'{layer},Edge.Cuts', '--mode-single', '--black-and-white',
                    '--page-size-mode', '2', '--exclude-drawing-sheet', '--drill-shape-opt', '2', '-o', svg, PCB],
                   check=True, capture_output=True)
    subprocess.run(['rsvg-convert', '-w', str(width), '-b', 'white', '-o', png, svg], check=True)
    # černá = kresba vrstvy → maska 255
    return ImageChops.invert(Image.open(png).convert('L')).point(lambda v: 255 if v > 100 else 0)


def side(prefix, name, tmp, width):
    cu = layer_mask(f'{prefix}.Cu', tmp, width)
    mask = layer_mask(f'{prefix}.Mask', tmp, width)       # otvory v masce
    silk = layer_mask(f'{prefix}.Silkscreen', tmp, width)
    img = Image.new('RGB', cu.size, MASK)
    img.paste(MASK_CU, mask=cu)
    img.paste(PAD, mask=ImageChops.multiply(cu, mask))
    img.paste(SILK, mask=ImageChops.multiply(silk, ImageChops.invert(mask)))
    out = os.path.join(OUT, name)
    img.save(out, quality=88, optimize=True)
    print(out, img.size, f'{os.path.getsize(out) // 1024} kB')


with tempfile.TemporaryDirectory() as tmp:
    width = int(round(242 * PX_PER_MM))   # šířka desky v mm (obrys 242 × 162)
    side('F', 'cb3-top.jpg', tmp, width)
    side('B', 'cb3-bottom.jpg', tmp, width)
