// Server-side builder for the branded German security report (cover → domain
// findings → recommendation+contacts → methodology). Generic & data-driven so it
// works for any domain entered in the protected report generator. Returns the
// report BODY (a sequence of <section class="page">…); the endpoint passes it to
// renderReportPdf together with the branded stylesheet (public/assets/report.css)
// and inlined logos. Layout/branding mirror the prospect reports.
//
// All brand-specific content (contacts, logos, tool URL, offer text) comes from
// the active `Brand` (src/brand.ts) so one codebase renders every white-label.

import type {
  AnalysisResponse,
  CheckIssue,
  CheckResult,
  ObservatoryResult,
  Severity,
} from "../types.js";
import type { Brand, BrandContact } from "../brand.js";

export interface ReportLogos {
  wordmark: string; // data: URI — top wordmark (cover-top, page-heads, brand-foot)
  fox: string; // data: URI — secondary/fox logo (cover-fox, brand-foot, when shown)
}

const BS = '<span class="bs">\\</span>';

const EXPLAIN = {
  dmarc:
    "DMARC legt fest, wie Empfänger mit gefälschten Absendern Ihrer Domain umgehen. Erst die Stufe „quarantine“ oder „reject“ wehrt Spoofing wirksam ab. „p=none“ ist reines Monitoring ohne Schutz.",
  dnssec:
    "DNSSEC signiert Ihre DNS-Antworten kryptografisch und schützt so vor DNS-Spoofing und Cache-Poisoning — also davor, dass Nutzer unbemerkt auf gefälschte Server umgeleitet werden.",
  observatory:
    "Der MDN HTTP Observatory bewertet die Sicherheits-Header Ihrer Website (CSP, HSTS, X-Frame-Options u. a.) — Schutz gegen Cross-Site-Scripting, Clickjacking und unverschlüsselte Verbindungen.",
};

function esc(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function gradeClass(grade?: string | null): string {
  if (!grade) return "g-na";
  const g = grade.trim().charAt(0).toUpperCase();
  const map: Record<string, string> = { A: "g-a", B: "g-b", C: "g-c", D: "g-d", E: "g-f", F: "g-f" };
  return map[g] ?? "g-na";
}

/** A/B → ok, C → warn, D/E/F/none → fail. */
function gradeSeverity(grade?: string | null): "ok" | "warn" | "fail" {
  if (!grade) return "fail";
  const g = grade.trim().charAt(0).toUpperCase();
  if (g === "A" || g === "B") return "ok";
  if (g === "C") return "warn";
  return "fail";
}

function badge(label: string, grade?: string | null, score?: number | null): string {
  const sc =
    score !== null && score !== undefined ? `<span class="badge-score">Score ${esc(score)}</span>` : "";
  return `<div class="badge ${gradeClass(grade)}"><div class="badge-label">${esc(label)}</div><div class="badge-grade">${grade ? esc(grade) : "–"}</div>${sc}</div>`;
}

const SHOWN_SEV: Severity[] = ["fail", "warn", "pass"];
function issueList(issues: CheckIssue[] | undefined): string {
  const rows = (issues ?? [])
    .filter((i) => SHOWN_SEV.includes(i.severity))
    .map((i) => {
      const rec = i.recommendation ? `<div class="rec">→ ${esc(i.recommendation)}</div>` : "";
      return `<li class="sev-${esc(i.severity)}"><span class="sev-dot"></span><div><div class="msg">${esc(i.message)}</div>${rec}</div></li>`;
    });
  return rows.length ? `<ul class="issues">${rows.join("")}</ul>` : "";
}

const SEV_LABEL: Record<string, string> = { pass: "OK", warn: "Hinweis", fail: "Mangel", info: "Info" };
function miniRow(label: string, check: CheckResult<unknown> | undefined): string {
  const st = (check?.status as string) ?? "info";
  return `<tr><td class="mr-label">${esc(label)}</td><td><span class="pill p-${esc(st)}">${SEV_LABEL[st] ?? st}</span></td><td class="mr-sum">${esc(check?.summary)}</td></tr>`;
}

function obsFailList(data: ObservatoryResult | null | undefined): string {
  const tests = (data?.tests ?? []).filter((t) => t.pass === false);
  if (!tests.length) return '<p class="ok-note">Alle geprüften Sicherheits-Header sind gesetzt.</p>';
  const items = tests.map(
    (t) =>
      `<li class="sev-fail"><span class="sev-dot"></span><div><div class="msg"><strong>${esc(t.title)}</strong> (${esc(t.scoreModifier)}): ${esc(t.reason)}</div>${t.recommendation ? `<div class="rec">→ ${esc(t.recommendation)}</div>` : ""}</div></li>`,
  );
  return `<ul class="issues">${items.join("")}</ul>`;
}

function germanDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const months = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ];
  return `${d.getUTCDate()}. ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function ccLine(label: string, val?: string): string {
  return val ? `<div class="cc-line"><span>${label}</span> ${esc(val)}</div>` : "";
}
function contactCard(c: BrandContact): string {
  const tel = esc(c.tel) + (c.mobile ? ` &middot; Mobil ${esc(c.mobile)}` : "");
  return `<div class="contact-card"><div class="cc-name">${esc(c.name)}</div><div class="cc-role">${esc(c.role)}</div><div class="cc-org">${esc(c.org)}</div><div class="cc-line"><span>E-Mail</span> ${esc(c.mail)}</div><div class="cc-line"><span>Telefon</span> ${tel}</div>${ccLine("Telefax", c.fax)}${ccLine("Adresse", c.addr)}${ccLine("Web", c.web)}</div>`;
}

function offerBlock(brand: Brand): string {
  return `<div class="offer">
    <h3>${brand.report.offerHeading}</h3>
    <p>${esc(brand.report.offerLeadIn)}</p>
    <ol>
      <li><strong>DMARC-Einführung &amp; -Härtung:</strong> begleiteter Rollout von
        <code>p=none</code> über <code>p=quarantine</code> bis <code>p=reject</code>, inkl.
        SPF-/DKIM-Alignment und Auswertung der Aggregat-Reports.</li>
      <li><strong>DNSSEC-Aktivierung:</strong> Signierung der Zonen und Hinterlegung des
        DS-Eintrags beim Registrar.</li>
      <li><strong>Website-Härtung:</strong> CSP, HSTS, X-Frame-Options, X-Content-Type-Options
        und SRI sauber gesetzt.</li>
      <li><strong>Laufendes Monitoring:</strong> kontinuierliche Überwachung und verständliche
        Berichte — jederzeit kostenfrei nachprüfbar unter ${esc(brand.report.toolUrl)}.</li>
    </ol>
  </div>`;
}

function contactsBlock(brand: Brand): string {
  const cards = brand.report.partner
    ? contactCard(brand.report.conductor) + contactCard(brand.report.partner)
    : contactCard(brand.report.conductor);
  const h = brand.report.partner ? "Ihre Ansprechpartner" : "Ihr Ansprechpartner";
  return `<h3 class="contact-h">${h}</h3><div class="contacts">${cards}</div>`;
}

function pageHead(title: string, L: ReportLogos, brand: Brand): string {
  return `<div class="page-head"><img class="ph-logo" src="${L.wordmark}" alt="${esc(brand.report.wordmarkAlt)}"><span class="ph-sep">·</span><span class="ph-title">${BS}${title}</span></div>`;
}

function foot(date: string, brand: Brand, pageNo?: number, pageTotal?: number): string {
  const lead =
    brand.report.layout === "emblem" ? "" : `Geprüft mit ${esc(brand.report.toolUrl)} · `;
  const pages = pageNo && pageTotal ? ` · Seite ${pageNo} / ${pageTotal}` : "";
  return `<div class="page-foot">${lead}Stand ${esc(date)} · ${esc(brand.report.conductor.org)} · Vertraulich${pages}</div>`;
}

function coverPage(domain: string, date: string, L: ReportLogos, brand: Brand): string {
  const emblem = brand.report.layout === "emblem";
  const c = brand.report.conductor;
  const byAddr = `${c.addr.replace(", ", " · ")} · ${c.web}`;
  const foxSrc = brand.report.showFox ? L.fox : L.wordmark;
  const kicker = `<div class="cover-kicker">${BS}Sicherheits-Analyse · E-Mail &amp; Domain</div>`;
  const h1 = `<h1>${esc(domain)}</h1>`;
  // emblem layout: headline first, kicker beneath; no separate fox in the signature band
  const title = emblem ? `${h1}\n    ${kicker}` : `${kicker}\n    ${h1}`;
  const coverFox = emblem ? "" : `\n    <img class="cover-fox" src="${foxSrc}" alt="${esc(c.org)}">`;
  return `<section class="page cover">
  <div class="cover-top"><img class="cover-wordmark" src="${L.wordmark}" alt="${esc(brand.report.wordmarkAlt)}"></div>
  <div class="cover-mid">
    ${title}
    <p class="cover-lead">Unabhängige Prüfung der digitalen Absender- und Domain-Sicherheit von
      ${esc(domain)} — DMARC, DNSSEC und Website-Sicherheit.</p>
    <ul class="cover-domains"><li><strong>${esc(domain)}</strong> — E-Mail- &amp; Domain-Sicherheit<br>
      <span class="cd-sub">Automatisierte Analyse mit ${esc(brand.report.toolUrl)}</span></li></ul>
  </div>
  <div class="cover-bottom">
    <div class="cover-by">
      <div class="cb-label">Durchgeführt &amp; erstellt von</div>
      <div class="cb-org">${esc(c.org)}</div>
      <div class="cb-partner">${esc(byAddr)}</div>
      <div class="cb-date">${esc(date)}</div>
    </div>${coverFox}
  </div>
  <div class="cover-conf">Vertraulich — nur für den internen Gebrauch der Adressaten bestimmt.</div>
</section>`;
}

function domainPage(
  domain: string,
  analyze: AnalysisResponse,
  observatory: CheckResult<ObservatoryResult>,
  date: string,
  L: ReportLogos,
  brand: Brand,
): string {
  const dm = analyze.dmarc;
  const ds = analyze.dnssec;
  const obd = observatory?.data ?? null;
  const dmGrade = dm.grade ?? "F";
  const dsGrade = ds.grade ?? "F";
  const obGrade = obd?.grade ?? null;

  const sev = [gradeSeverity(dmGrade), gradeSeverity(dsGrade), gradeSeverity(obGrade)];
  const fails = sev.filter((s) => s === "fail").length;
  const warns = sev.filter((s) => s === "warn").length;
  const need =
    fails >= 3
      ? { label: "Kritisch", cls: "kritisch" }
      : fails === 2
        ? { label: "Hoch", cls: "hoch" }
        : fails === 1
          ? { label: "Mittel", cls: "mittel" }
          : warns >= 1
            ? { label: "Niedrig", cls: "niedrig" }
            : { label: "Gering", cls: "niedrig" };

  const verdict =
    `Gesamtbild — DMARC: Note ${esc(dmGrade)}, DNSSEC: Note ${esc(dsGrade)}, Website: Note ${esc(obGrade ?? "–")}. ` +
    (fails > 0
      ? "Bei den markierten Punkten besteht Handlungsbedarf."
      : warns > 0
        ? "Solide Ausgangslage mit einzelnen Verbesserungspunkten."
        : "Durchweg solide Absicherung.");

  const dmEnforcing = dm.data?.p === "quarantine" || dm.data?.p === "reject";
  const dmRaw = dm.data?.raw;
  const recordBox = dmRaw
    ? `<div class="record"><span class="record-k">Aktueller DMARC-Eintrag</span><code>${esc(dmRaw)}</code></div>`
    : `<div class="record record-missing"><span class="record-k">DMARC-Eintrag</span><code>— kein Eintrag veröffentlicht —</code></div>`;

  const angle =
    `E-Mail- und Domain-Sicherheit schützt ${esc(domain)} davor, dass Dritte unter Ihrem Namen ` +
    `täuschend echte E-Mails versenden (Spoofing / Business E-Mail Compromise) oder Nutzer auf ` +
    `gefälschte Server umgeleitet werden. ` +
    (!dmEnforcing
      ? "Die DMARC-Durchsetzung ist derzeit unvollständig — gefälschte Mails werden nicht zuverlässig abgewiesen. "
      : "DMARC wird bereits durchgesetzt — der wichtigste Schutzschritt ist getan. ") +
    (gradeSeverity(dsGrade) === "fail"
      ? "Ohne DNSSEC sind die DNS-Antworten der Domain nicht gegen Manipulation geschützt. "
      : "") +
    (gradeSeverity(obGrade) !== "ok"
      ? "Bei den Website-Sicherheits-Headern bestehen Lücken. "
      : "") +
    "Die obenstehenden Empfehlungen schließen diese Lücken — in der Regel mit überschaubarem Aufwand.";

  const mini = [
    miniRow("SPF", analyze.spf),
    miniRow("DKIM", analyze.dkim),
    miniRow("MX (Mailserver)", analyze.mx),
    miniRow("MTA-STS", analyze.mtaSts),
    miniRow("TLS-RPT", analyze.tlsRpt),
  ].join("");

  const emblem = brand.report.layout === "emblem";
  const prio = `<span class="ph-prio prio-${need.cls}">Handlungsbedarf: ${esc(need.label)}</span>`;
  const head = emblem
    ? `<div class="page-head">
        <img class="ph-fox" src="${L.fox}" alt="">
        <span class="ph-brand">${esc(brand.shortName)}</span>
        <span class="ph-title">${BS}Sicherheits-Bericht · ${esc(domain)}</span>
        ${prio}
      </div>`
    : `<div class="page-head">
        <img class="ph-logo" src="${L.wordmark}" alt="${esc(brand.report.wordmarkAlt)}">
        <span class="ph-sep">·</span><span class="ph-title">${BS}Domain-Bericht</span>
        ${prio}
      </div>`;
  return `<section class="page domain-page">
      ${head}
      <h2 class="domain-h">${esc(domain)}</h2>
      <div class="domain-sub">Automatisierte E-Mail- &amp; Domain-Sicherheitsanalyse</div>
      <div class="domain-host">${esc(domain)} &nbsp;·&nbsp; geprüft am ${esc(date)}</div>
      <div class="verdict"><strong>Befund:</strong> ${verdict}</div>
      <div class="badges">
        ${badge("DMARC", dmGrade, dm.score)}
        ${badge("DNSSEC", dsGrade, ds.score)}
        ${badge("Website (Observatory)", obGrade, obd?.score)}
      </div>
      <div class="check">
        <h3>1 · DMARC — Schutz vor E-Mail-Identitätsdiebstahl</h3>
        ${recordBox}
        ${issueList(dm.issues)}
      </div>
      <div class="check">
        <h3>2 · DNSSEC — Schutz der DNS-Antworten</h3>
        <p class="check-sum">${esc(ds.summary)}</p>
        ${issueList(ds.issues)}
      </div>
      <div class="check">
        <h3>3 · Website-Sicherheit — HTTP Observatory (${esc(obGrade ?? "–")}, ${esc(obd?.testsPassed ?? "?")}/${esc(obd?.testsQuantity ?? "?")} bestanden)</h3>
        ${obsFailList(obd)}
      </div>
      <div class="check supporting">
        <h3>Ergänzende E-Mail-Prüfungen</h3>
        <table class="mini">${mini}</table>
      </div>
      <div class="angle"><div class="angle-k">Was das für ${esc(domain)} bedeutet</div>${angle}</div>
      ${foot(date, brand, emblem ? 1 : undefined, pageTotal(brand))}
    </section>`;
}

function empfehlungPage(domain: string, date: string, L: ReportLogos, brand: Brand): string {
  const emblem = brand.report.layout === "emblem";
  return `<section class="page summary${brand.funnel ? " summary-merged" : ""}">
  ${emblem ? "" : pageHead("Empfehlung &amp; Ansprechpartner", L, brand)}
  <h2 class="sum-h">Empfehlung für ${esc(domain)}</h2>
  <p class="sum-intro">Die auf der vorigen Seite dokumentierten Punkte lassen sich kontrolliert und
    ohne Betriebsunterbrechung schließen. So gehen wir gemeinsam vor:</p>
  ${offerBlock(brand)}
  ${nextStepBlock(brand)}
  ${contactsBlock(brand)}
  ${foot(date, brand, emblem ? 2 : undefined, pageTotal(brand))}
</section>`;
}

function methodPage(date: string, L: ReportLogos, brand: Brand): string {
  const emblem = brand.report.layout === "emblem";
  const c = brand.report.conductor;
  const bfFox = brand.report.showFox
    ? `<img class="bf-fox" src="${L.fox}" alt="${esc(c.org)}">`
    : "";
  const coBrand = brand.report.coBrandLine ? `<br>${brand.report.coBrandLine}` : "";
  const contactLine = (x: BrandContact, withTel: boolean): string =>
    `${esc(x.name)}${x.short ? ` (${esc(x.short)})` : ""} · ${esc(x.mail)}${withTel ? ` · ${esc(x.tel)}` : ""}`;
  const bfContact = brand.report.partner
    ? `${contactLine(c, false)}<br>\n        ${contactLine(brand.report.partner, true)}`
    : contactLine(c, true);
  return `<section class="page method">
  ${emblem ? "" : pageHead("Methodik &amp; Hinweise", L, brand)}
  <h2 class="sum-h">Methodik &amp; Hinweise</h2>
  <h3>Was wurde geprüft?</h3>
  <div class="method-grid">
    <div><h4>DMARC</h4><p>${EXPLAIN.dmarc}</p></div>
    <div><h4>DNSSEC</h4><p>${EXPLAIN.dnssec}</p></div>
    <div><h4>Website (HTTP Observatory)</h4><p>${EXPLAIN.observatory}</p></div>
  </div>
  <h3>Wie wurde gemessen?</h3>
  <p>Alle Werte wurden am ${esc(date)} mit dem frei zugänglichen Analyse-Tool
    <strong>${esc(brand.report.toolUrl)}</strong> von ${esc(c.short ?? c.org)} erhoben. DNS-Abfragen erfolgen über
    Cloudflare DNS-over-HTTPS (1.1.1.1); die Website-Bewertung nutzt den
    <em>MDN HTTP Observatory</em> von Mozilla. Die Noten (A+…F) liegen auf einer gemeinsamen
    Skala. Es wurden ausschließlich öffentlich abrufbare DNS- und HTTP-Informationen
    ausgewertet — keine Eingriffe, keine Anmeldungen, keine Last für die Zielsysteme.</p>
  <p class="method-note">Die Ergebnisse sind eine Momentaufnahme und können sich nach
    Konfigurationsänderungen ändern. Eine erneute Prüfung ist jederzeit kostenfrei möglich.</p>
  ${
    emblem
      ? `<div class="brandfoot">
    <img class="bf-emblem" src="${L.wordmark}" alt="${esc(brand.report.wordmarkAlt)}">
    <div class="bf-body">
      <div class="bf-org">${esc(c.org)}</div>
      <div class="bf-tag">Analyse durchgeführt &amp; erstellt · E-Mail- &amp; Domain-Sicherheit · ${esc(brand.report.toolUrl)}${coBrand}</div>
      <div class="bf-contact">${bfContact}</div>
    </div>
  </div>
  ${foot(date, brand, 3, pageTotal(brand))}`
      : `<div class="brandfoot">
    ${bfFox}
    <div class="bf-body">
      <div class="bf-org">${esc(c.org)}</div>
      <div class="bf-tag">Analyse durchgeführt &amp; erstellt · E-Mail- &amp; Domain-Sicherheit · ${esc(brand.report.toolUrl)}${coBrand}</div>
      <div class="bf-contact">${bfContact}</div>
    </div>
    <img class="bf-wordmark" src="${L.wordmark}" alt="${esc(brand.report.wordmarkAlt)}">
  </div>`
  }
</section>`;
}

function pageTotal(_brand: Brand): number {
  return 3; // Deckblatt + 3 nummerierte Seiten
}

// ─── Block "Der nächste Schritt" (nur brand.funnel) ──────────────────────────
// Steht seit 2026-08-04 auf der Empfehlungsseite statt auf einer eigenen Seite:
// der Bericht bleibt bei vier Seiten und die Kontaktkarte erscheint nur einmal.
function nextStepBlock(brand: Brand): string {
  const f = brand.funnel;
  if (!f) return "";
  const pentestUrl = `${brand.report.toolUrl}${f.pentestPath}`;
  return `<div class="next-step">
    <h3>Der nächste Schritt — Penetrationstest</h3>
    <p>Dieser Bericht zeigt, was ein Angreifer in dreißig Sekunden ohne Anmeldung sieht. Die
      Folgefrage beantwortet ein Penetrationstest: Was findet jemand, der dreißig Stunden
      investiert, sich anmeldet und Schwachstellen zu Angriffspfaden verkettet?</p>
    <div class="method-grid ns-grid">
      <div><h4>Extern</h4><p>Perimeter und exponierte Dienste.</p></div>
      <div><h4>Intern / Active Directory</h4><p>AD-Härtung, Rechteausweitung.</p></div>
      <div><h4>Web-Applikation</h4><p>Anwendungen und Portale.</p></div>
    </div>
    <ol class="ns-steps">
      <li><strong>Scoping</strong> — Ziele, Systeme und Testtiefe festlegen, Zeitfenster
        betriebsschonend abstimmen.</li>
      <li><strong>Test</strong> — manuell und mit eigenen Tools, jeder Schritt nachvollziehbar
        dokumentiert.</li>
      <li><strong>Report &amp; Besprechung</strong> — priorisierte Findings, konkrete
        Behebungsempfehlungen.</li>
      <li><strong>Retest</strong> — nach Ihrer Nachbesserung bestätigen wir die Wirksamkeit.</li>
    </ol>
    <p class="ns-ref">Umfang, Ablauf und Anfrage: <strong>${esc(pentestUrl)}</strong>
      &nbsp;·&nbsp; <a href="${esc(f.bookingUrl)}">Termin direkt buchen</a></p>
  </div>`;
}

/** Build the full report body (sections). Pass the scan results + active brand. */
export function buildReportBody(
  domain: string,
  analyze: AnalysisResponse,
  observatory: CheckResult<ObservatoryResult>,
  logos: ReportLogos,
  brand: Brand,
): string {
  const date = germanDate(analyze.queriedAt);
  const sections =
    coverPage(domain, date, logos, brand) +
    domainPage(domain, analyze, observatory, date, logos, brand) +
    empfehlungPage(domain, date, logos, brand) +
    methodPage(date, logos, brand);
  // Wrap only the emblem layout so the default output stays byte-identical.
  return brand.report.layout === "emblem"
    ? `<div class="layout-emblem">${sections}</div>`
    : sections;
}
