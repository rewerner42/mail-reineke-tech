#!/usr/bin/env bash
# Layoutprüfung einer Markenfassung des Berichts (heute: Sharp). Rendert das
# HTML, das der Worker erzeugt, mit Headless Chrome und meldet Seitenzahl und
# jedes Element, das über den Druckrand ragt. Die Reineke-Fassung prüft weiter
# tools/referenz/pruefen.sh gegen die Jinja2-Vorlage.
#
#   npm run bericht:pruefen:marke                 # Sharp, elf Referenzdatensätze
#   npm run bericht:pruefen:marke -- synth        # ein Datensatz je Katalogschlüssel
#   npm run bericht:pruefen:marke -- --vertrieb nico
#
# Ergebnisse (PDF, Seitenbilder, Übersicht) unter tools/referenz/vorlage/marke-out/.
set -euo pipefail
cd "$(dirname "$0")/../.."

ARBEIT="${BERICHT_ARBEIT:-${TMPDIR:-/tmp}/bericht-pruefen}"
VENV="$ARBEIT/venv"
mkdir -p "$ARBEIT"
if [ ! -x "$VENV/bin/python" ]; then
  echo "Richte Python-Umgebung in $VENV ein ..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet jinja2 pillow pypdf
fi

MARKE="${MARKE:-sharp}"
ARGS=()
if [ "${1:-}" = "synth" ]; then
  ARGS+=(--synthetisch)
  shift
fi
rm -rf "$ARBEIT/marke" tools/referenz/vorlage/marke-out
# ${ARGS[@]+…}: macOS bringt Bash 3.2 mit, dort bricht ein leeres Array unter set -u ab.
npx tsx tools/marke-html.ts "$MARKE" "$ARBEIT/marke" ${ARGS[@]+"${ARGS[@]}"} "$@"
"$VENV/bin/python" tools/referenz/html-pruefen.py "$ARBEIT/marke" tools/referenz/vorlage/marke-out \
  --messen .angebot
