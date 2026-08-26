# sharp.reineke.tech

Kostenfreies E-Mail- und Domain-Sicherheits-Analyse-Tool von **Reineke Technik**.
Prüft **DMARC**, **DKIM**, **SPF**, **MX**, **MTA-STS**, **TLS-RPT**, **DNSSEC** und
die Website-Security-Header via **MDN HTTP Observatory** — vergleichbar mit
MXToolbox, aber als schlanker Cloudflare Worker mit deutscher UI,
Reineke-Technik-Branding und konkreten Empfehlungen.

**Noten:** DMARC, DNSSEC und das HTTP Observatory erhalten jeweils eine Schulnote
(A+…F) auf einer gemeinsamen Skala ([src/grading.ts](src/grading.ts)). Die
Observatory-Ergebnisse werden ins Deutsche übersetzt ([src/observatory-i18n.ts](src/observatory-i18n.ts),
englischer Fallback) und gegen die globale MDN-Notenverteilung gebenchmarkt.

DMARC steht im Fokus, da Google und Microsoft seit Februar 2024 für Bulk-Sender
DMARC-Compliance voraussetzen.

**Live:** https://scan.reineke.tech · https://sharp.reineke.tech

## Stack

- **Cloudflare Worker** (TypeScript, [Hono](https://hono.dev/))
- **DNS-Abfragen** via Cloudflare DNS-over-HTTPS (`1.1.1.1`) — keine Drittanbieter
- **Static Assets** über `[assets]` Binding (kein extra Pages-Projekt nötig)
- **PDF-Export** via Cloudflare Browser Rendering (`@cloudflare/puppeteer`)
- Keine Build-Pipeline für das Frontend (Vanilla HTML/CSS/JS)

## Lokale Entwicklung

```bash
npm install
npm run dev        # Wrangler-Server auf http://localhost:8787
npm test           # vitest — 81 Unit-Tests
npm run typecheck  # tsc --noEmit
```

## Deployment

```bash
# Vorschau (Worker auf <name>.<account>.workers.dev)
npm run deploy

# Produktion mit Custom Domains scan/sharp.reineke.tech
npm run deploy:prod
```

### Custom Domain einrichten

In `wrangler.toml` sind die Routen bereits konfiguriert:

```toml
[env.production]
routes = [
  { pattern = "scan.reineke.tech",  custom_domain = true },
  { pattern = "sharp.reineke.tech", custom_domain = true },
]
```

**Voraussetzung:** Die Zone `reineke.tech` muss im Cloudflare-Account aktiv sein.
Beim Deploy legt Wrangler die Custom-Domain-Zuordnung automatisch an (kein
manuelles CNAME nötig). Falls bereits ein konkurrierender DNS-Eintrag für den
Hostnamen existiert, muss dieser zuerst entfernt werden.

### Lead-Erfassung (Odoo CRM)

Leads entstehen an zwei Stellen: der **Pentest-Anfrage** (`POST /api/pentest-lead`)
und der **Berichtsanfrage** (`POST /api/report-request`). Sie werden per
Odoo-JSON-RPC als `crm.lead` mit
`type=opportunity` angelegt — sie erscheinen damit direkt in der **CRM-Pipeline**
(ohne dass die separate „Leads"-Funktion aktiviert sein muss). Die analysierte
Domain wird im **Website-Feld** des Datensatzes gespeichert; Marker „Empfohlen
von / Referred By" = `sharp.reineke.tech`.

**1. API-Key in Odoo erzeugen:** in Odoo unter _Einstellungen → Benutzer →
(dein API-Benutzer) → Konto-Sicherheit → Neuer API-Schlüssel_. Der Benutzer
braucht Schreibrechte auf das CRM (`crm.lead`).

**2. Worker-Secrets setzen** (nie committen — `.dev.vars` lokal ist gitignored):

Es gibt **zwei Deployments** (ein Repo, zwei Worker): `--env sharp`
(`mail-reineke-tech`, sharp.reineke.tech) und `--env reineke`
(`scan-reineke-tech`, scan.reineke.tech). Secrets je
Umgebung setzen:

```bash
wrangler secret put ODOO_URL      --env reineke   # z.B. https://firma.odoo.com
wrangler secret put ODOO_DB       --env reineke   # Datenbankname
wrangler secret put ODOO_USERNAME --env reineke   # Login-E-Mail des API-Benutzers
wrangler secret put ODOO_API_KEY  --env reineke   # der erzeugte API-Schlüssel
# dito --env sharp für den Partner-Kanal (plus REPORT_PASSWORD je Umgebung)
```

**Benachrichtigung:** Zu jedem Lead wird (best-effort) eine **To-Do-Aktivität**
„Neuer Lead aus dem Sicherheits-Tool" angelegt und dem API-Benutzer zugewiesen —
sichtbar über die **Aktivitäten-Glocke** und unter **Meine Aktivitäten** in Odoo.

**Robustheit:** E-Mail + Einwilligung werden serverseitig erzwungen (sonst `400`).
Ist Odoo nicht konfiguriert oder schlägt der Push fehl, wird der Lead in den
Worker-Logs (`wrangler tail`) protokolliert und der Nutzer **trotzdem** zum
Bericht durchgelassen — kein Lead geht verloren, keine Sackgasse für den Nutzer.

> Analytics: **Umami** (cookieloses Page-Tracking), je Marke konfigurierbar
> über `Brand.analytics`. Marken mit eigener Analytics-Konfiguration laden
> **erst nach aktiver Einwilligung** (Opt-in); die Wahl wird in `localStorage`
> gemerkt. Leadfeeder/Dealfront wurde am 03.08.2026 vollständig entfernt.

### Gescannte Domains in Odoo

Jeder Scan wird (best-effort, via `waitUntil`) in ein **eigenes Odoo-Modell**
`x_reineke_scanned_domain` („Gescannte Domains") protokolliert — eine Zeile pro
Domain mit `x_scan_count`; Odoos `create_date`/`write_date` dienen als
erstmals/zuletzt gesehen. Sichtbar in Odoo über den Menüpunkt **„Gescannte
Domains"**. Nutzt dieselben `ODOO_*`-Secrets wie die Lead-Erfassung; das Modell
wurde einmalig per API angelegt (inkl. Zugriffsregel für interne Benutzer). Ist
Odoo nicht erreichbar, bleibt der Scan unberührt (kein Blockieren).

## Architektur

```
src/
├── index.ts              # Hono app, API-Endpoints, static fallback
├── dns.ts                # DoH-Client (Cloudflare 1.1.1.1)
├── types.ts              # Shared types
├── grading.ts            # scoreToGrade (A+…F) + gradeToSeverity (gemeinsame Skala)
├── observatory.ts        # MDN HTTP Observatory v2 client + Benchmark
├── observatory-i18n.ts   # Deutsche Übersetzungen (Titel + Result-Codes)
├── leads/
│   └── odoo.ts           # Odoo CRM: crm.lead + Scan-Domain-Log (JSON-RPC)
├── pdf/
│   └── render.ts         # Report-HTML → PDF (Cloudflare Browser Rendering)
└── analyzers/
    ├── dmarc.ts          # _dmarc.<domain> → Parser + Note + Spoofing-Hinweis
    ├── spf.ts            # v=spf1 → Parser + rekursive Lookup-Zählung
    ├── dkim.ts           # Selektor-Probing (~16 gängige Selektoren)
    ├── mx.ts             # MX + A/AAAA Auflösung
    ├── mta-sts.ts        # _mta-sts TXT + Policy-Fetch (.well-known)
    ├── tls-rpt.ts        # _smtp._tls TXT (RFC 8460)
    └── dnssec.ts         # DNSKEY + DS + AD-Flag → Note
public/
├── index.html            # 3-Tab SPA (E-Mail / Website / DNSSEC) + Cookie-Banner
├── styles.css            # Reineke-Technik-Branding (Rot #dc0d23 / Schwarz / Weiß)
├── app.js                # Tab-Routing, Domain-State, Cache, Report + Lead-Gate, Consent + Leadfeeder
└── assets/
    ├── reineke-logo.png  # Reineke Cyber Security Logo
    └── favicon.png       # Reineke-Fuchs (aus reineke-logo.png zugeschnitten)
tests/                    # 81 vitest-Tests (dmarc, spf, dkim, dns, mta-sts,
                          # tls-rpt, dnssec, observatory, grading, odoo-lead)
```

## Noten-Konzept

| Check | A+ | … | F |
|---|---|---|---|
| **DMARC** | `p=reject` **oder** `p=quarantine` + rua + pct=100 | `none`→D+ | kein/ungültiges DMARC (+ Spoofing-Hinweis) |
| **DNSSEC** | signiert & validiert | — *(binär, keine Zwischenstufen)* | kein DNSSEC / nicht verankert / kaputte Kette |
| **Observatory** | MDN-Note (A+…F) übernommen | — | — |

Alle nutzen `scoreToGrade` in [src/grading.ts](src/grading.ts). **DNSSEC ist
binär** — eine Zone hat entweder eine gültige, validierte Vertrauenskette (A+)
oder nicht (F); die verschiedenen Fehlerzustände unterscheiden sich nur in der
Begründung, nicht in der Note. Bei unzureichendem DMARC (`none`/fehlend) weist
das Tool explizit auf mögliches **E-Mail-Identitätsdiebstahl (Spoofing)** hin.

## Oberfläche

Die UI ist in drei logisch getrennte Werkzeuge gegliedert (Tabs, je eigene URL):

| Tab | Pfad | Checks | Endpoint |
|---|---|---|---|
| **E-Mail** (Start) | `/` | DMARC, SPF, DKIM, MX, MTA-STS, TLS-RPT | `/api/email` |
| **Website** | `/website` | HTTP Observatory (Schulnote) | `/api/observatory` |
| **DNSSEC** | `/dnssec` | DNSSEC-Vertrauenskette | `/api/dnssec` |

Die Domain wird beim Tab-Wechsel übernommen und (sofern noch nicht im Session-Cache)
automatisch neu gescannt. Shareable Links: `/dnssec?d=<domain>`, `/website?d=<domain>`,
`/?d=<domain>&s=<selektoren>`.

### Bericht als PDF — zwei streng getrennte Wege

**1. Interner Generator (`/report`, passwortgeschützt).** Vertriebswerkzeug:
Anmeldung per `POST /api/report-auth` (signiertes HttpOnly-Cookie), danach
`POST /api/generate-report` mit frei wählbarer Domain und wählbarer
Vertriebsmitarbeiter-Karte (`GET /api/report-reps`). Das PDF kommt **synchron als
Download** zurück. Erzeugt bewusst keinen `crm.lead`.

**2. Selbstbedienung (`/bericht`, öffentlich).** Besucher fordern den Bericht zu
einer geprüften Domain an; das PDF verlässt diesen Weg **ausschließlich per
E-Mail** an die eingetragene Adresse. Abgesichert durch Turnstile, drei Zähler
(IP / Empfängeradresse / Adresse+Domain) und eine CRM-Spur.

Die Trennung ist Absicht und muss erhalten bleiben — siehe „Trennungsregeln"
unten. Es gibt **immer** den Gesamtbericht; einen Einzelbefund-Export kennt der
Server nicht.

#### Trennungsregeln

1. Der Selbstbedienungsweg ruft `isReportAuthed` **nie** auf; er verhält sich mit
   und ohne gültiges Report-Cookie identisch.
2. Keine Vertriebsmitarbeiter-Auswahl: `reportBrandFor()` streicht `partner` und
   `reps`, damit ein Fremder nie bestimmt, welche Person auf dem Dokument steht.
3. Das PDF steht nie in der Antwort von `/api/report-request`.
4. Turnstile ist Pflicht: Fehlt `TURNSTILE_SECRET`, obwohl ein Sitekey gesetzt
   ist, **lehnt** der Endpunkt ab (der Pentest-Pfad lässt hier durch).
5. Getrennte Zähler je Strecke.


Briefkopf: **Reineke Technik GmbH · Werner Francis Reineke · Geseker Straße 26,
33154 Salzkotten · Tel. +49 (0) 5258 987-282 · wf.reineke@reineke-technik.de**
(in [public/app.js](public/app.js) als `REPORT_CONTACT` gepflegt).

## API

### `GET /api/email?domain=<fqdn>&selectors=<csv>`

E-Mail-Checks: `dmarc`, `spf`, `dkim`, `mx`, `mtaSts`, `tlsRpt`.

### `GET /api/dnssec?domain=<fqdn>`

DNSSEC-Vertrauenskette. Fragt `DNSKEY` und `DS` ab und wertet das `AD`-Flag von
1.1.1.1 aus:

```jsonc
{
  "domain": "dnssec-failed.org",
  "queriedAt": "...",
  "dnssec": {
    "status": "fail",
    "summary": "DNSSEC fehlerhaft",
    "data": { "secure": false, "authenticated": false, "dnskeyCount": 0, "dsPresent": true, "validationFailed": true }
  }
}
```

Logik: `AD=true` → secure (**pass**); DS beim Parent vorhanden, aber Validierung
schlägt fehl / SERVFAIL → **fail** (gebrochene Kette); DNSKEY ohne DS → **warn**
(nicht verankert); nichts → **warn** (kein DNSSEC).

### `GET /api/analyze?domain=<fqdn>&selectors=<csv>`

All-in-one (für API-Consumer): kombinierte Auswertung aller DNS-basierten Checks
(`dmarc`, `spf`, `dkim`, `mx`, `mtaSts`, `tlsRpt`, `dnssec`):

```jsonc
{
  "domain": "reineke-technik.de",
  "queriedAt": "2026-05-22T12:34:56.000Z",
  "dmarc": {
    "status": "warn",
    "summary": "DMARC vorhanden, Verbesserungspotenzial (p=quarantine).",
    "issues": [{ "severity": "warn", "code": "DMARC_POLICY_QUARANTINE", "message": "...", "recommendation": "..." }],
    "data": { "raw": "v=DMARC1; p=quarantine; rua=mailto:...", "p": "quarantine", ... }
  },
  "spf":    { ... },
  "dkim":   { ... },
  "mx":     { ... },
  "mtaSts": { "status": "warn", "summary": "Kein MTA-STS", "data": { "dnsTxt": null, "policyFetched": false } },
  "tlsRpt": { "status": "warn", "summary": "Kein TLS-RPT",  "data": { "raw": null, "rua": [] } },
  "dnssec": { "status": "pass", "summary": "DNSSEC aktiv",  "data": { "secure": true, "authenticated": true, "dnskeyCount": 2, "dsPresent": true, "validationFailed": false } }
}
```

`status` ist einer von `pass | warn | fail | info`.

### `GET /api/observatory?domain=<fqdn>`

Separater Endpoint für den **MDN HTTP Observatory** Website-Scan. Wird vom
Frontend unabhängig aufgerufen, weil ein frischer Scan ~10 s dauert — so
blockiert er die schnellen DNS-Checks oben nicht (Progressive Loading).

```jsonc
{
  "domain": "reineke-technik.de",
  "queriedAt": "2026-05-23T06:00:00.000Z",
  "observatory": {
    "status": "warn",
    "summary": "Note B (Score 75)",
    "issues": [ ... ],
    "data": {
      "grade": "B", "score": 75,
      "testsPassed": 8, "testsFailed": 2, "testsQuantity": 10,
      "scannedAt": "...", "detailsUrl": "https://developer.mozilla.org/en-US/observatory/analyze?host=...",
      "tests": [
        { "name": "content-security-policy", "title": "Content Security Policy (CSP)",
          "pass": false, "scoreModifier": -25, "reason": "…", "recommendation": "…",
          "link": "https://developer.mozilla.org/en-US/docs/…" },
        { "name": "x-frame-options", "title": "X-Frame-Options", "pass": true, "scoreModifier": 5, ... }
      ]
    }
  }
}
```

Proxyt auf `GET https://observatory-api.mdn.mozilla.net/api/v2/analyze?host=<host>`
(20 s Timeout) — dieser Endpoint liefert (anders als `/scan`) auch die
**Per-Test-Details**. HTML in den MDN-Beschreibungen wird zu Klartext gestrippt
und ins Deutsche übersetzt, Tests worst-first sortiert.

### `GET /api/grade-distribution`

Globale Observatory-Notenverteilung für die Benchmark-Darstellung (Cache 1 Tag):

```jsonc
{ "distribution": [ { "grade": "A+", "count": 59156 }, … , { "grade": "F", "count": 954615 } ] }
```

### `POST /api/report-request`

Berichtsanfrage der öffentlichen Strecke `/bericht`. Body: `{ "domain": "…",
"name": "…", "email": "…", "company": "…", "phone": "…", "contactConsent": bool,
"cf-turnstile-response": "…" }`. `domain` ist die **geprüfte** Domain und kann von
der Domain der E-Mail-Adresse abweichen (IT-Dienstleister prüfen Kundendomains) —
der Bericht gilt der geprüften Domain, der CRM-Vorgang wird auf die
E-Mail-Domain gekeyt. `contactConsent` ist die **freiwillige** Werbeeinwilligung;
sie blockiert die Anfrage nicht und wird mit Zeitstempel, IP und Textfassung im
Vorgang protokolliert. Antwort: `{ ok, code, message, leadId? }` — **nie das PDF**.
Prüflogik: `src/leads/report-request.ts` (rein, unter Node testbar).

### `GET /api/health`

Liefert `{ ok: true, service: "<toolUrl der aktiven Marke>" }` zurück.

## Branding

Die Farbpalette und Typografie sind aus der Live-CSS von
[reineke-technik.de](https://www.reineke-technik.de) abgeleitet:

| Token | Wert | Verwendung |
|---|---|---|
| `--rt-red` | `#dc0d23` | Primärfarbe, CTAs, Akzente |
| `--rt-red-dark` | `#8a060e` | Hover, Fehler |
| `--rt-black` | `#000000` | Text |
| `--rt-gray` | `#5a5a5a` | Sekundärtext |
| `--rt-border` | `#e6e7e6` | Trennlinien |
| Font | `Frutiger`, fallback humanist sans | überall |

Logos (Reineke-Fuchs, Sharp) liegen als PNG in [public/assets/](public/assets/).

## Workflow

- `main` ist die deploybare Branch.
- **Alle Änderungen via Pull Request** (Feature-Branches → PR → Review → Merge).
- Deploy ist aktuell manuell via `npm run deploy:prod`. Optional kann eine
  GitHub-Actions-Pipeline auf Merge automatisch deployen (Cloudflare-Token als
  Repo-Secret).

## Sicherheit

`.api-keys` (Cloudflare-Tokens) und `.dev.vars` (lokale Odoo-Config) sind via
`.gitignore` ausgeschlossen — niemals committen. Produktiv liegen die
Odoo-Zugangsdaten als verschlüsselte **Worker-Secrets** (`wrangler secret`).

**Security-Header:** Eine Middleware in [src/index.ts](src/index.ts) setzt auf
**jeder** Antwort (inkl. der statischen Assets via `run_worker_first`) eine
strikte **CSP** (script-src ohne `'unsafe-inline'`, erlaubt nur die eigene Origin
+ die consent-gesteuerten Analytics), **HSTS** (2 Jahre, includeSubDomains,
preload), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy`, COOP/CORP und `Permissions-Policy`. Das härtet das Tool selbst
und sorgt für eine gute eigene HTTP-Observatory-Note.

## Lizenz

MIT. Siehe [LICENSE](LICENSE).
