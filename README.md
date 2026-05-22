# sharp.reineke.tech

Kostenfreies E-Mail-Authentifizierungs-Analyse-Tool von **Reineke Technik**. Prüft
**DMARC**, **DKIM**, **SPF** und **MX-Records** einer beliebigen Domain — vergleichbar
mit MXToolbox, aber als schlanker Cloudflare Worker mit deutscher UI, Reineke-
Technik-Branding und Empfehlungen.

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
├── styles.css            # Reineke-Technik-Branding (Rot #dc0d23 / Schwarz / Weiß)
├── app.js                # Fetch /api/analyze + Rendering
└── assets/
    ├── reineke-logo.png  # Reineke Cyber Security Logo
    ├── sharp-logo.png    # Sharp Partner-Logo
    └── favicon.svg
tests/
├── dmarc.test.ts
├── spf.test.ts
├── dkim.test.ts
└── dns.test.ts
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
    "summary": "DMARC vorhanden, Verbesserungspotenzial (p=quarantine).",
    "issues": [{ "severity": "warn", "code": "DMARC_POLICY_QUARANTINE", "message": "...", "recommendation": "..." }],
    "data": { "raw": "v=DMARC1; p=quarantine; rua=mailto:...", "p": "quarantine", ... }
  },
  "spf":  { ... },
  "dkim": { ... },
  "mx":   { ... }
}
```

`status` ist einer von `pass | warn | fail | info`.

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
