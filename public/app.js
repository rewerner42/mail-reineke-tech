import { scrubUrl, scrubEvent } from "./scrub.js";
// Domain-Sicherheits-Check — frontend (3 tools: E-Mail / Website / DNSSEC)
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const TAB_PATH = { email: "/", website: "/website", dnssec: "/dnssec" };
const PATH_TAB = { "/": "email", "/website": "website", "/dnssec": "dnssec" };
const TABS = ["email", "website", "dnssec"];

const SEVERITY_LABEL = { pass: "OK", warn: "Hinweis", fail: "Fehler", info: "Info" };
const SEVERITY_ICON = { pass: "✓", warn: "!", fail: "✕", info: "i" };

const CHECK_LABELS = {
  dmarc: "DMARC",
  spf: "SPF",
  dkim: "DKIM",
  mx: "MX",
  mtaSts: "MTA-STS",
  tlsRpt: "TLS-RPT",
  dnssec: "DNSSEC",
  observatory: "Website-Security (HTTP Observatory)",
};

// Brand data injected by the Worker for non-default (white-label) brands as a
// CSP-safe <script type="application/json"> block; absent for the default brand,
// so the Reineke fallbacks below apply unchanged.
const BRAND = (() => {
  try {
    const el = document.getElementById("brand-data");
    return el ? JSON.parse(el.textContent || "{}") : {};
  } catch {
    return {};
  }
})();

// Pentest-Lead-Strecke (nur Marken mit brand.funnel, z.B. Reineke): fester
// Einordnungs-Block unter jedem Ergebnis + Verweis auf /pentest.
const FUNNEL = BRAND.funnel ?? null;

// Marken mit Lead-Strecke (FUNNEL) fuehren zum Anfrageformular; die Standardmarke
// behaelt den bisherigen Weg auf den passwortgeschuetzten Generator.
// Der `check`-Parameter entfaellt bewusst: Es wird immer der GESAMTBERICHT
// verschickt — der Server kennt keinen Einzelbefund.
function reportLink(domain) {
  const p = new URLSearchParams({ d: domain });
  return FUNNEL ? `/bericht?${p.toString()}` : `/report?${p.toString()}`;
}

const views = {
  email: $('[data-view="email"]'),
  website: $('[data-view="website"]'),
  dnssec: $('[data-view="dnssec"]'),
};
const tabLinks = $$("[data-tab-link]");

let currentTab = "email";
let currentDomain = "";
let currentSelectors = "";
const cache = { email: {}, website: {}, dnssec: {} };

/* ─────────────── helpers ─────────────── */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderIssues(issues) {
  if (!issues || issues.length === 0) return "";
  return `<ul class="issues">${issues
    .map(
      (i) => `
        <li class="issue" data-severity="${i.severity}">
          <span class="issue-icon">${SEVERITY_ICON[i.severity] ?? "•"}</span>
          <div>
            <p>${escapeHtml(i.message)}</p>
            ${i.recommendation ? `<p class="rec">→ ${escapeHtml(i.recommendation)}</p>` : ""}
          </div>
        </li>`,
    )
    .join("")}</ul>`;
}

function kvGrid(pairs) {
  return `<dl class="kv-grid">${pairs
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
    .join("")}</dl>`;
}

/* ─────────────── body renderers ─────────────── */
function renderDmarcBody(check) {
  const issues = renderIssues(check.issues);
  if (!check.data) return issues;
  const r = check.data;
  const kv = [];
  kv.push(["Policy", r.p ?? "—"]);
  if (r.sp) kv.push(["Subdomain-Policy", r.sp]);
  if (r.pct !== undefined) kv.push(["Pct", String(r.pct)]);
  if (r.adkim) kv.push(["DKIM-Alignment", r.adkim === "s" ? "strict" : "relaxed"]);
  if (r.aspf) kv.push(["SPF-Alignment", r.aspf === "s" ? "strict" : "relaxed"]);
  if (r.rua?.length) kv.push(["RUA", r.rua.join(", ")]);
  if (r.ruf?.length) kv.push(["RUF", r.ruf.join(", ")]);
  if (r.fo?.length) kv.push(["FO", r.fo.join(":")]);
  return `${kvGrid(kv)}<pre class="record-block">${escapeHtml(r.raw)}</pre>${issues}`;
}

function renderSpfBody(check) {
  const issues = renderIssues(check.issues);
  if (!check.data) return issues;
  const r = check.data;
  const kv = [["DNS-Lookups", `${r.dnsLookupCount}/10`]];
  if (r.all) {
    const allMap = { "+": "+all (gefährlich)", "-": "-all (hard fail)", "~": "~all (soft fail)", "?": "?all (neutral)" };
    kv.push(["All-Mechanismus", allMap[r.all] ?? r.all]);
  }
  kv.push(["Mechanismen", String(r.mechanisms.length)]);
  return `${kvGrid(kv)}<pre class="record-block">${escapeHtml(r.raw)}</pre>${issues}`;
}

function renderDkimBody(check) {
  const issues = renderIssues(check.issues);
  if (!check.data || check.data.length === 0) return issues;
  const items = check.data
    .map((d) => {
      const meta = `${d.keySize ? `${d.keySize}-Bit` : ""}${d.k ? ` · k=${escapeHtml(d.k)}` : ""}${d.t?.length ? ` · t=${escapeHtml(d.t.join(":"))}` : ""}`;
      // Collapsed by default — the public-key blob is long; expand on demand.
      return `
        <details class="dkim-item">
          <summary>
            <span class="sel">${escapeHtml(d.selector)}</span>
            <span class="meta">${meta}</span>
            <span class="dkim-toggle">Record</span>
          </summary>
          <pre class="record-block">${escapeHtml(d.raw)}</pre>
        </details>`;
    })
    .join("");
  return `<div class="dkim-list">${items}</div>${issues}`;
}

function renderMxBody(check) {
  const issues = renderIssues(check.issues);
  if (!check.data || check.data.length === 0) return issues;
  const items = check.data
    .map((m) => {
      const ips = [];
      if (m.ips?.a?.length) ips.push(...m.ips.a);
      if (m.ips?.aaaa?.length) ips.push(...m.ips.aaaa);
      return `
        <li class="mx-item">
          <div><span class="mx-prio">Pref ${escapeHtml(String(m.preference))}</span>
            <strong>${escapeHtml(m.exchange)}</strong></div>
          <span class="mx-ips">${ips.length ? escapeHtml(ips.join(", ")) : "keine IPs"}</span>
        </li>`;
    })
    .join("");
  return `<ul class="mx-list">${items}</ul>${issues}`;
}

function renderMtaStsBody(check) {
  const issues = renderIssues(check.issues);
  const r = check.data;
  if (!r || (!r.dnsTxt && !r.policyFetched)) return issues;
  const kv = [];
  if (r.mode) kv.push(["Modus", r.mode]);
  if (r.id) kv.push(["ID", r.id]);
  if (r.maxAge !== undefined) kv.push(["max_age", `${r.maxAge}s`]);
  if (r.mx?.length) kv.push(["MX", r.mx.join(", ")]);
  const dl = kv.length ? kvGrid(kv) : "";
  const raw = r.dnsTxt ? `<pre class="record-block">${escapeHtml(r.dnsTxt)}</pre>` : "";
  return `${dl}${raw}${issues}`;
}

function renderTlsRptBody(check) {
  const issues = renderIssues(check.issues);
  const r = check.data;
  if (!r || !r.raw) return issues;
  return `<pre class="record-block">${escapeHtml(r.raw)}</pre>${issues}`;
}

function renderDnssecBody(check) {
  const issues = renderIssues(check.issues);
  const r = check.data;
  if (!r) return issues;
  const kv = [
    ["Signiert & validiert", r.secure ? "ja" : "nein"],
    ["AD-Flag (Resolver)", r.authenticated ? "ja" : "nein"],
    ["DNSKEY-Records", String(r.dnskeyCount)],
    ["DS beim Parent", r.dsPresent ? "ja" : "nein"],
  ];
  return `${kvGrid(kv)}${issues}`;
}

/* ─────────────── card rendering ─────────────── */
function renderCard(card, check, bodyRenderer) {
  if (!card) return;
  card.dataset.status = check.status ?? "info";
  const pill = $("[data-pill]", card);
  pill.dataset.status = check.status ?? "info";
  pill.textContent = SEVERITY_LABEL[check.status] ?? "—";
  $("[data-summary]", card).textContent = check.summary ?? "";
  const inner = bodyRenderer(check);
  // Checks that carry a letter grade (DMARC, DNSSEC) get an Observatory-style
  // grade badge next to their details.
  $("[data-body]", card).innerHTML = check.grade
    ? `<div class="observatory-layout"><div class="grade-badge">${escapeHtml(check.grade)}</div><div class="grade-body">${inner}</div></div>`
    : inner;
  addCardExport(card);
}

/** Append a "request the full report" link to a result card. */
function addCardExport(card) {
  let actions = card.querySelector(".card-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "card-actions";
    card.appendChild(actions);
  }
  actions.innerHTML = currentDomain
    ? `<a class="card-export ph-no-capture" href="${reportLink(currentDomain)}">${
        FUNNEL ? "Gesamtbericht anfordern →" : "Befund als PDF exportieren →"
      }</a>`
    : "";
}

/**
 * A domain with no MX sends/receives no e-mail, so a weak/missing DMARC note is
 * not a reputation problem. Surface that context right at the DMARC grade (top
 * card) instead of leaving it buried in the MX card lower down.
 */
function maybeFlagNonSending(view, data) {
  const card = $("#card-dmarc", view);
  if (!card) return;
  const body = $("[data-body]", card);
  if (!body) return;
  const prev = body.querySelector(".context-note");
  if (prev) prev.remove(); // re-render safety
  const mxIssues = (data.mx && data.mx.issues) || [];
  const nonSending = mxIssues.some((i) => i.code === "MX_NONE" || i.code === "MX_NULL");
  if (!nonSending) return;

  // No mail ⇒ no e-mail reputation to lose. Drop the alarming DMARC "F" grade
  // letter and the "Fehler" styling; the context note below explains why. (A
  // fresh scan re-renders the card first, so a later sending domain keeps its grade.)
  const badge = body.querySelector(".grade-badge");
  if (badge) badge.remove();
  card.dataset.status = "info";
  const pill = $("[data-pill]", card);
  if (pill) {
    pill.dataset.status = "info";
    pill.textContent = SEVERITY_LABEL.info;
  }

  const note = document.createElement("div");
  note.className = "context-note";
  note.innerHTML =
    '<span class="context-note-icon" aria-hidden="true">ℹ</span>' +
    "<p><strong>Diese Domain versendet/empfängt offenbar keine E-Mails</strong> (keine MX-Einträge). " +
    "Eine fehlende oder schwache DMARC-Note ist hier kein Reputationsrisiko — zum Schutz des " +
    "Domain-Namens vor Spoofing empfehlen wir dennoch <code>p=reject</code> und SPF <code>-all</code>.</p>";
  body.insertBefore(note, body.firstChild);
}

// Fester Block unter jedem Ergebnis: was ein 30-Sekunden-Check prinzipiell
// nicht sehen kann — und dass die Folgefrage ein Penetrationstest beantwortet.
function renderScopeNote(view) {
  if (!FUNNEL) return;
  let host = view.querySelector("[data-scope-note]");
  if (!host) {
    host = document.createElement("div");
    host.className = "scope-note";
    host.setAttribute("data-scope-note", "");
    view.appendChild(host);
  }
  host.innerHTML = `
    <h3>Was dieser Check nicht sehen kann.</h3>
    <p>Diese Prüfung nutzt ausschließlich öffentlich abfragbare Daten — sie sieht, was ein
      Angreifer in dreißig Sekunden ohne Anmeldung sieht. Nicht sichtbar sind:</p>
    <ul>
      <li>alles hinter einer Anmeldung: Kundenportale, Adminoberflächen, interne Anwendungen</li>
      <li>Angriffspfade im internen Netz und im Active Directory bis zur Rechteausweitung</li>
      <li>die Geschäftslogik Ihrer Anwendungen: Rollen, Freigaben, Preise, Mandantentrennung</li>
      <li>exponierte Dienste jenseits von Web und Mail: VPN, Fernwartung, RDP, Testsysteme</li>
      <li>die Verkettung: einzeln harmlose Schwächen, die zusammen einen Weg bis zum
        Domänenadministrator ergeben</li>
    </ul>
    <p>Was hier fehlt, ist meist in Stunden behoben. Die interessantere Frage ist, was sich
      hinter der Anmeldung findet — das beantwortet ein Penetrationstest.</p>
    <a class="scope-note-link" href="${FUNNEL.pentestPath}">${escapeHtml(FUNNEL.ctaLabel)} →</a>`;
}

function renderEmailResults(view, data) {
  renderCard($("#card-dmarc", view), data.dmarc, renderDmarcBody);
  renderCard($("#card-spf", view), data.spf, renderSpfBody);
  renderCard($("#card-dkim", view), data.dkim, renderDkimBody);
  renderCard($("#card-mx", view), data.mx, renderMxBody);
  renderCard($("#card-mtaSts", view), data.mtaSts, renderMtaStsBody);
  renderCard($("#card-tlsRpt", view), data.tlsRpt, renderTlsRptBody);
  maybeFlagNonSending(view, data);
  renderScopeNote(view);
}

function renderDnssecResults(view, data) {
  renderCard($("#card-dnssec", view), data.dnssec, renderDnssecBody);
  renderScopeNote(view);
}

function renderObservatoryResults(view, data) {
  const card = $("#card-observatory", view);
  const check = data.observatory;
  const status = check.status ?? "info";
  card.classList.remove("is-loading");
  card.dataset.status = status;
  const pill = $("[data-pill]", card);
  pill.dataset.status = status;
  pill.textContent = SEVERITY_LABEL[status] ?? "—";
  $("[data-summary]", card).textContent = check.summary ?? "";
  $("[data-grade]", card).textContent = check.data?.grade ?? "–";

  let body = "";
  const d = check.data;
  if (d && d.grade) {
    body += kvGrid([
      ["Score", String(d.score)],
      ["Tests bestanden", `${d.testsPassed}/${d.testsQuantity}`],
    ]);
  }
  body += renderIssues(check.issues);
  if (d && d.tests && d.tests.length) {
    body += renderObsTests(d.tests);
  }
  if (d && d.detailsUrl) {
    // ph-no-capture: detailsUrl traegt die gepruefte Domain als host=-Parameter.
    body += `<a class="obs-link ph-no-capture" href="${escapeHtml(d.detailsUrl)}" target="_blank" rel="noopener">Vollständigen MDN-Report öffnen →</a>`;
  }
  $("[data-body]", card).innerHTML = body;
  addCardExport(card);

  // benchmark chart (loaded once, highlights the current grade)
  if (d && d.grade) void loadBenchmark(view, d.grade);
  renderScopeNote(view);
}

let benchmarkData = null; // cached global grade distribution

async function loadBenchmark(view, currentGrade) {
  const wrap = $("[data-benchmark]", view);
  const chart = $("[data-bench-chart]", view);
  if (!wrap || !chart) return;
  try {
    if (!benchmarkData) {
      const res = await fetch("/api/grade-distribution");
      const json = await res.json();
      benchmarkData = Array.isArray(json.distribution) ? json.distribution : [];
    }
    if (!benchmarkData.length) return;
    const max = Math.max(...benchmarkData.map((b) => b.count), 1);
    chart.innerHTML = benchmarkData
      .map((b) => {
        const h = Math.max(2, Math.round((b.count / max) * 100));
        const cur = b.grade === currentGrade;
        return `
          <div class="bench-col${cur ? " is-current" : ""}">
            ${cur ? '<span class="bench-current-tag">Ihre Note</span>' : ""}
            <div class="bench-bar" style="height:${h}%" title="${escapeHtml(b.grade)}: ${b.count.toLocaleString("de-DE")} Websites"></div>
            <span class="bench-label">${escapeHtml(b.grade)}</span>
          </div>`;
      })
      .join("");
    wrap.hidden = false;
  } catch {
    /* benchmark is optional — ignore failures */
  }
}

function fmtScore(n) {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`; // proper minus sign
  return "0";
}

function renderObsTests(tests) {
  const rows = tests
    .map((t) => {
      const passClass = t.pass === true ? "pass" : t.pass === false ? "fail" : "info";
      const icon = t.pass === true ? "✓" : t.pass === false ? "✕" : "–";
      const scoreClass = t.scoreModifier < 0 ? "neg" : t.scoreModifier > 0 ? "pos" : "zero";
      const rec =
        t.recommendation && t.pass === false
          ? `<p class="obs-test-rec">→ ${escapeHtml(t.recommendation)}</p>`
          : "";
      const link = t.link
        ? ` <a href="${escapeHtml(t.link)}" target="_blank" rel="noopener">MDN ↗</a>`
        : "";
      return `
        <li class="obs-test" data-pass="${passClass}">
          <div class="obs-test-head">
            <span class="obs-test-icon">${icon}</span>
            <span class="obs-test-title">${escapeHtml(t.title)}</span>
            <span class="obs-score obs-score-${scoreClass}">${escapeHtml(fmtScore(t.scoreModifier))}</span>
          </div>
          <p class="obs-test-reason">${escapeHtml(t.reason)}${link}</p>
          ${rec}
        </li>`;
    })
    .join("");
  return `<h4 class="obs-tests-title">Scoring-Details</h4><ul class="obs-tests">${rows}</ul>`;
}

function setObservatoryLoading(view) {
  const card = $("#card-observatory", view);
  card.classList.add("is-loading");
  card.dataset.status = "info";
  const pill = $("[data-pill]", card);
  pill.dataset.status = "info";
  pill.textContent = "Scan …";
  $("[data-grade]", card).textContent = "…";
  $("[data-summary]", card).textContent = "Website wird über das MDN HTTP Observatory geprüft.";
  $("[data-body]", card).innerHTML =
    '<div class="obs-loading"><span class="spinner"></span><span>Scan läuft — frische Scans dauern bis zu ~10 Sekunden.</span></div>';
}

const RENDERERS = {
  email: renderEmailResults,
  website: renderObservatoryResults,
  dnssec: renderDnssecResults,
};

/* ─────────────── per-view UI state ─────────────── */
function viewParts(tab) {
  const v = views[tab];
  return {
    view: v,
    form: $("[data-form]", v),
    btn: $("button[type=submit]", v),
    results: $("[data-results]", v),
    error: $("[data-error]", v),
  };
}

function setError(tab, msg) {
  const { error } = viewParts(tab);
  error.textContent = msg;
  error.hidden = false;
}
function clearError(tab) {
  const { error } = viewParts(tab);
  error.hidden = true;
  error.textContent = "";
}
function setLoading(tab, loading) {
  const { btn } = viewParts(tab);
  btn.disabled = loading;
  btn.classList.toggle("loading", loading);
}

function showResults(tab, data) {
  const { view, results } = viewParts(tab);
  $("[data-result-domain]", view).textContent = data.domain;
  $("[data-result-timestamp]", view).textContent = data.queriedAt
    ? `geprüft am ${new Date(data.queriedAt).toLocaleString("de-DE")}`
    : "";
  RENDERERS[tab](view, data);
  ensureReportButton(view, data.domain);
  results.hidden = false;
}

/** Add a "full cybersecurity report → PDF" button to a tab's results header. */
function ensureReportButton(view, domain) {
  const header = $(".results-header", view);
  if (!header) return;
  let btn = header.querySelector("[data-report-link]");
  if (!btn) {
    btn = document.createElement("a");
    btn.className = "btn btn-secondary btn-sm";
    btn.dataset.reportLink = "";
    btn.textContent = FUNNEL ? "Gesamtbericht anfordern" : "Gesamtbericht (PDF)";
    header.appendChild(btn);
  }
  btn.href = reportLink(domain);
  // Der Link traegt die gepruefte Domain im Query -- und ein href-ATTRIBUT
  // faellt nicht unter maskTextSelector, das nur Textknoten maskiert. Die
  // Domain stuende also im aufgezeichneten DOM.
  //
  // ph-no-capture ist rrwebs blockClass (im PostHog-Bundle nachgelesen:
  // blockClass:"ph-no-capture"): das Element wird in der Aufzeichnung
  // geblockt und von Autocapture ausgenommen. Damit verlaesst das href den
  // Browser gar nicht erst.
  btn.classList.add("ph-no-capture");
  // Preis der Blockierung: der Klick auf den wichtigsten Knopf der Seite
  // waere unsichtbar. Deshalb ein ausdrueckliches Ereignis OHNE Domain --
  // das Signal bleibt, die Daten der geprueften Organisation nicht.
  if (!btn.dataset.phWired) {
    btn.dataset.phWired = "1";
    btn.addEventListener("click", () => {
      try { window.posthog?.capture?.("bericht_angefordert"); } catch { /* egal */ }
    });
  }
}

/* ─────────────── scanning ─────────────── */
async function fetchJson(url) {
  // no-store: a security scanner must always reflect the site's CURRENT state —
  // never serve a stale grade from the browser/HTTP cache.
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? "Anfrage fehlgeschlagen.");
  return data;
}

function endpointFor(tab, domain) {
  const d = encodeURIComponent(domain);
  if (tab === "email") {
    return `/api/email?domain=${d}${currentSelectors ? `&selectors=${encodeURIComponent(currentSelectors)}` : ""}`;
  }
  if (tab === "website") return `/api/observatory?domain=${d}`;
  return `/api/dnssec?domain=${d}`;
}

async function runScan(tab, domain, { force = false } = {}) {
  clearError(tab);
  if (!force && cache[tab][domain]) {
    showResults(tab, cache[tab][domain]);
    return;
  }

  if (tab === "website") {
    // show the slow-scan placeholder immediately
    const { view, results } = viewParts(tab);
    results.hidden = false;
    $("[data-result-domain]", view).textContent = domain;
    $("[data-result-timestamp]", view).textContent = "";
    setObservatoryLoading(view);
  }

  setLoading(tab, true);
  try {
    const data = await fetchJson(endpointFor(tab, domain));
    cache[tab][domain] = data;
    showResults(tab, data);
  } catch (err) {
    setError(tab, err instanceof Error ? err.message : "Unbekannter Fehler.");
    if (tab !== "website") viewParts(tab).results.hidden = true;
  } finally {
    setLoading(tab, false);
  }
}

/* ─────────────── tabs + routing ─────────────── */
function syncDomainInputs(value) {
  $$("[data-domain-input]").forEach((inp) => {
    inp.value = value;
  });
}

function updateUrl(tab, domain, { push = false } = {}) {
  const url = new URL(window.location.href);
  url.pathname = TAB_PATH[tab];
  if (domain) url.searchParams.set("d", domain);
  else url.searchParams.delete("d");
  if (tab === "email" && currentSelectors) url.searchParams.set("s", currentSelectors);
  else url.searchParams.delete("s");
  if (push) window.history.pushState({}, "", url);
  else window.history.replaceState({}, "", url);
}

function setActiveTab(tab) {
  currentTab = tab;
  TABS.forEach((t) => {
    views[t].hidden = t !== tab;
  });
  tabLinks.forEach((a) => {
    a.classList.toggle("is-active", a.dataset.tabLink === tab);
  });
}

function switchTab(tab) {
  setActiveTab(tab);
  syncDomainInputs(currentDomain);
  updateUrl(tab, currentDomain, { push: true });
  if (currentDomain) runScan(tab, currentDomain);
}

/* ─────────────── wire up ─────────────── */
TABS.forEach((tab) => {
  const { form } = viewParts(tab);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("[data-domain-input]", views[tab]);
    const domain = input.value.trim();
    if (!domain) {
      setError(tab, "Bitte geben Sie eine Domain ein.");
      return;
    }
    currentDomain = domain;
    if (tab === "email") {
      currentSelectors = ($("#selectors", views.email)?.value ?? "").trim();
    }
    syncDomainInputs(domain);
    updateUrl(tab, domain);
    runScan(tab, domain, { force: true });
  });
});

tabLinks.forEach((a) => {
  a.addEventListener("click", (e) => {
    e.preventDefault();
    const tab = a.dataset.tabLink;
    if (tab && tab !== currentTab) switchTab(tab);
  });
});

window.addEventListener("popstate", () => {
  const tab = PATH_TAB[window.location.pathname] ?? "email";
  const url = new URL(window.location.href);
  const d = url.searchParams.get("d");
  if (d) currentDomain = d;
  setActiveTab(tab);
  syncDomainInputs(currentDomain);
  if (currentDomain) runScan(tab, currentDomain);
});

/* ─────────────── init (shareable links) ─────────────── */
(function init() {
  const url = new URL(window.location.href);
  const tab = PATH_TAB[url.pathname] ?? "email";
  const d = url.searchParams.get("d");
  const s = url.searchParams.get("s");
  if (s) currentSelectors = s;
  if (d) {
    currentDomain = d;
    syncDomainInputs(d);
    if (currentSelectors) {
      const selInput = $("#selectors", views.email);
      if (selInput) selInput.value = currentSelectors;
    }
  }
  setActiveTab(tab);
  if (currentDomain) runScan(tab, currentDomain);
})();

/* ─────────────── Einwilligung + Analyse ───────────────────────────────────
 * Opt-in fuer Marken mit eigener analytics-Konfiguration: ohne aktive
 * Zustimmung laedt nichts. Kategorien statt Alles-oder-nichts, und ein
 * Widerruf, der auch wirklich aufraeumt (Art. 7 Abs. 3 DSGVO).
 *
 * Spiegelt bewusst reineke-consent.js auf www.reineke-technik.de: gleiches
 * Speicherformat {v, granted, ts}, gleiche Alterung, gleiche Praefixliste.
 * Wer beide anfasst, soll nicht zwei Modelle im Kopf halten muessen.
 */

// NEUER Schluessel, und das ist der Punkt: wer vor dem 28.08.2026 zu
// "Cookies & Analyse-Tools" ja gesagt hat, hat NICHT zu einer
// Bildschirmaufzeichnung ja gesagt. Der alte Schluessel wird nicht gelesen und
// nicht migriert -- alle werden erneut gefragt.
const CONSENT_KEY = "rt-consent-v2";
const CONSENT_VERSION = 1;
const CONSENT_MAX_AGE_DAYS = 365;
const CATEGORIES = ["statistics"];

// Was die eingewilligten Dienste ablegen -- beim Widerruf zu entfernen.
// ph_/__ph_ sind PostHog: Cookie UND localStorage heissen
// ph_<token>_posthog und tragen eine Geraetekennung.
const STORAGE_PREFIXES = ["ph_", "__ph_", "umami", "_um"];

const ANALYTICS = BRAND.analytics ?? { umamiId: null };
const ANALYTICS_OPT_IN = Boolean(BRAND.analytics);

function readConsent() {
  try {
    const v = JSON.parse(localStorage.getItem(CONSENT_KEY));
    if (!v || v.v !== CONSENT_VERSION || !v.ts || !Array.isArray(v.granted)) return null;
    const ageDays = (Date.now() - new Date(v.ts).getTime()) / 86400000;
    return ageDays > CONSENT_MAX_AGE_DAYS ? null : v;
  } catch {
    return null;
  }
}

function writeConsent(granted) {
  try {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ v: CONSENT_VERSION, granted, ts: new Date().toISOString() }),
    );
  } catch {
    /* Speicher gesperrt -- die Wahl gilt dann nur fuer diesen Seitenaufruf */
  }
}

function hasConsent(cat) {
  const c = readConsent();
  return Boolean(c && c.granted.indexOf(cat) !== -1);
}

/** Haelt PostHog an, BEVOR aufgeraeumt wird.
 *  Ohne das schreibt die Bibliothek ihren Zustand beim Entladen der Seite
 *  zurueck -- clearTrackingState() raeumt auf, und einen Wimpernschlag
 *  spaeter steht der Schluessel wieder da. Auf www.reineke-technik.de im
 *  Live-Betrieb nachgemessen (reineke-consent.js). */
function stopTrackers() {
  const ph = window.posthog;
  if (!ph) return;
  try { ph.stopSessionRecording?.(); } catch { /* egal */ }
  try { ph.set_config?.({ persistence: "memory", disable_session_recording: true }); } catch { /* egal */ }
  try { ph.reset?.(true); } catch { /* egal */ }
}

/** Entfernt, was die Einwilligung gesetzt hat -- Cookies, localStorage
 *  UND sessionStorage (dort liegen ph_<token>_window_id und
 *  ph_<token>_primary_window_exists). */
function clearTrackingState() {
  const parts = location.hostname.split(".");
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i++) {
    const d = parts.slice(i).join(".");
    domains.push(d, "." + d);
  }
  const hit = (name) => STORAGE_PREFIXES.some((p) => name.indexOf(p) === 0);
  try {
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      if (!name || !hit(name)) return;
      domains.forEach((d) => {
        document.cookie =
          name + "=; Max-Age=0; path=/" + (d ? "; domain=" + d : "");
      });
    });
  } catch { /* egal */ }
  for (const store of [localStorage, sessionStorage]) {
    try {
      Object.keys(store)
        .filter(hit)
        .forEach((k) => store.removeItem(k));
    } catch { /* egal */ }
  }
}

// Umami — cookieless page analytics. Fuer die Reineke-Marke seit dem
// 28.08.2026 abgeschaltet (umamiId: null); die Funktion bleibt fuer Marken,
// die es noch nutzen, und laeuft sonst ins Leere.
function loadUmami() {
  if (!ANALYTICS.umamiId) return;
  if (window.__umamiLoaded) return;
  window.__umamiLoaded = true;
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://cloud.umami.is/script.js";
  s.setAttribute("data-website-id", ANALYTICS.umamiId);
  document.head.appendChild(s);
}

/* Die geprueften Ergebnisse enthalten personenbezogene Daten DRITTER:
 * DMARC- und TLS-RPT-Saetze fuehren echte Berichtsadressen
 * (rua=mailto:...), die MX-Liste nennt Mailhosts und IP-Adressen der
 * geprueften Organisation. Diese Dritten sind keine Besucher und haben in
 * nichts eingewilligt -- ihre Daten duerfen nicht im Video stehen.
 *
 * Deshalb wird der gesamte Ergebnisbereich maskiert, nicht einzelne Felder:
 * [data-results] umschliesst alle drei Ansichten (E-Mail, Website, DNSSEC).
 * Ein Selektor am Container statt an den Einzelfeldern haelt auch, wenn
 * spaeter neue Pruefungen dazukommen. maskAllInputs ist Standard, steht hier
 * aber ausdruecklich, damit niemand es fuer vergessen haelt.
 */
const REPLAY_MASK_SELECTOR = "[data-results], [data-error]";

// PostHog — der offizielle Schnipsel ist ein Inline-Skript und wuerde von
// unserer CSP blockiert; wir laden die Bibliothek deshalb als externe Datei
// und rufen init() im onload auf.
function loadPosthog() {
  if (!ANALYTICS.posthogToken) return;
  if (window.__posthogLoaded) return;
  window.__posthogLoaded = true;
  const host = ANALYTICS.posthogHost || "https://eu.i.posthog.com";
  const s = document.createElement("script");
  s.src = host + "/static/array.js";
  s.defer = true;
  s.onload = () => {
    if (!window.posthog || typeof window.posthog.init !== "function") return;
    // Ausdrueckliche Bedingung statt Verlass auf den Aufrufweg: loadTrackers()
    // haengt an ANALYTICS_OPT_IN, also daran, OB der Worker einen brand-data
    // Block eingefuegt hat -- nicht an der Einwilligung. Fuer die
    // Standardmarke laeuft loadTrackers() ohne jede Zustimmung. Dass dabei
    // nichts passiert, liegt heute allein daran, dass sie keinen
    // posthogToken hat. Darauf baut diese Zeile NICHT.
    const replay = Boolean(ANALYTICS.sessionReplay) && hasConsent("statistics");
    try {
      window.posthog.init(ANALYTICS.posthogToken, {
        api_host: host,
        person_profiles: "identified_only",
        capture_pageview: true,
        capture_pageleave: true,
        disable_session_recording: !replay,
        enable_recording_console_log: false, // Projektvorgabe ist true -- hier bewusst aus
        session_recording: {
          maskAllInputs: true,
          maskTextSelector: REPLAY_MASK_SELECTOR,
          // maskCapturedNetworkRequestFn, NICHT maskNetworkRequestFn: letzteres
          // ist veraltet und wird mit {url: …} aufgerufen, liefert also fuer
          // req.name undefined. Im Bundle nachgelesen:
          //   maskNetworkRequestFn({url:e.name})  ->  {name: i?.url}
          // Der neue Schluessel bekommt das ganze Objekt mit .name als URL.
          maskCapturedNetworkRequestFn: (req) => ({ ...req, name: scrubUrl(req.name) }),
        },
        before_send: scrubEvent,
      });
    } catch {
      /* Analyse darf die Seite nie beeintraechtigen */
    }
  };
  document.head.appendChild(s);
}

function loadTrackers() {
  loadUmami();
  loadPosthog();
}

/* ── Banner ──────────────────────────────────────────────────────────────
 * Das Markup steht statisch in index.html (kein Inline-Skript, die CSP
 * erlaubt keins). Hier wird es nur verdrahtet.
 */
function wireConsentUi() {
  const banner = $("[data-cookie-banner]");
  if (!banner) return;

  const show = () => {
    const cur = readConsent();
    CATEGORIES.forEach((c) => {
      const i = $('input[data-cat="' + c + '"]', banner);
      if (i) i.checked = Boolean(cur && cur.granted.indexOf(c) !== -1);
    });
    banner.hidden = false;
  };

  const choose = (granted) => {
    const had = (readConsent() || {}).granted || [];
    const withdrawing = had.some((c) => granted.indexOf(c) === -1);
    writeConsent(granted);
    banner.hidden = true;
    if (withdrawing) {
      // Reihenfolge ist wichtig: erst anhalten, dann raeumen, dann neu laden.
      // Die Aufzeichnung stillschweigend weiterlaufen zu lassen waere
      // schlimmer, als den Widerruf gar nicht anzubieten.
      stopTrackers();
      clearTrackingState();
      location.reload();
      return;
    }
    if (granted.length) loadTrackers();
  };

  banner.addEventListener("click", (ev) => {
    const act = ev.target?.getAttribute?.("data-act");
    if (!act) return;
    if (act === "all") return choose(CATEGORIES.slice());
    if (act === "none") return choose([]);
    if (act === "sel") {
      const granted = [];
      banner.querySelectorAll("input[data-cat]").forEach((i) => {
        if (i.checked) granted.push(i.getAttribute("data-cat"));
      });
      return choose(granted);
    }
  });

  // Widerrufs- und Aenderungsweg. Ohne ihn duerfte die
  // Datenschutzerklaerung den Widerruf nicht versprechen -- sie tut es.
  document.addEventListener("click", (ev) => {
    const t = ev.target?.closest?.("[data-consent-open]");
    if (!t) return;
    ev.preventDefault();
    show();
  });

  if (!readConsent()) show();
}

(function initConsent() {
  if (!ANALYTICS_OPT_IN) {
    // Standardmarke (Sharp): unveraendertes Opt-out-Verhalten mit dem alten
    // Schluessel. Der neue Banner bleibt hier AUS -- public/ ist von beiden
    // Marken geteilt, und sein Text nennt PostHog und die Aufzeichnung, die
    // auf dieser Marke gar nicht laufen. Ein Banner, der etwas Falsches
    // behauptet und dessen "Ablehnen" ins Leere schriebe, ist schlimmer als
    // keiner.
    // Der Fusszeilen-Link gehoert zum geteilten Markup, haette hier aber
    // keinen Listener -- er wuerde nur an den Seitenanfang springen. Weg damit.
    document.querySelectorAll("[data-consent-open]").forEach((el) => el.remove());
    let abgelehnt = false;
    try { abgelehnt = localStorage.getItem("rt-consent") === "rejected"; } catch { /* Speicher gesperrt */ }
    if (!abgelehnt) loadTrackers();
    return;
  }
  if (hasConsent("statistics")) loadTrackers();
  wireConsentUi();
})();
