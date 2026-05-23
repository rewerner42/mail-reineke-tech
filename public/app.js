// sharp.reineke.tech — frontend (3 tools: E-Mail / Website / DNSSEC)
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const TAB_PATH = { email: "/", website: "/website", dnssec: "/dnssec" };
const PATH_TAB = { "/": "email", "/website": "website", "/dnssec": "dnssec" };
const TABS = ["email", "website", "dnssec"];

const SEVERITY_LABEL = { pass: "OK", warn: "Hinweis", fail: "Fehler", info: "Info" };
const SEVERITY_ICON = { pass: "✓", warn: "!", fail: "✕", info: "i" };

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
    .map(
      (d) => `
        <li class="dkim-item">
          <span class="sel">${escapeHtml(d.selector)}</span>
          <span class="meta">${d.keySize ? `${d.keySize}-Bit` : ""}${d.k ? ` · k=${escapeHtml(d.k)}` : ""}${d.t?.length ? ` · t=${escapeHtml(d.t.join(":"))}` : ""}</span>
          <pre class="record-block" style="margin-top:0.5rem">${escapeHtml(d.raw)}</pre>
        </li>`,
    )
    .join("");
  return `<ul class="dkim-list">${items}</ul>${issues}`;
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
            <strong style="margin-left:.5rem">${escapeHtml(m.exchange)}</strong></div>
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
  $("[data-body]", card).innerHTML = bodyRenderer(check);
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
  if (d && d.detailsUrl) {
    body += `<a class="obs-link" href="${escapeHtml(d.detailsUrl)}" target="_blank" rel="noopener">Vollständigen MDN-Report öffnen →</a>`;
  }
  $("[data-body]", card).innerHTML = body;
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
  results.hidden = false;
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

/* ─────────────── wire up ─────────────── */
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
