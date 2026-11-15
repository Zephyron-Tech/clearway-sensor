#!/bin/sh
# Znovu vygeneruje KiCad projekt desky CB3 do hardware/cb3 z tabulky src/cad/board-v3-data.js.
# POZOR: přepíše schéma i desku. Až se v KiCadu začne kreslit ručně, už nespouštět (nebo jen do jiné složky).
set -e
KICAD=${KICAD:-"$HOME/Applications/KiCad/KiCad.app"}
[ -d "$KICAD" ] || KICAD=/Applications/KiCad/KiCad.app
S="$KICAD/Contents/SharedSupport"
cd "$(dirname "$0")/../.."
node scripts/export-board.mjs
node scripts/kicad/gen-sch.mjs "$S/symbols" "$S/footprints"
"$KICAD/Contents/Frameworks/Python.framework/Versions/Current/bin/python3" scripts/kicad/gen-pcb.py "$S/footprints" 2>&1 | grep -v -e Fontconfig -e stdpbase -e 'zástupce neuložen'
node scripts/kicad/save-placeholders.mjs
