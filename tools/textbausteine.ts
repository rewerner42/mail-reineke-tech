// Writes docs/bericht-v15-textbausteine.md: every catalogue text, laid out the
// way the report prints it, for Werner to read and approve.
//
//   npx tsx tools/textbausteine.ts [--vorher <katalog.json>] [--gruende <gruende.json>]
//
// --vorher marks every field that differs from that older catalogue and shows
// the old wording beneath it. --gruende adds the reason per changed field, as a
// JSON object { "<ort>": "<grund>" } with ort like "feststellungen.dmarc_fehlt.kurz".

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { OBS_CODES, katalogSchluessel } from "../src/report/observatory-codes.js";
import type { Katalog, KatalogFeststellung } from "../src/report/viewmodel.js";

const DATEN = fileURLToPath(new URL("../src/report/daten", import.meta.url));
const ZIEL = fileURLToPath(new URL("../docs/bericht-v15-textbausteine.md", import.meta.url));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const lese = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const k = lese(`${DATEN}/katalog.json`) as Katalog;
const vorherPfad = arg("--vorher");
const vorher = vorherPfad ? (lese(vorherPfad) as Katalog) : null;
const gruende: Record<string, string> = arg("--gruende") ? lese(arg("--gruende")!) : {};

/** Value at a dotted path such as "feststellungen.dmarc_fehlt.kurz". */
function wert(kat: unknown, ort: string): unknown {
  return ort.split(".").reduce<unknown>((o, t) => (o && typeof o === "object" ? (o as Record<string, unknown>)[t] : undefined), kat);
}

let geaendert = 0;
const L: string[] = [];
const A = (s = "") => L.push(s);

/** One field: label, text, and — when it changed — the old wording and why. */
function feld(beschriftung: string, ort: string, text: string): void {
  const alt = vorher ? wert(vorher, ort) : undefined;
  const neu = vorher !== null && alt !== text;
  if (neu) geaendert++;
  A(`**${beschriftung}**${neu ? (alt === undefined ? "  ·  *neu*" : "  ·  *geändert*") : ""}  `);
  A(text);
  if (neu && typeof alt === "string") A(`> vorher: ${alt}`);
  if (neu && gruende[ort]) A(`> Warum: ${gruende[ort]}`);
  A();
}

// MDN result codes per catalogue key, so each website text can be checked
// against the result it describes.
const codesVon = new Map<string, string[]>();
for (const [code, c] of Object.entries(OBS_CODES)) {
  if (c.art !== "feststellung") continue;
  const key = katalogSchluessel(c);
  codesVon.set(key, [...(codesVon.get(key) ?? []), `\`${code}\` (${c.modifier} Punkte)`]);
}

const GRUPPEN: Array<[string, string[]]> = [
  ["E-Mail — DMARC", ["dmarc_"]],
  ["E-Mail — SPF, DKIM, Mailserver", ["spf_", "dkim_", "mx_"]],
  ["E-Mail — Transportverschlüsselung", ["mta_sts_", "tls_rpt_"]],
  ["Domain — DNSSEC", ["dnssec_"]],
  ["Website — Schutzregel für Skripte (CSP)", ["obs_csp"]],
  ["Website — Cookies", ["obs_cookies"]],
  ["Website — Verschlüsselung und Weiterleitung", ["obs_hsts", "obs_redirection"]],
  ["Website — fremde Skripte und Einbettung", ["obs_sri", "obs_xfo", "obs_xcto"]],
  ["Website — Freigaben und Trennung", ["obs_cors", "obs_corp", "obs_coep", "obs_coop", "obs_referrer"]],
  ["Website — Auswertung der Startseite", ["obs_scan", "obs_generic"]],
];

const F = k.feststellungen;
/** The card labels as the report prints them. */
const KL = (k.texte as Record<string, Record<string, string>>).karte_labels!;
const prio = (e: KatalogFeststellung) => k.prio_labels[e.prio] ?? e.prio;
const anzahl = (p: string) => Object.values(F).filter((e) => e.prio === p).length;

A("# Die Textbausteine des Berichts");
A();
A("Jede Feststellung im Bericht ist einer dieser Bausteine. Zur Laufzeit wird nichts");
A("formuliert — was hier steht, steht im Bericht. `{geschweifte Klammern}` werden aus");
A("dem Scan gefüllt: `{domain}`, `{record}` der DNS-Eintrag, `{text}` die Messzeile des");
A("Scanners, `{policy}` die DMARC-Richtlinie, `{label}` der Name des Website-Tests,");
A("`{modifier}` der Punktabzug, `{result_text}` die Originalmeldung des Prüfwerkzeugs.");
A();
A(`**${Object.keys(F).length} Bausteine:** ${anzahl("hoch")} hoch, ${anzahl("mittel")} mittel, ${anzahl("gering")} gering eingestuft.`);
if (vorher) {
  A();
  A("**Markierungen:** *geändert* heißt, der Text ist gegenüber dem vorigen Stand neu gefasst;");
  A("darunter stehen der alte Wortlaut („vorher“) und der Grund („Warum“). *neu* heißt, die Stelle");
  A("gab es vorher nicht. Ohne Markierung ist der Text unverändert.");
  A();
}
A("Bei den Website-Bausteinen ist die Einstufung nicht gewählt, sondern aus MDNs eigenem");
A("Punktabzug abgeleitet: ab 40 Punkten hoch, ab 10 mittel, darunter gering.");
A();
A("## So erscheinen die Felder im Bericht");
A();
A("Die Beschriftungen unten sind die, die auch im PDF stehen.");
A();
A("| Feld | Wo es steht |");
A("|---|---|");
A("| Titel | Inhaltsverzeichnis und Kapitel 05; bei hoch und mittel auch in der Zusammenfassung |");
A("| Kurzfassung | unter dem Titel: in der Zusammenfassung (die drei wichtigsten) und in der Liste „Weitere Feststellungen“ (gering) |");
A(`| ${KL.sachverhalt}, ${KL.angriff}, ${KL.auswirkung}, Technischer Befund | nur auf der Karte in Kapitel 05, also nur bei hoch und mittel |`);
A("| Aufwand | auf der Karte als „Gering. …“, in der Liste als „Aufwand gering: …“ |");
A("| Schritt in der Maßnahme | im Text der Maßnahme in Kapitel 02; mehrere Schritte werden mit „;“ verbunden, der Punkt kommt am Ende dazu |");
A();
A("Bei gering eingestuften Bausteinen stehen deshalb nur Titel, Kurzfassung, Aufwand und");
A("Schritt im Bericht. Die übrigen Felder sind vollständig vorhanden, falls sich die");
A("Einstufung einmal ändert, und stehen hier abgesetzt darunter.");
A();
A("---");
A();

const gezeigt = new Set<string>();
for (const [titel, praefixe] of GRUPPEN) {
  const teil = Object.entries(F).filter(([key]) => !gezeigt.has(key) && praefixe.some((p) => key.startsWith(p)));
  if (!teil.length) continue;
  A(`## ${titel}`);
  A();
  for (const [key, e] of teil) {
    gezeigt.add(key);
    const o = `feststellungen.${key}`;
    const codes = codesVon.get(key);
    A(`### \`${key}\`  ·  ${prio(e)}  ·  ${e.fach}`);
    if (codes) A(`MDN: ${codes.join(", ")}`);
    A();
    const gering = e.prio === "gering";
    feld("Titel", `${o}.titel`, e.titel);
    feld("Kurzfassung", `${o}.kurz`, e.kurz);
    if (!gering) {
      feld(KL.sachverhalt!, `${o}.feststellung`, e.feststellung);
      feld(KL.angriff!, `${o}.angriff`, e.angriff);
      feld(KL.auswirkung!, `${o}.auswirkung`, e.auswirkung);
    }
    feld(`Aufwand ${e.aufwand}`, `${o}.aufwand_text`, e.aufwand_text);
    if (!gering) feld("Technischer Befund", `${o}.tech`, e.tech);
    if (e.schritt) feld("Schritt in der Maßnahme", `${o}.schritt`, e.schritt);
    if (e.offen) feld("Bleibt offen (Gesprächsthema)", `${o}.offen`, e.offen);
    if (gering) {
      A("*Nicht im Bericht, solange gering eingestuft:*");
      A();
      feld(KL.sachverhalt!, `${o}.feststellung`, e.feststellung);
      feld(KL.angriff!, `${o}.angriff`, e.angriff);
      feld(KL.auswirkung!, `${o}.auswirkung`, e.auswirkung);
      feld("Technischer Befund", `${o}.tech`, e.tech);
    }
  }
  A("---");
  A();
}
const fehlt = Object.keys(F).filter((key) => !gezeigt.has(key));
if (fehlt.length) throw new Error(`nicht einsortiert: ${fehlt.join(", ")}`);

A("## Bereits umgesetzt (Positivliste)");
A();
A("Einzeiler unter „Bereits umgesetzt“. Die mit „teilerfolg“ erscheinen nur, wenn die Liste sonst leer bliebe.");
A();
for (const [key, text] of Object.entries(k.positiv)) feld(`\`${key}\``, `positiv.${key}`, text);
for (const [key, text] of Object.entries(k.positiv_einleitung)) feld(`Einleitung \`${key}\``, `positiv_einleitung.${key}`, text);
A("---");
A();

A("## Sätze je Prüfbereich");
A();
A("Unter der Note jeder Kachel in der Zusammenfassung. Der Hinweis zur Note ersetzt in der");
A("E-Mail-Kachel die Zeile „Geprüfter Schutz umgesetzt“, wenn die Note gut ist und mindestens");
A("eine hoch oder mittel eingestufte E-Mail-Feststellung außerhalb von DMARC vorliegt.");
A();
for (const [ber, b] of Object.entries(k.bereiche)) {
  A(`### ${b.label} — ${b.pruefung}`);
  A();
  for (const [zustand, satz] of Object.entries(b.satz)) feld(zustand, `bereiche.${ber}.satz.${zustand}`, satz);
  const hinweis = (b as Record<string, unknown>).note_hinweis;
  if (typeof hinweis === "string") feld("Hinweis zur Note", `bereiche.${ber}.note_hinweis`, hinweis);
}
A("---");
A();

A("## Maßnahmen");
A();
A("Die Texte setzen sich aus den Schritten der Feststellungen zusammen (`{schritte}`), in der");
A("Reihenfolge, in der eine IT sie umsetzt. Die Zuständigkeit steht als Zeile");
A("„Üblicherweise zuständig: …“ unter dem Text.");
A();
for (const [key, m] of Object.entries(k.massnahmen)) {
  A(`### \`${key}\``);
  A();
  feld("Titel", `massnahmen.${key}.titel`, m.titel);
  feld("Text", `massnahmen.${key}.text`, m.text);
  if (m.zustaendig) feld("Üblicherweise zuständig", `massnahmen.${key}.zustaendig`, m.zustaendig);
  if (m.text_ohne_feststellungen) feld("Text ohne Feststellungen", `massnahmen.${key}.text_ohne_feststellungen`, m.text_ohne_feststellungen);
}
A("---");
A();

A("## Offene Punkte (Gesprächsthemen)");
A();
const t = k.texte as Record<string, string>;
A("Stehen auf „Nächster Schritt“ unter dem Termin: links Überschrift und Einleitung, rechts je Punkt eine Zeile.");
A();
for (const key of ["offen_label", "offen_einleitung", "offen_website"]) if (t[key]) feld(key, `texte.${key}`, t[key]);
A("---");
A();

A("## Namen der Website-Tests");
A();
for (const [key, text] of Object.entries(k.observatory_labels)) feld(`\`${key}\``, `observatory_labels.${key}`, text);

// The count of changed fields is only known after the walk, so it goes in at the end.
if (vorher) {
  const i = L.findIndex((z) => z.startsWith("**Markierungen:**"));
  L.splice(i, 0, `**Geändert gegenüber dem vorigen Stand:** ${geaendert} Textstellen.`, "");
}
writeFileSync(ZIEL, L.join("\n").replace(/\n{3,}/g, "\n\n") + "\n");
console.log(`${Object.keys(F).length} Bausteine, ${Object.keys(k.positiv).length} Positivtexte${vorher ? `, ${geaendert} Felder geändert` : ""} → docs/bericht-v15-textbausteine.md`);
