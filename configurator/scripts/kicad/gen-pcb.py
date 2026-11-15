"""Deska CB3 v KiCadu: obrys z obrys.dxf, montážní otvory a pouzdra rozmístěná podle placement.json.

Spouští se Pythonem dodaným s KiCadem (má modul pcbnew):
  /Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3 \
      configurator/scripts/kicad/gen-pcb.py

Pouzdra, která v knihovnách KiCadu nejsou, dostanou zástupce (obrys pouzdra ve vrstvách F.Fab
a F.CrtYd, bez plošek) a uloží se do hardware/cb3/cb3.pretty. Sítě se do desky dostanou až
příkazem Nástroje → Aktualizovat DPS ze schématu (F8), pouzdra se spárují podle designátorů.
"""
import json
import os
import sys
import pcbnew

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'hardware', 'cb3')
FP_DIR = sys.argv[1] if len(sys.argv) > 1 else '/Applications/KiCad/KiCad.app/Contents/SharedSupport/footprints'
DXF = os.path.join(ROOT, 'configurator', 'docs', 'v3-deska', 'obrys.dxf')

data = json.load(open(os.path.join(OUT, 'placement.json'), encoding='utf-8'))
B = data['board']
L, W = B['length'], B['width']
OX, OY = 100.0, 60.0          # levý horní roh desky na stránce (mm)

mm = pcbnew.FromMM
def P(x, y):
    return pcbnew.VECTOR2I(mm(x), mm(y))
# model: x podél skříně, z napříč; KiCad: X doprava, Y dolů (pohled shora)
def KX(x): return OX + x + L / 2
def KY(z): return OY + z + W / 2

board = pcbnew.BOARD()
board.SetCopperLayerCount(B['layers'])
ds = board.GetDesignSettings()
ds.SetBoardThickness(mm(B['thickness']))
tb = board.GetTitleBlock()
tb.SetTitle(f"{B['name']} – nosná deska ClearWay v3")
tb.SetRevision('A')
tb.SetCompany('ClearWay')
tb.SetComment(0, 'Koncept: obrys a rozmístění z konfigurátoru, propojení po aktualizaci ze schématu')

# ---------- obrys z DXF (souřadnice DXF: počátek vlevo dole, Y nahoru) ----------
def dxf_entities(path):
    t = open(path, encoding='utf-8').read().splitlines()
    i, out = 0, []
    while i < len(t) - 1:
        if t[i].strip() == '0' and t[i + 1].strip() in ('LINE', 'ARC', 'CIRCLE'):
            typ, d, j = t[i + 1].strip(), {}, i + 2
            while t[j].strip() != '0':
                d[t[j].strip()] = t[j + 1].strip()
                j += 2
            out.append((typ, d))
            i = j
        else:
            i += 1
    return out

def DX(x): return OX + x
def DY(y): return OY + W - y

for typ, d in dxf_entities(DXF):
    layer = d.get('8')
    if typ == 'LINE' and layer == 'OBRYS':
        s = pcbnew.PCB_SHAPE(board)
        s.SetShape(pcbnew.SHAPE_T_SEGMENT)
        s.SetStart(P(DX(float(d['10'])), DY(float(d['20']))))
        s.SetEnd(P(DX(float(d['11'])), DY(float(d['21']))))
        s.SetLayer(pcbnew.Edge_Cuts)
        s.SetWidth(mm(0.1))
        board.Add(s)
    elif typ == 'ARC' and layer == 'OBRYS':
        import math
        cx, cy, r = float(d['10']), float(d['20']), float(d['40'])
        a0, a1 = float(d['50']), float(d['51'])
        if a1 < a0:
            a1 += 360
        am = (a0 + a1) / 2
        pt = lambda a: P(DX(cx + r * math.cos(math.radians(a))), DY(cy + r * math.sin(math.radians(a))))
        s = pcbnew.PCB_SHAPE(board)
        s.SetShape(pcbnew.SHAPE_T_ARC)
        s.SetArcGeometry(pt(a0), pt(am), pt(a1))
        s.SetLayer(pcbnew.Edge_Cuts)
        s.SetWidth(mm(0.1))
        board.Add(s)

# ---------- pouzdra ----------
os.makedirs(os.path.join(OUT, 'cb3.pretty'), exist_ok=True)

def placeholder_fp(part):
    """Zástupné pouzdro: obrys a ohraničení podle rozměrů z konfigurátoru, bez plošek."""
    fp = pcbnew.FOOTPRINT(board)
    name = 'PH_' + part['ref']
    fp.SetFPID(pcbnew.LIB_ID('CB3', name))
    w, h = part['w'], part['d']
    for layer, grow, width in ((pcbnew.F_Fab, 0, 0.1), (pcbnew.F_CrtYd, 0.25, 0.05), (pcbnew.F_SilkS, 0.15, 0.12)):
        r = pcbnew.PCB_SHAPE(fp)
        r.SetShape(pcbnew.SHAPE_T_RECT)
        r.SetStart(P(-w / 2 - grow, -h / 2 - grow))
        r.SetEnd(P(w / 2 + grow, h / 2 + grow))
        r.SetLayer(layer)
        r.SetWidth(mm(width))
        fp.Add(r)
    note = pcbnew.PCB_TEXT(fp)
    note.SetText('ZÁSTUPCE: ' + part['mpn'][:40])
    note.SetLayer(pcbnew.F_Fab)
    note.SetTextSize(P(0.6, 0.6))
    fp.Add(note)
    fp.SetLayer(pcbnew.F_Cu)
    try:
        pcbnew.FootprintSave(os.path.join(OUT, 'cb3.pretty'), fp)
    except Exception as e:  # uložení do knihovny není nutné pro desku
        print('  (zástupce neuložen do knihovny:', e, ')')
    return fp

placed, ph = 0, 0
for part in data['parts']:
    lib, name = part['fp'].split(':', 1)
    fp = None
    if not part['placeholder']:
        try:
            fp = pcbnew.FootprintLoad(os.path.join(FP_DIR, lib + '.pretty'), name)
        except Exception:
            fp = None
    if fp is None:
        fp = placeholder_fp(part)
        ph += 1
    else:
        fp.SetFPID(pcbnew.LIB_ID(lib, name))
    fp.SetReference(part['ref'])
    fp.SetValue(part['value'])
    fp.SetPosition(P(KX(part['x']), KY(part['z'])))
    fp.SetOrientationDegrees(part.get('rot', 0))
    board.Add(fp)
    placed += 1

# ---------- montážní otvory (prokovené, do zemní sítě po aktualizaci ze schématu) ----------
for i, h in enumerate(B['holes']):
    try:
        fp = pcbnew.FootprintLoad(os.path.join(FP_DIR, 'MountingHole.pretty'), 'MountingHole_3.2mm_M3_Pad_Via')
        fp.SetFPID(pcbnew.LIB_ID('MountingHole', 'MountingHole_3.2mm_M3_Pad_Via'))
    except Exception:
        fp = pcbnew.FootprintLoad(os.path.join(FP_DIR, 'MountingHole.pretty'), 'MountingHole_3.2mm_M3_Pad')
        fp.SetFPID(pcbnew.LIB_ID('MountingHole', 'MountingHole_3.2mm_M3_Pad'))
    fp.SetReference(f'MH{i + 1}')
    fp.SetValue('M3')
    fp.SetPosition(P(KX(h['x']), KY(h['z'])))
    board.Add(fp)

# ---------- popisky v potisku ----------
t = pcbnew.PCB_TEXT(board)
t.SetText(f"{B['name']} rev. A  ClearWay v3")
t.SetPosition(P(KX(-60), KY(-W / 2 + 6)))
t.SetLayer(pcbnew.F_SilkS)
t.SetTextSize(P(1.5, 1.5))
board.Add(t)

path = os.path.join(OUT, 'cb3.kicad_pcb')
board.Save(path)
print(f'deska: {placed} pouzder ({ph} zástupců), {len(B["holes"])} montážních otvorů -> {path}')
