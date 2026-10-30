// The report's HTML, a port of tools/referenz/vorlage/template.html.j2.
//
// Workers cannot run Jinja2 (and forbid eval, so a precompiled template engine
// is out), so the template is written out by hand here. The structure, the class
// names and the order of the chapters follow the original line for line; the
// stylesheet is copied from it verbatim (css.ts) rather than retyped.
//
// tools/template-pruefen.ts renders the same view model through both
// implementations and compares the result, so a divergence shows up as a failing
// check rather than as a quietly different PDF.

import { BERICHT_CSS, DECKBLATT_CSS } from "./css.js";
import { seitenplan, type Seitenplan } from "./seitenplan.js";
import { minus } from "./viewmodel.js";

/**
 * The view model, as the template sees it. Deliberately loose: this file reads
 * like the template it replaces, and every field it touches is covered by the
 * comparison against the original.
 */
type Vm = Record<string, any>;

/** Jinja2's autoescape, character for character. */
function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/>/g, "&gt;")
    .replace(/</g, "&lt;")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&#34;");
}

/** Jinja2's `|capitalize`: first character upper, the rest lower. */
function cap(v: unknown): string {
  const s = String(v ?? "");
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** The grade, with its modifier set smaller: "A+" → A, then +. */
function note(n: string): string {
  const kopf = `<span>${esc(n.slice(0, 1))}</span>`;
  return n.length > 1 ? `${kopf}<span class="mod">${esc(minus(n.slice(1)))}</span>` : kopf;
}

const HB_HEISST: Record<string, string> = {
  gering: "Einzelne Punkte bei Gelegenheit verbessern.",
  mittel: "Verbesserungen fest einplanen.",
  hoch: "Lücken zeitnah schließen.",
  kritisch: "Lücken vorrangig schließen.",
};

const SKALA = ["gering", "mittel", "hoch", "kritisch"];

export function berichtHtml(v: Vm): string {
  const p: Seitenplan = seitenplan(v as never);
  const { fseiten, weitere, w_split, pt_emp, pt_eigen, web_extra, F_START, FS, N } = p;
  const t = v.technik;
  const lvl = v.level.key as string;
  const haupt = [...v.nach_prio.hoch, ...v.nach_prio.mittel];
  const gering = v.nach_prio.gering as Vm[];
  const klasse = (key: string) => v.bereiche.find((a: Vm) => a.key === key).klasse;
  const k_mail = klasse("email"), k_dns = klasse("domain"), k_web = klasse("website");

  let seite = 1;
  const out: string[] = [];
  const w = (s: string) => out.push(s);

  const kopf = (kap: string) => `<div class="kopf">
  <div class="k-marke"><span class="fuchs"><img src="${esc(v.logo)}" alt=""></span><b>${esc(v.firma.kurzname)}</b><span>Sicherheitsbefund</span></div>
  <div class="k-domain">${esc(v.domain)}</div>
  <div class="k-kap">${esc(kap)}</div>
</div>`;

  const fuss = (n: number) =>
    `<div class="fuss"><span class="f1">${esc(v.firma.name)} · Vertraulich</span><span class="f2">Bericht-Nr. ${esc(v.bericht_nr)}</span><span class="f3">Seite ${n} von ${N}</span></div>`;

  const befund = (f: Vm, erst: boolean) => `<article class="bf${erst ? " erst" : ""}" id="${esc(f.nr)}">
  <div class="r6 bf-kopf">
    <div class="s12 bf-nr">${esc(f.nr)}</div>
    <h2 class="s36">${esc(f.titel)}</h2>
  </div>
  <div class="r6 bf-meta">
    <div class="s12"><span class="prio ${esc(f.prio)}">${esc(f.prio_label)}</span></div>
    <div class="s36 bf-fach">${esc(f.bereich_label)} · ${esc(f.fach)} · <a href="#${esc(f.massnahme_nr)}">Maßnahme ${esc(f.massnahme_nr)}</a></div>
  </div>
  <div class="r6 bf-text">
    <div class="s12"><span class="label">Feststellung</span><p>${esc(f.feststellung)}</p></div>
    <div class="s34"><span class="label">Angriffsszenario</span><p>${esc(f.angriff)}</p></div>
    <div class="s56"><span class="label">Auswirkung für Sie</span><p class="wirk">${esc(f.auswirkung)}</p>
      <span class="label">Aufwand</span><p>${esc(cap(f.aufwand))}. ${esc(f.aufwand_text)}</p></div>
  </div>
  <div class="r6 bf-tech">
    <div class="s12"><span class="label">Technischer Befund</span></div>
    <div class="s36 mono">${esc(f.tech)}</div>
  </div>
</article>`;

  const umgesetztBlock = (abstand: string) => `<div class="r6 ${esc(abstand)} linie umgesetzt" id="umgesetzt">
  <div class="s12"><span class="prio ok">Bereits umgesetzt</span><div class="zahl">${v.positiv.length}</div><span class="klein">${v.positiv.length === 1 ? "Punkt" : "Punkte"}</span></div>
  <div class="s36">
    <p class="lead-s">${esc(v.positiv_einleitung)}</p>
    <ul class="positiv-liste">${v.positiv.map((x: Vm) => `<li>${esc(x.text)}</li>`).join("")}</ul>
  </div>
</div>`;

  const pentestBlock = (abstand: string) => `<div class="r6 ${esc(abstand)} linie pentest" id="pentest">
  <div class="s12">
    <span class="label">Penetrationstest</span>
    <ul class="arten">
      ${v.firma.pentest_arten.map((k: Vm) => `<li><b>${esc(k.titel)}</b><span>${esc(k.text)}</span></li>`).join("")}
    </ul>
  </div>
  <div class="s36">
    <h2>${esc(v.texte.pentest_titel)}</h2>
    <p class="lead-s">${esc(v.texte.pentest_text)}</p>
    <ol class="schritte r2">
      ${v.texte.pentest_ablauf.map((s: Vm, i: number) => `<li><span class="n">${i + 1}</span><span><b>${esc(s.titel)}</b>${esc(s.text)}</span></li>`).join("")}
    </ol>
    <p class="klein link">Umfang und Anfrage: <a class="unterstr" href="${esc(v.firma.pentest_url)}">${esc(v.firma.pentest_label)}</a></p>
  </div>
</div>`;

  // ---------------------------------------------------------------- head
  w(`<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Sicherheitsbefund ${esc(v.domain)}</title>
<style>${BERICHT_CSS}</style>
</head>
<body>`);

  // ---------------------------------------------------------------- cover
  const dl = String(v.domain).length;
  w(`<section class="page dcw${dl > 34 ? " dcw--xl" : dl > 26 ? " dcw--l" : ""}">
<style>${DECKBLATT_CSS}</style>
  <div class="dcw-logo"><img class="dcw-fuchs" src="${esc(v.logo)}" alt="Reineke Technik"><img class="dcw-wort" src="${esc(v.logo)}" alt=""></div>
  <div class="dcw-titel">
    <div class="dcw-kicker">SICHERHEITSBEFUND · E-MAIL, DOMAIN UND WEBSITE</div>
    <div class="dcw-domain">${esc(v.domain)}</div>
    <p class="dcw-sub">Unabhängige Prüfung der von außen sichtbaren Sicherheit von ${esc(v.domain)}. Automatisierte Analyse mit ${esc(v.firma.scan_host)}.</p>
    <div class="dcw-spruch">${v.firma.slogan.map((z: string, i: number) => `<div class="dcw-z${i + 1}">${esc(z)}</div>`).join("")}</div>
  </div>
  <div class="dcw-fuss">
    <div><span class="dcw-l">Erstellt von</span><p><b>${esc(v.firma.name)}</b><br>${esc(v.firma.strasse)} · ${esc(v.firma.plz_ort)}<br>${esc(v.firma.web)}</p></div>
    <div><span class="dcw-l">Prüfdatum</span><p>${esc(v.datum)}<br>Bericht-Nr. ${esc(v.bericht_nr)}</p></div>
    <div><span class="dcw-l">Vertraulich</span><p>Nur für den internen Gebrauch der Adressaten bestimmt.</p></div>
  </div>
</section>`);

  // ---------------------------------------------------------------- contents
  seite++;
  w(`<section class="page pg seite-inhalt">
  ${kopf("Inhalt")}
  <div class="r6 kk"><div class="nr"></div><h1>Inhalt</h1></div>
  <div class="r6 inh-hinweis"><p class="s36">Für die Geschäftsführung: Kapitel 01 bis 04. Für Ihre IT: Kapitel 05 und der Anhang.</p></div>
  <div class="inh${v.feststellungen.length > 14 ? " inh--kompakt" : ""}">
    <a class="inh-kap" href="#kap-01"><span class="inh-nr">01</span><span class="inh-t">Zusammenfassung</span><span class="inh-s">${p.P_ZF}</span></a>
    <a class="inh-kap" href="#kap-02"><span class="inh-nr">02</span><span class="inh-t">Empfehlungen</span><span class="inh-s">${p.P_EMP}</span></a>
    <a class="inh-sub" href="#pentest"><span class="inh-nr"></span><span class="inh-t">${esc(v.texte.pentest_titel)}</span><span class="inh-s">${p.P_PT}</span></a>
    <a class="inh-kap" href="#kap-03"><span class="inh-nr">03</span><span class="inh-t">Über ${esc(v.firma.kurzname)}</span><span class="inh-s">${p.P_UEBER}</span></a>
    <a class="inh-kap" href="#kap-04"><span class="inh-nr">04</span><span class="inh-t">Nächster Schritt</span><span class="inh-s">${p.P_NEXT}</span></a>
    <a class="inh-sub" href="#kap-04"><span class="inh-nr"></span><span class="inh-t">${esc(v.texte.cta_titel)}: Termin direkt aus dem Bericht buchen</span><span class="inh-s">${p.P_NEXT}</span></a>
    <a class="inh-kap" href="#kap-05"><span class="inh-nr">05</span><span class="inh-t">Feststellungen im Einzelnen</span><span class="inh-s">${F_START}</span></a>
    ${v.feststellungen.map((f: Vm) => `<a class="inh-sub" href="#${esc(f.nr)}"><span class="inh-nr"><span class="prio ${esc(f.prio)}"></span>${esc(f.nr)}</span><span class="inh-t">${esc(f.titel)}</span><span class="inh-s">${FS[f.nr]}</span></a>`).join("")}
    ${v.positiv.length ? `<a class="inh-sub" href="#umgesetzt"><span class="inh-nr"></span><span class="inh-t">Bereits umgesetzt</span><span class="inh-s">${p.P_UMGESETZT}</span></a>` : ""}
    <a class="inh-kap" href="#kap-a"><span class="inh-nr">A</span><span class="inh-t">Messwerte</span><span class="inh-s">${p.P_ANH_A}</span></a>
    <a class="inh-kap" href="#kap-b"><span class="inh-nr">B</span><span class="inh-t">Methodik und Bewertung</span><span class="inh-s">${p.P_ANH_B}</span></a>
  </div>
  ${fuss(seite)}
</section>`);

  // ---------------------------------------------------------------- 01 summary
  seite++;
  w(`<section class="page pg seite-zf">
  ${kopf("Zusammenfassung")}
  <div class="r6 kk" id="kap-01"><div class="nr">01</div><h1>Zusammenfassung</h1></div>

  <div class="r6 urteil lv-${esc(lvl)}">
    <div class="s12"><span class="label">Gesamturteil</span><p class="marginalie">${esc(v.texte.methode_kurz)}</p>${v.level.hinweis ? `<p class="marginalie hb-hinweis">${esc(v.level.hinweis)}</p>` : ""}</div>
    <div class="s36">
      <div class="hb">Handlungsbedarf</div>
      <div class="zeile">
        <div class="wort">${esc(v.level.label)}</div>
        <div class="heisst">Das heißt:<b>${esc(HB_HEISST[lvl])}</b></div>
      </div>
      <div class="skala">
        ${SKALA.map((k) => `<div${k === lvl ? ' class="an"' : ""}>${esc(cap(k))}</div>`).join("")}
      </div>
      <p class="lead">${esc(v.level.satz)}</p>
    </div>
  </div>

  <div class="blk">
    <div class="noten">
      ${v.bereiche.map((a: Vm) => `<div class="nt">
        <span class="label">${esc(a.label)} · ${esc(a.pruefung)}</span>
        <div class="schutz">${esc(a.schutzziel)}</div>
        <div class="note ${esc(a.klasse)}">${note(String(a.note))}</div>
        <div class="wort ${esc(a.klasse)}">${esc(a.wort)}</div>
        <div class="nt-mini">${v.noten.map((n: Vm) => `<span class="${esc(n.klasse)}${n.noten.includes(a.note) ? " an" : ""}">${esc(String(n.noten[0]).slice(0, 1))}</span>`).join("")}</div>
        <p class="satz">${esc(a.satz)}</p>
        <div class="meta">${a.score !== null && a.score !== undefined ? `Score ${esc(a.score)} · ` : ""}${esc(a.bedeutung)}</div>
      </div>`).join("")}
    </div>
    <div class="nsk2"><span class="label">Notenskala</span>${v.noten.map((n: Vm) => `<span><i class="${esc(n.klasse)}"></i><b>${esc(minus(n.noten[0]))}${n.noten.length > 1 ? ` bis ${esc(minus(n.noten[n.noten.length - 1]))}` : ""}</b> ${esc(String(n.wort).toLowerCase())}</span>`).join("")}</div>
  </div>

  ${v.top.length ? `<div class="r6 blk linie top3">
    <div class="s12 zaehler">
      <span class="label">Wesentliche Feststellungen</span>
      <div class="zahl">${esc(v.anzahl.gesamt)}</div>
      <span class="klein">Feststellungen insgesamt</span>
      <ul class="verteilung">
        <li><span class="prio hoch">Hoch</span><b>${esc(v.anzahl.hoch)}</b></li>
        <li><span class="prio mittel">Mittel</span><b>${esc(v.anzahl.mittel)}</b></li>
        <li><span class="prio gering">Gering</span><b>${esc(v.anzahl.gering)}</b></li>
      </ul>
    </div>
    <ol class="s36">
      ${v.top.map((f: Vm) => `<li><span class="fnr">${esc(f.nr)}</span><span><a href="#${esc(f.nr)}"><b>${esc(f.titel)}</b></a><span class="kurz">${esc(f.kurz)}</span></span><span class="rechts"><span class="prio ${esc(f.prio)}">${esc(f.prio_label)}</span><a class="seite" href="#${esc(f.nr)}">Seite ${FS[f.nr]}</a></span></li>`).join("")}
    </ol>
  </div>` : ""}

  <div class="r6 blk linie cta">
    <div class="s12"><span class="label">Nächster Schritt</span><b>${esc(v.texte.cta_titel)}</b></div>
    <p class="s34">${esc(v.texte.cta_text)}</p>
    <div class="s56 cta-knopf"><a class="btn" href="${esc(v.firma.booking_url)}">${esc(v.texte.cta_button)}</a></div>
  </div>
  ${fuss(seite)}
</section>`);

  // ---------------------------------------------------------------- 02 recommendations
  seite++;
  const bezug = (m: Vm) => {
    if (!m.bezug.length) return esc(cap(m.bezug_text));
    const ps: number[] = [];
    const links = m.bezug.map((b: string, i: number) => {
      if (!ps.includes(FS[b]!)) ps.push(FS[b]!);
      return `<a class="nw" href="#${esc(b)}">${esc(b)}</a>${i < m.bezug.length - 1 ? ", " : ""}`;
    }).join("");
    ps.sort((a, b) => a - b);
    const erst = ps[0]!, letzt = ps[ps.length - 1]!;
    const spanne = ps.length > 1 && letzt - erst + 1 === ps.length ? `${erst}–${letzt}` : ps.join(", ");
    return `${links} <span class="seitenref">· S.&nbsp;${spanne}</span>`;
  };
  w(`<section class="page pg">
  ${kopf("Empfehlungen")}
  <div class="r6 kk${v.feststellungen.length ? " kk-mit" : ""}" id="kap-02"><div class="nr">02</div><h1>Empfehlungen</h1></div>
  ${v.feststellungen.length ? `<div class="r6 vorspann"><p class="s36">Details zu den Feststellungen: Kapitel 05 ab Seite ${F_START}.</p></div>` : ""}
  <div class="r6 kopfzeile">
    <div class="s1"><span class="label">Nr.</span></div>
    <div class="s2"><span class="label">Dringlichkeit</span></div>
    <div class="s35"><span class="label">Maßnahme</span></div>
    <div class="s6"><span class="label">Aufwand</span><span class="label hell">Bezug</span></div>
  </div>
  ${v.massnahmen.map((m: Vm, i: number) => `<div class="r6 mz${i === 0 ? " erst" : ""}" id="${esc(m.nr)}">
    <div class="s1 mnr">${esc(m.nr)}</div>
    <div class="s2">${m.prio ? `<span class="prio ${esc(m.prio)}">${esc(cap(m.prio))}</span>` : `<span class="klein">Abschluss</span>`}</div>
    <div class="s35"><b>${esc(m.titel)}</b><p>${esc(m.text)}</p></div>
    <div class="s6"><div class="wert">${esc(cap(m.aufwand))}</div><div class="bezug">${bezug(m)}</div></div>
  </div>`).join("")}

  ${pt_emp ? pentestBlock("blk") : ""}
  ${fuss(seite)}
</section>`);

  if (pt_eigen) {
    seite++;
    w(`<section class="page pg">
  ${kopf("Empfehlungen")}
  ${pentestBlock("")}
  ${fuss(seite)}
</section>`);
  }

  // ---------------------------------------------------------------- 03 about
  seite++;
  w(`<section class="page pg">
  ${kopf(`Über ${v.firma.kurzname}`)}
  <div class="r6 kk" id="kap-03"><div class="nr">03</div><h1>Über ${esc(v.firma.kurzname)}</h1></div>
  <div class="r6 person">
    <div class="s12"><img class="portrait" src="${esc(v.firma.vorstellung.foto_url)}" alt="${esc(v.firma.vorstellung.name)}"></div>
    <div class="s36">
      <div class="p-name">${esc(v.firma.vorstellung.name)}</div>
      <div class="p-rolle">${esc(v.firma.vorstellung.rolle)}</div>
      ${v.firma.vorstellung.absaetze.map((a: string) => `<p class="lead-s">${esc(a)}</p>`).join("")}
    </div>
  </div>
  <div class="r6 blk">
    <p class="s36 zitat">„${v.firma.slogan.map((z: string, i: number) => `${esc(z)}${i < v.firma.slogan.length - 1 ? "<br>" : ""}`).join("")}“</p>
  </div>
  <div class="r3 drei blk">
    ${v.firma.prinzipien.map((x: Vm) => `<div><h3>${esc(x.titel)}</h3><p>${esc(x.text)}</p></div>`).join("")}
  </div>
  <div class="r3 drei blk">
    ${v.firma.vertrauen.map((x: Vm) => `<div><span class="label">${esc(x.label)}</span><div class="v-wert${String(x.wert).length > 14 ? " lang" : ""}">${esc(x.wert)}</div><p>${esc(x.text)}</p></div>`).join("")}
  </div>
  <div class="r6 blk linie">
    <div class="s12"><span class="label">Leistungen</span></div>
    <ul class="s36 leist">${v.firma.leistungen.map((l: string) => `<li>${esc(l)}</li>`).join("")}</ul>
  </div>
  ${fuss(seite)}
</section>`);

  // ---------------------------------------------------------------- 04 next step
  seite++;
  w(`<section class="page pg spalte">
  ${kopf("Nächster Schritt")}
  <div class="r6 kk" id="kap-04"><div class="nr">04</div><h1>Nächster Schritt</h1></div>
  <div class="r6 cta-gross">
    <div class="s12"><span class="label">${esc(v.texte.cta_titel)}</span><span class="klein">${esc(v.domain)}</span></div>
    <div class="s34"><p class="lead">${esc(v.texte.cta_text)}</p><a class="btn" href="${esc(v.firma.booking_url)}">${esc(v.texte.cta_button)}</a></div>
    <div class="s56 qr"><a href="${esc(v.firma.booking_url)}"><img src="${esc(v.qr_termin)}" alt="QR-Code zur Terminbuchung"></a><div class="klein">Termin per QR-Code</div></div>
  </div>
  <div class="r3 drei ablauf blk">
    ${(v.texte.ablauf as Vm[]).map((s, i) => `<div><span class="label">Schritt</span><div class="gz-n">${i + 1}</div><h3>${esc(s.titel)}</h3><p>${esc(s.text)}</p></div>`).join("")}
  </div>
  <div class="r6 blk">
    <div class="s16"><span class="label" style="margin-bottom:2.5mm">Ansprechpartner</span></div>
  </div>
  <div class="r2">
    ${v.firma.kontakte.map((k: Vm) => `<div class="kontakt${k.foto_url ? "" : " ohne"}">
      ${k.foto_url ? `<img src="${esc(k.foto_url)}" alt="${esc(k.name)}">` : ""}
      <div><div class="n">${esc(k.name)}</div><div class="r">${esc(k.rolle)}</div>
        <div class="c"><a href="mailto:${esc(k.email)}">${esc(k.email)}</a><br><a href="tel:${esc(k.telefon_href)}">${esc(k.telefon)}</a>${k.mobil ? `<br><a href="tel:${esc(k.mobil_href)}">${esc(k.mobil)}</a> (mobil)` : ""}</div></div>
    </div>`).join("")}
  </div>
  <div class="r6 linie absender unten">
    <div class="s12"><img class="logo-voll" src="${esc(v.logo)}" alt="${esc(v.firma.name)}"></div>
    <div class="s34"><span class="label">Anschrift</span><p>${esc(v.firma.name)}<br>${esc(v.firma.strasse)}<br>${esc(v.firma.plz_ort)}<br><a href="${esc(v.firma.web_url)}">${esc(v.firma.web)}</a></p></div>
    <div class="s56"><span class="label">Penetrationstest anfragen</span><p><a class="unterstr" href="${esc(v.firma.pentest_url)}">${esc(v.firma.pentest_label)}</a></p></div>
  </div>
  ${fuss(seite)}
</section>`);

  // ---------------------------------------------------------------- 05 findings
  fseiten.forEach((chunk, ci) => {
    seite++;
    w(`<section class="page pg">
  ${kopf("Feststellungen")}
  ${ci === 0 ? `<div class="r6 kk kk-mit" id="kap-05"><div class="nr">05</div><h1>Feststellungen im Einzelnen</h1></div>
  <div class="r6 vorspann"><p class="s36">Zu jeder Feststellung: was wir festgestellt haben, was ein Angreifer damit erreichen kann und was das für Sie bedeutet.</p></div>` : ""}
  ${chunk.map((f, i) => befund(f as never, i === 0)).join("")}
  ${fuss(seite)}
</section>`);
  });

  if (weitere) {
    seite++;
    w(`<section class="page pg">
  ${kopf("Feststellungen")}
  ${haupt.length ? "" : `<div class="r6 kk" id="kap-05"><div class="nr">05</div><h1>Feststellungen im Einzelnen</h1></div>`}
  ${gering.length ? `<div class="r6 sek"><div class="s12"><span class="prio gering">Gering</span></div><h2 class="s36">Weitere Feststellungen</h2></div>
  ${gering.map((f, i) => `<div class="r6 gz${i === 0 ? " erst" : ""}" id="${esc(f.nr)}">
    <div class="s12"><span class="fnr">${esc(f.nr)}</span><span class="gz-meta">${esc(f.bereich_label)} · ${esc(f.fach)}</span></div>
    <div class="s36"><b>${esc(f.titel)}</b><span class="kurz">${esc(f.kurz)}</span><span class="auf">Aufwand ${esc(f.aufwand)}: ${esc(f.aufwand_text)}</span></div>
  </div>`).join("")}
  <div class="r6"><p class="s36 klein gz-fuss">Technische Einzelwerte zu allen Feststellungen in Anhang A, Maßnahmen in Kapitel 02.</p></div>` : ""}
  ${v.feststellungen.length ? "" : `<div class="r6"><p class="s36 lead">In den geprüften Bereichen wurden keine Feststellungen getroffen.</p></div>`}
  ${v.positiv.length && !w_split ? umgesetztBlock("blk") : ""}
  ${fuss(seite)}
</section>`);
  }

  if (w_split) {
    seite++;
    w(`<section class="page pg">
  ${kopf("Feststellungen")}
  ${umgesetztBlock("")}
  ${fuss(seite)}
</section>`);
  }

  // ---------------------------------------------------------------- appendix A
  const testzeile = (x: Vm) => `<div class="r6 az sub">
  <div class="s12 t eingerueckt">${esc(x.label)}</div>
  <div class="s3 t"><b>${esc(x.modifier_text)}</b></div>
  <div class="s46 t">${esc(x.result_text)}<br><span class="g">Empfehlung: ${esc(x.recommendation)}</span></div>
</div>`;

  const webgruppe = (erst: string) => `<div class="r6 gruppe-kopf ${esc(erst)}"><span class="s16 label">Website</span></div>
<div class="r6 az">
  <div class="s12"><b>HTTP Observatory</b></div>
  <div class="s3"><span class="nb ${esc(k_web)}">${esc(minus(t.observatory.note))}</span>${t.observatory.score !== null && t.observatory.score !== undefined ? `<span class="g sc">Score ${esc(t.observatory.score)}</span>` : ""}</div>
  <div class="s46 t">${t.observatory.available ? `${esc(t.observatory.passed)} von ${esc(t.observatory.total)} Tests bestanden${t.observatory.tests.length ? ". Tests mit Abzug:" : ""}` : "Test nicht verfügbar"}</div>
</div>
${t.observatory.tests.map(testzeile).join("")}`;

  const mwkopf = () => `<div class="r6 kopfzeile">
  <div class="s12"><span class="label">Prüfung</span></div>
  <div class="s3"><span class="label">Ergebnis</span></div>
  <div class="s46"><span class="label">Messwert</span></div>
</div>`;

  seite++;
  w(`<section class="page pg">
  ${kopf("Anhang")}
  <div class="r6 kk" id="kap-a"><div class="nr">A</div><h1>Messwerte</h1></div>
  ${mwkopf()}
  <div class="r6 gruppe-kopf erst"><span class="s16 label">E-Mail</span></div>
  <div class="r6 az">
    <div class="s12"><b>DMARC</b></div>
    <div class="s3"><span class="nb ${esc(k_mail)}">${esc(minus(t.dmarc.note))}</span>${t.dmarc.score !== null && t.dmarc.score !== undefined ? `<span class="g sc">Score ${esc(t.dmarc.score)}</span>` : ""}</div>
    <div class="s46 t">${t.dmarc.record ? `<span class="mono wert">${esc(t.dmarc.record)}</span>` : "Kein DMARC-Eintrag veröffentlicht"}<br><span class="g">Richtlinie (p): ${esc(t.dmarc.policy ? t.dmarc.policy : "–")} · Berichte (rua): ${t.dmarc.rua ? "angefordert" : "nicht angefordert"}</span></div>
  </div>
  ${t.mail.map((m: Vm) => `<div class="r6 az">
    <div class="s12"><b>${esc(m.label)}</b></div>
    <div class="s3"><span class="prio ${esc(m.status)}">${esc(m.status_label)}</span></div>
    <div class="s46 t">${esc(m.text)}</div>
  </div>`).join("")}
  <div class="r6 gruppe-kopf"><span class="s16 label">Domain</span></div>
  <div class="r6 az">
    <div class="s12"><b>DNSSEC</b></div>
    <div class="s3"><span class="nb ${esc(k_dns)}">${esc(minus(t.dnssec.note))}</span>${t.dnssec.score !== null && t.dnssec.score !== undefined ? `<span class="g sc">Score ${esc(t.dnssec.score)}</span>` : ""}</div>
    <div class="s46 t">${t.dnssec.signed ? "Zone signiert" : "Zone nicht signiert"}</div>
  </div>
  ${web_extra ? "" : webgruppe("")}
  ${fuss(seite)}
</section>`);

  if (web_extra) {
    seite++;
    w(`<section class="page pg">
  ${kopf("Anhang")}
  <div class="r6 sek"><div class="s12"><span class="label">Anhang A</span></div><h2 class="s36">Messwerte, Fortsetzung</h2></div>
  ${mwkopf()}
  ${webgruppe("erst")}
  ${fuss(seite)}
</section>`);
  }

  // ---------------------------------------------------------------- appendix B
  seite++;
  const naBereich = v.bereiche.find((a: Vm) => a.klasse === "na");
  w(`<section class="page pg">
  ${kopf("Anhang")}
  <div class="r6 kk" id="kap-b"><div class="nr">B</div><h1>Methodik und Bewertung</h1></div>
  <div class="r6">
    <div class="s12"><span class="label">Vorgehen</span></div>
    <p class="s36 lead-s">${esc(v.texte.methode_lang)}</p>
  </div>
  <div class="blk">
    ${(v.texte.methodik as Vm[]).map((m, i) => `<div class="r6 az${i === 0 ? " erst" : ""}">
      <div class="s12"><b>${esc(m.bereich)}</b><br><span class="g pr">${esc(m.pruefung)}</span></div>
      <div class="s36 t">${esc(m.text)}</div>
    </div>`).join("")}
  </div>
  <div class="r6 blk" style="margin-bottom:2.5mm"><div class="s16"><span class="label">Notenskala</span></div></div>
  ${v.noten.map((n: Vm, i: number) => `<div class="r6 az${i === 0 ? " erst" : ""}">
    <div class="s12"><span class="nb ${esc(n.klasse)}">${esc(minus(n.noten.join(" / ")))}</span></div>
    <div class="s34"><span class="prio ${esc(n.klasse)}">${esc(n.wort)}</span></div>
    <div class="s56 t">${esc(n.bedeutung)}</div>
  </div>`).join("")}
  ${naBereich ? `<div class="r6 az">
    <div class="s12"><span class="nb na">${esc(naBereich.note)}</span></div>
    <div class="s34"><span class="prio na">${esc(naBereich.wort)}</span></div>
    <div class="s56 t">${esc(naBereich.bedeutung)}</div>
  </div>` : ""}
  <div class="r6 blk"><p class="s36 klein">${esc(v.texte.vertraulich)}</p></div>
  ${fuss(seite)}
</section>`);

  w(`</body>
</html>`);
  return out.join("\n");
}
