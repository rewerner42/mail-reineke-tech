// sharp.reineke.tech — frontend (3 tools: E-Mail / Website / DNSSEC)
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

// Letterhead for the exported cybersecurity reports.
const REPORT_CONTACT = {
  company: "Reineke Technik GmbH",
  name: "Werner Francis Reineke",
  street: "Geseker Straße 26",
  city: "33154 Salzkotten",
  phone: "+49 (0) 5258 987-282",
  email: "wf.reineke@reineke-technik.de",
};

function reportLink(domain, check) {
  const p = new URLSearchParams({ d: domain });
  if (check) p.set("check", check);
  return `/report?${p.toString()}`;
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

/** Append a "single finding → PDF" export link to a result card. */
function addCardExport(card) {
  const checkId = card.id.replace(/^card-/, "");
  let actions = card.querySelector(".card-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "card-actions";
    card.appendChild(actions);
  }
  actions.innerHTML = currentDomain
    ? `<a class="card-export" href="${reportLink(currentDomain, checkId)}">Befund als PDF exportieren →</a>`
    : "";
}

function renderEmailResults(view, data) {
  renderCard($("#card-dmarc", view), data.dmarc, renderDmarcBody);
  renderCard($("#card-spf", view), data.spf, renderSpfBody);
  renderCard($("#card-dkim", view), data.dkim, renderDkimBody);
  renderCard($("#card-mx", view), data.mx, renderMxBody);
  renderCard($("#card-mtaSts", view), data.mtaSts, renderMtaStsBody);
  renderCard($("#card-tlsRpt", view), data.tlsRpt, renderTlsRptBody);
}

function renderDnssecResults(view, data) {
  renderCard($("#card-dnssec", view), data.dnssec, renderDnssecBody);
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
    body += `<a class="obs-link" href="${escapeHtml(d.detailsUrl)}" target="_blank" rel="noopener">Vollständigen MDN-Report öffnen →</a>`;
  }
  $("[data-body]", card).innerHTML = body;
  addCardExport(card);

  // benchmark chart (loaded once, highlights the current grade)
  if (d && d.grade) void loadBenchmark(view, d.grade);
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
    btn.textContent = "Gesamtbericht (PDF)";
    header.appendChild(btn);
  }
  btn.href = reportLink(domain, "");
}

/* ─────────────── scanning ─────────────── */
async function fetchJson(url) {
  const res = await fetch(url);
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

/* ─────────────── cybersecurity report (PDF export) ─────────────── */
// The report is grouped into three areas: one summary page, then one page each.
const REPORT_AREAS = [
  {
    title: "E-Mail-Sicherheit",
    intro:
      "Diese Prüfungen bestimmen, ob Dritte in Ihrem Namen E-Mails versenden können (Spoofing) und ob Ihre Nachrichten zuverlässig und verschlüsselt zugestellt werden. DMARC ist dabei der zentrale Schutz.",
    checks: ["dmarc", "spf", "dkim", "mx", "mtaSts", "tlsRpt"],
    gradeFrom: "dmarc",
  },
  {
    title: "Website-Sicherheit",
    intro:
      "Bewertung der HTTP-Security-Header Ihrer Website durch das MDN HTTP Observatory — Schutz vor Cross-Site-Scripting, Clickjacking und unverschlüsselten Verbindungen.",
    checks: ["observatory"],
    gradeFrom: "observatory",
  },
  {
    title: "DNSSEC",
    intro:
      "Kryptografische Absicherung Ihrer DNS-Zone gegen Manipulation wie Cache-Poisoning und DNS-Spoofing.",
    checks: ["dnssec"],
    gradeFrom: "dnssec",
  },
];

function renderObservatoryReportBody(c) {
  let body = "";
  const d = c.data;
  if (d && d.grade) {
    body += kvGrid([
      ["Score", String(d.score)],
      ["Tests bestanden", `${d.testsPassed}/${d.testsQuantity}`],
    ]);
  }
  body += renderIssues(c.issues);
  if (d && Array.isArray(d.tests) && d.tests.length) body += renderObsTests(d.tests);
  return body;
}

// Technical-detail renderer per check — reuses the same bodies as the live cards.
const REPORT_DETAIL = {
  dmarc: renderDmarcBody,
  spf: renderSpfBody,
  dkim: renderDkimBody,
  mx: renderMxBody,
  mtaSts: renderMtaStsBody,
  tlsRpt: renderTlsRptBody,
  dnssec: renderDnssecBody,
  observatory: renderObservatoryReportBody,
};

function reportBadge(c) {
  const status = c?.status ?? "info";
  return c?.grade
    ? `<span class="report-grade" data-status="${status}">${escapeHtml(c.grade)}</span>`
    : `<span class="report-grade report-grade-icon" data-status="${status}">${SEVERITY_ICON[status] ?? "•"}</span>`;
}

function reportFindingHtml(key, c) {
  const label = CHECK_LABELS[key] ?? key;
  const status = c.status ?? "info";
  const detail = (REPORT_DETAIL[key] || ((x) => renderIssues(x.issues)))(c);
  return `
    <section class="report-finding" data-status="${status}">
      <div class="report-finding-head">
        ${reportBadge(c)}
        <div class="report-finding-meta">
          <h3>${escapeHtml(label)}</h3>
          <p class="report-finding-summary">${escapeHtml(c.summary ?? "")}</p>
        </div>
      </div>
      <div class="report-finding-detail">${detail}</div>
    </section>`;
}

function reportAreaOverview(area, F) {
  const gc = F[area.gradeFrom];
  const gStatus = gc?.status ?? "info";
  const chips = area.checks
    .map((k) => {
      const c = F[k];
      if (!c) return "";
      const st = c.status ?? "info";
      const verdict = c.grade ?? SEVERITY_LABEL[st] ?? "—";
      return `<span class="report-chip" data-status="${st}">${escapeHtml(CHECK_LABELS[k] ?? k)}: ${escapeHtml(verdict)}</span>`;
    })
    .join("");
  return `
    <div class="report-area-card" data-status="${gStatus}">
      ${reportBadge(gc)}
      <div class="report-area-card-body">
        <h3>${escapeHtml(area.title)}</h3>
        <div class="report-chips">${chips}</div>
      </div>
    </div>`;
}

function buildReportHtml(domain, isSingle, singleLabel, findings) {
  const now = new Date().toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const c = REPORT_CONTACT;
  const kind = isSingle ? `Einzelbefund: ${singleLabel}` : "Cybersecurity-Report";
  const letterhead = `
    <header class="report-letterhead">
      <img src="/assets/reineke-logo.png" alt="Reineke Technik" class="report-logo" />
      <address class="report-contact">
        <strong>${c.company}</strong><br />
        ${c.name}<br />
        ${c.street} · ${c.city}<br />
        Tel. ${c.phone}<br />
        <a href="mailto:${c.email}">${c.email}</a>
      </address>
    </header>`;
  const titleBlock = `
    <div class="report-title-block">
      <p class="eyebrow">${escapeHtml(kind)}</p>
      <h1>Sicherheitsanalyse für <span class="mono">${escapeHtml(domain)}</span></h1>
      <p class="report-date">Erstellt am ${now}</p>
    </div>`;
  const footer = `<footer class="report-footer">
      Automatisch erstellt mit sharp.reineke.tech am ${now}. Die Analyse basiert auf
      öffentlich abfragbaren DNS- und HTTP-Daten zum Abrufzeitpunkt. © ${c.company}.
    </footer>`;

  if (isSingle) {
    const [key, fc] = findings[0];
    return (
      letterhead +
      titleBlock +
      `<section class="report-section report-findings">${reportFindingHtml(key, fc)}</section>` +
      footer
    );
  }

  // Full report: page 1 = three area overview blocks; then one page per area.
  const F = Object.fromEntries(findings);
  const overview = `
    <section class="report-section">
      <h2>Zusammenfassung</h2>
      <div class="report-areas">${REPORT_AREAS.map((a) => reportAreaOverview(a, F)).join("")}</div>
    </section>`;
  const areaPages = REPORT_AREAS.map((a) => {
    const findingsHtml = a.checks
      .filter((k) => F[k])
      .map((k) => reportFindingHtml(k, F[k]))
      .join("");
    return `
      <section class="report-page">
        <h2 class="report-area-title">${escapeHtml(a.title)}</h2>
        <p class="report-area-intro">${escapeHtml(a.intro)}</p>
        ${findingsHtml}
      </section>`;
  }).join("");
  return letterhead + titleBlock + overview + areaPages + footer;
}

function startReportProgress(doc, estMs) {
  doc.innerHTML = `
    <div class="report-progress">
      <p class="report-loading">Bericht wird erstellt … der Website-Scan (MDN HTTP Observatory) kann bis zu ~25 Sekunden dauern.</p>
      <div class="report-progress-track"><div class="report-progress-bar"></div></div>
    </div>`;
  const bar = doc.querySelector(".report-progress-bar");
  // Animate toward 92% over the estimate; the final 8% is filled when data lands.
  requestAnimationFrame(() => {
    bar.style.transition = `width ${estMs}ms cubic-bezier(.15,.75,.3,1)`;
    bar.style.width = "92%";
  });
  return bar;
}

function finishReportProgress(doc, bar, html) {
  if (!bar) {
    doc.innerHTML = html;
    return;
  }
  bar.style.transition = "width .35s ease-out";
  bar.style.width = "100%";
  setTimeout(() => {
    doc.innerHTML = html;
  }, 380);
}

async function renderReport() {
  const url = new URL(window.location.href);
  const domain = (url.searchParams.get("d") || "").trim();
  const check = url.searchParams.get("check") || "";
  const doc = $("[data-report-doc]");
  if (!doc) return;
  if (!domain) {
    doc.innerHTML = '<p class="report-loading">Keine Domain angegeben.</p>';
    return;
  }
  const enc = encodeURIComponent(domain);
  const isSingle = !!check;
  const slow = !isSingle || check === "observatory"; // Observatory is the slow part
  const bar = startReportProgress(doc, slow ? 25000 : 3500);
  try {
    let findings;
    if (check === "observatory") {
      const o = await fetchJson(`/api/observatory?domain=${enc}`);
      findings = [["observatory", o.observatory]];
    } else if (isSingle) {
      const e = await fetchJson(`/api/analyze?domain=${enc}`);
      if (!e[check]) throw new Error(`Unbekannter Befund: ${check}`);
      findings = [[check, e[check]]];
    } else {
      const [e, o] = await Promise.all([
        fetchJson(`/api/analyze?domain=${enc}`),
        fetchJson(`/api/observatory?domain=${enc}`).catch(() => null),
      ]);
      findings = [
        ["dmarc", e.dmarc],
        ["spf", e.spf],
        ["dkim", e.dkim],
        ["mx", e.mx],
        ["mtaSts", e.mtaSts],
        ["tlsRpt", e.tlsRpt],
        ["dnssec", e.dnssec],
      ];
      if (o?.observatory) findings.push(["observatory", o.observatory]);
    }
    const html = buildReportHtml(
      domain,
      isSingle,
      isSingle ? CHECK_LABELS[check] ?? check : "",
      findings,
    );
    finishReportProgress(doc, bar, html);
  } catch (err) {
    doc.innerHTML = `<p class="report-loading">Bericht konnte nicht erstellt werden: ${escapeHtml(
      err instanceof Error ? err.message : String(err),
    )}</p>`;
  }
}

function showReportView() {
  document.body.classList.add("is-report");
  TABS.forEach((t) => {
    views[t].hidden = true;
  });
  $("#view-report").hidden = false;
}

/* ─────────────── wire up ─────────────── */
const printBtn = $("#report-print");
if (printBtn) printBtn.addEventListener("click", () => window.print());
TABS.forEach((tab) => {
  const { form } = viewParts(tab);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("[data-domain-input]", views[tab]);
    const domain = input.value.trim();
    if (!domain) {
      setError(tab, "Bitte gib eine Domain ein.");
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
  if (window.location.pathname === "/report") {
    showReportView();
    void renderReport();
    return;
  }
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
  if (url.pathname === "/report") {
    showReportView();
    void renderReport();
    return;
  }
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
