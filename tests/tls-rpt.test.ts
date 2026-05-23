import { describe, expect, it } from "vitest";
import { parseTlsRpt } from "../src/analyzers/tls-rpt.js";

describe("parseTlsRpt", () => {
  it("returns null for non-TLSRPT strings", () => {
    expect(parseTlsRpt("v=spf1 -all")).toBeNull();
    expect(parseTlsRpt("")).toBeNull();
    expect(parseTlsRpt("v=DMARC1; p=none")).toBeNull();
  });

  it("parses a single mailto rua", () => {
    const r = parseTlsRpt("v=TLSRPTv1; rua=mailto:tlsrpt@example.com")!;
    expect(r).not.toBeNull();
    expect(r.version).toBe("TLSRPTv1");
    expect(r.rua).toEqual(["mailto:tlsrpt@example.com"]);
  });

  it("parses multiple comma-separated rua targets", () => {
    const r = parseTlsRpt(
      "v=TLSRPTv1; rua=mailto:a@example.com,https://reports.example.com/tls",
    )!;
    expect(r.rua).toEqual(["mailto:a@example.com", "https://reports.example.com/tls"]);
  });

  it("is case-insensitive on the version tag", () => {
    const r = parseTlsRpt("V=TLSRPTv1; rua=mailto:x@y.de")!;
    expect(r).not.toBeNull();
    expect(r.rua).toEqual(["mailto:x@y.de"]);
  });

  it("handles a record with no rua gracefully", () => {
    const r = parseTlsRpt("v=TLSRPTv1;")!;
    expect(r).not.toBeNull();
    expect(r.rua).toEqual([]);
  });

  it("preserves the raw record", () => {
    const raw = "v=TLSRPTv1; rua=mailto:r@x.de";
    expect(parseTlsRpt(raw)!.raw).toBe(raw);
  });
});
