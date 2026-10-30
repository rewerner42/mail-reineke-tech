#!/usr/bin/env python3
"""Referenz-Renderer für den Sicherheitsbefund (Lead-Magnet).

Scan-Signale (JSON) + Inhaltskatalog + Firmendaten -> View-Model -> Jinja2-Vorlage
-> HTML -> PDF (Headless Chrome) -> Seitenbilder und Überlaufprüfung.

Aufruf:
  python render.py <variantenordner> [--nur <teil-des-dateinamens>] [--dpi 70]
  python render.py <variantenordner> --signale generator/daten/stresstest --nur-pruefen

Der Variantenordner enthält template.html.j2. Ergebnisse landen in <variantenordner>/out/.
Voraussetzungen: Python 3.10+, jinja2, pillow, Google Chrome, poppler (pdfinfo, pdftoppm).
Der Chrome-Pfad lässt sich mit der Umgebungsvariable CHROME überschreiben.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape
from markupsafe import Markup, escape

GEN = Path(__file__).resolve().parent
BASE = GEN.parent
# Images live with the Worker's static files; this tool renders the same report
# locally for calibration, so it reads them from there rather than keeping copies.
ASSETS = Path(os.environ.get("ASSETS_DIR", BASE.parent.parent / "public" / "assets")).resolve()
# One catalogue, one set of signals: the tool reads the Worker's own data files
# so the two implementations can never drift apart.
REPO = BASE.parent.parent
DATEN = REPO / "src" / "report" / "daten"
SIGNALE = REPO / "tests" / "fixtures" / "referenz" / "signale"
CHROME = os.environ.get("CHROME", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")

MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
          "August", "September", "Oktober", "November", "Dezember"]
PRIO_RANG = {"hoch": 0, "mittel": 1, "gering": 2}
# Handlungsbedarf und Einstufungen auf einer Skala; "kritisch" gibt es nur beim Handlungsbedarf
STUFE = {"gering": 0, "mittel": 1, "hoch": 2, "kritisch": 2}
MAIL_CHECKS = [("spf", "SPF"), ("dkim", "DKIM"), ("mx", "MX (Mailserver)"),
               ("mta_sts", "MTA-STS"), ("tls_rpt", "TLS-RPT")]


# ---------------------------------------------------------------- View-Model

def fill(text, ctx):
    """Ersetzt {schluessel} durch Werte aus ctx; unbekannte Platzhalter bleiben stehen."""
    if not isinstance(text, str):
        return text
    def sub(m):
        v = ctx.get(m.group(1))
        return m.group(0) if v is None else str(v)
    return re.sub(r"\{(\w+)\}", sub, text)


def zusammenhalten(value):
    """„E-Mail“ nie am Bindestrich umbrechen: In schmalen Spalten stand sonst „E-“ am
    Zeilenende. Gilt für jede Ausgabe der Vorlage, wie esc() in src/report/template.ts.
    Ein Steuerzeichen statt der Spanne würde die Textsuche im PDF stören."""
    if value is None:
        return value
    # Wiederholungsfest: Die Ausgabe eines Makros läuft noch einmal hier durch.
    # Ohne Anführungszeichen: läuft auch für Attributwerte, ein " beendete dort das Attribut.
    return Markup(re.sub(r"(?<!<span class=nw>)E-Mail", "<span class=nw>E-Mail</span>", str(escape(value))))


def nummern_zusammenhalten(value):
    """F-Nummern im Fließtext nicht umbrechen (K19), z. B. im Hinweis zur E-Mail-Note."""
    return Markup(re.sub(r"F-\d+", lambda m: f'<span class="nw">{m.group(0)}</span>', str(escape(value))))


def minus(value):
    """-50 -> '−50' (typografisches Minus)."""
    return str(value).replace("-", "−") if value is not None else ""


def datum_text(iso):
    y, m, d = (int(x) for x in iso.split("-"))
    return f"{d}. {MONATE[m - 1]} {y}"


def note_info(grade, kat):
    if not grade or grade in ("–", "-"):
        return {"note": "–", **kat["note_unbewertet"]}
    for n in kat["noten"]:
        if grade in n["noten"]:
            return {"note": grade, "klasse": n["klasse"], "wort": n["wort"], "bedeutung": n["bedeutung"]}
    raise ValueError(f"Unbekannte Note: {grade}")


def roh_feststellungen(sig, kat):
    """Leitet aus den Signalen die Katalog-Schlüssel ab. Liefert (schluessel, quelle, kontext)."""
    out = []
    d, mail = sig["dmarc"], sig["mail"]
    pol = d.get("policy")
    if pol is None:
        out.append(("dmarc_fehlt", "dmarc", {}))
    elif pol == "none":
        out.append(("dmarc_none", "dmarc", {}))
    elif pol == "quarantine":
        out.append(("dmarc_quarantine", "dmarc", {}))
    if pol is not None and not d.get("rua"):
        out.append(("dmarc_kein_rua", "dmarc", {}))

    spf = mail["spf"]
    if spf["status"] == "mangel":
        out.append(("spf_fehlt", "spf", spf))
    elif spf["status"] == "hinweis":
        out.append(("spf_hinweis", "spf", spf))
    dkim = mail["dkim"]
    if dkim["status"] != "ok":
        out.append(("dkim_hinweis" if dkim.get("selectors") else "dkim_nicht_gefunden", "dkim", dkim))
    if mail["mx"]["status"] != "ok":
        out.append(("mx_einzeln", "mx", mail["mx"]))
    if mail["mta_sts"]["status"] != "ok":
        out.append(("mta_sts_fehlt", "mta_sts", mail["mta_sts"]))
    if mail["tls_rpt"]["status"] != "ok":
        out.append(("tls_rpt_fehlt", "tls_rpt", mail["tls_rpt"]))

    if not sig["dnssec"]["signed"]:
        out.append(("dnssec_fehlt", "dnssec", {}))

    obs = sig["observatory"]
    if obs.get("available"):
        for t in obs["tests"]:
            ctx = {"label": kat["observatory_labels"].get(t["id"], t["id"]),
                   "modifier": minus(t.get("modifier")),
                   "result_text": t.get("result_text", ""),
                   "recommendation": t.get("recommendation", ""),
                   "_modifier": t.get("modifier") or 0}
            for key in (f"obs_{t['id']}_{t.get('variant', '')}", f"obs_{t['id']}", "obs_generic"):
                if key in kat["feststellungen"]:
                    out.append((key, "observatory", ctx))
                    break
    return out


def build_viewmodel(sig, kat, firma):
    domain = sig["domain"]
    datum = datum_text(sig["scan_date"])
    d, dn, obs, mail = sig["dmarc"], sig["dnssec"], sig["observatory"], sig["mail"]
    basis = {"domain": domain, "datum": datum, "record": d.get("record") or "kein Eintrag"}

    # Feststellungen
    findings = []
    for i, (key, quelle, ctx) in enumerate(roh_feststellungen(sig, kat)):
        entry = kat["feststellungen"][key]
        c = {**basis, **{k: v for k, v in ctx.items() if not k.startswith("_")}}
        f = {k: fill(v, c) for k, v in entry.items()}
        f.update({
            "key": key, "quelle": quelle,
            "prio_label": kat["prio_labels"][f["prio"]],
            "prio_rang": PRIO_RANG[f["prio"]],
            "bereich_label": kat["bereich_labels"][f["bereich"]],
            "modifier": ctx.get("_modifier"),
            "signal_text": ctx.get("result_text") or ctx.get("text") or "",
            "_order": i,
        })
        findings.append(f)
    findings.sort(key=lambda f: (f["prio_rang"], f["modifier"] or 0, f["_order"]))
    for n, f in enumerate(findings, 1):
        f["nr"] = f"F-{n:02d}"
        del f["_order"]

    # Maßnahmen
    order = kat["massnahmen_reihenfolge"]
    groups = {}
    for f in findings:
        groups.setdefault(f["massnahme"], []).append(f)
    keys = sorted(groups, key=lambda k: (min(f["prio_rang"] for f in groups[k]),
                                         order.index(k) if k in order else 99))
    measures = []
    for k in keys + ["M_RETEST"]:
        m = kat["massnahmen"][k]
        fs = groups.get(k, [])
        liste = ", ".join(dict.fromkeys(f["fach"] for f in fs))
        measures.append({
            "key": k, "titel": m["titel"], "text": fill(m["text"], {"liste": liste}),
            "aufwand": m["aufwand"], "bezug": [f["nr"] for f in fs],
            "bezug_text": ", ".join(f["nr"] for f in fs) if fs else "alle",
            "prio": fs[0]["prio"] if fs else None,
        })
    for n, m in enumerate(measures, 1):
        m["nr"] = f"M-{n}"
        for f in findings:
            if f["massnahme"] == m["key"]:
                f["massnahme_nr"] = m["nr"]

    # Bereiche (Noten-Kacheln)
    b = kat["bereiche"]
    pol = d.get("policy")
    areas = [
        {"key": "email", **{k: b["email"][k] for k in ("label", "pruefung", "schutzziel")},
         **note_info(d.get("grade"), kat), "score": d.get("score"),
         "satz": b["email"]["satz"][pol or "fehlt"],
         "detail": d.get("record") or "kein DMARC-Eintrag veröffentlicht"},
        {"key": "domain", **{k: b["domain"][k] for k in ("label", "pruefung", "schutzziel")},
         **note_info(dn.get("grade"), kat), "score": dn.get("score"),
         "satz": b["domain"]["satz"]["signiert" if dn["signed"] else "fehlt"],
         "detail": "Zone signiert" if dn["signed"] else "Zone nicht signiert"},
        {"key": "website", **{k: b["website"][k] for k in ("label", "pruefung", "schutzziel")},
         **note_info(obs.get("grade") if obs.get("available") else None, kat), "score": obs.get("score"),
         "satz": fill(b["website"]["satz"]["bewertet" if obs.get("available") else "nicht_verfuegbar"],
                      {"passed": obs.get("passed"), "total": obs.get("total")}),
         "detail": (f"{obs['passed']} von {obs['total']} Tests bestanden" if obs.get("available")
                    else "Test nicht verfügbar")},
    ]
    for a in areas:
        a["anzahl_feststellungen"] = sum(1 for f in findings if f["bereich"] == a["key"])

    # Positiv-Liste
    p = kat["positiv"]
    positives = []
    if pol == "reject":
        positives.append({"bereich": "email", "text": p["dmarc_reject"]})
    elif pol == "quarantine":
        positives.append({"bereich": "email", "text": p["dmarc_quarantine"]})
    if pol is not None and d.get("rua"):
        positives.append({"bereich": "email", "text": p["dmarc_rua"]})
    for key, _ in MAIL_CHECKS:
        if mail[key]["status"] == "ok":
            positives.append({"bereich": "email", "text": fill(p[f"{key}_ok"], mail[key])})
    if dn["signed"]:
        positives.append({"bereich": "domain", "text": p["dnssec_ok"]})
    einleitung = kat["positiv_einleitung"]["dmarc_durchgesetzt" if pol in ("reject", "quarantine")
                                           else "standard"]

    counts = {k: sum(1 for f in findings if f["prio"] == k) for k in PRIO_RANG}
    counts["gesamt"] = len(findings)

    # Technischer Anhang: alle Signale unverändert
    mail_checks = [{"key": k, "label": lbl, "status": mail[k]["status"],
                    "status_label": kat["status_labels"][mail[k]["status"]], "text": mail[k]["text"]}
                   for k, lbl in MAIL_CHECKS]
    obs_tests = [{"id": t["id"], "label": kat["observatory_labels"].get(t["id"], t["id"]),
                  "modifier": t.get("modifier"), "modifier_text": minus(t.get("modifier")),
                  "result_text": t.get("result_text", ""), "recommendation": t.get("recommendation", "")}
                 for t in obs.get("tests", [])]
    technik = {
        "dmarc": {"note": d.get("grade") or "–", "score": d.get("score"),
                  "record": d.get("record"), "policy": pol, "rua": d.get("rua")},
        "dnssec": {"note": dn.get("grade") or "–", "score": dn.get("score"), "signed": dn["signed"]},
        "observatory": {"available": bool(obs.get("available")), "note": obs.get("grade") or "–",
                        "score": obs.get("score"), "passed": obs.get("passed"), "total": obs.get("total"),
                        "tests": obs_tests},
        "mail": mail_checks,
    }
    def sc(v):
        return f"Score {v}" if v is not None else ""
    rohdaten = [
        f"{'DMARC':<9}{d.get('grade') or '–':<4}{sc(d.get('score')):<11}{d.get('record') or '— kein Eintrag veröffentlicht —'}",
        f"{'DNSSEC':<9}{dn.get('grade') or '–':<4}{sc(dn.get('score')):<11}{'Zone signiert' if dn['signed'] else 'Zone nicht signiert'}",
    ]
    if obs.get("available"):
        rohdaten.append(f"{'Website':<9}{obs.get('grade') or '–':<4}{sc(obs.get('score')):<11}"
                        f"HTTP Observatory: {obs['passed']}/{obs['total']} Tests bestanden")
        if obs_tests:
            rohdaten.append(" " * 24 + " · ".join(f"{t['label']} {t['modifier_text']}" for t in obs_tests))
    else:
        rohdaten.append(f"{'Website':<9}{'–':<4}{'':<11}HTTP Observatory: nicht verfügbar")
    for m in mail_checks:
        rohdaten.append(f"{m['label'].split(' ')[0]:<9}{m['status_label']:<15}{m['text']}")

    assets = ASSETS.as_uri()
    firma = json.loads(json.dumps(firma))
    for k in firma["kontakte"]:
        k["foto_url"] = f"{assets}/{k['foto']}" if k.get("foto") else None
    firma["vorstellung"]["foto_url"] = f"{assets}/{firma['vorstellung']['foto']}"

    # Der Handlungsbedarf kommt vom Scanner, die Einstufungen aus dem Katalog. Passen sie nicht
    # zusammen (z. B. "Hoch" ohne hoch eingestufte Feststellung), erklärt ein Satz die Abweichung.
    level = sig["level"]
    hoechste = max((STUFE[f["prio"]] for f in findings), default=0)
    richtung = ("hoeher" if STUFE[level] > hoechste else
                "niedriger" if STUFE[level] < hoechste else None)
    hinweis = kat["texte"].get("handlungsbedarf_hinweis", {}).get(richtung) if richtung else None
    return {
        "domain": domain,
        "datum": datum,
        "datum_iso": sig["scan_date"],
        "bericht_nr": f"RT-DS-{sig['scan_date'].replace('-', '')}-01",
        "level": {"key": level, "label": kat["level_labels"][level],
                  "satz": kat["texte"]["zusammenfassung"][level], "hinweis": hinweis},
        "bereiche": areas,
        "feststellungen": findings,
        "nach_prio": {k: [f for f in findings if f["prio"] == k] for k in PRIO_RANG},
        "anzahl": counts,
        "top": findings[:3],
        "positiv": positives,
        "positiv_einleitung": einleitung,
        "massnahmen": measures,
        "technik": technik,
        "rohdaten": rohdaten,
        "noten": kat["noten"],
        "texte": {k: fill(v, basis) if isinstance(v, str) else v for k, v in kat["texte"].items()},
        "firma": firma,
        "assets": assets,
        "logo": f"{assets}/logo.png",
        "qr_termin": f"{assets}/qr-termin.svg",
    }


# ---------------------------------------------------------------- Rendering

CHECK_JS = r"""
<script>
(function () {
  function positioned(el, stop) {
    for (var n = el; n && n !== stop; n = n.parentElement) {
      var p = getComputedStyle(n).position;
      if (p === 'absolute' || p === 'fixed') return true;
    }
    return false;
  }
  function name(el) {
    var c = (el.getAttribute('class') || '').trim().replace(/\s+/g, '.');
    return el.tagName.toLowerCase() + (c ? '.' + c : '');
  }
  var pages = Array.prototype.slice.call(document.querySelectorAll('.page'));
  var issues = [], sizes = [];
  pages.forEach(function (pg, i) {
    var r = pg.getBoundingClientRect(), cs = getComputedStyle(pg);
    if (Math.abs(r.height - 1122.52) > 2 || Math.abs(r.width - 793.7) > 2)
      sizes.push({seite: i + 1, breite_px: Math.round(r.width), hoehe_px: Math.round(r.height)});
    var bottom = r.bottom - parseFloat(cs.paddingBottom), right = r.right - parseFloat(cs.paddingRight);
    var worst = 0, who = '', worstX = 0, whoX = '';
    pg.querySelectorAll('*').forEach(function (el) {
      if (el.closest('[data-overflow-ok]')) return;
      var b = el.getBoundingClientRect();
      if (!b.width && !b.height) return;
      if (positioned(el, pg)) {
        if (b.bottom - r.bottom > worst) { worst = b.bottom - r.bottom; who = name(el) + ' (positioniert)'; }
        if (b.right - r.right > worstX) { worstX = b.right - r.right; whoX = name(el) + ' (positioniert)'; }
        return;
      }
      if (b.bottom - bottom > worst) { worst = b.bottom - bottom; who = name(el); }
      if (b.right - right > worstX) { worstX = b.right - right; whoX = name(el); }
    });
    if (worst > 0.5 || worstX > 0.5)
      issues.push({seite: i + 1, unten_px: Math.round(worst), element_unten: who,
                   rechts_px: Math.round(worstX), element_rechts: whoX});
  });
  document.documentElement.setAttribute('data-seiten', String(pages.length));
  document.documentElement.setAttribute('data-ueberlauf', JSON.stringify(issues));
  document.documentElement.setAttribute('data-formatfehler', JSON.stringify(sizes));
})();
</script>
"""


def chrome(args, timeout=120, versuche=2):
    """Startet Headless Chrome und gibt dessen Standardausgabe zurück.

    Die Ausgabe geht in eine Datei statt in eine Pipe: Unter macOS halten verwaiste
    crashpad-Prozesse die Pipe offen, der Aufruf hinge dann bis zum Timeout.
    """
    for versuch in range(versuche):
        tmp = tempfile.mkdtemp(prefix="rt-chrome-")
        try:
            cmd = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
                   "--no-default-browser-check", "--allow-file-access-from-files",
                   f"--user-data-dir={tmp}/profil", "--window-size=1240,1754", *args]
            ausgabe = Path(tmp) / "stdout.txt"
            with open(ausgabe, "w") as fh:
                subprocess.run(cmd, stdout=fh, stderr=subprocess.DEVNULL, timeout=timeout)
            return ausgabe.read_text(errors="replace")
        except subprocess.TimeoutExpired:
            if versuch == versuche - 1:
                raise
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


def attr(dom, name):
    m = re.search(rf'{name}="([^"]*)"', dom)
    if not m:
        return None
    return m.group(1).replace("&quot;", '"').replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")


def kontaktbogen(pngs, ziel, spalten=4, breite=300):
    from PIL import Image
    bilder = [Image.open(p).convert("RGB") for p in pngs]
    spalten = min(spalten, len(bilder))
    h = int(bilder[0].height * breite / bilder[0].width)
    zeilen = (len(bilder) + spalten - 1) // spalten
    gap = 14
    bogen = Image.new("RGB", (spalten * (breite + gap) + gap, zeilen * (h + gap) + gap), (150, 150, 150))
    for i, im in enumerate(bilder):
        x, y = gap + (i % spalten) * (breite + gap), gap + (i // spalten) * (h + gap)
        bogen.paste(im.resize((breite, h)), (x, y))
    bogen.save(ziel)


def render_dataset(variante, sig_path, kat, firma, env, dpi, ausgabe="out", nur_pruefen=False,
                   viewmodelle=None):
    """Rendert einen Datensatz. Mit --viewmodelle kommt das View-Model fertig aus
    der TypeScript-Umsetzung; die Python-Seite zeichnet dann nur noch die Vorlage.
    So gibt es genau eine Logik, aber zwei unabhängige Darstellungen zum Abgleich."""
    sig = json.loads(sig_path.read_text())
    slug = sig["domain"]
    if viewmodelle:
        vm_path = Path(viewmodelle) / f"{slug}.viewmodel.json"
        if not vm_path.exists():
            sys.exit(f"{vm_path} fehlt — zuerst die View-Modelle erzeugen")
        vm = json.loads(vm_path.read_text())
        vm = {kk: (str(ASSETS.as_uri()) if kk == "assets" else vv) for kk, vv in vm.items()}
        for kk in ("logo", "qr_termin"):
            if kk in vm:
                vm[kk] = vm[kk].replace("ASSETS_URL", ASSETS.as_uri())
        for kontakt in vm.get("firma", {}).get("kontakte", []):
            if kontakt.get("foto_url"):
                kontakt["foto_url"] = kontakt["foto_url"].replace("ASSETS_URL", ASSETS.as_uri())
        vorstellung = vm.get("firma", {}).get("vorstellung", {})
        if vorstellung.get("foto_url"):
            vorstellung["foto_url"] = vorstellung["foto_url"].replace("ASSETS_URL", ASSETS.as_uri())
    else:
        vm = build_viewmodel(sig, kat, firma)
    html = env.get_template("template.html.j2").render(**vm)

    check = html.replace("</body>", CHECK_JS + "</body>") if "</body>" in html else html + CHECK_JS
    with tempfile.TemporaryDirectory(prefix="rt-check-") as tmp:
        check_path = Path(tmp) / f"{slug}.check.html"
        check_path.write_text(check)
        dom = chrome(["--virtual-time-budget=3000", "--dump-dom", check_path.as_uri()])
    seiten_html = int(attr(dom, "data-seiten") or 0)
    ueberlauf = json.loads(attr(dom, "data-ueberlauf") or "[]")
    format_fehler = json.loads(attr(dom, "data-formatfehler") or "[]")

    fehler = []
    if seiten_html == 0:
        fehler.append("Keine Elemente mit class=\"page\" gefunden.")
    seiten = seiten_html
    bogen = None
    if not nur_pruefen:
        out = variante / ausgabe
        out.mkdir(exist_ok=True)
        (out / f"{slug}.viewmodel.json").write_text(json.dumps(vm, ensure_ascii=False, indent=2))
        html_path = out / f"{slug}.html"
        html_path.write_text(html)

        pdf = out / f"{slug}.pdf"
        chrome(["--no-pdf-header-footer", f"--print-to-pdf={pdf}", html_path.as_uri()])
        info = subprocess.run(["pdfinfo", str(pdf)], capture_output=True, text=True).stdout
        seiten = int(re.search(r"Pages:\s+(\d+)", info).group(1))

        for alt in out.glob(f"{slug}-seite-*.png"):
            alt.unlink()
        subprocess.run(["pdftoppm", "-r", str(dpi), "-png", str(pdf), str(out / f"{slug}-seite")], check=True)
        pngs = sorted(out.glob(f"{slug}-seite-*.png"), key=lambda p: int(re.search(r"-(\d+)\.png$", p.name).group(1)))
        bogen = out / f"{slug}-uebersicht.png"
        kontaktbogen(pngs, bogen)

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
    return slug, seiten, fehler, bogen


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("variante", type=Path)
    ap.add_argument("--nur", help="nur Datensätze, deren Dateiname diesen Text enthält")
    ap.add_argument("--dpi", type=int, default=70)
    ap.add_argument("--katalog", type=Path, default=DATEN / "katalog.json",
                    help="alternativer Inhaltskatalog (Standard: generator/daten/katalog.json)")
    ap.add_argument("--ausgabe", default="out", help="Name des Ausgabeordners im Variantenordner")
    ap.add_argument("--signale", type=Path, default=SIGNALE,
                    help="Ordner mit Signal-Datensätzen (Standard: tests/fixtures/referenz/signale)")
    ap.add_argument("--viewmodelle", type=Path,
                    help="Ordner mit fertigen <domain>.viewmodel.json aus der TypeScript-Umsetzung; "
                         "dann wird das View-Model nicht selbst berechnet")
    ap.add_argument("--nur-pruefen", action="store_true",
                    help="nur die Überlaufprüfung, ohne HTML, PDF und Bilder im Ausgabeordner")
    a = ap.parse_args()

    variante = a.variante.resolve()
    if not (variante / "template.html.j2").exists():
        sys.exit(f"{variante}/template.html.j2 fehlt")
    kat = json.loads(a.katalog.read_text())
    firma = json.loads((DATEN / "firma.json").read_text())
    env = Environment(loader=FileSystemLoader([str(variante), str(GEN)]),
                      autoescape=select_autoescape(["html", "j2"]),
                      undefined=StrictUndefined, trim_blocks=True, lstrip_blocks=True,
                      finalize=zusammenhalten)
    env.filters["minus"] = minus
    env.filters["nummern_zusammenhalten"] = nummern_zusammenhalten

    gesamt_fehler = 0
    for sig_path in sorted(a.signale.glob("*.json")):
        if a.nur and a.nur not in sig_path.name:
            continue
        slug, seiten, fehler, bogen = render_dataset(variante, sig_path, kat, firma, env, a.dpi, a.ausgabe,
                                                     a.nur_pruefen, a.viewmodelle)
        status = "OK" if not fehler else f"{len(fehler)} FEHLER"
        print(f"[{status}] {slug}: {seiten} Seiten" + (f" -> {bogen}" if bogen else " (nur geprüft)"))
        for f in fehler:
            print(f"    - {f}")
        gesamt_fehler += len(fehler)
    sys.exit(1 if gesamt_fehler else 0)


if __name__ == "__main__":
    main()
