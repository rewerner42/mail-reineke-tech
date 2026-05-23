// mail.reineke.tech — frontend
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const form = $("#check-form");
const domainInput = $("#domain");
const selectorsInput = $("#selectors");
const submitBtn = form.querySelector("button[type=submit]");
const errorBanner = $("#error");
const resultsSection = $("#results");
const resultDomain = $("#result-domain");
const resultTimestamp = $("#result-timestamp");

const cards = {
  dmarc: $("#card-dmarc"),
  spf: $("#card-spf"),
  dkim: $("#card-dkim"),
  mx: $("#card-mx"),
  mtaSts: $("#card-mtaSts"),
  tlsRpt: $("#card-tlsRpt"),
  dnssec: $("#card-dnssec"),
};

const SEVERITY_LABEL = {
  pass: "OK",
  warn: "Hinweis",
  fail: "Fehler",
  info: "Info",
};

const SEVERITY_ICON = {
  pass: "✓",
  warn: "!",
  fail: "✕",
  info: "i",
};

function showError(msg) {
  errorBanner.textContent = msg;
  errorBanner.hidden = false;
}

function clearError() {
  errorBanner.hidden = true;
  errorBanner.textContent = "";
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  submitBtn.classList.toggle("loading", loading);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
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
  const dl = `<dl class="kv-grid">${kv
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
    .join("")}</dl>`;
  const raw = `<pre class="record-block">${escapeHtml(r.raw)}</pre>`;
  return `${dl}${raw}${issues}`;
}

function renderSpfBody(check) {
  const issues = renderIssues(check.issues);
  if (!check.data) return issues;
  const r = check.data;
  const kv = [];
  kv.push(["DNS-Lookups", `${r.dnsLookupCount}/10`]);
  if (r.all) {
    const allMap = { "+": "+all (gefährlich)", "-": "-all (hard fail)", "~": "~all (soft fail)", "?": "?all (neutral)" };
    kv.push(["All-Mechanismus", allMap[r.all] ?? r.all]);
  }
  kv.push(["Mechanismen", String(r.mechanisms.length)]);
  const dl = `<dl class="kv-grid">${kv
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
    .join("")}</dl>`;
  const raw = `<pre class="record-block">${escapeHtml(r.raw)}</pre>`;
  return `${dl}${raw}${issues}`;
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
          <div>
            <span class="mx-prio">Pref ${escapeHtml(String(m.preference))}</span>
            <strong style="margin-left:.5rem">${escapeHtml(m.exchange)}</strong>
          </div>
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
  const dl = kv.length
    ? `<dl class="kv-grid">${kv
        .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
        .join("")}</dl>`
    : "";
  const raw = r.dnsTxt ? `<pre class="record-block">${escapeHtml(r.dnsTxt)}</pre>` : "";
  return `${dl}${raw}${issues}`;
}

function renderTlsRptBody(check) {
  const issues = renderIssues(check.issues);
  const r = check.data;
  if (!r || !r.raw) return issues;
  const raw = `<pre class="record-block">${escapeHtml(r.raw)}</pre>`;
  return `${raw}${issues}`;
}

function renderDnssecBody(check) {
  const issues = renderIssues(check.issues);
  const r = check.data;
  if (!r) return issues;
  const kv = [
    ["Signiert", r.signed ? "ja" : "nein"],
    ["Validiert (AD)", r.authenticated ? "ja" : "nein"],
    ["DNSKEY", String(r.dnskeyCount)],
  ];
  const dl = `<dl class="kv-grid">${kv
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
    .join("")}</dl>`;
  return `${dl}${issues}`;
}

function renderCard(card, check, bodyRenderer) {
  card.dataset.status = check.status ?? "info";
  const pill = $("[data-pill]", card);
  pill.dataset.status = check.status ?? "info";
  pill.textContent = SEVERITY_LABEL[check.status] ?? "—";
  $("[data-summary]", card).textContent = check.summary ?? "";
  $("[data-body]", card).innerHTML = bodyRenderer(check);
}

async function runAnalysis(domain, selectors) {
  const params = new URLSearchParams({ domain });
  if (selectors) params.set("selectors", selectors);
  const res = await fetch(`/api/analyze?${params.toString()}`);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message ?? "Analyse fehlgeschlagen.");
  }
  return data;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();
  const domain = domainInput.value.trim();
  const selectors = selectorsInput.value.trim();
  if (!domain) {
    showError("Bitte gib eine Domain ein.");
    return;
  }

  setLoading(true);
  try {
    const data = await runAnalysis(domain, selectors);
    resultDomain.textContent = data.domain;
    resultTimestamp.textContent = `geprüft am ${new Date(data.queriedAt).toLocaleString("de-DE")}`;
    renderCard(cards.dmarc, data.dmarc, renderDmarcBody);
    renderCard(cards.spf, data.spf, renderSpfBody);
    renderCard(cards.dkim, data.dkim, renderDkimBody);
    renderCard(cards.mx, data.mx, renderMxBody);
    renderCard(cards.mtaSts, data.mtaSts, renderMtaStsBody);
    renderCard(cards.tlsRpt, data.tlsRpt, renderTlsRptBody);
    renderCard(cards.dnssec, data.dnssec, renderDnssecBody);
    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

    // update URL for shareable link
    const url = new URL(window.location.href);
    url.searchParams.set("d", data.domain);
    if (selectors) url.searchParams.set("s", selectors);
    else url.searchParams.delete("s");
    window.history.replaceState({}, "", url);
  } catch (err) {
    showError(err instanceof Error ? err.message : "Unbekannter Fehler.");
  } finally {
    setLoading(false);
  }
});

// auto-run from query params (shareable links)
(function init() {
  const url = new URL(window.location.href);
  const d = url.searchParams.get("d");
  const s = url.searchParams.get("s");
  if (d) {
    domainInput.value = d;
    if (s) selectorsInput.value = s;
    form.dispatchEvent(new Event("submit"));
  }
})();
