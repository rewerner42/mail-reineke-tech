import type {
  CheckIssue,
  CheckResult,
  ObservatoryResult,
  ObservatoryTest,
  Severity,
} from "./types.js";

// The v2 "analyze" endpoint returns the per-test scoring breakdown (the POST
// "scan" endpoint only returns the grade summary).
const OBSERVATORY_API = "https://observatory-api.mdn.mozilla.net/api/v2/analyze";
const MDN_BASE = "https://developer.mozilla.org";
const SCAN_TIMEOUT_MS = 20000; // fresh scans take ~10s; allow headroom

interface ApiTest {
  name?: string;
  title?: string;
  pass?: boolean | null;
  score_modifier?: number;
  score_description?: string;
  recommendation?: string;
  link?: string;
}

interface ApiScan {
  scanned_at?: string;
  start_time?: string;
  error?: string | null;
  grade?: string | null;
  score?: number | null;
  tests_failed?: number;
  tests_passed?: number;
  tests_quantity?: number;
  details_url?: string;
}

interface AnalyzeResponse {
  scan?: ApiScan;
  tests?: Record<string, ApiTest>;
  error?: string | null;
  message?: string;
}

/** Map an MDN Observatory letter grade to our severity scale. */
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

/** Strip HTML tags + decode common entities so MDN's rich text renders as plain text. */
export function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

function parseTests(tests: Record<string, ApiTest> | undefined): ObservatoryTest[] {
  if (!tests || typeof tests !== "object") return [];
  return Object.values(tests)
    .map((t) => ({
      name: t.name ?? "",
      title: t.title ?? t.name ?? "",
      pass: t.pass ?? null,
      scoreModifier: t.score_modifier ?? 0,
      reason: stripHtml(t.score_description),
      recommendation: stripHtml(t.recommendation),
      link: t.link ? (/^https?:/i.test(t.link) ? t.link : `${MDN_BASE}${t.link}`) : null,
    }))
    // worst (most negative score modifier) first, so failures surface at the top
    .sort((a, b) => a.scoreModifier - b.scoreModifier);
}

export function normalizeObservatory(
  scan: ApiScan | undefined,
  tests: Record<string, ApiTest> | undefined,
  host: string,
): ObservatoryResult {
  return {
    grade: scan?.grade ?? null,
    score: scan?.score ?? null,
    testsPassed: scan?.tests_passed ?? null,
    testsFailed: scan?.tests_failed ?? null,
    testsQuantity: scan?.tests_quantity ?? null,
    scannedAt: scan?.scanned_at ?? scan?.start_time ?? null,
    detailsUrl:
      scan?.details_url ??
      `${MDN_BASE}/en-US/observatory/analyze?host=${encodeURIComponent(host)}`,
    tests: parseTests(tests),
  };
}

function emptyResult(host: string): ObservatoryResult {
  return {
    grade: null,
    score: null,
    testsPassed: null,
    testsFailed: null,
    testsQuantity: null,
    scannedAt: null,
    detailsUrl: `${MDN_BASE}/en-US/observatory/analyze?host=${encodeURIComponent(host)}`,
    tests: [],
  };
}

export async function analyzeObservatory(
  host: string,
): Promise<CheckResult<ObservatoryResult>> {
  const issues: CheckIssue[] = [];
  const url = `${OBSERVATORY_API}?host=${encodeURIComponent(host)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);

  let body: AnalyzeResponse;
  try {
    const r = await fetch(url, { signal: controller.signal });
    body = (await r.json()) as AnalyzeResponse;
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      status: "info",
      summary: aborted ? "Observatory-Scan-Timeout" : "Observatory nicht erreichbar",
      issues: [
        {
          severity: "info",
          code: aborted ? "OBS_TIMEOUT" : "OBS_UNREACHABLE",
          message: aborted
            ? "Der MDN-Observatory-Scan hat zu lange gedauert. Bitte später erneut versuchen."
            : `MDN Observatory nicht erreichbar: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      data: emptyResult(host),
    };
  } finally {
    clearTimeout(timer);
  }

  const scanError = body.error ?? body.scan?.error ?? null;
  if (scanError || !body.scan) {
    const detail = body.message ?? scanError ?? "kein Ergebnis";
    const transient = /down|timeout|timed out|unreachable/i.test(detail);
    return {
      status: "info",
      summary: "Observatory-Scan nicht möglich",
      issues: [
        {
          severity: "info",
          code: "OBS_SCAN_ERROR",
          message: `MDN Observatory konnte ${host} nicht scannen: ${detail}.`,
          recommendation: transient
            ? `Der MDN-Scanner hat die Website kurzzeitig nicht erreicht. Bitte die Analyse in einem Moment erneut starten. Falls es bestehen bleibt: erreichbare HTTPS-Website unter https://${host} vorhanden?`
            : "Das HTTP Observatory prüft eine öffentlich erreichbare HTTPS-Website. Reine Sender- oder Mail-Domains ohne Website liefern hier kein Ergebnis.",
        },
      ],
      data: emptyResult(host),
    };
  }

  const data = normalizeObservatory(body.scan, body.tests, host);
  const severity = gradeToSeverity(data.grade);

  if (data.grade) {
    const failedNote =
      data.testsFailed && data.testsFailed > 0
        ? ` ${data.testsFailed} von ${data.testsQuantity} Tests nicht bestanden.`
        : " Alle Tests bestanden.";
    issues.push({
      severity,
      code: `OBS_GRADE_${data.grade.replace(/[^A-Z]/gi, "").toUpperCase() || "NA"}`,
      message: `MDN HTTP Observatory bewertet die Website mit Note ${data.grade} (Score ${data.score}).${failedNote}`,
    });
  }

  return {
    status: data.grade ? severity : "info",
    summary: data.grade ? `Note ${data.grade} (Score ${data.score})` : "Kein Observatory-Ergebnis",
    issues,
    data,
  };
}
