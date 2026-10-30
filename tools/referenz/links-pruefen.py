#!/usr/bin/env python3
"""Prüft die Verweise in den erzeugten PDFs (Abnahmepunkt 7 der Vorgabe).

Termin-Button, QR-Code, Pentest-Link, mailto:, tel: und alle Sprungmarken des
Inhaltsverzeichnisses müssen im PDF funktionieren. Ein Verweis ins Leere fällt
beim Lesen nicht auf, beim Klicken schon.

    python3 tools/referenz/links-pruefen.py <ordner-mit-pdfs>
"""
import sys
from collections import Counter
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    sys.exit("pypdf fehlt — pip install pypdf")

ERWARTETE_ARTEN = ("mailto:", "tel:", "https://")


def pruefe(pdf: Path) -> list[str]:
    r = PdfReader(str(pdf))
    namen = {n.lstrip("/") for n in r.named_destinations}
    fehler, extern, sprung = [], Counter(), 0
    for nr, seite in enumerate(r.pages, 1):
        for annot in seite.get("/Annots") or []:
            o = annot.get_object()
            aktion = o.get("/A") or {}
            if aktion.get("/URI"):
                uri = str(aktion["/URI"])
                extern[uri] += 1
                if not uri.startswith(ERWARTETE_ARTEN):
                    fehler.append(f"Seite {nr}: unerwartete Verweisart {uri}")
                continue
            ziel = o.get("/Dest") or aktion.get("/D")
            if ziel is None:
                continue
            sprung += 1
            if isinstance(ziel, list):
                continue  # direkter Seitenverweis
            if str(ziel).lstrip("/") not in namen:
                fehler.append(f"Seite {nr}: Sprungmarke ins Leere ({ziel})")
    if not sprung:
        fehler.append("keine einzige Sprungmarke — Inhaltsverzeichnis ohne Verweise?")
    if not extern:
        fehler.append("kein einziger externer Verweis — Termin- und Pentest-Link fehlen?")
    return fehler


def main() -> int:
    if len(sys.argv) < 2:
        sys.exit("Aufruf: links-pruefen.py <ordner-mit-pdfs>")
    pdfs = sorted(Path(sys.argv[1]).glob("*.pdf"))
    if not pdfs:
        sys.exit(f"keine PDFs in {sys.argv[1]}")
    schlecht = 0
    for pdf in pdfs:
        fehler = pruefe(pdf)
        if fehler:
            schlecht += 1
            print(f"[VERWEISE] {pdf.name}")
            for f in fehler:
                print(f"    - {f}")
    if schlecht:
        print(f"\nVerweise: {schlecht} von {len(pdfs)} PDFs mit Befund.")
        return 1
    print(f"\nVerweise: {len(pdfs)} von {len(pdfs)} PDFs ohne Befund.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
