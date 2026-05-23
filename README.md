# sharp.reineke.tech

Kostenfreies E-Mail- und Domain-Sicherheits-Analyse-Tool von **Reineke Technik**.
Prüft **DMARC**, **DKIM**, **SPF**, **MX**, **MTA-STS**, **TLS-RPT**, **DNSSEC** und
die Website-Security-Header via **MDN HTTP Observatory** — vergleichbar mit
MXToolbox, aber als schlanker Cloudflare Worker mit deutscher UI,
Reineke-Technik-Branding und konkreten Empfehlungen.

DMARC steht im Fokus, da Google und Microsoft seit Februar 2024 für Bulk-Sender
DMARC-Compliance voraussetzen.

**Live:** https://sharp.reineke.tech · https://mail.reineke.tech (Alt-Hostname)

## Stack

- **Cloudflare Worker** (TypeScript, [Hono](https://hono.dev/))
- **DNS-Abfragen** via Cloudflare DNS-over-HTTPS (`1.1.1.1`) — keine Drittanbieter
- **Static Assets** über `[assets]` Binding (kein extra Pages-Projekt nötig)
- Keine Build-Pipeline für das Frontend (Vanilla HTML/CSS/JS)

## Lokale Entwicklung

```bash
npm install
npm run dev        # Wrangler-Server auf http://localhost:8787
npm test           # vitest — 28 Unit-Tests
npm run typecheck  # tsc --noEmit
```

## Deployment

```bash
# Vorschau (Worker auf <name>.<account>.workers.dev)
npm run deploy

# Produktion mit Custom Domains sharp.reineke.tech & mail.reineke.tech
npm run deploy:prod
```

### Custom Domain einrichten

In `wrangler.toml` sind die Routen bereits konfiguriert:

```toml
[env.production]
routes = [
  { pattern = "sharp.reineke.tech", custom_domain = true },
  { pattern = "mail.reineke.tech",  custom_domain = true }
]
```

**Voraussetzung:** Die Zone `reineke.tech` muss im Cloudflare-Account aktiv sein.
Beim Deploy legt Wrangler die Custom-Domain-Zuordnung automatisch an (kein
manuelles CNAME nötig). Falls bereits ein konkurrierender DNS-Eintrag für den
Hostnamen existiert, muss dieser zuerst entfernt werden.

## Architektur

```
src/
├── index.ts              # Hono app, /api/analyze, /api/observatory, static fallback
├── dns.ts                # DoH-Client (Cloudflare 1.1.1.1)
├── types.ts              # Shared types
├── observatory.ts        # MDN HTTP Observatory v2 API client (Website-Header)
└── analyzers/
    ├── dmarc.ts          # _dmarc.<domain> → Parser + Validator
    ├── spf.ts            # v=spf1 → Parser + rekursive Lookup-Zählung
    ├── dkim.ts           # Selektor-Probing (~40 gängige Selektoren)
    ├── mx.ts             # MX + A/AAAA Auflösung
    ├── mta-sts.ts        # _mta-sts TXT + Policy-Fetch (.well-known)
    ├── tls-rpt.ts        # _smtp._tls TXT (RFC 8460)
    └── dnssec.ts         # DNSKEY + AD-Flag aus DoH-Response
public/
├── index.html            # 3-Tab SPA (E-Mail / Website / DNSSEC)
├── styles.css            # Reineke-Technik-Branding (Rot #dc0d23 / Schwarz / Weiß)
├── app.js                # Tab-Routing, geteilter Domain-State, Per-Tab-Cache, Rendering
└── assets/
    ├── reineke-logo.png  # Reineke Cyber Security Logo
    ├── sharp-logo.png    # Sharp Partner-Logo
    └── favicon.svg
tests/
├── dmarc.test.ts
├── spf.test.ts
├── dkim.test.ts
├── dns.test.ts
├── mta-sts.test.ts
├── tls-rpt.test.ts
├── dnssec.test.ts
└── observatory.test.ts
```

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
      "scannedAt": "...", "detailsUrl": "https://developer.mozilla.org/en-US/observatory/analyze?host=..."
    }
  }
}
```

Proxyt auf `POST https://observatory-api.mdn.mozilla.net/api/v2/scan?host=<host>`
(20 s Timeout). Note → Severity: A→pass, B/C→warn, D/E/F→fail.

### `GET /api/health`

Liefert `{ ok: true, service: "mail.reineke.tech" }` zurück.

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

`.api-keys` enthält lokale Cloudflare-Tokens und ist via `.gitignore`
ausgeschlossen — niemals committen.

## Lizenz

MIT. Siehe [LICENSE](LICENSE).
