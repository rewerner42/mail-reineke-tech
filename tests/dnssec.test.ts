import { describe, expect, it } from "vitest";
import { classifyDnssec } from "../src/analyzers/dnssec.js";

// Signals mirror real DoH responses captured from Cloudflare 1.1.1.1:
//   reineke-technik.de / cloudflare.com → secure
//   sharp.eu / google.com               → unsigned
//   dnssec-failed.org                   → broken (DS at parent, DNSKEY SERVFAILs)

describe("classifyDnssec", () => {
  it("classifies a fully validated zone as secure (pass)", () => {
    const c = classifyDnssec({ dnskeyAd: true, dnskeyCount: 2, dnskeyServfail: false, dsCount: 1 });
    expect(c.status).toBe("pass");
    expect(c.code).toBe("DNSSEC_SECURE");
    expect(c.data.secure).toBe(true);
    expect(c.data.authenticated).toBe(true);
    expect(c.data.dsPresent).toBe(true);
    expect(c.data.validationFailed).toBe(false);
  });

  it("classifies an unsigned zone (no keys, no DS) as warn", () => {
    const c = classifyDnssec({ dnskeyAd: false, dnskeyCount: 0, dnskeyServfail: false, dsCount: 0 });
    expect(c.status).toBe("warn");
    expect(c.code).toBe("DNSSEC_UNSIGNED");
    expect(c.data.secure).toBe(false);
    expect(c.data.validationFailed).toBe(false);
  });

  it("classifies broken DNSSEC (DS present but DNSKEY SERVFAILs) as fail", () => {
    const c = classifyDnssec({ dnskeyAd: false, dnskeyCount: 0, dnskeyServfail: true, dsCount: 1 });
    expect(c.status).toBe("fail");
    expect(c.code).toBe("DNSSEC_BROKEN");
    expect(c.data.validationFailed).toBe(true);
    expect(c.data.dsPresent).toBe(true);
    expect(c.message).toMatch(/SERVFAIL/);
  });

  it("classifies DS present but no validation (no SERVFAIL) as fail", () => {
    const c = classifyDnssec({ dnskeyAd: false, dnskeyCount: 2, dnskeyServfail: false, dsCount: 1 });
    expect(c.status).toBe("fail");
    expect(c.code).toBe("DNSSEC_BROKEN");
    expect(c.data.validationFailed).toBe(true);
  });

  it("classifies DNSKEY published but no DS at parent as warn (unanchored)", () => {
    const c = classifyDnssec({ dnskeyAd: false, dnskeyCount: 2, dnskeyServfail: false, dsCount: 0 });
    expect(c.status).toBe("warn");
    expect(c.code).toBe("DNSSEC_UNANCHORED");
    expect(c.data.dnskeyCount).toBe(2);
    expect(c.data.dsPresent).toBe(false);
    expect(c.data.secure).toBe(false);
  });

  it("prefers the validated verdict even if servfail flag is noisy", () => {
    // AD true should win — a validated answer is authoritative.
    const c = classifyDnssec({ dnskeyAd: true, dnskeyCount: 1, dnskeyServfail: false, dsCount: 0 });
    expect(c.status).toBe("pass");
    expect(c.data.secure).toBe(true);
  });
});
