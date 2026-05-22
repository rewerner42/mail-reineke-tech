import { describe, expect, it } from "vitest";
import { parseTxtData } from "../src/dns.js";

describe("parseTxtData", () => {
  it("strips outer quotes from a single-string TXT", () => {
    expect(parseTxtData('"v=spf1 -all"')).toBe("v=spf1 -all");
  });

  it("concatenates adjacent quoted strings (multi-string TXT)", () => {
    // Cloudflare DoH returns long TXT records as multiple quoted strings,
    // separated by a space. RFC 7208 §3.3 says they MUST be concatenated
    // with no separator.
    expect(parseTxtData('"v=spf1 include:_spf.google.com " "include:mailgun.org -all"')).toBe(
      "v=spf1 include:_spf.google.com include:mailgun.org -all",
    );
  });

  it("handles a TXT with escaped quote inside", () => {
    expect(parseTxtData('"hello \\"world\\""')).toBe('hello "world"');
  });

  it("returns input unchanged if no quotes are found", () => {
    expect(parseTxtData("plainstring")).toBe("plainstring");
  });

  it("handles three concatenated parts", () => {
    expect(parseTxtData('"part1 " "part2 " "part3"')).toBe("part1 part2 part3");
  });
});
