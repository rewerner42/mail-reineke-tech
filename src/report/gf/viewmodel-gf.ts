// Geschäftsführer-Fassung des Sicherheitschecks (Entwurf, Feedback Marketing 12.11.2026).
//
// Builds on the existing view model instead of re-deriving anything: the findings,
// their priorities and the measures they belong to stay exactly as buildViewmodel()
// computes them. This layer only regroups them into the four questions a managing
// director asks, gives each one a traffic light, and picks the three that get a
// page of their own. Every sentence still comes from a catalogue (katalog-gf.json).

export type Ampel = "rot" | "gelb" | "gruen" | "grau";

/** Worst first. Grey ranks above green: "not checked" must not read as an all-clear. */
const AMPEL_RANG: Record<Ampel, number> = { rot: 0, gelb: 1, grau: 2, gruen: 3 };
const PRIO_RANG: Record<string, number> = { hoch: 0, mittel: 1, gering: 2 };
/** Risk pages per report — one central result per page. */
const MAX_RISIKOSEITEN = 3;

type Vm = Record<string, any>;

interface SeitenText {
  titel: string;
  lead: string;
  bedeutung: string[];
}

export interface GruppenText {
  name: string;
  immer: boolean;
  frage: string;
  antwort: Record<Ampel, string>;
  detail?: { eins: string; mehr: string };
  seite: Partial<Record<"rot" | "gelb", SeitenText>>;
  massnahme: Partial<Record<"rot" | "gelb", string>>;
  tun: Partial<Record<"rot" | "gelb", string>>;
  beibehalten: string;
  zustaendig: string;
}

export interface KatalogGf {
  ampel: Record<Ampel, { wort: string }>;
  zahlwoerter: string[];
  deckblatt: Record<string, string>;
  fuss: string;
  zusammenfassung: {
    label: string;
    titel: Record<"risiken_staerken" | "nur_risiken" | "keine_risiken", string>;
    risiko: { eins: string; mehr: string };
    staerke: { eins: string; mehr: string };
    satz: Record<Ampel, string>;
    geprueft: string;
    verweis: string;
    verweis_massnahmen: string;
    cta_titel: string;
    cta_text: string;
  };
  risiko: {
    kopf: string;
    bedeutung: string;
    tun: string;
    wer: string;
    aufwand: string;
    fundstellen: { eins: string; mehr: string };
  };
  gruppen_reihenfolge: string[];
  gruppen: Record<string, GruppenText>;
  vorstellung: {
    label: string;
    zeilen: Array<{ label: string; text: string }>;
    fakten: Array<{ stark: string; text: string }>;
  };
  massnahmen: Record<string, string>;
  abschluss: {
    titel: string;
    lead: string;
    punkte_label: string;
    punkte: string[];
    button: string;
    qr: string;
  };
}

/** {key} → value; an unknown placeholder is an error, not an empty string. */
function fill(text: string, ctx: Record<string, unknown>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = ctx[key];
    if (v === null || v === undefined) throw new Error(`Platzhalter {${key}} ohne Wert in: ${text}`);
    return String(v);
  });
}

function gross(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function zahlwort(n: number, kgf: KatalogGf): string {
  return kgf.zahlwoerter[n] ?? String(n);
}

/** "F-03, F-04, F-05" → "F-03 bis F-05": runs of three or more are folded. */
export function nummernText(nrs: string[]): string {
  const zahlen = nrs.map((n) => parseInt(n.replace(/\D/g, ""), 10)).sort((a, b) => a - b);
  const nr = (z: number) => `F-${String(z).padStart(2, "0")}`;
  const teile: string[] = [];
  let i = 0;
  while (i < zahlen.length) {
    let j = i;
    while (j + 1 < zahlen.length && zahlen[j + 1] === zahlen[j]! + 1) j++;
    if (j - i >= 2) teile.push(`${nr(zahlen[i]!)} bis ${nr(zahlen[j]!)}`);
    else for (let k = i; k <= j; k++) teile.push(nr(zahlen[k]!));
    i = j + 1;
  }
  return teile.join(", ");
}

export interface GfGruppe {
  key: string;
  name: string;
  frage: string;
  ampel: Ampel;
  ampel_wort: string;
  antwort: string;
  anzahl: number;
  nummern: string;
  /** 1-based rank among the risks, null for green or grey areas. */
  risiko_nr: number | null;
  /** Page this area is explained on, null when it has none of its own. */
  seite: number | null;
  massnahme: string | null;
  tun: string | null;
  aufwand: string | null;
  zustaendig: string;
  beibehalten: string;
  text: SeitenText | null;
  fundstellen: string;
}

export function buildGfViewmodel(vm: Vm, kgf: KatalogGf): Vm {
  const feststellungen = vm.feststellungen as Vm[];
  const massnahmenAlt = new Map((vm.massnahmen as Vm[]).map((m) => [String(m.key), m]));
  const webBewertet = !!vm.technik?.observatory?.available;

  const gruppen: GfGruppe[] = [];
  for (const key of kgf.gruppen_reihenfolge) {
    const t = kgf.gruppen[key];
    if (!t) throw new Error(`katalog-gf: Gruppe ${key} fehlt`);
    const fs = feststellungen.filter((f) => f.massnahme === key);
    if (!fs.length && !t.immer) continue;

    // Traffic light from the findings this area carries: a "hoch" anywhere makes it
    // red, any other finding yellow, none green. Findings that only say "could not be
    // checked" are grey — they are neither a defect nor an all-clear.
    let ampel: Ampel;
    if (!fs.length) ampel = key === "M_WEB" && !webBewertet ? "grau" : "gruen";
    else if (fs.every((f) => String(f.key).endsWith("_nicht_pruefbar"))) ampel = "grau";
    else ampel = fs.some((f) => f.prio === "hoch") ? "rot" : "gelb";

    const stufe = ampel === "rot" || ampel === "gelb" ? ampel : null;
    const andere = ampel === "rot" ? "gelb" : "rot";
    const detail = t.detail
      ? fs.length === 1
        ? t.detail.eins
        : fill(t.detail.mehr, { anzahl_wort: gross(zahlwort(fs.length, kgf)) })
      : "";
    const alt = massnahmenAlt.get(key);
    const nummern = nummernText(fs.map((f) => String(f.nr)));
    gruppen.push({
      key,
      name: t.name,
      frage: t.frage,
      ampel,
      ampel_wort: kgf.ampel[ampel].wort,
      antwort: fill(t.antwort[ampel], { detail }),
      anzahl: fs.length,
      nummern,
      risiko_nr: null,
      seite: null,
      massnahme: stufe ? (t.massnahme[stufe] ?? t.massnahme[andere] ?? null) : null,
      tun: stufe ? (t.tun[stufe] ?? t.tun[andere] ?? null) : null,
      aufwand: alt ? gross(String(alt.aufwand)) : null,
      zustaendig: t.zustaendig,
      beibehalten: t.beibehalten,
      text: stufe ? (t.seite[stufe] ?? t.seite[andere] ?? null) : null,
      fundstellen: fs.length
        ? fs.length === 1
          ? fill(kgf.risiko.fundstellen.eins, { nummern })
          : fill(kgf.risiko.fundstellen.mehr, { anzahl_wort: zahlwort(fs.length, kgf), nummern })
        : "",
    });
  }

  // Worst first; at equal colour the area whose worst finding ranks higher, then the
  // catalogue order (e-mail sender protection before website before domain).
  const worst = (g: GfGruppe) =>
    Math.min(...feststellungen.filter((f) => f.massnahme === g.key).map((f) => PRIO_RANG[f.prio] ?? 9), 9);
  gruppen.sort(
    (a, b) =>
      AMPEL_RANG[a.ampel] - AMPEL_RANG[b.ampel] ||
      worst(a) - worst(b) ||
      kgf.gruppen_reihenfolge.indexOf(a.key) - kgf.gruppen_reihenfolge.indexOf(b.key),
  );

  const risiken = gruppen.filter((g) => g.ampel === "rot" || g.ampel === "gelb");
  const staerken = gruppen.filter((g) => g.ampel === "gruen");
  const seitenRisiken = risiken.slice(0, MAX_RISIKOSEITEN);

  // Page plan: cover, summary, contact person, one page per risk, measures, invitation.
  const P_RISIKO = 4;
  const P_MASSNAHMEN = P_RISIKO + seitenRisiken.length;
  const N = P_MASSNAHMEN + 1;
  risiken.forEach((g, i) => {
    g.risiko_nr = i + 1;
    g.seite = i < MAX_RISIKOSEITEN ? P_RISIKO + i : P_MASSNAHMEN;
  });

  // Overall verdict: the worst light among the areas. Grey only when nothing at all
  // could be rated — a single unchecked area does not cancel a green elsewhere.
  const gesamt: Ampel = risiken.length
    ? risiken[0]!.ampel
    : staerken.length
      ? "gruen"
      : "grau";

  const z = kgf.zusammenfassung;
  const risikoText = risiken.length === 1 ? z.risiko.eins : fill(z.risiko.mehr, { zahl: zahlwort(risiken.length, kgf) });
  const staerkeText = staerken.length === 1 ? z.staerke.eins : fill(z.staerke.mehr, { zahl: zahlwort(staerken.length, kgf) });
  const titel = gross(
    !risiken.length
      ? z.titel.keine_risiken
      : staerken.length
        ? fill(z.titel.risiken_staerken, { risiken: risikoText, staerken: staerkeText })
        : fill(z.titel.nur_risiken, { risiken: risikoText }),
  );

  const firma = vm.firma as Vm;
  const kontakt = firma.kontakte[0] as Vm;
  const basis = { domain: vm.domain, datum: vm.datum };

  return {
    domain: vm.domain,
    datum: vm.datum,
    bericht_nr: vm.bericht_nr,
    N,
    seiten: { zusammenfassung: 2, vorstellung: 3, massnahmen: P_MASSNAHMEN, abschluss: N },
    gesamt: { ampel: gesamt, wort: kgf.ampel[gesamt].wort, satz: fill(z.satz[gesamt], basis) },
    titel,
    gruppen,
    risiken,
    seiten_risiken: seitenRisiken,
    staerken,
    k: kgf,
    texte: {
      fuss: fill(kgf.fuss, basis),
      erstellt: fill(kgf.deckblatt.erstellt!, { datum: vm.datum, autor: kontakt.name, firma: firma.name }),
      vertraulich: fill(kgf.deckblatt.vertraulich!, basis),
      geprueft: fill(z.geprueft, basis),
      umfang: fill(kgf.massnahmen.umfang!, { umfang_kurz: vm.texte.umfang_kurz }),
    },
    firma,
    kontakt,
    assets: vm.assets,
    qr_termin: vm.qr_termin,
  };
}
