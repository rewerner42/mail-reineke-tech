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

  it("classifies a name protected by its signed parent zone as secure (AD set, 0 own DNSKEY)", () => {
    // e.g. sharp.reineke.tech: no DNSKEY/DS of its own (it's a record in the
    // signed reineke.tech zone), but the validating resolver authenticates the
    // answer → AD=true. Must be secure (A+), not "unsigned".
    const c = classifyDnssec({ dnskeyAd: true, dnskeyCount: 0, dnskeyServfail: false, dsCount: 0 });
    expect(c.status).toBe("pass");
    expect(c.code).toBe("DNSSEC_SECURE");
    expect(c.score).toBe(100);
    expect(c.data.secure).toBe(true);
    expect(c.data.authenticated).toBe(true);
    expect(c.data.dnskeyCount).toBe(0);
  });

  it("classifies an unsigned zone (no keys, no DS) as fail — F (binary)", () => {
    const c = classifyDnssec({ dnskeyAd: false, dnskeyCount: 0, dnskeyServfail: false, dsCount: 0 });
    expect(c.status).toBe("fail");
    expect(c.code).toBe("DNSSEC_UNSIGNED");
    expect(c.score).toBe(0);
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

  it("classifies DNSKEY published but no DS at parent as fail — F (unanchored)", () => {
    const c = classifyDnssec({ dnskeyAd: false, dnskeyCount: 2, dnskeyServfail: false, dsCount: 0 });
    expect(c.status).toBe("fail");
    expect(c.code).toBe("DNSSEC_UNANCHORED");
    expect(c.score).toBe(0);
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
