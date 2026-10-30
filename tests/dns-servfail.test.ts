// A zone that cannot be resolved must not read as "nothing published".
//
// Cloudflare's resolver validates DNSSEC, so a zone with a broken signature
// answers SERVFAIL for every record type. Treating that as an empty answer made
// the report state "no SPF record published", "no DMARC record published" and so
// on about a domain where nothing could be read at all.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DnsUnresolvable, queryMx, queryTxt } from "../src/dns.js";
import { analyzeDkim } from "../src/analyzers/dkim.js";
import { buildSignal } from "../src/report/signal.js";

/** A DoH answer with the given RCODE and no records. */
function antwort(status: number) {
  return {
    ok: true,
    json: async () => ({ Status: status, Answer: undefined }),
  } as unknown as Response;
}

describe("SERVFAIL is not an empty answer", () => {
  const echtesFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = echtesFetch;
    vi.restoreAllMocks();
  });

  it("raises for TXT", async () => {
    globalThis.fetch = vi.fn(async () => antwort(2)) as unknown as typeof fetch;
    await expect(queryTxt("beispiel.de")).rejects.toBeInstanceOf(DnsUnresolvable);
  });

  it("raises for MX", async () => {
    globalThis.fetch = vi.fn(async () => antwort(2)) as unknown as typeof fetch;
    await expect(queryMx("beispiel.de")).rejects.toBeInstanceOf(DnsUnresolvable);
  });

  it("still treats NXDOMAIN as 'nothing published'", async () => {
    globalThis.fetch = vi.fn(async () => antwort(3)) as unknown as typeof fetch;
    await expect(queryTxt("beispiel.de")).resolves.toEqual([]);
  });

  it("still treats an empty NOERROR as 'nothing published'", async () => {
    globalThis.fetch = vi.fn(async () => antwort(0)) as unknown as typeof fetch;
    await expect(queryTxt("beispiel.de")).resolves.toEqual([]);
  });
});

describe("DKIM on an unresolvable zone", () => {
  const echtesFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = echtesFetch;
    vi.restoreAllMocks();
  });

  it("says it could not be checked instead of 'no selector found'", async () => {
    globalThis.fetch = vi.fn(async () => antwort(2)) as unknown as typeof fetch;
    const r = await analyzeDkim("beispiel.de");
    expect(r.status).toBe("info");
    expect(r.issues[0]!.code).toBe("DKIM_QUERY_FAILED");
    expect(r.summary).not.toContain("Keine DKIM-Selektoren gefunden");
  });

  it("still reports 'no selector found' when the zone answers normally", async () => {
    globalThis.fetch = vi.fn(async () => antwort(0)) as unknown as typeof fetch;
    const r = await analyzeDkim("beispiel.de");
    expect(r.issues[0]!.code).toBe("DKIM_NONE_FOUND");
  });
});

describe("MTA-STS and TLS-RPT: published but ineffective is not absent", () => {
  // The scanner reports "nothing published" and "published, running in testing
  // mode" both as warn. Reading only the severity made the report state that
  // nothing was laid down at all about a domain that demonstrably had a policy.
  const basis = {
    status: "warn" as const,
    summary: "MTA-STS im Testmodus",
    data: {},
  };

  it("calls a policy in testing mode a finding of its own", () => {
    const sig = buildSignal(
      {
        domain: "beispiel.de",
        queriedAt: "2026-10-30T00:00:00Z",
        dmarc: { status: "pass", summary: "", issues: [], data: null },
        spf: { status: "pass", summary: "", issues: [], data: null },
        dkim: { status: "pass", summary: "", issues: [], data: [] },
        mx: { status: "pass", summary: "", issues: [], data: [] },
        mtaSts: { ...basis, issues: [{ severity: "warn", code: "MTASTS_TESTING", message: "" }] },
        tlsRpt: { ...basis, issues: [{ severity: "warn", code: "TLSRPT_RUA_FORMAT", message: "" }] },
        dnssec: { status: "pass", summary: "", issues: [], data: { secure: true } },
      } as never,
      undefined,
      "2026-10-30",
    );
    expect(sig.mail.mta_sts.zustand).toBe("hinweis");
    expect(sig.mail.tls_rpt.zustand).toBe("hinweis");
  });

  it("still calls a missing record missing", () => {
    const sig = buildSignal(
      {
        domain: "beispiel.de",
        queriedAt: "2026-10-30T00:00:00Z",
        dmarc: { status: "pass", summary: "", issues: [], data: null },
        spf: { status: "pass", summary: "", issues: [], data: null },
        dkim: { status: "pass", summary: "", issues: [], data: [] },
        mx: { status: "pass", summary: "", issues: [], data: [] },
        mtaSts: { ...basis, issues: [{ severity: "warn", code: "MTASTS_MISSING", message: "" }] },
        tlsRpt: { ...basis, issues: [{ severity: "warn", code: "TLSRPT_MISSING", message: "" }] },
        dnssec: { status: "pass", summary: "", issues: [], data: { secure: true } },
      } as never,
      undefined,
      "2026-10-30",
    );
    expect(sig.mail.mta_sts.zustand).toBe("fehlt");
    expect(sig.mail.tls_rpt.zustand).toBe("fehlt");
  });
});
