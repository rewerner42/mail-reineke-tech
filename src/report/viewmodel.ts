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

/** Left-pads to `n` characters, like Python's f"{s:<n}". */
function pad(s: string, n: number): string {
  return s.padEnd(n);
}

// ---------------------------------------------------------------- catalogue shape

export interface KatalogFeststellung {
  bereich: string;
  prio: string;
  massnahme: string;
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
  massnahmen: Record<string, { titel: string; text: string; aufwand: string }>;
  massnahmen_reihenfolge: string[];
  texte: Record<string, unknown>;
}

// ---------------------------------------------------------------- findings

type RohEintrag = [key: string, quelle: string, ctx: Record<string, unknown>];

/**
 * Derives the catalogue keys that apply, in scan order. Returns raw keys only —
 * priorities, numbering and sorting happen in buildViewmodel.
 */
export function rohFeststellungen(sig: Signal, kat: Katalog): RohEintrag[] {
  const out: RohEintrag[] = [];
  const d = sig.dmarc;
  const mail = sig.mail;
  const pol = d.policy;

  if (pol === null) {
    // B8: a record that exists but carries no readable policy is not "no record".
    out.push(d.record_vorhanden ? ["dmarc_unlesbar", "dmarc", {}] : ["dmarc_fehlt", "dmarc", {}]);
  } else if (pol === "none") {
    out.push(["dmarc_none", "dmarc", {}]);
  } else if (pol === "quarantine") {
    out.push(["dmarc_quarantine", "dmarc", {}]);
  }
  if (pol !== null && !d.rua) out.push(["dmarc_kein_rua", "dmarc", {}]);

  const spf = mail.spf;
  if (spf.status === "mangel") out.push(["spf_fehlt", "spf", { ...spf }]);
  else if (spf.status === "hinweis") out.push(["spf_hinweis", "spf", { ...spf }]);
  else if (spf.status === "unbekannt") out.push(["spf_unbekannt", "spf", { ...spf }]);

  const dkim = mail.dkim;
  if (dkim.status === "unbekannt") out.push(["dkim_unbekannt", "dkim", { ...dkim }]);
  else if (dkim.status !== "ok") {
    out.push([truthy(dkim.selectors) ? "dkim_hinweis" : "dkim_nicht_gefunden", "dkim", { ...dkim }]);
  }

  const mx = mail.mx;
  if (mx.status === "unbekannt") out.push(["mx_unbekannt", "mx", { ...mx }]);
  else if (mx.status !== "ok") {
    out.push([truthy(mx.count) ? "mx_einzeln" : "mx_fehlt", "mx", { ...mx }]);
  }

  for (const [key, stem] of [["mta_sts", "mta_sts"], ["tls_rpt", "tls_rpt"]] as const) {
    const c = mail[key];
    if (c.status === "unbekannt") out.push([`${stem}_unbekannt`, key, { ...c }]);
    else if (c.status !== "ok") out.push([`${stem}_fehlt`, key, { ...c }]);
  }

  if (sig.dnssec.zustand === "fehlerhaft") out.push(["dnssec_fehlerhaft", "dnssec", {}]);
  else if (sig.dnssec.zustand === "nicht_signiert") out.push(["dnssec_fehlt", "dnssec", {}]);

  const obs = sig.observatory;
  if (obs.available) {
    for (const t of obs.tests) {
      // Neutral and positive results are not findings — they belong in the
      // appendix and the positive list. Only deductions become findings.
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
  const measures = [...keys, "M_RETEST"].map((k) => {
    const m = must(kat.massnahmen, k, "massnahmen");
    const fs = groups.get(k) ?? [];
    const liste = [...new Set(fs.map((f) => String(f.fach)))].join(", ");
    return {
      key: k,
      titel: m.titel,
      text: fillStr(m.text, { liste }),
      aufwand: m.aufwand,
      bezug: fs.map((f) => f.nr as string),
      bezug_text: fs.length ? fs.map((f) => f.nr as string).join(", ") : "alle",
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
      satz: must(bEmail.satz, d.policy ?? "fehlt", "bereiche.email.satz"),
      detail: d.record || "kein DMARC-Eintrag veröffentlicht",
    },
    {
      key: "domain",
      label: bDomain.label, pruefung: bDomain.pruefung, schutzziel: bDomain.schutzziel,
      ...noteInfo(dn.grade, kat),
      score: dn.score,
      satz: must(bDomain.satz, dn.signed ? "signiert" : "fehlt", "bereiche.domain.satz"),
      detail: dn.signed ? "Zone signiert" : "Zone nicht signiert",
    },
    {
      key: "website",
      label: bWebsite.label, pruefung: bWebsite.pruefung, schutzziel: bWebsite.schutzziel,
      ...noteInfo(obs.available ? obs.grade : null, kat),
      score: obs.score,
      satz: fillStr(
        must(bWebsite.satz, obs.available ? "bewertet" : "nicht_verfuegbar", "bereiche.website.satz"),
        { passed: obs.passed, total: obs.total },
      ),
      detail: obs.available ? `${obs.passed} von ${obs.total} Tests bestanden` : "Test nicht verfügbar",
    },
  ];
  for (const a of areas) {
    a.anzahl_feststellungen = findings.filter((f) => f.bereich === a.key).length;
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
    top: findings.slice(0, 3),
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
