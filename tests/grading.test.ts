import { describe, expect, it } from "vitest";
import { gradeToSeverity, scoreToGrade } from "../src/grading.js";
import { gradeDmarc } from "../src/analyzers/dmarc.js";
import type { DmarcRecord } from "../src/types.js";

describe("scoreToGrade", () => {
  it("maps boundary scores to the expected grades", () => {
    expect(scoreToGrade(100)).toBe("A+");
    expect(scoreToGrade(90)).toBe("A");
    expect(scoreToGrade(85)).toBe("A-");
    expect(scoreToGrade(75)).toBe("B");
    expect(scoreToGrade(65)).toBe("B-");
    expect(scoreToGrade(55)).toBe("C");
    expect(scoreToGrade(40)).toBe("D+");
    expect(scoreToGrade(35)).toBe("D");
    expect(scoreToGrade(10)).toBe("F");
    expect(scoreToGrade(0)).toBe("F");
  });
});

describe("gradeToSeverity", () => {
  it("groups grades into severities", () => {
    expect(gradeToSeverity("A+")).toBe("pass");
    expect(gradeToSeverity("B")).toBe("warn");
    expect(gradeToSeverity("C-")).toBe("warn");
    expect(gradeToSeverity("D+")).toBe("fail");
    expect(gradeToSeverity("F")).toBe("fail");
    expect(gradeToSeverity(undefined)).toBe("info");
  });
});

function rec(p?: string, extra: Partial<DmarcRecord> = {}): DmarcRecord {
  return { raw: "", version: "DMARC1", p, ...extra };
}

describe("gradeDmarc", () => {
  it("grades a full reject policy as A+", () => {
    const g = gradeDmarc(rec("reject", { rua: ["mailto:r@x.de"], pct: 100 }), 1);
    expect(g.grade).toBe("A+");
  });

  it("docks points for missing reporting", () => {
    const g = gradeDmarc(rec("reject", { pct: 100 }), 1);
    expect(g.score).toBe(90);
    expect(g.grade).toBe("A");
  });

  it("grades quarantine with reporting + pct=100 as A+ (treated as full protection)", () => {
    const g = gradeDmarc(rec("quarantine", { rua: ["mailto:r@x.de"], pct: 100 }), 1);
    expect(g.grade).toBe("A+");
  });

  it("grades p=none low (no protection)", () => {
    expect(gradeDmarc(rec("none", { rua: ["mailto:r@x.de"] }), 1).grade).toBe("D+");
  });

  it("grades missing/invalid/multiple as F", () => {
    expect(gradeDmarc(null, 0).grade).toBe("F");
    expect(gradeDmarc(rec("bogus"), 1).grade).toBe("F");
    expect(gradeDmarc(rec("reject", { rua: ["mailto:r@x.de"] }), 2).grade).toBe("F");
  });

  it("penalises partial enforcement (pct < 100)", () => {
    const g = gradeDmarc(rec("reject", { rua: ["mailto:r@x.de"], pct: 50 }), 1);
    expect(g.score).toBe(85); // 100 - round(50*0.3)=15
    expect(g.grade).toBe("A-");
  });
});
