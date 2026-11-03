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

// Domain-Kasten oben auf der Seite. "fest": die geprüfte Domain aus dem Verweis,
// OFFEN angezeigt — kein verstecktes Feld. "eingabe": ein Feld an derselben
// Stelle (ohne ?d=, etwa vom Knopf auf /pentest, oder nach „Andere Domain“).
// Grobe Vorprüfung: Was offensichtlich keine Domain ist, wird nicht als
// Tatsache angezeigt — sonst steht der Nutzer vor einer Serverablehnung ohne
// ein Feld, in dem er sie korrigieren könnte. Die verbindliche Prüfung bleibt
// serverseitig (normalizeDomain); lehnt der Server ab, schaltet der Kasten um.
const LOOKS_LIKE_DOMAIN = /^[a-z0-9.-]+\.[a-z]{2,}$/i;
// Wie der Server (WWW_PRAEFIX in src/leads/report-request.ts): Der Bericht gilt
// der Domain ohne „www.“ — angezeigt wird, wofür er tatsächlich entsteht.
const WWW_PRAEFIX = /^www\.(?=[^.]+\.)/i;
const rawDomain = (new URL(window.location.href).searchParams.get("d") || "").trim();
const domainFromUrl = LOOKS_LIKE_DOMAIN.test(rawDomain) ? rawDomain.replace(WWW_PRAEFIX, "") : "";
const box = document.querySelector("[data-b-domain-box]");
const domainName = document.querySelector("[data-b-domain]");
const domainInput = form.elements.domain; // steht über form="b-form" im Kasten, nicht im <form>
let festeDomain = "";
let modusVorErfolg = "";

function zeigeFest(domain) {
  festeDomain = domain;
  domainName.textContent = domain;
  box.dataset.modus = "fest";
}

function zeigeEingabe() {
  box.dataset.modus = "eingabe";
}

// Fehler an der Domain: Feld markieren und hinspringen — die Meldung steht am
// Knopf, das Feld auf dem Telefon eine Bildschirmhöhe darüber.
function domainFehler(msg) {
  if (box.dataset.modus !== "eingabe") {
    domainInput.value = festeDomain;
    zeigeEingabe();
  }
  domainInput.setAttribute("aria-invalid", "true");
  showErr(msg);
  domainInput.focus();
}

if (domainFromUrl) {
  zeigeFest(domainFromUrl);
} else {
  zeigeEingabe();
  // Unbrauchbaren Wert trotzdem vorbelegen — meist ein Tippfehler, kein Unsinn.
  if (rawDomain) domainInput.value = rawDomain;
}

document.querySelector("[data-b-domain-change]").addEventListener("click", () => {
  if (!domainInput.value) domainInput.value = festeDomain;
  zeigeEingabe();
  domainInput.focus();
  domainInput.select();
});
domainInput.addEventListener("input", () => domainInput.removeAttribute("aria-invalid"));

// Turnstile nachladen und rendern (nur wenn eine Marke ein Widget hinterlegt hat).
let turnstileId = null;
if (SITEKEY) {
  const host = document.querySelector("[data-turnstile]");
  host.hidden = false;
  window.onTurnstileReady = () => {
    // Unter 300 px Platz (320-px-Telefone) die kompakte Größe (150 × 140) —
    // das normale Widget ist fest 300 px breit und ragte über den Rand.
    const size = host.clientWidth < 300 ? "compact" : "normal";
    turnstileId = window.turnstile.render(host, { sitekey: SITEKEY, language: "de", size });
  };
  const s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileReady";
  s.async = true;
  s.defer = true;
  document.head.appendChild(s);
}

function turnstileZuruecksetzen() {
  if (SITEKEY && window.turnstile && turnstileId !== null) window.turnstile.reset(turnstileId);
}

document.querySelector("[data-b-again]")?.addEventListener("click", () => {
  success.hidden = true;
  form.hidden = false;
  delete box.dataset.gesperrt;
  if (modusVorErfolg === "eingabe") zeigeEingabe();
  const h = success.querySelector("h3");
  if (h) h.textContent = SUCCESS_HEADING;
  const btn = form.querySelector(".lead-submit");
  btn.classList.remove("loading");
  btn.disabled = false;
  turnstileZuruecksetzen();
  form.email.focus();
});

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  errEl.hidden = true;
  const f = form.elements;
  const domain = box.dataset.modus === "fest" ? festeDomain : domainInput.value.trim();
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
  if (!domain) return domainFehler("Bitte geben Sie die Domain an, für die Sie den Bericht möchten.");
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
      turnstileZuruecksetzen();
      const msg = data.message || "Es ist ein Fehler aufgetreten. Bitte erneut versuchen.";
      // Lehnt der Server die Domain ab, braucht der Nutzer ein Feld, um sie zu korrigieren.
      return data.code === "INVALID_DOMAIN" ? domainFehler(msg) : showErr(msg);
    }
    // Der Server formuliert die Rückmeldung — er weiß, ob gezählt wurde.
    if (data.message && successText) successText.textContent = data.message;
    if (data.code === "RATE_LIMITED") {
      const h = success.querySelector("h3");
      if (h) h.textContent = "Diesmal von Hand.";
    }
    // Ab jetzt zeigt der Kasten, wofür der Bericht entsteht — in der Schreibweise,
    // die der Server geprüft hat (aus „https://www.Firma.de/“ wird „firma.de“).
    modusVorErfolg = box.dataset.modus;
    zeigeFest(data.domain || domain);
    box.dataset.gesperrt = "";
    form.hidden = true;
    success.hidden = false;
    success.scrollIntoView({ behavior: "smooth", block: "center" });
    // Der fokussierte Knopf ist mit dem Formular verschwunden — sonst fiele der
    // Fokus auf den Seitenanfang.
    success.querySelector("h3")?.focus({ preventScroll: true });
  } catch {
    btn.classList.remove("loading");
    btn.disabled = false;
    // Ohne frisches Token scheiterte der zweite Versuch an der Sicherheitsprüfung.
    turnstileZuruecksetzen();
    showErr("Verbindungsfehler. Bitte erneut versuchen.");
  }
});
