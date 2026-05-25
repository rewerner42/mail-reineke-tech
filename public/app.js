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

function reportBadge(c) {
  const status = c?.status ?? "info";
  return c?.grade
    ? `<span class="report-grade" data-status="${status}">${escapeHtml(c.grade)}</span>`
    : `<span class="report-grade report-grade-icon" data-status="${status}">${SEVERITY_ICON[status] ?? "•"}</span>`;
}

// Compact technical facts per check — kept short so each area fits one print page.
function reportFacts(key, c) {
  const d = c.data;
  const f = [];
  if (key === "dmarc" && d) {
    f.push(`Policy: ${d.p ?? "—"}`);
    if (d.pct !== undefined && d.pct !== 100) f.push(`pct=${d.pct}`);
    f.push(`Reporting: ${d.rua?.length ? "aktiv" : "fehlt"}`);
    if (d.adkim || d.aspf)
      f.push(`Alignment: dkim=${d.adkim ?? "r"} / spf=${d.aspf ?? "r"}`);
  } else if (key === "spf" && d) {
    f.push(`${d.dnsLookupCount}/10 DNS-Lookups`);
    if (d.all) f.push(`${d.all}all`);
    f.push(`${d.mechanisms?.length ?? 0} Mechanismen`);
  } else if (key === "dkim" && Array.isArray(d)) {
    if (d.length === 0) f.push("keine Selektoren gefunden");
    d.forEach((s) => f.push(`${s.selector}${s.keySize ? ` (${s.keySize}-Bit)` : ""}`));
  } else if (key === "mx" && Array.isArray(d)) {
    d.forEach((m) => {
      const ips = [...(m.ips?.a ?? []), ...(m.ips?.aaaa ?? [])];
      f.push(`${m.exchange}${ips.length ? ` → ${ips.join(", ")}` : ""}`);
    });
  } else if (key === "mtaSts" && d) {
    f.push(d.mode ? `Modus: ${d.mode}` : "nicht konfiguriert");
  } else if (key === "tlsRpt" && d) {
    f.push(d.rua?.length ? `Reports an: ${d.rua.join(", ")}` : "nicht konfiguriert");
  } else if (key === "dnssec" && d) {
    f.push(`Signiert & validiert: ${d.secure ? "ja" : "nein"}`);
    f.push(`DNSKEY: ${d.dnskeyCount}`);
    f.push(`DS beim Parent: ${d.dsPresent ? "ja" : "nein"}`);
  } else if (key === "observatory" && d && d.grade) {
    f.push(`Score: ${d.score}`);
    f.push(`${d.testsPassed}/${d.testsQuantity} Tests bestanden`);
  }
  return f;
}

// Compact issue list for the report: only actionable items (skip plain "OK"),
// capped, and recommendations shown only for failures to keep each area ≤ 1 page.
function reportIssues(issues) {
  const items = (issues || []).filter((i) => i.severity !== "pass").slice(0, 3);
  if (!items.length) return "";
  return `<ul class="report-issues">${items
    .map((i) => {
      const rec =
        i.severity === "fail" && i.recommendation
          ? `<span class="rec">${escapeHtml(i.recommendation)}</span>`
          : "";
      return `<li data-severity="${i.severity}"><strong>${escapeHtml(i.message)}</strong>${rec}</li>`;
    })
    .join("")}</ul>`;
}

function reportFindingHtml(key, c) {
  const label = CHECK_LABELS[key] ?? key;
  const status = c.status ?? "info";
  const facts = reportFacts(key, c);
  const factsHtml = facts.length
    ? `<p class="report-facts">${facts.map((x) => `<span>${escapeHtml(x)}</span>`).join("")}</p>`
    : "";
  let obsTests = "";
  if (key === "observatory" && Array.isArray(c.data?.tests)) {
    const failed = c.data.tests.filter((t) => t.pass === false);
    if (failed.length) {
      obsTests = `<ul class="report-issues">${failed
        .map(
          (t) =>
            `<li data-severity="fail"><strong>${escapeHtml(t.title)} (${escapeHtml(fmtScore(t.scoreModifier))})</strong>${t.recommendation ? `<span class="rec">${escapeHtml(t.recommendation)}</span>` : ""}</li>`,
        )
        .join("")}</ul>`;
    }
  }
  return `
    <section class="report-finding" data-status="${status}">
      <div class="report-finding-head">
        ${reportBadge(c)}
        <div class="report-finding-meta">
          <h3>${escapeHtml(label)}</h3>
          <p class="report-finding-summary">${escapeHtml(c.summary ?? "")}</p>
        </div>
      </div>
      ${factsHtml}${reportIssues(c.issues)}${obsTests}
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

// Collect the actionable recommendations for an area (deduped, fail before warn).
function reportAreaRecs(area, F) {
  const recs = [];
  for (const k of area.checks) {
    const c = F[k];
    if (!c) continue;
    const label = CHECK_LABELS[k] ?? k;
    for (const i of c.issues || []) {
      if (i.severity === "fail" || i.severity === "warn") {
        recs.push({ sev: i.severity, label, text: i.recommendation || i.message });
      }
    }
    if (k === "observatory" && Array.isArray(c.data?.tests)) {
      for (const t of c.data.tests.filter((x) => x.pass === false)) {
        recs.push({ sev: "fail", label: t.title, text: t.recommendation || t.reason });
      }
    }
  }
  recs.sort((a, b) => (a.sev === "fail" ? -1 : 1) - (b.sev === "fail" ? -1 : 1));
  return recs;
}

// Trim a recommendation to ~2 printed lines, breaking on a word boundary.
function truncateRec(text, max = 165) {
  if (!text || text.length <= max) return text || "";
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()} …`;
}

// One print page per area: short intro + compact verdict table + recommendations.
function reportAreaPage(area, F) {
  const rows = area.checks
    .filter((k) => F[k])
    .map((k) => {
      const c = F[k];
      const status = c.status ?? "info";
      const verdict = c.grade ?? SEVERITY_LABEL[status] ?? "—";
      const facts = reportFacts(k, c).join(" · ");
      return `<tr>
        <td class="rt-check">${escapeHtml(CHECK_LABELS[k] ?? k)}</td>
        <td><span class="report-status" data-status="${status}">${escapeHtml(verdict)}</span></td>
        <td><span class="rt-summary">${escapeHtml(c.summary ?? "")}</span>${facts ? `<span class="rt-facts">${escapeHtml(facts)}</span>` : ""}</td>
      </tr>`;
    })
    .join("");
  const recs = reportAreaRecs(area, F);
  const recList = recs.length
    ? `<h3 class="rt-rec-title">Empfehlungen</h3>
       <ul class="report-issues">${recs
         .slice(0, 5)
         .map(
           (r) =>
             `<li data-severity="${r.sev}"><strong>${escapeHtml(r.label)}:</strong> ${escapeHtml(truncateRec(r.text))}</li>`,
         )
         .join("")}</ul>`
    : `<p class="rt-allgood">Keine offenen Punkte in diesem Bereich.</p>`;
  return `
    <section class="report-page">
      <h2 class="report-area-title">${escapeHtml(area.title)}</h2>
      <p class="report-area-intro">${escapeHtml(area.intro)}</p>
      <table class="report-detail-table">
        <thead><tr><th>Prüfung</th><th>Bewertung</th><th>Befund</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${recList}
    </section>`;
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
      Erstellt am ${now}. Die Analyse basiert auf öffentlich abfragbaren DNS- und
      HTTP-Daten zum Abrufzeitpunkt. © ${c.company}.
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
  const areaPages = REPORT_AREAS.map((a) => reportAreaPage(a, F)).join("");
  return letterhead + titleBlock + overview + areaPages + footer;
}

function startReportProgress(doc, estMs) {
  doc.innerHTML = `
    <div class="report-progress">
      <p class="report-loading">Bericht wird erstellt … Analyse, Website-Scan (MDN HTTP Observatory) und das PDF werden vorbereitet. Das kann ~30 Sekunden dauern.</p>
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

const LEAD_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function leadCaptured() {
  try {
    return sessionStorage.getItem("rt-lead") === "1";
  } catch {
    return false;
  }
}
function markLeadCaptured(email) {
  try {
    sessionStorage.setItem("rt-lead", "1");
    if (email) sessionStorage.setItem("rt-lead-email", email);
  } catch {
    /* storage unavailable — gate will simply show again */
  }
}

// E-mail + DSGVO consent gate shown before a report is generated/downloaded.
function renderLeadGate(doc, domain, onProceed) {
  const printBtn = $("#report-print");
  // Inline display beats the `.btn { display: inline-flex }` rule (which would
  // otherwise override the [hidden] attribute). Nothing to print until the report exists.
  if (printBtn) printBtn.style.display = "none";
  doc.innerHTML = `
    <div class="lead-gate">
      <p class="eyebrow">Cybersecurity-Report</p>
      <h2>Bericht anfordern</h2>
      <p class="lead-intro">Gib deine E-Mail-Adresse ein, um den Sicherheitsbericht${
        domain ? ` für <span class="mono">${escapeHtml(domain)}</span>` : ""
      } zu erstellen und herunterzuladen.</p>
      <form class="lead-form" novalidate>
        <label class="lead-field">
          <span class="lead-label">E-Mail-Adresse</span>
          <input type="email" name="email" required autocomplete="email" inputmode="email"
                 placeholder="name@unternehmen.de" />
        </label>
        <label class="lead-consent">
          <input type="checkbox" name="consent" required />
          <span>Ich willige ein, dass die <strong>Reineke Technik GmbH</strong> meine
            E-Mail-Adresse zur Bereitstellung des Berichts und zur Kontaktaufnahme
            verarbeitet. Die <a href="https://www.reineke-technik.de/datenschutz/"
            target="_blank" rel="noopener">Datenschutzerklärung</a> habe ich zur Kenntnis
            genommen. Diese Einwilligung kann ich jederzeit mit Wirkung für die Zukunft
            widerrufen.</span>
        </label>
        <p class="lead-error" data-lead-error hidden></p>
        <button type="submit" class="btn btn-primary lead-submit">
          <span class="btn-label">Bericht erstellen</span><span class="spinner"></span>
        </button>
        <p class="lead-note">Wir verwenden deine E-Mail-Adresse ausschließlich für den
          angeforderten Bericht und eine etwaige Rückfrage. Keine Weitergabe an Dritte.</p>
      </form>
    </div>`;

  const form = doc.querySelector(".lead-form");
  const errEl = form.querySelector("[data-lead-error]");
  const btn = form.querySelector(".lead-submit");
  const showErr = (m) => {
    errEl.textContent = m;
    errEl.hidden = false;
  };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEl.hidden = true;
    const email = form.email.value.trim();
    const consent = form.consent.checked;
    if (!consent) return showErr("Bitte stimme der Verarbeitung deiner E-Mail-Adresse zu.");
    if (!LEAD_EMAIL_RE.test(email)) return showErr("Bitte gib eine gültige E-Mail-Adresse ein.");
    btn.classList.add("loading");
    btn.disabled = true;
    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, domain, consent: true }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        btn.classList.remove("loading");
        btn.disabled = false;
        return showErr(data.message || "Es ist ein Fehler aufgetreten. Bitte erneut versuchen.");
      }
      markLeadCaptured(email);
      onProceed();
    } catch {
      btn.classList.remove("loading");
      btn.disabled = false;
      showErr("Verbindungsfehler. Bitte erneut versuchen.");
    }
  });
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
  // Gate: capture an e-mail + consent (once per session) before building the report.
  if (!leadCaptured()) {
    renderLeadGate(doc, domain, () => buildAndShowReport(doc, domain, check));
    return;
  }
  buildAndShowReport(doc, domain, check);
}

async function buildAndShowReport(doc, domain, check) {
  const printBtn = $("#report-print");
  if (printBtn) printBtn.style.display = "";
  const enc = encodeURIComponent(domain);
  const isSingle = !!check;
  const slow = !isSingle || check === "observatory"; // Observatory is the slow part
  // Estimate covers the scan AND the PDF render — the bar is coupled to both.
  const bar = startReportProgress(doc, slow ? 30000 : 9000);
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
    // Couple the progress bar to the PDF creation: generate it now (while the bar
    // still runs) so that when the report appears the PDF is ready for instant
    // download. Capped by a timeout so a slow/failed render never blocks the report.
    prefetchReportPdf(html, domain, check);
    await Promise.race([
      reportPdfCache.promise.catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 25000)),
    ]);
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

// Server-side PDF (Browser Rendering). The PDF is pre-generated in the background
// as soon as the report renders (prefetchReportPdf), so the download click is
// instant. Falls back to the browser print dialog if the PDF service is
// unavailable (e.g. daily Browser-Rendering limit reached).
let reportPdfCache = null; // { key, promise<Blob> }

const reportPdfKey = (domain, check) => `${domain}|${check}`;

async function fetchReportPdfBlob(html, domain, check) {
  const r = await fetch("/api/report-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, domain, check }),
  });
  if (!r.ok) throw new Error("PDF-Service nicht verfügbar");
  return r.blob();
}

// Kick off PDF generation in the background while the user reads the report.
function prefetchReportPdf(html, domain, check) {
  const key = reportPdfKey(domain, check);
  const promise = fetchReportPdfBlob(html, domain, check);
  promise.catch(() => {}); // mark handled; downloadReportPdf re-handles on await
  reportPdfCache = { key, promise };
}

function triggerBlobDownload(blob, domain, check) {
  const objUrl = URL.createObjectURL(blob);
  const safe = domain.replace(/[^a-z0-9.-]/gi, "_");
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = `${check ? `Befund-${check}-${safe}` : `Sicherheitsbericht-${safe}`}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
}

async function downloadReportPdf(btn) {
  const doc = $("[data-report-doc]");
  if (!doc || doc.querySelector(".lead-gate, .report-progress")) return; // not ready
  const url = new URL(window.location.href);
  const domain = (url.searchParams.get("d") || "report").trim();
  const check = url.searchParams.get("check") || "";
  const key = reportPdfKey(domain, check);
  btn.classList.add("loading");
  btn.disabled = true;
  try {
    let blob = null;
    // Use the background-generated PDF if it's for this exact report.
    if (reportPdfCache && reportPdfCache.key === key) {
      try {
        blob = await reportPdfCache.promise;
      } catch {
        blob = null; // prefetch failed → retry fresh below
      }
    }
    if (!blob) blob = await fetchReportPdfBlob(doc.innerHTML, domain, check);
    triggerBlobDownload(blob, domain, check);
  } catch {
    window.print(); // graceful fallback
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

/* ─────────────── wire up ─────────────── */
const printBtn = $("#report-print");
if (printBtn) printBtn.addEventListener("click", () => downloadReportPdf(printBtn));
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

/* ─────────────── Cookie-Consent + Tracker (Leadfeeder + Umami) ───────────────
 * Opt-out-Modell: Tracking läuft, sofern der Nutzer es nicht ablehnt. Der
 * Banner erscheint nur, solange noch keine Wahl getroffen wurde. */
const CONSENT_KEY = "rt-consent"; // "accepted" | "rejected"

function loadLeadfeeder() {
  if (window.__lfLoaded) return;
  window.__lfLoaded = true;
  (function (ss, ex) {
    window.ldfdr =
      window.ldfdr ||
      function () {
        (ldfdr._q = ldfdr._q || []).push([].slice.call(arguments));
      };
    (function (d, s) {
      const fs = d.getElementsByTagName(s)[0];
      function ce(src) {
        const cs = d.createElement(s);
        cs.src = src;
        cs.async = 1;
        fs.parentNode.insertBefore(cs, fs);
      }
      ce("https://sc.lfeeder.com/lftracker_v1_" + ss + (ex ? "_" + ex : "") + ".js");
    })(document, "script");
  })("bElvO732oZG8ZMqj");
}

// Umami — cookieless, privacy-friendly page analytics.
function loadUmami() {
  if (window.__umamiLoaded) return;
  window.__umamiLoaded = true;
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://cloud.umami.is/script.js";
  s.setAttribute("data-website-id", "705faf06-6f2a-4905-8605-1fee670f68b1");
  document.head.appendChild(s);
}

function loadTrackers() {
  loadLeadfeeder();
  loadUmami();
}

function readConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

(function initConsent() {
  const consent = readConsent();
  // Assume consent unless explicitly rejected.
  if (consent !== "rejected") loadTrackers();
  if (consent) return; // choice already made → no banner

  const banner = $("[data-cookie-banner]");
  if (!banner) return;
  banner.hidden = false;
  const choose = (val) => {
    try {
      localStorage.setItem(CONSENT_KEY, val);
    } catch {
      /* storage unavailable */
    }
    banner.hidden = true;
    if (val === "rejected") {
      // Best-effort: expire the Leadfeeder first-party cookie.
      document.cookie = "_lfa=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    }
  };
  $("[data-cookie-accept]", banner)?.addEventListener("click", () => choose("accepted"));
  $("[data-cookie-reject]", banner)?.addEventListener("click", () => choose("rejected"));
})();
