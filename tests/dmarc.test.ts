import { describe, expect, it } from "vitest";
import { parseDmarc } from "../src/analyzers/dmarc.js";

describe("parseDmarc", () => {
  it("rejects records without v=DMARC1", () => {
    expect(parseDmarc("v=spf1 -all")).toBeNull();
    expect(parseDmarc("p=reject")).toBeNull();
    expect(parseDmarc("")).toBeNull();
  });

  it("parses a minimal record", () => {
    const r = parseDmarc("v=DMARC1; p=none");
    expect(r).not.toBeNull();
    expect(r!.p).toBe("none");
    expect(r!.version).toBe("DMARC1");
  });

  it("parses a full record with all common tags", () => {
    const raw =
      "v=DMARC1; p=reject; sp=quarantine; pct=50; rua=mailto:r@example.com,mailto:s@example.com; ruf=mailto:f@example.com; adkim=s; aspf=r; fo=1:d; rf=afrf; ri=3600";
    const r = parseDmarc(raw)!;
    expect(r.p).toBe("reject");
    expect(r.sp).toBe("quarantine");
    expect(r.pct).toBe(50);
    expect(r.rua).toEqual(["mailto:r@example.com", "mailto:s@example.com"]);
    expect(r.ruf).toEqual(["mailto:f@example.com"]);
    expect(r.adkim).toBe("s");
    expect(r.aspf).toBe("r");
    expect(r.fo).toEqual(["1", "d"]);
    expect(r.rf).toBe("afrf");
    expect(r.ri).toBe(3600);
  });

  it("is case-insensitive for tag names but preserves rua values", () => {
    const r = parseDmarc("V=DMARC1; P=Reject; RUA=mailto:R@Example.COM")!;
    expect(r.p).toBe("reject");
    expect(r.rua).toEqual(["mailto:R@Example.COM"]);
  });

  it("ignores empty/malformed segments", () => {
    const r = parseDmarc("v=DMARC1; ; p=none; =garbage; junk")!;
    expect(r.p).toBe("none");
  });

  it("ignores non-numeric pct", () => {
    const r = parseDmarc("v=DMARC1; p=none; pct=abc")!;
    expect(r.pct).toBeUndefined();
  });

  it("tolerates extra whitespace around tags", () => {
    const r = parseDmarc("  v = DMARC1 ;  p = quarantine ;  pct = 100  ")!;
    expect(r.p).toBe("quarantine");
    expect(r.pct).toBe(100);
  });

  it("preserves the raw record for display", () => {
    const raw = "v=DMARC1; p=reject; rua=mailto:r@x.de";
    const r = parseDmarc(raw)!;
    expect(r.raw).toBe(raw);
  });
});
