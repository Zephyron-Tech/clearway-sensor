#!/bin/sh
# Výrobní data desky CB3 do hardware/cb3/vyroba: Gerber (4 vrstvy + maska, potisk, pasta, obrys), vrtání,
# souřadnice osazení (pick & place), kusovník a PDF schématu. Formát odpovídá požadavkům JLCPCB / PCBWay.
set -e
KICAD=${KICAD:-"$HOME/Applications/KiCad/KiCad.app"}
[ -d "$KICAD" ] || KICAD=/Applications/KiCad/KiCad.app
CLI="$KICAD/Contents/MacOS/kicad-cli"
cd "$(dirname "$0")/../../../hardware/cb3"
OUT=vyroba
rm -rf "$OUT" && mkdir -p "$OUT/gerber"
"$CLI" pcb export gerbers --layers F.Cu,In1.Cu,In2.Cu,B.Cu,F.Mask,B.Mask,F.Paste,B.Paste,F.Silkscreen,B.Silkscreen,Edge.Cuts \
  --subtract-soldermask --use-drill-file-origin -o "$OUT/gerber/" cb3.kicad_pcb
"$CLI" pcb export drill --format excellon --excellon-separate-th --generate-map --map-format pdf -o "$OUT/gerber/" cb3.kicad_pcb
"$CLI" pcb export pos --format csv --units mm --side both --exclude-dnp -o "$OUT/cb3-osazeni.csv" cb3.kicad_pcb
"$CLI" sch export bom --fields 'Reference,Value,Footprint,MPN,${QUANTITY}' --labels 'Designator,Hodnota,Pouzdro,Typ (MPN),Počet' \
  --group-by 'Value,Footprint,MPN' --ref-range-delimiter '' -o "$OUT/cb3-kusovnik.csv" cb3.kicad_sch
"$CLI" sch export pdf -o "$OUT/cb3-schema.pdf" cb3.kicad_sch
"$CLI" pcb export pdf --layers F.Cu,F.Silkscreen,Edge.Cuts --mode-single -o "$OUT/cb3-osazeni-top.pdf" cb3.kicad_pcb
( cd "$OUT/gerber" && zip -q -r ../cb3-gerber.zip . )
echo "hotovo: $(ls "$OUT")"
