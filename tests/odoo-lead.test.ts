import { describe, expect, it, vi } from "vitest";
import {
  buildLeadValues,
  createLead,
  odooConfigFromEnv,
  recordScannedDomain,
  validateEmail,
  type OdooConfig,
} from "../src/leads/odoo.js";

describe("validateEmail", () => {
  it("accepts normal addresses", () => {
    expect(validateEmail("name@unternehmen.de")).toBe(true);
    expect(validateEmail("a.b+tag@sub.example.co.uk")).toBe(true);
  });
  it("rejects malformed / non-string input", () => {
    expect(validateEmail("nope")).toBe(false);
    expect(validateEmail("a@b")).toBe(false); // no TLD dot
    expect(validateEmail("a @b.de")).toBe(false); // space
    expect(validateEmail("")).toBe(false);
    expect(validateEmail(undefined)).toBe(false);
    expect(validateEmail(42)).toBe(false);
  });
  it("rejects absurdly long addresses", () => {
    expect(validateEmail(`${"x".repeat(250)}@example.de`)).toBe(false);
  });
});

describe("odooConfigFromEnv", () => {
  it("returns null when any piece is missing", () => {
    expect(odooConfigFromEnv({})).toBeNull();
    expect(
      odooConfigFromEnv({ ODOO_URL: "https://x.odoo.com", ODOO_DB: "x" }),
    ).toBeNull();
  });
  it("trims and strips trailing slashes from the URL", () => {
    const cfg = odooConfigFromEnv({
      ODOO_URL: "https://x.odoo.com/// ".trim(),
      ODOO_DB: "x",
      ODOO_USERNAME: "u@x.de",
      ODOO_API_KEY: "key",
    });
    expect(cfg?.url).toBe("https://x.odoo.com");
  });
});

describe("buildLeadValues", () => {
  const now = new Date("2026-05-25T10:00:00.000Z");
  it("names the lead from the domain when present", () => {
    const v = buildLeadValues({ email: "a@b.de", domain: "reineke.tech", consent: true }, now);
    expect(v.name).toBe("Sicherheits-Check: reineke.tech");
    expect(v.email_from).toBe("a@b.de");
    expect(v.type).toBe("opportunity");
    expect(v.website).toBe("reineke.tech");
    expect(String(v.description)).toContain("reineke.tech");
    expect(String(v.description)).toContain("2026-05-25T10:00:00.000Z");
  });
  it("falls back to the e-mail when no domain (no website field)", () => {
    const v = buildLeadValues({ email: "a@b.de", consent: true }, now);
    expect(v.name).toBe("Sicherheits-Check Anfrage: a@b.de");
    expect(v.website).toBeUndefined();
  });
});

/** Mock fetch that answers the login then the create JSON-RPC calls. */
function mockOdoo(responses: { login: unknown; create: unknown }) {
  return vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const service = body.params.service;
    const result = service === "common" ? responses.login : responses.create;
    return new Response(JSON.stringify({ jsonrpc: "2.0", result }), {
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

const CFG: OdooConfig = {
  url: "https://x.odoo.com",
  db: "x",
  username: "u@x.de",
  apiKey: "key",
};

describe("createLead", () => {
  it("creates a lead and returns its id", async () => {
    const fetchImpl = mockOdoo({ login: 7, create: 123 });
    const r = await createLead(CFG, { email: "a@b.de", domain: "b.de", consent: true }, { fetchImpl });
    expect(r.ok).toBe(true);
    expect(r.code).toBe("OK");
    expect(r.leadId).toBe(123);
  });

  it("reports auth failure when login returns false", async () => {
    const fetchImpl = mockOdoo({ login: false, create: 123 });
    const r = await createLead(CFG, { email: "a@b.de", consent: true }, { fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("ODOO_AUTH_FAILED");
  });

  it("surfaces a JSON-RPC error as ODOO_ERROR", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({ jsonrpc: "2.0", error: { data: { message: "Access Denied" } } }),
        { headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    const r = await createLead(CFG, { email: "a@b.de", consent: true }, { fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.code).toBe("ODOO_ERROR");
    expect(r.message).toContain("Access Denied");
  });
});

/** Mock fetch for the scanned-domain upsert. `existing` = search() result ids. */
function mockScanned(existing: number[], scanCount = 0) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const { service, method, args } = body.params;
    let result: unknown;
    if (service === "common" && method === "login") result = 7;
    else if (method === "execute_kw") {
      const m = args[4] as string; // model method
      calls.push(m);
      if (m === "search") result = existing;
      else if (m === "read") result = [{ x_scan_count: scanCount }];
      else if (m === "create") result = 99;
      else result = true; // write
    }
    return new Response(JSON.stringify({ jsonrpc: "2.0", result }), {
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe("recordScannedDomain", () => {
  it("creates a new row for an unseen domain", async () => {
    const { fetchImpl, calls } = mockScanned([]);
    await recordScannedDomain(CFG, "new-domain.example", { fetchImpl });
    expect(calls).toContain("search");
    expect(calls).toContain("create");
    expect(calls).not.toContain("write");
  });

  it("increments scan_count for a known domain", async () => {
    const { fetchImpl, calls } = mockScanned([5], 3);
    await recordScannedDomain(CFG, "known.example", { fetchImpl });
    expect(calls).toContain("search");
    expect(calls).toContain("read");
    expect(calls).toContain("write");
    expect(calls).not.toContain("create");
  });
});
