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
export function buildLeadValues(
  lead: LeadInput,
  now: Date = new Date(),
): Record<string, unknown> {
  const email = lead.email.trim();
  const domain = lead.domain?.trim();
  const stamp = now.toISOString();
  const name = domain
    ? `Sicherheits-Check: ${domain}`
    : `Sicherheits-Check Anfrage: ${email}`;
  const description =
    `Lead über das WS IT-TECHNOLOGY Sicherheits-Analyse-Tool (wsit.reineke.tech).\n` +
    (domain ? `Analysierte Domain: ${domain}\n` : "") +
    `E-Mail: ${email}\n` +
    `DSGVO-Einwilligung erteilt: ${stamp}`;
  const values: Record<string, unknown> = {
    name,
    contact_name: email,
    email_from: email,
    // "opportunity" → erscheint direkt in der CRM-Pipeline (ohne dass die
    // separate "Leads"-Funktion in Odoo aktiviert sein muss).
    type: "opportunity",
    description,
    // Free-text channel marker; avoids depending on specific source_id records.
    referred: "wsit.reineke.tech",
  };
  // Store the analysed domain in the structured Website field, too.
  if (domain) values.website = domain;
  return values;
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
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number; now?: Date } = {},
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
    const leadId = await jsonRpc<number>(
      cfg.url,
      "object",
      "execute_kw",
      [cfg.db, uid, cfg.apiKey, "crm.lead", "create", [buildLeadValues(lead, opts.now)]],
      fetchImpl,
      controller.signal,
    );
    // Best-effort: drop a To-Do activity on the lead so the team is notified in
    // Odoo (Activities bell + "My Activities"). Never fails the lead.
    try {
      await createLeadActivity(cfg, uid, leadId, lead, fetchImpl, controller.signal, opts.now);
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
      note: `${lead.email.trim()} hat den Bericht${domain ? ` für ${domain}` : ""} angefordert (wsit.reineke.tech).`,
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
