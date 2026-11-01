/**
 * The complete set of results the website check can return — the report is
 * assembled from a fixed catalogue, so every possible result needs a known home.
 *
 * Source: MDN HTTP Observatory's own SCORE_TABLE (charts.js), read on 2026-10-30:
 * 77 result codes. The 12 active test names were verified against live scans of
 * sollich.com and sema-systemtechnik.de — note that MDN scores `coep` and `coop`
 * too, which the original brief's ten-id list omits.
 *
 * `art` decides where a result goes in the report:
 *   feststellung  deduction (modifier < 0) → its own catalogue text obs_<id>_<variant>
 *   positiv       bonus (modifier > 0) → the "already done well" list
 *   nur_anhang    neutral (modifier = 0) → measurement appendix only, never a finding
 */

/** Short id per Observatory test. `scan` collects results that belong to no test. */
export type ObsTestId =
  | "csp"
  | "cookies"
  | "coep"
  | "coop"
  | "cors"
  | "corp"
  | "redirection"
  | "referrer"
  | "hsts"
  | "sri"
  | "xcto"
  | "xfo"
  | "scan";

/** The 12 active tests: the name MDN returns → our short id. */
export const OBS_TEST_ID: Record<string, ObsTestId> = {
  "content-security-policy": "csp",
  cookies: "cookies",
  "cross-origin-embedder-policy": "coep",
  "cross-origin-opener-policy": "coop",
  "cross-origin-resource-sharing": "cors",
  "cross-origin-resource-policy": "corp",
  redirection: "redirection",
  "referrer-policy": "referrer",
  "strict-transport-security": "hsts",
  "subresource-integrity": "sri",
  "x-content-type-options": "xcto",
  "x-frame-options": "xfo",
};

export type ObsArt = "feststellung" | "positiv" | "nur_anhang";

export interface ObsCode {
  /** Test short id — first half of the catalogue key. */
  id: ObsTestId;
  /** Result short form — second half of the catalogue key. */
  variant: string;
  /** MDN's score change. Drives `art` and the ordering of findings. */
  modifier: number;
  art: ObsArt;
}

/** All 77 result codes. An unknown code is an error, not a fallback case. */
export const OBS_CODES: Record<string, ObsCode> = {
  // csp
  "csp-implemented-with-no-unsafe-default-src-none":
    { id: "csp", variant: "streng", modifier: 10, art: "positiv" },
  "csp-implemented-with-no-unsafe":
    { id: "csp", variant: "ohne-unsafe", modifier: 5, art: "positiv" },
  "csp-implemented-with-unsafe-inline-in-style-src-only":
    { id: "csp", variant: "unsafe-style", modifier: 0, art: "nur_anhang" },
  "csp-implemented-but-duplicate-directives":
    { id: "csp", variant: "doppelt", modifier: 0, art: "nur_anhang" },
  "csp-implemented-with-insecure-scheme-in-passive-content-only":
    { id: "csp", variant: "http-passiv", modifier: -10, art: "feststellung" },
  "csp-implemented-with-unsafe-eval":
    { id: "csp", variant: "unsafe-eval", modifier: -10, art: "feststellung" },
  "csp-implemented-with-unsafe-inline":
    { id: "csp", variant: "unsafe", modifier: -20, art: "feststellung" },
  "csp-implemented-with-insecure-scheme":
    { id: "csp", variant: "http", modifier: -20, art: "feststellung" },
  "csp-header-invalid":
    { id: "csp", variant: "ungueltig", modifier: -25, art: "feststellung" },
  "csp-not-implemented":
    { id: "csp", variant: "missing", modifier: -25, art: "feststellung" },
  "csp-not-implemented-but-reporting-enabled":
    { id: "csp", variant: "nur-report", modifier: -25, art: "feststellung" },
  // cookies
  "cookies-secure-with-httponly-sessions-and-samesite":
    { id: "cookies", variant: "vorbildlich", modifier: 5, art: "positiv" },
  "cookies-secure-with-httponly-sessions":
    { id: "cookies", variant: "ok", modifier: 0, art: "nur_anhang" },
  "cookies-not-found":
    { id: "cookies", variant: "keine", modifier: 0, art: "nur_anhang" },
  "cookies-without-secure-flag-but-protected-by-hsts":
    { id: "cookies", variant: "no-secure-hsts", modifier: -5, art: "feststellung" },
  "cookies-session-without-secure-flag-but-protected-by-hsts":
    { id: "cookies", variant: "session-no-secure-hsts", modifier: -10, art: "feststellung" },
  "cookies-without-secure-flag":
    { id: "cookies", variant: "no-secure", modifier: -20, art: "feststellung" },
  "cookies-samesite-flag-invalid":
    { id: "cookies", variant: "samesite-ungueltig", modifier: -20, art: "feststellung" },
  "cookies-anticsrf-without-samesite-flag":
    { id: "cookies", variant: "csrf-no-samesite", modifier: -20, art: "feststellung" },
  "cookies-session-without-httponly-flag":
    { id: "cookies", variant: "no-httponly", modifier: -30, art: "feststellung" },
  "cookies-session-without-secure-flag":
    { id: "cookies", variant: "session-no-secure", modifier: -40, art: "feststellung" },
  // coep
  "coep-implemented-with-require-corp":
    { id: "coep", variant: "require-corp", modifier: 10, art: "positiv" },
  "coep-implemented-with-credentialless":
    { id: "coep", variant: "credentialless", modifier: 10, art: "positiv" },
  "coep-implemented-with-unsafe-none":
    { id: "coep", variant: "unsafe-none", modifier: 0, art: "nur_anhang" },
  "coep-not-implemented":
    { id: "coep", variant: "missing", modifier: 0, art: "nur_anhang" },
  "coep-header-invalid":
    { id: "coep", variant: "ungueltig", modifier: -5, art: "feststellung" },
  // coop
  "coop-implemented-with-same-origin":
    { id: "coop", variant: "same-origin", modifier: 10, art: "positiv" },
  "coop-implemented-with-same-origin-allow-popups":
    { id: "coop", variant: "allow-popups", modifier: 10, art: "positiv" },
  "coop-implemented-with-noopener-allow-popups":
    { id: "coop", variant: "noopener", modifier: 10, art: "positiv" },
  "coop-implemented-with-unsafe-none":
    { id: "coop", variant: "unsafe-none", modifier: 0, art: "nur_anhang" },
  "coop-not-implemented":
    { id: "coop", variant: "missing", modifier: 0, art: "nur_anhang" },
  "coop-header-invalid":
    { id: "coop", variant: "ungueltig", modifier: -5, art: "feststellung" },
  // cors
  "cross-origin-resource-sharing-not-implemented":
    { id: "cors", variant: "missing", modifier: 0, art: "nur_anhang" },
  "cross-origin-resource-sharing-implemented-with-public-access":
    { id: "cors", variant: "public", modifier: 0, art: "nur_anhang" },
  "cross-origin-resource-sharing-implemented-with-restricted-access":
    { id: "cors", variant: "restricted", modifier: 0, art: "nur_anhang" },
  "cross-origin-resource-sharing-implemented-with-universal-access":
    { id: "cors", variant: "universal", modifier: -50, art: "feststellung" },
  // corp
  "corp-implemented-with-same-origin":
    { id: "corp", variant: "same-origin", modifier: 10, art: "positiv" },
  "corp-implemented-with-same-site":
    { id: "corp", variant: "same-site", modifier: 10, art: "positiv" },
  "corp-implemented-with-cross-origin":
    { id: "corp", variant: "cross-origin", modifier: 0, art: "nur_anhang" },
  "corp-not-implemented":
    { id: "corp", variant: "missing", modifier: 0, art: "nur_anhang" },
  "corp-header-invalid":
    { id: "corp", variant: "ungueltig", modifier: -5, art: "feststellung" },
  // redirection
  "redirection-all-redirects-preloaded":
    { id: "redirection", variant: "preloaded", modifier: 0, art: "nur_anhang" },
  "redirection-to-https":
    { id: "redirection", variant: "https", modifier: 0, art: "nur_anhang" },
  "redirection-not-needed-no-http":
    { id: "redirection", variant: "kein-http", modifier: 0, art: "nur_anhang" },
  "redirection-off-host-from-http":
    { id: "redirection", variant: "fremder-host", modifier: -5, art: "feststellung" },
  "redirection-not-to-https-on-initial-redirection":
    { id: "redirection", variant: "erst-http", modifier: -10, art: "feststellung" },
  "redirection-not-to-https":
    { id: "redirection", variant: "nicht-https", modifier: -20, art: "feststellung" },
  "redirection-missing":
    { id: "redirection", variant: "missing", modifier: -20, art: "feststellung" },
  "redirection-invalid-cert":
    { id: "redirection", variant: "zertifikat", modifier: -20, art: "feststellung" },
  // referrer
  "referrer-policy-private":
    { id: "referrer", variant: "privat", modifier: 5, art: "positiv" },
  "referrer-policy-not-implemented":
    { id: "referrer", variant: "missing", modifier: 0, art: "nur_anhang" },
  "referrer-policy-unsafe":
    { id: "referrer", variant: "unsafe", modifier: -5, art: "feststellung" },
  "referrer-policy-header-invalid":
    { id: "referrer", variant: "ungueltig", modifier: -5, art: "feststellung" },
  // hsts
  "hsts-preloaded":
    { id: "hsts", variant: "preloaded", modifier: 5, art: "positiv" },
  "hsts-implemented-max-age-at-least-six-months":
    { id: "hsts", variant: "ok", modifier: 0, art: "nur_anhang" },
  "hsts-implemented-max-age-less-than-six-months":
    { id: "hsts", variant: "kurz", modifier: -10, art: "feststellung" },
  "hsts-not-implemented":
    { id: "hsts", variant: "missing", modifier: -20, art: "feststellung" },
  "hsts-header-invalid":
    { id: "hsts", variant: "ungueltig", modifier: -20, art: "feststellung" },
  "hsts-not-implemented-no-https":
    { id: "hsts", variant: "kein-https", modifier: -20, art: "feststellung" },
  "hsts-invalid-cert":
    { id: "hsts", variant: "zertifikat", modifier: -20, art: "feststellung" },
  // sri
  "sri-implemented-and-all-scripts-loaded-securely":
    { id: "sri", variant: "vollstaendig", modifier: 5, art: "positiv" },
  "sri-implemented-and-external-scripts-loaded-securely":
    { id: "sri", variant: "extern-ok", modifier: 5, art: "positiv" },
  "sri-not-implemented-response-not-html":
    { id: "sri", variant: "kein-html", modifier: 0, art: "nur_anhang" },
  "sri-not-implemented-but-no-scripts-loaded":
    { id: "sri", variant: "keine-skripte", modifier: 0, art: "nur_anhang" },
  "sri-not-implemented-but-all-scripts-loaded-from-secure-origin":
    { id: "sri", variant: "eigene-quelle", modifier: 0, art: "nur_anhang" },
  "sri-not-implemented-but-external-scripts-loaded-securely":
    { id: "sri", variant: "https", modifier: -5, art: "feststellung" },
  "sri-implemented-but-external-scripts-not-loaded-securely":
    { id: "sri", variant: "teilweise-http", modifier: -20, art: "feststellung" },
  "sri-not-implemented-and-external-scripts-not-loaded-securely":
    { id: "sri", variant: "http", modifier: -50, art: "feststellung" },
  // xcto
  "x-content-type-options-nosniff":
    { id: "xcto", variant: "nosniff", modifier: 0, art: "nur_anhang" },
  "x-content-type-options-not-implemented":
    { id: "xcto", variant: "missing", modifier: -5, art: "feststellung" },
  "x-content-type-options-header-invalid":
    { id: "xcto", variant: "ungueltig", modifier: -5, art: "feststellung" },
  // xfo
  "x-frame-options-implemented-via-csp":
    { id: "xfo", variant: "per-csp", modifier: 5, art: "positiv" },
  "x-frame-options-sameorigin-or-deny":
    { id: "xfo", variant: "gesetzt", modifier: 5, art: "positiv" },
  "x-frame-options-allow-from-origin":
    { id: "xfo", variant: "allow-from", modifier: 0, art: "nur_anhang" },
  "x-frame-options-not-implemented":
    { id: "xfo", variant: "missing", modifier: -20, art: "feststellung" },
  "x-frame-options-header-invalid":
    { id: "xfo", variant: "ungueltig", modifier: -20, art: "feststellung" },
  // scan
  "html-not-parseable":
    { id: "scan", variant: "html-unlesbar", modifier: -20, art: "feststellung" },
};

/** Catalogue key for a result code. Only meaningful for `art === "feststellung"`. */
export function katalogSchluessel(c: ObsCode): string {
  return `obs_${c.id}_${c.variant}`;
}
