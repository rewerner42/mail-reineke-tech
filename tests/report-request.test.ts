import { describe, expect, it } from "vitest";
import { parseReportRequest, trimField } from "../src/leads/report-request.js";

const OK = {
  email: "erika@muster-gmbh.de",
  name: "Erika Muster",
  domain: "muster-gmbh.de",
};

describe("parseReportRequest", () => {
  it("accepts a complete request", () => {
    const r = parseReportRequest({ ...OK, company: " Muster GmbH ", phone: "0123", contactConsent: true });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fields.email).toBe("erika@muster-gmbh.de");
    expect(r.fields.contactName).toBe("Erika Muster");
    expect(r.fields.reportDomain).toBe("muster-gmbh.de");
    expect(r.fields.emailDomain).toBe("muster-gmbh.de");
    expect(r.fields.company).toBe("Muster GmbH");
    expect(r.fields.contactConsent).toBe(true);
  });

  // Der Kern der Aufgabe: Der Bericht gilt der GEPRÜFTEN Domain, nicht der des
  // Absenders. Ein IT-Dienstleister prüft die Domain seines Kunden.
  it("keeps the scanned domain apart from the e-mail domain", () => {
    const r = parseReportRequest({ ...OK, email: "berater@dienstleister.de" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fields.reportDomain).toBe("muster-gmbh.de");
    expect(r.fields.emailDomain).toBe("dienstleister.de");
  });

  it("normalises a pasted URL to a bare domain", () => {
    const r = parseReportRequest({ ...OK, domain: "https://WWW.Muster-GmbH.de/pfad?x=1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fields.reportDomain).toBe("www.muster-gmbh.de");
  });

  // Freiwilligkeit: Alles ausser echtem true gilt als NICHT erteilt — und darf
  // die Anfrage trotzdem nicht abweisen.
  it("treats anything but true as no advertising consent, without rejecting", () => {
    for (const v of [undefined, false, "true", 1, null]) {
      const r = parseReportRequest({ ...OK, contactConsent: v });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.fields.contactConsent).toBe(false);
    }
  });

  it("rejects a missing or malformed e-mail first", () => {
    expect(parseReportRequest({ ...OK, email: "keine-adresse" })).toMatchObject({
      ok: false,
      code: "INVALID_EMAIL",
    });
    expect(parseReportRequest({ name: "X", domain: "b.de" })).toMatchObject({ code: "INVALID_EMAIL" });
  });

  it("rejects a missing name", () => {
    expect(parseReportRequest({ ...OK, name: "   " })).toMatchObject({ ok: false, code: "MISSING_FIELDS" });
  });

  it("rejects a missing or invalid domain", () => {
    expect(parseReportRequest({ ...OK, domain: "" })).toMatchObject({ ok: false, code: "INVALID_DOMAIN" });
    expect(parseReportRequest({ ...OK, domain: "nicht_eine_domain" })).toMatchObject({ code: "INVALID_DOMAIN" });
  });

  it("caps overlong input instead of passing it through", () => {
    const r = parseReportRequest({ ...OK, name: "N".repeat(500), company: "C".repeat(500) });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fields.contactName).toHaveLength(120);
    expect(r.fields.company).toHaveLength(200);
  });
});

describe("trimField", () => {
  it("returns undefined for blanks and non-strings", () => {
    expect(trimField("   ")).toBeUndefined();
    expect(trimField(42)).toBeUndefined();
    expect(trimField(undefined)).toBeUndefined();
  });
});
