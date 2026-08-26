import { describe, expect, it } from "vitest";
import { buildCustomerEmail, buildPentestEmail, type PentestNotification } from "../src/leads/notify.js";

const BASE: PentestNotification = {
  company: "Muster GmbH",
  contactName: "Erika Muster",
  email: "erika@muster-gmbh.de",
  domain: "muster-gmbh.de",
  toolUrl: "scan.reineke.tech",
};
const OPTS = { bookingUrl: "https://buchen.example/x", hasReport: true };

// Die Pentest-Strecke laeuft im Vertrieb. Diese Zusicherungen halten ihren
// Wortlaut fest, damit die Berichtsanfrage ihn nicht nebenbei umformuliert —
// genau das war beim ersten Anlauf passiert.
describe("Pentest-Kundenmail bleibt unveraendert", () => {
  it("keeps subject and wording", () => {
    const m = buildCustomerEmail(BASE, OPTS);
    expect(m.subject).toBe("Ihre Pentest-Anfrage bei Reineke Technik");
    expect(m.html).toContain("Ihre Angaben sind bei uns eingegangen:");
    expect(m.html).toContain("Als erste Orientierung haben wir Ihnen einen");
    expect(m.html).toContain("was ein Angreifer ohne Anmeldung in dreißig Sekunden über Ihre Domain");
    expect(m.html).toContain("Ich melde mich innerhalb von 2 Werktagen persönlich bei Ihnen");
    expect(m.html).toContain("Falls Sie diese Anfrage nicht ausgelöst haben");
  });

  it("adds NO report paragraph when there is no attachment", () => {
    const m = buildCustomerEmail(BASE, { ...OPTS, hasReport: false });
    expect(m.html).not.toContain("Sicherheitsbericht zu");
    expect(m.html).not.toContain("konnten wir nicht automatisch erstellen");
  });

  it("keeps the internal subject", () => {
    expect(buildPentestEmail(BASE).subject).toBe("Neue Pentest-Anfrage: Muster GmbH");
  });
});

describe("Berichts-Kundenmail", () => {
  const B: PentestNotification = { ...BASE, kind: "bericht", reportDomain: "kunde.de" };

  it("names the scanned domain, not the sender's", () => {
    const m = buildCustomerEmail(B, OPTS);
    expect(m.subject).toBe("Sicherheitsbericht für kunde.de");
    expect(m.html).toContain("Sicherheitsbericht zu kunde.de");
  });

  // Der Bericht kann eine FREMDE Domain betreffen — "Ihre Domain" waere dann
  // falsch und laese sich wie ein Vorwurf.
  it("avoids claiming the domain belongs to the recipient", () => {
    const m = buildCustomerEmail(B, OPTS);
    expect(m.html).not.toContain("Ihre Domain");
    expect(m.html).not.toContain("Eingriffe in Ihre Systeme");
  });

  // Ein Dritter kann diese Mail ausloesen: Der Widerspruchsweg muss drinstehen.
  it("keeps a way out for someone who never asked", () => {
    expect(buildCustomerEmail(B, OPTS).html).toContain("Sie haben das nicht angefordert?");
  });

  it("says so plainly when the report could not be built", () => {
    const m = buildCustomerEmail(B, { ...OPTS, hasReport: false });
    expect(m.html).toContain("konnten wir nicht automatisch erstellen");
  });

  it("labels the two domains apart in the internal mail", () => {
    const html = buildPentestEmail(B).html;
    expect(buildPentestEmail(B).subject).toBe("Neue Berichtsanfrage: Muster GmbH");
    expect(html).toContain("Domain (aus der E-Mail-Adresse)");
    expect(html).toContain("Bericht angefordert für");
  });
});
