"""Deska CB3 rev. B: pouzdra ze netlist.json, rozmístění, zóny, příprava na autorouting.

Spouští se Pythonem KiCadu:
  <KiCad.app>/Contents/Frameworks/Python.framework/Versions/Current/bin/python3 gen-pcb-full.py place
  ... route  (export DSN -> Freerouting -> import SES -> rozlití mědi)

Souřadnice v tabulce MAIN jsou souřadnice desky z konfigurátoru: x podél skříně (+ = přední stěna se zásuvkami M12),
z napříč (+ = pravá strana vozu), počátek ve středu desky. KiCad: X = OX + x + L/2, Y = OY + z + W/2.
"""
import json
import math
import os
import subprocess
import sys
import pcbnew

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
OUT = os.path.join(ROOT, 'hardware', 'cb3')
KI = os.path.expanduser('~/Applications/KiCad/KiCad.app/Contents/SharedSupport')
FP_DIR = os.path.join(KI, 'footprints')
DXF = os.path.join(ROOT, 'configurator', 'docs', 'v3-deska', 'obrys.dxf')
PCB = os.environ.get('CB3_PCB', os.path.join(OUT, 'cb3.kicad_pcb'))
GROW = float(os.environ.get('CB3_GROW', '0.55'))
L, W = 242.0, 162.0
OX, OY = 100.0, 60.0
mm = pcbnew.FromMM
def V(x, y): return pcbnew.VECTOR2I(mm(x), mm(y))
def KX(x): return OX + x + L / 2
def KY(z): return OY + z + W / 2

# ---------------- hlavní součástky: (x, z, natočení °) ----------------
MAIN = {
    # napájení (zadní levý roh, u zásuvky Deutsch)
    'J1': (-110, -40, 90), 'F1': (-100, -54, 0), 'D1': (-101, -27, 90), 'U1': (-89, -54, 0), 'Q1': (-89, -42, 0),
    'C1': (-75, -67, 0), 'C2': (-61, -67, 0),
    'U2': (-76, -24, 0), 'U3': (-46, -50, 0), 'U14': (-22, -6, 0), 'U4': (-34, 28, 0), 'U15': (46, 16, 0),
    'Q2': (-104, -4, 0), 'Q3': (-110, -4, 0), 'Q4': (-110, 6, 0), 'D2': (-104, 6, 0), 'D3': (-116, -14, 0),
    # počítač
    'M1': (40, -19.5, 90), 'BT1': (-30, 64, 0), 'U7': (52, -68, 0),
    # Ethernet a porty
    'U8': (60, -6, 180), 'T1': (92, -50, 0), 'T2': (92, 0, 0), 'T3': (92, 50, 0), 'T5': (28, -4, 180), 'T4': (10, -6, 270),
    'J4': (113, -50, 0), 'J5': (113, 0, 0), 'J6': (113, 50, 0), 'U9': (80, -34, 0), 'U10': (80, 16, 0), 'U11': (80, 64, 0),
    # rádio
    'M2': (-86, 54, 0), 'J7': (-113, 54, 0), 'J8': (-16, 32, 0), 'J9': (48, 56, 0), 'U12': (-56, 46, 0), 'U13': (-56, 62, 0),
    # obsluha
    'J10': (-20, -74, 0), 'J11': (98, 68, 0), 'SW1': (58, -52, 0), 'SW2': (58, -44, 0),
    'LED1': (88, 72, 0), 'LED2': (88, 68, 0), 'LED3': (88, 64, 0),
    'MH1': (-108, -68, 0), 'MH2': (108, -68, 0), 'MH3': (-108, 68, 0), 'MH4': (108, 68, 0),
}
# konektory, jejichž ústí musí mířit ke stěně skříně: (směr x, směr z)
FACE = {'J4': (1, 0), 'J5': (1, 0), 'J6': (1, 0), 'J10': (-1, 0), 'J11': (1, 0)}
# kotvy testovacích bodů
TP_ANCHOR = {'VIN_P': 'U1', 'V12': 'U2', 'V5': 'U3', 'V3V3': 'U14', 'V3V8': 'U4', 'V1V2': 'U15', 'GND': 'J1', 'GNSS_SAFEBOOT': 'M2'}

def load_fp(fpid):
    lib, name = fpid.split(':', 1)
    path = os.path.join(OUT, 'cb3.pretty') if lib == 'CB3' else os.path.join(FP_DIR, lib + '.pretty')
    fp = pcbnew.FootprintLoad(path, name)
    if fp is None:
        raise RuntimeError('pouzdro nenalezeno: ' + fpid)
    fp.SetFPID(pcbnew.LIB_ID(lib, name))
    return fp

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

def outline(board):
    """Obrys z DXF (počátek vlevo dole, Y nahoru) do Edge.Cuts; vrací body obrysu pro zóny."""
    pts = []
    for typ, d in dxf_entities(DXF):
        if d.get('8') != 'OBRYS':
            continue
        if typ == 'LINE':
            a = (OX + float(d['10']), OY + W - float(d['20']))
            b = (OX + float(d['11']), OY + W - float(d['21']))
            s = pcbnew.PCB_SHAPE(board); s.SetShape(pcbnew.SHAPE_T_SEGMENT); s.SetStart(V(*a)); s.SetEnd(V(*b))
            s.SetLayer(pcbnew.Edge_Cuts); s.SetWidth(mm(0.1)); board.Add(s)
        elif typ == 'ARC':
            cx, cy, r = float(d['10']), float(d['20']), float(d['40'])
            a0, a1 = float(d['50']), float(d['51'])
            if a1 < a0:
                a1 += 360
            P = lambda a: V(OX + cx + r * math.cos(math.radians(a)), OY + W - (cy + r * math.sin(math.radians(a))))
            s = pcbnew.PCB_SHAPE(board); s.SetShape(pcbnew.SHAPE_T_ARC); s.SetArcGeometry(P(a0), P((a0 + a1) / 2), P(a1))
            s.SetLayer(pcbnew.Edge_Cuts); s.SetWidth(mm(0.1)); board.Add(s)

def add_zone(board, net, layer, poly, priority=0, clearance=0.3, min_w=0.25, thermal=True):
    z = pcbnew.ZONE(board)
    z.SetLayer(layer)
    z.SetNetCode(net.GetNetCode())
    z.SetAssignedPriority(priority)
    z.SetLocalClearance(mm(clearance))
    z.SetMinThickness(mm(min_w))
    z.SetPadConnection(pcbnew.ZONE_CONNECTION_FULL)
    o = z.Outline()
    o.NewOutline()
    for x, y in poly:
        o.Append(mm(x), mm(y))
    board.Add(z)
    return z

def rect_of(fp, grow=0.25):
    bb = fp.GetBoundingBox(False, False)
    g = mm(grow)
    return (bb.GetLeft() - g, bb.GetTop() - g, bb.GetRight() + g, bb.GetBottom() + g)

def overlap(a, b):
    return not (a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])

def place():
    nl = json.load(open(os.path.join(OUT, 'netlist.json'), encoding='utf-8'))
    board = pcbnew.BOARD()
    board.SetCopperLayerCount(4)
    # In1 = souvislá zem (autorouter ji nesmí použít pro signály), In2 = napájení + případně signály
    ds = board.GetDesignSettings()
    ds.SetBoardThickness(mm(1.6))
    tb = board.GetTitleBlock()
    tb.SetTitle('ClearWay CB3 – nosná deska v3'); tb.SetRevision('B'); tb.SetCompany('ClearWay')
    outline(board)
    # sítě
    nets = {}
    for ref, p in nl.items():
        for net in p['pads'].values():
            if net not in nets:
                ni = pcbnew.NETINFO_ITEM(board, net)
                board.Add(ni)
                nets[net] = ni
    # pouzdra
    fps = {}
    for ref, p in nl.items():
        fp = load_fp(p['fp'])
        fp.SetReference(ref)
        fp.SetValue(p['value'])
        for pad in fp.Pads():
            net = p['pads'].get(pad.GetNumber())
            if net:
                pad.SetNet(nets[net])
        board.Add(fp)
        fps[ref] = fp
    # zakázané oblasti pro automatické rozmístění: okraj, výřezy, prostor pod CM5 a pod kartou modemu
    occ = []
    margin = 1.2
    board_rect = (mm(OX + margin), mm(OY + margin), mm(OX + L - margin), mm(OY + W - margin))
    for (x, z) in [(-116, -76), (116, -76), (-116, 76), (116, 76), (0, -81), (0, 81)]:
        r = 8.6
        occ.append((mm(KX(x) - r), mm(KY(z) - r), mm(KX(x) + r), mm(KY(z) + r)))

    def put(ref, x, z, rot):
        fp = fps[ref]
        fp.SetOrientationDegrees(rot)
        fp.SetPosition(V(KX(x), KY(z)))
        # ústí konektoru ke stěně: vybrat natočení podle polohy montážních plošek vůči kontaktům
        if ref in FACE:
            want = FACE[ref]
            best = None
            for r in (0, 90, 180, 270):
                fp.SetOrientationDegrees(r)
                sig = [p.GetPosition() for p in fp.Pads() if p.GetNumber().isdigit()]
                mp = [p.GetPosition() for p in fp.Pads() if not p.GetNumber().isdigit()]
                if not sig or not mp:
                    break
                sx = sum(p.x for p in sig) / len(sig); sy = sum(p.y for p in sig) / len(sig)
                mx = sum(p.x for p in mp) / len(mp); my = sum(p.y for p in mp) / len(mp)
                # ústí je na straně montážních plošek (u JST GH jsou vpředu)
                score = (mx - sx) * want[0] + (my - sy) * want[1]
                if best is None or score > best[0]:
                    best = (score, r)
            if best:
                fp.SetOrientationDegrees(best[1])

    for ref, (x, z, rot) in MAIN.items():
        if ref in fps:
            put(ref, x, z, rot)
    # slot M.2: karta (sloupek M2) musí mířit do +x
    j8 = fps['J8']
    for r in (0, 90, 180, 270):
        j8.SetOrientationDegrees(r)
        m2 = [p for p in j8.Pads() if p.GetNumber() == 'M2'][0].GetPosition()
        if m2.x - j8.GetPosition().x > mm(30):
            break
    m2 = [p for p in j8.Pads() if p.GetNumber() == 'M2'][0].GetPosition()
    # karta 3042: 30 mm napříč, od slotu ke sloupku
    occ.append((j8.GetPosition().x, m2.y - mm(15.5), m2.x + mm(2), m2.y + mm(15.5)))
    # T4 k vývodům Ethernetu CM5
    m1 = fps['M1']
    e = [p for p in m1.Pads() if p.GetNumber() in ('4', '6', '10', '12')]
    ex = sum(p.GetPosition().x for p in e) / len(e); ey = sum(p.GetPosition().y for p in e) / len(e)
    print('Ethernet CM5 u', pcbnew.ToMM(ex) - OX - L / 2, pcbnew.ToMM(ey) - OY - W / 2)

    for ref in MAIN:
        if ref in fps:
            occ.append(rect_of(fps[ref], 0.3))
    occ.append(rect_of(m1, 0.5))   # modul CM5 (1,5 mm nad deskou)

    def free(r):
        if r[0] < board_rect[0] or r[1] < board_rect[1] or r[2] > board_rect[2] or r[3] > board_rect[3]:
            return False
        return not any(overlap(r, o) for o in occ)

    # pasivy: od největších, spirálově kolem kotvy
    rest = [ref for ref in nl if ref not in MAIN]
    def anchor_of(ref):
        a = nl[ref].get('anchor')
        if ref.startswith('TP'):
            a = TP_ANCHOR.get(nl[ref]['value'], 'J1')
        return a if a in fps else None
    def area(ref):
        r = rect_of(fps[ref], 0)
        return (r[2] - r[0]) * (r[3] - r[1])
    rest.sort(key=lambda r: -area(r))
    unplaced = []
    # drobné pasivy čipů s jemnou roztečí na spodní stranu pod čip (uvolní vývody pro spoje nahoře)
    BOTTOM = {'U8', 'M1', 'M2', 'U12', 'U13', 'U7', 'T1', 'T2', 'T3', 'T4', 'T5', 'J9', 'U9', 'U10', 'U11'}
    small = lambda ref: any(k in nl[ref]['fp'] for k in ('0402', '0603'))
    occ_b = [o for o in occ[:6]]          # výřezy obrysu
    for ref, f in fps.items():            # vývodové (THT) součástky zasahují i dolů
        if any(pd.GetAttribute() in (pcbnew.PAD_ATTRIB_PTH, pcbnew.PAD_ATTRIB_NPTH) for pd in f.Pads()) and ref in MAIN:
            occ_b.append(rect_of(f, 0.3))
    for ref in [r for r in rest if anchor_of(r) in BOTTOM and small(r)]:
        fp = fps[ref]
        fp.SetLayerAndFlip(pcbnew.B_Cu)
        ar = rect_of(fps[anchor_of(ref)], 0)
        cx0, cy0 = (ar[0] + ar[2]) // 2, (ar[1] + ar[3]) // 2
        cand = []
        step = mm(0.5)
        x = ar[0] - mm(4)
        while x <= ar[2] + mm(4):
            y = ar[1] - mm(4)
            while y <= ar[3] + mm(4):
                cand.append(((x - cx0) ** 2 + (y - cy0) ** 2, x, y)); y += step
            x += step
        cand.sort()
        done = False
        for _, px, py in cand:
            for rot in (0, 90):
                fp.SetOrientationDegrees(rot); fp.SetPosition(V(0, 0))
                rb = rect_of(fp, 0.35)
                w2, h2 = (rb[2] - rb[0]) // 2, (rb[3] - rb[1]) // 2
                cx = (rb[0] + rb[2]) // 2; cy = (rb[1] + rb[3]) // 2
                r = (px - w2, py - h2, px + w2, py + h2)
                if r[0] >= board_rect[0] and r[1] >= board_rect[1] and r[2] <= board_rect[2] and r[3] <= board_rect[3] and not any(overlap(r, o) for o in occ_b):
                    fp.SetPosition(pcbnew.VECTOR2I(int(px - cx), int(py - cy)))
                    occ_b.append(rect_of(fp, 0.35)); done = True; break
            if done: break
        if not done:
            fp.SetLayerAndFlip(pcbnew.F_Cu)
        else:
            rest.remove(ref)
    print('dole:', sum(1 for f in fps.values() if f.GetLayer() == pcbnew.B_Cu))
    for ref in rest:
        fp = fps[ref]
        a = anchor_of(ref)
        ac = fps[a].GetPosition() if a else V(KX(0), KY(0))
        ar = rect_of(fps[a], 0) if a else (ac.x, ac.y, ac.x, ac.y)
        done = False
        for ring in range(0, 120):
            d = mm(0.6 + ring * 0.7)
            # body na obvodu obdélníku kotvy zvětšeného o d
            x0, y0, x1, y1 = ar[0] - d, ar[1] - d, ar[2] + d, ar[3] + d
            per = 2 * ((x1 - x0) + (y1 - y0))
            n = max(8, int(pcbnew.ToMM(per) / 1.2))
            for k in range(n):
                t = per * k / n
                if t < x1 - x0: px, py = x0 + t, y0
                elif t < (x1 - x0) + (y1 - y0): px, py = x1, y0 + (t - (x1 - x0))
                elif t < 2 * (x1 - x0) + (y1 - y0): px, py = x1 - (t - (x1 - x0) - (y1 - y0)), y1
                else: px, py = x0, y1 - (t - 2 * (x1 - x0) - (y1 - y0))
                for rot in (0, 90):
                    fp.SetOrientationDegrees(rot)
                    fp.SetPosition(V(0, 0))
                    rb = rect_of(fp, GROW)
                    w2, h2 = (rb[2] - rb[0]) // 2, (rb[3] - rb[1]) // 2
                    cx = (rb[0] + rb[2]) // 2; cy = (rb[1] + rb[3]) // 2
                    r = (px - w2, py - h2, px + w2, py + h2)
                    if free(r):
                        fp.SetPosition(pcbnew.VECTOR2I(int(px - cx), int(py - cy)))
                        occ.append(rect_of(fp, GROW))
                        done = True
                        break
                if done: break
            if done: break
        if not done:
            unplaced.append(ref)
    print('nerozmístěno:', unplaced)

    # zóny: In1 celá zem, In2 napájení 5 V s ostrovem VIN_P v rohu napájení
    poly = [(OX, OY), (OX + L, OY), (OX + L, OY + W), (OX, OY + W)]
    add_zone(board, nets['GND'], pcbnew.In1_Cu, poly, 0, 0.25, 0.25, True)
    # In2: ostrov VIN_P v rohu napájení, zbytek 5 V (bez překryvu, aby autorouter viděl dvě oddělené roviny)
    vin = [(KX(-121), KY(-81)), (KX(-36), KY(-81)), (KX(-36), KY(-12)), (KX(-121), KY(-12))]
    add_zone(board, nets['VIN_P'], pcbnew.In2_Cu, vin, 1, 0.5, 0.3, True)
    v5 = [(KX(-35), KY(-81)), (KX(121), KY(-81)), (KX(121), KY(81)), (KX(-121), KY(81)), (KX(-121), KY(-11)), (KX(-35), KY(-11))]
    add_zone(board, nets['V5'], pcbnew.In2_Cu, v5, 0, 0.3, 0.3, True)
    # zakázané oblasti pro spoje a prokovy kolem neprokovených otvorů (CM5, slot M.2)
    for ref in ('M1', 'J8'):
        for pad in fps[ref].Pads():
            if pad.GetAttribute() == pcbnew.PAD_ATTRIB_NPTH:
                c = pad.GetPosition(); r = pcbnew.ToMM(max(pad.GetSize().x, pad.GetSize().y)) / 2 + 1.6
                ka = pcbnew.ZONE(board)
                ka.SetIsRuleArea(True); ka.SetDoNotAllowTracks(True); ka.SetDoNotAllowVias(True); ka.SetDoNotAllowZoneFills(False)
                ka.SetDoNotAllowPads(False); ka.SetDoNotAllowFootprints(False)
                ka.SetLayerSet(pcbnew.LSET.AllCuMask())
                o = ka.Outline(); o.NewOutline()
                for k in range(16):
                    a = 2 * math.pi * k / 16
                    o.Append(int(c.x + mm(r) * math.cos(a)), int(c.y + mm(r) * math.sin(a)))
                board.Add(ka)
    t = pcbnew.PCB_TEXT(board)
    t.SetText('ClearWay CB3 rev. B'); t.SetPosition(V(KX(-60), KY(-75))); t.SetLayer(pcbnew.F_SilkS); t.SetTextSize(V(1.5, 1.5))
    board.Add(t)
    board.Save(PCB)
    print('uloženo', PCB, 'pouzder', len(fps), 'sítí', len(nets))

def route(passes=30):
    tools = os.environ.get('CB3_TOOLS')
    tag = os.environ.get('CB3_TAG', 'cb3')
    dsn = os.path.join(tools, tag + '.dsn'); ses = os.path.join(tools, tag + '.ses')
    board = pcbnew.LoadBoard(PCB)
    # vylitá zem na vnějších vrstvách by pro autorouter byla rovina přes celou vrstvu: před exportem pryč (doplní se po importu)
    for z in list(board.Zones()):
        if z.GetNetname() == 'GND' and z.GetLayer() in (pcbnew.F_Cu, pcbnew.B_Cu):
            board.Remove(z)
    pcbnew.ExportSpecctraDSN(board, dsn)
    java = '/opt/homebrew/opt/openjdk/bin/java'
    cmd = [java, '-jar', os.path.join(tools, 'freerouting.jar'), '-de', dsn, '-do', ses, '-mp', str(passes), '-mt', '1', '--gui.enabled=false']
    print(' '.join(cmd))
    subprocess.run(cmd, check=True)
    import_ses(ses)

def import_ses(ses):
    # import + úklid a rozlití mědi ve dvou samostatných procesech (SWIG po mazání prokovů ztrácí typy objektů)
    board = pcbnew.LoadBoard(PCB)
    pcbnew.ImportSpecctraSES(board, ses)
    board.Save(PCB)
    for step in ('cleanup', 'pour'):
        subprocess.run([sys.executable, os.path.abspath(__file__), step], check=True)

def cleanup(board):
    """Úklid po autorouteru: příliš tenké spoje rozšíří na 0,1 mm a smaže prokovy, které nic nespojují
    (žádný spoj ani ploška se jich nedotýká a jejich síť nemá na žádné vrstvě zónu)."""
    tracks = [t for t in board.GetTracks() if t.GetClass() == 'PCB_TRACK']
    widened = 0
    for t in tracks:
        pass
    zone_nets = {z.GetNetname() for z in board.Zones() if not z.GetIsRuleArea()}
    removed = 0
    for v in [t for t in board.GetTracks() if t.GetClass() == 'PCB_VIA']:
        p = v.GetPosition(); r = v.GetWidth(pcbnew.F_Cu) / 2 + mm(0.05)
        touching = sum(1 for t in tracks if t.GetNetname() == v.GetNetname() and
                       min(abs(t.GetStart().x - p.x) + abs(t.GetStart().y - p.y), abs(t.GetEnd().x - p.x) + abs(t.GetEnd().y - p.y)) <= r)
        if touching == 0 and v.GetNetname() not in zone_nets:
            board.Remove(v); removed += 1
    print('rozšířeno spojů:', widened, 'odstraněno prokovů:', removed)

def pour(board):
    """Zem na vnějších vrstvách a doplnění všech zón."""
    gnd = board.FindNet('GND')
    poly = [(OX, OY), (OX + L, OY), (OX + L, OY + W), (OX, OY + W)]
    have = {(z.GetLayer(), z.GetNetname()) for z in board.Zones() if not z.GetIsRuleArea()}
    for layer in (pcbnew.F_Cu, pcbnew.B_Cu):
        if (layer, 'GND') not in have:
            add_zone(board, gnd, layer, poly, 0, 0.3, 0.25, True)
    # M.2 (rozteč 0,5 mm): maska mezi ploškami se nedělá, společné okno je u výrobce běžné
    for fp in board.GetFootprints():
        if fp.GetReference() == 'J8': fp.SetAllowSolderMaskBridges(True)
    pcbnew.ZONE_FILLER(board).Fill(board.Zones())  # noqa

if __name__ == '__main__':
    what = sys.argv[1] if len(sys.argv) > 1 else 'place'
    if what == 'place':
        place()
    elif what == 'route':
        route(int(sys.argv[2]) if len(sys.argv) > 2 else 30)
    elif what == 'import':
        import_ses(os.path.join(os.environ.get('CB3_TOOLS'), 'cb3.ses'))
    elif what == 'cleanup':
        b = pcbnew.LoadBoard(PCB); cleanup(b); b.Save(PCB)
    elif what == 'pour':
        b = pcbnew.LoadBoard(PCB); pour(b); b.Save(PCB)
