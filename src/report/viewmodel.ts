// Signal + catalogue → view model. A direct port of the reference generator
// (referenz/generator/render.py, build_viewmodel + roh_feststellungen).
//
// Nothing here writes prose. Every sentence that reaches the reader comes out of
// katalog.json; this file only decides which entries apply, in what order, and
// fills their {placeholders}. Keep it behaviourally identical to the Python —
// tests/viewmodel-equivalence.test.ts compares both against the same signals.
//
// Three porting traps are handled explicitly, see the helpers below: Python's
// str.replace replaces every occurrence, Python's `[]` is falsy, and Jinja2's
// StrictUndefined raises where TypeScript would silently render "undefined".

import type { Signal, SignalLevel } from "./signal.js";

const MONATE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** Finding priorities, worst first. Iteration order is part of the output. */
const PRIO_RANG: Record<string, number> = { hoch: 0, mittel: 1, gering: 2 };

/** B9/S20: at equal priority, e-mail findings come before website ones. */
const BEREICH_RANG: Record<string, number> = { email: 0, domain: 1, website: 2 };

/** Effort wording is a scale, sometimes given as a span ("gering bis mittel"). */
const AUFWAND_RANG: Record<string, number> = { gering: 0, mittel: 1, hoch: 2 };

/** Handlungsbedarf and finding priorities on one scale; "kritisch" only exists for the former. */
const STUFE: Record<string, number> = { gering: 0, mittel: 1, hoch: 2, kritisch: 2 };

const MAIL_CHECKS: ReadonlyArray<[keyof Signal["mail"], string]> = [
  ["spf", "SPF"],
  ["dkim", "DKIM"],
  ["mx", "MX (Mailserver)"],
  ["mta_sts", "MTA-STS"],
  ["tls_rpt", "TLS-RPT"],
];

// ---------------------------------------------------------------- helpers

/**
 * Python truthiness. `[]`, `{}`, `""`, `0`, null and undefined are all falsy —
 * in JavaScript an empty array is truthy, which silently flips every `if (list)`
 * carried over from the reference. Use this wherever the Python tested a value
 * for truth; never write a bare `if (liste)`.
 */
export function truthy(v: unknown): boolean {
  if (v === null || v === undefined || v === false) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "string") return v.length > 0;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return Boolean(v);
}

/**
 * Stands in for Jinja2's StrictUndefined: a missing catalogue entry must stop the
 * report, not render as an empty string. `undefined` in a report sentence is a
 * silent content bug; a thrown error is a loud one.
 */
function must<T>(obj: Record<string, T> | undefined, key: string, where: string): T {
  const v = obj?.[key];
  if (v === undefined) throw new Error(`Katalog: ${where}.${key} fehlt`);
  return v;
}

/** Replaces {key} from ctx; unknown placeholders stay, so the tests can catch them. */
export function fill(text: unknown, ctx: Record<string, unknown>): unknown {
  if (typeof text !== "string") return text;
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = ctx[key];
    return v === null || v === undefined ? whole : String(v);
  });
}

function fillStr(text: string, ctx: Record<string, unknown>): string {
  return fill(text, ctx) as string;
}

/** -50 → "−50" (typographic minus). Replaces every hyphen, as Python's str.replace does. */
export function minus(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).replace(/-/g, "−");
}

export function datumText(iso: string): string {
  const [y, m, d] = iso.split("-").map((x) => parseInt(x, 10));
  const monat = MONATE[(m ?? 0) - 1];
  if (!monat) throw new Error(`Ungültiges Scan-Datum: ${iso}`);
  return `${d}. ${monat} ${y}`;
}

interface NoteInfo {
  note: string;
  klasse: string;
  wort: string;
  bedeutung: string;
}

function noteInfo(grade: string | null | undefined, kat: Katalog): NoteInfo {
  if (!grade || grade === "–" || grade === "-") {
    return { note: "–", ...kat.note_unbewertet };
  }
  for (const n of kat.noten) {
    if (n.noten.includes(grade)) {
      return { note: grade, klasse: n.klasse, wort: n.wort, bedeutung: n.bedeutung };
    }
  }
  throw new Error(`Unbekannte Note: ${grade}`);
}

/** Lowest to highest step across a set of effort spans: ["gering","mittel"] → "gering bis mittel". */
function spanne(teile: string[][]): string {
  const rang = (x: string) => AUFWAND_RANG[x] ?? 99;
  const lo = teile.map((t) => t[0]!).reduce((a, b) => (rang(b) < rang(a) ? b : a));
  const hi = teile.map((t) => t[t.length - 1]!).reduce((a, b) => (rang(b) > rang(a) ? b : a));
  return lo === hi ? lo : `${lo} bis ${hi}`;
}

/** Left-pads to `n` characters, like Python's f"{s:<n}". */
function pad(s: string, n: number): string {
  return s.padEnd(n);
}

// ---------------------------------------------------------------- catalogue shape

export interface KatalogFeststellung {
  bereich: string;
  prio: string;
  massnahme: string;
  /** B6: the instruction this finding contributes to its measure. */
  schritt?: string;
  /** B18/V15: what this finding leaves open, offered as a topic for the call. */
  offen?: string;
  fach: string;
  titel: string;
  kurz: string;
  feststellung: string;
  angriff: string;
  auswirkung: string;
  aufwand: string;
  aufwand_text: string;
  tech: string;
}

export interface Katalog {
  prio_labels: Record<string, string>;
  level_labels: Record<string, string>;
  status_labels: Record<string, string>;
  bereich_labels: Record<string, string>;
  noten: Array<{ noten: string[]; klasse: string; wort: string; bedeutung: string }>;
  note_unbewertet: { klasse: string; wort: string; bedeutung: string };
  bereiche: Record<string, { label: string; pruefung: string; schutzziel: string; satz: Record<string, string> }>;
  feststellungen: Record<string, KatalogFeststellung>;
  observatory_labels: Record<string, string>;
  positiv: Record<string, string>;
  positiv_einleitung: Record<string, string>;
  massnahmen: Record<
    string,
    {
      titel: string;
      text: string;
      aufwand: string;
      /** B6/V19: who normally carries out this measure. */
      zustaendig?: string;
      /** B14: replacement text when the report has no findings at all. */
      text_ohne_feststellungen?: string;
    }
  >;
  massnahmen_reihenfolge: string[];
  texte: Record<string, unknown>;
}

// ---------------------------------------------------------------- findings

type RohEintrag = [key: string, quelle: string, ctx: Record<string, unknown>];

/**
 * Which catalogue entry each state of each check maps to; `null` means the state
 * is no finding. Declared as data rather than as branches so the coverage test
 * can walk it: every state must have an entry, and every entry a catalogue text.
 *
 * `reject` is no finding because it is the goal — it belongs in the positive
 * list. `einzeln`, `kein_mailserver` and `null_mx` are no findings per B12: one
 * mail server is normal with Microsoft 365 or Google Workspace, and a domain
 * that sends no mail is not defective for having no mail server.
 */
export const ZUSTAND_SCHLUESSEL = {
  dmarc: {
    reject: null,
    quarantine: "dmarc_quarantine",
    none: "dmarc_none",
    ungueltig: "dmarc_ungueltig",
    fehlt: "dmarc_fehlt",
    nicht_pruefbar: "dmarc_nicht_pruefbar",
  },
  spf: {
    ok: null,
    hinweis: "spf_hinweis",
    fehlt: "spf_fehlt",
    nicht_pruefbar: "spf_nicht_pruefbar",
  },
  dkim: {
    ok: null,
    hinweis: "dkim_hinweis",
    nicht_gefunden: "dkim_nicht_gefunden",
    nicht_pruefbar: "dkim_nicht_pruefbar",
  },
  mx: {
    ok: null,
    einzeln: null,
    kein_mailserver: null,
    null_mx: null,
    ohne_ip: "mx_ohne_ip",
    nicht_pruefbar: "mx_nicht_pruefbar",
  },
  mta_sts: {
    ok: null,
    hinweis: "mta_sts_hinweis",
    fehlt: "mta_sts_fehlt",
    nicht_pruefbar: "mta_sts_nicht_pruefbar",
  },
  tls_rpt: {
    ok: null,
    hinweis: "tls_rpt_hinweis",
    fehlt: "tls_rpt_fehlt",
    nicht_pruefbar: "tls_rpt_nicht_pruefbar",
  },
  dnssec: {
    signiert: null,
    nicht_signiert: "dnssec_fehlt",
    fehlerhaft: "dnssec_fehlerhaft",
    nicht_pruefbar: "dnssec_nicht_pruefbar",
  },
} as const satisfies Record<string, Record<string, string | null>>;

/** Looks the state up, refusing to guess when a new state appears. */
function schluessel(bereich: keyof typeof ZUSTAND_SCHLUESSEL, zustand: string): string | null {
  const tabelle = ZUSTAND_SCHLUESSEL[bereich] as Record<string, string | null>;
  if (!(zustand in tabelle)) throw new Error(`Unbekannter Zustand: ${bereich}.${zustand}`);
  return tabelle[zustand]!;
}

/**
 * Derives the catalogue keys that apply, in scan order. Returns raw keys only —
 * priorities, numbering and sorting happen in buildViewmodel.
 */
export function rohFeststellungen(sig: Signal, kat: Katalog): RohEintrag[] {
  const out: RohEintrag[] = [];
  const d = sig.dmarc;
  const mail = sig.mail;

  const dmKey = schluessel("dmarc", d.zustand);
  if (dmKey) out.push([dmKey, "dmarc", { record: d.record ?? "", text: d.text }]);
  if (d.policy !== null && !d.rua) {
    out.push(["dmarc_kein_rua", "dmarc", { record: d.record ?? "", text: d.text }]);
  }

  // SPF. B7: with DMARC already enforcing, a missing SPF endangers the domain's
  // own mail rather than inviting forgery — a different finding, and only
  // "mittel" when DKIM carries the authentication on its own.
  const spf = mail.spf;
  if (spf.zustand === "fehlt") {
    const streng = d.policy === "reject" || d.policy === "quarantine";
    out.push([
      streng ? "spf_fehlt_dmarc_streng" : "spf_fehlt",
      "spf",
      { ...spf, policy: d.policy, _prio: streng && mail.dkim.zustand === "ok" ? "mittel" : null },
    ]);
  } else {
    const k = schluessel("spf", spf.zustand);
    if (k) out.push([k, "spf", { ...spf }]);
  }

  for (const bereich of ["dkim", "mx", "mta_sts", "tls_rpt"] as const) {
    const c = mail[bereich];
    const k = schluessel(bereich, c.zustand);
    if (k) out.push([k, bereich, { ...c }]);
  }

  const dnKey = schluessel("dnssec", sig.dnssec.zustand);
  if (dnKey) out.push([dnKey, "dnssec", { text: sig.dnssec.text }]);

  // Website. Only deductions become findings: a neutral result is no defect and
  // a bonus belongs in the positive list. A website that could not be assessed
  // at all produces no finding either — the area tile says "nicht bewertet".
  const obs = sig.observatory;
  if (obs.available) {
    for (const t of obs.tests) {
      if (t.modifier >= 0) continue;
      const ctx: Record<string, unknown> = {
        label: kat.observatory_labels[t.id] ?? t.id,
        modifier: minus(t.modifier),
        result_text: t.result_text,
        recommendation: t.recommendation,
        _modifier: t.modifier || 0,
      };
      for (const key of [`obs_${t.id}_${t.variant}`, `obs_${t.id}`, "obs_generic"]) {
        if (key in kat.feststellungen) {
          out.push([key, "observatory", ctx]);
          break;
        }
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- view model

export interface ViewmodelOptions {
  /** Base URL images are loaded from. Pass "ASSETS_URL" to compare against the goldens. */
  assets: string;
  /** Report number. Supplied by the caller because it comes from a counter in Odoo. */
  berichtNr: string;
}

export function buildViewmodel(
  sig: Signal,
  kat: Katalog,
  firmaInput: Record<string, unknown>,
  opts: ViewmodelOptions,
): Record<string, unknown> {
  const domain = sig.domain;
  const datum = datumText(sig.scan_date);
  const d = sig.dmarc;
  const dn = sig.dnssec;
  const obs = sig.observatory;
  const mail = sig.mail;
  const basis = { domain, datum, record: d.record || "kein Eintrag" };

  // --- findings
  const roh = rohFeststellungen(sig, kat);
  const findings: Array<Record<string, unknown>> = roh.map(([key, quelle, ctx], i) => {
    const entry = must(kat.feststellungen, key, "feststellungen");
    const c: Record<string, unknown> = { ...basis };
    for (const [k, v] of Object.entries(ctx)) if (!k.startsWith("_")) c[k] = v;
    const f: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry)) f[k] = fill(v, c);
    // B7 lowers the priority of one finding when the measurement warrants it.
    if (ctx._prio) f.prio = ctx._prio;
    const prio = String(f.prio);
    return {
      ...f,
      key,
      quelle,
      prio_label: must(kat.prio_labels, prio, "prio_labels"),
      prio_rang: must(PRIO_RANG, prio, "PRIO_RANG"),
      bereich_label: must(kat.bereich_labels, String(f.bereich), "bereich_labels"),
      modifier: ctx._modifier ?? null,
      signal_text: ctx.result_text || ctx.text || "",
      _order: i,
    };
  });
  findings.sort((a, b) => {
    const ra = a.prio_rang as number, rb = b.prio_rang as number;
    if (ra !== rb) return ra - rb;
    const ba = BEREICH_RANG[String(a.bereich)] ?? 99;
    const bb = BEREICH_RANG[String(b.bereich)] ?? 99;
    if (ba !== bb) return ba - bb;
    const ma = (a.modifier as number) || 0, mb = (b.modifier as number) || 0;
    if (ma !== mb) return ma - mb;
    return (a._order as number) - (b._order as number);
  });
  findings.forEach((f, i) => {
    f.nr = `F-${String(i + 1).padStart(2, "0")}`;
    delete f._order;
  });

  // --- measures
  const order = kat.massnahmen_reihenfolge;
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const f of findings) {
    const k = String(f.massnahme);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(f);
  }
  const keys = [...groups.keys()].sort((a, b) => {
    const pa = Math.min(...groups.get(a)!.map((f) => f.prio_rang as number));
    const pb = Math.min(...groups.get(b)!.map((f) => f.prio_rang as number));
    if (pa !== pb) return pa - pb;
    const oa = order.includes(a) ? order.indexOf(a) : 99;
    const ob = order.includes(b) ? order.indexOf(b) : 99;
    return oa - ob;
  });
  const ohneFeststellungen = findings.length === 0;
  const measures = [...keys, "M_RETEST"].map((k) => {
    const m = must(kat.massnahmen, k, "massnahmen");
    const fs = groups.get(k) ?? [];
    const liste = [...new Set(fs.map((f) => String(f.fach)))].join(", ");
    // B6: the measure text is assembled from the steps of its findings, so the
    // reader gets instructions rather than a list of topics.
    const schritte = [...new Set(fs.map((f) => String(f.schritt ?? "")).filter(Boolean))].join("; ");
    // B6/V1: effort spans are decomposed, then taken from lowest to highest.
    const teile = fs.map((f) => String(f.aufwand).split(" bis "));
    const aufwand = fs.length ? spanne(teile) : m.aufwand;
    const text = ohneFeststellungen && k === "M_RETEST" && m.text_ohne_feststellungen
      ? m.text_ohne_feststellungen
      : m.text;
    return {
      key: k,
      titel: m.titel,
      text: fillStr(text, { liste, schritte }),
      aufwand,
      zustaendig: m.zustaendig ?? null,
      bezug: fs.map((f) => f.nr as string),
      bezug_text: fs.length
        ? fs.map((f) => f.nr as string).join(", ")
        : ohneFeststellungen
          ? "–"
          : "alle",
      prio: fs.length ? (fs[0]!.prio as string) : null,
    } as Record<string, unknown>;
  });
  measures.forEach((m, i) => {
    m.nr = `M-${i + 1}`;
    for (const f of findings) if (f.massnahme === m.key) f.massnahme_nr = m.nr;
  });

  // --- area tiles
  const bEmail = must(kat.bereiche, "email", "bereiche");
  const bDomain = must(kat.bereiche, "domain", "bereiche");
  const bWebsite = must(kat.bereiche, "website", "bereiche");
  const areas: Array<Record<string, unknown>> = [
    {
      key: "email",
      label: bEmail.label, pruefung: bEmail.pruefung, schutzziel: bEmail.schutzziel,
      ...noteInfo(d.grade, kat),
      score: d.score,
      satz: must(bEmail.satz, d.zustand, "bereiche.email.satz"),
      detail: d.record || "kein DMARC-Eintrag veröffentlicht",
    },
    {
      key: "domain",
      label: bDomain.label, pruefung: bDomain.pruefung, schutzziel: bDomain.schutzziel,
      ...noteInfo(dn.grade, kat),
      score: dn.score,
      satz: must(bDomain.satz, dn.zustand, "bereiche.domain.satz"),
      detail: dn.signed ? "Zone signiert" : "Zone nicht signiert",
    },
    {
      key: "website",
      label: bWebsite.label, pruefung: bWebsite.pruefung, schutzziel: bWebsite.schutzziel,
      ...noteInfo(obs.available ? obs.grade : null, kat),
      score: obs.score,
      satz: fillStr(
        must(
          bWebsite.satz,
          !obs.available
            ? "nicht_verfuegbar"
            : obs.passed !== null && obs.passed === obs.total
              ? "bewertet_alle"
              : "bewertet",
          "bereiche.website.satz",
        ),
        { passed: obs.passed, total: obs.total },
      ),
      detail: obs.available ? `${obs.passed} von ${obs.total} Tests bestanden` : "Test nicht verfügbar",
    },
  ];
  for (const a of areas) {
    a.anzahl_feststellungen = findings.filter((f) => f.bereich === a.key).length;
    a.note_hinweis = null;
  }
  // B10: the e-mail grade rates DMARC alone. When SPF, DKIM or transport carry
  // findings, a good grade next to them reads as an all-clear it is not.
  const email = areas[0]!;
  const andere = findings.filter((f) => f.bereich === "email" && f.quelle !== "dmarc");
  if (andere.length && noteInfo(d.grade, kat).klasse === "good") {
    email.note_hinweis = fillStr(must(bEmail as never, "note_hinweis", "bereiche.email"), {
      felder: [...new Set(andere.map((f) => String(f.fach)))].join(" und "),
      nummern: andere.map((f) => f.nr as string).join(", "),
    });
  }

  // --- positive list
  const p = kat.positiv;
  const positives: Array<{ bereich: string; text: string }> = [];
  if (d.policy === "reject") {
    positives.push({ bereich: "email", text: must(p, "dmarc_reject", "positiv") });
  } else if (d.policy === "quarantine") {
    positives.push({ bereich: "email", text: must(p, "dmarc_quarantine", "positiv") });
  }
  if (d.policy !== null && d.rua) {
    positives.push({ bereich: "email", text: must(p, "dmarc_rua", "positiv") });
  }
  for (const [key] of MAIL_CHECKS) {
    if (mail[key].status === "ok") {
      positives.push({ bereich: "email", text: fillStr(must(p, `${key}_ok`, "positiv"), { ...mail[key] }) });
    }
  }
  if (dn.signed) positives.push({ bereich: "domain", text: must(p, "dnssec_ok", "positiv") });
  // Observatory bonuses: a result MDN awards points for is something done right.
  if (obs.available) {
    for (const t of obs.tests) {
      if (t.modifier <= 0) continue;
      const key = `obs_${t.id}_${t.variant}`;
      positives.push({
        bereich: "website",
        text: fillStr(must(p, key, "positiv"), { label: kat.observatory_labels[t.id] ?? t.id }),
      });
    }
  }
  // B13/V4: a report with nothing positive in it reads as hopeless. Partial
  // successes are named only when the list would otherwise stay empty.
  if (!positives.length) {
    for (const [key] of MAIL_CHECKS) {
      const tk = `${key}_teilerfolg`;
      if (mail[key].zustand === "hinweis" && kat.positiv[tk]) {
        positives.push({ bereich: "email", text: fillStr(kat.positiv[tk]!, { ...mail[key] }) });
      }
    }
  }
  const einleitung = must(
    kat.positiv_einleitung,
    d.policy === "reject" || d.policy === "quarantine" ? "dmarc_durchgesetzt" : "standard",
    "positiv_einleitung",
  );

  const counts: Record<string, number> = {};
  for (const k of Object.keys(PRIO_RANG)) counts[k] = findings.filter((f) => f.prio === k).length;
  counts.gesamt = findings.length;

  // --- technical appendix: the signals, unchanged
  const mailChecks = MAIL_CHECKS.map(([k, lbl]) => ({
    key: k,
    label: lbl,
    status: mail[k].status,
    status_label: must(kat.status_labels, mail[k].status, "status_labels"),
    text: mail[k].text,
  }));
  const obsTests = obs.tests.map((t) => ({
    id: t.id,
    label: kat.observatory_labels[t.id] ?? t.id,
    modifier: t.modifier,
    modifier_text: minus(t.modifier),
    result_text: t.result_text,
    recommendation: t.recommendation,
  }));
  const technik = {
    dmarc: { note: d.grade || "–", score: d.score, record: d.record, policy: d.policy, rua: d.rua },
    dnssec: { note: dn.grade || "–", score: dn.score, signed: dn.signed },
    observatory: {
      available: obs.available, note: obs.grade || "–", score: obs.score,
      passed: obs.passed, total: obs.total, tests: obsTests,
    },
    mail: mailChecks,
  };

  const sc = (v: number | null) => (v !== null && v !== undefined ? `Score ${v}` : "");
  const rohdaten: string[] = [
    pad("DMARC", 9) + pad(d.grade || "–", 4) + pad(sc(d.score), 11) +
      (d.record || "— kein Eintrag veröffentlicht —"),
    pad("DNSSEC", 9) + pad(dn.grade || "–", 4) + pad(sc(dn.score), 11) +
      (dn.signed ? "Zone signiert" : "Zone nicht signiert"),
  ];
  if (obs.available) {
    rohdaten.push(
      pad("Website", 9) + pad(obs.grade || "–", 4) + pad(sc(obs.score), 11) +
        `HTTP Observatory: ${obs.passed}/${obs.total} Tests bestanden`,
    );
    // The compact line names what cost points, not every test that ran.
    const abzuege = obsTests.filter((t) => t.modifier < 0);
    if (abzuege.length) {
      rohdaten.push(" ".repeat(24) + abzuege.map((t) => `${t.label} ${t.modifier_text}`).join(" · "));
    }
  } else {
    rohdaten.push(pad("Website", 9) + pad("–", 4) + pad("", 11) + "HTTP Observatory: nicht verfügbar");
  }
  for (const m of mailChecks) {
    rohdaten.push(pad(m.label.split(" ")[0] ?? "", 9) + pad(m.status_label, 15) + m.text);
  }

  const assets = opts.assets;
  const firma = structuredClone(firmaInput) as Record<string, any>;
  for (const k of firma.kontakte) k.foto_url = k.foto ? `${assets}/${k.foto}` : null;
  firma.vorstellung.foto_url = `${assets}/${firma.vorstellung.foto}`;

  // The Handlungsbedarf comes from the scanner, the priorities from the catalogue.
  // When they disagree (e.g. "Hoch" with no high-priority finding), one sentence
  // explains the gap — see katalog.json texte.handlungsbedarf_hinweis.
  const level: SignalLevel = sig.level;
  const hoechste = findings.length
    ? Math.max(...findings.map((f) => must(STUFE, String(f.prio), "STUFE")))
    : 0;
  const stufe = must(STUFE, level, "STUFE");
  const richtung = stufe > hoechste ? "hoeher" : stufe < hoechste ? "niedriger" : null;
  const hinweisTexte = (kat.texte.handlungsbedarf_hinweis ?? {}) as Record<string, string>;
  const hinweis = richtung ? (hinweisTexte[richtung] ?? null) : null;

  const texte: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(kat.texte)) {
    texte[k] = typeof v === "string" ? fill(v, basis) : v;
  }
  // B14/V18: without findings, the appointment text, the plan of action and the
  // re-test offer would all promise work that does not exist.
  if (ohneFeststellungen) {
    texte.cta_text = texte.cta_text_ohne_feststellungen;
    texte.next_text = texte.cta_text_ohne_feststellungen;
    texte.ablauf = [];
    texte.cta_massnahmen = null;
    texte.nachpruefung = null;
  }
  delete texte.cta_text_ohne_feststellungen;

  const nachPrio: Record<string, Array<Record<string, unknown>>> = {};
  for (const k of Object.keys(PRIO_RANG)) nachPrio[k] = findings.filter((f) => f.prio === k);

  return {
    domain,
    datum,
    datum_iso: sig.scan_date,
    bericht_nr: opts.berichtNr,
    level: {
      key: level,
      label: must(kat.level_labels, level, "level_labels"),
      satz: must(kat.texte.zusammenfassung as Record<string, string>, level, "texte.zusammenfassung"),
      hinweis,
    },
    bereiche: areas,
    feststellungen: findings,
    nach_prio: nachPrio,
    anzahl: counts,
    // B9/S17: only "hoch" and "mittel" count as substantial — listing a "gering"
    // finding under "wesentliche Feststellungen" overstates it.
    top: findings.filter((f) => f.prio === "hoch" || f.prio === "mittel").slice(0, 3),
    positiv: positives,
    positiv_einleitung: einleitung,
    massnahmen: measures,
    technik,
    rohdaten,
    noten: kat.noten,
    texte,
    firma,
    assets,
    logo: `${assets}/logo.png`,
    qr_termin: `${assets}/qr-termin.svg`,
  };
}
