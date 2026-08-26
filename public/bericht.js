// /bericht — Berichtsanfrage → /api/report-request.
// Sie-Form, fail-open: eine klare Fehlermeldung, aber niemals ein stiller Absturz.
const form = document.querySelector(".pt-form");
// Sitekey kommt aus dem Brand-Datenblock, den der Worker injiziert.
const BRAND = (() => {
  try {
    const el = document.getElementById("brand-data");
    return el ? JSON.parse(el.textContent || "{}") : {};
  } catch {
    return {};
  }
})();
const SITEKEY = BRAND.funnel && BRAND.funnel.turnstileSiteKey;
const errEl = document.querySelector("[data-b-error]");
const success = document.querySelector("[data-b-success]");
const successText = document.querySelector("[data-b-success-text]");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SUCCESS_HEADING = success?.querySelector("h3")?.textContent ?? "";

function showErr(msg) {
  errEl.textContent = msg;
  errEl.hidden = false;
}

// Geprüfte Domain aus dem Verweis übernehmen und OFFEN anzeigen — kein
// verstecktes Feld. Fehlt sie, tritt ein Eingabefeld an ihre Stelle.
// Grobe Vorprüfung: Was offensichtlich keine Domain ist, wird nicht als
// Tatsache angezeigt — sonst steht der Nutzer vor einer Serverablehnung ohne
// ein Feld, in dem er sie korrigieren könnte. Die verbindliche Prüfung bleibt
// serverseitig (normalizeDomain).
const LOOKS_LIKE_DOMAIN = /^[a-z0-9.-]+\.[a-z]{2,}$/i;
const rawDomain = (new URL(window.location.href).searchParams.get("d") || "").trim();
const domainFromUrl = LOOKS_LIKE_DOMAIN.test(rawDomain) ? rawDomain : "";
const domainField = document.querySelector("[data-b-domain-field]");
if (domainFromUrl) {
  document.querySelector("[data-b-domain]").textContent = domainFromUrl;
  document.querySelector("[data-b-for]").hidden = false;
} else {
  domainField.hidden = false;
  // Unbrauchbaren Wert trotzdem vorbelegen — meist ein Tippfehler, kein Unsinn.
  if (rawDomain) form.elements.domain.value = rawDomain;
}

// Turnstile nachladen und rendern (nur wenn eine Marke ein Widget hinterlegt hat).
let turnstileId = null;
if (SITEKEY) {
  const host = document.querySelector("[data-turnstile]");
  host.hidden = false;
  window.onTurnstileReady = () => {
    turnstileId = window.turnstile.render(host, { sitekey: SITEKEY, language: "de" });
  };
  const s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileReady";
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}

document.querySelector("[data-b-again]")?.addEventListener("click", () => {
  success.hidden = true;
  form.hidden = false;
  const h = success.querySelector("h3");
  if (h) h.textContent = SUCCESS_HEADING;
  const btn = form.querySelector(".lead-submit");
  btn.classList.remove("loading");
  btn.disabled = false;
  if (SITEKEY && window.turnstile && turnstileId !== null) window.turnstile.reset(turnstileId);
  form.email.focus();
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  errEl.hidden = true;
  const f = form.elements;
  const domain = domainFromUrl || (f.domain ? f.domain.value.trim() : "");
  const payload = {
    domain,
    name: f.name.value.trim(),
    email: f.email.value.trim(),
    company: f.company.value.trim(),
    phone: f.phone.value.trim(),
    contactConsent: f.contactConsent.checked,
  };
  if (SITEKEY) {
    const token = window.turnstile && turnstileId !== null ? window.turnstile.getResponse(turnstileId) : "";
    if (!token) return showErr("Bitte warten Sie kurz, bis die Sicherheitsprüfung abgeschlossen ist.");
    payload["cf-turnstile-response"] = token;
  }
  if (!domain) return showErr("Bitte geben Sie die Domain an, für die Sie den Bericht möchten.");
  if (!payload.name) return showErr("Bitte geben Sie Ihren Namen an.");
  if (!EMAIL_RE.test(payload.email)) return showErr("Bitte geben Sie eine gültige E-Mail-Adresse ein.");

  const btn = form.querySelector(".lead-submit");
  btn.classList.add("loading");
  btn.disabled = true;
  try {
    const r = await fetch("/api/report-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.ok) {
      btn.classList.remove("loading");
      btn.disabled = false;
      if (SITEKEY && window.turnstile && turnstileId !== null) window.turnstile.reset(turnstileId);
      return showErr(data.message || "Es ist ein Fehler aufgetreten. Bitte erneut versuchen.");
    }
    // Der Server formuliert die Rückmeldung — er weiß, ob gezählt wurde.
    if (data.message && successText) successText.textContent = data.message;
    if (data.code === "RATE_LIMITED") {
      const h = success.querySelector("h3");
      if (h) h.textContent = "Diesmal von Hand.";
    }
    form.hidden = true;
    success.hidden = false;
    success.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch {
    btn.classList.remove("loading");
    btn.disabled = false;
    showErr("Verbindungsfehler. Bitte erneut versuchen.");
  }
});
