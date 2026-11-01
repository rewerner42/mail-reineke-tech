#!/usr/bin/env python3
"""Übernimmt geprüfte Textänderungen in den Katalog.

    python3 tools/katalog-uebernehmen.py <aenderungen.json> [--schreiben]

Die Datei enthält eine Liste von Änderungen (oder ein Objekt mit dem Schlüssel
"aenderungen"), jede mit "ort", "alt" und "neu". "ort" ist der Pfad im Katalog,
z. B. "feststellungen.dmarc_fehlt.kurz".

Übernommen wird nur, was zeichengenau auf den heutigen Text passt. Ohne
--schreiben wird nur geprüft. Jede Regelverletzung bricht ab, bevor etwas
geschrieben wird:
  - "alt" weicht vom heutigen Text ab (die Änderung bezieht sich auf einen
    anderen Stand),
  - ein neuer Platzhalter, den der Renderer an dieser Stelle nicht füllt,
  - die Form des Feldes stimmt nicht (Schlusspunkt bei Sätzen, keiner bei
    Schritten, Listenpunkten und Positivtexten).
Länger als 10 % und weggefallene Platzhalter werden gemeldet, aber nicht
abgelehnt: Beides kann gewollt sein, die Seitenplanung prüft danach
`npm run bericht:pruefen`.
"""

import json
import re
import sys
from pathlib import Path

KATALOG = Path(__file__).resolve().parent.parent / "src/report/daten/katalog.json"
PLATZHALTER = re.compile(r"\{(\w+)\}")
SATZ = {"kurz", "feststellung", "angriff", "auswirkung", "aufwand_text"}
OHNE_PUNKT = {"schritt", "offen", "titel"}


def form_fehler(ort: str, text: str) -> str | None:
    teile = ort.split(".")
    feld = teile[-1]
    if teile[0] == "feststellungen" and feld in SATZ and not text.endswith("."):
        return "ganzer Satz ohne Schlusspunkt"
    if teile[0] == "feststellungen" and feld in OHNE_PUNKT and text.endswith("."):
        return "Schlusspunkt, obwohl der Bericht selbst einen setzt oder keinen braucht"
    if teile[0] == "positiv" and text.endswith("."):
        return "Positivtext mit Schlusspunkt"
    if "!" in text:
        return "Ausrufezeichen"
    return None


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    roh = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    aenderungen = roh["aenderungen"] if isinstance(roh, dict) else roh
    schreiben = "--schreiben" in sys.argv

    quelle = KATALOG.read_text(encoding="utf-8")
    katalog = json.loads(quelle)
    if json.dumps(katalog, ensure_ascii=False, indent=2) + "\n" != quelle:
        print("Der Katalog ist nicht im erwarteten Format gespeichert; bitte zuerst angleichen.")
        return 1

    fehler: list[str] = []
    hinweise: list[str] = []
    gesehen: set[str] = set()
    for a in aenderungen:
        ort, alt, neu = a["ort"], a["alt"], a["neu"]
        if ort in gesehen:
            fehler.append(f"{ort}: doppelt in der Änderungsliste")
            continue
        gesehen.add(ort)
        *weg, letzter = ort.split(".")
        knoten = katalog
        for teil in weg:
            if not isinstance(knoten, dict) or teil not in knoten:
                knoten = None
                break
            knoten = knoten[teil]
        if not isinstance(knoten, dict) or letzter not in knoten:
            fehler.append(f"{ort}: gibt es im Katalog nicht")
            continue
        if knoten[letzter] != alt:
            fehler.append(f"{ort}: „alt“ passt nicht zum heutigen Text")
            continue
        vorher, nachher = set(PLATZHALTER.findall(alt)), set(PLATZHALTER.findall(neu))
        if nachher - vorher:
            fehler.append(f"{ort}: neuer Platzhalter {sorted(nachher - vorher)}")
        if vorher - nachher:
            hinweise.append(f"{ort}: Platzhalter entfällt {sorted(vorher - nachher)}")
        form = form_fehler(ort, neu)
        if form:
            fehler.append(f"{ort}: {form}")
        if len(neu) > len(alt) * 1.1:
            hinweise.append(f"{ort}: {len(alt)} → {len(neu)} Zeichen (+{len(neu) - len(alt)})")
        knoten[letzter] = neu

    for h in hinweise:
        print("Hinweis:", h)
    for f in fehler:
        print("FEHLER:", f)
    if fehler:
        print(f"Nichts übernommen: {len(fehler)} Fehler.")
        return 1
    if schreiben:
        KATALOG.write_text(json.dumps(katalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{len(aenderungen)} Änderungen in {KATALOG.name} übernommen.")
    else:
        print(f"{len(aenderungen)} Änderungen geprüft, nichts geschrieben (--schreiben zum Übernehmen).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
