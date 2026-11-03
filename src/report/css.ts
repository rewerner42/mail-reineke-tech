// The report stylesheet, taken verbatim from the Jinja2 template's <style>
// blocks so the two implementations cannot drift apart. Generated, not written:
// tools/css-uebernehmen.py copies it out of tools/referenz/vorlage/.
//
// Calibrated against browser measurements together with the millimetre constants
// in seitenplan.ts — a change here moves page breaks. Run `npm run bericht:pruefen`
// after touching it.

/* eslint-disable */

export const BERICHT_CSS = String.raw`
  @page { size: A4; margin: 0; }
  :root {
    --rot: #DC0C23;
    --ink: #111111; --ink-2: #2E2E2E; --ink-3: #5A5A5A; --ink-4: #767676;
    --haar: #D2D2D2; --haar-2: #E6E7E6;
    --hoch: #DC0C23; --mittel: #B26B00; --gering: #5E6A71; --ok: #2E6B4A; --na: #8A8A8A;
  }
  html, body { margin: 0; padding: 0; background: #fff; }
  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* ---------- Seite und Raster ---------- */
  .pg { position: relative; width: 210mm; height: 297mm; overflow: hidden; box-sizing: border-box;
        padding: 31mm 15mm 24mm; background: #fff; color: var(--ink);
        font-family: "Liberation Sans", Arial, Helvetica, sans-serif; font-size: 9.5pt; line-height: 1.45;
        page-break-after: always; break-after: page; }
  .pg:last-child { page-break-after: auto; break-after: auto; }
  .pg *, .pg *::before, .pg *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .pg a { color: inherit; text-decoration: none; }
  .pg b, .pg strong { font-weight: 700; }
  .pg ul, .pg ol { list-style: none; }
  .pg.spalte { display: flex; flex-direction: column; }
  .pg.spalte > .unten { margin-top: auto; }

  .r6 { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); column-gap: 5mm; }
  .r3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 5mm; }
  .r2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 5mm; }
  .s1 { grid-column: 1 / 2; } .s2 { grid-column: 2 / 3; } .s3 { grid-column: 3 / 4; }
  .s4 { grid-column: 4 / 5; } .s5 { grid-column: 5 / 6; } .s6 { grid-column: 6 / 7; }
  .s12 { grid-column: 1 / 3; } .s34 { grid-column: 3 / 5; } .s56 { grid-column: 5 / 7; }
  .s36 { grid-column: 3 / 7; } .s35 { grid-column: 3 / 6; } .s16 { grid-column: 1 / 7; }
  .s46 { grid-column: 4 / 7; }

  /* ---------- Kopf- und Fußzeile ---------- */
  .kopf { position: absolute; top: 12mm; left: 15mm; right: 15mm; display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr)); column-gap: 5mm; align-items: end;
          padding-bottom: 2.4mm; border-bottom: .2mm solid var(--haar);
          font-size: 7pt; line-height: 1.2; color: var(--ink-3); }
  .k-marke { grid-column: 1 / 3; display: flex; align-items: flex-end; gap: 2.2mm; white-space: nowrap; }
  .fuchs { display: block; flex: none; width: 6mm; height: 5.2mm; overflow: hidden; }
  .fuchs img { display: block; width: 6mm; height: auto; }
  .k-marke b { color: var(--ink); letter-spacing: .03em; }
  .k-domain { grid-column: 3 / 5; overflow-wrap: anywhere; }
  .k-kap { grid-column: 5 / 7; text-align: right; }
  .fuss { position: absolute; bottom: 11mm; left: 15mm; right: 15mm; display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr)); column-gap: 5mm;
          font-size: 7pt; line-height: 1.2; color: var(--ink-4); }
  .fuss .f1 { grid-column: 1 / 3; } .fuss .f2 { grid-column: 3 / 5; }
  .fuss .f3 { grid-column: 5 / 7; text-align: right; color: var(--ink-3); }

  /* ---------- Typografie ---------- */
  .kk { align-items: baseline; margin-bottom: 7mm; }
  .kk.kk-mit { margin-bottom: 3mm; }
  .vorspann { margin-bottom: 7mm; }
  .vorspann p { font-size: 10pt; line-height: 1.45; color: var(--ink-3); }
  .kk .nr { grid-column: 1 / 3; font-size: 22pt; line-height: 1.1; font-weight: 400; color: var(--rot); }
  .kk h1 { grid-column: 3 / 7; font-size: 22pt; line-height: 1.1; font-weight: 700; letter-spacing: -.005em; }
  .label { display: block; font-size: 6.8pt; line-height: 1.35; font-weight: 700; letter-spacing: .14em;
           text-transform: uppercase; color: var(--ink-3); }
  .lead { font-size: 12pt; line-height: 1.42; color: var(--ink); }
  .lead-s { font-size: 10.5pt; line-height: 1.45; color: var(--ink-2); }
  .klein { font-size: 8.5pt; line-height: 1.45; color: var(--ink-3); }
  .marginalie { margin-top: 3mm; width: 46mm; font-size: 7.5pt; line-height: 1.45; color: var(--ink-4); }
  .mono { font-family: "DejaVu Sans Mono", Menlo, monospace; font-size: 6.8pt; line-height: 1.5;
          color: var(--ink-3); overflow-wrap: anywhere; }
  .blk { margin-top: 9mm; }
  .linie { border-top: .35mm solid var(--ink); padding-top: 3mm; }

  /* Statusfarben */
  .good { color: var(--ok); } .warn { color: var(--mittel); } .bad { color: var(--hoch); } .na { color: var(--na); }
  .prio { display: inline-block; font-size: 6.8pt; line-height: 1.35; font-weight: 700; letter-spacing: .14em;
          text-transform: uppercase; white-space: nowrap; }
  .prio::before { content: ""; display: inline-block; width: 1.9mm; height: 1.9mm; margin-right: 1.6mm;
                  background: currentColor; vertical-align: .05mm; }
  .prio.hoch { color: var(--hoch); } .prio.mittel { color: var(--mittel); } .prio.gering { color: var(--gering); }
  .prio.ok { color: var(--ok); } .prio.hinweis { color: var(--mittel); } .prio.mangel { color: var(--hoch); }
  .prio.good { color: var(--ok); } .prio.warn { color: var(--mittel); } .prio.bad { color: var(--hoch); } .prio.na { color: var(--na); }

  .btn { display: inline-block; background: var(--rot); color: #fff; font-size: 9.5pt; line-height: 1.2; font-weight: 700;
         letter-spacing: .02em; padding: 3.4mm 6.5mm; white-space: nowrap; }
  .pg a.btn { color: #fff; }
  .unterstr { border-bottom: .2mm solid var(--ink); }

  /* ---------- 01 Zusammenfassung ---------- */
  .lv-kritisch, .lv-hoch { --lv: var(--hoch); } .lv-mittel { --lv: var(--mittel); } .lv-gering { --lv: var(--ok); }
  .urteil .hb { font-size: 15pt; line-height: 1.2; font-weight: 700; color: var(--ink); margin-bottom: 2mm; }
  .urteil .zeile { display: flex; align-items: center; column-gap: 6mm; }
  .urteil .wort { flex: none; font-size: 46pt; line-height: .95; font-weight: 700; letter-spacing: -.02em; color: var(--lv); margin-top: -1mm; }
  .urteil .heisst { font-size: 11pt; line-height: 1.32; color: var(--ink-3); border-left: .35mm solid var(--haar); padding-left: 4mm; }
  .urteil .heisst b { display: block; color: var(--ink); }
  .urteil .hb-hinweis { margin-top: 3mm; padding-top: 2.4mm; border-top: .3mm solid var(--haar); color: var(--ink); }
  /* Seite 2 trägt jetzt die Zeile „Handlungsbedarf“: Abstände dort etwas enger als im übrigen Bericht */
  .seite-zf .blk { margin-top: 6.5mm; }
  .seite-zf .nt .note { font-size: 48pt; margin: 3.2mm 0 2mm; }
  .seite-zf .skala { margin: 3.5mm 0 3.2mm; }
  .skala { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); column-gap: 5mm; margin: 4.5mm 0 4mm; }
  .skala div { border-top: 1.2mm solid #E4E4E4; padding-top: 1.6mm; font-size: 6.8pt; line-height: 1.3; font-weight: 700;
               letter-spacing: .14em; text-transform: uppercase; color: var(--ink-4); }
  .skala div.an { border-top-color: var(--lv); color: var(--ink); }
  .noten { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); column-gap: 5mm; }
  .nt { display: grid; grid-row: span 6; grid-template-rows: subgrid; border-top: .35mm solid var(--ink); padding-top: 3mm; }
  .nt .schutz { font-size: 9pt; line-height: 1.35; color: var(--ink-2); margin-top: .8mm; }
  .nt .note { font-size: 54pt; line-height: .9; font-weight: 700; letter-spacing: -.03em; margin: 4mm 0 2.6mm; }
  .note .mod { font-size: .5em; vertical-align: .78em; letter-spacing: 0; margin-left: .03em; }
  .nt .wort { font-size: 11pt; line-height: 1.25; font-weight: 700; }
  .nt .satz { font-size: 9pt; line-height: 1.4; color: var(--ink-2); margin-top: 1.2mm; }
  .nt .meta { font-size: 7pt; line-height: 1.3; color: var(--ink-4); margin-top: 1.8mm; letter-spacing: .02em; }
  .nt .meta .nh { color: var(--ink); }
  .legende { margin-top: 3mm; font-size: 7pt; line-height: 1.4; color: var(--ink-4); }
  .legende span + span::before { content: " · "; }
  /* Inhaltsverzeichnis (Seite 2, v15) */
  .inh-hinweis { margin: -2mm 0 6mm; }
  .inh-hinweis p { font-size: 10pt; line-height: 1.45; color: var(--ink-3); }
  .inh a { display: grid; grid-template-columns: 61.66mm minmax(0, 1fr) 14mm; column-gap: 0; align-items: baseline; }
  .inh .inh-kap { border-top: .35mm solid var(--ink); padding: 2.6mm 0 2.4mm; margin-top: 2.2mm; }
  .inh .inh-kap:first-child { margin-top: 0; }
  .inh .inh-kap .inh-nr { font-size: 15pt; line-height: 1.15; color: var(--rot); }
  .inh .inh-kap .inh-t { font-size: 12.5pt; line-height: 1.25; font-weight: 700; }
  .inh .inh-kap .inh-s { font-size: 12.5pt; line-height: 1.25; font-weight: 700; text-align: right; }
  .inh .inh-sub { border-top: .2mm solid var(--haar-2); padding: 1mm 0 1.1mm; }
  .inh .inh-kap + .inh-sub { border-top: 0; }
  .inh .inh-sub .inh-nr { font-size: 7.5pt; line-height: 1.35; font-weight: 700; color: var(--ink-4); padding-left: 0; }
  .inh .inh-sub .inh-nr .prio { margin-right: 2mm; }
  .inh .inh-sub .inh-t { font-size: 9pt; line-height: 1.35; color: var(--ink-2); }
  .inh .inh-sub .inh-s { font-size: 9pt; line-height: 1.35; color: var(--ink-3); text-align: right; }
  /* ab 15 Feststellungen etwas dichter, damit das Inhaltsverzeichnis auf eine Seite passt */
  .inh.inh--kompakt .inh-kap { padding: 2mm 0 1.9mm; margin-top: 1.6mm; }
  .inh.inh--kompakt .inh-sub { padding: .55mm 0 .6mm; }
  .inh.inh--kompakt .inh-sub .inh-t, .inh.inh--kompakt .inh-sub .inh-s { font-size: 8.5pt; line-height: 1.3; }
  /* Notenskala „Zeugnis“ (Werners Wahl, 30.10.): kleine Skala A–F unter jeder Note, Legende mit Farbfeldern */
  .seite-zf .nt { grid-row: span 7; }
  .nt-mini { display: flex; gap: 1mm; margin-top: 2.2mm; }
  .nt-mini span { display: block; width: 6.2mm; height: 5.4mm; border: .3mm solid #D4D4D4; color: #A8A8A8; font-size: 7.5pt; line-height: 4.8mm;
    font-weight: 700; text-align: center; }
  .nt-mini span.an.good { background: var(--ok); border-color: var(--ok); color: #fff; }
  .nt-mini span.an.warn { background: var(--mittel); border-color: var(--mittel); color: #fff; }
  .nt-mini span.an.bad { background: var(--hoch); border-color: var(--hoch); color: #fff; }
  .nsk2 { margin-top: 3.5mm; display: flex; flex-wrap: wrap; align-items: center; column-gap: 3.4mm; row-gap: 1mm; font-size: 7pt; line-height: 1.35; color: var(--ink-2); }
  .nsk2 .label { margin: 0 1mm 0 0; }
  .nsk2 i { display: inline-block; width: 2.4mm; height: 2.4mm; margin-right: 1.3mm; vertical-align: -.2mm; }
  .nsk2 i.good { background: var(--ok); } .nsk2 i.warn { background: var(--mittel); } .nsk2 i.bad { background: var(--hoch); }
  .nsk2 b { font-weight: 700; color: var(--ink); }
  .zaehler .zahl { font-size: 24pt; line-height: 1; font-weight: 700; letter-spacing: -.01em; margin-top: 4.5mm; }
  .zaehler .klein { display: block; margin-top: 1mm; }
  .verteilung { margin-top: 3mm; width: 34mm; }
  .verteilung li { display: flex; justify-content: space-between; align-items: baseline; padding: .9mm 0; border-top: .2mm solid var(--haar-2); }
  .verteilung li:first-child { border-top: 0; }
  .verteilung b { font-size: 9pt; }
  .top3 ol > li { display: grid; grid-template-columns: 13mm minmax(0, 1fr) auto; column-gap: 3mm; align-items: baseline;
             padding: 2.2mm 0 2.4mm; border-top: .2mm solid var(--haar); }
  .top3 ol > li:first-child { border-top: 0; padding-top: 0; }
  .top3 .fnr { font-size: 8pt; font-weight: 700; color: var(--ink-4); }
  .top3 b { display: block; font-size: 10pt; line-height: 1.3; }
  .top3 .rechts { text-align: right; }
  .top3 .seite { display: block; font-size: 7.5pt; line-height: 1.3; color: var(--ink-4); margin-top: 1.2mm; }
  .top3 .kurz { display: block; font-size: 9pt; line-height: 1.4; color: var(--ink-3); margin-top: .4mm; }
  .cta { align-items: center; }
  .cta .label { margin-bottom: 1mm; }
  .cta b { display: block; font-size: 11pt; line-height: 1.3; }
  .cta p { font-size: 9pt; line-height: 1.4; color: var(--ink-2); }
  .cta-knopf { text-align: left; }

  /* ---------- 02 Feststellungen ---------- */
  .bf { border-top: .35mm solid var(--ink); padding-top: 2.6mm; margin-top: 7mm; }
  .bf.erst { margin-top: 0; }
  .bf-kopf { align-items: baseline; }
  .bf-nr { font-size: 13pt; line-height: 1.25; font-weight: 700; color: var(--ink-4); }
  .bf h2 { font-size: 13pt; line-height: 1.25; font-weight: 700; }
  .bf-meta { margin-top: 1mm; align-items: baseline; }
  .bf-fach { font-size: 8pt; line-height: 1.35; color: var(--ink-3); }
  .bf-text { margin-top: 4mm; }
  .bf-text p { font-size: 9pt; line-height: 1.42; color: var(--ink-2); margin-top: 1.1mm; }
  .bf-text p.wirk { color: var(--ink); font-weight: 700; }
  .bf-text .label + p + .label { margin-top: 3mm; }
  .bf-tech { margin-top: 3.2mm; align-items: baseline; }
  .sek { align-items: baseline; margin-bottom: 4mm; }
  .sek h2 { font-size: 13pt; line-height: 1.25; font-weight: 700; }
  .gz { border-top: .2mm solid var(--haar); padding: 2.3mm 0 2.5mm; align-items: baseline; }
  .gz.erst { border-top: .35mm solid var(--ink); }
  .gz .fnr { display: block; font-size: 9.5pt; line-height: 1.3; font-weight: 700; color: var(--ink-4); }
  .gz-meta { display: block; font-size: 7.5pt; line-height: 1.35; color: var(--ink-3); margin-top: .4mm; }
  .gz b { display: block; font-size: 9.5pt; line-height: 1.3; }
  .gz .kurz { display: block; font-size: 9pt; line-height: 1.4; color: var(--ink-2); margin-top: .4mm; }
  .gz .auf { display: block; font-size: 8pt; line-height: 1.35; color: var(--ink-3); margin-top: .6mm; }
  .gz-fuss { margin-top: 2.5mm; font-size: 7.5pt; color: var(--ink-4); }
  .positiv-liste { margin-top: 4mm; border-top: .2mm solid var(--haar); }
  .positiv-liste li { position: relative; padding: 1.7mm 0 1.9mm 5mm; border-bottom: .2mm solid var(--haar-2); font-size: 9.5pt; line-height: 1.4; color: var(--ink-2); }
  .positiv-liste li::before { content: ""; position: absolute; left: 0; top: 2.85mm; width: 1.9mm; height: 1.9mm; background: var(--ok); }
  .umgesetzt .zahl { font-size: 24pt; line-height: 1; font-weight: 700; color: var(--ok); margin-top: 4.5mm; }
  .umgesetzt .klein { display: block; margin-top: 1mm; }

  /* ---------- 03 Empfehlungen ---------- */
  .kopfzeile { margin-bottom: 2.4mm; align-items: end; }
  .label.hell { color: var(--ink-4); }
  .nw { white-space: nowrap; }
  .mz { border-top: .2mm solid var(--haar); padding: 2.2mm 0 2.4mm; align-items: baseline; }
  .mz.erst { border-top: .35mm solid var(--ink); }
  .mz .mnr { font-size: 13pt; line-height: 1.2; font-weight: 700; color: var(--ink); }
  .mz b { display: block; font-size: 10pt; line-height: 1.3; }
  .mz p { font-size: 9pt; line-height: 1.36; color: var(--ink-2); margin-top: .5mm; }
  .mz .wert { font-size: 8.5pt; line-height: 1.4; color: var(--ink); }
  .mz .bezug { font-size: 8pt; line-height: 1.4; color: var(--ink-3); margin-top: .6mm; }
  .mz .bezug .seitenref { white-space: nowrap; color: var(--ink-4); }
  .mz .zust { font-size: 8pt; line-height: 1.4; color: var(--ink-3); margin-top: .8mm; }
  .pentest h2 { font-size: 13pt; line-height: 1.25; font-weight: 700; }
  .pentest .lead-s { margin-top: 2mm; font-size: 10pt; }
  .arten { margin-top: 3.5mm; width: 46mm; }
  .arten li { padding: 1.8mm 0 2mm; border-top: .2mm solid var(--haar); }
  .arten b { display: block; font-size: 9pt; line-height: 1.3; }
  .arten span { display: block; font-size: 8.5pt; line-height: 1.4; color: var(--ink-3); margin-top: .3mm; }
  .schritte { margin-top: 4mm; row-gap: 0; }
  .schritte li { display: grid; grid-template-columns: 6mm minmax(0, 1fr); padding: 1.8mm 0 2mm; border-top: .2mm solid var(--haar); font-size: 8.5pt; line-height: 1.4; color: var(--ink-2); }
  .schritte .n { font-weight: 700; color: var(--ink); }
  .schritte b { display: block; color: var(--ink); font-size: 9pt; line-height: 1.3; margin-bottom: .3mm; }
  .schritte .n { font-size: 9pt; line-height: 1.3; }
  .pentest .link { margin-top: 3mm; }
  .pentest .link a { color: var(--ink); }

  /* ---------- 04 Über Reineke Technik ---------- */
  .portrait { display: block; width: 100%; height: 66mm; object-fit: cover; object-position: center 22%; filter: grayscale(100%); }
  .p-name { font-size: 13pt; line-height: 1.25; font-weight: 700; }
  .p-rolle { font-size: 8.5pt; color: var(--ink-3); margin: .6mm 0 4mm; }
  .person p + p { margin-top: 2.6mm; }
  .zitat { font-size: 16pt; line-height: 1.35; font-weight: 400; color: var(--ink); letter-spacing: -.005em; }
  .zitat::before { content: ""; display: block; width: 12mm; border-top: .8mm solid var(--rot); margin-bottom: 4mm; }
  .drei > div { border-top: .2mm solid var(--haar); padding-top: 2.6mm; }
  .drei h3 { font-size: 10pt; line-height: 1.3; font-weight: 700; }
  .drei p { font-size: 9pt; line-height: 1.42; color: var(--ink-2); margin-top: .8mm; }
  .v-wert { font-size: 20pt; line-height: 1.1; font-weight: 700; letter-spacing: -.01em; margin: 2.2mm 0 1.6mm; }
  .v-wert.lang { font-size: 14pt; line-height: 1.25; }
  .leist { column-count: 2; column-gap: 5mm; }
  .leist li { position: relative; padding-left: 4mm; font-size: 9.5pt; line-height: 1.4; margin-bottom: 1.4mm; break-inside: avoid; color: var(--ink-2); }
  .leist li::before { content: "–"; position: absolute; left: 0; color: var(--ink-4); }

  /* ---------- 05 Nächster Schritt ---------- */
  .cta-gross .lead { font-size: 13pt; }
  .cta-gross .btn { font-size: 10.5pt; padding: 4mm 8mm; margin-top: 6mm; }
  .qr img { display: block; width: 32mm; height: 32mm; }
  /* Offene Punkte: Die Seite hat keine Seitenplanung, der Block muss mit vier Punkten in die freien 48 mm passen. */
  .blk.offen { margin-top: 7mm; }
  .offen .lead-s { font-size: 10pt; }
  .offen-liste { margin-top: 1.4mm; }
  .offen-liste li { position: relative; padding-left: 4mm; font-size: 9.5pt; line-height: 1.4; color: var(--ink-2); }
  .offen-liste li + li { margin-top: 1mm; }
  .offen-liste li::before { content: "–"; position: absolute; left: 0; color: var(--ink-4); }
  .qr .klein { margin-top: 1.6mm; }
  .ablauf .gz-n { font-size: 30pt; line-height: 1; font-weight: 700; color: var(--ink); margin: 2mm 0 2.5mm; }
  .kontakt { display: grid; grid-template-columns: 20mm minmax(0, 1fr); column-gap: 4mm; border-top: .2mm solid var(--haar); padding-top: 3mm; }
  .kontakt.ohne { grid-template-columns: minmax(0, 1fr); }
  .kontakt img { width: 20mm; height: 24mm; object-fit: cover; object-position: center 20%; filter: grayscale(100%); }
  .kontakt .n { font-size: 10pt; font-weight: 700; line-height: 1.3; }
  .kontakt .r { font-size: 8.5pt; color: var(--ink-3); margin-bottom: 1.6mm; }
  .kontakt .c { font-size: 9pt; line-height: 1.55; }
  .absender p { font-size: 8.5pt; line-height: 1.5; color: var(--ink-2); margin-top: 1.2mm; }
  .absender a.unterstr { color: var(--ink); }
  .absender .pflicht { margin-top: 3mm; padding-top: 2mm; border-top: .2mm solid var(--linie); color: var(--ink-2); }
  .logo-voll { display: block; width: 15mm; height: auto; margin-top: .6mm; }

  /* ---------- Anhang ---------- */
  .az { border-top: .2mm solid var(--haar); padding: 1.8mm 0 2mm; align-items: baseline; }
  .az.erst { border-top: .35mm solid var(--ink); }
  .az b { font-size: 9pt; }
  .az .t { font-size: 8.5pt; line-height: 1.4; color: var(--ink-2); }
  .az .g { font-size: 8pt; line-height: 1.4; color: var(--ink-3); }
  .az .nb { font-size: 11pt; line-height: 1.1; font-weight: 700; }
  .az .sc { margin-left: 2mm; }
  .az .mono.wert { color: var(--ink-2); font-size: 7.2pt; }
  .az.sub { border-top: .2mm solid var(--haar-2); padding: 1.5mm 0 1.7mm; }
  .az.sub .t { font-size: 8pt; line-height: 1.38; }
  .az .eingerueckt { padding-left: 4mm; }
  .gruppe-kopf { border-top: .35mm solid var(--ink); padding-top: 2.2mm; margin-top: 4mm; }
  .gruppe-kopf.erst { margin-top: 0; }
  .gruppe-kopf + .az { border-top: 0; }
  .az .g.pr { font-size: 7.5pt; }
`;

export const DECKBLATT_CSS = String.raw`
  section.page.dcw { position: relative; box-sizing: border-box; width: 210mm; height: 297mm; margin: 0; padding: 0; overflow: hidden;
    font-family: "Liberation Sans", Arial, Helvetica, sans-serif; page-break-after: always; break-after: page; }
  .dcw * { box-sizing: border-box; margin: 0; padding: 0; }
  .dcw .dcw-logo { position: absolute; }
  .dcw .dcw-logo img { position: absolute; top: 0; left: 0; width: 100%; height: auto; display: block; }
  .dcw .dcw-logo .dcw-fuchs { clip-path: inset(0 0 18% 0); }
  .dcw .dcw-logo .dcw-wort { clip-path: inset(82% 0 0 0); }

  section.page.dcw { background: #fff; color: #1d1d1b; }
  .dcw .dcw-logo { top: 34mm; left: 64.7mm; width: 80.6mm; height: 92.7mm; }
  .dcw .dcw-spruch { margin-top: 8mm; }
  .dcw .dcw-spruch::before { content: ""; display: block; width: 18mm; border-top: .9mm solid #DC0C23; margin-bottom: 4mm; }
  .dcw .dcw-spruch div { font-size: 22pt; line-height: 1.16; font-weight: 700; letter-spacing: -.012em; }
  .dcw .dcw-z1 { color: #DC0C23; } .dcw .dcw-z2 { color: #1d1d1b; }
  .dcw .dcw-titel { position: absolute; top: 178mm; left: 15mm; right: 15mm; }
  .dcw .dcw-kicker { font-size: 8.5pt; line-height: 1.3; font-weight: 700; letter-spacing: .14em; color: #DC0C23; }
  .dcw .dcw-domain { margin-top: 2.6mm; font-size: 28.5pt; line-height: 1.12; font-weight: 700; letter-spacing: -.012em; overflow-wrap: anywhere; }
  .dcw.dcw--l .dcw-domain { font-size: 25pt; } .dcw.dcw--xl .dcw-domain { font-size: 21pt; }
  .dcw .dcw-sub { margin-top: 3.2mm; max-width: 150mm; font-size: 9.75pt; line-height: 1.45; color: #5a5a5a; }
  .dcw .dcw-fuss { position: absolute; left: 15mm; right: 15mm; top: 254mm; display: grid; grid-template-columns: 1.25fr 1fr 1fr; column-gap: 6mm;
    border-top: .35mm solid #1d1d1b; padding-top: 3mm; }
  .dcw .dcw-fuss .dcw-l { display: block; font-size: 6.8pt; line-height: 1.3; font-weight: 700; letter-spacing: .14em; color: #5a5a5a; text-transform: uppercase; margin-bottom: 1.2mm; }
  .dcw .dcw-fuss p { font-size: 8.5pt; line-height: 1.42; color: #1d1d1b; }
  .dcw .dcw-fuss b { font-weight: 700; }
`;
