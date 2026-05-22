# mail.reineke.tech

Kostenfreies E-Mail-Authentifizierungs-Analyse-Tool von **Reineke Technik**. Prüft
**DMARC**, **DKIM**, **SPF** und **MX-Records** einer beliebigen Domain — vergleichbar
mit MXToolbox, aber als schlanker Cloudflare Worker mit deutscher UI und Empfehlungen.

DMARC steht im Fokus, da Google und Microsoft seit Februar 2024 für Bulk-Sender
DMARC-Compliance voraussetzen.

## Stack

- **Cloudflare Worker** (TypeScript, [Hono](https://hono.dev/))
- **DNS-Abfragen** via Cloudflare DNS-over-HTTPS (`1.1.1.1`) — keine Drittanbieter
- **Static Assets** über `[assets]` Binding (kein extra Pages-Projekt nötig)
- Keine Build-Pipeline für das Frontend (Vanilla HTML/CSS/JS)

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Wrangler startet einen lokalen Server auf `http://localhost:8787`.

## Deployment

```bash
# Vorschau (Worker auf <name>.<account>.workers.dev)
npm run deploy

# Produktion mit Custom Domain mail.reineke.tech
npm run deploy:prod
```

### Custom Domain einrichten

In `wrangler.toml` ist die Route bereits konfiguriert:

```toml
[env.production]
routes = [
  { pattern = "mail.reineke.tech", custom_domain = true }
]
```

**Voraussetzung:** Die Zone `reineke.tech` muss in deinem Cloudflare-Account aktiv sein.
Beim ersten `deploy --env production` legt Wrangler die Custom-Domain-Zuordnung
automatisch an (kein manuelles CNAME nötig).

## Architektur

```
src/
├── index.ts              # Hono app, /api/analyze, static fallback
├── dns.ts                # DoH-Client (Cloudflare 1.1.1.1)
├── types.ts              # Shared types
└── analyzers/
    ├── dmarc.ts          # _dmarc.<domain> → Parser + Validator
    ├── spf.ts            # v=spf1 → Parser + rekursive Lookup-Zählung
    ├── dkim.ts           # Selektor-Probing (~40 gängige Selektoren)
    └── mx.ts             # MX + A/AAAA Auflösung
public/
├── index.html            # Single-page UI
├── styles.css            # Reineke-Technik-Branding (#003876 / #e30613)
├── app.js                # Fetch /api/analyze + Rendering
└── assets/               # Logos & Favicon (SVG-Platzhalter, bitte austauschen)
```

## API

### `GET /api/analyze?domain=<fqdn>&selectors=<csv>`

Liefert eine kombinierte Auswertung aller vier Checks zurück:

```jsonc
{
  "domain": "reineke-technik.de",
  "queriedAt": "2026-05-22T12:34:56.000Z",
  "dmarc": {
    "status": "warn",
    "summary": "DMARC vorhanden, Verbesserungspotenzial (p=none).",
    "issues": [{ "severity": "warn", "code": "DMARC_POLICY_NONE", "message": "...", "recommendation": "..." }],
    "data": { "raw": "v=DMARC1; p=none; rua=mailto:...", "p": "none", "rua": ["mailto:..."], ... }
  },
  "spf":  { ... },
  "dkim": { ... },
  "mx":   { ... }
}
```

`status` ist einer von `pass | warn | fail | info`.

### `GET /api/health`

Liefert `{ ok: true }` zurück.

## Logos austauschen

Die SVGs unter [public/assets/](public/assets/) sind Platzhalter mit der Reineke-
Brandfarbe. Für das finale Branding einfach die Dateien ersetzen:

- `reineke-logo.svg` — Hauptlogo im Header (Höhe ~40px)
- `sharp-logo.svg` — Sharp-Partnerbadge (Höhe ~18px)
- `favicon.svg` — Browser-Favicon

Falls die offiziellen Logos als PNG/JPG vorliegen, einfach die Endung in
[index.html](public/index.html) anpassen.

## Workflow

- `main` ist die deploybare Branch.
- **Alle Änderungen via Pull Request** (Feature-Branches → PR → Review → Merge).
- Cloudflare deployt Production automatisch beim Merge auf `main`, wenn der
  [GitHub-Integration](https://developers.cloudflare.com/workers/ci-cd/builds/)
  Trigger konfiguriert ist (optional).

## Lizenz

Interne Nutzung Reineke Technik. Quellcode public auf GitHub für Transparenz.
