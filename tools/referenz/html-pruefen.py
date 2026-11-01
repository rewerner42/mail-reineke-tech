#!/usr/bin/env python3
"""Prüft fertiges Bericht-HTML: Seitenzahl, Überlauf, A4-Format — und rendert es.

Für Markenfassungen (Sharp), die die Jinja2-Vorlage nicht kennt. Das HTML kommt
aus tools/marke-html.ts, also aus derselben Vorlage, die der Worker benutzt.
Prüfskript, Chrome-Aufruf und Kontaktbogen stammen aus generator/render.py,
damit beide Prüfstände dasselbe messen.

    python html-pruefen.py <ordner-mit-html> <ausgabeordner> [--messen .angebot] [--dpi 70]

--messen meldet für jedes Element zum Selektor die Höhe samt oberem Außenabstand
in Millimetern — so wird eine Konstante in src/report/seitenplan.ts kalibriert.
"""
import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "generator"))
from render import CHECK_JS, attr, chrome, kontaktbogen  # noqa: E402

MESS_JS = r"""
<script>
(function () {
  var px = 25.4 / 96, aus = [];
  document.querySelectorAll(%s).forEach(function (el) {
    var b = el.getBoundingClientRect(), cs = getComputedStyle(el);
    var seite = Array.prototype.indexOf.call(document.querySelectorAll('.page'), el.closest('.page')) + 1;
    aus.push({seite: seite, mm: Math.round((b.height + parseFloat(cs.marginTop)) * px * 10) / 10});
  });
  document.documentElement.setAttribute('data-messung', JSON.stringify(aus));
})();
</script>
"""


def pruefe(html_path: Path, ziel: Path, dpi: int, messen: str | None):
    html = html_path.read_text()
    slug = html_path.stem
    skripte = CHECK_JS + (MESS_JS % json.dumps(messen) if messen else "")
    check = html.replace("</body>", skripte + "</body>")
    with tempfile.TemporaryDirectory(prefix="rt-check-") as tmp:
        check_path = Path(tmp) / f"{slug}.check.html"
        check_path.write_text(check)
        dom = chrome(["--virtual-time-budget=3000", "--dump-dom", check_path.as_uri()])
    seiten_html = int(attr(dom, "data-seiten") or 0)
    ueberlauf = json.loads(attr(dom, "data-ueberlauf") or "[]")
    format_fehler = json.loads(attr(dom, "data-formatfehler") or "[]")
    messung = json.loads(attr(dom, "data-messung") or "[]")

    pdf = ziel / f"{slug}.pdf"
    chrome(["--no-pdf-header-footer", f"--print-to-pdf={pdf}", html_path.resolve().as_uri()])
    info = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True).stdout
    seiten = int(re.search(r"Pages:\s+(\d+)", info).group(1))
    for alt in ziel.glob(f"{slug}-seite-*.png"):
        alt.unlink()
    subprocess.run(["pdftoppm", "-r", str(dpi), "-png", str(pdf), str(ziel / f"{slug}-seite")], check=True)
    pngs = sorted(ziel.glob(f"{slug}-seite-*.png"), key=lambda p: int(re.search(r"-(\d+)\.png$", p.name).group(1)))
    bogen = ziel / f"{slug}-uebersicht.png"
    kontaktbogen(pngs, bogen)

    fehler = []
    if seiten_html == 0:
        fehler.append('Keine Elemente mit class="page" gefunden.')
    if seiten != seiten_html:
        fehler.append(f"PDF hat {seiten} Seiten, Vorlage hat {seiten_html} .page-Elemente "
                      "(eine Seite ist über A4 hinausgewachsen).")
    for f in format_fehler:
        fehler.append(f"Seite {f['seite']} ist nicht A4 ({f['breite_px']}×{f['hoehe_px']} px, erwartet 794×1123).")
    for u in ueberlauf:
        teile = []
        if u["unten_px"] > 0:
            teile.append(f"{u['unten_px']} px über den unteren Inhaltsrand ({u['element_unten']})")
        if u["rechts_px"] > 0:
            teile.append(f"{u['rechts_px']} px über den rechten Rand ({u['element_rechts']})")
        fehler.append(f"Seite {u['seite']}: " + "; ".join(teile))
    return seiten, fehler, messung, bogen


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ordner", type=Path)
    ap.add_argument("ausgabe", type=Path)
    ap.add_argument("--messen")
    ap.add_argument("--dpi", type=int, default=70)
    a = ap.parse_args()
    a.ausgabe.mkdir(parents=True, exist_ok=True)

    gesamt = 0
    for html_path in sorted(a.ordner.glob("*.html")):
        seiten, fehler, messung, bogen = pruefe(html_path, a.ausgabe, a.dpi, a.messen)
        status = "OK" if not fehler else f"{len(fehler)} FEHLER"
        mess = "".join(f" · {a.messen} S. {m['seite']}: {m['mm']} mm" for m in messung)
        print(f"[{status}] {html_path.stem}: {seiten} Seiten{mess} -> {bogen}")
        for f in fehler:
            print(f"    - {f}")
        gesamt += len(fehler)
    sys.exit(1 if gesamt else 0)


if __name__ == "__main__":
    main()
