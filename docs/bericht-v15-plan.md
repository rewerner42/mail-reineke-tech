# Bericht v15 — Umbau des Berichtsgenerators

Stand: 30.10.2026, **nach der Prüfung** · Branch: `feat/bericht-intern-anhang`

> Fassung 2. Die Prüfung hat 28 Befunde geliefert; die wesentlichen sind
> eingearbeitet. Was sich gegenüber Fassung 1 geändert hat, steht in §10.

## 1 Ziel

Der Worker erzeugt heute einen vierseitigen Sicherheitsbefund, dessen Texte im
Code stehen. Ziel ist der 9- bis 15-seitige Bericht aus der Referenz:
Deckblatt, Inhaltsverzeichnis, Kapitel 01–05, Anhang A/B — vollständig aus
einem freigegebenen Textkatalog, ohne dass der Generator Sätze bildet.

Alle drei Wege bekommen denselben Bericht, unverändert (Werner, 30.10.2026):
`/report` (passwortgeschützt), Interessentenversand, `/bericht`
(Selbstbedienung).

**Offen und Werner vorzulegen:** Die Prüfung hält dagegen, dass genau diese
Entscheidung die Angriffsfläche vergrößert, die E27 einhegen soll — siehe §8.

**Nicht entschieden: für welche Marke.** Der Plan galt stillschweigend für
`reineke`. Siehe §8.

## 2 Was belegt ist

**Die Referenz reproduziert sich hier exakt.** 13 Datensätze
(9/10/10/10/11×5/14/15×3 Seiten), View-Model-Vergleich gegen `erwartet/`
zeigt nur die fünf ausgenommenen Bildpfade, Prüfskripte ohne Befund. Von der
Prüfung bestätigt.

**Schriftmessung im Cloudflare-Container** (temporäre Sonde, danach entfernt):

| angefordert | gemessene Textbreite | Befund |
|---|---|---|
| `Liberation Sans` / `Arial` / `Helvetica` | 437,62 px (alle gleich) | vorhanden, metrisch gleich |
| `DejaVu Sans Mono` / `monospace` | 549,07 px (beide gleich) | vorhanden |
| frei erfundene Familie (Gegenprobe) | 399,47 px | Rückfall messbar anders |
| `Liberation Serif` / `Times New Roman` | = Rückfall | fehlt, wird nicht gebraucht |

Die Vorlage hat genau drei `font-family`-Deklarationen und keine
Serifenschrift. Soweit belegt.

**Was die Messung NICHT belegt** (Korrektur aus der Prüfung): Gemessen wurden
*Breiten*. Die rund 45 Konstanten sind *Höhen* in Millimetern. Außerdem
bestimmt Cloudflare die Chrome-Version, und die Referenz-PDFs entstanden unter
macOS mit Arial und Menlo als Ersatz — die Goldstandard-Seitenzahlen sind also
selbst schon ein Fremdschrift-Ergebnis. Die Silbentrennung im Container ist
unbekannt, und die Vorlage setzt nirgends `hyphens: none`.
**Richtige Einordnung:** metrische Gleichheit der Breiten belegt;
Zeilenhöhen, Chrome-Version und Silbentrennung offen — abzusichern über die
Überlaufprüfung bei *jedem* Lauf, nicht über die Messung.

## 3 Inventur der Bausteine (korrigiert)

Aus MDNs Bewertungstabelle (`mdn/mdn-http-observatory`, `src/grader/charts.js`
× `src/types.js`):

| | |
|---|---|
| Observatory-Ergebniscodes gesamt | **77** |
| mit Punktabzug → Feststellung (12 Felder) | 38 |
| mit Pluspunkten → Positivliste | 16 |
| neutral | 23 |
| **bei uns übersetzt** (`RESULT_DE`) | **28** |
| **bei uns fehlend** | **49** |
| ungültige Codes zum Wegwerfen | **0** |

**Korrektur.** Fassung 1 nannte 36 übersetzte Codes und „8 Notnägel, müssen
weg". Beides falsch: `src/observatory-i18n.ts` enthält *zwei* Tabellen,
`RESULT_DE` (28 Ergebniscodes) und `TEST_TITLES_DE` (8 Testnamen für die
Überschriften). Mein Zähler hat beide in einen Topf geworfen. Die 8 Testnamen
sind gültig und werden gebraucht. 28 + 49 = 77 geht glatt auf.

Eigene Prüfungen (`src/analyzers/*.ts`) — von der Prüfung Zeile für Zeile
bestätigt:

| Modul | Mangel | Hinweis | OK | Info |
|---|---|---|---|---|
| dmarc | 8 | 3 | 2 | 3 |
| spf | 5 | 5 | 1 | 1 |
| mta-sts | 3 | 5 | 1 | 2 |
| mx | 2 | 1 | 1 | 2 |
| dkim | 1 | 3 | 1 | 0 |
| tls-rpt | 1 | 2 | 1 | 1 |
| dnssec | Einstufung zur Laufzeit, rund 5 Zustände | | | |

56 literale Meldungen, rund 60 unterscheidbare Zustände (nicht 62).

**Die Granularität ist eine Entscheidung, keine Lücke.** Der freigegebene
Katalog hat 12 Observatory-Feststellungen, mehrere davon decken bewusst alle
Spielarten eines Tests ab. 38 statt 12 ist Faktor 3. `PROMPT.md` §3.2 fordert
`obs_<test>_<variante>`, also ist es gedeckt — aber es ist mehr Arbeit, als
Fassung 1 behauptet hat.

**Die 23 neutralen Codes brauchen eine Regel.** Fassung 1 hat sie keinem Topf
zugewiesen und trotzdem mitgezählt. Entweder 23 eigene Kurztexte oder die
ausdrückliche Regel „neutral erscheint nicht im Bericht". Zu entscheiden in
Stufe 1, nicht erst in Stufe 4.

## 4 Architekturentscheidung (korrigiert)

**Nunjucks scheidet aus, aber nicht aus dem Grund, den Fassung 1 nannte.**

Richtig bleibt: Workers verbieten `eval` und `new Function`, also ginge nur
vorkompiliertes Nunjucks.

**Falsch war die zweite Begründung.** Fassung 1 behauptete, handgeschriebenes
TypeScript räume das Problem aus, dass Nunjucks leere Listen als *wahr*
behandelt. Das stimmt nicht: JavaScript hat **dieselbe** Semantik. `[]` ist in
JS wahr, `[] || x` ergibt `[]`. Der Fehler wandert mit, er verschwindet nicht.
Die Risikozeile „ausgeräumt" war falsch.

Betroffen sind **22 Stellen** in `template.html.j2`, nicht „rund ein Dutzend".
Die gefährlichste ist Zeile 323:
`{% set weitere = nach_prio.gering or positiv or not haupt %}` — in Python
ergibt das eine Liste oder einen Wahrheitswert, in JS nie dasselbe. Diese eine
Zeile steuert über 356/367/647 die Gesamtseitenzahl und die Seitenzahlen beider
Anhänge.

**Maßnahme statt Behauptung:** eine `truthy()`-Hilfsfunktion mit
Python-Semantik, konsequent an allen 22 Stellen, plus ein Lint, der nacktes
`if (liste)` im Berichtscode verbietet.

**Ersatz für StrictUndefined.** `PROMPT.md` §2.3 verlangt ausdrücklich, dass
fehlende Daten das Rendern *abbrechen* statt still leer zu bleiben. In
handgeschriebenem TypeScript rendert `undefined` als leerer String — die
Sicherung fiele weg, mit der der Plan Nunjucks ablehnt. Ohne Ersatz wäre der
Port **unsicherer** als der verworfene Weg. Maßnahme: ein Proxy über das
View-Model, der jeden Zugriff auf ein fehlendes Feld werfen lässt.

Gewählt bleibt:

1. `build_viewmodel()` + `roh_feststellungen()` nach TypeScript.
   **Umfang korrigiert:** `render.py:73–332` sind 260 Zeilen, mit den
   Hilfsfunktionen (`fill`, `minus`, `datum_text`, `note_info`) rund 290 —
   nicht 160.
2. Seitenplanung (`template.html.j2:296–373`, 78 Zeilen) ins View-Model,
   ziffergleich. **Ausgenommen die letzten zwei Zeilen:** `HB_HEISST` sind
   vier deutsche Sätze und gehören in den Katalog, nicht in die Planung.
3. Vorlage als TypeScript-Templates. **Umfang korrigiert:**
   `template.html.j2` 783 Zeilen (davon 265 CSS) + `deckblatt.html.j2` 48
   Zeilen = 831. Der Gesamtport ist rund **1 100 Zeilen, nicht 240.**
4. `CHECK_JS` über `page.evaluate()`.
5. PDF-Prüfungen (`qpdf`, `pdfinfo -dests`) außerhalb der Laufzeit.
6. Die Python-Referenz bleibt Goldstandard.

### Die zwei echten Portierfallen

Die Arithmetik ist unkritisch — `round(0,'ceil')` ist numerisch gleich
`Math.ceil`, Python 3 `/` ist True Division wie in JS, und die 13
Goldstandards enthalten keine Astral- oder NFC-Falle. Fassung 1 hat genau das
als Risiko genannt und die beiden wirklichen Fallen verschwiegen:

**Mutationssemantik.** `template.html.j2:306–318` macht
`fp.seiten = fp.seiten + [fp.akt]` (neue Liste) und danach `fp.akt = []`
(Neubindung, kein Leeren). Als `seiten.push(akt); akt.length = 0` portiert
löscht man die gerade abgelegte Seite.

**`minus()`.** `render.py:56` ersetzt mit Pythons `str.replace` **alle**
Vorkommen; `String.prototype.replace("-","−")` ersetzt nur das **erste**.
Betrifft Notenbereiche und Score-Modifier.

## 5 Fehler im heutigen Worker (erweitert)

**A3 — vier Druckstellen, zwei gegenläufige Funktionen.** Fassung 1 nannte
zwei Zeilen. Tatsächlich:

- `build.ts:87` druckt „Alle geprüften Sicherheits-Header sind gesetzt"
- `build.ts:233` druckt auf demselben Blatt „Bei den Website-Sicherheits-Headern bestehen Lücken."
- dazu „Note –" im Badge und `0/? bestanden` in der Überschrift
- `build.ts:54` → `gradeSeverity(null) === "fail"`
- `grading.ts:24` → `gradeToSeverity(null) === "info"`

Zwei Funktionen beantworten dieselbe Frage gegensätzlich.

**Korrektur meiner Aussage zu sharp.eu.** „Kritisch" entsteht erst bei
`fails >= 3` (`build.ts:199`). Eine nicht bewertbare Website allein ergibt
„Mittel". sharp.eu ist kritisch, weil DMARC, DNSSEC *und* Website fallen —
nicht wegen der Website allein. Was ich dir gesagt habe, war zu stark.

**Fünf Stufen gegen vier Katalogeinträge.** Der Worker kennt
`Kritisch, Hoch, Mittel, Niedrig, Gering`, der Katalog nur
`kritisch, hoch, mittel, gering`. „Niedrig" hat keine Entsprechung — der
Zugriff liefe ins Leere und druckte still eine leere Zeile.

**Die Variante ist kein Ergebniscode.** Fassung 1: „ein Feld im Typ und eine
Zuweisung". Falsch. Die Referenz erwartet Kurztoken (`id: "csp"`,
`variant: "missing"`), `t.result` liefert `csp-not-implemented`. Der Schlüssel
hieße sonst `obs_csp_csp-not-implemented`. Es braucht **zwei
Abbildungstabellen** — Testname → Kurz-ID (10 Werte), Ergebniscode →
Kurz-Variante (bis 77 Werte) — und laut `PROMPT.md` §3.1 als Datei im
Repository.

**30 von 56 Meldungen werden zur Laufzeit zusammengesetzt.** Mindestens fünf
tragen rohen Fremdtext in den Bericht, etwa
`DNSSEC konnte nicht geprüft werden: ${err.message}`. Das verstößt gegen die
oberste Regel des Auftrags. Rund 25 Meldungen brauchen `{platzhalter}`-Felder,
die Fehlerfälle einen freigegebenen Ersatztext.

**Der 400-KB-Deckel.** `MAX_HTML_BYTES = 400_000` (`src/pdf/render.ts:9`),
geprüft an zwei Stellen. Das Logo steckt heute als data-URI im Seitenkopf,
also auf *jeder* Seite: 18 009 B → 24 012 B base64 × 13 Seiten = 312 KB, plus
80 KB HTML, plus Porträt und QR = rund 436 KB. **Der heutige Weg sprengt den
Deckel beim längeren Bericht.** Auf dem Mailweg liefert `index.ts:532` dann
still `null` — Mail ohne Anhang.
*Lösung, bereits unterstützt:* `src/pdf/render.ts:54` lässt Same-Origin-URLs
zu und setzt `<base href>`. Die Bilder wandern nach `public/assets/`, das
View-Model zeigt auf URLs statt auf data-URIs. Kein neuer Mechanismus nötig.

**Zeitsperre nur auf zwei von drei Wegen.** `PDF_TIMEOUT_MS` greift nur im
Interessentenversand und bei `/bericht`. `/api/generate-report` hat keine.
`withTimeout` ist ein `Promise.race`, das `null` liefert — der Browser wird
nicht geschlossen.

## 6 Zwölf beschlossene Katalogtexte fehlen in der Referenz

Fassung 1 nannte die Referenz „fertig und freigegeben" und baute darauf ihre
Abnahmen. Die Prüfung hat nachgesehen: Anhang F der Inhaltsprüfung listet
fertige Texte, die in `katalog.json` **nicht** angekommen sind —
`texte.umfang_kurz` (rechtlich motiviert, C19 als *Pflicht* markiert),
`texte.begleitwort`, `texte.next_text`, `texte.cta_massnahmen`,
`texte.nachpruefung`, `texte.lesehinweis`, `texte.offen_einleitung`,
`texte.offen_website`, `texte.cta_text_ohne_feststellungen`,
`bereiche.website.satz.bewertet_alle`, das Feld `offen` an den Feststellungen
und `zustaendig` an den Maßnahmen.

Dazu: `firma.json:65` trägt weiterhin „NIS-2-Betroffenheitsanalyse", obwohl
D24/R18 das als Rechtsdienstleistung eingestuft und
„NIS-2-Bestandsaufnahme der Sicherheitsmaßnahmen" beschlossen hat.

## 7 Stufen (Reihenfolge korrigiert)

Fassung 1 hatte die Reihenfolge falsch: B6, B12 und B13 ändern Textlängen und
Befundzahlen und damit **zwingend die Seitenzahlen**. B12 allein nimmt
budde.de und lauterbach von 11 auf 10 Feststellungen. Eine Seitenzahl-Abnahme
davor wäre grün durchgegangen und in Stufe 3 gebrochen.

### Stufe 1 — Fundament

- Ergebniscode durchreichen + die zwei Abbildungstabellen als Datei
- DNSSEC-Zustände einzeln aufzählen
- Regel für die 23 neutralen Codes festlegen
- Signal-Schicht (Scan → serialisierbares Signal)
- `{platzhalter}`-Felder für die rund 25 zusammengesetzten Meldungen
- `build_viewmodel()` + `roh_feststellungen()` portiert, mit `truthy()` und
  dem Proxy gegen fehlende Felder

**Abnahme:** View-Model gleichwertig zu den 13 Goldstandards, ausgenommen die
fünf Bildpfade **und `bericht_nr`** (`PROMPT.md` §6.1 nennt beide; Fassung 1
hatte die Nummer vergessen, womit die Abnahme nach Stufe 3 unbestehbar
gewesen wäre). Planungsfelder liegen in einem getrennten Objekt mit eigener
Abnahme — die Goldstandards enthalten kein einziges Planungsfeld.

### Stufe 2 — Inhalt zuerst, dann Seitenzahlen

- B6, B12, B13 und die zwölf fehlenden Texte aus §6 einarbeiten
- Referenz **neu rendern**, neue Soll-Seitenzahlen festschreiben
- erst dann Vorlage und Seitenplanung portieren
- Überlaufprüfung zur Laufzeit

**Abnahme:** Seitenzahlen gegen die *neuen* Soll-Werte, `pruefe_struktur.py`
ohne Befund.

### Stufe 3 — Die Fehler

- A3: vier Druckstellen und zwei Funktionen zusammenführen
- „Niedrig" auflösen (fünfte Stufe oder Zusammenlegung)
- Bilder nach `public/assets/`, data-URIs raus
- Zeitsperre auch für `/api/generate-report`, Browser sicher schließen
- Bericht-Nummer aus Odoo `ir.sequence`
- Fußzeile `scan.reineke-technik.de` → `scan.reineke.tech`
- Pflichtangaben § 35a GmbHG — **nur für Reineke**, siehe §8
- Zitat D23, `firma.json` D24

### Stufe 4 — Der Katalog

- rund 57 neue volle Bausteine
- **Fachprüfung, bevor Werner liest** (ausdrücklich gefordert)
- Werner liest alle, in fünf Portionen nach Prüfbereich

**Abnahme** — alle fünf Punkte aus `PROMPT.md` §3.5, nicht nur einer:
(1) jeder Code hat einen Schlüssel mit allen Feldern, (2) **je Schlüssel ein
synthetischer Datensatz, gerendert, auf Überlauf geprüft** — das ist das
einzige Verfahren, das 38 neue Textlängen gegen die kalibrierten Millimeter
prüft, (3) Abbruch bei unaufgelöstem `{platzhalter}` oder `obs_generic`,
(4) alle 16 Kombinationen aus Handlungsbedarf × höchster Einstufung,
(5) Lauf bei jedem Build.

Dazu A4 vollständig: Umweg-Regel und **Einstufung nach Abzug** (macht 38
`prio`-Entscheidungen ableitbar statt erfindbar) und spier.de als 14.
Datensatz.

### Stufe 5 — Prüfung der Seite

Team prüft `scan.reineke.tech` samt Versandweg. Danach Musterbericht (E26).

## 8 Was Werner entscheiden muss

**E27 — Angriffsfläche von `/bericht`.** Heute liefert die Selbstbedienung
ohne Passwort einen Vierseiter über eine beliebige fremde Domain. Künftig
wären es elf Seiten mit vollem Messwert-Anhang. E27 fordert „PDF nur für
angemeldete Nutzer oder nach Nachweis der Domain". Die Entscheidung
„alle drei Wege, derselbe Bericht" vergrößert genau das.

**Marke und Sprache.** Der Plan galt stillschweigend für `reineke`.
`katalog.json` ist durchgängig deutsch, die Vorlage auf weißen Grund
kalibriert, Kapitel 03 heißt wörtlich „Über Reineke Technik". Für `vorcyber`
(englisch, dunkel/gold, LLC) passt davon nichts, und die § 35a-Angaben
(Amtsgericht Paderborn, HRB 15938) dürfen dort nicht erscheinen. Entweder v15
gilt zunächst nur für Reineke, oder der Katalog braucht von Anfang an eine
Sprach- und Themenachse — das ändert Stufe 4 grundlegend.

**A5, zwei übersehene Teile.** Werner hat den Haftungs- und
Datenschutzblock abgelehnt. A5 enthielt aber drei Dinge; (b) Ergänzung der
Datenschutzerklärung und (c) **Löschfrist für nicht versandte Berichte** sind
Arbeiten an der Anwendung, nicht am Bericht, und sind stillschweigend
mitgefallen.

## 9 Risiken (korrigiert)

| Risiko | Stand |
|---|---|
| Schriftbreiten im Container | gemessen, gleich |
| Zeilenhöhen, Chrome-Version, Silbentrennung | **offen** — über Überlaufprüfung abzusichern |
| Leere Listen kippen Bedingungen | **nicht ausgeräumt** — `truthy()` + Lint an 22 Stellen |
| Fehlende Felder rendern still leer | **offen** — Proxy als Ersatz für StrictUndefined |
| 400-KB-Deckel beim längeren Bericht | **real** — Bilder auf Same-Origin-URLs umstellen |
| Mutationssemantik der Seitenplanung | benannt, Disziplin nötig |
| Katalogtexte fachlich falsch | Fachprüfung vor Werners Lesen |
| Zeitlimit / Speicher beim längeren Bericht | zu messen; base64-Anhang zweimal gehalten |
| Bundle zu groß | 196 KiB von 10 MiB, unkritisch |

## 10 Was sich gegenüber Fassung 1 geändert hat

- übersetzte Codes 36 → **28**; „8 Notnägel" → **0** (49 fehlende bleiben)
- Meldungen 62 → **56 literal, rund 60 Zustände**
- Portumfang 240 → **rund 1 100 Zeilen**
- „leere Listen ausgeräumt" → **gestrichen**, war falsch
- A3: 2 Stellen → **4 Druckstellen + 2 gegenläufige Funktionen**
- sharp.eu „Kritisch wegen der Website" → **Kritisch, weil alle drei fallen**
- `variant` „eine Zuweisung" → **zwei Abbildungstabellen**
- Stufenfolge: Inhalt (B6/B12/B13) **vor** die Seitenzahl-Abnahme
- `bericht_nr` in die Ausnahmeliste der Stufe-1-Abnahme
- neu: 400-KB-Deckel, fünfte Stufe „Niedrig", 23 neutrale Codes,
  zwölf fehlende Katalogtexte, Laufzeit-Textbausteine, StrictUndefined-Ersatz
- neu als Entscheidung: E27, Marke/Sprache, A5 (b) und (c)
