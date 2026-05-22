import { describe, expect, it } from "vitest";
import { parseDkim } from "../src/analyzers/dkim.js";

describe("parseDkim", () => {
  it("returns null for non-DKIM strings", () => {
    expect(parseDkim("default", "junk text")).toBeNull();
    expect(parseDkim("default", "")).toBeNull();
  });

  it("parses a full DKIM record with v, k, p", () => {
    const raw = "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...";
    const r = parseDkim("google", raw)!;
    expect(r).not.toBeNull();
    expect(r.selector).toBe("google");
    expect(r.v).toBe("DKIM1");
    expect(r.k).toBe("rsa");
    expect(r.p).toContain("MIGfMA");
  });

  it("preserves the selector exactly as given", () => {
    const r = parseDkim("ProtonMail2", "v=DKIM1; k=rsa; p=ABC")!;
    expect(r.selector).toBe("ProtonMail2");
  });

  it("strips whitespace from the p= base64 blob", () => {
    const r = parseDkim("k1", "v=DKIM1; k=rsa; p=AB CD\tEF\nGH")!;
    expect(r.p).toBe("ABCDEFGH");
  });

  it("parses t flag list", () => {
    const r = parseDkim("test", "v=DKIM1; k=rsa; p=ABC; t=y:s")!;
    expect(r.t).toEqual(["y", "s"]);
  });

  it("parses h and s flag lists", () => {
    const r = parseDkim("default", "v=DKIM1; k=rsa; p=ABC; h=sha256; s=email")!;
    expect(r.h).toEqual(["sha256"]);
    expect(r.s).toEqual(["email"]);
  });

  it("treats a record with v=DKIM1 but empty p as a revoked key (still parsed)", () => {
    const r = parseDkim("revoked", "v=DKIM1; k=rsa; p=");
    expect(r).not.toBeNull();
    expect(r!.p).toBe("");
  });
});
