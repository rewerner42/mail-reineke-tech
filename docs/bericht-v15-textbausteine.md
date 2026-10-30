# Die Textbausteine des Berichts

Jede Feststellung im Bericht ist einer dieser Bausteine. Zur Laufzeit wird nichts
formuliert — was hier steht, steht im Bericht. `{geschweifte Klammern}` werden aus
dem Scan gefüllt: `{domain}`, `{record}` der DNS-Eintrag, `{text}` die Messzeile des
Scanners, `{policy}` die DMARC-Richtlinie, `{label}` der Name des Website-Tests,
`{modifier}` der Punktabzug, `{result_text}` die Originalmeldung des Prüfwerkzeugs.

**65 Bausteine:** 12 hoch, 28 mittel, 25 gering eingestuft.

**Geändert gegenüber dem vorigen Stand:** 190 Textstellen.

**Markierungen:** *geändert* heißt, der Text ist gegenüber dem vorigen Stand neu gefasst;
darunter stehen der alte Wortlaut („vorher“) und der Grund („Warum“). *neu* heißt, die Stelle
gab es vorher nicht. Ohne Markierung ist der Text unverändert.

Bei den Website-Bausteinen ist die Einstufung nicht gewählt, sondern aus MDNs eigenem
Punktabzug abgeleitet: ab 40 Punkten hoch, ab 10 mittel, darunter gering.

## So erscheinen die Felder im Bericht

Die Beschriftungen unten sind die, die auch im PDF stehen.

| Feld | Wo es steht |
|---|---|
| Titel | Inhaltsverzeichnis und Kapitel 05; bei hoch und mittel auch in der Zusammenfassung |
| Kurzfassung | unter dem Titel: in der Zusammenfassung (die drei wichtigsten) und in der Liste „Weitere Feststellungen“ (gering) |
| Sachverhalt, Was passieren kann, Folgen für Sie, Technischer Befund | nur auf der Karte in Kapitel 05, also nur bei hoch und mittel |
| Aufwand | auf der Karte als „Gering. …“, in der Liste als „Aufwand gering: …“ |
| Schritt in der Maßnahme | im Text der Maßnahme in Kapitel 02; mehrere Schritte werden mit „;“ verbunden, der Punkt kommt am Ende dazu |

Bei gering eingestuften Bausteinen stehen deshalb nur Titel, Kurzfassung, Aufwand und
Schritt im Bericht. Die übrigen Felder sind vollständig vorhanden, falls sich die
Einstufung einmal ändert, und stehen hier abgesetzt darunter.

---

## E-Mail — DMARC

### `dmarc_fehlt`  ·  Hoch  ·  DMARC

**Titel**  
Keine Regel gegen gefälschte Absender

**Kurzfassung**  ·  *geändert*  
Gefälschte E-Mails mit Ihrer Absenderadresse können Empfänger erreichen.
> vorher: Jeder kann E-Mails versenden, die scheinbar von Ihrer Domain stammen.
> Warum: „Jeder kann E-Mails versenden“ war absolut und gilt auch mit DMARC; entscheidend ist, ob Fälschungen ankommen, jetzt als Möglichkeit.

**Sachverhalt**  
Für die Domain ist kein DMARC-Eintrag veröffentlicht. Empfangende Mailserver erhalten keine Anweisung, wie sie mit E-Mails umgehen sollen, die Ihren Absender nur vortäuschen.

**Was passieren kann**  
Angreifer können E-Mails mit Ihrer Absenderadresse versenden, etwa gefälschte Rechnungen mit geänderter Bankverbindung oder Zahlungsanweisungen im Namen der Geschäftsführung.

**Folgen für Sie**  
Möglicher Schaden bei Kunden und Partnern sowie Vertrauensverlust in Ihre E-Mails.

**Aufwand gering bis mittel**  
DNS-Eintrag mit schrittweiser Einführung über einige Wochen.

**Technischer Befund**  
DMARC: kein Eintrag unter _dmarc.{domain} veröffentlicht

**Schritt in der Maßnahme**  
DMARC-Eintrag mit Berichtsadresse (rua) veröffentlichen und nach Auswertung der Berichte schrittweise bis „reject“ verschärfen

### `dmarc_none`  ·  Hoch  ·  DMARC

**Titel**  ·  *geändert*  
Keine Anweisung, gefälschte E-Mails abzuweisen
> vorher: Gefälschte E-Mails werden nicht abgewiesen
> Warum: „werden nicht abgewiesen“ behauptete ein Verhalten der Empfänger, das der Scan nicht misst; der Titel nennt jetzt den gemessenen Eintrag.

**Kurzfassung**  
Gefälschte E-Mails mit Ihrer Absenderadresse können weiterhin ankommen.

**Sachverhalt**  
Der DMARC-Eintrag steht auf „none“. Mailserver erhalten damit keine Anweisung, gefälschte E-Mails abzuweisen oder auszusortieren.

**Was passieren kann**  
Angreifer können E-Mails mit Ihrer Absenderadresse versenden, etwa gefälschte Rechnungen oder Zahlungsanweisungen im Namen der Geschäftsführung.

**Folgen für Sie**  
Möglicher Schaden bei Kunden und Partnern sowie Vertrauensverlust in Ihre E-Mails.

**Aufwand gering bis mittel**  
SPF und DKIM vervollständigen, dann schrittweise verschärfen.

**Technischer Befund**  
DMARC: {record}

**Schritt in der Maßnahme**  
DMARC-Richtlinie nach Auswertung der Berichte über „quarantine“ auf „reject“ anheben

### `dmarc_quarantine`  ·  Gering  ·  DMARC

**Titel**  
Gefälschte E-Mails sollen nur aussortiert werden

**Kurzfassung**  ·  *geändert*  
Aussortierte gefälschte E-Mails könnten trotzdem geöffnet werden.
> vorher: Gefälschte E-Mails landen im Spam-Ordner, statt abgewiesen zu werden.
> Warum: „landen im Spam-Ordner“ war Tatsache und wiederholte den Titel; jetzt die eigentliche Folge, ohne festzulegen, wohin der Empfänger aussortiert.

**Aufwand gering**  
Richtlinie auf „reject“ anheben.

**Schritt in der Maßnahme**  
DMARC-Richtlinie auf „reject“ anheben

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  ·  *geändert*  
Der DMARC-Eintrag steht auf „quarantine“. Mailserver sollen gefälschte E-Mails damit nur aussortieren.
> vorher: Der DMARC-Eintrag steht auf „quarantine“. Gefälschte E-Mails werden in den Spam-Ordner verschoben, aber nicht abgewiesen.
> Warum: Der Eintrag bittet nur ums Aussortieren, was der Empfänger tut, entscheidet er selbst; Wortlaut wie Titel und Bereichssatz.

**Was passieren kann**  ·  *geändert*  
Gefälschte E-Mails bleiben im Spam-Ordner lesbar und könnten dort doch geöffnet werden.
> vorher: Gefälschte Nachrichten bleiben im Spam-Ordner lesbar und werden dort gelegentlich doch geöffnet.
> Warum: Folge stand als Tatsache da („werden … geöffnet“); jetzt Möglichkeitsform und „E-Mails“ statt „Nachrichten“.

**Folgen für Sie**  
Geringes Restrisiko bei Empfängern, die ihren Spam-Ordner prüfen.

**Technischer Befund**  
DMARC: {record}

### `dmarc_kein_rua`  ·  Gering  ·  DMARC (rua)

**Titel**  
Keine Berichte über E-Mails in Ihrem Namen

**Kurzfassung**  ·  *geändert*  
Wer in Ihrem Namen E-Mails sendet, könnte unbemerkt bleiben.
> vorher: Sie erfahren nicht, wer in Ihrem Namen E-Mails versendet.
> Warum: „Sie erfahren nicht“ war absolut; ob der Inhaber es auf anderem Weg erfährt, misst der Scan nicht.

**Aufwand gering**  
Berichtsadresse im DMARC-Eintrag ergänzen.

**Schritt in der Maßnahme**  
Berichtsadresse (rua) im DMARC-Eintrag ergänzen

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Der DMARC-Eintrag enthält keine Adresse, an die Mailserver Auswertungsberichte senden (Angabe „rua“).

**Was passieren kann**  ·  *geändert*  
Missbrauchsversuche mit Ihrer Domain und Fehler in der eigenen Mailkonfiguration können unbemerkt bleiben.
> vorher: Missbrauchsversuche mit Ihrer Domain und Fehler in der eigenen Mailkonfiguration bleiben unbemerkt.
> Warum: Folge stand als Tatsache da („bleiben unbemerkt“).

**Folgen für Sie**  ·  *geändert*  
Probleme könnten erst auffallen, wenn Kunden sich melden oder E-Mails nicht ankommen.
> vorher: Probleme werden erst bemerkt, wenn Kunden sich melden oder E-Mails nicht ankommen.
> Warum: Folge stand als Tatsache da („werden erst bemerkt“).

**Technischer Befund**  
DMARC: {record} (kein rua-Tag)

### `dmarc_ungueltig`  ·  Hoch  ·  DMARC

**Titel**  ·  *geändert*  
Regel gegen gefälschte Absender ungültig
> vorher: DMARC-Eintrag ohne gültige Richtlinie
> Warum: Hoch eingestufter Titel in der Zusammenfassung, jetzt Klartext wie „Keine Regel gegen gefälschte Absender“; der Fachbegriff steht im Feld fach.

**Kurzfassung**  ·  *geändert*  
Gefälschte E-Mails mit Ihrer Absenderadresse können Empfänger erreichen.
> vorher: Der DMARC-Eintrag ist vorhanden, schützt aber nicht vor gefälschten Absendern.
> Warum: „schützt nicht vor gefälschten Absendern“ ist die verworfene „Kein Schutz“-Aussage und wiederholte den Titel; jetzt dieselbe Folge wie bei fehlendem DMARC.

**Sachverhalt**  
Unter _dmarc.{domain} ist ein Eintrag veröffentlicht, er enthält aber keine gültige Richtlinie (p=). Mailserver behandeln ihn bestenfalls wie die Stufe „none“.

**Was passieren kann**  ·  *geändert*  
Angreifer können E-Mails mit Ihrem Absender versenden, etwa an Ihre Kunden oder Ihre eigene Buchhaltung. Empfänger haben keine Anweisung, solche E-Mails abzuweisen.
> vorher: Angreifer können E-Mails mit Ihrem Absender versenden, etwa an Ihre Kunden oder Ihre eigene Buchhaltung. Empfänger haben keine Anweisung, solche Mails abzuweisen.
> Warum: Einheitlich „E-Mails“ statt „Mails“.

**Folgen für Sie**  
Gefälschte Rechnungen oder Zahlungsanweisungen in Ihrem Namen könnten Empfänger erreichen.

**Aufwand gering bis mittel**  
Eintrag korrigieren und Richtlinie schrittweise verschärfen.

**Technischer Befund**  
DMARC: {record}

**Schritt in der Maßnahme**  
DMARC-Eintrag korrigieren und schrittweise bis „reject“ verschärfen

### `dmarc_mehrfach`  ·  Hoch  ·  DMARC

**Titel**  ·  *neu*  
Regeln gegen gefälschte Absender heben sich auf
> Warum: Neuer Baustein aus der Technik-Prüfung: Bei mehreren DMARC-Einträgen lobte der Bericht bisher die Richtlinie des ersten, obwohl nach dem Standard keiner gilt.

**Kurzfassung**  ·  *neu*  
Gefälschte E-Mails mit Ihrer Absenderadresse können Empfänger erreichen.

**Sachverhalt**  ·  *neu*  
Unter _dmarc.{domain} stehen mehrere DMARC-Einträge. Nach dem Standard (RFC 7489) wenden empfangende Mailserver dann keinen davon an.

**Was passieren kann**  ·  *neu*  
Angreifer könnten E-Mails mit Ihrer Absenderadresse versenden, ohne dass Empfänger eine Anweisung erhalten, sie abzuweisen.

**Folgen für Sie**  ·  *neu*  
Möglicher Schaden bei Kunden und Partnern sowie Vertrauensverlust in Ihre E-Mails.

**Aufwand gering**  ·  *neu*  
Einträge zu einem einzigen zusammenführen.

**Technischer Befund**  ·  *neu*  
DMARC: mehrere Einträge unter _dmarc.{domain}

**Schritt in der Maßnahme**  ·  *neu*  
DMARC-Einträge zu einem einzigen zusammenführen

### `dmarc_nicht_pruefbar`  ·  Gering  ·  DMARC

**Titel**  
DMARC konnte nicht geprüft werden

**Kurzfassung**  
Die Abfrage des DMARC-Eintrags war zum Prüfzeitpunkt nicht möglich.

**Aufwand gering**  
Prüfung wiederholen.

**Schritt in der Maßnahme**  
DMARC-Eintrag selbst prüfen oder die Prüfung wiederholen lassen

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Die DNS-Abfrage für _dmarc.{domain} ist fehlgeschlagen. Ob ein DMARC-Eintrag vorhanden ist und welche Richtlinie er setzt, lässt sich aus dieser Prüfung nicht sagen.

**Was passieren kann**  ·  *geändert*  
Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offenbleibt.
> vorher: Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offen bleibt.
> Warum: Duden: „offenbleiben“ im Sinn von ungeklärt bleiben wird zusammengeschrieben.

**Folgen für Sie**  
Für diesen Bereich liegt kein belastbares Ergebnis vor.

**Technischer Befund**  
DMARC: {text}

---

## E-Mail — SPF, DKIM, Mailserver

### `spf_fehlt`  ·  Hoch  ·  SPF

**Titel**  
Keine gültige Liste berechtigter Mailserver

**Kurzfassung**  ·  *geändert*  
Ihre E-Mails könnten häufiger im Spam-Ordner landen und Fälschungen seltener auffallen.
> vorher: Empfänger können nicht prüfen, ob eine E-Mail von einem berechtigten Server kommt.
> Warum: Die Kurzfassung in der Zusammenfassung erklärte nur den Titel; jetzt die Folge für das Unternehmen, mit dem Katalogwort „Spam-Ordner“.

**Sachverhalt**  
Für die Domain ist kein gültiger SPF-Eintrag veröffentlicht. Es ist nicht festgelegt, welche Server E-Mails in Ihrem Namen versenden dürfen.

**Was passieren kann**  ·  *geändert*  
Gefälschte Absender lassen sich nicht anhand der versendenden Server erkennen. Eigene E-Mails können häufiger im Spam-Ordner landen oder abgewiesen werden.
> vorher: Gefälschte Absender lassen sich nicht anhand der versendenden Server erkennen. Eigene E-Mails können häufiger im Spam landen oder abgewiesen werden.
> Warum: Katalogwort „Spam-Ordner“ wie in der Kurzfassung derselben Karte.

**Folgen für Sie**  ·  *geändert*  
Mögliche Zustellprobleme Ihrer E-Mails und schwächerer Fälschungsschutz.
> vorher: Zustellprobleme für Ihre E-Mails und schwächerer Schutz gegen Fälschungen.
> Warum: Folge stand als Tatsache da; ohne SPF kann DKIM die Zustellung tragen. Bauart wie bei DKIM („Mögliche Zustellprobleme …“).

**Aufwand gering**  
Ein DNS-Eintrag mit allen genutzten Versanddiensten.

**Technischer Befund**  
SPF: {text}

**Schritt in der Maßnahme**  
SPF-Eintrag mit allen genutzten Versanddiensten korrekt veröffentlichen

### `spf_hinweis`  ·  Gering  ·  SPF

**Titel**  
Liste berechtigter Mailserver verbesserbar

**Kurzfassung**  
Der SPF-Eintrag lässt sich verbessern.

**Aufwand gering**  
Eintrag prüfen und bereinigen.

**Schritt in der Maßnahme**  
SPF-Eintrag prüfen und bereinigen

**Bleibt offen (Gesprächsthema)**  ·  *geändert*  
Welche Dienste tatsächlich E-Mails in Ihrem Namen senden (SPF)
> vorher: Welche Versanddienste im SPF-Eintrag tatsächlich benötigt werden
> Warum: Offener Punkt in Kapitel 04 als Frage, die das Haus selbst beantworten kann, Fachbegriff in Klammern; auf 62 Zeichen gekürzt (Grenze 64).

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Ein SPF-Eintrag ist vorhanden, die automatische Prüfung zeigt jedoch Verbesserungsbedarf.

**Was passieren kann**  ·  *geändert*  
Zu weit gefasste oder fehlerhafte Regeln können Fälschungen erleichtern oder dazu führen, dass eigene E-Mails abgewiesen werden.
> vorher: Zu weit gefasste oder fehlerhafte Regeln erleichtern Fälschungen oder führen dazu, dass eigene E-Mails abgelehnt werden.
> Warum: Folge stand als Tatsache da; „abgelehnt“ auf das Katalogwort „abgewiesen“ gebracht.

**Folgen für Sie**  
Unnötiges Risiko bei Zustellung und Fälschungsschutz.

**Technischer Befund**  
SPF: {text}

### `dkim_nicht_gefunden`  ·  Mittel  ·  DKIM

**Titel**  
Digitale E-Mail-Signatur nicht nachweisbar

**Kurzfassung**  ·  *geändert*  
Fehlt die Signatur, können Empfänger nicht prüfen, ob E-Mails echt und unverändert sind.
> vorher: Ohne digitale Signatur können Empfänger nicht prüfen, ob E-Mails echt und unverändert sind.
> Warum: Der Titel sagt bewusst „nicht nachweisbar“; die Kurzfassung unterstellte mit „Ohne digitale Signatur“ das Fehlen.

**Sachverhalt**  
Unter den gängigen Kennungen (Selektoren) wurde kein DKIM-Schlüssel gefunden. Möglicherweise nutzt Ihr Mailanbieter eine hier nicht geprüfte Kennung.

**Was passieren kann**  ·  *geändert*  
Fehlt DKIM tatsächlich, lassen sich Ihre E-Mails nur noch über SPF bestätigen, was bei Weiterleitungen oft scheitert.
> vorher: Fehlt DKIM tatsächlich, bestätigt DMARC Ihre E-Mails nur noch über SPF, was bei Weiterleitungen oft scheitert.
> Warum: Der Baustein erscheint auch ohne DMARC-Eintrag; dann gibt es kein DMARC, das bestätigen könnte. Die Fassung stimmt in beiden Fällen.

**Folgen für Sie**  
Mögliche Zustellprobleme und, je nach DMARC-Richtlinie, schwächerer Fälschungsschutz.

**Aufwand gering**  ·  *geändert*  
Signatur beim Mailanbieter prüfen oder aktivieren, Schlüssel im DNS eintragen.
> vorher: Signatur beim Mailanbieter aktivieren und Schlüssel im DNS veröffentlichen.
> Warum: Gemessen ist nur „nicht nachweisbar“; „aktivieren“ unterstellte das Fehlen. Zuerst prüfen, wie im Schritt der Maßnahme.

**Technischer Befund**  
DKIM: {text}

**Schritt in der Maßnahme**  
DKIM-Signatur beim Mailanbieter aktivieren oder, falls sie bereits aktiv ist, den genutzten Selektor ermitteln

**Bleibt offen (Gesprächsthema)**  ·  *geändert*  
Ob Ihr Mailanbieter Ihre E-Mails bereits signiert (DKIM)
> vorher: Ob Ihr Mailanbieter einen DKIM-Selektor nutzt, den die automatische Prüfung nicht kennt
> Warum: Offener Punkt in Kapitel 04 ohne „DKIM-Selektor“; vorher 87 Zeichen, jetzt unter der Grenze von 64.

### `dkim_hinweis`  ·  Gering  ·  DKIM

**Titel**  ·  *geändert*  
Hinweise zur digitalen E-Mail-Signatur
> vorher: Digitale E-Mail-Signatur prüfen
> Warum: Einziger Titel als Handlungsanweisung; in der Liste stand „prüfen – Die Prüfung – prüfen“ untereinander. Neu als Zustand, ohne unterstellte Ursache, kürzer. Ohne „digital“ liest man „E-Mail-Signatur“ als Grußzeile mit Firmenangaben.

**Kurzfassung**  
Die Prüfung bestätigt die E-Mail-Signatur nicht als einwandfrei.

**Aufwand gering**  
Länge und Nutzung je Schlüssel prüfen, ungenutzte entfernen.

**Schritt in der Maßnahme**  
DKIM-Schlüssel je Selektor prüfen, nicht mehr genutzte entfernen

**Bleibt offen (Gesprächsthema)**  ·  *geändert*  
Ob die Signaturschlüssel (DKIM) noch in Gebrauch sind
> vorher: Ob die gefundenen DKIM-Schlüssel noch in Gebrauch sind
> Warum: Klartext für Kapitel 04, Begriff wie in der Positivliste, Fachbegriff in Klammern.

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  ·  *geändert*  
Mindestens ein DKIM-Schlüssel ist veröffentlicht. Die Prüfung bestätigt die Einrichtung nicht als einwandfrei.
> vorher: Mindestens ein DKIM-Schlüssel ist veröffentlicht ({text}). Die Prüfung bestätigt die Einrichtung nicht als einwandfrei.
> Warum: {text} stand doppelt (Sachverhalt und Technischer Befund) und widersprach bei mehreren Schlüsseln „Mindestens ein“; der Messwert bleibt in der technischen Zeile.

**Was passieren kann**  
Kein direkter Angriffsweg. Zu kurze oder ungenutzte Schlüssel können den Fälschungsschutz schwächen.

**Folgen für Sie**  
Geringes Restrisiko für Fälschungsschutz und Zustellbarkeit.

**Technischer Befund**  
DKIM: {text}

### `spf_fehlt_dmarc_streng`  ·  Hoch  ·  SPF

**Titel**  ·  *geändert*  
Keine gültige Liste berechtigter Mailserver
> vorher: Kein gültiger SPF-Eintrag bei durchgesetzter DMARC-Richtlinie
> Warum: Der jargonlastigste hoch eingestufte Titel (zweizeilig in der Zusammenfassung) heißt jetzt wie bei spf_fehlt; die DMARC-Lage tragen Kurzfassung und Feststellung.

**Kurzfassung**  ·  *geändert*  
Ihre E-Mails ohne passende Signatur (DKIM) könnten abgewiesen oder aussortiert werden.
> vorher: Ob Ihre eigenen E-Mails als echt anerkannt werden, hängt allein an der Signatur (DKIM).
> Warum: Statt des Mechanismus die Folge für eigene Rechnungen und Newsletter; „passende“, weil auch eine fremde Signatur nicht reicht.

**Sachverhalt**  ·  *geändert*  
Für die Domain ist kein gültiger SPF-Eintrag veröffentlicht, die DMARC-Richtlinie steht aber auf „{policy}“. Ihre E-Mails passieren damit nur noch mit gültiger DKIM-Signatur Ihrer Domain.
> vorher: Für die Domain ist kein gültiger SPF-Eintrag veröffentlicht, die DMARC-Richtlinie steht aber auf „{policy}“. Ihre E-Mails passieren damit nur noch mit gültiger DKIM-Signatur.
> Warum: DMARC verlangt eine zur Absenderdomain passende Signatur; die Signatur eines Versanddienstes mit dessen eigener Domain reicht nicht.

**Was passieren kann**  ·  *geändert*  
Kein Angriffsweg im engeren Sinn, der Fälschungsschutz greift über DMARC. Versendet ein Dienst ohne passende DKIM-Signatur in Ihrem Namen, etwa Newsletter oder Rechnungsversand, würden diese E-Mails abgewiesen oder aussortiert.
> vorher: Kein Angriffsweg im engeren Sinn, der Fälschungsschutz greift über DMARC. Versendet ein Dienst ohne DKIM-Signatur in Ihrem Namen, etwa Newsletter oder Rechnungsversand, würden diese E-Mails abgewiesen oder aussortiert.
> Warum: Wie in der Feststellung: DMARC verlangt eine Signatur Ihrer Domain; auch ein Dienst, der mit eigener Domain signiert, ist betroffen.

**Folgen für Sie**  ·  *geändert*  
Betroffene E-Mails könnten Kunden und Partner nicht erreichen, oft ohne dass es sofort auffällt.
> vorher: Betroffene E-Mails erreichen Kunden und Partner nicht, oft ohne dass es sofort auffällt.
> Warum: Folge stand als Tatsache da; Empfänger ohne DMARC-Prüfung stellen solche E-Mails weiter zu.

**Aufwand gering**  
Ein DNS-Eintrag mit allen genutzten Versanddiensten.

**Technischer Befund**  
SPF: {text} · DMARC-Richtlinie: {policy}

**Schritt in der Maßnahme**  
SPF-Eintrag mit allen genutzten Versanddiensten korrekt veröffentlichen

### `spf_alle_erlaubt`  ·  Hoch  ·  SPF

**Titel**  ·  *neu*  
Jeder Server darf in Ihrem Namen versenden
> Warum: Neuer Baustein aus der Technik-Prüfung: Ein SPF-Eintrag mit „+all“ landete bisher bei einem Text, der bei durchgesetztem DMARC behauptete, der Fälschungsschutz greife — das Gegenteil trifft zu.

**Kurzfassung**  ·  *neu*  
Gefälschte E-Mails mit Ihrer Absenderadresse könnten als echt gelten.

**Sachverhalt**  ·  *neu*  
Der SPF-Eintrag endet mit „+all“ oder „all“. Damit gilt jeder Server als berechtigter Absender Ihrer Domain.

**Was passieren kann**  ·  *neu*  
Angreifer könnten E-Mails mit Ihrer Absenderadresse versenden, die die SPF-Prüfung bestehen und so auch eine strenge DMARC-Richtlinie unterlaufen.

**Folgen für Sie**  ·  *neu*  
Gefälschte Rechnungen oder Zahlungsanweisungen in Ihrem Namen könnten bei Empfängern als echt gelten.

**Aufwand gering**  ·  *neu*  
SPF-Eintrag auf die genutzten Versanddienste beschränken.

**Technischer Befund**  ·  *neu*  
SPF: {text}

**Schritt in der Maßnahme**  ·  *neu*  
SPF-Eintrag ohne „+all“ auf die genutzten Versanddienste beschränken

### `spf_nicht_pruefbar`  ·  Gering  ·  SPF

**Titel**  
SPF konnte nicht geprüft werden

**Kurzfassung**  
Die Abfrage des SPF-Eintrags war zum Prüfzeitpunkt nicht möglich.

**Aufwand gering**  
Prüfung wiederholen.

**Schritt in der Maßnahme**  
SPF-Eintrag selbst prüfen oder die Prüfung wiederholen lassen

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Die DNS-Abfrage für den SPF-Eintrag von {domain} ist fehlgeschlagen. Ob ein SPF-Eintrag vorhanden und korrekt ist, lässt sich aus dieser Prüfung nicht sagen.

**Was passieren kann**  ·  *geändert*  
Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offenbleibt.
> vorher: Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offen bleibt.
> Warum: Duden: „offenbleiben“.

**Folgen für Sie**  
Für diesen Bereich liegt kein belastbares Ergebnis vor.

**Technischer Befund**  
SPF: {text}

### `dkim_nicht_pruefbar`  ·  Gering  ·  DKIM

**Titel**  
DKIM konnte nicht geprüft werden

**Kurzfassung**  
Die Abfrage der DKIM-Schlüssel war zum Prüfzeitpunkt nicht möglich.

**Aufwand gering**  
Prüfung wiederholen.

**Schritt in der Maßnahme**  
DKIM beim Mailanbieter selbst prüfen oder die Prüfung wiederholen lassen

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Die DNS-Abfrage der DKIM-Selektoren für {domain} ist fehlgeschlagen. Ob eine DKIM-Signatur eingerichtet ist, lässt sich aus dieser Prüfung nicht sagen.

**Was passieren kann**  ·  *geändert*  
Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offenbleibt.
> vorher: Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offen bleibt.
> Warum: Duden: „offenbleiben“.

**Folgen für Sie**  
Für diesen Bereich liegt kein belastbares Ergebnis vor.

**Technischer Befund**  
DKIM: {text}

### `mx_ohne_ip`  ·  Hoch  ·  MX (Mailserver)

**Titel**  ·  *geändert*  
Mailserver ohne hinterlegte Adresse
> vorher: Mailserver ohne erreichbare Adresse
> Warum: Gemessen ist eine fehlende Adresse (kein A- oder AAAA-Eintrag), nicht eine unerreichbare; passt zur Feststellung.

**Kurzfassung**  ·  *geändert*  
E-Mails an Sie könnten verzögert oder gar nicht ankommen.
> vorher: Ein eingetragener Mailserver ist nicht erreichbar.
> Warum: Die Kurzfassung in der Zusammenfassung wiederholte den Titel; jetzt die Folge in Möglichkeitsform. „verzögert oder nicht“ ließ sich als „ob verzögert oder nicht“ lesen.

**Sachverhalt**  
Für mindestens einen eingetragenen Mailserver von {domain} ist keine Netzadresse hinterlegt (kein A- oder AAAA-Eintrag). Zustellversuche an diesen Server schlagen fehl.

**Was passieren kann**  ·  *geändert*  
Meist kein Angriffsweg. Ob E-Mails trotzdem ankommen, hängt davon ab, ob ein weiterer eingetragener Mailserver erreichbar ist.
> vorher: Kein Angriffsweg. Ob Post trotzdem ankommt, hängt davon ab, ob ein weiterer eingetragener Mailserver erreichbar ist.
> Warum: Zeigt der Eintrag auf eine nicht mehr registrierte Domain, könnte ein Dritter E-Mails an Sie empfangen; „Kein Angriffsweg“ war zu absolut. „E-Mails“ statt „Post“.

**Folgen für Sie**  
E-Mails von Kunden und Partnern könnten Sie verzögert oder gar nicht erreichen.

**Aufwand gering**  
Fehlenden DNS-Eintrag ergänzen oder den Mailserver-Eintrag korrigieren.

**Technischer Befund**  
MX: {text}

**Schritt in der Maßnahme**  
Netzadresse des Mailservers ergänzen oder den MX-Eintrag korrigieren

**Bleibt offen (Gesprächsthema)**  ·  *geändert*  
Ob der Mailserver ohne hinterlegte Adresse noch benötigt wird
> vorher: Ob ein weiterer eingetragener Mailserver den Ausfall abfängt
> Warum: „den Ausfall“ hatte in Kapitel 04 kein Bezugswort; ob ein weiterer Mailserver erreichbar ist, misst der Scan selbst. Offen ist, ob der Eintrag ein Überbleibsel ist.

### `mx_nicht_pruefbar`  ·  Gering  ·  MX (Mailserver)

**Titel**  
Mailserver konnten nicht geprüft werden

**Kurzfassung**  
Die Abfrage der Mailserver-Einträge war zum Prüfzeitpunkt nicht möglich.

**Aufwand gering**  
Prüfung wiederholen.

**Schritt in der Maßnahme**  
Mailserver-Einträge selbst prüfen oder die Prüfung wiederholen lassen

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Die DNS-Abfrage der Mailserver-Einträge von {domain} ist fehlgeschlagen. Welche Mailserver eingetragen sind, lässt sich aus dieser Prüfung nicht sagen.

**Was passieren kann**  ·  *geändert*  
Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offenbleibt.
> vorher: Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offen bleibt.
> Warum: Duden: „offenbleiben“.

**Folgen für Sie**  
Für diesen Bereich liegt kein belastbares Ergebnis vor.

**Technischer Befund**  
MX: {text}

---

## E-Mail — Transportverschlüsselung

### `mta_sts_fehlt`  ·  Gering  ·  MTA-STS

**Titel**  
Verschlüsselte Zustellung nicht verbindlich

**Kurzfassung**  
E-Mails an Sie können auf dem Transportweg unverschlüsselt übertragen werden.

**Aufwand gering bis mittel**  
Richtliniendatei mit gültigem Zertifikat und DNS-Eintrag anlegen.

**Schritt in der Maßnahme**  ·  *geändert*  
MTA-STS zuerst im Testmodus einrichten, nach Auswertung der Berichte auf „enforce“ stellen
> vorher: MTA-STS einrichten, damit E-Mails an Sie nur verschlüsselt zugestellt werden dürfen
> Warum: Gefahrlos umsetzbar: Im Modus „enforce“ weisen Absender Zustellungen ab, wenn ein Zertifikat nicht passt; die Berichte liefert der TLS-RPT-Schritt davor.

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Es ist nicht verbindlich festgelegt, dass E-Mails an Ihre Domain nur verschlüsselt zugestellt werden dürfen (MTA-STS).

**Was passieren kann**  
Wer Zugriff auf den Übertragungsweg zwischen den Mailservern hat, kann die Verschlüsselung unterdrücken und E-Mails mitlesen.

**Folgen für Sie**  
Vertrauliche E-Mails an Sie sind auf dem Transportweg weniger geschützt.

**Technischer Befund**  
MTA-STS: {text}

### `tls_rpt_fehlt`  ·  Gering  ·  TLS-RPT

**Titel**  
Keine Fehlerberichte zur Verschlüsselung

**Kurzfassung**  ·  *geändert*  
Fehler bei verschlüsselter Zustellung könnten unbemerkt bleiben.
> vorher: Sie erfahren nicht, wenn verschlüsselte Zustellung scheitert.
> Warum: „Sie erfahren nicht“ war absolut (wie bei dmarc_kein_rua); jetzt parallel „… könnten unbemerkt bleiben“.

**Aufwand gering**  
Ein DNS-Eintrag.

**Schritt in der Maßnahme**  
TLS-RPT einrichten, damit Probleme bei der verschlüsselten Zustellung gemeldet werden

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Für Berichte über Probleme bei der verschlüsselten Zustellung ist keine gültige Adresse hinterlegt (TLS-RPT).

**Was passieren kann**  ·  *geändert*  
Störungen oder Manipulationen der Transportverschlüsselung können unbemerkt bleiben.
> vorher: Störungen oder Manipulationen der Transportverschlüsselung bleiben unbemerkt.
> Warum: Folge stand als Tatsache da.

**Folgen für Sie**  ·  *geändert*  
Probleme könnten erst auffallen, wenn E-Mails fehlen.
> vorher: Probleme werden erst bemerkt, wenn E-Mails fehlen.
> Warum: Folge stand als Tatsache da.

**Technischer Befund**  
TLS-RPT: {text}

### `mta_sts_hinweis`  ·  Gering  ·  MTA-STS

**Titel**  ·  *geändert*  
Verschlüsselte Zustellung nicht voll wirksam
> vorher: MTA-STS eingerichtet, aber nicht wirksam
> Warum: „nicht wirksam“ übertrieb gegenüber Kurzfassung und Feststellung; Klartext wie beim Schwesterbaustein „Verschlüsselte Zustellung nicht verbindlich“.

**Kurzfassung**  ·  *geändert*  
Die Richtlinie zur verschlüsselten Zustellung ist angekündigt, greift aber nicht vollständig.
> vorher: Die Regel zur verschlüsselten Zustellung ist vorhanden, greift aber nicht vollständig.
> Warum: MTA-STS heißt im Katalog „Richtlinie“; „Regel“ steht für die Website-Schutzregeln. Der Baustein erscheint auch, wenn nur der DNS-Eintrag besteht und die Richtliniendatei fehlt; „vorhanden“ wäre dann falsch.

**Aufwand gering**  ·  *geändert*  
Einrichtung vervollständigen und Richtlinie auf „enforce“ stellen.
> vorher: Richtlinie auf „enforce“ stellen und Gültigkeitsdauer erhöhen.
> Warum: Eine kurze Gültigkeitsdauer löst den Baustein nie allein aus; ausgelöst wird er durch Testmodus oder Fehler der Einrichtung.

**Schritt in der Maßnahme**  ·  *geändert*  
MTA-STS vervollständigen und nach Prüfung auf „enforce“ stellen
> vorher: MTA-STS-Richtlinie von „testing“ auf „enforce“ stellen
> Warum: Auch eine nicht abrufbare Richtliniendatei oder fehlende Angaben lösen den Baustein aus, teils bei schon gesetztem „enforce“; notwendige Korrektur, daher 17 % länger.

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  ·  *geändert*  
Für {domain} ist MTA-STS eingerichtet, die Richtlinie ist aber nicht vollständig wirksam, etwa weil sie im Testmodus läuft oder nicht abrufbar ist. Das genaue Prüfergebnis steht im technischen Befund.
> vorher: Für {domain} ist MTA-STS eingerichtet, die Richtlinie ist aber nicht vollständig wirksam, etwa weil sie im Testmodus läuft oder nur kurz gilt. Das genaue Prüfergebnis steht im technischen Detail.
> Warum: „nur kurz gilt“ kommt als Auslöser nicht vor, eine nicht abrufbare Richtliniendatei schon; die Zeile heißt auf der Karte „Technischer Befund“.

**Was passieren kann**  
Sendende Mailserver dürfen bei einem Verschlüsselungsproblem weiterhin unverschlüsselt zustellen. In fremden Netzen ließen sich solche E-Mails mitlesen.

**Folgen für Sie**  ·  *geändert*  
Der Schutz eingehender E-Mails greift noch nicht vollständig.
> vorher: Der angestrebte Schutz der eingehenden Post greift noch nicht.
> Warum: „greift noch nicht“ war absoluter als Kurzfassung und Feststellung; „E-Mails“ statt „Post“.

**Technischer Befund**  
MTA-STS: {text}

### `mta_sts_nicht_pruefbar`  ·  Gering  ·  MTA-STS

**Titel**  
MTA-STS konnte nicht geprüft werden

**Kurzfassung**  
Die Abfrage der MTA-STS-Einstellung war zum Prüfzeitpunkt nicht möglich.

**Aufwand gering**  
Prüfung wiederholen.

**Schritt in der Maßnahme**  
MTA-STS selbst prüfen oder die Prüfung wiederholen lassen

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Die Abfrage für MTA-STS von {domain} ist fehlgeschlagen. Ob eine Richtlinie zur verschlüsselten Zustellung veröffentlicht ist, lässt sich aus dieser Prüfung nicht sagen.

**Was passieren kann**  ·  *geändert*  
Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offenbleibt.
> vorher: Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offen bleibt.
> Warum: Duden: „offenbleiben“.

**Folgen für Sie**  
Für diesen Bereich liegt kein belastbares Ergebnis vor.

**Technischer Befund**  
MTA-STS: {text}

### `tls_rpt_hinweis`  ·  Gering  ·  TLS-RPT

**Titel**  
TLS-RPT-Eintrag fehlerhaft

**Kurzfassung**  
Der Eintrag für Berichte über Verschlüsselungsprobleme ist nicht verwertbar.

**Aufwand gering**  
Eintrag korrigieren.

**Schritt in der Maßnahme**  
TLS-RPT-Eintrag korrigieren

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Für {domain} ist ein TLS-RPT-Eintrag veröffentlicht, er ist aber nicht auswertbar. Sendende Mailserver können keine Berichte über fehlgeschlagene verschlüsselte Zustellungen schicken.

**Was passieren kann**  ·  *geändert*  
Kein Angriffsweg. Probleme bei der verschlüsselten Zustellung können unbemerkt bleiben.
> vorher: Kein Angriffsweg. Probleme bei der verschlüsselten Zustellung bleiben unbemerkt.
> Warum: Folge stand als Tatsache da.

**Folgen für Sie**  
Störungen und Angriffe auf die Transportverschlüsselung würden Ihnen nicht gemeldet.

**Technischer Befund**  
TLS-RPT: {text}

### `tls_rpt_nicht_pruefbar`  ·  Gering  ·  TLS-RPT

**Titel**  
TLS-RPT konnte nicht geprüft werden

**Kurzfassung**  
Die Abfrage des TLS-RPT-Eintrags war zum Prüfzeitpunkt nicht möglich.

**Aufwand gering**  
Prüfung wiederholen.

**Schritt in der Maßnahme**  
TLS-RPT selbst prüfen oder die Prüfung wiederholen lassen

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Die Abfrage für TLS-RPT von {domain} ist fehlgeschlagen. Ob ein Eintrag für Berichte über Verschlüsselungsprobleme vorhanden ist, lässt sich aus dieser Prüfung nicht sagen.

**Was passieren kann**  ·  *geändert*  
Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offenbleibt.
> vorher: Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offen bleibt.
> Warum: Duden: „offenbleiben“.

**Folgen für Sie**  
Für diesen Bereich liegt kein belastbares Ergebnis vor.

**Technischer Befund**  
TLS-RPT: {text}

---

## Domain — DNSSEC

### `dnssec_fehlt`  ·  Mittel  ·  DNSSEC

**Titel**  ·  *geändert*  
Adressauskünfte ohne prüfbare Signatur
> vorher: Adressauskünfte der Domain nicht signiert
> Warum: Gleicher Grund wie bei Feststellung und technischer Zeile: Auch signierte Zonen ohne DS-Eintrag fallen hierunter, „nicht signiert“ wäre für sie falsch.

**Kurzfassung**  
Mit erheblichem Aufwand ließen sich Besucher und E-Mails auf gefälschte Server umleiten.

**Sachverhalt**  ·  *geändert*  
Die Adressauskünfte Ihrer Domain (DNS), unter welcher Adresse Website und Mailserver erreichbar sind, tragen keine prüfbare digitale Signatur (DNSSEC).
> vorher: Die Adressauskünfte Ihrer Domain (DNS), unter welcher Adresse Website und Mailserver erreichbar sind, tragen keine digitale Signatur (DNSSEC).
> Warum: Der Zustand umfasst auch Zonen, die signiert sind, deren DS-Eintrag beim Domain-Anbieter aber fehlt; „keine digitale Signatur“ wäre dort falsch.

**Was passieren kann**  
Mit erheblichem Aufwand lassen sich Adressauskünfte fälschen und, ohne MTA-STS, E-Mails umleiten. Besucher schützt vor allem erzwungenes HTTPS.

**Folgen für Sie**  
E-Mails an Sie oder Eingaben Ihrer Besucher könnten abgefangen werden.

**Aufwand gering**  
Meist beim DNS-Anbieter einschaltbar, dazu ein Eintrag beim Domain-Anbieter.

**Technischer Befund**  ·  *geändert*  
DNSSEC: Zone nicht signiert oder ohne DS-Eintrag
> vorher: DNSSEC: Zone nicht signiert
> Warum: Bei einer signierten Zone ohne DS-Eintrag hielte die IT die Zeile sonst für falsch; notwendige Korrektur, die Zeile bleibt einzeilig.

**Schritt in der Maßnahme**  ·  *geändert*  
DNSSEC beim DNS-Anbieter aktivieren und den DS-Eintrag beim Domain-Anbieter hinterlegen
> vorher: DNSSEC beim DNS-Anbieter aktivieren und den DS-Eintrag beim Registrar hinterlegen
> Warum: Entschiedener Begriff „Domain-Anbieter“ statt „Registrar“, wie im Aufwand derselben Karte.

### `dnssec_fehlerhaft`  ·  Hoch  ·  DNSSEC

**Titel**  ·  *geändert*  
Signatur der Adressauskünfte fehlerhaft
> vorher: DNSSEC eingerichtet, aber fehlerhaft
> Warum: Hoch eingestufter Titel in der Zusammenfassung, jetzt Klartext wie bei dnssec_fehlt.

**Kurzfassung**  ·  *geändert*  
Website und E-Mail könnten für einen erheblichen Teil der Nutzer ausfallen.
> vorher: Die Signatur der Domain ist vorhanden, wird bei der Prüfung aber zurückgewiesen.
> Warum: Die Kurzfassung in der Zusammenfassung wiederholte den Titel; die eigentliche Botschaft ist der mögliche Ausfall.

**Sachverhalt**  
Für {domain} ist DNSSEC bei der übergeordneten Stelle eingetragen, die Prüfung der Signatur schlägt jedoch fehl.

**Was passieren kann**  ·  *geändert*  
Kein Angriffsweg im engeren Sinn. Prüfende DNS-Server (Resolver) verwerfen fehlerhaft signierte Adressauskünfte. Da die großen öffentlichen Resolver prüfen, kann die Domain für einen erheblichen Teil der Nutzer nicht erreichbar sein, einschließlich der Mailzustellung.
> vorher: Kein Angriffsweg im engeren Sinn. Prüfende DNS-Server (Resolver) verwerfen fehlerhaft signierte Antworten; da die großen öffentlichen Resolver prüfen, kann die Domain für einen erheblichen Teil der Nutzer nicht erreichbar sein, einschließlich der Mailzustellung.
> Warum: Entschiedener Begriff „Adressauskünfte“; der 28-Wörter-Satz ist am Semikolon geteilt.

**Folgen für Sie**  
Website und E-Mail könnten für einen erheblichen Teil Ihrer Kunden ausfallen.

**Aufwand gering bis mittel**  ·  *geändert*  
Schlüssel zwischen DNS- und Domain-Anbieter abgleichen.
> vorher: Schlüssel beim DNS-Anbieter und Registrar abgleichen.
> Warum: „Domain-Anbieter“ statt „Registrar“; „zwischen“ sagt, was womit abzugleichen ist, und lässt offen, ob es eine oder zwei Firmen sind.

**Technischer Befund**  
DNSSEC: {text}

**Schritt in der Maßnahme**  ·  *geändert*  
Signatur beim DNS-Anbieter mit dem DS-Eintrag beim Domain-Anbieter abgleichen
> vorher: Signatur beim DNS-Anbieter und den DS-Eintrag beim Registrar abgleichen
> Warum: „Domain-Anbieter“ statt „Registrar“; „Signatur … und den DS-Eintrag … abgleichen“ war schief, „mit dem“ sagt, was womit abzugleichen ist.

### `dnssec_nicht_pruefbar`  ·  Gering  ·  DNSSEC

**Titel**  
DNSSEC konnte nicht geprüft werden

**Kurzfassung**  
Die Abfrage des DNSSEC-Status war zum Prüfzeitpunkt nicht möglich.

**Aufwand gering**  
Prüfung wiederholen.

**Schritt in der Maßnahme**  
DNSSEC selbst prüfen oder die Prüfung wiederholen lassen

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Die Abfrage des DNSSEC-Status von {domain} ist fehlgeschlagen. Ob die Zone signiert ist, lässt sich aus dieser Prüfung nicht sagen.

**Was passieren kann**  ·  *geändert*  
Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offenbleibt.
> vorher: Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offen bleibt.
> Warum: Duden: „offenbleiben“.

**Folgen für Sie**  
Für diesen Bereich liegt kein belastbares Ergebnis vor.

**Technischer Befund**  
DNSSEC: {text}

---

## Website — Schutzregel für Skripte (CSP)

### `obs_csp_missing`  ·  Mittel  ·  Content Security Policy
MDN: `csp-not-implemented` (-25 Punkte)

**Titel**  
Keine Schutzregel für Skripte

**Kurzfassung**  
Eingeschleuster Programmcode würde auf Ihrer Website nicht blockiert.

**Sachverhalt**  
Die Website legt nicht fest, welcher Programmcode ausgeführt werden darf (Content Security Policy fehlt).

**Was passieren kann**  
Gelingt es, Code einzuschleusen, etwa über ein Formular oder ein veraltetes Plugin, wird er nicht blockiert. Er kann Eingaben mitlesen oder Besucher umleiten.

**Folgen für Sie**  
Ihre Website könnte gegen Ihre eigenen Besucher eingesetzt werden.

**Aufwand mittel**  
Erfordert Abstimmung mit der Website-Entwicklung.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_csp_unsafe`  ·  Mittel  ·  Content Security Policy
MDN: `csp-implemented-with-unsafe-inline` (-20 Punkte)

**Titel**  
Schutzregel für Skripte zu weit gefasst

**Kurzfassung**  ·  *geändert*  
Eingeschleuster Programmcode könnte trotz Schutzregel ausgeführt werden.
> vorher: Eingeschleuster Programmcode würde auf Ihrer Website nicht blockiert.
> Warum: War wortgleich mit „Regel fehlt“ und absolut: Bei „script-src 'self' https:“ blockiert der Browser eingeschleusten Inline-Code sehr wohl.

**Sachverhalt**  ·  *geändert*  
Die Regel, welcher Programmcode laufen darf (Content Security Policy), lässt unsichere Skriptquellen zu und verliert dadurch viel Schutzwirkung.
> vorher: Die Regel, welcher Programmcode laufen darf (Content Security Policy), lässt unsichere Skriptquellen zu und verliert so viel Schutzwirkung.
> Warum: „so viel“ las sich als Mengenangabe; gemeint ist „dadurch“.

**Was passieren kann**  ·  *geändert*  
Gelingt es, Code einzuschleusen, etwa über ein Formular oder ein veraltetes Plugin, wird er womöglich nicht blockiert. Er kann Eingaben mitlesen oder Besucher umleiten.
> vorher: Gelingt es, Code einzuschleusen, etwa über ein Formular oder ein veraltetes Plugin, wird er nicht blockiert. Er kann Eingaben mitlesen oder Besucher umleiten.
> Warum: Bei einer vorhandenen, nur zu weit gefassten Regel hängt es von der Lücke ab, ob eingeschleuster Code blockiert wird.

**Folgen für Sie**  
Ihre Website könnte gegen Ihre eigenen Besucher eingesetzt werden.

**Aufwand mittel**  
Erfordert Abstimmung mit der Website-Entwicklung.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_csp_unsafe-eval`  ·  Mittel  ·  Content Security Policy
MDN: `csp-implemented-with-unsafe-eval` (-10 Punkte)

**Titel**  ·  *geändert*  
Schutzregel erlaubt aus Text erzeugten Code
> vorher: Schutzregel erlaubt nachgeladenen Code
> Warum: „nachgeladener Code“ war fachlich falsch: 'unsafe-eval' erlaubt aus Text erzeugten Code (eval), nicht das Nachladen; 13 % länger für die Korrektur, Titel bleibt einzeilig.

**Kurzfassung**  ·  *geändert*  
Eingeschleuster Text könnte als Programmcode ausgeführt werden.
> vorher: Die Schutzregel für Skripte lässt eine riskante Technik zu.
> Warum: „lässt eine riskante Technik zu“ sagte nicht, welches Risiko; jetzt die Folge aus dem Szenario.

**Sachverhalt**  
Die Schutzregel für Skripte (Content Security Policy) erlaubt, Programmcode zur Laufzeit aus Text zu erzeugen („unsafe-eval“). Damit lässt sich die Regel teilweise umgehen.

**Was passieren kann**  
Eingeschleuster Text könnte über diesen Weg doch als Code ausgeführt werden.

**Folgen für Sie**  
Der Schutz der Regel greift nicht vollständig.

**Aufwand mittel**  
Erfordert Abstimmung mit der Website-Entwicklung.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_csp_http`  ·  Mittel  ·  Content Security Policy
MDN: `csp-implemented-with-insecure-scheme` (-20 Punkte)

**Titel**  
Schutzregel erlaubt unverschlüsselte Quellen

**Kurzfassung**  
Teile Ihrer Website dürfen laut Schutzregel unverschlüsselt geladen werden.

**Sachverhalt**  
Die Schutzregel für Inhalte (Content Security Policy) erlaubt, Bestandteile der Seite über unverschlüsseltes HTTP zu laden.

**Was passieren kann**  ·  *geändert*  
Die Regel erlaubt Quellen, die unterwegs austauschbar wären. Aktuelle Browser blockieren solche Bestandteile auf einer verschlüsselten Seite zwar von sich aus. Die Regel selbst zieht diese Grenze aber nicht und wirkt schwächer als vorgesehen.
> vorher: Die Regel erlaubt Quellen, die unterwegs austauschbar wären. Aktuelle Browser blockieren solche Bestandteile auf einer verschlüsselten Seite zwar von sich aus; die Regel selbst zieht diese Grenze aber nicht und wirkt schwächer als vorgesehen.
> Warum: Satz mit 26 Wörtern am Semikolon geteilt, Wortlaut unverändert.

**Folgen für Sie**  
Der Schutz der Regel greift nicht vollständig.

**Aufwand gering**  
Quellen in der Schutzregel auf HTTPS festlegen.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_csp_http-passiv`  ·  Mittel  ·  Content Security Policy
MDN: `csp-implemented-with-insecure-scheme-in-passive-content-only` (-10 Punkte)

**Titel**  
Bilder und Medien dürfen unverschlüsselt geladen werden

**Kurzfassung**  ·  *geändert*  
Besucher könnten manipulierte Bilder sehen; Programmcode ist nicht betroffen.
> vorher: Bilder und Medien dürfen laut Schutzregel unverschlüsselt geladen werden.
> Warum: Die Kurzfassung wiederholte den Titel fast wörtlich; jetzt Folge und Einordnung zugleich, ohne zu beunruhigen.

**Sachverhalt**  
Die Schutzregel für Inhalte (Content Security Policy) ist gesetzt, erlaubt aber, Bilder und Medien über unverschlüsseltes HTTP zu laden.

**Was passieren kann**  
In öffentlichen WLANs könnten solche Bilder oder Medien unterwegs ausgetauscht werden, soweit der Browser sie nicht von sich aus auf eine verschlüsselte Verbindung umstellt. Programmcode ist davon nicht betroffen.

**Folgen für Sie**  
Besucher könnten manipulierte Bilder oder Medien sehen.

**Aufwand gering**  
Bild- und Medienquellen in der Schutzregel auf HTTPS festlegen.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_csp_ungueltig`  ·  Mittel  ·  Content Security Policy
MDN: `csp-header-invalid` (-25 Punkte)

**Titel**  
Schutzregel für Skripte fehlerhaft

**Kurzfassung**  ·  *geändert*  
Die Schutzregel für Skripte ist fehlerhaft und wirkt womöglich nicht wie gedacht.
> vorher: Die Schutzregel für Skripte ist gesetzt, aber für Browser nicht verwertbar.
> Warum: „für Browser nicht verwertbar“ ist falsch: Bei doppelten Angaben gilt die erste, die übrigen werden übergangen.

**Sachverhalt**  ·  *geändert*  
Die Schutzregel für Skripte (Content Security Policy) enthält Fehler, etwa doppelte Angaben. Wie Browser die Regel umsetzen, hängt vom Fehler ab.
> vorher: Die Website sendet eine Schutzregel für Programmcode (Content Security Policy), die Browser nicht auswerten können. Sie wirkt damit nicht.
> Warum: Browser werten fehlerhafte Regeln aus und übergehen nur doppelte oder leere Teile; „wirkt damit nicht“ traf nicht zu. Begriff wie im Titel, kein Satzanfang „Sie“ mehr.

**Was passieren kann**  ·  *geändert*  
Gelingt es, Code einzuschleusen, etwa über ein Formular oder ein veraltetes Plugin, wird er womöglich nicht blockiert. Er kann Eingaben mitlesen oder Besucher umleiten.
> vorher: Gelingt es, Code einzuschleusen, etwa über ein Formular oder ein veraltetes Plugin, wird er nicht blockiert. Er kann Eingaben mitlesen oder Besucher umleiten.
> Warum: Ob eingeschleuster Code blockiert wird, hängt davon ab, welcher Teil der fehlerhaften Regel im Browser gilt.

**Folgen für Sie**  ·  *geändert*  
Die Regel schützt womöglich nur teilweise.
> vorher: Die Regel ist vorhanden, schützt aber nicht.
> Warum: „schützt aber nicht“ war absolut und bei doppelten Angaben falsch: Browser setzen die Regel teilweise um.

**Aufwand gering**  
Den Kopfzeilen-Eintrag korrigieren; der Aufbau ist bereits vorhanden.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_csp_nur-report`  ·  Mittel  ·  Content Security Policy
MDN: `csp-not-implemented-but-reporting-enabled` (-25 Punkte)

**Titel**  
Schutzregel nur im Beobachtungsbetrieb

**Kurzfassung**  
Die Schutzregel für Skripte meldet Verstöße, blockiert aber nichts.

**Sachverhalt**  ·  *geändert*  
Die Website setzt eine Schutzregel für Skripte nur im Beobachtungsbetrieb (Content-Security-Policy-Report-Only). Verstöße werden gemeldet, aber nicht verhindert.
> vorher: Die Website setzt eine Schutzregel für Programmcode nur im Beobachtungsbetrieb (Content-Security-Policy-Report-Only). Verstöße werden gemeldet, aber nicht verhindert.
> Warum: Ein Begriff für dieselbe Regel, wie in der Kurzfassung.

**Was passieren kann**  
Gelingt es, Code einzuschleusen, etwa über ein Formular oder ein veraltetes Plugin, wird er nicht blockiert. Er kann Eingaben mitlesen oder Besucher umleiten.

**Folgen für Sie**  
Der Beobachtungsbetrieb ist ein guter Zwischenschritt, schützt aber noch nicht.

**Aufwand gering**  ·  *geändert*  
Regel nach Prüfung aktiv schalten.
> vorher: Die erprobte Regel aktiv schalten.
> Warum: Ob die Regel erprobt ist, misst der Scan nicht; ohne Auswertung der Meldungen scharf geschaltet, kann sie Funktionen der Website blockieren.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

---

## Website — Cookies

### `obs_cookies_no-httponly`  ·  Mittel  ·  Cookie-Attribut HttpOnly
MDN: `cookies-session-without-httponly-flag` (-30 Punkte)

**Titel**  
Sitzungs-Cookie für Skripte lesbar

**Kurzfassung**  
Nutzersitzungen sind schlechter gegen Übernahme geschützt.

**Sachverhalt**  
Ein Sitzungs-Cookie, das Besucher wiedererkennt, ist nicht gegen das Auslesen durch Skripte geschützt (HttpOnly fehlt).

**Was passieren kann**  
In Verbindung mit eingeschleustem Code können angemeldete Sitzungen übernommen werden.

**Folgen für Sie**  
Bei Anmeldebereichen könnten Unbefugte Konten übernehmen.

**Aufwand gering**  
Cookie-Attribute in der Anwendung setzen.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_cookies_session-no-secure`  ·  Hoch  ·  Cookie-Attribut Secure
MDN: `cookies-session-without-secure-flag` (-40 Punkte)

**Titel**  
Sitzungs-Cookie ohne Verschlüsselungszwang

**Kurzfassung**  ·  *geändert*  
Nutzersitzungen könnten in öffentlichen WLANs übernommen werden.
> vorher: Ein Sitzungs-Cookie kann unverschlüsselt übertragen werden.
> Warum: Hoch eingestuft und in der Zusammenfassung; die Kurzfassung wiederholte den Titel, jetzt die Folge.

**Sachverhalt**  ·  *geändert*  
Ein Sitzungs-Cookie, das Besucher wiedererkennt, ist nicht auf verschlüsselte Verbindungen beschränkt (Secure fehlt), und HSTS gleicht das nicht ausreichend aus.
> vorher: Ein Sitzungs-Cookie, das Besucher wiedererkennt, ist nicht auf verschlüsselte Verbindungen beschränkt (Secure fehlt), und die Website erzwingt Verschlüsselung auch nicht anderweitig.
> Warum: Gemessen ist nur, dass HSTS nicht mindestens sechs Monate greift; eine Weiterleitung auf HTTPS kann trotzdem bestehen, „auch nicht anderweitig“ wäre dann falsch.

**Was passieren kann**  
In öffentlichen WLANs könnte das Cookie bei einem unverschlüsselten Aufruf mitgelesen werden. Damit ließe sich eine angemeldete Sitzung übernehmen.

**Folgen für Sie**  
Unbefugte könnten Konten Ihrer Nutzer übernehmen.

**Aufwand gering**  
Cookie-Attribut Secure setzen und HSTS aktivieren.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_cookies_session-no-secure-hsts`  ·  Mittel  ·  Cookie-Attribut Secure
MDN: `cookies-session-without-secure-flag-but-protected-by-hsts` (-10 Punkte)

**Titel**  ·  *geändert*  
Sitzungs-Cookie ohne eigenen Verschlüsselungszwang
> vorher: Sitzungs-Cookie ohne Verschlüsselungszwang, HSTS greift
> Warum: „HSTS greift“ ist im Titel Fachjargon; „eigenen“ sagt dasselbe in Klartext und ist kürzer.

**Kurzfassung**  
Ein Sitzungs-Cookie ist nicht ausdrücklich auf verschlüsselte Verbindungen beschränkt.

**Sachverhalt**  ·  *geändert*  
Ein Sitzungs-Cookie ist nicht auf verschlüsselte Verbindungen beschränkt (Secure fehlt). Weil die Website Verschlüsselung über HSTS erzwingt, wirkt sich das derzeit kaum aus.
> vorher: Ein Sitzungs-Cookie ist nicht auf verschlüsselte Verbindungen beschränkt (Secure fehlt). Weil die Website Verschlüsselung über HSTS erzwingt, wirkt das derzeit nicht.
> Warum: HSTS muss keine Unteradressen abdecken, dort kann das Cookie unverschlüsselt gehen; „wirkt das nicht“ widersprach dem Szenario und war grammatisch schief.

**Was passieren kann**  
Entfällt HSTS künftig oder ruft ein Browser die Seite erstmals ohne HSTS-Kenntnis auf, könnte das Cookie unverschlüsselt übertragen werden. Deckt HSTS keine Unteradressen ab, gilt das auch dort.

**Folgen für Sie**  ·  *geändert*  
Weitgehend abgesichert, solange HSTS greift; der Schutz hängt an einer zweiten Einstellung.
> vorher: Derzeit gering, solange HSTS greift; der Schutz hängt an einer zweiten Einstellung.
> Warum: „Derzeit gering“ widersprach dem Etikett MITTEL direkt daneben.

**Aufwand gering**  
Cookie-Attribut Secure ergänzen.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_cookies_no-secure`  ·  Mittel  ·  Cookie-Attribut Secure
MDN: `cookies-without-secure-flag` (-20 Punkte)

**Titel**  
Cookies ohne Verschlüsselungszwang

**Kurzfassung**  
Cookies der Website können unverschlüsselt übertragen werden.

**Sachverhalt**  ·  *geändert*  
Mindestens ein Cookie ist nicht auf verschlüsselte Verbindungen beschränkt (Secure fehlt), und HSTS gleicht das nicht ausreichend aus.
> vorher: Mindestens ein Cookie ist nicht auf verschlüsselte Verbindungen beschränkt (Secure fehlt), und die Website erzwingt Verschlüsselung auch nicht anderweitig.
> Warum: Wie beim Sitzungs-Cookie: gemessen ist nur „kein ausreichendes HSTS“, nicht „keine Weiterleitung auf HTTPS“.

**Was passieren kann**  
In öffentlichen WLANs könnten diese Cookies bei einem unverschlüsselten Aufruf mitgelesen werden.

**Folgen für Sie**  
Inhalte der Cookies könnten Dritten bekannt werden.

**Aufwand gering**  
Cookie-Attribut Secure setzen und HSTS aktivieren.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_cookies_no-secure-hsts`  ·  Gering  ·  Cookie-Attribut Secure
MDN: `cookies-without-secure-flag-but-protected-by-hsts` (-5 Punkte)

**Titel**  ·  *geändert*  
Cookies ohne eigenen Verschlüsselungszwang
> vorher: Cookies ohne Verschlüsselungszwang, HSTS greift
> Warum: Wie beim Sitzungs-Cookie: kein Fachjargon im Titel, kürzer.

**Kurzfassung**  
Cookies sind nicht ausdrücklich auf verschlüsselte Verbindungen beschränkt.

**Aufwand gering**  
Cookie-Attribut Secure ergänzen.

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  ·  *geändert*  
Mindestens ein Cookie ist nicht auf verschlüsselte Verbindungen beschränkt (Secure fehlt). Weil die Website Verschlüsselung über HSTS erzwingt, wirkt sich das derzeit kaum aus.
> vorher: Mindestens ein Cookie ist nicht auf verschlüsselte Verbindungen beschränkt (Secure fehlt). Weil die Website Verschlüsselung über HSTS erzwingt, wirkt das derzeit nicht.
> Warum: Wie beim Sitzungs-Cookie: Unteradressen ohne HSTS; „wirkt sich … aus“ statt „wirkt“.

**Was passieren kann**  ·  *geändert*  
Entfällt HSTS künftig oder ruft ein Browser die Seite erstmals ohne HSTS-Kenntnis auf, könnten diese Cookies unverschlüsselt übertragen werden. Deckt HSTS keine Unteradressen ab, gilt das auch dort.
> vorher: Entfällt HSTS künftig oder ruft ein Browser die Seite erstmals ohne HSTS-Kenntnis auf, könnte diese Cookies unverschlüsselt übertragen werden. Deckt HSTS keine Unteradressen ab, gilt das auch dort.
> Warum: Kongruenzfehler: „diese Cookies … könnten“.

**Folgen für Sie**  
Derzeit gering, solange HSTS greift; der Schutz hängt an einer zweiten Einstellung.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_cookies_samesite-ungueltig`  ·  Mittel  ·  Cookie-Attribut SameSite
MDN: `cookies-samesite-flag-invalid` (-20 Punkte)

**Titel**  
Cookie-Einstellung SameSite fehlerhaft

**Kurzfassung**  ·  *geändert*  
Eine Cookie-Einstellung ist fehlerhaft gesetzt.
> vorher: Eine Cookie-Einstellung ist gesetzt, aber für Browser nicht verwertbar.
> Warum: „für Browser nicht verwertbar“ stimmt für „None“ ohne Secure nicht; „fehlerhaft gesetzt“ trifft beide Auslöser.

**Sachverhalt**  ·  *geändert*  
Mindestens ein Cookie trägt für die Einstellung SameSite einen ungültigen Wert oder „None“ ohne Secure. SameSite regelt, ob das Cookie bei Aufrufen von fremden Seiten mitgesendet wird.
> vorher: Mindestens ein Cookie trägt für die Einstellung SameSite einen Wert, den Browser nicht auswerten können. Sie regelt, ob das Cookie bei Aufrufen von fremden Seiten mitgesendet wird.
> Warum: Zweiter Auslöser ist SameSite=None ohne Secure, das ist kein unlesbarer Wert; Satzanfang „Sie“ war im Sie-Bericht doppeldeutig.

**Was passieren kann**  ·  *geändert*  
Browser übergehen die Einstellung oder verwerfen das Cookie. Je nach Browser könnte es bei Anfragen fremder Seiten mitgesendet werden.
> vorher: Browser fallen auf ihr eigenes Standardverhalten zurück. Je nach Browser könnte das Cookie bei Anfragen fremder Seiten mitgesendet werden.
> Warum: Bei „None“ ohne Secure fällt Chromium nicht aufs Standardverhalten zurück, sondern verwirft das Cookie.

**Folgen für Sie**  
Vorhandene Formulare könnten von fremden Seiten aus ausgelöst werden.

**Aufwand gering**  ·  *geändert*  
Auf Lax oder Strict setzen, None nur mit Secure.
> vorher: Den Wert korrigieren (Lax, Strict oder None).
> Warum: „None“ ohne Secure ist selbst ein Auslöser; der bisherige Text bot „None“ ohne diese Bedingung als Korrektur an.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_cookies_csrf-no-samesite`  ·  Mittel  ·  Cookie-Attribut SameSite
MDN: `cookies-anticsrf-without-samesite-flag` (-20 Punkte)

**Titel**  
Schutz-Cookie ohne SameSite-Einstellung

**Kurzfassung**  
Ein Cookie zum Schutz vor fremdgesteuerten Formularen ist unvollständig gesetzt.

**Sachverhalt**  ·  *geändert*  
Ein Cookie, das Formulare vor dem Auslösen durch fremde Seiten schützt, trägt keine SameSite-Einstellung. SameSite regelt, ob das Cookie bei Aufrufen von fremden Seiten mitgesendet wird.
> vorher: Ein Cookie, das Formulare vor Auslösen durch fremde Seiten schützt, trägt keine SameSite-Einstellung. Sie regelt, ob das Cookie bei Aufrufen von fremden Seiten mitgesendet wird.
> Warum: Substantivierter Infinitiv braucht den Artikel („vor dem Auslösen“); Satzanfang „Sie“ war im Sie-Bericht doppeldeutig.

**Was passieren kann**  ·  *geändert*  
Kein direkter Angriffsweg, solange Ihre Anwendung dieses Cookie korrekt prüft. Es fehlt aber eine zusätzliche Sicherung durch den Browser.
> vorher: Browser fallen auf ihr eigenes Standardverhalten zurück. Je nach Browser könnte eine präparierte Seite Besucher dazu bringen, unbemerkt Aktionen auf Ihrer Website auszulösen.
> Warum: Die Kennung im Cookie können fremde Seiten nicht lesen, die Prüfung der Anwendung stoppt gefälschte Formulare auch ohne SameSite; das Szenario schrieb dem Attribut einen Angriff zu, den es allein nicht ermöglicht.

**Folgen für Sie**  ·  *geändert*  
Der Schutz Ihrer Formulare hängt an einer einzigen Sicherung.
> vorher: Vorhandene Formulare oder Konten könnten missbraucht werden.
> Warum: Missbrauch setzt zusätzlich eine Lücke in der Anwendung voraus; Formulierung wie bei den HSTS-Cookie-Bausteinen.

**Aufwand gering**  
SameSite auf Lax oder Strict setzen.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

---

## Website — Verschlüsselung und Weiterleitung

### `obs_redirection_missing`  ·  Mittel  ·  HTTPS-Weiterleitung
MDN: `redirection-missing` (-20 Punkte)

**Titel**  ·  *geändert*  
Keine Weiterleitung auf HTTPS
> vorher: Keine Umleitung auf HTTPS
> Warum: Entschiedener Begriff „Weiterleitung“; 4 Zeichen länger, Titel bleibt einzeilig.

**Kurzfassung**  ·  *geändert*  
Aufrufe über http:// können unverschlüsselt bleiben.
> vorher: Aufrufe ohne https:// führen nicht zu einer sicheren Verbindung.
> Warum: Chrome und Firefox stellen Aufrufe heute selbst auf HTTPS um; „führen nicht zu einer sicheren Verbindung“ war deshalb meist falsch. „Ohne Hilfe des Browsers“ war für die Geschäftsführung unverständlich; die Möglichkeitsform trägt denselben fachlichen Punkt.

**Sachverhalt**  ·  *geändert*  
Unverschlüsselte Aufrufe über HTTP werden nicht auf eine verschlüsselte Verbindung weitergeleitet.
> vorher: Unverschlüsselte Aufrufe über HTTP werden nicht auf eine verschlüsselte Verbindung umgeleitet.
> Warum: Entschieden: „weiterleiten“ für die Serverfunktion, „umleiten“ nur für Angriffe.

**Was passieren kann**  
In öffentlichen WLANs (Hotel, Messe, Bahn) lassen sich unverschlüsselte Verbindungen mitlesen und verändern.

**Folgen für Sie**  
Eingaben Ihrer Besucher könnten unverschlüsselt übertragen, mitgelesen oder verändert werden.

**Aufwand gering**  
Weiterleitung in der Serverkonfiguration.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_redirection_nicht-https`  ·  Mittel  ·  HTTPS-Weiterleitung
MDN: `redirection-not-to-https` (-20 Punkte)

**Titel**  ·  *geändert*  
Weiterleitung führt nicht auf HTTPS
> vorher: Umleitung führt nicht auf HTTPS
> Warum: Entschiedener Begriff „Weiterleitung“; 4 Zeichen länger, Titel bleibt einzeilig.

**Kurzfassung**  ·  *geändert*  
Aufrufe über http:// können trotz Weiterleitung unverschlüsselt bleiben.
> vorher: Aufrufe ohne https:// landen wieder bei einer unverschlüsselten Adresse.
> Warum: Wo der Browser selbst umstellt, landet der Besucher nicht zwingend bei http://; gemessen ist das Ziel der Weiterleitung. Wiederholt den Titel nicht. Nicht mehr absolut: Aktuelle Browser stellen Aufrufe teils selbst auf HTTPS um.

**Sachverhalt**  ·  *geändert*  
Unverschlüsselte Aufrufe werden weitergeleitet, das Ziel ist aber erneut eine unverschlüsselte Adresse.
> vorher: Unverschlüsselte Aufrufe werden umgeleitet, das Ziel ist aber erneut eine unverschlüsselte Adresse.
> Warum: Entschiedener Begriff „weiterleiten“.

**Was passieren kann**  
In öffentlichen WLANs (Hotel, Messe, Bahn) lassen sich unverschlüsselte Verbindungen mitlesen und verändern.

**Folgen für Sie**  
Eingaben Ihrer Besucher könnten unverschlüsselt übertragen, mitgelesen oder verändert werden.

**Aufwand gering**  
Ziel der Weiterleitung auf HTTPS ändern.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_redirection_erst-http`  ·  Mittel  ·  HTTPS-Weiterleitung
MDN: `redirection-not-to-https-on-initial-redirection` (-10 Punkte)

**Titel**  ·  *geändert*  
Weiterleitung auf HTTPS erst im zweiten Schritt
> vorher: Umleitung auf HTTPS erst im zweiten Schritt
> Warum: Entschiedener Begriff „Weiterleitung“; auf derselben Karte stand „umleiten“ sonst in beiden Bedeutungen.

**Kurzfassung**  ·  *geändert*  
Die Weiterleitung auf HTTPS ist vorhanden, führt aber über einen Umweg.
> vorher: Die Umleitung auf HTTPS ist vorhanden, führt aber über einen Umweg.
> Warum: Entschiedener Begriff „Weiterleitung“.

**Sachverhalt**  ·  *geändert*  
Unverschlüsselte Aufrufe werden auf HTTPS weitergeleitet, im ersten Schritt aber noch auf eine unverschlüsselte Adresse.
> vorher: Unverschlüsselte Aufrufe werden auf HTTPS umgeleitet, im ersten Schritt aber noch auf eine unverschlüsselte Adresse.
> Warum: Entschiedener Begriff „weiterleiten“.

**Was passieren kann**  
In öffentlichen WLANs kann der erste, noch unverschlüsselte Schritt abgefangen und umgeleitet werden. Der Browser kann die Anweisung zur dauerhaft verschlüsselten Verbindung (HSTS) für die zuerst aufgerufene Adresse nicht übernehmen.

**Folgen für Sie**  ·  *geändert*  
Zusatzrisiko, wenn Browser Aufrufe über http:// nicht selbst umstellen.
> vorher: Zusatzrisiko für Besucher, die Ihre Adresse ohne https:// eingeben.
> Warum: Wer die Adresse ohne https:// eintippt, landet in aktuellen Browsern meist direkt bei HTTPS.

**Aufwand gering**  ·  *geändert*  
Zuerst auf dieselbe Adresse mit HTTPS weiterleiten, danach auf die Zieladresse.
> vorher: Zuerst auf dieselbe Adresse mit HTTPS umleiten, danach auf die Zieladresse.
> Warum: Entschiedener Begriff „weiterleiten“.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_redirection_fremder-host`  ·  Gering  ·  HTTPS-Weiterleitung
MDN: `redirection-off-host-from-http` (-5 Punkte)

**Titel**  ·  *geändert*  
Weiterleitung führt über eine andere Adresse
> vorher: Umleitung führt über eine andere Adresse
> Warum: Entschiedener Begriff „Weiterleitung“.

**Kurzfassung**  ·  *geändert*  
Für die erste Adresse wird HTTPS so nicht dauerhaft erzwungen.
> vorher: Die Umleitung auf HTTPS führt zunächst über eine andere Adresse.
> Warum: Die Kurzfassung wiederholte den Titel; jetzt die Folge (keine HSTS-Anweisung für die zuerst aufgerufene Adresse), ohne „Umleitung“.

**Aufwand gering**  ·  *geändert*  
Zuerst auf dieselbe Adresse mit HTTPS weiterleiten, danach auf die Zieladresse.
> vorher: Zuerst auf dieselbe Adresse mit HTTPS umleiten, danach auf die Zieladresse.
> Warum: Entschiedener Begriff „weiterleiten“.

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  ·  *geändert*  
Unverschlüsselte Aufrufe werden auf HTTPS weitergeleitet, im ersten Schritt aber auf einen anderen Hostnamen statt auf dieselbe Adresse mit HTTPS.
> vorher: Unverschlüsselte Aufrufe werden auf HTTPS umgeleitet, im ersten Schritt aber auf einen anderen Hostnamen statt auf dieselbe Adresse mit HTTPS.
> Warum: Entschiedener Begriff „weiterleiten“.

**Was passieren kann**  
Der Browser kann die Anweisung zur dauerhaft verschlüsselten Verbindung (HSTS) für die zuerst aufgerufene Adresse nicht übernehmen.

**Folgen für Sie**  ·  *geändert*  
Geringes Zusatzrisiko, wenn Browser Aufrufe über http:// nicht selbst umstellen.
> vorher: Geringes Zusatzrisiko für Besucher, die Ihre Adresse ohne https:// eingeben.
> Warum: Wie bei der Weiterleitung über HTTP: Aktuelle Browser stellen eingetippte Adressen meist selbst um.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_redirection_zertifikat`  ·  Mittel  ·  HTTPS-Weiterleitung
MDN: `redirection-invalid-cert` (-20 Punkte)

**Titel**  ·  *geändert*  
Zertifikat der Weiterleitung fehlerhaft
> vorher: Zertifikat der Weiterleitung nicht gültig
> Warum: Das Prüfwerkzeug meldet auch bei unvollständiger Kette „invalid cert“, obwohl das Zertifikat gültig ist; „fehlerhaft“ trifft alle Fälle.

**Kurzfassung**  ·  *geändert*  
Besucher könnten eine Sicherheitswarnung sehen.
> vorher: Beim Umleiten auf HTTPS ist das Zertifikat nicht gültig.
> Warum: Wiederholte den Titel und sagte „Umleiten“ und „nicht gültig“; jetzt die Folge, als Möglichkeit, weil Browser bei unvollständiger Kette meist nicht warnen.

**Sachverhalt**  ·  *geändert*  
Unverschlüsselte Aufrufe werden auf HTTPS weitergeleitet, dabei ist das Zertifikat der Zieladresse jedoch fehlerhaft.
> vorher: Unverschlüsselte Aufrufe werden auf HTTPS umgeleitet, dabei ist das Zertifikat der Zieladresse jedoch nicht gültig.
> Warum: „fehlerhaft“ deckt auch die unvollständige Kette ab, bei der das Zertifikat selbst gültig ist; entschiedener Begriff „weiterleiten“.

**Was passieren kann**  ·  *geändert*  
Browser können eine Sicherheitswarnung zeigen. Solange das Zertifikat fehlerhaft ist, lässt sich nicht bestätigen, dass die Verbindung wirklich zu Ihrem Server besteht. Besucher, die die Warnung wegklicken, könnten eine echte Warnung später ebenso behandeln.
> vorher: Browser zeigen eine Sicherheitswarnung. Solange das Zertifikat ungültig ist, lässt sich nicht bestätigen, dass die Verbindung wirklich zu Ihrem Server besteht. Besucher, die die Warnung wegklicken, könnten eine echte Warnung später ebenso behandeln.
> Warum: Bei unvollständiger Zertifikatskette laden gängige Browser fehlende Zwischenzertifikate nach und warnen meist nicht; „Browser zeigen“ war dann falsch. „fehlerhaft“ wie Titel und Sachverhalt: Bei unvollständiger Kette ist das Zertifikat selbst gültig.

**Folgen für Sie**  ·  *geändert*  
Besucher könnten vor Ihrer Website eine Warnung sehen.
> vorher: Besucher sehen eine Warnung, bevor Ihre Website erscheint.
> Warum: Folge stand als Tatsache da; bei unvollständiger Kette zeigen Browser meist keine Warnung.

**Aufwand gering**  ·  *geändert*  
Zertifikat der Zieladresse prüfen: Laufzeit, Name und Kette.
> vorher: Zertifikat für die Zieladresse erneuern oder passend ausstellen.
> Warum: Deckt alle Auslöser ab, auch die fehlende Zwischenzertifikatskette, die „erneuern“ nicht behebt.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_hsts_missing`  ·  Mittel  ·  HSTS
MDN: `hsts-not-implemented` (-20 Punkte)

**Titel**  
Verschlüsselung wird nicht erzwungen

**Kurzfassung**  
In öffentlichen WLANs könnten Verbindungen zu Ihrer Website abgefangen werden.

**Sachverhalt**  ·  *geändert*  
Die Website weist Browser nicht an, sich ausschließlich verschlüsselt zu verbinden (HSTS).
> vorher: Die Website weist Browser nicht an, ausschließlich verschlüsselt zu verbinden (HSTS).
> Warum: Grammatik: „verbinden“ im Sinn von „eine Verbindung aufbauen“ ist reflexiv.

**Was passieren kann**  
In öffentlichen WLANs (Hotel, Messe, Bahn) kann der erste Aufruf auf eine unverschlüsselte Verbindung umgeleitet und mitgelesen werden.

**Folgen für Sie**  
Formulareingaben und Anmeldedaten könnten dort mitgelesen werden.

**Aufwand gering**  
Eine Zeile in der Serverkonfiguration.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_hsts_kurz`  ·  Mittel  ·  HSTS
MDN: `hsts-implemented-max-age-less-than-six-months` (-10 Punkte)

**Titel**  
Verschlüsselung nur kurz erzwungen

**Kurzfassung**  
Die Anweisung zur verschlüsselten Verbindung gilt nur für kurze Zeit.

**Sachverhalt**  ·  *geändert*  
Die Website weist Browser an, sich ausschließlich verschlüsselt zu verbinden (HSTS), allerdings für weniger als sechs Monate.
> vorher: Die Website weist Browser an, ausschließlich verschlüsselt zu verbinden (HSTS), allerdings für weniger als sechs Monate.
> Warum: Grammatik: reflexives „sich verbinden“.

**Was passieren kann**  ·  *geändert*  
Besucher, die längere Zeit nicht auf der Website waren, sind beim nächsten Aufruf wieder ungeschützt und könnten in öffentlichen WLANs umgeleitet werden.
> vorher: Besucher, die längere Zeit nicht auf der Website waren, sind beim nächsten ersten Aufruf wieder ungeschützt und könnten in öffentlichen WLANs umgeleitet werden.
> Warum: „beim nächsten ersten Aufruf“ war widersprüchlich.

**Folgen für Sie**  
Der Schutz greift nur für häufige Besucher.

**Aufwand gering**  
Gültigkeitsdauer auf mindestens sechs Monate erhöhen.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_hsts_ungueltig`  ·  Mittel  ·  HSTS
MDN: `hsts-header-invalid` (-20 Punkte)

**Titel**  
Anweisung zur Verschlüsselung fehlerhaft

**Kurzfassung**  ·  *geändert*  
Verschlüsselung wird womöglich nicht dauerhaft erzwungen.
> vorher: Die Anweisung zur verschlüsselten Verbindung ist nicht verwertbar.
> Warum: Bei doppelt gesendeter Zeile beachten Browser die erste, HSTS wirkt dann; „nicht verwertbar“ war für diesen häufigen Fall falsch. Wiederholte den Titel; jetzt die Folge als Möglichkeit.

**Sachverhalt**  ·  *geändert*  
Die Anweisung, sich ausschließlich verschlüsselt zu verbinden (HSTS), wird in fehlerhafter Form gesendet, etwa doppelt. Ob Browser sie beachten, hängt vom Fehler ab.
> vorher: Die Website sendet die Anweisung, ausschließlich verschlüsselt zu verbinden (HSTS), in einer Form, die Browser nicht auswerten können. Sie wirkt damit nicht.
> Warum: Doppelte Zeile wirkt, fehlendes max-age nicht; „Sie wirkt damit nicht“ war zu absolut und am Satzanfang doppeldeutig. Reflexives „sich verbinden“.

**Was passieren kann**  
In öffentlichen WLANs kann der erste Aufruf auf eine unverschlüsselte Verbindung umgeleitet und mitgelesen werden.

**Folgen für Sie**  ·  *geändert*  
Die Anweisung schützt womöglich nicht.
> vorher: Die Anweisung ist vorhanden, schützt aber nicht.
> Warum: „schützt aber nicht“ war absolut: Bei doppelter Zeile beachten Browser die erste.

**Aufwand gering**  
Den Kopfzeilen-Eintrag korrigieren.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_hsts_kein-https`  ·  Mittel  ·  HSTS
MDN: `hsts-not-implemented-no-https` (-20 Punkte)

**Titel**  
Website ohne verschlüsselten Aufruf

**Kurzfassung**  
Die Website ist nicht über eine verschlüsselte Adresse erreichbar.

**Sachverhalt**  
Die Website ist nicht über HTTPS erreichbar, deshalb kann sie Browser auch nicht zu verschlüsselten Verbindungen anweisen (HSTS).

**Was passieren kann**  
Der Verkehr zur Website könnte in fremden Netzen mitgelesen und verändert werden.

**Folgen für Sie**  
Eingaben Ihrer Besucher könnten unterwegs mitgelesen werden.

**Aufwand gering bis mittel**  
Zertifikat einrichten und die Website über HTTPS ausliefern.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_hsts_zertifikat`  ·  Mittel  ·  HSTS
MDN: `hsts-invalid-cert` (-20 Punkte)

**Titel**  ·  *geändert*  
Zertifikat der Website fehlerhaft
> vorher: Zertifikat nicht gültig, Verschlüsselung nicht erzwungen
> Warum: „nicht gültig“ trifft die unvollständige Kette nicht, und ob Verschlüsselung erzwungen wird, prüft das Werkzeug in diesem Fall gar nicht.

**Kurzfassung**  ·  *geändert*  
Browser könnten vor Ihrer Website warnen.
> vorher: Das Zertifikat der Website ist nicht gültig.
> Warum: „nicht gültig“ ist bei unvollständiger Kette falsch; mit dem neuen Titel wäre „Das Zertifikat … ist fehlerhaft“ wortgleich, deshalb die Folge als Möglichkeit.

**Sachverhalt**  ·  *geändert*  
Das Zertifikat der Website ist fehlerhaft. Lehnen Browser es ab, verwerfen sie auch eine HSTS-Anweisung der Website.
> vorher: Das Zertifikat der Website ist nicht gültig; eine HSTS-Anweisung bleibt deshalb wirkungslos, weil Browser sie aus einer nicht vertrauenswürdigen Verbindung verwerfen.
> Warum: Bei unvollständiger Kette nehmen Browser das Zertifikat an und beachten HSTS; „bleibt deshalb wirkungslos“ galt nur bei Ablehnung.

**Was passieren kann**  ·  *geändert*  
Browser können eine Sicherheitswarnung zeigen. Solange das Zertifikat fehlerhaft ist, lässt sich nicht bestätigen, dass die Verbindung wirklich zu Ihrem Server besteht. Besucher, die die Warnung wegklicken, könnten eine echte Warnung später ebenso behandeln.
> vorher: Browser zeigen eine Sicherheitswarnung. Solange das Zertifikat ungültig ist, lässt sich nicht bestätigen, dass die Verbindung wirklich zu Ihrem Server besteht. Besucher, die die Warnung wegklicken, könnten eine echte Warnung später ebenso behandeln.
> Warum: Wie bei der Weiterleitung: Bei unvollständiger Kette warnen Browser meist nicht. „fehlerhaft“ wie Titel und Sachverhalt.

**Folgen für Sie**  ·  *geändert*  
Besucher könnten vor Ihrer Website eine Warnung sehen.
> vorher: Besucher sehen eine Warnung, bevor Ihre Website erscheint.
> Warum: Folge stand als Tatsache da.

**Aufwand gering**  ·  *geändert*  
Zertifikat korrigieren, dann HSTS prüfen.
> vorher: Zertifikat erneuern, danach HSTS setzen.
> Warum: „erneuern“ behebt keine unvollständige Kette; „HSTS setzen“ unterstellte, dass HSTS fehlt, was hier gar nicht geprüft wird.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

---

## Website — fremde Skripte und Einbettung

### `obs_sri_http`  ·  Hoch  ·  Subresource Integrity
MDN: `sri-not-implemented-and-external-scripts-not-loaded-securely` (-50 Punkte)

**Titel**  ·  *geändert*  
Fremde Skripte ungeprüft, teils ohne Verschlüsselungszwang
> vorher: Fremde Skripte unverschlüsselt und ungeprüft
> Warum: Das Werkzeug meldet auch „//“-Adressen, die auf HTTPS-Seiten verschlüsselt laden; „unverschlüsselt“ war dort falsch. Notwendige Korrektur, daher länger, unter 61 Zeichen.

**Kurzfassung**  ·  *geändert*  
Wird ein fremder Anbieter gehackt, könnte veränderter Code auf Ihrer Website laufen.
> vorher: Fremder Programmcode wird unverschlüsselt geladen, ohne Prüfung auf Veränderungen.
> Warum: Gemessen ist, dass die Einbindung keine Verschlüsselung vorschreibt, nicht, dass Code unverschlüsselt geladen wird. Die Kurzfassung wiederholte den Titel; jetzt die Folge als Möglichkeit.

**Sachverhalt**  
Die Website bindet fremde Skripte ohne Prüfung auf Veränderungen ein (Subresource Integrity) und teils ohne erzwungene Verschlüsselung.

**Was passieren kann**  ·  *geändert*  
Wird einer der fremden Anbieter gehackt, führen die Browser Ihrer Besucher den veränderten Code automatisch aus, ohne dass Ihre Website es bemerkt. Läuft Ihre Website selbst unverschlüsselt, könnte der Code zusätzlich unterwegs ausgetauscht werden; auf einer verschlüsselten Seite laden Browser ihn verschlüsselt oder gar nicht.
> vorher: Wird einer der fremden Anbieter gehackt, führen die Browser Ihrer Besucher den veränderten Code automatisch aus, ohne dass Ihre Website es bemerkt. Läuft Ihre Seite selbst unverschlüsselt, könnte der Code zusätzlich unterwegs ausgetauscht werden; auf einer verschlüsselten Seite laden Browser ihn nicht.
> Warum: Mit „//“ eingebundene Skripte laden Browser auf einer HTTPS-Seite verschlüsselt, „laden ihn nicht“ stimmte nur für http://; derselbe Gegenstand heißt im Feld „Ihre Website“.

**Folgen für Sie**  
Veränderter Code eines Drittanbieters liefe mit den Rechten Ihrer Website.

**Aufwand gering bis mittel**  
Skripte über HTTPS laden und Prüfsummen ergänzen.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_sri_https`  ·  Gering  ·  Subresource Integrity
MDN: `sri-not-implemented-but-external-scripts-loaded-securely` (-5 Punkte)

**Titel**  
Fremde Skripte ohne Prüfung auf Veränderungen

**Kurzfassung**  ·  *geändert*  
Browser laden fremden Programmcode, ohne zu prüfen, ob er verändert wurde.
> vorher: Fremder Programmcode wird geladen, ohne zu prüfen, ob er verändert wurde.
> Warum: Im Passivsatz prüfte scheinbar der Programmcode selbst; mit „Browser“ als Subjekt ist der Bezug eindeutig.

**Aufwand gering**  
Prüfsummen für externe Skripte ergänzen.

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Die Website lädt Programmcode fremder Server verschlüsselt, aber ohne dass Browser prüfen können, ob er verändert wurde (Subresource Integrity).

**Was passieren kann**  
Wird einer der fremden Anbieter gehackt, führen die Browser Ihrer Besucher den veränderten Code automatisch aus, ohne dass Ihre Website es bemerkt.

**Folgen für Sie**  
Abhängigkeit von der Sicherheit fremder Anbieter.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_sri_teilweise-http`  ·  Mittel  ·  Subresource Integrity
MDN: `sri-implemented-but-external-scripts-not-loaded-securely` (-20 Punkte)

**Titel**  ·  *geändert*  
Fremde Skripte geprüft, teils ohne Verschlüsselungszwang
> vorher: Prüfsummen vorhanden, Skripte teils unverschlüsselt
> Warum: Das Werkzeug meldet auch „//“-Adressen; „teils unverschlüsselt“ wäre dann falsch. Dem zweiten Teil fehlte das Bezugswort; jetzt parallel zu „Fremde Skripte ungeprüft, …“.

**Kurzfassung**  ·  *geändert*  
Teile Ihrer Website funktionieren möglicherweise schon heute nicht.
> vorher: Die Prüfung fremder Skripte ist eingerichtet, einzelne werden aber unverschlüsselt geladen.
> Warum: Die Kurzfassung beschrieb nur den Zustand, mit dem fachlich falschen „unverschlüsselt geladen“; jetzt die Folge für das Unternehmen.

**Sachverhalt**  ·  *geändert*  
Die Website prüft fremde Skripte auf Veränderungen (Subresource Integrity), bindet einzelne davon aber ohne Verschlüsselungszwang ein (http:// oder //).
> vorher: Die Website prüft fremde Skripte auf Veränderungen (Subresource Integrity), lädt einzelne davon aber nicht über eine verschlüsselte Verbindung.
> Warum: Wie beim Titel; „lädt … nicht über eine verschlüsselte Verbindung“ war für „//“ falsch und widersprach dem Szenario.

**Was passieren kann**  ·  *geändert*  
Aktuelle Browser laden fest mit http:// eingebundenen Programmcode auf einer verschlüsselten Seite gar nicht erst; die betroffene Funktion kann dadurch ausfallen. Mit // eingebundener Code wird dort verschlüsselt geladen.
> vorher: Aktuelle Browser laden unverschlüsselt eingebundenen Programmcode auf einer verschlüsselten Seite gar nicht erst. Die betroffene Funktion fällt dadurch aus; die hinterlegte Prüfsumme kommt in diesem Fall nicht zum Tragen.
> Warum: Für „//“-Skripte fällt auf einer HTTPS-Seite nichts aus; zudem stand der Ausfall als Tatsache da, die Auswirkung sagt richtig „möglicherweise“.

**Folgen für Sie**  
Teile Ihrer Website funktionieren in aktuellen Browsern möglicherweise schon heute nicht.

**Aufwand gering**  
Die betroffenen Skripte über HTTPS laden.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_xcto_missing`  ·  Gering  ·  X-Content-Type-Options
MDN: `x-content-type-options-not-implemented` (-5 Punkte)

**Titel**  
Dateityp-Schutz fehlt

**Kurzfassung**  
Browser könnten Dateien Ihrer Website falsch interpretieren.

**Aufwand gering**  
Eine Zeile in der Serverkonfiguration.

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Die Website verbietet Browsern nicht, den Typ ausgelieferter Dateien selbst zu erraten (X-Content-Type-Options).

**Was passieren kann**  
Hochgeladene oder fremde Dateien könnten als ausführbarer Code interpretiert werden. Einzeln ein geringes Risiko.

**Folgen für Sie**  ·  *geändert*  
Geringes Zusatzrisiko für Ihre Besucher.
> vorher: Geringes Zusatzrisiko, das sich mit einer Zeile beheben lässt.
> Warum: Die Auswirkung mischte Folge und Aufwandszusage („mit einer Zeile beheben“), die nicht in jedem Hosting stimmt.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_xcto_ungueltig`  ·  Gering  ·  X-Content-Type-Options
MDN: `x-content-type-options-header-invalid` (-5 Punkte)

**Titel**  
Dateityp-Schutz fehlerhaft gesetzt

**Kurzfassung**  ·  *geändert*  
Der Dateityp-Schutz wirkt womöglich nicht.
> vorher: Die Einstellung zum Dateityp-Schutz ist nicht verwertbar.
> Warum: „nicht verwertbar“ war für doppelt gesendete Zeilen falsch. Wiederholte den Titel; jetzt die Folge als Möglichkeit.

**Aufwand gering**  
Den Wert auf „nosniff“ setzen.

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  ·  *geändert*  
Die Website sendet den Dateityp-Schutz (X-Content-Type-Options) in fehlerhafter Form, etwa doppelt. Erwartet wird genau einmal „nosniff“.
> vorher: Die Website sendet für den Dateityp-Schutz (X-Content-Type-Options) einen Wert, den Browser nicht auswerten können. Erwartet wird „nosniff“.
> Warum: Das Werkzeug wertet auch „nosniff, nosniff“ als ungültig, Browser schützen dann trotzdem.

**Was passieren kann**  
Hochgeladene oder fremde Dateien könnten als ausführbarer Code interpretiert werden. Einzeln ein geringes Risiko.

**Folgen für Sie**  ·  *geändert*  
Die Einstellung wirkt womöglich nicht.
> vorher: Die Einstellung ist vorhanden, wirkt aber nicht.
> Warum: „wirkt aber nicht“ war absolut: Bei doppelter Zeile werten Browser den ersten Wert aus.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_xfo_missing`  ·  Mittel  ·  X-Frame-Options
MDN: `x-frame-options-not-implemented` (-20 Punkte)

**Titel**  
Kein Schutz vor unsichtbarer Einbettung

**Kurzfassung**  
Ihre Website kann in fremde Seiten eingebettet und missbraucht werden.

**Sachverhalt**  ·  *geändert*  
Die Website kann unsichtbar in fremde Seiten eingebettet werden (X-Frame-Options bzw. frame-ancestors fehlt).
> vorher: Die Website kann unsichtbar in fremde Webseiten eingebettet werden (X-Frame-Options bzw. frame-ancestors fehlt).
> Warum: Einheitlich „fremde Seiten“, wie in der Kurzfassung derselben Karte.

**Was passieren kann**  
Angreifer könnten Besucher unbemerkt Aktionen auf Ihrer Website auslösen lassen (Clickjacking).

**Folgen für Sie**  
Vorhandene Formulare oder Konten könnten missbraucht werden.

**Aufwand gering**  
Eine Zeile in der Serverkonfiguration.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_xfo_ungueltig`  ·  Mittel  ·  X-Frame-Options
MDN: `x-frame-options-header-invalid` (-20 Punkte)

**Titel**  
Schutz vor Einbettung fehlerhaft gesetzt

**Kurzfassung**  ·  *geändert*  
Ihre Website ist womöglich nicht gegen Einbetten geschützt.
> vorher: Die Einstellung gegen das Einbetten Ihrer Website ist nicht verwertbar.
> Warum: Bei doppelt gesendeter Zeile schützen Browser trotzdem; „nicht verwertbar“ war dafür falsch. Wiederholte den Titel; jetzt die Folge als Möglichkeit.

**Sachverhalt**  ·  *geändert*  
Die Einstellung gegen das Einbetten in fremde Seiten (X-Frame-Options) wird in fehlerhafter Form gesendet. Ob Browser sie beachten, hängt vom Fehler ab.
> vorher: Die Website sendet gegen das Einbetten in fremde Seiten (X-Frame-Options) einen Wert, den Browser nicht auswerten können. Sie wirkt damit nicht.
> Warum: „Sie wirkt damit nicht“ traf nur einen einzelnen ungültigen Wert und bezog sich grammatisch auf „die Website“.

**Was passieren kann**  
Angreifer könnten Besucher unbemerkt Aktionen auf Ihrer Website auslösen lassen (Clickjacking).

**Folgen für Sie**  ·  *geändert*  
Die Einstellung schützt womöglich nicht.
> vorher: Die Einstellung ist vorhanden, schützt aber nicht.
> Warum: „schützt aber nicht“ war absolut: Bei doppeltem Wert schützen Browser trotzdem.

**Aufwand gering**  
Den Wert korrigieren (DENY oder SAMEORIGIN) oder frame-ancestors per Schutzregel setzen.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

---

## Website — Freigaben und Trennung

### `obs_coep_ungueltig`  ·  Gering  ·  Cross-Origin-Embedder-Policy
MDN: `coep-header-invalid` (-5 Punkte)

**Titel**  ·  *geändert*  
Einstellung zur Trennung fremder Inhalte fehlerhaft
> vorher: Einstellung zur Einbettung fremder Inhalte fehlerhaft
> Warum: „Einbettung“ ist im Bericht der Begriff für X-Frame-Options; Kurzfassung und Feststellung sagen hier „Trennung“.

**Kurzfassung**  
Eine Einstellung zur Trennung fremder Inhalte ist nicht verwertbar.

**Aufwand gering**  
Den Kopfzeilen-Eintrag korrigieren oder entfernen.

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Die Website sendet für die Trennung eingebetteter fremder Inhalte (Cross-Origin-Embedder-Policy) einen Wert, den Browser nicht auswerten können.

**Was passieren kann**  
Die zusätzliche Trennung greift nicht. Ein eigener Angriffsweg entsteht daraus nicht.

**Folgen für Sie**  
Eine moderne Zusatzabsicherung bleibt ohne Wirkung.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_coop_ungueltig`  ·  Gering  ·  Cross-Origin-Opener-Policy
MDN: `coop-header-invalid` (-5 Punkte)

**Titel**  
Einstellung zur Fensterabschirmung fehlerhaft

**Kurzfassung**  
Eine Einstellung zur Abschirmung geöffneter Fenster ist nicht verwertbar.

**Aufwand gering**  
Den Kopfzeilen-Eintrag korrigieren oder entfernen.

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Die Website sendet für die Abschirmung von Fenstern, die sie öffnet oder die sie öffnen (Cross-Origin-Opener-Policy), einen Wert, den Browser nicht auswerten können.

**Was passieren kann**  
Von Ihrer Seite geöffnete fremde Fenster könnten einen Zugriffspunkt zurück auf Ihr Fenster behalten, soweit der Browser ihn nicht ohnehin kappt.

**Folgen für Sie**  
Eine moderne Zusatzabsicherung bleibt ohne Wirkung.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_corp_ungueltig`  ·  Gering  ·  Cross-Origin-Resource-Policy
MDN: `corp-header-invalid` (-5 Punkte)

**Titel**  
Schutz vor dem Abrufen einzelner Inhalte fehlerhaft

**Kurzfassung**  
Eine Einstellung gegen das Abrufen Ihrer Inhalte durch fremde Seiten ist nicht verwertbar.

**Aufwand gering**  
Den Kopfzeilen-Eintrag korrigieren oder entfernen.

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Die Website sendet für den Schutz vor dem Abrufen einzelner Inhalte durch fremde Seiten (Cross-Origin-Resource-Policy) einen Wert, den Browser nicht auswerten können.

**Was passieren kann**  
Fremde Seiten könnten einzelne Inhalte Ihrer Website weiterhin abrufen.

**Folgen für Sie**  
Eine moderne Zusatzabsicherung bleibt ohne Wirkung.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_cors_universal`  ·  Hoch  ·  CORS
MDN: `cross-origin-resource-sharing-implemented-with-universal-access` (-50 Punkte)

**Titel**  ·  *geändert*  
Zu offene Freigabe für fremde Seiten
> vorher: Zu offene Freigabe für fremde Webseiten
> Warum: Einheitlich „fremde Seiten“.

**Kurzfassung**  ·  *geändert*  
Fremde Seiten könnten Daten angemeldeter Nutzer abrufen.
> vorher: Fremde Webseiten dürfen Inhalte Ihrer Website abrufen.
> Warum: Hoch eingestuft; „Inhalte abrufen“ klang harmlos, das Risiko sind Daten angemeldeter Nutzer wie in der Auswirkung.

**Sachverhalt**  ·  *geändert*  
Die Website erlaubt beliebigen fremden Seiten den Zugriff auf ihre Inhalte, auch mit den Anmeldedaten Ihrer Besucher (CORS).
> vorher: Die Website erlaubt beliebigen fremden Webseiten den Zugriff auf ihre Inhalte, auch mit den Anmeldedaten Ihrer Besucher (CORS).
> Warum: Einheitlich „fremde Seiten“; „Webseiten“ neben „Website“ wirkt wie ein Tippfehler.

**Was passieren kann**  ·  *geändert*  
Präparierte Seiten könnten Daten aus Ihrer Website im Kontext Ihrer Besucher abrufen.
> vorher: Präparierte Seiten können Daten aus Ihrer Website im Kontext Ihrer Besucher abrufen.
> Warum: Ob der Browser die Anmeldung mitsendet, hängt heute von den Cookie-Einstellungen ab.

**Folgen für Sie**  
Mögliche Preisgabe von Daten angemeldeter Nutzer.

**Aufwand gering bis mittel**  
Freigaben auf benötigte Partner beschränken.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_referrer_unsafe`  ·  Gering  ·  Referrer-Policy
MDN: `referrer-policy-unsafe` (-5 Punkte)

**Titel**  
Seitenadressen werden zu offen weitergegeben

**Kurzfassung**  
Beim Aufruf fremder Seiten werden Adressen Ihrer Website weitergegeben.

**Aufwand gering**  
Eine Zeile in der Serverkonfiguration.

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Die Regel, welche Adressinformationen beim Aufruf fremder Seiten weitergegeben werden (Referrer-Policy), ist zu offen gesetzt.

**Was passieren kann**  ·  *geändert*  
Seitenadressen oder Teile davon können an fremde Seiten gelangen, teils auch über unverschlüsselte Verbindungen. Je nach Einstellung gelangen darin enthaltene Kennungen mit.
> vorher: Seitenadressen oder Teile davon können an fremde Seiten gelangen, teils auch über unverschlüsselte Verbindungen. Enthalten Adressen Kennungen, gelangen diese mit.
> Warum: Bei „origin“-Werten erhalten fremde Seiten nur den Domainnamen; Kennungen gehen nur bei zwei der vier Werte mit.

**Folgen für Sie**  
Geringes Datenschutzrisiko.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_referrer_ungueltig`  ·  Gering  ·  Referrer-Policy
MDN: `referrer-policy-header-invalid` (-5 Punkte)

**Titel**  
Regel zur Weitergabe von Seitenadressen fehlerhaft

**Kurzfassung**  
Die Regel zur Weitergabe von Seitenadressen ist nicht verwertbar.

**Aufwand gering**  
Den Wert korrigieren.

*Nicht im Bericht, solange gering eingestuft:*

**Sachverhalt**  
Die Website sendet für die Weitergabe von Adressinformationen (Referrer-Policy) einen Wert, den Browser nicht auswerten können. Browser fallen auf ihr Standardverhalten zurück.

**Was passieren kann**  
Je nach Browser können Seitenadressen oder Teile davon an fremde Seiten gelangen.

**Folgen für Sie**  
Geringes Datenschutzrisiko.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

---

## Website — Auswertung der Startseite

### `obs_generic`  ·  Mittel  ·  {label}

**Titel**  ·  *geändert*  
Schutzregel beanstandet: {label}
> vorher: Sicherheitsregel unvollständig: {label}
> Warum: Einheitlich „Schutzregel“; „unvollständig“ passte nicht zu „fehlt, ist fehlerhaft oder zu offen“. Mit dem längsten Testnamen 57 statt 64 Zeichen.

**Kurzfassung**  
Eine Schutzregel der Website fehlt, ist fehlerhaft oder zu offen gesetzt.

**Sachverhalt**  ·  *geändert*  
Der automatische Test „{label}“ wurde nicht bestanden ({modifier} Punkte). Die Originalmeldung des Prüfwerkzeugs steht im technischen Befund.
> vorher: Der automatische Test „{label}“ wurde nicht bestanden ({modifier} Punkte). Die Originalmeldung des Prüfwerkzeugs steht im technischen Detail.
> Warum: Die Zeile heißt auf der Karte „Technischer Befund“; ein „technisches Detail“ findet der Leser nicht.

**Was passieren kann**  
Fehlende, fehlerhafte oder zu offene Schutzregeln erleichtern Angriffe auf Besucher der Website.

**Folgen für Sie**  
Erhöhtes Risiko für Ihre Besucher.

**Aufwand gering bis mittel**  
Konfiguration prüfen und ergänzen.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_scan_html-unlesbar`  ·  Mittel  ·  Seitenaufbau
MDN: `html-not-parseable` (-20 Punkte)

**Titel**  ·  *geändert*  
Aufbau der Startseite nicht auswertbar
> vorher: Startseite konnte nicht ausgewertet werden
> Warum: Nur der HTML-Aufbau für die Skriptprüfung ließ sich nicht auswerten; die übrigen Tests liefen, der alte Titel klang nach komplettem Prüfausfall.

**Kurzfassung**  ·  *geändert*  
Für die eingebundenen Skripte liegt dadurch kein Prüfergebnis vor.
> vorher: Der Aufbau der Startseite ließ sich nicht maschinell auswerten.
> Warum: Die Kurzfassung wiederholte den Titel; jetzt die Folge, die die Feststellung nennt.

**Sachverhalt**  
Das Prüfwerkzeug konnte die Startseite nicht als HTML auswerten. Die Prüfung der eingebundenen Skripte (Subresource Integrity) liefert deshalb kein belastbares Ergebnis; die Prüfungen der Kopfzeilen sind davon nicht betroffen.

**Was passieren kann**  ·  *geändert*  
Daraus entsteht kein eigener Angriffsweg. Es bedeutet aber, dass dieser Teil der Prüfung offenbleibt.
> vorher: Daraus entsteht kein eigener Angriffsweg. Es bedeutet aber, dass dieser Teil der Prüfung offen bleibt.
> Warum: Duden: „offenbleiben“.

**Folgen für Sie**  
Für die Prüfung der eingebundenen Skripte liegt kein Ergebnis vor.

**Aufwand gering**  
Erreichbarkeit und Auslieferung der Startseite prüfen.

**Technischer Befund**  
{label}: {modifier} Punkte · „{result_text}“

---

## Bereits umgesetzt (Positivliste)

Einzeiler unter „Bereits umgesetzt“. Die mit „teilerfolg“ erscheinen nur, wenn die Liste sonst leer bliebe.

**`dmarc_reject`**  
Gefälschte E-Mails sollen abgewiesen werden (DMARC „reject“)

**`dmarc_quarantine`**  
Gefälschte E-Mails sollen aussortiert werden (DMARC „quarantine“)

**`dmarc_rua`**  
Auswertungsberichte angefordert (DMARC)

**`spf_ok`**  
Berechtigte Mailserver festgelegt (SPF)

**`dkim_ok`**  
Signaturschlüssel veröffentlicht ({text})

**`mx_ok`**  
Mailserver eingetragen ({text})

**`mta_sts_ok`**  
Richtlinie für verschlüsselte Zustellung veröffentlicht (MTA-STS)

**`tls_rpt_ok`**  
Fehlerberichte zur verschlüsselten Zustellung angefordert (TLS-RPT)

**`dnssec_ok`**  
Adressauskünfte digital signiert (DNSSEC)

**`obs_csp_streng`**  
Streng gesetzte Schutzregel für Programmcode (Content Security Policy)

**`obs_csp_ohne-unsafe`**  
Schutzregel für Programmcode ohne unsichere Quellen (Content Security Policy)

**`obs_cookies_vorbildlich`**  ·  *geändert*  
Cookies mit den empfohlenen Schutzattributen gesetzt (Secure, HttpOnly, SameSite)
> vorher: Cookies vollständig mit allen Schutzattributen gesetzt (Secure, HttpOnly, SameSite)
> Warum: Das Werkzeug verlangt HttpOnly nur für Sitzungs-Cookies und sieht nur die Startseite; „vollständig mit allen“ sagte mehr als gemessen.

**`obs_coep_require-corp`**  ·  *geändert*  
Fremde Inhalte werden nur mit deren Freigabe eingebunden (Cross-Origin-Embedder-Policy)
> vorher: Fremde Inhalte sind vom eigenen Seiteninhalt getrennt (Cross-Origin-Embedder-Policy)
> Warum: „require-corp“ lässt fremde Inhalte nur mit deren Freigabe laden; eine Trennung vom eigenen Seiteninhalt entsteht erst zusammen mit einer weiteren Einstellung.

**`obs_coep_credentialless`**  
Fremde Inhalte werden ohne Anmeldedaten geladen (Cross-Origin-Embedder-Policy)

**`obs_coop_same-origin`**  
Geöffnete Fenster sind gegen fremden Zugriff abgeschirmt (Cross-Origin-Opener-Policy)

**`obs_coop_allow-popups`**  ·  *geändert*  
Von fremden Seiten geöffnete Fenster sind abgeschirmt; eigene Pop-ups behalten die Verbindung (Cross-Origin-Opener-Policy)
> vorher: Von fremden Seiten geöffnete Fenster sind abgeschirmt; selbst geöffnete Pop-ups behalten die Verbindung (Cross-Origin-Opener-Policy)
> Warum: „selbst geöffnete Pop-ups“ ließ sich als „sogar geöffnete“ lesen; „eigene“ ist eindeutig und kürzer.

**`obs_coop_noopener`**  
Geöffnete Fenster sind gegen fremden Zugriff abgeschirmt (Cross-Origin-Opener-Policy)

**`obs_corp_same-origin`**  ·  *geändert*  
Fremde Seiten dürfen Inhalte der Website nicht einbinden (Cross-Origin-Resource-Policy)
> vorher: Fremde Seiten können einzelne Inhalte der Website nicht abrufen (Cross-Origin-Resource-Policy)
> Warum: „können … nicht abrufen“ war eine absolute Zusage; die Einstellung verbietet fremden Seiten das Einbinden, abrufen lässt sich der Inhalt weiterhin.

**`obs_corp_same-site`**  ·  *geändert*  
Nur Seiten der eigenen Domain dürfen Inhalte der Website einbinden (Cross-Origin-Resource-Policy)
> vorher: Das Abrufen der Inhalte ist auf Adressen der eigenen Domain beschränkt (Cross-Origin-Resource-Policy)
> Warum: Die Einstellung verbietet das Einbinden, nicht das Abrufen; gebaut wie die Schwester-Einstellung.

**`obs_referrer_privat`**  ·  *geändert*  
Seitenadressen gelangen höchstens gekürzt an fremde Seiten (Referrer-Policy)
> vorher: Seitenadressen werden nicht an fremde Seiten weitergegeben (Referrer-Policy)
> Warum: Auch bei den als sicher gewerteten Werten „strict-origin…“ geht der Domainname mit; „werden nicht weitergegeben“ war zu absolut.

**`obs_hsts_preloaded`**  
Verschlüsselung ist erzwungen und in Browsern voreingetragen (HSTS Preload)

**`obs_sri_vollstaendig`**  
Fremde Skripte werden auf Veränderungen geprüft, alle Skripte verschlüsselt geladen (Subresource Integrity)

**`obs_sri_extern-ok`**  
Fremde Skripte werden auf Veränderungen geprüft (Subresource Integrity)

**`obs_xfo_per-csp`**  ·  *geändert*  
Einbettung in fremde Seiten ist eingeschränkt (frame-ancestors)
> vorher: Einbettung in fremde Seiten ist unterbunden (frame-ancestors)
> Warum: Das Werkzeug wertet jede frame-ancestors-Angabe positiv, auch wenn sie bestimmte fremde Seiten zulässt; „unterbunden“ war dann zu viel.

**`obs_xfo_gesetzt`**  
Einbettung in fremde Seiten ist unterbunden (X-Frame-Options)

**`spf_teilerfolg`**  ·  *geändert*  
Liste berechtigter Mailserver veröffentlicht (SPF)
> vorher: Ein SPF-Eintrag ist vorhanden und kann bereinigt werden
> Warum: Form der Positivliste, Begriff aus dem Titel der Feststellung; dass sich der Eintrag noch verbessern lässt, sagt schon die Einleitung.

**`dkim_teilerfolg`**  ·  *geändert*  
Signaturschlüssel veröffentlicht (DKIM)
> vorher: DKIM-Schlüssel sind vorhanden und können bereinigt werden
> Warum: Form der Positivliste unter der neuen Einleitung „lassen sich noch verbessern“; „sind vorhanden“ setzte mehrere Schlüssel voraus, „bereinigt“ traf den häufigsten Auslöser nicht.

**`mta_sts_teilerfolg`**  ·  *geändert*  
Eintrag für verschlüsselte Zustellung veröffentlicht (MTA-STS)
> vorher: MTA-STS ist eingerichtet und kann scharf gestellt werden
> Warum: Form der Positivliste, Klartext zuerst; MTA-STS heißt im Katalog „Richtlinie“. Gemessen ist der DNS-Eintrag, nicht die Richtliniendatei; gebaut wie der TLS-RPT-Teilerfolg.

**`tls_rpt_teilerfolg`**  ·  *geändert*  
Eintrag für Fehlerberichte veröffentlicht (TLS-RPT)
> vorher: Ein TLS-RPT-Eintrag ist vorhanden und kann korrigiert werden
> Warum: Form der Positivliste, Begriff aus dem Titel „Keine Fehlerberichte zur Verschlüsselung“; „veröffentlicht“ statt „vorhanden“, das schon in der Einleitung steht.

**Einleitung `dmarc_durchgesetzt`**  
Ihr DMARC-Eintrag weist Mailserver an, E-Mails mit gefälschtem Absender abzuweisen oder auszusortieren: ein wesentlicher Baustein gegen Rechnungs- und Chef-Betrug.

**Einleitung `standard`**  
Diese geprüften Punkte sind bei Ihnen ohne Beanstandung.

**Einleitung `teilerfolg`**  ·  *neu*  
Diese Grundlagen sind vorhanden und lassen sich noch verbessern.
> Warum: Neu: Über einer Liste aus Teilerfolgen stand bisher „ohne Beanstandung“, obwohl genau dazu Feststellungen bestehen.

---

## Sätze je Prüfbereich

Unter der Note jeder Kachel in der Zusammenfassung. Der Hinweis zur Note ersetzt in der
E-Mail-Kachel die Zeile „Geprüfter Schutz umgesetzt“, wenn die Note gut ist und mindestens
eine hoch oder mittel eingestufte E-Mail-Feststellung außerhalb von DMARC vorliegt.

### E-Mail — DMARC

**reject**  
Gefälschte E-Mails mit Ihrem Absender sollen abgewiesen werden.

**quarantine**  
Gefälschte E-Mails mit Ihrem Absender sollen nur aussortiert werden.

**none**  
Die Richtlinie „none“ fordert kein Abweisen gefälschter E-Mails.

**fehlt**  
Es ist nicht festgelegt, wie mit gefälschten Absendern umzugehen ist.

**ungueltig**  ·  *geändert*  
Der DMARC-Eintrag enthält keine gültige Richtlinie gegen gefälschte Absender.
> vorher: Der DMARC-Eintrag enthält keine gültige Richtlinie und schützt nicht vor gefälschten Absendern.
> Warum: „schützt nicht vor gefälschten Absendern“ ist die verworfene „Kein Schutz“-Aussage; der Satz nennt jetzt nur den gemessenen Zustand.

**nicht_pruefbar**  
Ob eine Richtlinie gegen gefälschte Absender gesetzt ist, konnte nicht geprüft werden.

**mehrfach**  ·  *neu*  
Mehrere DMARC-Einträge: Nach dem Standard gilt keiner davon.
> Warum: Neu: Satz in der E-Mail-Kachel bei mehreren DMARC-Einträgen. Er spricht vom Standard, nicht von einem gemessenen Verhalten der Empfänger.

**Hinweis zur Note**  ·  *geändert*  
Die Note bewertet nur DMARC. Siehe auch {nummern}.
> vorher: Die Note bewertet nur DMARC; zu {felder} bestehen Feststellungen ({nummern}).
> Warum: Hinweis zur E-Mail-Note ohne {felder} (für die Geschäftsführung unlesbar, kostet eine Zeile); „siehe auch“ stimmt mit einer wie mit fünf Nummern, dann 80 Zeichen. „Zur E-Mail“ las sich als „zu der einen E-Mail“; in der Kachel „E-Mail · DMARC“ ist der Bezug ohnehin klar.

### Domain — DNSSEC

**signiert**  
Die Adressauskünfte Ihrer Domain sind digital signiert.

**nicht_signiert**  
Die Adressauskünfte Ihrer Domain sind nicht gegen Fälschung geschützt.

**fehlerhaft**  ·  *geändert*  
Die Signatur der Adressauskünfte ist eingerichtet, wird bei der Prüfung aber zurückgewiesen.
> vorher: Die Signatur der DNS-Antworten ist eingerichtet, wird bei der Prüfung aber zurückgewiesen.
> Warum: Entschiedener Begriff „Adressauskünfte“ statt „DNS-Antworten“.

**nicht_pruefbar**  ·  *geändert*  
Ob die Adressauskünfte Ihrer Domain signiert sind, konnte nicht geprüft werden.
> vorher: Ob die DNS-Antworten der Domain signiert sind, konnte nicht geprüft werden.
> Warum: Entschiedener Begriff „Adressauskünfte“; „Ihrer Domain“ wie in den übrigen Sätzen der Kachel.

### Website — HTTP Observatory

**bewertet**  
{passed} von {total} Tests bestanden. Die Note gewichtet nach Schwere.

**nicht_verfuegbar**  
Nicht automatisch bewertbar: weder Mangel noch Entwarnung.

**bewertet_alle**  
Alle {total} Sicherheitstests bestanden.

---

## Maßnahmen

Die Texte setzen sich aus den Schritten der Feststellungen zusammen (`{schritte}`), in der
Reihenfolge, in der eine IT sie umsetzt. Die Zuständigkeit steht als Zeile
„Üblicherweise zuständig: …“ unter dem Text.

### `M_MAIL_AUTH`

**Titel**  
E-Mail-Absender absichern

**Text**  
{schritte}.

**Üblicherweise zuständig**  ·  *geändert*  
Ihre IT oder Ihr IT-Dienstleister
> vorher: Ihre IT oder Ihr IT-Dienstleister, gemeinsam mit dem Mailanbieter
> Warum: Eine Zeile (höchstens 41 Zeichen); den Mailanbieter nennt der Schritt selbst.

### `M_DNSSEC`

**Titel**  
Adressauskünfte signieren (DNSSEC)

**Text**  
{schritte}.

**Üblicherweise zuständig**  ·  *geändert*  
Ihr DNS- und Ihr Domain-Anbieter
> vorher: Ihr DNS-Anbieter und Ihr Registrar
> Warum: „Registrar“ in Klartext wie auf der Karte; „Ihr … Ihr“ lässt offen, ob es eine oder zwei Firmen sind.

### `M_WEB`

**Titel**  
Website-Schutzregeln ergänzen und verschärfen

**Text**  
Betroffen: {liste}.

**Üblicherweise zuständig**  
Ihre Webagentur oder Ihr Hosting-Anbieter

### `M_MAIL_TRANSPORT`

**Titel**  
Verschlüsselte E-Mail-Zustellung absichern

**Text**  
{schritte}.

**Üblicherweise zuständig**  ·  *geändert*  
Ihre IT oder Ihr IT-Dienstleister
> vorher: Ihre IT oder Ihr IT-Dienstleister, gemeinsam mit dem Mailanbieter
> Warum: Eine Zeile (höchstens 41 Zeichen); die IT stellt auch den HTTPS-Host für die Richtliniendatei.

### `M_MX`

**Titel**  ·  *geändert*  
E-Mail-Empfang sicherstellen
> vorher: E-Mail-Empfang über DNS instandsetzen
> Warum: Die Maßnahme gilt auch, wenn MX nicht prüfbar war; „instandsetzen“ unterstellte einen Defekt (und schreibt sich „instand setzen“), „über DNS“ war Jargon.

**Text**  
{schritte}.

**Üblicherweise zuständig**  ·  *geändert*  
Ihre IT oder Ihr IT-Dienstleister
> vorher: Ihr Mailanbieter
> Warum: MX- und Adresseinträge pflegt, wer die DNS-Einträge verwaltet; der Mailanbieter nennt nur den richtigen Zielnamen. Länger als bisher, aber unter der Zeilengrenze von 41 Zeichen.

### `M_RETEST`

**Titel**  
Umsetzung überprüfen

**Text**  
Nach der Umsetzung prüfen wir kostenfrei erneut. Der neue Befund zeigt, was behoben ist.

**Text ohne Feststellungen**  
Wir wiederholen die Prüfung auf Wunsch kostenfrei, etwa nach Änderungen an Website oder Mailsystem.

---

## Offene Punkte (Gesprächsthemen)

Stehen auf „Nächster Schritt“ unter dem Termin: links Überschrift und Einleitung, rechts je Punkt eine Zeile.

**offen_label**  ·  *neu*  
Offene Punkte
> Warum: Neu: Überschrift des Blocks „Offene Punkte“ auf der Seite „Nächster Schritt“ (V15).

**offen_einleitung**  ·  *geändert*  
Folgende Punkte kann die automatische Prüfung nicht abschließend beurteilen. Wir klären sie gern im Gespräch:
> vorher: Diese Punkte lassen sich mit dieser Analyse nicht abschließend beurteilen. Wir klären sie gern im Gespräch:
> Warum: „Diese Punkte … mit dieser Analyse“ doppelte das Hinweiswort; „Folgende“ kündigt die Liste an, „automatische Prüfung“ nennt den Grund.

**offen_website**  ·  *geändert*  
Wie es um die Schutzregeln Ihrer Website steht
> vorher: Wie die Website abschneidet, die bei dieser Analyse nicht automatisch bewertet werden konnte
> Warum: Sie-Form, ohne „dieser Analyse“ und Passivkette; vorher 92 Zeichen, jetzt unter der Grenze von 64. Den Grund nennt die Einleitung.

---

## Namen der Website-Tests

**`csp`**  
Content Security Policy (CSP)

**`hsts`**  
HSTS (Strict-Transport-Security)

**`xfo`**  
X-Frame-Options

**`xcto`**  
X-Content-Type-Options

**`sri`**  
Subresource Integrity (SRI)

**`cookies`**  
Cookies

**`redirection`**  
Weiterleitung auf HTTPS

**`referrer`**  
Referrer-Policy

**`cors`**  
CORS

**`corp`**  
Cross-Origin-Resource-Policy

**`coep`**  
Cross-Origin-Embedder-Policy

**`coop`**  
Cross-Origin-Opener-Policy

**`scan`**  
Auswertung der Startseite

