// Sofort-Benachrichtigung über Resend (HTTPS-API, kein SMTP).
//
// Zweiter, von Odoo unabhängiger Kanal: Fällt die CRM-Anbindung oder der
// Microsoft-Mailversand aus, erreicht die Anfrage trotzdem den Posteingang.
// Best-effort — ein Fehler hier darf den Nutzer nie von seiner Antwort abhalten.

export interface NotifyConfig {
  apiKey: string;
  from: string; // "Name <adresse@domain>" — Domain muss in Resend verifiziert sein
  to: string;
}

export interface Attachment {
  filename: string;
  content: string; // base64
  content_type?: string;
  content_id?: string; // gesetzt → per <img src="cid:…"> einbettbar
}

/** Logo wird ANGEHÄNGT statt verlinkt: Mailprogramme blockieren externe Bilder,
 *  und unsere eigenen Sicherheitsheader (CORP) verbieten den Fremdabruf ohnehin. */
const LOGO_CID = "reineke-logo";
function logoAttachment(logoBase64?: string): Attachment[] {
  if (!logoBase64) return [];
  return [{ filename: "reineke-logo.png", content: logoBase64, content_type: "image/png", content_id: LOGO_CID }];
}
function logoBlock(logoBase64?: string): string {
  if (!logoBase64) return "";
  return `<p style="margin:10px 0 0"><img src="cid:${LOGO_CID}" alt="Reineke Technik" width="120" style="width:120px;height:auto;border:0" /></p>`;
}

/** Welche Strecke die Meldung ausgeloest hat — steuert Betreff und Textbausteine. */
export type LeadKind = "pentest" | "bericht";

export interface PentestNotification {
  kind?: LeadKind;
  company: string;
  contactName: string;
  role?: string;
  email: string;
  phone?: string;
  testart?: string;
  umfang?: string;
  anlass?: string;
  frist?: string;
  freitext?: string;
  domain?: string;
  /** Domain, fuer die der Bericht gebaut wird. Kann von `domain` (aus der
   *  E-Mail-Adresse) abweichen; dann beschreibt die Ampel das Unternehmen des
   *  Interessenten und der Anhang eine andere Domain — beide muessen getrennt
   *  beschriftet sein, sonst ist die Meldung irrefuehrend. */
  reportDomain?: string;
  ampel?: string;
  befunde?: string;
  leadId?: number;
  toolUrl: string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const FONT = "font-family:Aptos,Calibri,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11pt;color:#000000";

function signature(logoBase64?: string): string {
  return `<p style="margin-top:18px">Mit freundlichen Grüßen<br/>Werner Francis Reineke</p>
<p style="margin:0">------------------------------------------------</p>
<p style="margin:0">
Geschäftsführer<br/>
Reineke Technik GmbH<br/>
Geseker Str. 26, 33154 Salzkotten<br/>
Tel.: <a href="tel:+491722872390" style="color:#0563C1">+49 172 2872390</a><br/>
<a href="mailto:wf.reineke@reineke-technik.de" style="color:#0563C1">wf.reineke@reineke-technik.de</a><br/>
<a href="https://www.reineke-technik.de" style="color:#0563C1">www.reineke-technik.de</a>
</p>
<p style="margin:0">------------------------------------------------</p>
${logoBlock(logoBase64)}`;
}

function row(label: string, value?: string): string {
  if (!value) return "";
  return (
    `<tr><td style="padding:2px 18px 2px 0;vertical-align:top;white-space:nowrap"><strong>${esc(label)}</strong></td>` +
    `<td style="padding:2px 0;vertical-align:top">${esc(value)}</td></tr>`
  );
}

/** HTML im gewohnten Briefstil (gleiche Optik wie die Odoo-Benachrichtigung). */
export function buildPentestEmail(
  n: PentestNotification,
  logoBase64?: string,
): { subject: string; html: string; attachments: Attachment[] } {
  const rows = [
    row("Firma", n.company),
    row("Name", n.contactName),
    row("Rolle", n.role),
    row("E-Mail", n.email),
    row("Telefon", n.phone),
    row("Testart", n.testart),
    row("Umfang", n.umfang),
    row("Anlass", n.anlass),
    row("Frist", n.frist),
    row("Technik-Ampel", n.ampel),
    row("Domain (aus der E-Mail-Adresse)", n.domain),
    row("Bericht angefordert für", n.reportDomain && n.reportDomain !== n.domain ? n.reportDomain : undefined),
  ].join("");
  const freitext = n.freitext
    ? `<p style="margin:14px 0 4px"><strong>Freitext</strong></p><div style="white-space:pre-wrap">${esc(n.freitext)}</div>`
    : "";
  const befunde = n.befunde
    ? `<p style="margin:14px 0 4px"><strong>Befunde des Sicherheits-Checks</strong></p><div style="white-space:pre-wrap">${esc(n.befunde)}</div>`
    : "";
  const lead = n.leadId ? `<p style="margin:14px 0 0">Odoo-Vorgang: #${n.leadId}</p>` : "";
  const html = `<div style="${FONT}">
<p>Hallo Werner,</p>
<p>über <strong>${esc(n.toolUrl)}</strong> ist eine neue ${
    n.kind === "bericht" ? "Berichtsanfrage" : "Pentest-Anfrage"
  } eingegangen:</p>
<table cellpadding="0" cellspacing="0" style="${FONT};border-collapse:collapse;margin:12px 0">${rows}</table>
${freitext}${befunde}${lead}
${signature(logoBase64)}
</div>`;
  return {
    subject: `${n.kind === "bericht" ? "Neue Berichtsanfrage" : "Neue Pentest-Anfrage"}: ${n.company}`,
    html,
    attachments: logoAttachment(logoBase64),
  };
}

// ─── Eingangsbestätigung an den Interessenten (mit Bericht im Anhang) ─────────
export function buildCustomerEmail(
  n: PentestNotification,
  opts: { bookingUrl: string; hasReport: boolean; logoBase64?: string },
): { subject: string; html: string } {
  const istBericht = n.kind === "bericht";
  const dom = n.reportDomain ?? n.domain ?? "";

  // ── Pentest-Strecke: Wortlaut UNVERÄNDERT. Diese Mail läuft im Vertrieb;
  //    die Berichtsanfrage darf sie nicht nebenbei umformulieren.
  if (!istBericht) {
    const rueck = [row("Firma", n.company), row("Testart", n.testart), row("Anlass", n.anlass), row("Frist", n.frist)]
      .join("");
    const bericht = opts.hasReport
      ? `<p>Als erste Orientierung haben wir Ihnen einen <strong>Sicherheitsbericht zu ${esc(n.domain ?? "")}</strong>
       angehängt. Er zeigt, was ein Angreifer ohne Anmeldung in dreißig Sekunden über Ihre Domain
       sehen kann — E-Mail-Authentifizierung, DNS-Absicherung und Website-Header. Ausgewertet wurden
       ausschließlich öffentlich abrufbare Informationen; es gab keine Eingriffe in Ihre Systeme.</p>`
      : "";
    const html = `<div style="${FONT}">
<p>Guten Tag ${esc(n.contactName)},</p>
<p>vielen Dank für Ihre Anfrage über ${esc(n.toolUrl)}. Ihre Angaben sind bei uns eingegangen:</p>
<table cellpadding="0" cellspacing="0" style="${FONT};border-collapse:collapse;margin:12px 0">${rueck}</table>
${bericht}
<p><strong>Wie es weitergeht:</strong> Ich melde mich innerhalb von 2 Werktagen persönlich bei Ihnen, um das
Scoping-Gespräch zu terminieren. Darin legen wir gemeinsam Ziele, Systeme und Testtiefe fest und
stimmen das Zeitfenster betriebsschonend ab. Den Festpreis erhalten Sie, bevor Sie beauftragen.</p>
<p>Wenn es schneller gehen soll, buchen Sie sich direkt einen Termin:<br/>
<a href="${esc(opts.bookingUrl)}" style="color:#0563C1">Termin direkt buchen</a></p>
<p>Falls Sie diese Anfrage nicht ausgelöst haben, antworten Sie bitte kurz auf diese E-Mail —
dann löschen wir Ihre Angaben umgehend.</p>
${signature(opts.logoBase64)}
</div>`;
    return { subject: `Ihre Pentest-Anfrage bei Reineke Technik`, html };
  }

  // ── Berichtsanfrage. Neutrale Sprache: Die geprüfte Domain muss NICHT dem
  //    Empfänger gehören (IT-Dienstleister prüfen Kundendomains). "Ihre Domain"
  //    wäre dann falsch und läse sich wie ein Vorwurf.
  const rueck = [row("Geprüfte Domain", dom), row("Firma", n.company)].join("");
  const bericht = opts.hasReport
    ? `<p>Im Anhang finden Sie den <strong>Sicherheitsbericht zu ${esc(dom)}</strong>. Er zeigt, was
       ohne Anmeldung von außen sichtbar ist — E-Mail-Authentifizierung, DNS-Absicherung und
       Website-Header. Ausgewertet wurden ausschließlich öffentlich abrufbare Informationen;
       es gab keine Eingriffe in laufende Systeme.</p>`
    : `<p>Den Bericht zu <strong>${esc(dom)}</strong> konnten wir nicht automatisch erstellen —
       das kommt gelegentlich vor, wenn eine Prüfung zu lange braucht. Wir stellen ihn von Hand
       zusammen und melden uns damit bei Ihnen.</p>`;
  const html = `<div style="${FONT}">
<p>Guten Tag ${esc(n.contactName)},</p>
<p>vielen Dank für Ihre Anfrage über ${esc(n.toolUrl)}.</p>
<table cellpadding="0" cellspacing="0" style="${FONT};border-collapse:collapse;margin:12px 0">${rueck}</table>
${bericht}
<p><strong>Wie es weitergeht:</strong> Der Bericht sagt Ihnen, <em>was</em> offensteht — nicht,
was es für Sie bedeutet. Wenn Sie die Punkte einordnen möchten, gehe ich sie in einem kurzen
Gespräch mit Ihnen durch, unverbindlich.</p>
<p>Wenn es schneller gehen soll, buchen Sie sich direkt einen Termin:<br/>
<a href="${esc(opts.bookingUrl)}" style="color:#0563C1">Termin direkt buchen</a></p>
<p><strong>Sie haben das nicht angefordert?</strong> Dann hat jemand Ihre Adresse eingetragen.
Antworten Sie bitte kurz auf diese E-Mail — wir löschen Ihre Angaben umgehend und schreiben
Sie nicht wieder an.</p>
${signature(opts.logoBase64)}
</div>`;
  return { subject: `Sicherheitsbericht für ${dom}`, html };
}

export interface MailInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: Attachment[];
}

/** Versand über die Resend-API. Wirft nie — meldet nur ok/Fehlergrund zurück. */
export async function sendMail(
  apiKey: string,
  mail: MailInput,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20000);
  try {
    const r = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: mail.from,
        to: [mail.to],
        reply_to: mail.replyTo,
        subject: mail.subject,
        html: mail.html,
        ...(mail.attachments?.length ? { attachments: mail.attachments } : {}),
      }),
      signal: controller.signal,
    });
    const body = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!r.ok) return { ok: false, error: body.message || `HTTP ${r.status}` };
    return { ok: true, id: body.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}
