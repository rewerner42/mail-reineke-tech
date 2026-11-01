// Page planning: where the breaks fall, before anything is rendered.
//
// A faithful port of the planning block in tools/referenz/vorlage/template.html.j2
// (the {% set %} section at its top). The report has a fixed chapter order, and
// every block's height is estimated in millimetres from its character count —
// characters per line at the given column width, rounded up, calibrated against
// browser measurements and deliberately erring high. A page's text area is
// 242 mm (297 minus 31 top and 24 bottom).
//
// The constants are calibrated, not derived: do not tidy them. After any change
// to the catalogue or this file, run `npm run bericht:pruefen` — it renders every
// dataset with headless Chrome and reports both the page count and any element
// that crosses the print margin.

import { truthy } from "./viewmodel.js";

/** Text area of one page in mm. */
const SATZSPIEGEL = 242;
/** The pentest box including its spacing, measured at 89.7 mm; the estimate errs high. */
const PENTEST = 90;
/** One-line lead-in above the recommendations, present only when there are findings. */
const VORSPANN_EMP = 8;
/** Chapter heading of 05 on its first page. */
const KOPF02 = 30;

/** Characters per line, by the column the block sits in. */
const ZEILE = {
  feststellung: 33,
  angriff: 33,
  auswirkung: 31,
  aufwand: 33,
  titel: 48,
  tech: 80,
  gering_titel: 70,
  gering_kurz: 74,
  gering_aufwand: 84,
  positiv_einleitung: 70,
  positiv_text: 66,
  massnahme_text: 56,
  massnahme_titel: 52,
  /** V19: the "usually responsible" line under a measure, set in 8 pt. */
  massnahme_zust: 62,
  obs_result: 58,
} as const;

/** Lines a text needs at the given width. Jinja2's `|round(0, 'ceil')`. */
function zeilen(text: unknown, breite: number): number {
  return Math.ceil(String(text ?? "").length / breite);
}

export interface Feststellung {
  nr: string;
  titel: string;
  kurz: string;
  feststellung: string;
  angriff: string;
  auswirkung: string;
  aufwand: string;
  aufwand_text: string;
  tech: string;
  prio: string;
}

export interface Massnahme {
  titel: string;
  text: string;
  bezug: string[];
  zustaendig?: string | null;
}

export interface PlanEingabe {
  feststellungen: Feststellung[];
  nach_prio: Record<string, Feststellung[]>;
  positiv: Array<{ text: string }>;
  positiv_einleitung: string;
  massnahmen: Massnahme[];
  texte: { zusammenfassung_labels: { zustaendig: string } };
  technik: {
    dmarc: { record: string | null };
    observatory: { tests: Array<{ result_text: string; recommendation: string }> };
  };
}

export interface Seitenplan {
  /** Total page count. */
  N: number;
  /** Chapter 05, high and medium findings, split into pages. */
  fseiten: Feststellung[][];
  /** Whether the "minor findings / already done well" page exists at all. */
  weitere: boolean;
  /** Whether "already done well" needs a page of its own. */
  w_split: boolean;
  /** Where the pentest box goes. */
  pt_emp: boolean;
  pt_eigen: boolean;
  /** Whether the website measurements need a continuation page. */
  web_extra: boolean;
  /** First page of chapter 05. */
  F_START: number;
  /** Finding number → the page it is on, for the cross references. */
  FS: Record<string, number>;
  /** Chapter start pages for the table of contents. */
  P_ZF: number;
  P_EMP: number;
  P_PT: number;
  P_UEBER: number;
  P_NEXT: number;
  P_UMGESETZT: number;
  P_ANH_A: number;
  P_ANH_B: number;
}

/** Estimated height of one full finding card in chapter 05. */
function hoeheFeststellung(f: Feststellung): number {
  const l1 = zeilen(f.feststellung, ZEILE.feststellung);
  const l2 = zeilen(f.angriff, ZEILE.angriff);
  const l3 =
    zeilen(f.auswirkung, ZEILE.auswirkung) +
    Math.ceil((f.aufwand.length + f.aufwand_text.length + 2) / ZEILE.aufwand);
  return (
    24 +
    5.7 * (zeilen(f.titel, ZEILE.titel) - 1) +
    Math.max(4.5 * l1, 4.5 * l2, 4.5 * l3 + 7.3) +
    3.2 +
    3.6 * zeilen(f.tech, ZEILE.tech)
  );
}

export function seitenplan(v: PlanEingabe): Seitenplan {
  const haupt = [...(v.nach_prio.hoch ?? []), ...(v.nach_prio.mittel ?? [])];
  const gering = v.nach_prio.gering ?? [];

  // Chapter 05: at most three findings per page, fewer when the estimate says so.
  const fseiten: Feststellung[][] = [];
  let akt: Feststellung[] = [];
  let h = 0;
  for (const f of haupt) {
    const hf = hoeheFeststellung(f);
    const budget = SATZSPIEGEL - (truthy(fseiten) ? 0 : KOPF02);
    if (truthy(akt) && (akt.length === 3 || h + 7 + hf > budget)) {
      fseiten.push(akt);
      akt = [];
      h = 0;
    }
    h = h + (truthy(akt) ? 7 : 0) + hf;
    akt = [...akt, f];
  }
  if (truthy(akt)) fseiten.push(akt);

  // Chapter 05: minor findings and what is already done well.
  // The empty-array trap: in Jinja2 and Python an empty list is false, in
  // JavaScript it is true. Written with truthy() for that reason — a bare
  // `gering.length || ...` would be right here but `if (gering)` would not, and
  // this line decides whether the report has an extra page.
  const weitere = truthy(gering) || truthy(v.positiv) || !truthy(haupt);
  let hg = 0;
  if (truthy(gering)) {
    hg = 16.5;
    for (const f of gering) {
      hg +=
        6 +
        4.4 *
          (zeilen(f.titel, ZEILE.gering_titel) +
            zeilen(f.kurz, ZEILE.gering_kurz) +
            Math.ceil((f.aufwand_text.length + 16) / ZEILE.gering_aufwand));
    }
  }
  let hp = 0;
  if (truthy(v.positiv)) {
    hp = 16.5 + 5.2 * zeilen(v.positiv_einleitung, ZEILE.positiv_einleitung);
    for (const x of v.positiv) hp += 8.8 + 4.7 * (zeilen(x.text, ZEILE.positiv_text) - 1);
  }
  const hw_kopf = (truthy(haupt) ? 0 : 15.5) + (truthy(v.feststellungen) ? 0 : 12);
  const w_split = hw_kopf + hg + hp > SATZSPIEGEL;

  // Chapter 02: recommendations.
  let hemp = 24.4 + (truthy(v.feststellungen) ? VORSPANN_EMP : 0);
  for (const m of v.massnahmen) {
    const tl =
      zeilen(m.text, ZEILE.massnahme_text) + zeilen(m.titel, ZEILE.massnahme_titel) - 1;
    const bl = truthy(m.bezug) ? Math.ceil((m.bezug.length + 1) / 3) : 1;
    // V19: the line naming who usually carries the measure out.
    const zl = m.zustaendig
      ? Math.ceil(
          (v.texte.zusammenfassung_labels.zustaendig.length + m.zustaendig.length + 2) /
            ZEILE.massnahme_zust,
        )
      : 0;
    hemp += Math.max(11.3 + 4.3 * tl + (zl ? 0.8 + 3.95 * zl : 0), 9.9 + 3.95 * bl);
  }
  const pt_emp = hemp + PENTEST <= SATZSPIEGEL;
  const pt_eigen = !pt_emp;

  // Appendix A: measurements.
  let mh = 121 + (truthy(v.technik.dmarc.record) && v.technik.dmarc.record!.length > 56 ? 4.2 : 0);
  for (const x of v.technik.observatory.tests) {
    mh +=
      3.8 +
      3.9 *
        (zeilen(x.result_text, ZEILE.obs_result) +
          Math.ceil((x.recommendation.length + 12) / ZEILE.obs_result));
  }
  const web_extra = mh > SATZSPIEGEL - 3;

  const N =
    3 +
    fseiten.length +
    (weitere ? 1 : 0) +
    (w_split ? 1 : 0) +
    1 +
    (pt_eigen ? 1 : 0) +
    1 +
    1 +
    2 +
    (web_extra ? 1 : 0);

  // Page 2 contents, 3 summary, 4 recommendations (+1 pentest), then about us,
  // next step, then chapter 05.
  const F_START = 7 + (pt_eigen ? 1 : 0);
  const FS: Record<string, number> = {};
  fseiten.forEach((chunk, i) => {
    for (const f of chunk) FS[f.nr] = F_START + i;
  });
  for (const f of gering) FS[f.nr] = F_START + fseiten.length;

  const P_EMP = 4;
  const P_ANH_A = F_START + fseiten.length + (weitere ? 1 : 0) + (w_split ? 1 : 0);
  return {
    N, fseiten, weitere, w_split, pt_emp, pt_eigen, web_extra, F_START, FS,
    P_ZF: 3,
    P_EMP,
    P_PT: P_EMP + (pt_eigen ? 1 : 0),
    P_UEBER: F_START - 2,
    P_NEXT: F_START - 1,
    P_UMGESETZT: F_START + fseiten.length + (w_split ? 1 : 0),
    P_ANH_A,
    P_ANH_B: P_ANH_A + 1 + (web_extra ? 1 : 0),
  };
}
