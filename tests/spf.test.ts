import { describe, expect, it } from "vitest";
import { parseSpf } from "../src/analyzers/spf.js";

describe("parseSpf", () => {
  it("parses qualifier-less mechanisms as positive (+)", () => {
    const r = parseSpf("v=spf1 mx -all");
    const mx = r.mechanisms.find((m) => m.type === "mx")!;
    expect(mx.qualifier).toBe("+");
    expect(mx.causesLookup).toBe(true);
  });

  it("extracts the all qualifier", () => {
    expect(parseSpf("v=spf1 -all").all).toBe("-");
    expect(parseSpf("v=spf1 ~all").all).toBe("~");
    expect(parseSpf("v=spf1 ?all").all).toBe("?");
    expect(parseSpf("v=spf1 +all").all).toBe("+");
    expect(parseSpf("v=spf1 mx").all).toBeUndefined();
  });

  it("parses include with target value", () => {
    const r = parseSpf("v=spf1 include:_spf.google.com -all");
    const inc = r.mechanisms.find((m) => m.type === "include")!;
    expect(inc.value).toBe("_spf.google.com");
    expect(inc.causesLookup).toBe(true);
    expect(inc.qualifier).toBe("+");
  });

  it("parses ip4 and ip6 as non-lookup mechanisms", () => {
    const r = parseSpf("v=spf1 ip4:1.2.3.0/24 ip6:2001:db8::/32 -all");
    const ip4 = r.mechanisms.find((m) => m.type === "ip4")!;
    const ip6 = r.mechanisms.find((m) => m.type === "ip6")!;
    expect(ip4.value).toBe("1.2.3.0/24");
    expect(ip6.value).toBe("2001:db8::/32");
    expect(ip4.causesLookup).toBe(false);
    expect(ip6.causesLookup).toBe(false);
  });

  it("parses redirect modifier (uses '=' not ':')", () => {
    const r = parseSpf("v=spf1 redirect=spf.example.com");
    const red = r.mechanisms.find((m) => m.type === "redirect")!;
    expect(red.value).toBe("spf.example.com");
    expect(red.causesLookup).toBe(true);
  });

  it("parses negative qualifier for include", () => {
    const r = parseSpf("v=spf1 -include:bad.example.com -all");
    const inc = r.mechanisms.find((m) => m.type === "include")!;
    expect(inc.qualifier).toBe("-");
  });

  it("identifies ptr as a lookup-causing mechanism", () => {
    const r = parseSpf("v=spf1 ptr -all");
    expect(r.mechanisms.find((m) => m.type === "ptr")!.causesLookup).toBe(true);
  });

  it("handles a record with no mechanisms beyond version", () => {
    const r = parseSpf("v=spf1");
    expect(r.mechanisms).toHaveLength(0);
    expect(r.all).toBeUndefined();
  });
});
