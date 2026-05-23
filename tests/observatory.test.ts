import { describe, expect, it } from "vitest";
import { gradeToSeverity, normalizeObservatory, stripHtml } from "../src/observatory.js";

describe("gradeToSeverity", () => {
  it("maps A grades to pass", () => {
    expect(gradeToSeverity("A+")).toBe("pass");
    expect(gradeToSeverity("A")).toBe("pass");
    expect(gradeToSeverity("A-")).toBe("pass");
  });

  it("maps B and C grades to warn", () => {
    expect(gradeToSeverity("B+")).toBe("warn");
    expect(gradeToSeverity("B")).toBe("warn");
    expect(gradeToSeverity("C-")).toBe("warn");
  });

  it("maps D, E and F grades to fail", () => {
    expect(gradeToSeverity("D")).toBe("fail");
    expect(gradeToSeverity("E")).toBe("fail");
    expect(gradeToSeverity("F")).toBe("fail");
  });

  it("returns info for null/empty/unknown grades", () => {
    expect(gradeToSeverity(null)).toBe("info");
    expect(gradeToSeverity(undefined)).toBe("info");
    expect(gradeToSeverity("")).toBe("info");
    expect(gradeToSeverity("Z")).toBe("info");
  });

  it("is case-insensitive", () => {
    expect(gradeToSeverity("a+")).toBe("pass");
    expect(gradeToSeverity("f")).toBe("fail");
  });
});

describe("stripHtml", () => {
  it("removes tags and decodes entities", () => {
    expect(stripHtml("<p>Use <code>Secure</code> &amp; HSTS.</p>")).toBe("Use Secure & HSTS.");
  });
  it("collapses whitespace and handles empty input", () => {
    expect(stripHtml("<p>\n   a   b\n</p>")).toBe("a b");
    expect(stripHtml(undefined)).toBe("");
    expect(stripHtml(null)).toBe("");
  });
});

describe("normalizeObservatory", () => {
  const scan = {
    scanned_at: "2026-05-23T05:59:32.767Z",
    grade: "B",
    score: 75,
    tests_failed: 2,
    tests_passed: 8,
    tests_quantity: 10,
  };
  const tests = {
    "content-security-policy": {
      name: "content-security-policy",
      title: "Content Security Policy (CSP)",
      pass: false,
      score_modifier: -25,
      score_description: "<p>CSP reporting only.</p>",
      recommendation: "<p>Implement an <a href='x'>enforced policy</a>.</p>",
      link: "/en-US/docs/Web/HTTP/CSP",
    },
    "x-frame-options": {
      name: "x-frame-options",
      title: "X-Frame-Options",
      pass: true,
      score_modifier: 5,
      score_description: "<p>XFO set.</p>",
      recommendation: "",
      link: "https://example.com/xfo",
    },
  };

  it("maps scan summary fields", () => {
    const r = normalizeObservatory(scan, tests, "example.com");
    expect(r.grade).toBe("B");
    expect(r.score).toBe(75);
    expect(r.testsPassed).toBe(8);
    expect(r.testsFailed).toBe(2);
    expect(r.testsQuantity).toBe(10);
    expect(r.scannedAt).toBe("2026-05-23T05:59:32.767Z");
  });

  it("parses per-test details, strips HTML, sorts worst-first", () => {
    const r = normalizeObservatory(scan, tests, "example.com");
    expect(r.tests).toHaveLength(2);
    // most negative score modifier comes first
    expect(r.tests[0]!.name).toBe("content-security-policy");
    expect(r.tests[0]!.scoreModifier).toBe(-25);
    expect(r.tests[0]!.reason).toBe("CSP reporting only.");
    expect(r.tests[0]!.recommendation).toBe("Implement an enforced policy.");
    expect(r.tests[1]!.title).toBe("X-Frame-Options");
    expect(r.tests[1]!.pass).toBe(true);
  });

  it("resolves relative MDN links to absolute, keeps absolute ones", () => {
    const r = normalizeObservatory(scan, tests, "example.com");
    expect(r.tests[0]!.link).toBe("https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP");
    expect(r.tests[1]!.link).toBe("https://example.com/xfo");
  });

  it("builds a details URL from the host when none is provided", () => {
    const r = normalizeObservatory(scan, tests, "example.com");
    expect(r.detailsUrl).toBe(
      "https://developer.mozilla.org/en-US/observatory/analyze?host=example.com",
    );
  });

  it("fills nulls / empty tests for missing data", () => {
    const r = normalizeObservatory(undefined, undefined, "x.de");
    expect(r.grade).toBeNull();
    expect(r.score).toBeNull();
    expect(r.tests).toEqual([]);
  });

  it("uses German standard translations when a result code is known", () => {
    const r = normalizeObservatory(
      { grade: "C", score: 50 },
      {
        csp: {
          name: "content-security-policy",
          result: "csp-not-implemented",
          pass: false,
          score_modifier: -25,
          score_description: "<p>Content Security Policy (CSP) header not implemented</p>",
          recommendation: "<p>Implement one.</p>",
          link: "/x",
        },
      },
      "example.com",
    );
    const t = r.tests[0]!;
    expect(t.title).toBe("Content Security Policy (CSP)");
    expect(t.reason).toBe("Content-Security-Policy-Header nicht implementiert.");
    expect(t.recommendation).toContain("CSP einführen");
  });

  it('treats MDN "None" recommendation as empty', () => {
    const r = normalizeObservatory(
      { grade: "A", score: 100 },
      {
        rp: {
          name: "referrer-policy",
          result: "some-unmapped-code",
          pass: true,
          score_modifier: 0,
          score_description: "<p>fine</p>",
          recommendation: "None",
          link: null,
        },
      },
      "example.com",
    );
    expect(r.tests[0]!.recommendation).toBe("");
  });
});
