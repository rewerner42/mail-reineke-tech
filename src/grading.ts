import type { Severity } from "./types.js";

/**
 * Map a 0–100(+) score to an MDN-Observatory-style letter grade so DMARC and
 * DNSSEC use the same scale users already see on the Website tab.
 */
export function scoreToGrade(score: number): string {
  if (score >= 100) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 70) return "B";
  if (score >= 65) return "B-";
  if (score >= 60) return "C+";
  if (score >= 50) return "C";
  if (score >= 45) return "C-";
  if (score >= 40) return "D+";
  if (score >= 30) return "D";
  if (score >= 20) return "D-";
  return "F";
}

/** Map a letter grade to our severity scale. A → pass, B/C → warn, D/E/F → fail. */
export function gradeToSeverity(grade: string | null | undefined): Severity {
  if (!grade) return "info";
  const letter = grade.trim().charAt(0).toUpperCase();
  switch (letter) {
    case "A":
      return "pass";
    case "B":
    case "C":
      return "warn";
    case "D":
    case "E":
    case "F":
      return "fail";
    default:
      return "info";
  }
}
