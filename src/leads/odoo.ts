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
    `Lead über das Reineke Technik Sicherheits-Analyse-Tool (sharp.reineke.tech).\n` +
    (domain ? `Analysierte Domain: ${domain}\n` : "") +
    `E-Mail: ${email}\n` +
    `DSGVO-Einwilligung erteilt: ${stamp}`;
  return {
    name,
    contact_name: email,
    email_from: email,
    type: "lead",
    description,
    // Free-text channel marker; avoids depending on specific source_id records.
    referred: "sharp.reineke.tech",
  };
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
