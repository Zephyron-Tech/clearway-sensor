"""Propojí pouzdra na desce se symboly ve schématu (cesta symbolu, list, pole MPN), aby seděla
kontrola parity DPS ↔ schéma a fungovala Aktualizace DPS ze schématu (F8).

  python3 link-pcb.py <deska.kicad_pcb> <adresář se schématy>
"""
import os, re, sys
import pcbnew

PCB, DIR = sys.argv[1], sys.argv[2]

def blocks(txt, head):
    """Vrátí texty S-výrazů začínajících `head` (např. '(symbol')."""
    out, i = [], 0
    while True:
        i = txt.find(head, i)
        if i < 0: return out
        d, j = 0, i
        while True:
            c = txt[j]
            if c == '"':
                j += 1
                while txt[j] != '"':
                    j += 2 if txt[j] == '\\' else 1
            elif c == '(': d += 1
            elif c == ')':
                d -= 1
                if d == 0: break
            j += 1
        out.append(txt[i:j + 1]); i = j + 1

sym = {}
for f in sorted(os.listdir(DIR)):
    if not f.endswith('.kicad_sch'): continue
    txt = open(os.path.join(DIR, f), encoding='utf-8').read()
    for b in blocks(txt, '(symbol\n') + blocks(txt, '(symbol (lib_id'):
        if '(lib_id' not in b[:200]: continue
        uu = re.search(r'\n\s*\(uuid "([^"]+)"\)', b)
        inst = re.search(r'\(path "([^"]+)"\s*\(reference "([^"]+)"', b)
        if not uu or not inst: continue
        ref = inst.group(2)
        if ref.startswith('#'): continue
        props = dict(re.findall(r'\(property "([^"]+)" "((?:[^"\\]|\\.)*)"', b))
        sheet = inst.group(1).split('/')[2:]   # bez kořene
        sym[ref] = {'path': '/' + '/'.join(sheet + [uu.group(1)]), 'file': f, 'props': props}

root = open(os.path.join(DIR, 'cb3.kicad_sch'), encoding='utf-8').read()
names = {}
for b in blocks(root, '(sheet\n') + blocks(root, '(sheet (at'):
    fn = re.search(r'\(property "Sheetfile" "([^"]+)"', b); nm = re.search(r'\(property "Sheetname" "([^"]+)"', b)
    if fn and nm: names[fn.group(1)] = nm.group(1)

board = pcbnew.LoadBoard(PCB)
n = miss = 0
for fp in board.GetFootprints():
    s = sym.get(fp.GetReference())
    if not s: miss += 1; print('bez symbolu:', fp.GetReference()); continue
    fp.SetPath(pcbnew.KIID_PATH(s['path']))
    fp.SetSheetfile(s['file']); fp.SetSheetname(names.get(s['file'], s['file'].split('.')[0]))
    fp.SetValue(s['props'].get('Value', fp.GetValue()))
    for k in ('MPN', 'Datasheet', 'Description'):
        if k in s['props']:
            fp.SetField(k, s['props'][k])
            for f in fp.GetFields():
                if f.GetName() == k: f.SetVisible(False)
    n += 1

# nezapojené vývody: KiCad jim ve schématu dává sítě „unconnected-(…)“, na desce mají být stejné
import subprocess, tempfile
CLI = os.path.join(os.path.dirname(sys.executable).split('/Contents/')[0], 'Contents/MacOS/kicad-cli')
with tempfile.TemporaryDirectory() as td:
    net = os.path.join(td, 'n.net')
    subprocess.run([CLI, 'sch', 'export', 'netlist', '--format', 'kicadsexpr', '-o', net, os.path.join(DIR, 'cb3.kicad_sch')], check=True, capture_output=True)
    ntxt = re.sub(r'\s+', ' ', open(net, encoding='utf-8').read())
pads = {(fp.GetReference(), pd.GetNumber()): pd for fp in board.GetFootprints() for pd in fp.Pads()}
nc = 0
for b in blocks(ntxt, '(net (code'):
    name = re.search(r'\(name "((?:[^"\\]|\\.)*)"\)', b).group(1)
    if not name.startswith('unconnected-'): continue
    ni = board.FindNet(name)
    if not ni:
        ni = pcbnew.NETINFO_ITEM(board, name); board.Add(ni)
    for ref, pin in re.findall(r'\(node \(ref "([^"]+)"\) \(pin "([^"]+)"\)', b):
        pd = pads.get((ref, pin))
        if pd and not pd.GetNetname(): pd.SetNet(ni); nc += 1
print('nezapojené vývody', nc)
board.Save(PCB)
print(f'propojeno {n}, bez symbolu {miss}, symbolů ve schématu {len(sym)}')
