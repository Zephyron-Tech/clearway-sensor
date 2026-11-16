"""Dotahovací router: spojí zbývající nespojené dvojice z DRC reportu (unconnected_items).

Mřížka 0,1 mm, vrstvy F.Cu, In2.Cu, B.Cu (In1 = souvislá zem zůstává nedotčená). Každá buňka nese
index sítě, které patří (včetně izolační mezery), −1 = volno, −2 = zakázáno (víc sítí / keepout / okraj).
Hledání A* s váženou heuristikou, změna vrstvy prokovem. Výsledek se zapíše jako PCB_TRACK / PCB_VIA.

  python3 finish-route.py <deska.kicad_pcb> <drc.rpt>
"""
import heapq
import math
import re
import sys
from array import array
import pcbnew

PCB, RPT = sys.argv[1], sys.argv[2]
G = 0.1                      # krok mřížky (mm)
TRACK = float(__import__('os').environ.get('FR_TRACK', '0.15'))  # šířka nových spojů (mm)
CLR = float(__import__('os').environ.get('FR_CLR', '0.2'))  # izolační mezera (mm)
VIA_D, VIA_DRILL = 0.5, 0.25
mm = pcbnew.FromMM
board = pcbnew.LoadBoard(PCB)
import os as _osr
if _osr.environ.get('FR_REROUTE') and not _osr.environ.get('FR_RR_DONE'):
    # smazat starou měď přepojovaných sítí v samostatném procesu (SWIG po Remove ztrácí typy)
    _rr = set(_osr.environ['FR_REROUTE'].split(','))
    _kill = [t for t in board.GetTracks() if t.GetNetname() in _rr]
    for t in _kill: board.Remove(t)
    board.Save(PCB)
    _osr.environ['FR_RR_DONE'] = '1'
    _osr.execv(sys.executable, [sys.executable] + sys.argv)
bb = board.GetBoardEdgesBoundingBox()
X0, Y0 = pcbnew.ToMM(bb.GetLeft()), pcbnew.ToMM(bb.GetTop())
NX = int(pcbnew.ToMM(bb.GetWidth()) / G) + 2
NY = int(pcbnew.ToMM(bb.GetHeight()) / G) + 2
LAYERS = [pcbnew.F_Cu, pcbnew.In2_Cu, pcbnew.B_Cu, pcbnew.In1_Cu]
LCOST = [1.0, 2.5, 1.2, 6.0]    # In1 (zem) jen v nouzi, krátké úseky
ROUTE_L = [0, 1, 2, 3]
LI = {l: i for i, l in enumerate(LAYERS)}
nets = {}
def nid(name):
    if name not in nets: nets[name] = len(nets)
    return nets[name]
grid = [array('h', [-1]) * (NX * NY) for _ in LAYERS]

NETCLR = {}
def clr_of(netname):
    if netname not in NETCLR:
        try:
            NETCLR[netname] = max(CLR, pcbnew.ToMM(board.FindNet(netname).GetNetClass().GetClearance()))
        except Exception:
            NETCLR[netname] = CLR
    return NETCLR[netname]
CUR_CLR = [CLR]
NETW = {}
def width_of(netname):
    if netname not in NETW:
        try:
            NETW[netname] = max(TRACK, pcbnew.ToMM(board.FindNet(netname).GetNetClass().GetTrackWidth()))
        except Exception:
            NETW[netname] = TRACK
    return NETW[netname]
# rezerva: diagonální krok mřížky se k překážce přiblíží víc než středy buněk; síť s větší mezerou
MARGIN = float(__import__('os').environ.get('FR_MARGIN', '0.05'))
EXTRA = [0]   # buňky navíc kolem osy pro širší spoj
NECK = [False]   # krátký přívod k jemné plošce: zúžený spoj

def mark(li, cx, cy, r_mm, net, rect=None):
    """Označí kruh (nebo obdélník rect=(x0,y0,x1,y1) v mm) zvětšený o mezeru."""
    g = grid[li]
    infl = CUR_CLR[0] + TRACK / 2 + MARGIN
    if rect:
        x0, y0, x1, y1 = rect
        x0 -= infl; y0 -= infl; x1 += infl; y1 += infl
        # blokovaná je buňka, jejíž střed (osa budoucího spoje) leží v nafouknutém obdélníku
        i0, i1 = max(0, int(math.ceil((x0 - X0) / G - 1e-6))), min(NX - 1, int(math.floor((x1 - X0) / G + 1e-6)))
        j0, j1 = max(0, int(math.ceil((y0 - Y0) / G - 1e-6))), min(NY - 1, int(math.floor((y1 - Y0) / G + 1e-6)))
        for j in range(j0, j1 + 1):
            base = j * NX
            for i in range(i0, i1 + 1):
                v = g[base + i]
                g[base + i] = net if v in (-1, net) else -2
        return
    r = r_mm + infl
    i0, i1 = max(0, int((cx - r - X0) / G)), min(NX - 1, int((cx + r - X0) / G) + 1)
    j0, j1 = max(0, int((cy - r - Y0) / G)), min(NY - 1, int((cy + r - Y0) / G) + 1)
    for j in range(j0, j1 + 1):
        y = Y0 + j * G
        for i in range(i0, i1 + 1):
            x = X0 + i * G
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                v = g[j * NX + i]
                g[j * NX + i] = net if v in (-1, net) else -2

def mark_seg(li, ax, ay, bx, by, w, net):
    g = grid[li]
    r = w / 2 + CUR_CLR[0] + TRACK / 2 + MARGIN
    i0, i1 = max(0, int((min(ax, bx) - r - X0) / G)), min(NX - 1, int((max(ax, bx) + r - X0) / G) + 1)
    j0, j1 = max(0, int((min(ay, by) - r - Y0) / G)), min(NY - 1, int((max(ay, by) + r - Y0) / G) + 1)
    dx, dy = bx - ax, by - ay
    L2 = dx * dx + dy * dy or 1e-9
    for j in range(j0, j1 + 1):
        y = Y0 + j * G
        for i in range(i0, i1 + 1):
            x = X0 + i * G
            t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / L2))
            px, py = ax + t * dx - x, ay + t * dy - y
            if px * px + py * py <= r * r:
                v = g[j * NX + i]
                g[j * NX + i] = net if v in (-1, net) else -2

def P(v): return pcbnew.ToMM(v.x), pcbnew.ToMM(v.y)

# ---------- překážky ----------
for pad in board.GetPads():
    n = nid(pad.GetNetname() or f'__pad{id(pad)}')
    CUR_CLR[0] = clr_of(pad.GetNetname()) if pad.GetNetname() else CLR
    b = pad.GetBoundingBox()
    rect = (pcbnew.ToMM(b.GetLeft()), pcbnew.ToMM(b.GetTop()), pcbnew.ToMM(b.GetRight()), pcbnew.ToMM(b.GetBottom()))
    for l in LAYERS:
        if pad.IsOnLayer(l) or pad.GetAttribute() == pcbnew.PAD_ATTRIB_NPTH:
            mark(LI[l], 0, 0, 0, n if pad.GetAttribute() != pcbnew.PAD_ATTRIB_NPTH else -2, rect)
for t in board.GetTracks():
    n = nid(t.GetNetname())
    CUR_CLR[0] = clr_of(t.GetNetname())
    if t.GetClass() == 'PCB_VIA':
        x, y = P(t.GetPosition())
        for l in LAYERS: mark(LI[l], x, y, pcbnew.ToMM(t.GetWidth(pcbnew.F_Cu)) / 2, n)
    elif t.GetLayer() in LI:
        ax, ay = P(t.GetStart()); bx, by = P(t.GetEnd())
        mark_seg(LI[t.GetLayer()], ax, ay, bx, by, pcbnew.ToMM(t.GetWidth()), n)
CUR_CLR[0] = CLR
# zakázané oblasti a okraj desky
for z in board.Zones():
    if z.GetIsRuleArea() and (z.GetDoNotAllowTracks() or z.GetDoNotAllowVias()):
        zb = z.GetBoundingBox()
        for l in LAYERS:
            mark(LI[l], 0, 0, 0, -2, (pcbnew.ToMM(zb.GetLeft()), pcbnew.ToMM(zb.GetTop()), pcbnew.ToMM(zb.GetRight()), pcbnew.ToMM(zb.GetBottom())))
EDGE = 0.4
for li in range(len(LAYERS)):
    g = grid[li]
    k = int(EDGE / G) + 2
    for j in range(NY):
        for i in list(range(k)) + list(range(NX - k, NX)): g[j * NX + i] = -2
    for i in range(NX):
        for j in list(range(k)) + list(range(NY - k, NY)): g[j * NX + i] = -2
# výřezy obrysu (půlkruhy) a montážní otvory: Edge.Cuts oblouky jako kruhy
for d in board.GetDrawings():
    if d.GetLayer() == pcbnew.Edge_Cuts and d.GetShape() == pcbnew.SHAPE_T_ARC:
        cx, cy = P(d.GetCenter()); r = pcbnew.ToMM(d.GetRadius())
        for li in range(len(LAYERS)): mark(li, cx, cy, r + EDGE, -2)

# ---------- zadání ----------
import os as _os0
REROUTE = [n for n in _os0.environ.get('FR_REROUTE', '').split(',') if n]
txt = open(RPT, encoding='utf-8').read()
jobs = []
for net in REROUTE:
    pads = [pd for pd in board.GetPads() if pd.GetNetname() == net]
    done_p = [pads[0]]
    rest_p = pads[1:]
    while rest_p:   # Primův strom nad ploškami
        d, a, b = min(((math.hypot(*(lambda p, q: (p[0] - q[0], p[1] - q[1]))(P(x.GetPosition()), P(y.GetPosition()))), x, y) for x in done_p for y in rest_p), key=lambda z: z[0])
        la = pcbnew.F_Cu if a.IsOnLayer(pcbnew.F_Cu) else pcbnew.B_Cu
        lb = pcbnew.F_Cu if b.IsOnLayer(pcbnew.F_Cu) else pcbnew.B_Cu
        jobs.append((net, (*P(a.GetPosition()), la, 'Pad'), (*P(b.GetPosition()), lb, 'Pad')))
        done_p.append(b); rest_p.remove(b)
for blk in txt.split('\n[')[1:]:
    if not blk.startswith('unconnected_items'): continue
    if any(f'[{n}]' in blk for n in REROUTE): continue
    items = re.findall(r'@\(([\d.]+) mm, ([\d.]+) mm\): (Pad \S+|Track|Via|Zone)[^\[]*\[([^\]]+)\](?: of \S+)?(?: on ([\w.]+))?', blk)
    if len(items) != 2: continue
    if 'Zone' in (items[0][2], items[1][2]):
        pad = items[0] if items[1][2] == 'Zone' else items[1]
        if pad[2].startswith('Pad'):
            zl = items[0][4] if items[0][2] == 'Zone' else items[1][4]
            jobs.append((pad[3], (float(pad[0]), float(pad[1]), None, pad[2]), ('ZONE', zl)))
        continue
    def lay(it):
        if it[4] in ('F.Cu', 'B.Cu', 'In2.Cu', 'In1.Cu'): return {'F.Cu': pcbnew.F_Cu, 'B.Cu': pcbnew.B_Cu, 'In2.Cu': pcbnew.In2_Cu, 'In1.Cu': pcbnew.In1_Cu}[it[4]]
        return None
    a, b = items
    jobs.append((a[3], (float(a[0]), float(a[1]), lay(a), a[2]), (float(b[0]), float(b[1]), lay(b), b[2])))
FIRST = [n for n in _os0.environ.get('FR_FIRST', '').split(',') if n]
ONLY = [n for n in _os0.environ.get('FR_ONLY', '').split(',') if n]   # jen tyto sítě
if ONLY: jobs = [j for j in jobs if j[0] in ONLY]   # sítě, které jdou na řadu první
jobs.sort(key=lambda j: (FIRST.index(j[0]) if j[0] in FIRST else len(FIRST), 0 if j[2][0] == 'ZONE' else math.hypot(j[1][0] - j[2][0], j[1][1] - j[2][1])))
print('úloh', len(jobs))

def cell(x, y): return int(round((x - X0) / G)), int(round((y - Y0) / G))
def start_layers(item):
    x, y, l, kind = item
    if l in LI: return [LI[l]]
    if l == pcbnew.In1_Cu: return list(ROUTE_L)   # konec na In1 → přes prokov kamkoli
    # ploška bez udané vrstvy: zjistit z desky
    for pad in board.GetPads():
        px, py = P(pad.GetPosition())
        if abs(px - x) < 0.05 and abs(py - y) < 0.05:
            return [LI[l2] for l2 in LAYERS if pad.IsOnLayer(l2)] or [0]
    return [0]

def free1(li, i, j, n):
    if i < 0 or j < 0 or i >= NX or j >= NY: return False
    v = grid[li][j * NX + i]
    return v == -1 or v == n
def free(li, i, j, n):
    e = EXTRA[0]
    if not e: return free1(li, i, j, n)
    for dj in range(-e, e + 1):
        for di in range(-e, e + 1):
            if di * di + dj * dj <= e * e + 0.5 and not free1(li, i + di, j + dj, n): return False
    return True
VIAS = [(pcbnew.ToMM(t.GetPosition().x), pcbnew.ToMM(t.GetPosition().y), nid(t.GetNetname())) for t in board.GetTracks() if t.GetClass() == 'PCB_VIA']
VIAS += [(*P(p.GetPosition()), -3) for p in board.GetPads() if p.GetDrillSize().x > 0]
def own_via(i, j, n):
    """Existující prokov stejné sítě přímo v buňce: přechod vrstvy přes něj, nový se nevrtá."""
    x, y = X0 + i * G, Y0 + j * G
    return any(vn == n and (vx - x) ** 2 + (vy - y) ** 2 < 0.12 ** 2 for vx, vy, vn in VIAS)
def via_free(i, j, n):
    if own_via(i, j, n): return True
    # celý kruh prokovu (bez poloměru spoje, ten je v nafouknutí překážek) na všech vrstvách
    r = (VIA_D / 2 - TRACK / 2) / G + 1   # +1 buňka rezerva na zaokrouhlení mřížky
    ri = int(math.ceil(r))
    for li in range(len(LAYERS)):
        for dj in range(-ri, ri + 1):
            for di in range(-ri, ri + 1):
                if di * di + dj * dj <= r * r + 0.5 and not free(li, i + di, j + dj, n): return False
    # odstup vrtáků (hole-to-hole ≥ 0,25 mm mezi okraji)
    x, y = X0 + i * G, Y0 + j * G
    for vx, vy, _vn in VIAS:
        if (vx - x) ** 2 + (vy - y) ** 2 < (VIA_D + 0.3) ** 2: return False
    return True

DIRS = [(1, 0, 1.0), (-1, 0, 1.0), (0, 1, 1.0), (0, -1, 1.0), (1, 1, 1.414), (1, -1, 1.414), (-1, 1, 1.414), (-1, -1, 1.414)]
LAST_IT = [0]
def astar(net, a, b, limit=int(__import__('os').environ.get('FR_LIMIT', '6000000'))):
    n = nets.get(net)
    CUR_CLR[0] = clr_of(net)
    NECK[0] = math.hypot(a[0] - b[0], a[1] - b[1]) < 6.0
    EXTRA[0] = 0 if NECK[0] else int(math.ceil((width_of(net) - TRACK) / 2 / G))
    if n is None: return None
    saved = open_pads(n, a, b)
    try:
        return _astar(n, a, b, limit)
    finally:
        for li, k, v in saved:
            if grid[li][k] == n: grid[li][k] = v

def open_pads(n, *ends):
    """Buňky uvnitř skutečné plochy koncových plošek patří síti (jemná rozteč: nafouknutí sousedů je zabere)."""
    saved = []
    for e in ends:
        if not str(e[3]).startswith('Pad'): continue
        for pad in board.GetPads():
            px, py = P(pad.GetPosition())
            if abs(px - e[0]) > 0.05 or abs(py - e[1]) > 0.05: continue
            bb2 = pad.GetBoundingBox()
            x0, y0, x1, y1 = pcbnew.ToMM(bb2.GetLeft()), pcbnew.ToMM(bb2.GetTop()), pcbnew.ToMM(bb2.GetRight()), pcbnew.ToMM(bb2.GetBottom())
            for l in LAYERS:
                if not pad.IsOnLayer(l): continue
                li = LI[l]
                for j in range(int(math.ceil((y0 - Y0) / G)), int((y1 - Y0) / G) + 1):
                    for i in range(int(math.ceil((x0 - X0) / G)), int((x1 - X0) / G) + 1):
                        k = j * NX + i
                        if grid[li][k] == -2: saved.append((li, k, -2)); grid[li][k] = n
    return saved

def _astar(n, a, b, limit):
    ai, aj = cell(a[0], a[1]); bi, bj = cell(b[0], b[1])
    goals = set((li, bi, bj) for li in start_layers(b) if li in ROUTE_L)
    openh = []
    came = {}
    gs = {}
    for li in start_layers(a):
        if li not in ROUTE_L: continue
        s = (li, ai, aj); gs[s] = 0; heapq.heappush(openh, (0, s))
    W = 1.6
    it = 0
    while openh and it < limit:
        it += 1
        _, cur = heapq.heappop(openh)
        if cur in goals:
            path = [cur]
            while cur in came: cur = came[cur]; path.append(cur)
            return path[::-1]
        li, i, j = cur
        g0 = gs[cur]
        for di, dj, c in DIRS:
            ni, nj = i + di, j + dj
            # cíl a start leží ve vlastní mědi; jinde jen volné buňky
            if not free(li, ni, nj, n) and (li, ni, nj) not in goals: continue
            nb = (li, ni, nj); ng = g0 + c * LCOST[li]
            if ng < gs.get(nb, 1e18):
                gs[nb] = ng; came[nb] = cur
                h = math.hypot(ni - bi, nj - bj)
                heapq.heappush(openh, (ng + W * h, nb))
        if via_free(i, j, n):
            for l2 in ROUTE_L:
                if l2 == li: continue
                nb = (l2, i, j); ng = g0 + 25
                if ng < gs.get(nb, 1e18):
                    gs[nb] = ng; came[nb] = cur
                    heapq.heappush(openh, (ng + W * math.hypot(i - bi, j - bj), nb))
    LAST_IT[0] = it
    if __import__('os').environ.get('FR_DEBUG'):
        for l in range(len(LAYERS)):
            ks = [(X0 + k[1] * G, Y0 + k[2] * G) for k in gs if k[0] == l]
            if ks: print('   vrstva', l, len(ks), 'x', round(min(q[0] for q in ks), 2), round(max(q[0] for q in ks), 2), 'y', round(min(q[1] for q in ks), 2), round(max(q[1] for q in ks), 2))
        print('   start', a, 'cíl', b)
    return None

def commit(net, path):
    ni = board.FindNet(net)
    n = nets[net]
    CUR_CLR[0] = clr_of(net)
    # sloučit do úseků se stejným směrem a vrstvou
    pts = [(path[0][0], path[0][1], path[0][2])]
    for k in range(1, len(path)):
        pts.append(path[k])
    segs = []
    k = 0
    while k < len(pts) - 1:
        li, i, j = pts[k]
        if pts[k + 1][0] != li and own_via(i, j, n):
            k += 1; continue
        if pts[k + 1][0] != li:
            v = pcbnew.PCB_VIA(board); v.SetPosition(pcbnew.VECTOR2I(mm(X0 + i * G), mm(Y0 + j * G)))
            v.SetWidth(mm(VIA_D)); v.SetDrill(mm(VIA_DRILL)); v.SetNet(ni); board.Add(v); VIAS.append((X0 + i * G, Y0 + j * G, n))
            for l in range(len(LAYERS)): mark(l, X0 + i * G, Y0 + j * G, VIA_D / 2, n)
            k += 1; continue
        d = (pts[k + 1][1] - i, pts[k + 1][2] - j)
        m = k + 1
        while m + 1 < len(pts) and pts[m + 1][0] == li and (pts[m + 1][1] - pts[m][1], pts[m + 1][2] - pts[m][2]) == d: m += 1
        segs.append((li, i, j, pts[m][1], pts[m][2]))
        k = m
    for li, i0, j0, i1, j1 in segs:
        t = pcbnew.PCB_TRACK(board)
        t.SetStart(pcbnew.VECTOR2I(mm(X0 + i0 * G), mm(Y0 + j0 * G))); t.SetEnd(pcbnew.VECTOR2I(mm(X0 + i1 * G), mm(Y0 + j1 * G)))
        w = min(width_of(net), 0.25) if NECK[0] else width_of(net)
        t.SetWidth(mm(w)); t.SetLayer(LAYERS[li]); t.SetNet(ni); board.Add(t)
        mark_seg(li, X0 + i0 * G, Y0 + j0 * G, X0 + i1 * G, Y0 + j1 * G, w, n)

ok = fail = 0
def to_plane(net, a):
    """Krátký spoj od plošky k novému prokovu do roviny sítě."""
    n = nets.get(net)
    if n is None: return None
    CUR_CLR[0] = clr_of(net); EXTRA[0] = 0
    ai, aj = cell(a[0], a[1])
    best = None
    for r in range(3, 25):
        for dj in range(-r, r + 1):
            for di in (-r, r) if abs(dj) != r else range(-r, r + 1):
                i, j = ai + di, aj + dj
                if via_free(i, j, n):
                    d = di * di + dj * dj
                    if best is None or d < best[0]: best = (d, i, j)
        if best: break
    if not best: return None
    _, vi, vj = best
    tgt = (X0 + vi * G, Y0 + vj * G, pcbnew.F_Cu, 'Via')
    path = astar(net, a, tgt)
    if not path: return None
    # na konci prokov
    li, i, j = path[-1]
    v = pcbnew.PCB_VIA(board); v.SetPosition(pcbnew.VECTOR2I(mm(X0 + i * G), mm(Y0 + j * G)))
    v.SetWidth(mm(VIA_D)); v.SetDrill(mm(VIA_DRILL)); v.SetNet(board.FindNet(net)); board.Add(v); VIAS.append((X0 + i * G, Y0 + j * G, n))
    for l in range(len(LAYERS)): mark(l, X0 + i * G, Y0 + j * G, VIA_D / 2, n)
    return path

def nearest_same_net(net, a):
    """Nejbližší bod mědi stejné sítě (konec spoje, prokov, ploška) mimo samotný počáteční bod."""
    best = None
    pts = []
    for t in board.GetTracks():
        if t.GetNetname() != net: continue
        if t.GetClass() == 'PCB_VIA': pts.append((P(t.GetPosition()), pcbnew.F_Cu))
        else: pts += [(P(t.GetStart()), t.GetLayer()), (P(t.GetEnd()), t.GetLayer())]
    for pd in board.GetPads():
        if pd.GetNetname() == net: pts.append((P(pd.GetPosition()), pcbnew.F_Cu if pd.IsOnLayer(pcbnew.F_Cu) else pcbnew.B_Cu))
    for (x, y), l in pts:
        d = math.hypot(x - a[0], y - a[1])
        if d < 0.4: continue
        if best is None or d < best[0]: best = (d, (x, y, l, 'Pt'))
    return best[1] if best else None

import os as _os
NEAREST = _os.environ.get('FR_NEAREST') == '1'
for net, a, b in jobs:
    if NEAREST and b[0] != 'ZONE':
        for src in (a, b):
            if src[3].startswith('Pad'):
                nb = nearest_same_net(net, src)
                if nb:
                    a, b = src, nb
                break
    if b[0] == 'ZONE':
        path = to_plane(net, a)
        if path:
            commit(net, path); print(f'  ✓ {net} do roviny')
        else:
            print(f'  ✗ {net} do roviny')
        continue
    path = astar(net, a, b)
    if not path and net in ('GND', 'V5', 'VIN_P'):
        for src in (a, b):
            path = to_plane(net, src)
            if path:
                commit(net, path); ok += 1; print(f'  ✓ {net} prokovem do roviny'); break
        if path: continue
    if path:
        commit(net, path); ok += 1
        print(f'  ✓ {net} ({len(path)} kroků)')
    else:
        fail += 1
        print(f'  ✗ {net} (prohledáno {LAST_IT[0]} uzlů)')
board.Save(PCB)
print(f'spojeno {ok}, nespojeno {fail}')
