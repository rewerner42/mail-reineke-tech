// Server-side builder for the branded German security report (cover → domain
// findings → recommendation+contacts → methodology). Generic & data-driven so it
// works for any domain entered in the protected report generator. Returns the
// report BODY (a sequence of <section class="page">…); the endpoint passes it to
// renderReportPdf together with the branded stylesheet (public/assets/report.css)
// and inlined logos. Layout/branding mirror the prospect reports.

import type {
  AnalysisResponse,
  CheckIssue,
  CheckResult,
  ObservatoryResult,
  Severity,
} from "../types.js";

export interface ReportLogos {
  sharp: string; // data: URI (PNG wordmark)
  reineke: string; // data: URI (SVG fox + wordmark)
}

const REINEKE = {
  name: "Werner Reineke",
  role: "Geschäftsführer",
  org: "Reineke Technik GmbH",
  mail: "wf.reineke@reineke-technik.de",
  tel: "+49 172 2872390",
  mobile: "",
  addr: "Geseker Straße 26, 33154 Salzkotten",
  web: "www.reineke-technik.de",
};
const SHARP = {
  name: "Theo Müller",
  role: "Verkaufsleiter Direktvertrieb",
  org: "Sharp Business Systems Deutschland GmbH",
  mail: "Theo.Mueller@sharp.eu",
  tel: "+49 30 263 44 838",
  mobile: "+49 173 778 19 17",
  addr: "Fritschestraße 27/28, 10585 Berlin",
  web: "www.sharp.de",
};

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
function contactCard(c: typeof REINEKE): string {
  const tel = esc(c.tel) + (c.mobile ? ` &middot; Mobil ${esc(c.mobile)}` : "");
  return `<div class="contact-card"><div class="cc-name">${esc(c.name)}</div><div class="cc-role">${esc(c.role)}</div><div class="cc-org">${esc(c.org)}</div><div class="cc-line"><span>E-Mail</span> ${esc(c.mail)}</div><div class="cc-line"><span>Telefon</span> ${tel}</div>${ccLine("Adresse", c.addr)}${ccLine("Web", c.web)}</div>`;
}

const OFFER_BLOCK = `<div class="offer">
    <h3>Unser Angebot — Reineke Technik &amp; Sharp Business Systems Deutschland</h3>
    <p>Gemeinsam bringen wir Ihre Domains kontrolliert und nachvollziehbar auf ein durchgesetztes
      Schutzniveau — die technische Umsetzung durch Reineke Technik, persönliche Betreuung über den
      Direktvertrieb von Sharp Business Systems, durchgängig DSGVO-konform und deutschsprachig:</p>
    <ol>
      <li><strong>DMARC-Einführung &amp; -Härtung:</strong> begleiteter Rollout von
        <code>p=none</code> über <code>p=quarantine</code> bis <code>p=reject</code>, inkl.
        SPF-/DKIM-Alignment und Auswertung der Aggregat-Reports.</li>
      <li><strong>DNSSEC-Aktivierung:</strong> Signierung der Zonen und Hinterlegung des
        DS-Eintrags beim Registrar.</li>
      <li><strong>Website-Härtung:</strong> CSP, HSTS, X-Frame-Options, X-Content-Type-Options
        und SRI sauber gesetzt.</li>
      <li><strong>Laufendes Monitoring:</strong> kontinuierliche Überwachung und verständliche
        Berichte — jederzeit kostenfrei nachprüfbar unter sharp.reineke.tech.</li>
    </ol>
  </div>`;

function contactsBlock(): string {
  return `<h3 class="contact-h">Ihre Ansprechpartner</h3><div class="contacts">${contactCard(REINEKE)}${contactCard(SHARP)}</div>`;
}

function pageHead(title: string, L: ReportLogos): string {
  return `<div class="page-head"><img class="ph-logo" src="${L.sharp}" alt="sharp"><span class="ph-sep">·</span><span class="ph-title">${BS}${title}</span></div>`;
}

function foot(date: string): string {
  return `<div class="page-foot">Geprüft mit sharp.reineke.tech · Stand ${esc(date)} · Reineke Technik GmbH · Vertraulich</div>`;
}

function coverPage(domain: string, date: string, L: ReportLogos): string {
  return `<section class="page cover">
  <div class="cover-top"><img class="cover-sharp" src="${L.sharp}" alt="sharp.reineke.tech"></div>
  <div class="cover-mid">
    <div class="cover-kicker">${BS}Sicherheits-Analyse · E-Mail &amp; Domain</div>
    <h1>${esc(domain)}</h1>
    <p class="cover-lead">Unabhängige Prüfung der digitalen Absender- und Domain-Sicherheit von
      ${esc(domain)} — DMARC, DNSSEC und Website-Sicherheit.</p>
    <ul class="cover-domains"><li><strong>${esc(domain)}</strong> — E-Mail- &amp; Domain-Sicherheit<br>
      <span class="cd-sub">Automatisierte Analyse mit sharp.reineke.tech</span></li></ul>
  </div>
  <div class="cover-bottom">
    <div class="cover-by">
      <div class="cb-label">Durchgeführt &amp; erstellt von</div>
      <div class="cb-org">Reineke Technik GmbH</div>
      <div class="cb-partner">Geseker Straße 26 · 33154 Salzkotten · www.reineke-technik.de</div>
      <div class="cb-date">${esc(date)}</div>
    </div>
    <img class="cover-fox" src="${L.reineke}" alt="Reineke Technik">
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

  return `<section class="page domain-page">
      <div class="page-head">
        <img class="ph-logo" src="${L.sharp}" alt="sharp">
        <span class="ph-sep">·</span><span class="ph-title">${BS}Domain-Bericht</span>
        <span class="ph-prio prio-${need.cls}">Handlungsbedarf: ${esc(need.label)}</span>
      </div>
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
      ${foot(date)}
    </section>`;
}

function empfehlungPage(domain: string, date: string, L: ReportLogos): string {
  return `<section class="page summary">
  ${pageHead("Empfehlung &amp; Ansprechpartner", L)}
  <h2 class="sum-h">Empfehlung für ${esc(domain)}</h2>
  <p class="sum-intro">Die auf der vorigen Seite dokumentierten Punkte lassen sich kontrolliert und
    ohne Betriebsunterbrechung schließen. So gehen wir gemeinsam vor:</p>
  ${OFFER_BLOCK}
  ${contactsBlock()}
  ${foot(date)}
</section>`;
}

function methodPage(date: string, L: ReportLogos): string {
  return `<section class="page method">
  ${pageHead("Methodik &amp; Hinweise", L)}
  <h2 class="sum-h">Methodik &amp; Hinweise</h2>
  <h3>Was wurde geprüft?</h3>
  <div class="method-grid">
    <div><h4>DMARC</h4><p>${EXPLAIN.dmarc}</p></div>
    <div><h4>DNSSEC</h4><p>${EXPLAIN.dnssec}</p></div>
    <div><h4>Website (HTTP Observatory)</h4><p>${EXPLAIN.observatory}</p></div>
  </div>
  <h3>Wie wurde gemessen?</h3>
  <p>Alle Werte wurden am ${esc(date)} mit dem frei zugänglichen Analyse-Tool
    <strong>sharp.reineke.tech</strong> von Reineke Technik erhoben. DNS-Abfragen erfolgen über
    Cloudflare DNS-over-HTTPS (1.1.1.1); die Website-Bewertung nutzt den
    <em>MDN HTTP Observatory</em> von Mozilla. Die Noten (A+…F) liegen auf einer gemeinsamen
    Skala. Es wurden ausschließlich öffentlich abrufbare DNS- und HTTP-Informationen
    ausgewertet — keine Eingriffe, keine Anmeldungen, keine Last für die Zielsysteme.</p>
  <p class="method-note">Die Ergebnisse sind eine Momentaufnahme und können sich nach
    Konfigurationsänderungen ändern. Eine erneute Prüfung ist jederzeit kostenfrei möglich.</p>
  <div class="brandfoot">
    <img class="bf-fox" src="${L.reineke}" alt="Reineke Technik">
    <div class="bf-body">
      <div class="bf-org">Reineke Technik GmbH</div>
      <div class="bf-tag">Analyse durchgeführt &amp; erstellt · E-Mail- &amp; Domain-Sicherheit · sharp.reineke.tech<br>in Zusammenarbeit mit Sharp Business Systems Deutschland GmbH</div>
      <div class="bf-contact">${esc(REINEKE.name)} (Reineke Technik) · ${esc(REINEKE.mail)}<br>
        ${esc(SHARP.name)} (Sharp Business Systems) · ${esc(SHARP.mail)} · ${esc(SHARP.tel)}</div>
    </div>
    <img class="bf-sharp" src="${L.sharp}" alt="Sharp">
  </div>
</section>`;
}

/** Build the full report body (sections). Pass the scan results from the API. */
export function buildReportBody(
  domain: string,
  analyze: AnalysisResponse,
  observatory: CheckResult<ObservatoryResult>,
  logos: ReportLogos,
): string {
  const date = germanDate(analyze.queriedAt);
  return (
    coverPage(domain, date, logos) +
    domainPage(domain, analyze, observatory, date, logos) +
    empfehlungPage(domain, date, logos) +
    methodPage(date, logos)
  );
}
