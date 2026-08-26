// Reine Prüf- und Aufbaulogik der Berichtsanfrage — bewusst ohne Worker-Bezug,
// damit sie unter Node testbar bleibt (der Worker-Kontext ist es nicht).
import { normalizeDomain } from "../domain.js";
import { validateEmail } from "./odoo.js";

export interface ReportRequestFields {
  email: string;
  contactName: string;
  /** Domain, für die der Bericht gebaut wird (aus dem Formular/Verweis). */
  reportDomain: string;
  /** Domain der Absenderadresse — Dubletten-Schlüssel im CRM. */
  emailDomain?: string;
  company?: string;
  phone?: string;
  contactConsent: boolean;
}

export type ReportRequestParse =
  | { ok: true; fields: ReportRequestFields }
  | { ok: false; code: string; message: string; status: 400 };

/** Auf `max` Zeichen gekürzter Freitext; leere Eingaben werden zu `undefined`. */
export function trimField(v: unknown, max = 200): string | undefined {
  if (typeof v !== "string") return undefined;
  // Zeilenumbrüche raus: Name und Firma landen im Mailbetreff. Resend baut MIME
  // aus JSON, ein Umbruch dürfte also halten — darauf verlassen wollen wir uns
  // bei einem Feld aus einem öffentlichen Formular nicht.
  const t = v.replace(/[\r\n\t]+/g, " ").trim().slice(0, max).trim();
  return t || undefined;
}

/**
 * Prüft den Formularkörper. Reihenfolge ist Absicht: erst die Adresse (ohne sie
 * gibt es keinen Empfänger), dann der Name (Anrede), dann die Domain.
 */
export function parseReportRequest(body: Record<string, unknown>): ReportRequestParse {
  if (!validateEmail(body.email)) {
    return {
      ok: false,
      code: "INVALID_EMAIL",
      message: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
      status: 400,
    };
  }
  const contactName = trimField(body.name, 120);
  if (!contactName) {
    return { ok: false, code: "MISSING_FIELDS", message: "Bitte geben Sie Ihren Namen an.", status: 400 };
  }
  const reportDomain = normalizeDomain(typeof body.domain === "string" ? body.domain : "");
  if (!reportDomain) {
    return {
      ok: false,
      code: "INVALID_DOMAIN",
      message: "Bitte geben Sie eine gültige Domain an.",
      status: 400,
    };
  }
  const email = (body.email as string).trim();
  return {
    ok: true,
    fields: {
      email,
      contactName,
      reportDomain,
      emailDomain: normalizeDomain(email.split("@")[1] ?? "") ?? undefined,
      company: trimField(body.company),
      phone: trimField(body.phone, 60),
      // Werbeeinwilligung ist FREIWILLIG: Alles ausser einem echten `true` gilt
      // als nicht erteilt — und blockiert die Anfrage bewusst nicht.
      contactConsent: body.contactConsent === true,
    },
  };
}
