/**
 * German "standard translations" for the MDN HTTP Observatory results.
 * Keyed by the stable `result` code each test returns. Unmapped codes fall
 * back to MDN's (stripped) English text — see parseTests in observatory.ts.
 */

export const TEST_TITLES_DE: Record<string, string> = {
  "content-security-policy": "Content Security Policy (CSP)",
  cookies: "Cookies",
  "cross-origin-resource-policy": "Cross-Origin Resource Policy (CORP)",
  "cross-origin-resource-sharing": "Cross-Origin Resource Sharing (CORS)",
  redirection: "HTTPS-Weiterleitung",
  "referrer-policy": "Referrer-Policy",
  "strict-transport-security": "HSTS (Strict-Transport-Security)",
  "subresource-integrity": "Subresource Integrity (SRI)",
  "x-content-type-options": "X-Content-Type-Options",
  "x-frame-options": "X-Frame-Options",
};

interface ResultText {
  reason: string;
  recommendation?: string;
}

export const RESULT_DE: Record<string, ResultText> = {
  // Cookies
  "cookies-not-found": { reason: "Keine Cookies erkannt." },
  "cookies-secure-with-httponly-sessions": {
    reason: "Alle Cookies nutzen das Secure-Flag, Session-Cookies zusätzlich HttpOnly.",
    recommendation: "Zusätzlich SameSite setzen.",
  },
  "cookies-secure-with-httponly-sessions-and-samesite": {
    reason:
      "Alle Cookies nutzen Secure, Session-Cookies HttpOnly, und Cross-Origin-Schutz ist per SameSite gesetzt.",
  },
  "cookies-without-secure-flag-but-protected-by-hsts": {
    reason:
      "Cookies ohne Secure-Flag gesetzt, die Übertragung über HTTP wird aber durch HSTS verhindert.",
    recommendation: "Secure-Flag setzen.",
  },
  // CORP
  "corp-implemented-with-cross-origin": {
    reason:
      "Cross-Origin Resource Policy (CORP) implementiert, erlaubt aber standardmäßig Cross-Origin-Zugriff.",
  },
  "corp-not-implemented": {
    reason: "Cross-Origin Resource Policy (CORP) nicht implementiert (Standard: cross-origin).",
  },
  // CORS
  "cross-origin-resource-sharing-not-implemented": {
    reason: "Inhalte sind nicht per Cross-Origin Resource Sharing (CORS) sichtbar.",
  },
  // CSP
  "csp-implemented-with-unsafe-inline": {
    reason:
      "Content Security Policy (CSP) unsicher implementiert — enthält 'unsafe-inline' oder data: in script-src bzw. zu weit gefasste Quellen.",
    recommendation:
      "'unsafe-inline' und data: aus script-src entfernen sowie object-src/script-src einschränken.",
  },
  "csp-implemented-with-unsafe-inline-in-style-src-only": {
    reason:
      "Content Security Policy (CSP) mit unsicheren Quellen in style-src ('unsafe-inline', data: o. Ä.).",
    recommendation: "style-src absichern: 'unsafe-inline', data: und breite Quellen entfernen.",
  },
  "csp-not-implemented": {
    reason: "Content-Security-Policy-Header nicht implementiert.",
    recommendation: "CSP einführen — siehe MDN-Dokumentation zu Content Security Policy.",
  },
  "csp-not-implemented-but-reporting-enabled": {
    reason:
      "Content Security Policy (CSP) nur im Report-Only-Modus aktiv (Content-Security-Policy-Report-Only).",
    recommendation: "Eine durchgesetzte Policy einführen — siehe MDN-Dokumentation zu CSP.",
  },
  // HSTS
  "hsts-implemented-max-age-at-least-six-months": {
    reason: "Strict-Transport-Security auf mindestens sechs Monate (15768000 s) gesetzt.",
    recommendation:
      "Preloading erwägen: preload und includeSubDomains ergänzen, max-age auf mind. 1 Jahr erhöhen.",
  },
  "hsts-not-implemented": {
    reason: "Strict-Transport-Security-Header nicht implementiert.",
    recommendation: "HSTS hinzufügen, ggf. zunächst mit kürzeren Zeiträumen (siehe hstspreload.org).",
  },
  "hsts-preloaded": { reason: "Über die HSTS-Preload-Liste vorgeladen." },
  // Redirection
  "redirection-all-redirects-preloaded": {
    reason: "Alle Weiterleitungsziele stehen in der HSTS-Preload-Liste.",
  },
  "redirection-missing": {
    reason: "Leitet nicht auf eine HTTPS-Seite weiter.",
    recommendation:
      "Zuerst auf denselben Host per HTTPS weiterleiten, dann zum endgültigen Host per HTTPS.",
  },
  "redirection-to-https": {
    reason: "Erste Weiterleitung geht per HTTPS auf denselben Host, Endziel ist HTTPS.",
  },
  // Referrer-Policy
  "referrer-policy-not-implemented": {
    reason: "Referrer-Policy-Header nicht implementiert.",
    recommendation: "Mindestens auf strict-origin-when-cross-origin setzen.",
  },
  "referrer-policy-private": {
    reason:
      "Referrer-Policy auf no-referrer, same-origin, strict-origin oder strict-origin-when-cross-origin gesetzt.",
  },
  // SRI
  "sri-implemented-and-external-scripts-loaded-securely": {
    reason: "Subresource Integrity (SRI) implementiert, alle Skripte werden sicher geladen.",
  },
  "sri-not-implemented-but-all-scripts-loaded-from-secure-origin": {
    reason:
      "Subresource Integrity (SRI) nicht implementiert, aber alle Skripte stammen von vergleichbarer Herkunft.",
    recommendation: "SRI für Bonuspunkte ergänzen.",
  },
  "sri-not-implemented-but-external-scripts-loaded-securely": {
    reason:
      "Subresource Integrity (SRI) nicht implementiert, aber alle externen Skripte werden über HTTPS geladen.",
    recommendation: "SRI für externe Skripte ergänzen.",
  },
  "sri-not-implemented-but-no-scripts-loaded": {
    reason: "Subresource Integrity (SRI) nicht nötig — die Seite enthält keine Skript-Tags.",
  },
  // X-Content-Type-Options
  "x-content-type-options-nosniff": {
    reason: "X-Content-Type-Options auf nosniff gesetzt.",
  },
  "x-content-type-options-not-implemented": {
    reason: "X-Content-Type-Options-Header nicht implementiert.",
    recommendation: "Auf nosniff setzen.",
  },
  // X-Frame-Options
  "x-frame-options-implemented-via-csp": {
    reason: "X-Frame-Options über die CSP-Direktive frame-ancestors umgesetzt.",
  },
  "x-frame-options-not-implemented": {
    reason: "X-Frame-Options-Header (XFO) nicht implementiert.",
    recommendation: "frame-ancestors per CSP umsetzen.",
  },
  "x-frame-options-sameorigin-or-deny": {
    reason: "X-Frame-Options (XFO) auf SAMEORIGIN oder DENY gesetzt.",
  },
};
