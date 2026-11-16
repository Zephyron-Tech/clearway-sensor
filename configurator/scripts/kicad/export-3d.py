"""Rozmístění z hotové desky KiCad do 3D modelu v konfigurátoru.

Čte hardware/cb3/cb3.kicad_pcb a zapisuje src/cad/board-v3-pcb.js: pro každou součástku
označení, pouzdro, hodnotu, typ (MPN), list schématu, střed, stranu a rozměr těla.

  python3 export-3d.py            (Python z KiCadu, modul pcbnew)

Souřadnice modelu: počátek ve středu desky, x = x KiCadu (doprava = přední stěna se zásuvkami M12),
z = y KiCadu (dolů v KiCadu = +z), rozměry w podél x, d podél z (už po otočení pouzdra).
"""
import json
import os
import pcbnew

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..', '..'))
PCB = os.path.join(ROOT, 'hardware', 'cb3', 'cb3.kicad_pcb')
OUT = os.path.join(ROOT, 'configurator', 'src', 'cad', 'board-v3-pcb.js')

b = pcbnew.LoadBoard(PCB)
eb = b.GetBoardEdgesBoundingBox()
cx = pcbnew.ToMM(eb.GetCenter().x)
cy = pcbnew.ToMM(eb.GetCenter().y)
r2 = lambda v: round(v, 2)


def body_box(fp):
    """Obrys těla: vrstva Fab, jinak courtyard, jinak plošky."""
    flip = fp.IsFlipped()
    # CM5: pouzdro z referenčního projektu má obrys modulu jen v potisku (Fab a courtyard jsou konektory)
    first = (pcbnew.F_SilkS,) if fp.GetReference() == 'M1' else ()
    for layer in first + ((pcbnew.B_Fab if flip else pcbnew.F_Fab), (pcbnew.B_CrtYd if flip else pcbnew.F_CrtYd)):
        box = None
        for g in fp.GraphicalItems():
            if g.GetLayer() != layer or g.GetClass() == 'PCB_TEXT':
                continue
            bb = g.GetBoundingBox()
            if box is None:
                box = bb
            else:
                box.Merge(bb)
        if box is not None and box.GetWidth() > 0 and box.GetHeight() > 0:
            shrink = 0.25 if layer in (pcbnew.F_CrtYd, pcbnew.B_CrtYd) else 0
            return box, shrink
    box = None
    for p in fp.Pads():
        bb = p.GetBoundingBox()
        if box is None:
            box = bb
        else:
            box.Merge(bb)
    return box, 0


parts = []
for fp in sorted(b.GetFootprints(), key=lambda f: f.GetReference()):
    box, shrink = body_box(fp)
    fields = {f.GetName(): f.GetText() for f in fp.GetFields()}
    parts.append({
        'ref': fp.GetReference(),
        'fp': str(fp.GetFPID().GetLibItemName()),
        'value': fp.GetValue(),
        'mpn': fields.get('MPN', ''),
        'sheet': os.path.splitext(fp.GetSheetfile())[0] if fp.GetSheetfile() else '',
        'x': r2(pcbnew.ToMM(box.GetCenter().x) - cx),
        'z': r2(pcbnew.ToMM(box.GetCenter().y) - cy),
        'w': r2(pcbnew.ToMM(box.GetWidth()) - 2 * shrink),
        'd': r2(pcbnew.ToMM(box.GetHeight()) - 2 * shrink),
        'rot': r2(fp.GetOrientationDegrees()),
        'side': 'B' if fp.IsFlipped() else 'T',
    })

head = ('// VYGENEROVÁNO skriptem scripts/kicad/export-3d.py z hardware/cb3/cb3.kicad_pcb, ručně neupravovat.\n'
        '// Střed těla součástky (x, z) a rozměr těla (w × d) v mm od středu desky, strana T = nahoře, B = dole.\n')
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(head)
    f.write(f'export const PCB_SIZE = {{ length: {r2(pcbnew.ToMM(eb.GetWidth()))}, width: {r2(pcbnew.ToMM(eb.GetHeight()))} }};\n')
    f.write('export const PCB_PARTS = [\n')
    for p in parts:
        f.write('  ' + json.dumps(p, ensure_ascii=False) + ',\n')
    f.write('];\n')
print(f'{len(parts)} součástek → {OUT}')
