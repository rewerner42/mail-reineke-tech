// Lead capture → Odoo CRM via the JSON-RPC external API.
//
// Flow: authenticate (common.login) → object.execute_kw("crm.lead","create").
// Config comes from Worker secrets (never committed); see README.

export interface OdooConfig {
  url: string; // e.g. https://reineke.odoo.com (no trailing slash)
  db: string;
  username: string; // login email of the API user
  apiKey: string; // Odoo API key (Preferences → Account Security)
}

export interface LeadInput {
  email: string;
  domain?: string;
  consent: boolean;
  /** Einstiegskanal (Kanalmarker je Einstieg; Marken-Trennung läuft über `referred`). */
  channel?: "freier-check" | "pentest-scoping";
  /** Ausgefülltes Scoping-Formular von /pentest (nur channel "pentest-scoping"). */
  scoping?: ScopingInput;
}

/** Felder des /pentest-Scoping-Formulars — qualifizieren den Lead strukturiert. */
export interface ScopingInput {
  company: string;
  contactName: string;
  role?: string;
  phone?: string;
  testart?: string;
  umfang?: string;
  anlass?: string;
  frist?: string;
  freitext?: string;
}

// ─── Technik-Ampel ────────────────────────────────────────────────────────────
// Technischer Vorfilter für die Bearbeitungsreihenfolge — KEIN Vertriebs-Score.
export type Ampel = "rot" | "gelb" | "grün";

export interface AmpelInput {
  dmarcPolicy: string | null; // "none" | "quarantine" | "reject" | null (fehlt)
  dnssecGrade: string | null; // Note des DNSSEC-Checks (A+ = signiert + verankert)
  obsGrade: string | null; // HTTP-Observatory-Note (A+…F) oder null
}

export function ampelFor(i: AmpelInput): Ampel {
  const enforcing = i.dmarcPolicy === "quarantine" || i.dmarcPolicy === "reject";
  if (!enforcing || i.obsGrade === "F") return "rot";
  const dnssecOk = (i.dnssecGrade ?? "").startsWith("A");
  const obsOk = /^[AB]/.test(i.obsGrade ?? "");
  if (enforcing && dnssecOk && obsOk) return "grün";
  return "gelb";
}

export type LeadCode =
  | "OK"
  | "INVALID_EMAIL"
  | "NO_CONSENT"
  | "NOT_CONFIGURED"
  | "ODOO_AUTH_FAILED"
  | "ODOO_ERROR";

export interface LeadResult {
  ok: boolean;
  code: LeadCode;
  message: string;
  leadId?: number;
}

// Pragmatic e-mail check: one @, a dot in the domain, no spaces. We deliberately
// avoid the pathological "full RFC 5322" regex.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: unknown): email is string {
  return typeof email === "string" && email.length <= 254 && EMAIL_REGEX.test(email.trim());
}

/** Read Odoo config from the Worker env; returns null if any piece is missing. */
export function odooConfigFromEnv(env: {
  ODOO_URL?: string;
  ODOO_DB?: string;
  ODOO_USERNAME?: string;
  ODOO_API_KEY?: string;
}): OdooConfig | null {
  const url = env.ODOO_URL?.trim().replace(/\/+$/, "");
  const db = env.ODOO_DB?.trim();
  const username = env.ODOO_USERNAME?.trim();
  const apiKey = env.ODOO_API_KEY?.trim();
  if (!url || !db || !username || !apiKey) return null;
  return { url, db, username, apiKey };
}

/** Build the crm.lead field map. Pure (no network) so it is unit-testable. */
export interface LeadMarketing {
  referred: string; // free-text channel marker, e.g. "sharp.reineke.tech"
  toolLabel: string; // brand name in the description, e.g. "Reineke Technik"
}
const DEFAULT_MARKETING: LeadMarketing = {
  referred: "sharp.reineke.tech",
  toolLabel: "Reineke Technik",
};

export function buildLeadValues(
  lead: LeadInput,
  now: Date = new Date(),
  marketing: LeadMarketing = DEFAULT_MARKETING,
): Record<string, unknown> {
  const email = lead.email.trim();
  const domain = lead.domain?.trim();
  const stamp = now.toISOString();
  const s = lead.scoping;
  const name = s
    ? `Pentest-Anfrage: ${s.company.trim()}`
    : domain
      ? `Sicherheits-Check: ${domain}`
      : `Sicherheits-Check Anfrage: ${email}`;
  const scopingLines = s
    ? (s.umfang ? `Ungefährer Umfang: ${s.umfang}\n` : "") +
      (s.freitext ? `Freitext: ${s.freitext}\n` : "")
    : "";
  const description =
    `Lead über das ${marketing.toolLabel} Sicherheits-Analyse-Tool (${marketing.referred}).\n` +
    `Kanal: ${lead.channel ?? "freier-check"}\n` +
    (domain ? `Analysierte Domain: ${domain}\n` : "") +
    `E-Mail: ${email}\n` +
    scopingLines +
    `DSGVO-Einwilligung erteilt: ${stamp}`;
  const values: Record<string, unknown> = {
    name,
    contact_name: s?.contactName?.trim() || email,
    email_from: email,
    // "opportunity" → erscheint direkt in der CRM-Pipeline (ohne dass die
    // separate "Leads"-Funktion in Odoo aktiviert sein muss).
    type: "opportunity",
    description,
    // Free-text channel marker; avoids depending on specific source_id records.
    referred: marketing.referred,
    // Strukturierte Zusatzfelder (x_reineke_* auf crm.lead; angelegt 2026-08-03).
    // createLead fällt auf die Basisfelder zurück, wenn sie fehlen sollten.
    x_reineke_kanal: lead.channel ?? "freier-check",
    x_reineke_kontakte: 1,
    x_reineke_kontakt_emails: email,
  };
  if (s) {
    values.partner_name = s.company.trim();
    if (s.role) values.function = s.role;
    if (s.phone) values.phone = s.phone;
    if (s.role) values.x_reineke_rolle = s.role;
    if (s.testart) values.x_reineke_testart = s.testart;
    if (s.anlass) values.x_reineke_anlass = s.anlass;
    if (s.frist) values.x_reineke_frist = s.frist;
  }
  // Store the analysed domain in the structured Website field, too.
  if (domain) values.website = domain;
  return values;
}

/** Strip the custom x_reineke_* fields (fallback when the instance lacks them). */
function baseValues(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([k]) => !k.startsWith("x_reineke_")));
}

interface JsonRpcResponse<T> {
  result?: T;
  error?: { message?: string; data?: { message?: string } };
}

async function jsonRpc<T>(
  url: string,
  service: string,
  method: string,
  args: unknown[],
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<T> {
  const r = await fetchImpl(`${url}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
    }),
    signal,
  });
  const body = (await r.json()) as JsonRpcResponse<T>;
  if (body.error) {
    const msg = body.error.data?.message || body.error.message || "Odoo JSON-RPC error";
    throw new Error(msg);
  }
  return body.result as T;
}

/**
 * Create a crm.lead in Odoo. Returns a structured result rather than throwing,
 * so the caller can decide how to treat transient failures.
 */
export async function createLead(
  cfg: OdooConfig,
  lead: LeadInput,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number; now?: Date; marketing?: LeadMarketing } = {},
): Promise<LeadResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10000);
  try {
    const uid = await jsonRpc<number | false>(
      cfg.url,
      "common",
      "login",
      [cfg.db, cfg.username, cfg.apiKey],
      fetchImpl,
      controller.signal,
    );
    if (!uid || typeof uid !== "number") {
      return {
        ok: false,
        code: "ODOO_AUTH_FAILED",
        message: "Odoo-Authentifizierung fehlgeschlagen (URL/DB/Login/API-Key prüfen).",
      };
    }
    const exec = <T>(model: string, method: string, args: unknown[], kwargs?: Record<string, unknown>) =>
      jsonRpc<T>(
        cfg.url,
        "object",
        "execute_kw",
        [cfg.db, uid, cfg.apiKey, model, method, args, ...(kwargs ? [kwargs] : [])],
        fetchImpl,
        controller.signal,
      );

    // ── Dublettenzusammenführung (Schlüssel: Domain) ──────────────────────────
    // Existiert ein offener Vorgang zu dieser Domain, wird er um den neuen
    // Kontakt/Scan ergänzt statt ein zweiter angelegt (probability<100 = offen).
    const domain = lead.domain?.trim();
    if (domain) {
      try {
        const existing = await exec<
          Array<{
            id: number;
            email_from?: string;
            x_reineke_kontakt_emails?: string | false;
            x_reineke_kanal?: string | false;
          }>
        >("crm.lead", "search_read", [
          [
            // Odoo normalisiert das Website-Feld (Prefix http://) — alle Formen abdecken.
            ["website", "in", [domain, `http://${domain}`, `https://${domain}`, `http://www.${domain}`, `https://www.${domain}`]],
            ["probability", "<", 100],
          ],
          ["id", "email_from", "x_reineke_kontakt_emails", "x_reineke_kanal"],
        ]);
        const ex = existing[0];
        if (ex) {
          const email = lead.email.trim().toLowerCase();
          const known = String(ex.x_reineke_kontakt_emails || ex.email_from || "")
            .toLowerCase()
            .split(/[,\s]+/)
            .filter(Boolean);
          const isNewPerson = !known.includes(email);
          const emails = isNewPerson ? [...known, email] : known;
          const upd: Record<string, unknown> = {
            x_reineke_kontakt_emails: emails.join(", "),
            x_reineke_kontakte: emails.length,
          };
          // /pentest-Scoping ist der stärkere Einstieg — Kanal hochstufen.
          if (lead.channel === "pentest-scoping") upd.x_reineke_kanal = "pentest-scoping";
          const s = lead.scoping;
          if (s) {
            upd.partner_name = s.company.trim();
            upd.contact_name = s.contactName.trim();
            if (s.phone) upd.phone = s.phone;
            if (s.role) upd.x_reineke_rolle = s.role;
            if (s.testart) upd.x_reineke_testart = s.testart;
            if (s.anlass) upd.x_reineke_anlass = s.anlass;
            if (s.frist) upd.x_reineke_frist = s.frist;
          }
          try {
            await exec("crm.lead", "write", [[ex.id], upd]);
          } catch {
            await exec("crm.lead", "write", [[ex.id], baseValues(upd)]);
          }
          const stamp = (opts.now ?? new Date()).toISOString();
          const note =
            `Erneute Anfrage über ${opts.marketing?.referred ?? DEFAULT_MARKETING.referred} ` +
            `(Kanal: ${lead.channel ?? "freier-check"}): ${lead.email.trim()}` +
            (isNewPerson ? " — neue Kontaktperson (mögliches Buying Center)." : ".") +
            (s ? ` Scoping: ${[s.testart, s.anlass, s.frist].filter(Boolean).join(" · ")}` : "") +
            ` DSGVO-Einwilligung: ${stamp}`;
          try {
            await exec("crm.lead", "message_post", [[ex.id]], { body: note });
          } catch {
            /* chatter note is best-effort */
          }
          try {
            await createLeadActivity(cfg, uid, ex.id, lead, fetchImpl, controller.signal, opts.now, opts.marketing);
          } catch {
            /* notification is best-effort */
          }
          return { ok: true, code: "OK", message: "Bestehender Vorgang ergänzt.", leadId: ex.id };
        }
      } catch {
        /* Dubletten-Suche best-effort — im Zweifel neuen Lead anlegen */
      }
    }

    const values = buildLeadValues(lead, opts.now, opts.marketing);
    let leadId: number;
    try {
      leadId = await exec<number>("crm.lead", "create", [values]);
    } catch {
      // Fallback ohne die x_reineke_*-Felder — der Lead darf nie verloren gehen.
      leadId = await exec<number>("crm.lead", "create", [baseValues(values)]);
    }
    // Best-effort: drop a To-Do activity on the lead so the team is notified in
    // Odoo (Activities bell + "My Activities"). Never fails the lead.
    try {
      await createLeadActivity(cfg, uid, leadId, lead, fetchImpl, controller.signal, opts.now, opts.marketing);
    } catch {
      /* notification is best-effort; the lead is already saved */
    }
    return { ok: true, code: "OK", message: "Lead erstellt.", leadId };
  } catch (err) {
    return {
      ok: false,
      code: "ODOO_ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

// "To Do" activity type + crm.lead model id — resolved once per isolate.
let activityTypeIdCache: number | undefined;
let leadModelIdCache: number | undefined;

/** Create a To-Do activity on the lead so the salesperson is notified in Odoo. */
async function createLeadActivity(
  cfg: OdooConfig,
  uid: number,
  leadId: number,
  lead: LeadInput,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
  now?: Date,
  marketing: LeadMarketing = DEFAULT_MARKETING,
): Promise<void> {
  const exec = <T>(model: string, method: string, args: unknown[]) =>
    jsonRpc<T>(cfg.url, "object", "execute_kw", [cfg.db, uid, cfg.apiKey, model, method, args], fetchImpl, signal);

  if (!activityTypeIdCache) {
    const td = await exec<Array<{ res_id: number }>>("ir.model.data", "search_read", [
      [["module", "=", "mail"], ["name", "=", "mail_activity_data_todo"]],
      ["res_id"],
    ]);
    activityTypeIdCache = td[0]?.res_id;
  }
  if (!leadModelIdCache) {
    const m = await exec<number[]>("ir.model", "search", [[["model", "=", "crm.lead"]]]);
    leadModelIdCache = m[0];
  }
  if (!activityTypeIdCache || !leadModelIdCache) return;

  const domain = lead.domain?.trim();
  await exec("mail.activity", "create", [
    {
      activity_type_id: activityTypeIdCache,
      res_model_id: leadModelIdCache,
      res_id: leadId,
      user_id: uid,
      summary: "Neuer Lead aus dem Sicherheits-Tool",
      note: `${lead.email.trim()} hat den Bericht${domain ? ` für ${domain}` : ""} angefordert (${marketing.referred}).`,
      date_deadline: (now ?? new Date()).toISOString().slice(0, 10),
    },
  ]);
}

// ─── Scanned-domain log (custom Odoo model x_reineke_scanned_domain) ───────────
// One row per domain: x_name = domain, x_scan_count = number of scans. Odoo's
// built-in create_date / write_date serve as first/last seen.
const SCANNED_MODEL = "x_reineke_scanned_domain";

// Cache the authenticated uid per isolate to avoid re-logging-in on every scan.
let cachedUid: number | null = null;

async function authUid(
  cfg: OdooConfig,
  fetchImpl: typeof fetch,
  signal: AbortSignal,
): Promise<number | null> {
  if (cachedUid) return cachedUid;
  const uid = await jsonRpc<number | false>(
    cfg.url,
    "common",
    "login",
    [cfg.db, cfg.username, cfg.apiKey],
    fetchImpl,
    signal,
  );
  if (uid && typeof uid === "number") {
    cachedUid = uid;
    return uid;
  }
  return null;
}

/**
 * Upsert a scanned domain into the custom Odoo model. Best-effort: never throws,
 * so a logging hiccup can't affect the scan response. Meant to be called via
 * executionCtx.waitUntil so it doesn't add latency.
 */
export async function recordScannedDomain(
  cfg: OdooConfig,
  domain: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10000);
  try {
    const uid = await authUid(cfg, fetchImpl, controller.signal);
    if (!uid) return;
    const exec = <T>(model: string, method: string, args: unknown[]) =>
      jsonRpc<T>(cfg.url, "object", "execute_kw", [cfg.db, uid, cfg.apiKey, model, method, args], fetchImpl, controller.signal);

    const ids = await exec<number[]>(SCANNED_MODEL, "search", [[["x_name", "=", domain]]]);
    if (ids.length) {
      const rows = await exec<Array<{ x_scan_count?: number }>>(SCANNED_MODEL, "read", [[ids[0]], ["x_scan_count"]]);
      const count = (rows[0]?.x_scan_count ?? 0) + 1;
      await exec(SCANNED_MODEL, "write", [[ids[0]], { x_scan_count: count }]);
    } else {
      await exec(SCANNED_MODEL, "create", [{ x_name: domain, x_scan_count: 1 }]);
    }
  } catch {
    // best-effort — domain logging must never affect the scan itself
  } finally {
    clearTimeout(timer);
  }
}

// ─── Lead-Anreicherung: Befunde + Ampel + Scan-Zähler ─────────────────────────
// Läuft NACH der Lead-Antwort (executionCtx.waitUntil): der Nutzer wartet nie
// auf die serverseitigen Scans, und ein Fehler hier kostet keinen Bericht.
export async function writeLeadFindings(
  cfg: OdooConfig,
  leadId: number,
  input: { befunde: string; ampel: Ampel; domain?: string },
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<void> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  try {
    const uid = await authUid(cfg, fetchImpl, controller.signal);
    if (!uid) return;
    const exec = <T>(model: string, method: string, args: unknown[]) =>
      jsonRpc<T>(cfg.url, "object", "execute_kw", [cfg.db, uid, cfg.apiKey, model, method, args], fetchImpl, controller.signal);

    const upd: Record<string, unknown> = {
      x_reineke_befunde: input.befunde,
      x_reineke_ampel: input.ampel,
    };
    // Scan-Zähler aus dem Scan-Protokoll (x_reineke_scanned_domain) übernehmen —
    // Wiederholung ist ein Kaufsignal und gehört sichtbar in den Vorgang.
    if (input.domain) {
      try {
        const rows = await exec<Array<{ x_scan_count?: number }>>(SCANNED_MODEL, "search_read", [
          [["x_name", "=", input.domain]],
          ["x_scan_count"],
        ]);
        if (rows[0]?.x_scan_count) upd.x_reineke_scans = rows[0].x_scan_count;
      } catch {
        /* Zähler best-effort */
      }
    }
    await exec("crm.lead", "write", [[leadId], upd]);
  } catch {
    // best-effort — enrichment must never break anything user-facing
  } finally {
    clearTimeout(timer);
  }
}
