// Geschäftsführer-Fassung: HTML für den PDF-Druck (A4, Chrome).
//
// Design plan
//   Colour   Markenrot #DC0C23 doubles as "Handlungsbedarf"; amber #E39A10 (text
//            #8A5300) "Verbesserungsbedarf"; green #2E6B4A "Gut geschützt"; grey
//            #9A9A9A "Nicht prüfbar". Ink #000, secondary #5A5A5A, panel #F2F2F2.
//            Colour carries status and nothing else — apart from the logo and the
//            one action button, which keep the brand red.
//   Type     Liberation Sans (Arial, per corporate design), regular and bold only.
//            Scale in pt: 8.5 · 11 · 13 · 16 · 30 · 34; tight tracking from 30 pt up.
//   Layout   Every page shares one left text edge at 30 mm, so the eye finds the
//            same starting point while flipping. Risk pages carry a full-height
//            status edge (0–9 mm) in their colour — scrolling through the PDF, the
//            edges alone tell the result. Single column, ragged right, running
//            text held to about 135 mm.
//   Rule     One page, one message. Extra space goes to air, never to detail.

import type { Ampel, GfGruppe } from "./viewmodel-gf.js";

type Vm = Record<string, any>;

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&#34;")
    .replace(/'/g, "&#39;")
    .replace(/E-Mail/g, '<span class="nw">E-Mail</span>');
}

/** Attribute values: plain escaping, without the no-break span. */
function attr(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&#34;");
}

const CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
:root {
  --rot: #DC0C23; --rot-t: #C30A1E;
  --gelb: #E39A10; --gelb-t: #8A5300;
  --gruen: #2E6B4A; --gruen-t: #2E6B4A;
  --grau: #9A9A9A; --grau-t: #666666;
  --tinte: #000000; --zweit: #5A5A5A; --flaeche: #F2F2F2; --linie: #DADADA;
}
body { font-family: "Liberation Sans", Arial, Helvetica, sans-serif; color: var(--tinte);
  font-size: 11pt; line-height: 1.45; background: #fff; }
a { color: inherit; text-decoration: none; }
.nw { white-space: nowrap; }
p, li, dd, .f-frage, .f-antwort { text-wrap: pretty; }
h1 { text-wrap: balance; }
b, strong { font-weight: 700; }

.seite { position: relative; width: 210mm; height: 297mm; overflow: hidden;
  break-after: page; page-break-after: always; }
.seite:last-child { break-after: auto; page-break-after: auto; }
.inhalt { position: absolute; left: 30mm; right: 24mm; top: 30mm; bottom: 28mm; }
.kante { position: absolute; left: 0; top: 0; bottom: 0; width: 9mm; }

.fuss { position: absolute; left: 30mm; right: 24mm; bottom: 13mm; display: flex;
  justify-content: space-between; align-items: center; font-size: 8.5pt; color: var(--zweit); }
.fuss .marke { display: flex; align-items: center; gap: 2.2mm; }
.fuss img { height: 4.2mm; }

/* status colours */
.bg-rot { background: var(--rot); } .bg-gelb { background: var(--gelb); }
.bg-gruen { background: var(--gruen); } .bg-grau { background: var(--grau); }
.t-rot { color: var(--rot-t); } .t-gelb { color: var(--gelb-t); }
.t-gruen { color: var(--gruen-t); } .t-grau { color: var(--grau-t); }

/* type */
.label { font-size: 10pt; font-weight: 700; color: var(--zweit); }
.h-gross { font-size: 34pt; line-height: 1.08; font-weight: 700; letter-spacing: -0.02em; max-width: 150mm; }
.h-risiko { font-size: 30pt; line-height: 1.1; font-weight: 700; letter-spacing: -0.018em; max-width: 148mm; }
.lead { font-size: 14pt; line-height: 1.42; max-width: 135mm; }
.status { display: flex; align-items: center; gap: 3mm; font-weight: 700; }
.status .punkt { width: 4.2mm; height: 4.2mm; flex: none; }
.status.gross { font-size: 17pt; }

/* ---------------------------------------------------------------- cover */
.deckblatt .logo { position: absolute; left: 30mm; top: 24mm; height: 17mm; }
.db-mitte { position: absolute; left: 30mm; right: 24mm; top: 84mm; }
.db-kicker { font-size: 13pt; font-weight: 700; color: var(--rot-t); }
.db-domain { font-size: 30pt; line-height: 1.1; font-weight: 700; letter-spacing: -0.02em;
  margin-top: 3mm; white-space: nowrap; }
.db-domain.l { font-size: 26pt; } .db-domain.xl { font-size: 21pt; } .db-domain.xxl { font-size: 17pt; }
.db-domain.s { font-size: 40pt; } .db-domain.m { font-size: 34pt; }
.db-nutzen { font-size: 16pt; line-height: 1.38; margin-top: 9mm; max-width: 132mm; }
.db-lesezeit { font-size: 10pt; color: var(--zweit); margin-top: 5mm; }
.db-ergebnis { position: absolute; left: 30mm; right: 24mm; top: 172mm; }
.db-ergebnis-kopf { font-size: 15pt; }
.band { list-style: none; display: grid; grid-template-columns: repeat(var(--n), 1fr);
  gap: 4mm; margin-top: 6mm; }
.band li a { display: block; }
.band .balken { display: block; height: 4.2mm; }
.band b { display: block; font-size: 11pt; margin-top: 3.2mm; line-height: 1.25; }
.band .wort { display: block; font-size: 10pt; margin-top: 1mm; line-height: 1.25; }
.db-fuss { position: absolute; left: 30mm; right: 24mm; bottom: 18mm; font-size: 9pt;
  line-height: 1.5; color: var(--zweit); }
.db-fuss .erstellt { color: var(--tinte); }
.db-fuss .db-vertraulich { margin-top: 2.5mm; }

/* ---------------------------------------------------------------- summary */
.zf .h-gross { margin-top: 3mm; }
.zf .status { margin-top: 9mm; }
.zf .lead { margin-top: 3mm; }
.zf .geprueft { margin-top: 15mm; }
.fragen { list-style: none; margin-top: 4mm; }
.fragen li { border-top: 0.25mm solid var(--linie); }
.fragen li:last-child { border-bottom: 0.25mm solid var(--linie); }
.fragen a { display: grid; grid-template-columns: 2.6mm 1fr 38mm; column-gap: 5mm;
  padding: 4.6mm 0; align-items: start; }
.fragen .marke { align-self: stretch; }
.fragen .f-frage { display: block; font-size: 12.5pt; font-weight: 700; line-height: 1.3; }
.fragen .f-antwort { display: block; font-size: 11pt; margin-top: 1.2mm; color: #222; }
.fragen .f-status { text-align: right; }
.fragen .f-status b { display: block; font-size: 10pt; line-height: 1.3; white-space: nowrap; }
.fragen .f-status span { display: block; font-size: 9pt; color: var(--zweit); margin-top: 1mm; }
.cta-leiste { position: absolute; left: 0; right: 0; bottom: 0; background: var(--flaeche);
  padding: 6mm 7mm; display: flex; align-items: center; justify-content: space-between; gap: 8mm; }
.cta-leiste p { font-size: 11.5pt; line-height: 1.4; }
.knopf { display: inline-block; background: var(--rot); color: #fff; font-weight: 700;
  font-size: 11.5pt; padding: 3.4mm 6.5mm; border-radius: 1mm; white-space: nowrap; }

/* ---------------------------------------------------------------- contact person */
.person { display: flex; align-items: flex-end; gap: 9mm; margin-top: 7mm; }
.portrait { width: 58mm; height: 58mm; object-fit: cover; filter: grayscale(1); }
.h-name { font-size: 26pt; line-height: 1.12; font-weight: 700; letter-spacing: -0.015em; }
.rolle { font-size: 12pt; color: var(--zweit); margin-top: 2mm; }
.zeilen { margin-top: 15mm; }
.zeilen div { display: grid; grid-template-columns: 34mm 1fr; column-gap: 6mm; padding: 4.2mm 0;
  border-top: 0.25mm solid var(--linie); }
.zeilen div:last-child { border-bottom: 0.25mm solid var(--linie); }
.zeilen dt { font-size: 10.5pt; font-weight: 700; color: var(--zweit); padding-top: 0.6mm; }
.zeilen dd { font-size: 12.5pt; line-height: 1.42; max-width: 120mm; }
.fakten { list-style: none; margin-top: 13mm; }
.fakten li { font-size: 12.5pt; line-height: 1.4; margin-top: 3.4mm; padding-left: 7mm; position: relative; }
.fakten li::before { content: ""; position: absolute; left: 0; top: 2.1mm; width: 3mm; height: 0.6mm;
  background: var(--rot); }

/* ---------------------------------------------------------------- risk page */
.risiko .status { margin-top: 3mm; }
.risiko .h-risiko { margin-top: 13mm; }
.risiko .lead { margin-top: 7mm; }
.risiko .bed-label { margin-top: 13mm; }
.bedeutung { list-style: none; margin-top: 3mm; max-width: 135mm; }
.bedeutung li { font-size: 12.5pt; line-height: 1.4; margin-top: 2.6mm; padding-left: 7mm; position: relative; }
.bedeutung li::before { content: ""; position: absolute; left: 0; top: 2.6mm; width: 3.2mm; height: 0.6mm;
  background: var(--tinte); }
.tun { margin-top: 13mm; background: var(--flaeche); padding: 7mm 8mm 7.5mm; max-width: 156mm; }
.tun-text { font-size: 13pt; line-height: 1.4; margin-top: 2mm; max-width: 132mm; }
.tun dl { display: grid; grid-template-columns: 20mm 1fr; row-gap: 1.4mm; margin-top: 5mm; font-size: 10.5pt; }
.tun dt { font-weight: 700; color: var(--zweit); }
.fundstellen { position: absolute; left: 0; bottom: 0; font-size: 9pt; color: var(--zweit); max-width: 140mm; }

/* ---------------------------------------------------------------- measures */
.mn .lead { margin-top: 5mm; }
.schritte { list-style: none; margin-top: 12mm; }
.schritte li { display: grid; grid-template-columns: 12mm 1fr; padding: 5mm 0; border-top: 0.25mm solid var(--linie); }
.schritte li:last-child { border-bottom: 0.25mm solid var(--linie); }
.schritte .nr { font-size: 22pt; font-weight: 700; line-height: 1; }
.schritte .nr.t-schluss { color: var(--zweit); }
.schritte b { display: block; font-size: 14pt; line-height: 1.3; }
.schritte p { font-size: 11.5pt; line-height: 1.42; margin-top: 1.5mm; max-width: 128mm; }
.schritte .meta { font-size: 10pt; color: var(--zweit); margin-top: 2.2mm; }
.schritte .meta span { font-weight: 700; }
.beibehalten { display: flex; align-items: center; gap: 3mm; margin-top: 6mm; font-size: 11.5pt; }
.beibehalten .punkt { width: 3.6mm; height: 3.6mm; flex: none; }
.hinweise { position: absolute; left: 0; right: 0; bottom: 0; display: grid;
  grid-template-columns: 1fr 1.45fr; column-gap: 9mm; padding-top: 5mm; border-top: 0.25mm solid var(--linie); }
.hinweise p:not(.label) { font-size: 10pt; line-height: 1.45; margin-top: 1.4mm; }

/* ---------------------------------------------------------------- invitation */
.ab .lead { margin-top: 7mm; }
.ab .punkte-label { margin-top: 12mm; }
.termin { display: flex; align-items: center; gap: 10mm; margin-top: 14mm; }
.knopf.gross { font-size: 15pt; padding: 5mm 11mm; }
.qr { display: flex; align-items: center; gap: 4mm; font-size: 10pt; color: var(--zweit); }
.qr img { width: 30mm; height: 30mm; display: block; }
.kontakt { display: flex; align-items: center; gap: 7mm; margin-top: 15mm; padding-top: 8mm;
  border-top: 0.25mm solid var(--linie); }
.kontakt img { width: 27mm; height: 27mm; object-fit: cover; filter: grayscale(1); }
.kontakt b { display: block; font-size: 13pt; }
.kontakt span { display: block; font-size: 10.5pt; color: var(--zweit); margin-top: 0.6mm; }
.kontakt a { display: block; font-size: 11pt; margin-top: 1.4mm; }
.impressum { position: absolute; left: 0; right: 0; bottom: 0; font-size: 8pt; line-height: 1.5; color: var(--zweit); }
`;

function fuss(v: Vm, n: number): string {
  return `<div class="fuss"><span class="marke"><img src="${attr(v.assets)}/reineke-fox.svg" alt="">${esc(v.texte.fuss)}</span><span>Seite ${n} von ${v.N}</span></div>`;
}

function status(ampel: Ampel, wort: string, gross = false): string {
  return `<p class="status${gross ? " gross" : ""} t-${ampel}"><span class="punkt bg-${ampel}"></span>${esc(wort)}</p>`;
}

function domainKlasse(d: string): string {
  const n = d.length;
  return n <= 14 ? "s" : n <= 19 ? "m" : n <= 25 ? "" : n <= 30 ? "l" : n <= 37 ? "xl" : "xxl";
}

export function gfHtml(v: Vm): string {
  const k = v.k;
  const gruppen = v.gruppen as GfGruppe[];
  const out: string[] = [];
  const w = (s: string) => out.push(s);
  const buchen = attr(v.firma.booking_url);

  w(`<!doctype html><html lang="de"><head><meta charset="utf-8">
<title>Sicherheitscheck ${esc(v.domain)}</title><style>${CSS}</style></head><body>`);

  // ------------------------------------------------------------ 1 cover
  w(`<section class="seite deckblatt">
  <img class="logo" src="${attr(v.assets)}/reineke-official.svg" alt="${attr(v.firma.name)}">
  <div class="db-mitte">
    <p class="db-kicker">${esc(k.deckblatt.kicker)}</p>
    <h1 class="db-domain ${domainKlasse(v.domain)}">${esc(v.domain)}</h1>
    <p class="db-nutzen">${esc(k.deckblatt.nutzen)}</p>
    <p class="db-lesezeit">${esc(k.deckblatt.lesezeit)}</p>
  </div>
  <div class="db-ergebnis">
    <p class="db-ergebnis-kopf">${esc(k.deckblatt.ergebnis)} <b class="t-${v.gesamt.ampel}">${esc(v.gesamt.wort)}</b></p>
    <ol class="band" style="--n:${gruppen.length}">
      ${gruppen.map((g) => `<li><a href="#${g.seite ? `s${g.seite}` : "s2"}"><span class="balken bg-${g.ampel}"></span><b>${esc(g.name)}</b><span class="wort t-${g.ampel}">${esc(g.ampel_wort)}</span></a></li>`).join("")}
    </ol>
  </div>
  <div class="db-fuss">
    <p class="erstellt">${esc(v.texte.erstellt)}</p>
    <p>Bericht-Nr. ${esc(v.bericht_nr)}</p>
    <p class="db-vertraulich">${esc(v.texte.vertraulich)}</p>
  </div>
</section>`);

  // ------------------------------------------------------------ 2 summary
  const z = k.zusammenfassung;
  w(`<section class="seite zf" id="s2">
  <div class="inhalt">
    <p class="label">${esc(z.label)}</p>
    <h1 class="h-gross">${esc(v.titel)}</h1>
    ${status(v.gesamt.ampel, v.gesamt.wort, true)}
    <p class="lead">${esc(v.gesamt.satz)}</p>
    <p class="label geprueft">${esc(v.texte.geprueft)}</p>
    <ul class="fragen">
      ${gruppen.map((g) => {
        const verweis = g.risiko_nr
          ? g.seite === v.seiten.massnahmen
            ? z.verweis_massnahmen.replace("{seite}", String(g.seite))
            : z.verweis.replace("{nr}", String(g.risiko_nr)).replace("{seite}", String(g.seite))
          : "";
        return `<li><a href="#${g.seite ? `s${g.seite}` : "s2"}"><span class="marke bg-${g.ampel}"></span><span><span class="f-frage">${esc(g.frage)}</span><span class="f-antwort">${esc(g.antwort)}</span></span><span class="f-status"><b class="t-${g.ampel}">${esc(g.ampel_wort)}</b>${verweis ? `<span>${esc(verweis)}</span>` : ""}</span></a></li>`;
      }).join("")}
    </ul>
    <div class="cta-leiste">
      <p><b>${esc(z.cta_titel)}</b> ${esc(z.cta_text)}</p>
      <a class="knopf" href="${buchen}">${esc(k.abschluss.button)}</a>
    </div>
  </div>
  ${fuss(v, 2)}
</section>`);

  // ------------------------------------------------------------ 3 contact person
  const vs = k.vorstellung;
  w(`<section class="seite vs" id="s3">
  <div class="inhalt">
    <p class="label">${esc(vs.label)}</p>
    <div class="person">
      <img class="portrait" src="${attr(v.firma.vorstellung.foto_url)}" alt="${attr(v.kontakt.name)}">
      <div><h1 class="h-name">${esc(v.kontakt.name)}</h1><p class="rolle">${esc(v.firma.vorstellung.rolle)}</p></div>
    </div>
    <dl class="zeilen">
      ${vs.zeilen.map((z2: Vm) => `<div><dt>${esc(z2.label)}</dt><dd>${esc(z2.text)}</dd></div>`).join("")}
    </dl>
    <ul class="fakten">
      ${vs.fakten.map((f: Vm) => `<li><b>${esc(f.stark)}</b> ${esc(f.text)}</li>`).join("")}
    </ul>
  </div>
  ${fuss(v, 3)}
</section>`);

  // ------------------------------------------------------------ 4.. one page per risk
  const r = k.risiko;
  (v.seiten_risiken as GfGruppe[]).forEach((g) => {
    const t = g.text!;
    w(`<section class="seite risiko" id="s${g.seite}">
  <div class="kante bg-${g.ampel}"></div>
  <div class="inhalt">
    <p class="label">${esc(r.kopf.replace("{nr}", String(g.risiko_nr)).replace("{gesamt}", String(v.seiten_risiken.length)).replace("{name}", g.name))}</p>
    ${status(g.ampel, g.ampel_wort, true)}
    <h1 class="h-risiko">${esc(t.titel)}</h1>
    <p class="lead">${esc(t.lead)}</p>
    <p class="label bed-label">${esc(r.bedeutung)}</p>
    <ul class="bedeutung">${t.bedeutung.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>
    <div class="tun">
      <p class="label">${esc(r.tun)}</p>
      <p class="tun-text">${esc(g.tun)}</p>
      <dl><dt>${esc(r.wer)}</dt><dd>${esc(g.zustaendig)}</dd><dt>${esc(r.aufwand)}</dt><dd>${esc(g.aufwand)}</dd></dl>
    </div>
    <p class="fundstellen">${esc(g.fundstellen)}</p>
  </div>
  ${fuss(v, g.seite!)}
</section>`);
  });

  // ------------------------------------------------------------ measures
  const m = k.massnahmen;
  const pm = v.seiten.massnahmen as number;
  const risiken = v.risiken as GfGruppe[];
  w(`<section class="seite mn" id="s${pm}">
  <div class="inhalt">
    <h1 class="h-risiko">${esc(m.titel)}</h1>
    <p class="lead">${esc(risiken.length ? m.lead : m.ohne)}</p>
    ${risiken.length ? `<ol class="schritte">
      ${risiken.map((g, i) => `<li><span class="nr t-${g.ampel}">${i + 1}</span><div><b>${esc(g.massnahme)}</b><p>${esc(g.tun)}</p><p class="meta"><span>${esc(r.wer)}:</span> ${esc(g.zustaendig)}&emsp;<span>${esc(r.aufwand)}:</span> ${esc(g.aufwand)}</p></div></li>`).join("")}
      <li><span class="nr t-schluss">${risiken.length + 1}</span><div><b>${esc(m.nachpruefen_titel)}</b><p>${esc(m.nachpruefen)}</p><p class="meta"><span>${esc(r.wer)}:</span> ${esc(m.nachpruefen_wer)}&emsp;<span>${esc(r.aufwand)}:</span> ${esc(m.nachpruefen_aufwand)}</p></div></li>
    </ol>` : ""}
    ${(v.staerken as GfGruppe[]).map((g) => `<p class="beibehalten"><span class="punkt bg-gruen"></span><span><b>${esc(m.beibehalten)}</b> ${esc(g.beibehalten)}</span></p>`).join("")}
    <div class="hinweise">
      <div><p class="label">${esc(m.it_label)}</p><p>${esc(m.it)}</p></div>
      <div><p class="label">${esc(m.umfang_label)}</p><p>${esc(v.texte.umfang)}</p></div>
    </div>
  </div>
  ${fuss(v, pm)}
</section>`);

  // ------------------------------------------------------------ invitation
  const a = k.abschluss;
  const kt = v.kontakt;
  const pf = v.firma.pflichtangaben;
  w(`<section class="seite ab" id="s${v.N}">
  <div class="inhalt">
    <h1 class="h-gross">${esc(a.titel)}</h1>
    <p class="lead">${esc(a.lead)}</p>
    <p class="label punkte-label">${esc(a.punkte_label)}</p>
    <ul class="bedeutung">${a.punkte.map((p: string) => `<li>${esc(p)}</li>`).join("")}</ul>
    <div class="termin">
      <a class="knopf gross" href="${buchen}">${esc(a.button)}</a>
      <a class="qr" href="${buchen}"><img src="${attr(v.qr_termin)}" alt="QR-Code zur Terminbuchung"><span>${esc(a.qr)}</span></a>
    </div>
    <div class="kontakt">
      <img src="${attr(kt.foto_url)}" alt="${attr(kt.name)}">
      <div><b>${esc(kt.name)}</b><span>${esc(v.firma.vorstellung.rolle)}</span>
        <a href="mailto:${attr(kt.email)}">${esc(kt.email)}</a><a href="tel:${attr(kt.telefon_href)}">${esc(kt.telefon)}</a></div>
    </div>
    <div class="impressum">${esc(v.firma.name)}, ${esc(v.firma.strasse)}, ${esc(v.firma.plz_ort)}, <a href="${attr(v.firma.web_url)}">${esc(v.firma.web)}</a><br>${esc(pf.registergericht)}, ${esc(pf.hrb)}, Geschäftsführer: ${esc(pf.geschaeftsfuehrer.join(", "))}, USt-IdNr. ${esc(pf.ust_id)}</div>
  </div>
  ${fuss(v, v.N)}
</section>`);

  w(`</body></html>`);
  return out.join("\n");
}
