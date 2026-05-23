import { describe, expect, it } from "vitest";
import { gradeToSeverity, normalizeObservatory } from "../src/observatory.js";

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

describe("normalizeObservatory", () => {
  it("maps the MDN v2 response shape to our result", () => {
    const r = normalizeObservatory({
      id: 123,
      details_url: "https://developer.mozilla.org/en-US/observatory/analyze?host=x",
      scanned_at: "2026-05-23T05:59:32.767Z",
      error: null,
      grade: "B",
      score: 75,
      tests_failed: 2,
      tests_passed: 8,
      tests_quantity: 10,
    });
    expect(r.grade).toBe("B");
    expect(r.score).toBe(75);
    expect(r.testsPassed).toBe(8);
    expect(r.testsFailed).toBe(2);
    expect(r.testsQuantity).toBe(10);
    expect(r.detailsUrl).toContain("observatory/analyze");
    expect(r.scannedAt).toBe("2026-05-23T05:59:32.767Z");
  });

  it("fills nulls for missing fields", () => {
    const r = normalizeObservatory({});
    expect(r.grade).toBeNull();
    expect(r.score).toBeNull();
    expect(r.testsPassed).toBeNull();
    expect(r.detailsUrl).toBeNull();
  });
});
