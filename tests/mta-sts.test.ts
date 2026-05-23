import { describe, expect, it } from "vitest";
import { parseMtaStsPolicy } from "../src/analyzers/mta-sts.js";

describe("parseMtaStsPolicy", () => {
  it("parses a standard enforce policy", () => {
    const text = [
      "version: STSv1",
      "mode: enforce",
      "mx: mail.example.com",
      "mx: *.example.net",
      "max_age: 604800",
    ].join("\n");
    const p = parseMtaStsPolicy(text);
    expect(p.version).toBe("STSv1");
    expect(p.mode).toBe("enforce");
    expect(p.mx).toEqual(["mail.example.com", "*.example.net"]);
    expect(p.maxAge).toBe(604800);
  });

  it("handles CRLF line endings", () => {
    const text = "version: STSv1\r\nmode: testing\r\nmx: a.example.com\r\nmax_age: 86400\r\n";
    const p = parseMtaStsPolicy(text);
    expect(p.mode).toBe("testing");
    expect(p.mx).toEqual(["a.example.com"]);
    expect(p.maxAge).toBe(86400);
  });

  it("ignores invalid mode values", () => {
    const p = parseMtaStsPolicy("version: STSv1\nmode: bogus\nmx: x.example.com");
    expect(p.mode).toBeUndefined();
  });

  it("collects multiple mx entries in order", () => {
    const p = parseMtaStsPolicy("mx: a\nmx: b\nmx: c");
    expect(p.mx).toEqual(["a", "b", "c"]);
  });

  it("tolerates extra whitespace and blank lines", () => {
    const p = parseMtaStsPolicy("  version :  STSv1 \n\n  mode :  enforce \n");
    // Note: leading space before colon means key is "version " -> trimmed to "version"
    expect(p.version).toBe("STSv1");
    expect(p.mode).toBe("enforce");
  });

  it("ignores non-numeric max_age", () => {
    const p = parseMtaStsPolicy("version: STSv1\nmode: none\nmax_age: forever");
    expect(p.maxAge).toBeUndefined();
    expect(p.mode).toBe("none");
  });

  it("returns empty mx list when none present", () => {
    const p = parseMtaStsPolicy("version: STSv1\nmode: enforce");
    expect(p.mx).toEqual([]);
  });
});
