#!/usr/bin/env python3
"""Übernimmt die <style>-Blöcke der Jinja2-Vorlage nach src/report/css.ts.

Das Stylesheet ist gemeinsam mit den Millimeter-Konstanten in seitenplan.ts
kalibriert. Abschreiben wäre eine Fehlerquelle, deshalb wird es kopiert.

    python3 tools/css-uebernehmen.py
"""
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
VORLAGE = BASE / "tools" / "referenz" / "vorlage"
ZIEL = BASE / "src" / "report" / "css.ts"

def block(pfad: Path) -> str:
    t = pfad.read_text()
    return t[t.index("<style>") + len("<style>"):t.index("</style>")]

haupt = block(VORLAGE / "template.html.j2")
deckblatt = block(VORLAGE / "deckblatt.html.j2")
for name, css in (("template.html.j2", haupt), ("deckblatt.html.j2", deckblatt)):
    for zeichen in ("`", "${", "\\"):
        if zeichen in css:
            raise SystemExit(f"{name}: {zeichen!r} im CSS — String.raw`` trägt das nicht")

kopf = ZIEL.read_text().split("/* eslint-disable */")[0] + "/* eslint-disable */\n"
ZIEL.write_text(kopf + "\nexport const BERICHT_CSS = String.raw`" + haupt + "`;\n"
                + "\nexport const DECKBLATT_CSS = String.raw`" + deckblatt + "`;\n")
print(f"{ZIEL.relative_to(BASE)}: {len(haupt.splitlines())} + {len(deckblatt.splitlines())} Zeilen CSS")
