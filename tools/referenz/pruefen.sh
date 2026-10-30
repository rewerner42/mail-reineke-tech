#!/usr/bin/env bash
# Layout check for the report: renders every dataset with headless Chrome and
# reports page counts plus any element crossing the print margin.
#
#   npm run bericht:pruefen            # the eleven reference datasets
#   npm run bericht:pruefen -- synth   # one dataset per catalogue key
#
# Needs Google Chrome and poppler (pdfinfo, pdftoppm) from the system; the Python
# packages go into a throwaway virtual environment under the work directory.
set -euo pipefail
cd "$(dirname "$0")/../.."

ARBEIT="${BERICHT_ARBEIT:-${TMPDIR:-/tmp}/bericht-pruefen}"
VENV="$ARBEIT/venv"
mkdir -p "$ARBEIT"
if [ ! -x "$VENV/bin/python" ]; then
  echo "Richte Python-Umgebung in $VENV ein ..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet jinja2 pillow
fi

if [ "${1:-}" = "synth" ]; then
  rm -rf "$ARBEIT/synth" tools/referenz/vorlage/synth-out
  npx tsx tools/viewmodelle.ts "$ARBEIT/synth" --synthetisch
  set +e
  "$VENV/bin/python" tools/referenz/generator/render.py tools/referenz/vorlage \
    --signale "$ARBEIT/synth/signale" --viewmodelle "$ARBEIT/synth" --ausgabe synth-out
  STATUS=$?
  set -e
  npx tsx tools/template-pruefen.ts tools/referenz/vorlage/synth-out "$ARBEIT/synth"
  exit $STATUS
fi

rm -rf "$ARBEIT/referenz"
npx tsx tools/viewmodelle.ts "$ARBEIT/referenz"
set +e
"$VENV/bin/python" tools/referenz/generator/render.py tools/referenz/vorlage \
  --viewmodelle "$ARBEIT/referenz" --ausgabe "out" "$@" | tee "$ARBEIT/lauf.log"
STATUS=${PIPESTATUS[0]}
set -e

# Page counts are an acceptance criterion: the template estimates breaks from
# character counts, so a catalogue change moves them. Compare against the
# recorded targets and name every difference.
"$VENV/bin/python" - "$ARBEIT/lauf.log" <<'PYEOF'
import json, re, sys
soll = {k: v for k, v in json.load(open("tools/referenz/seitenzahlen.json")).items()
        if not k.startswith("_")}
ist = dict(re.findall(r"^\[\w+\] (\S+?): (\d+) Seiten", open(sys.argv[1]).read(), re.M))
abweichung = []
for name, erwartet in sorted(soll.items()):
    if name not in ist:
        abweichung.append(f"  {name}: nicht gerendert")
    elif int(ist[name]) != erwartet:
        abweichung.append(f"  {name}: {ist[name]} Seiten, erwartet {erwartet}")
for name in sorted(set(ist) - set(soll)):
    abweichung.append(f"  {name}: {ist[name]} Seiten, kein Sollwert hinterlegt")
if abweichung:
    print("\nSeitenzahlen abweichend:"); print("\n".join(abweichung))
    print("\nStimmen die neuen Werte, in tools/referenz/seitenzahlen.json festschreiben.")
    sys.exit(1)
print(f"\nSeitenzahlen: {len(soll)} von {len(soll)} wie hinterlegt.")
PYEOF
# The ported page planning (src/report/seitenplan.ts) against the numbers the
# template itself rendered: page count and every entry in the contents.
npx tsx tools/seitenplan-pruefen.ts tools/referenz/vorlage/out "$ARBEIT/referenz"

# The ported template (src/report/template.ts) against the HTML the Jinja2
# template produced for the same view model, character for character.
npx tsx tools/template-pruefen.ts tools/referenz/vorlage/out "$ARBEIT/referenz"

exit $STATUS
