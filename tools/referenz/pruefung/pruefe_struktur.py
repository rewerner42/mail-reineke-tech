"""Prüft Kapitelfolge, Kopf-/Fußzeilen, Seitenverweise und Sprungmarken in gerenderten Befund-HTMLs.

Aufruf: python pruefe_struktur.py <html> [<pdf>]
Ohne PDF wird nur das HTML geprüft. Mit PDF zusätzlich: Seitenzahl, benannte Ziele (pdfinfo -dests),
Text „Seite n von N“ je PDF-Seite (pdftotext).
"""
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from minidom import parse, norm  # noqa: E402

SOLL = [" Inhalt", "01 Zusammenfassung", "02 Empfehlungen", "03 Über Reineke Technik", "04 Nächster Schritt",
        "05 Feststellungen im Einzelnen", "A Messwerte", "B Methodik und Bewertung"]


def seiten(root):
    return [n for n in root.iter() if n.tag == "section" and "page" in n.cls]


def analyse(html_path, pdf_path=None, quiet=False):
    html = Path(html_path).read_text()
    root = parse(html)
    pages = seiten(root)
    N = len(pages)
    probleme, info = [], []
    id_page = {}
    kapitel = []  # (seite, nr, titel)
    kopf_folge = []
    for i, pg in enumerate(pages, 1):
        for n in pg.iter():
            if "id" in n.attrs:
                if n.attrs["id"] in id_page:
                    probleme.append(f"ID doppelt: {n.attrs['id']}")
                id_page[n.attrs["id"]] = i
        for kk in pg.find_all(lambda n: n.tag == "div" and "kk" in n.cls):
            nr = [c for c in kk.iter() if c.tag == "div" and "nr" in c.cls]
            h1 = [c for c in kk.iter() if c.tag == "h1"]
            kapitel.append((i, norm(nr[0].text()) if nr else "?", norm(h1[0].text()) if h1 else "?"))
        sek = [norm(n.text()) for n in pg.find_all(lambda n: n.tag == "div" and "sek" in n.cls)]
        kk_kap = [norm(n.text()) for n in pg.find_all(lambda n: n.tag == "div" and "k-kap" in n.cls)]
        fuss = [norm(n.text()) for n in pg.find_all(lambda n: n.tag == "span" and "f3" in n.cls)]
        kopf_folge.append((i, kk_kap[0] if kk_kap else "(kein Kopf)", fuss[0] if fuss else "(keine Fußzeile)", sek))
        if i > 1:
            if not fuss:
                probleme.append(f"Seite {i}: keine Fußzeile")
            else:
                m = re.fullmatch(r"Seite (\d+) von (\d+)", fuss[0])
                if not m or int(m.group(1)) != i or int(m.group(2)) != N:
                    probleme.append(f"Seite {i}: Fußzeile „{fuss[0]}“, erwartet „Seite {i} von {N}“")

    # Kapitelfolge
    ist = [f"{nr} {t}" for (_, nr, t) in kapitel]
    if ist != SOLL:
        probleme.append(f"Kapitelfolge weicht ab: {ist}")

    # Sprungmarken
    links = []
    for i, pg in enumerate(pages, 1):
        for a in pg.find_all(lambda n: n.tag == "a" and (n.attrs.get("href") or "").startswith("#")):
            links.append((i, a.attrs["href"][1:], norm(a.text()), a))
    tote = [(i, t, txt) for (i, t, txt, _) in links if t not in id_page]
    for i, t, txt in tote:
        probleme.append(f"Seite {i}: toter Link #{t} („{txt}“)")

    # Seitenverweise „Seite X“ auf Feststellungen
    verweise = 0
    for (i, t, txt, a) in links:
        m = re.fullmatch(r"Seite (\d+)", txt)
        if m:
            verweise += 1
            if id_page.get(t) != int(m.group(1)):
                probleme.append(f"Seite {i}: „{txt}“ verweist auf {t}, das auf Seite {id_page.get(t)} steht")
    # Spalte Bezug: „Seite a–b“
    bezug_n = 0
    for i, pg in enumerate(pages, 1):
        for b in pg.find_all(lambda n: n.tag == "div" and "bezug" in n.cls):
            fs = [a.attrs["href"][1:] for a in b.iter() if a.tag == "a"]
            ref = [norm(s.text()) for s in b.iter() if s.tag == "span" and "seitenref" in s.cls]
            if not fs:
                continue
            bezug_n += 1
            ps = sorted({id_page.get(f) for f in fs})
            zus = len(ps) > 1 and ps[-1] - ps[0] + 1 == len(ps)
            soll = "· S. " + (f"{ps[0]}–{ps[-1]}" if zus else ", ".join(str(p) for p in ps))
            ist = ref[0].replace(" ", " ") if ref else None
            if not ref or ist != soll:
                probleme.append(f"Seite {i}: Bezug {fs} zeigt „{ref[0] if ref else '-'}“, richtig wäre „{soll}“")
            # Lücken im Bereich (a–b, aber dazwischen keine eigene Feststellung): nur Info
    # Vorspann „ab Seite X“
    ab = re.findall(r"Details zu den Feststellungen: Kapitel 05 ab Seite (\d+)", html)
    k05 = [s for (s, nr, t) in kapitel if nr == "05"]
    if ab:
        if not k05 or int(ab[0]) != k05[0]:
            probleme.append(f"Vorspann nennt „ab Seite {ab[0]}“, Kapitel 05 beginnt auf Seite {k05[0] if k05 else '?'}")
    # Andere Text-Verweise auf Kapitel/Anhänge
    text_all = norm(root.text(" "))
    querverweise = sorted(set(re.findall(r"[^.]{0,60}\b(?:Kapitel|Anhang|Anhängen|Abschnitt)\b[^.]{0,40}", text_all)))

    # PDF
    pdf_info = {}
    if pdf_path:
        out = subprocess.run(["pdfinfo", str(pdf_path)], capture_output=True, text=True).stdout
        pdf_seiten = int(re.search(r"Pages:\s+(\d+)", out).group(1))
        pdf_info["seiten"] = pdf_seiten
        if pdf_seiten != N:
            probleme.append(f"PDF hat {pdf_seiten} Seiten, HTML {N} section.page")
        dests = subprocess.run(["pdfinfo", "-dests", str(pdf_path)], capture_output=True, text=True).stdout
        dmap = {}
        for line in dests.splitlines()[1:]:
            m = re.match(r"\s*(\d+)\s+\[.*\]\s+\"(.+)\"", line)
            if m:
                dmap[m.group(2)] = int(m.group(1))
        pdf_info["dests"] = dmap
        for k, v in id_page.items():
            if k in dmap and dmap[k] != v:
                probleme.append(f"PDF-Ziel {k} liegt auf PDF-Seite {dmap[k]}, im HTML auf Seite {v}")
        fehlend = sorted({t for (_, t, _, _) in links} - set(dmap))
        if fehlend:
            probleme.append(f"Linkziele ohne benanntes PDF-Ziel: {fehlend}")
        # Fußzeilen im PDF-Text
        for p in range(2, pdf_seiten + 1):
            t = subprocess.run(["pdftotext", "-f", str(p), "-l", str(p), "-layout", str(pdf_path), "-"],
                               capture_output=True, text=True).stdout
            if f"Seite {p} von {pdf_seiten}" not in t:
                probleme.append(f"PDF-Seite {p}: „Seite {p} von {pdf_seiten}“ nicht im Text")
        # Links im PDF zählen (Annotationen /Link mit /Dest oder /GoTo)
        raw = subprocess.run(["qpdf", "--qdf", "--object-streams=disable", str(pdf_path), "-"],
                             capture_output=True).stdout
        pdf_info["link_annots"] = raw.count(b"/Subtype /Link")
        pdf_info["goto"] = len(re.findall(rb"/S /GoTo|/Dest ", raw))
        pdf_info["uri"] = raw.count(b"/S /URI")

    return {"N": N, "kapitel": kapitel, "kopf": kopf_folge, "probleme": probleme, "links": len(links),
            "seitenverweise": verweise, "bezug": bezug_n, "querverweise": querverweise, "pdf": pdf_info,
            "id_page": id_page}


if __name__ == "__main__":
    r = analyse(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    print("Seiten:", r["N"], "| PDF:", r["pdf"].get("seiten"), "| interne Links:", r["links"],
          "| Seitenverweise:", r["seitenverweise"], "| Bezug-Zeilen:", r["bezug"],
          "| PDF-Link-Annots:", r["pdf"].get("link_annots"), "GoTo:", r["pdf"].get("goto"), "URI:", r["pdf"].get("uri"))
    for s, nr, t in r["kapitel"]:
        print(f"  Kapitel auf S. {s}: {nr} {t}")
    for i, kap, f, sek in r["kopf"]:
        print(f"  S. {i:>2}: Kopf={kap!r:<28} Fuß={f!r} {('Sek=' + str(sek)) if sek else ''}")
    print("  Querverweise im Text:")
    for q in r["querverweise"]:
        print("   -", q)
    print("PROBLEME:" if r["probleme"] else "Keine Probleme gefunden.")
    for p in r["probleme"]:
        print("  !", p)
