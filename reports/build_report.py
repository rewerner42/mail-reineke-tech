#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Baut den gebrandeten Sicherheits-Analyse-Bericht (Management-Summary + 4 Domain-
Berichte) als self-contained HTML. Liest die echten Scan-Ergebnisse aus
/tmp/scans/*.json (sharp.reineke.tech) und bettet beide Logos als base64 ein.
Anschließend: HTML -> PDF via headless Chrome.
"""
import base64, json, os, html

SCAN_DIR = "/tmp/scans"
ASSET_DIR = "/Users/werner/dmarc/public/assets"
OUT_HTML = "/Users/werner/dmarc/reports/Sharp-Sicherheitsbericht-CDU.html"

REPORT_DATE = "3. Juni 2026"   # fester Stand (kein Date.now im Build)

# ---------------------------------------------------------------------------
# Kontaktdaten — Platzhalter in eckigen Klammern werden von Werner ersetzt.
# ---------------------------------------------------------------------------
CONTACT_WERNER = {
    "name": "Werner Reineke",
    "role": "Geschäftsführer",
    "org":  "Reineke Technik GmbH",
    "mail": "wf.reineke@reineke-technik.de",
    "tel":  "+49 172 2872390",
    "mobile": None,
    "addr": "Geseker Straße 26, 33154 Salzkotten",
    "web":  "www.reineke-technik.de",
}
CONTACT_THEO = {
    "name": "Theo Müller",
    "role": "Verkaufsleiter Direktvertrieb",
    "org":  "Sharp Business Systems Deutschland GmbH",
    "mail": "Theo.Mueller@sharp.eu",
    "tel":  "+49 30 263 44 838",
    "mobile": "+49 173 778 19 17",
    "addr": "Fritschestraße 27/28, 10585 Berlin",
    "web":  "www.sharp.de",
}

# ---------------------------------------------------------------------------
# Helfer
# ---------------------------------------------------------------------------
def load(name):
    with open(os.path.join(SCAN_DIR, name), encoding="utf-8") as f:
        return json.load(f)

def b64_data_uri(path):
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")

def grade_class(grade):
    if not grade:
        return "g-na"
    g = grade.strip()[0].upper()
    return {"A": "g-a", "B": "g-b", "C": "g-c", "D": "g-d", "E": "g-f", "F": "g-f"}.get(g, "g-na")

def esc(s):
    return html.escape(str(s)) if s is not None else ""

# Reineke-Logo: offizielle Vektor-Version (Fuchs + REINEKE) von reineke-technik.de
LOGO_REINEKE = "data:image/svg+xml;base64," + base64.b64encode(
    open("/Users/werner/dmarc/reports/brand/reineke-official.svg", "rb").read()
).decode("ascii")
LOGO_SHARP   = b64_data_uri(os.path.join(ASSET_DIR, "sharp-logo.png"))

# ---------------------------------------------------------------------------
# Scan-Daten laden (echte Ergebnisse vom 30.05.2026)
# ---------------------------------------------------------------------------
A = {  # /api/analyze  (DMARC, DNSSEC, SPF, DKIM, MX, MTA-STS, TLS-RPT)
    "berlin.de":     load("analyze-berlin.de.json"),
    "cdu.berlin":    load("analyze-cdu.berlin.json"),
    "kai-wegner.de": load("analyze-kai-wegner.de.json"),
    "kgw-berlin.de": load("analyze-kgw-berlin.de.json"),
}
O = {  # /api/observatory  (Website-Security-Header)
    "berlin.de":     load("obs-www.berlin.de.json"),
    "cdu.berlin":    load("obs-cdu.berlin.json"),
    "kai-wegner.de": load("obs-www.kai-wegner.de.json"),
    "kgw-berlin.de": load("obs-kgw-berlin.de.json"),
}

# cemex.de (Stand 03.06.2026) zusätzlich laden
A["cemex.de"] = load("analyze-cemex.de.json")
O["cemex.de"] = load("obs-www.cemex.de.json")

# Roter Backslash-Akzent (Design-Anlehnung an reineke-technik.de)
BS = '<span class="bs">\\</span>'

def dmarc(d):   return A[d]["dmarc"]
def dnssec(d):  return A[d]["dnssec"]
def obs(d):     return O[d]["observatory"]
def obsdata(d): return (obs(d).get("data") or {})

# ---------------------------------------------------------------------------
# Hand-verfasste deutsche Narrative je Domain
# ---------------------------------------------------------------------------
DOMAINS = [
    {
        "key": "kgw-berlin.de", "host_web": "kgw-berlin.de",
        "org": "Katharina Günther-Wünsch (CDU)",
        "subtitle": "Senatorin für Bildung, Jugend und Familie · Wahlkreis Mahlsdorf/Kaulsdorf",
        "prio": "Kritisch",
        "verdict": "Vollständig ungeschützt: kein DMARC-Eintrag, kein DNSSEC, schwächste Website-Note der vier Domains. Höchster Handlungsbedarf.",
        "angle": "Als Domain einer amtierenden Senatorin ist kgw-berlin.de das verwundbarste Ziel im Vergleich. Ohne jeden DMARC-Eintrag kann praktisch jeder täuschend echte E-Mails „von Frau Günther-Wünsch“ an Schulen, Eltern, Verwaltung oder Presse versenden — empfangende Server haben keinerlei Handhabe, diese abzuweisen. Das fehlende HSTS lässt zudem unverschlüsselte Verbindungen zur Website zu. Hier lässt sich mit überschaubarem Aufwand der größte Sicherheits- und Reputationsgewinn erzielen.",
    },
    {
        "key": "kai-wegner.de", "host_web": "www.kai-wegner.de",
        "org": "Kai Wegner (CDU)",
        "subtitle": "Regierender Bürgermeister von Berlin · persönliche Domain (betrieben vom CDU-Landesverband)",
        "prio": "Hoch",
        "verdict": "DMARC nur im Monitoring-Modus (p=none) und ohne Report-Adresse, kein DNSSEC, Website-Header lückenhaft. Prominentestes Ziel — dringender Handlungsbedarf.",
        "angle": "Dies ist die persönliche Domain des Regierenden Bürgermeisters — ein erstrangiges Ziel für Identitätsmissbrauch. Gefälschte E-Mails „von Kai Wegner“ an Medien, Behörden oder Bürgerinnen und Bürger werden derzeit nicht blockiert. Da keine Report-Adresse (rua) hinterlegt ist, bleibt jeder Missbrauch zudem unsichtbar. Gerade bei einer derart exponierten Person ist der Schutz vor Spoofing auch eine Frage der politischen Glaubwürdigkeit.",
    },
    {
        "key": "cdu.berlin", "host_web": "cdu.berlin",
        "org": "CDU Landesverband Berlin",
        "subtitle": "Offizielle Domain der Partei",
        "prio": "Hoch",
        "verdict": "DMARC nur im Monitoring-Modus (p=none) und ohne Report-Adresse, kein DNSSEC, drei wichtige Website-Header fehlen.",
        "angle": "Über die Partei-Domain laufen Kommunikation mit Mitgliedern, Presse und Unterstützern. Ohne durchgesetzte DMARC-Richtlinie sind gefälschte Rundmails, Falschmeldungen oder Spendenaufrufe „im Namen der CDU Berlin“ möglich. Ohne Report-Adresse erfährt die Partei nicht einmal, dass und von wo in ihrem Namen versendet wird. Der fehlende Clickjacking-Schutz (X-Frame-Options) erlaubt es zudem, die Website in fremde Seiten einzubetten.",
    },
    {
        "key": "berlin.de", "host_web": "www.berlin.de",
        "org": "Land Berlin",
        "subtitle": "Offizielles Stadtportal der Hauptstadt (Senat unter Reg. Bürgermeister Kai Wegner)",
        "prio": "Mittel",
        "verdict": "Website vorbildlich (B+), aber DMARC ohne Durchsetzung (p=none) und kein DNSSEC. Solides Fundament mit klarer Lücke bei E-Mail- und DNS-Sicherheit.",
        "angle": "Das offizielle Portal der Hauptstadt hat mit Note B+ bereits eine sehr gute Website-Absicherung — das zeigt, dass die Basis stimmt. Umso auffälliger ist die Lücke bei der E-Mail-Authentifizierung: Im Namen von berlin.de versendete Phishing-Mails an Bürgerinnen und Bürger werden mangels Durchsetzung (p=none) nicht abgewiesen. Eine Domain mit dieser Sichtbarkeit und Vorbildfunktion sollte DMARC auf p=reject führen und DNSSEC aktivieren.",
    },
]

# cemex.de — eigener Prospect (Baustoffe), kein CDU-Kontext
CEMEX = {
    "key": "cemex.de", "host_web": "www.cemex.de",
    "org": "CEMEX Deutschland",
    "subtitle": "Baustoffhersteller · Zement, Transportbeton & Gesteinskörnungen",
    "prio": "Mittel",
    "verdict": "Solide Ausgangslage: DMARC wird bereits durchgesetzt (p=quarantine mit striktem Alignment) und die Website erreicht Note B. Offen bleiben die DMARC-Berichterstattung (rua-Reports), fehlendes DNSSEC und drei Website-Header.",
    "angle": "Für einen Baustoffhersteller mit hohem Bestell- und Rechnungsvolumen ist E-Mail-Authentifizierung vor allem ein Schutz gegen Rechnungs- und Chef-Betrug (Business E-Mail Compromise): gefälschte Mails „von CEMEX“ an Kunden, Lieferanten oder die eigene Buchhaltung. Den entscheidenden Schritt ist CEMEX mit p=quarantine bereits gegangen — verdächtige Mails werden bereits isoliert. Es fehlt jedoch die Sichtbarkeit über eine Report-Adresse (rua), um Missbrauch und fehlerhafte Versanddienste überhaupt zu erkennen, sowie DNSSEC als Absicherung der DNS-Ebene. Mit diesen ergänzenden Schritten erreicht die Domain durchgängig Spitzenwerte.",
}

# Kurzbeschreibung der drei Hauptprüfungen (für die Methodik / Erklärboxen)
EXPLAIN = {
    "dmarc": "DMARC legt fest, wie Empfänger mit gefälschten Absendern Ihrer Domain umgehen. Erst die Stufe „p=reject“ weist Spoofing-Mails wirklich ab. „p=none“ ist reines Monitoring ohne Schutz.",
    "dnssec": "DNSSEC signiert Ihre DNS-Antworten kryptografisch und schützt so vor DNS-Spoofing und Cache-Poisoning — also davor, dass Nutzer unbemerkt auf gefälschte Server umgeleitet werden.",
    "observatory": "Der MDN HTTP Observatory bewertet die Sicherheits-Header Ihrer Website (CSP, HSTS, X-Frame-Options u. a.) — Schutz gegen Cross-Site-Scripting, Clickjacking und unverschlüsselte Verbindungen.",
}

# ---------------------------------------------------------------------------
# HTML-Bausteine
# ---------------------------------------------------------------------------
def badge(label, grade, score=None):
    sc = f'<span class="badge-score">Score {score}</span>' if score is not None else ""
    g = esc(grade) if grade else "–"
    return f'''<div class="badge {grade_class(grade)}">
      <div class="badge-label">{esc(label)}</div>
      <div class="badge-grade">{g}</div>
      {sc}
    </div>'''

def issue_list(issues, only=("fail","warn")):
    rows = []
    for i in issues:
        if i.get("severity") not in only:
            continue
        rec = f'<div class="rec">→ {esc(i["recommendation"])}</div>' if i.get("recommendation") else ""
        rows.append(f'''<li class="sev-{esc(i.get("severity"))}">
            <span class="sev-dot"></span>
            <div><div class="msg">{esc(i.get("message"))}</div>{rec}</div></li>''')
    return f'<ul class="issues">{"".join(rows)}</ul>' if rows else ""

SEV_LABEL = {"pass": "OK", "warn": "Hinweis", "fail": "Mangel", "info": "Info"}

def mini_row(label, c):
    st = c.get("status", "info")
    return f'''<tr>
      <td class="mr-label">{esc(label)}</td>
      <td><span class="pill p-{esc(st)}">{SEV_LABEL.get(st, st)}</span></td>
      <td class="mr-sum">{esc(c.get("summary"))}</td>
    </tr>'''

def obs_fail_list(d):
    tests = obsdata(d).get("tests", []) or []
    fails = [t for t in tests if t.get("pass") is False]
    if not fails:
        return '<p class="ok-note">Alle geprüften Sicherheits-Header sind gesetzt.</p>'
    items = []
    for t in fails:
        items.append(f'''<li class="sev-fail"><span class="sev-dot"></span>
            <div><div class="msg"><strong>{esc(t.get("title"))}</strong> ({t.get("scoreModifier")}): {esc(t.get("reason"))}</div>
            {f'<div class="rec">→ {esc(t.get("recommendation"))}</div>' if t.get("recommendation") else ""}</div></li>''')
    return f'<ul class="issues">{"".join(items)}</ul>'

# ---------------------------------------------------------------------------
# Seiten rendern
# ---------------------------------------------------------------------------
GRADE_TABLE = [(100,"A+"),(90,"A"),(85,"A-"),(80,"B+"),(70,"B"),(65,"B-"),
               (60,"C+"),(50,"C"),(45,"C-"),(40,"D+"),(30,"D"),(20,"D-")]
def score_to_grade(s):
    for thr, g in GRADE_TABLE:
        if s >= thr:
            return g
    return "F"

def dmarc_display(dm, domain):
    """Wendet das aktualisierte DMARC-Grading lokal an (quarantine == reject == 100),
    damit der Report stimmt, auch bevor die Live-API neu deployt ist. Verändert nur
    durchsetzende Policies; none/missing bleiben unverändert."""
    data = dm.get("data") or {}
    p = data.get("p")
    if p not in ("quarantine", "reject"):
        return (dm.get("grade") or "F"), dm.get("score"), dm.get("issues", [])
    rua = data.get("rua"); sp = data.get("sp"); pct = data.get("pct")
    score = 100
    if isinstance(pct, (int, float)) and 0 <= pct < 100:
        score -= round((100 - pct) * 0.3)
    if not rua:
        score -= 10
    if sp == "none":
        score -= 10
    score = max(0, min(100, score))
    issues = []
    if p == "quarantine":
        issues.append({"severity": "pass", "code": "DMARC_POLICY_QUARANTINE",
            "message": "Policy „quarantine“ — nicht authentifizierte Mails werden isoliert (Spam). Voller Schutz im Sinne der Google-/Microsoft-Bulk-Sender-Anforderungen."})
    else:
        issues.append({"severity": "pass", "code": "DMARC_POLICY_REJECT",
            "message": "Strikteste Policy „reject“ — nicht authentifizierte Mails werden abgewiesen."})
    if not rua:
        issues.append({"severity": "warn", "code": "DMARC_NO_RUA",
            "message": "Kein „rua“-Tag — es werden keine aggregierten DMARC-Reports empfangen. Damit bleibt unsichtbar, wer in Ihrem Namen sendet und ob legitime Versanddienste am Alignment scheitern.",
            "recommendation": f"rua=mailto:dmarc@{domain} ergänzen — schafft Sichtbarkeit und hebt die Note auf A+."})
    if sp == "none":
        issues.append({"severity": "warn", "code": "DMARC_SP_NONE",
            "message": "Subdomain-Policy „sp=none“ — Subdomains sind von der Durchsetzung ausgenommen.",
            "recommendation": "sp=quarantine bzw. sp=reject setzen, damit auch Subdomains geschützt sind."})
    if data.get("adkim") == "s" or data.get("aspf") == "s":
        issues.append({"severity": "info", "code": "DMARC_ALIGN_STRICT",
            "message": "Striktes Alignment aktiv (adkim=s/aspf=s) — erhöht die Fälschungssicherheit zusätzlich."})
    return score_to_grade(score), score, issues

def render_summary_table():
    rows = []
    order = ["kgw-berlin.de", "kai-wegner.de", "cdu.berlin", "berlin.de"]
    orgmap = {x["key"]: x for x in DOMAINS}
    for k in order:
        dm, ds, ob = dmarc(k), dnssec(k), obs(k)
        obd = obsdata(k)
        rows.append(f'''<tr>
          <td class="d-org"><strong>{esc(orgmap[k]["org"])}</strong><br><span class="d-host">{esc(k)}</span></td>
          <td class="ctr"><span class="g {grade_class(dm.get("grade"))}">{esc(dm.get("grade") or "F")}</span></td>
          <td class="ctr"><span class="g {grade_class(ds.get("grade"))}">{esc(ds.get("grade") or "F")}</span></td>
          <td class="ctr"><span class="g {grade_class(obd.get("grade"))}">{esc(obd.get("grade") or "–")}</span></td>
          <td class="ctr prio prio-{orgmap[k]["prio"].lower().replace('ä','ae')}">{esc(orgmap[k]["prio"])}</td>
        </tr>''')
    return f'''<table class="summary-table">
      <thead><tr>
        <th>Organisation / Domain</th><th class="ctr">DMARC<br><span>E-Mail-Spoofing</span></th>
        <th class="ctr">DNSSEC<br><span>DNS-Schutz</span></th><th class="ctr">Website<br><span>Observatory</span></th>
        <th class="ctr">Handlungs-<br>bedarf</th>
      </tr></thead>
      <tbody>{"".join(rows)}</tbody>
    </table>'''

def render_domain(dn):
    k = dn["key"]
    dm, ds, ob = dmarc(k), dnssec(k), obs(k)
    obd = obsdata(k)
    dm_grade, dm_score, dm_issues = dmarc_display(dm, k)
    dmraw = (dm.get("data") or {}).get("raw")
    record_box = (f'<div class="record"><span class="record-k">Aktueller DMARC-Eintrag</span>'
                  f'<code>{esc(dmraw)}</code></div>' if dmraw
                  else '<div class="record record-missing"><span class="record-k">DMARC-Eintrag</span>'
                       '<code>— kein Eintrag veröffentlicht —</code></div>')

    # Supporting e-mail checks (SPF/DKIM/MX/MTA-STS/TLS-RPT)
    mini = "".join([
        mini_row("SPF", A[k]["spf"]), mini_row("DKIM", A[k]["dkim"]),
        mini_row("MX (Mailserver)", A[k]["mx"]), mini_row("MTA-STS", A[k]["mtaSts"]),
        mini_row("TLS-RPT", A[k]["tlsRpt"]),
    ])

    return f'''<section class="page domain-page">
      <div class="page-head">
        <img class="ph-logo" src="{LOGO_SHARP}" alt="sharp">
        <span class="ph-sep">·</span><span class="ph-title">{BS}Domain-Bericht</span>
        <span class="ph-prio prio-{dn["prio"].lower().replace('ä','ae')}">Handlungsbedarf: {esc(dn["prio"])}</span>
      </div>

      <h2 class="domain-h">{esc(dn["org"])}</h2>
      <div class="domain-sub">{esc(dn["subtitle"])}</div>
      <div class="domain-host">{esc(k)} &nbsp;·&nbsp; Website: {esc(dn["host_web"])}</div>

      <div class="verdict"><strong>Befund:</strong> {esc(dn["verdict"])}</div>

      <div class="badges">
        {badge("DMARC", dm_grade, dm_score)}
        {badge("DNSSEC", ds.get("grade") or "F", ds.get("score"))}
        {badge("Website (Observatory)", obd.get("grade"), obd.get("score"))}
      </div>

      <div class="check">
        <h3>1 · DMARC — Schutz vor E-Mail-Identitätsdiebstahl</h3>
        {record_box}
        {issue_list(dm_issues)}
      </div>

      <div class="check">
        <h3>2 · DNSSEC — Schutz der DNS-Antworten</h3>
        <p class="check-sum">{esc(ds.get("summary"))}</p>
        {issue_list(ds.get("issues", []))}
      </div>

      <div class="check">
        <h3>3 · Website-Sicherheit — HTTP Observatory ({esc(obd.get("grade") or "–")}, {obd.get("testsPassed")}/{obd.get("testsQuantity")} bestanden)</h3>
        {obs_fail_list(k)}
      </div>

      <div class="check supporting">
        <h3>Ergänzende E-Mail-Prüfungen</h3>
        <table class="mini">{mini}</table>
      </div>

      <div class="angle"><div class="angle-k">Was das für {esc(dn["org"])} bedeutet</div>{esc(dn["angle"])}</div>

      <div class="page-foot">Geprüft mit sharp.reineke.tech · Stand {REPORT_DATE} · Reineke Technik · Vertraulich</div>
    </section>'''

# ---------------------------------------------------------------------------
# Dokument zusammensetzen
# ---------------------------------------------------------------------------
def cc_line(label, val):
    return f'<div class="cc-line"><span>{label}</span> {esc(val)}</div>' if val else ""

def contact_card(c):
    tel = esc(c["tel"]) + (f' &middot; Mobil {esc(c["mobile"])}' if c.get("mobile") else "")
    return f'''<div class="contact-card">
      <div class="cc-name">{esc(c["name"])}</div>
      <div class="cc-role">{esc(c["role"])}</div>
      <div class="cc-org">{esc(c["org"])}</div>
      <div class="cc-line"><span>E-Mail</span> {esc(c["mail"])}</div>
      <div class="cc-line"><span>Telefon</span> {tel}</div>
      {cc_line("Adresse", c.get("addr"))}
      {cc_line("Web", c.get("web"))}
    </div>'''

# Dateinamen-Slug + Cover-Lead-Fragment je Einzeldokument
SINGLE_META = {
    "cdu.berlin":    ("CDU-Landesverband-Berlin",     "der offiziellen Domain des CDU-Landesverbands Berlin"),
    "kai-wegner.de": ("Kai-Wegner",                   "der persönlichen Domain des Regierenden Bürgermeisters Kai Wegner"),
    "kgw-berlin.de": ("Katharina-Guenther-Wuensch",   "der Domain von Senatorin Katharina Günther-Wünsch"),
    "berlin.de":     ("Land-Berlin",                  "des offiziellen Stadtportals der Hauptstadt Berlin"),
    "cemex.de":      ("CEMEX-Deutschland",            "der Domain von CEMEX Deutschland"),
}

CSS = open("/Users/werner/dmarc/reports/report.css").read()

def doc(title, body):
    return (f'<!doctype html>\n<html lang="de"><head><meta charset="utf-8">\n'
            f'<title>{esc(title)}</title>\n<style>{CSS}</style>\n</head>\n<body>\n{body}\n</body></html>')

def head(title):
    return (f'<div class="page-head"><img class="ph-logo" src="{LOGO_SHARP}" alt="sharp">'
            f'<span class="ph-sep">·</span><span class="ph-title">{BS}{title}</span></div>')

FOOT = f'<div class="page-foot">Geprüft mit sharp.reineke.tech · Stand {REPORT_DATE} · Reineke Technik GmbH · Vertraulich</div>'

def cover_page(kicker, h1, lead, domains_html):
    return f'''<section class="page cover">
  <div class="cover-top"><img class="cover-sharp" src="{LOGO_SHARP}" alt="sharp.reineke.tech"></div>
  <div class="cover-mid">
    <div class="cover-kicker">{BS}{kicker}</div>
    <h1>{h1}</h1>
    <p class="cover-lead">{lead}</p>
    {domains_html}
  </div>
  <div class="cover-bottom">
    <div class="cover-by">
      <div class="cb-label">Durchgeführt &amp; erstellt von</div>
      <div class="cb-org">Reineke Technik GmbH</div>
      <div class="cb-partner">Geseker Straße 26 · 33154 Salzkotten · www.reineke-technik.de</div>
      <div class="cb-date">{REPORT_DATE}</div>
    </div>
    <img class="cover-fox" src="{LOGO_REINEKE}" alt="Reineke Technik">
  </div>
  <div class="cover-conf">Vertraulich — nur für den internen Gebrauch der Adressaten bestimmt.</div>
</section>'''

COMBINED_DOMAINS_UL = '''<ul class="cover-domains">
      <li><strong>cdu.berlin</strong> — CDU Landesverband Berlin</li>
      <li><strong>kai-wegner.de</strong> — Kai Wegner, Regierender Bürgermeister</li>
      <li><strong>kgw-berlin.de</strong> — Katharina Günther-Wünsch, Senatorin für Bildung</li>
      <li><strong>berlin.de</strong> — Offizielles Stadtportal der Hauptstadt</li>
    </ul>'''

def single_domain_block(dn):
    return (f'<ul class="cover-domains"><li><strong>{esc(dn["key"])}</strong> — {esc(dn["org"])}<br>'
            f'<span class="cd-sub">{esc(dn["subtitle"])}</span></li></ul>')

OFFER_BLOCK = '''<div class="offer">
    <h3>Unser Angebot — Reineke Technik &amp; Sharp Business Systems Deutschland</h3>
    <p>Gemeinsam bringen wir Ihre Domains kontrolliert und nachvollziehbar auf ein durchgesetztes
      Schutzniveau — die technische Umsetzung durch Reineke Technik, persönliche Betreuung über den
      Direktvertrieb von Sharp Business Systems, durchgängig DSGVO-konform und deutschsprachig:</p>
    <ol>
      <li><strong>DMARC-Einführung &amp; -Härtung:</strong> begleiteter Rollout von
        <code>p=none</code> über <code>p=quarantine</code> bis <code>p=reject</code>, inkl.
        SPF-/DKIM-Alignment und Auswertung der Aggregat-Reports.</li>
      <li><strong>DNSSEC-Aktivierung:</strong> Signierung der Zonen und Hinterlegung des
        DS-Eintrags beim Registrar.</li>
      <li><strong>Website-Härtung:</strong> CSP, HSTS, X-Frame-Options, X-Content-Type-Options
        und SRI sauber gesetzt.</li>
      <li><strong>Laufendes Monitoring:</strong> kontinuierliche Überwachung und verständliche
        Berichte — jederzeit kostenfrei nachprüfbar unter sharp.reineke.tech.</li>
    </ol>
  </div>'''

def contacts_block():
    return (f'<h3 class="contact-h">Ihre Ansprechpartner</h3>\n  <div class="contacts">'
            f'{contact_card(CONTACT_WERNER)}{contact_card(CONTACT_THEO)}</div>')

def method_page():
    return f'''<section class="page method">
  {head("Methodik &amp; Hinweise")}
  <h2 class="sum-h">Methodik &amp; Hinweise</h2>
  <h3>Was wurde geprüft?</h3>
  <div class="method-grid">
    <div><h4>DMARC</h4><p>{EXPLAIN["dmarc"]}</p></div>
    <div><h4>DNSSEC</h4><p>{EXPLAIN["dnssec"]}</p></div>
    <div><h4>Website (HTTP Observatory)</h4><p>{EXPLAIN["observatory"]}</p></div>
  </div>
  <h3>Wie wurde gemessen?</h3>
  <p>Alle Werte wurden am {REPORT_DATE} mit dem frei zugänglichen Analyse-Tool
    <strong>sharp.reineke.tech</strong> von Reineke Technik erhoben. DNS-Abfragen erfolgen über
    Cloudflare DNS-over-HTTPS (1.1.1.1); die Website-Bewertung nutzt den
    <em>MDN HTTP Observatory</em> von Mozilla. Die Noten (A+…F) liegen auf einer gemeinsamen
    Skala. Es wurden ausschließlich öffentlich abrufbare DNS- und HTTP-Informationen
    ausgewertet — keine Eingriffe, keine Anmeldungen, keine Last für die Zielsysteme.</p>
  <p class="method-note">Die Ergebnisse sind eine Momentaufnahme und können sich nach
    Konfigurationsänderungen ändern. Eine erneute Prüfung ist jederzeit kostenfrei möglich.</p>
  <div class="brandfoot">
    <img class="bf-fox" src="{LOGO_REINEKE}" alt="Reineke Technik">
    <div class="bf-body">
      <div class="bf-org">Reineke Technik GmbH</div>
      <div class="bf-tag">Analyse durchgeführt &amp; erstellt · E-Mail- &amp; Domain-Sicherheit · sharp.reineke.tech<br>in Zusammenarbeit mit Sharp Business Systems Deutschland GmbH</div>
      <div class="bf-contact">{esc(CONTACT_WERNER["name"])} (Reineke Technik) · {esc(CONTACT_WERNER["mail"])}<br>
        {esc(CONTACT_THEO["name"])} (Sharp Business Systems) · {esc(CONTACT_THEO["mail"])} · {esc(CONTACT_THEO["tel"])}</div>
    </div>
    <img class="bf-sharp" src="{LOGO_SHARP}" alt="Sharp">
  </div>
</section>'''

def summary_page():
    return f'''<section class="page summary">
  {head("Management-Summary")}
  <h2 class="sum-h">Management-Summary</h2>
  <p class="sum-intro">Seit Februar 2024 verlangen Google und Microsoft von Versendern eine
    gültige <strong>DMARC</strong>-Konfiguration. Unabhängig davon ist die Absender-Authentifizierung
    der wirksamste Schutz davor, dass Dritte unter Ihrem Namen E-Mails versenden
    (<em>Spoofing</em>) — ein Risiko, das bei öffentlich exponierten Parteien und Mandatsträgern
    besonders schwer wiegt. Wir haben vier zentrale Domains aus dem Umfeld der Berliner CDU mit unserem Tool
    <strong>sharp.reineke.tech</strong> geprüft: jeweils <strong>DMARC</strong>,
    <strong>DNSSEC</strong> und die <strong>Website-Sicherheit</strong> (MDN HTTP Observatory).</p>
  {render_summary_table()}
  <div class="findings">
    <h3>Kernbefunde</h3>
    <ul>
      <li><strong>Alle vier Domains setzen DMARC nicht durch.</strong> Drei stehen auf
        <code>p=none</code> (reines Monitoring, kein Schutz), eine (kgw-berlin.de) hat
        <strong>gar keinen DMARC-Eintrag</strong>. Spoofing im Namen aller vier Domains ist
        damit aktuell möglich.</li>
      <li><strong>Keine einzige Domain nutzt DNSSEC.</strong> Alle vier Zonen sind unsigniert
        (Note F) und damit anfällig für DNS-Spoofing und Cache-Poisoning.</li>
      <li><strong>Die Website-Sicherheit reicht von B+ bis D.</strong> Das Stadtportal berlin.de
        ist mit B+ vorbildlich; cdu.berlin (C), kai-wegner.de (C−) und insbesondere
        kgw-berlin.de (D) weisen fehlende Schutz-Header auf.</li>
      <li><strong>Zwei Domains (cdu.berlin, kai-wegner.de) führen keine Report-Adresse</strong>
        (<code>rua</code>) — Missbrauch bliebe selbst dann unsichtbar, wenn er stattfindet.</li>
    </ul>
  </div>
  {OFFER_BLOCK}
  {contacts_block()}
  {FOOT}
</section>'''

def angebot_page(dn):
    return f'''<section class="page summary">
  {head("Empfehlung &amp; Ansprechpartner")}
  <h2 class="sum-h">Empfehlung für {esc(dn["org"])}</h2>
  <p class="sum-intro">Die auf der vorigen Seite dokumentierten Lücken bei
    <strong>{esc(dn["key"])}</strong> lassen sich kontrolliert und ohne Betriebsunterbrechung
    schließen. So gehen wir gemeinsam vor:</p>
  {OFFER_BLOCK}
  {contacts_block()}
  {FOOT}
</section>'''

def build_combined():
    body = (cover_page("Sicherheits-Analyse · E-Mail &amp; Domain",
                       "DMARC · DNSSEC · Website-Sicherheit",
                       "Unabhängige Prüfung der digitalen Absender- und Domain-Sicherheit von vier "
                       "zentralen Domains rund um die Berliner CDU, ihre Spitzenpolitiker und das "
                       "offizielle Stadtportal.",
                       COMBINED_DOMAINS_UL)
            + summary_page()
            + "".join(render_domain(d) for d in DOMAINS)
            + method_page())
    return doc("Sicherheits-Analyse · CDU Berlin & Kai Wegner · Reineke Technik", body)

def build_single(dn):
    lead_frag = SINGLE_META[dn["key"]][1]
    cover_h1 = esc(dn["org"].split(" (")[0])   # ohne (CDU)-Zusatz auf dem Deckblatt
    body = (cover_page("Sicherheits-Analyse · E-Mail &amp; Domain",
                       cover_h1,
                       f"Unabhängige Prüfung der E-Mail- und Domain-Sicherheit {lead_frag} — "
                       f"DMARC, DNSSEC und Website-Sicherheit.",
                       single_domain_block(dn))
            + render_domain(dn)
            + angebot_page(dn)
            + method_page())
    return doc(f"Sicherheits-Analyse · {dn['org']} · Reineke Technik", body)

# --- alle Dokumente schreiben: 1 Gesamtbericht + 1 je Scan ---
OUTDIR = "/Users/werner/dmarc/reports"
outputs = []

def write(path, html):
    with open(path, "w", encoding="utf-8") as f:
        f.write(html)
    outputs.append(path)
    print("wrote", path, f"({len(html)} bytes)")

# Aktueller Auftrag: Einzelreport für cemex.de. Die CDU-Reports bleiben unverändert
# (anderes Datum/Branding bereits ausgeliefert) — bei Bedarf separat neu bauen.
import sys
targets = sys.argv[1:] or ["cemex"]
if "cdu" in targets or "all" in targets:
    write(f"{OUTDIR}/Sharp-Sicherheitsbericht-Gesamtbericht.html", build_combined())
    for d in DOMAINS:
        write(f"{OUTDIR}/Sharp-Befund-{SINGLE_META[d['key']][0]}.html", build_single(d))
if "cemex" in targets or "all" in targets:
    write(f"{OUTDIR}/Sharp-Befund-{SINGLE_META[CEMEX['key']][0]}.html", build_single(CEMEX))
