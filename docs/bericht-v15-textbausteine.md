# Die Textbausteine des Berichts

Jede Feststellung im Bericht ist einer dieser Bausteine. Zur Laufzeit wird nichts
formuliert — was hier steht, steht im Bericht. `{geschweifte Klammern}` werden aus
dem Scan gefüllt: `{domain}`, `{record}` der DNS-Eintrag, `{text}` die Messzeile des
Scanners, `{policy}` die DMARC-Richtlinie, `{label}` der Name des Website-Tests,
`{modifier}` der Punktabzug, `{result_text}` die Originalmeldung des Prüfwerkzeugs.

**63 Bausteine.** Bei den Website-Bausteinen ist die Einstufung nicht gewählt,
sondern aus MDNs eigenem Punktabzug abgeleitet: ab 40 Punkten hoch, ab 10 mittel,
darunter gering.

Fachlich geprüft am 30. Oktober 2026. Die Prüfung hat zehn Stellen fachlich
korrigiert, darunter: auf einer verschlüsselten Seite lädt der Browser
unverschlüsselt eingebundene Skripte gar nicht erst, die Prüfsumme greift dort also
nicht; eine fehlerhafte DNSSEC-Signatur ist gemessen und nicht „nicht prüfbar“;
ein ungültiges Zertifikat ist mehr als ein Gewöhnungseffekt.

---

## E-Mail — DMARC

### `dmarc_fehlt`  ·  Hoch  ·  DMARC

**Titel**  
Keine Regel gegen gefälschte Absender

**Ein Satz**  
Jeder kann E-Mails versenden, die scheinbar von Ihrer Domain stammen.

**Feststellung**  
Für die Domain ist kein DMARC-Eintrag veröffentlicht. Empfangende Mailserver erhalten keine Anweisung, wie sie mit E-Mails umgehen sollen, die Ihren Absender nur vortäuschen.

**Was passieren kann**  
Angreifer können E-Mails mit Ihrer Absenderadresse versenden, etwa gefälschte Rechnungen mit geänderter Bankverbindung oder Zahlungsanweisungen im Namen der Geschäftsführung.

**Folgen für Sie**  
Möglicher Schaden bei Kunden und Partnern sowie Vertrauensverlust in Ihre E-Mails.

**Aufwand**  
DNS-Eintrag mit schrittweiser Einführung über einige Wochen.

**Technische Zeile**  
DMARC: kein Eintrag unter _dmarc.{domain} veröffentlicht

**Schritt in der Maßnahme**  
DMARC-Eintrag mit Berichtsadresse (rua) veröffentlichen und nach Auswertung der Berichte schrittweise bis „reject“ verschärfen

### `dmarc_none`  ·  Hoch  ·  DMARC

**Titel**  
Gefälschte E-Mails werden nicht abgewiesen

**Ein Satz**  
Gefälschte E-Mails mit Ihrer Absenderadresse können weiterhin ankommen.

**Feststellung**  
Der DMARC-Eintrag steht auf „none“. Mailserver erhalten damit keine Anweisung, gefälschte E-Mails abzuweisen oder auszusortieren.

**Was passieren kann**  
Angreifer können E-Mails mit Ihrer Absenderadresse versenden, etwa gefälschte Rechnungen oder Zahlungsanweisungen im Namen der Geschäftsführung.

**Folgen für Sie**  
Möglicher Schaden bei Kunden und Partnern sowie Vertrauensverlust in Ihre E-Mails.

**Aufwand**  
SPF und DKIM vervollständigen, dann schrittweise verschärfen.

**Technische Zeile**  
DMARC: {record}

**Schritt in der Maßnahme**  
DMARC-Richtlinie nach Auswertung der Berichte über „quarantine“ auf „reject“ anheben

### `dmarc_quarantine`  ·  Gering  ·  DMARC

**Titel**  
Gefälschte E-Mails sollen nur aussortiert werden

**Ein Satz**  
Gefälschte E-Mails landen im Spam-Ordner, statt abgewiesen zu werden.

**Feststellung**  
Der DMARC-Eintrag steht auf „quarantine“. Gefälschte E-Mails werden in den Spam-Ordner verschoben, aber nicht abgewiesen.

**Was passieren kann**  
Gefälschte Nachrichten bleiben im Spam-Ordner lesbar und werden dort gelegentlich doch geöffnet.

**Folgen für Sie**  
Geringes Restrisiko bei Empfängern, die ihren Spam-Ordner prüfen.

**Aufwand**  
Richtlinie auf „reject“ anheben.

**Technische Zeile**  
DMARC: {record}

**Schritt in der Maßnahme**  
DMARC-Richtlinie auf „reject“ anheben

### `dmarc_kein_rua`  ·  Gering  ·  DMARC (rua)

**Titel**  
Keine Berichte über E-Mails in Ihrem Namen

**Ein Satz**  
Sie erfahren nicht, wer in Ihrem Namen E-Mails versendet.

**Feststellung**  
Der DMARC-Eintrag enthält keine Adresse, an die Mailserver Auswertungsberichte senden (Angabe „rua“).

**Was passieren kann**  
Missbrauchsversuche mit Ihrer Domain und Fehler in der eigenen Mailkonfiguration bleiben unbemerkt.

**Folgen für Sie**  
Probleme werden erst bemerkt, wenn Kunden sich melden oder E-Mails nicht ankommen.

**Aufwand**  
Berichtsadresse im DMARC-Eintrag ergänzen.

**Technische Zeile**  
DMARC: {record} (kein rua-Tag)

**Schritt in der Maßnahme**  
Berichtsadresse (rua) im DMARC-Eintrag ergänzen

### `dmarc_ungueltig`  ·  Hoch  ·  DMARC

**Titel**  
DMARC-Eintrag ohne gültige Richtlinie

**Ein Satz**  
Der DMARC-Eintrag ist vorhanden, schützt aber nicht vor gefälschten Absendern.

**Feststellung**  
Unter _dmarc.{domain} ist ein Eintrag veröffentlicht, er enthält aber keine gültige Richtlinie (p=). Mailserver behandeln ihn bestenfalls wie die Stufe „none“.

**Was passieren kann**  
Angreifer können E-Mails mit Ihrem Absender versenden, etwa an Ihre Kunden oder Ihre eigene Buchhaltung. Empfänger haben keine Anweisung, solche Mails abzuweisen.

**Folgen für Sie**  
Gefälschte Rechnungen oder Zahlungsanweisungen in Ihrem Namen könnten Empfänger erreichen.

**Aufwand**  
Eintrag korrigieren und Richtlinie schrittweise verschärfen.

**Technische Zeile**  
DMARC: {record}

**Schritt in der Maßnahme**  
DMARC-Eintrag korrigieren und schrittweise bis „reject“ verschärfen

### `dmarc_nicht_pruefbar`  ·  Gering  ·  DMARC

**Titel**  
DMARC konnte nicht geprüft werden

**Ein Satz**  
Die Abfrage des DMARC-Eintrags war zum Prüfzeitpunkt nicht möglich.

**Feststellung**  
Die DNS-Abfrage für _dmarc.{domain} ist fehlgeschlagen. Ob ein DMARC-Eintrag vorhanden ist und welche Richtlinie er setzt, lässt sich aus dieser Prüfung nicht sagen.

**Was passieren kann**  
Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offen bleibt.

**Folgen für Sie**  
Für diesen Bereich liegt kein belastbares Ergebnis vor.

**Aufwand**  
Prüfung wiederholen.

**Technische Zeile**  
DMARC: {text}

**Schritt in der Maßnahme**  
DMARC-Eintrag selbst prüfen oder die Prüfung wiederholen lassen

---

## E-Mail — SPF, DKIM, Mailserver

### `spf_fehlt`  ·  Hoch  ·  SPF

**Titel**  
Keine gültige Liste berechtigter Mailserver

**Ein Satz**  
Empfänger können nicht prüfen, ob eine E-Mail von einem berechtigten Server kommt.

**Feststellung**  
Für die Domain ist kein gültiger SPF-Eintrag veröffentlicht. Es ist nicht festgelegt, welche Server E-Mails in Ihrem Namen versenden dürfen.

**Was passieren kann**  
Gefälschte Absender lassen sich nicht anhand der versendenden Server erkennen. Eigene E-Mails können häufiger im Spam landen oder abgewiesen werden.

**Folgen für Sie**  
Zustellprobleme für Ihre E-Mails und schwächerer Schutz gegen Fälschungen.

**Aufwand**  
Ein DNS-Eintrag mit allen genutzten Versanddiensten.

**Technische Zeile**  
SPF: {text}

**Schritt in der Maßnahme**  
SPF-Eintrag mit allen genutzten Versanddiensten korrekt veröffentlichen

### `spf_hinweis`  ·  Gering  ·  SPF

**Titel**  
Liste berechtigter Mailserver verbesserbar

**Ein Satz**  
Der SPF-Eintrag lässt sich verbessern.

**Feststellung**  
Ein SPF-Eintrag ist vorhanden, die automatische Prüfung zeigt jedoch Verbesserungsbedarf.

**Was passieren kann**  
Zu weit gefasste oder fehlerhafte Regeln erleichtern Fälschungen oder führen dazu, dass eigene E-Mails abgelehnt werden.

**Folgen für Sie**  
Unnötiges Risiko bei Zustellung und Fälschungsschutz.

**Aufwand**  
Eintrag prüfen und bereinigen.

**Technische Zeile**  
SPF: {text}

**Schritt in der Maßnahme**  
SPF-Eintrag prüfen und bereinigen

**Bleibt offen**  
Welche Versanddienste im SPF-Eintrag tatsächlich benötigt werden

### `dkim_nicht_gefunden`  ·  Mittel  ·  DKIM

**Titel**  
Digitale E-Mail-Signatur nicht nachweisbar

**Ein Satz**  
Ohne digitale Signatur können Empfänger nicht prüfen, ob E-Mails echt und unverändert sind.

**Feststellung**  
Unter den gängigen Kennungen (Selektoren) wurde kein DKIM-Schlüssel gefunden. Möglicherweise nutzt Ihr Mailanbieter eine hier nicht geprüfte Kennung.

**Was passieren kann**  
Fehlt DKIM tatsächlich, bestätigt DMARC Ihre E-Mails nur noch über SPF, was bei Weiterleitungen oft scheitert.

**Folgen für Sie**  
Mögliche Zustellprobleme und, je nach DMARC-Richtlinie, schwächerer Fälschungsschutz.

**Aufwand**  
Signatur beim Mailanbieter aktivieren und Schlüssel im DNS veröffentlichen.

**Technische Zeile**  
DKIM: {text}

**Schritt in der Maßnahme**  
DKIM-Signatur beim Mailanbieter aktivieren oder, falls sie bereits aktiv ist, den genutzten Selektor ermitteln

**Bleibt offen**  
Ob Ihr Mailanbieter einen DKIM-Selektor nutzt, den die automatische Prüfung nicht kennt

### `dkim_hinweis`  ·  Gering  ·  DKIM

**Titel**  
Digitale E-Mail-Signatur prüfen

**Ein Satz**  
Die Prüfung bestätigt die E-Mail-Signatur nicht als einwandfrei.

**Feststellung**  
Mindestens ein DKIM-Schlüssel ist veröffentlicht ({text}). Die Prüfung bestätigt die Einrichtung nicht als einwandfrei.

**Was passieren kann**  
Kein direkter Angriffsweg. Zu kurze oder ungenutzte Schlüssel können den Fälschungsschutz schwächen.

**Folgen für Sie**  
Geringes Restrisiko für Fälschungsschutz und Zustellbarkeit.

**Aufwand**  
Länge und Nutzung je Schlüssel prüfen, ungenutzte entfernen.

**Technische Zeile**  
DKIM: {text}

**Schritt in der Maßnahme**  
DKIM-Schlüssel je Selektor prüfen, nicht mehr genutzte entfernen

**Bleibt offen**  
Ob die gefundenen DKIM-Schlüssel noch in Gebrauch sind

### `spf_fehlt_dmarc_streng`  ·  Hoch  ·  SPF

**Titel**  
Kein gültiger SPF-Eintrag bei durchgesetzter DMARC-Richtlinie

**Ein Satz**  
Ob Ihre eigenen E-Mails als echt anerkannt werden, hängt allein an der Signatur (DKIM).

**Feststellung**  
Für die Domain ist kein gültiger SPF-Eintrag veröffentlicht, die DMARC-Richtlinie steht aber auf „{policy}“. Ihre E-Mails passieren damit nur noch mit gültiger DKIM-Signatur.

**Was passieren kann**  
Kein Angriffsweg im engeren Sinn, der Fälschungsschutz greift über DMARC. Versendet ein Dienst ohne DKIM-Signatur in Ihrem Namen, etwa Newsletter oder Rechnungsversand, würden diese E-Mails abgewiesen oder aussortiert.

**Folgen für Sie**  
Betroffene E-Mails erreichen Kunden und Partner nicht, oft ohne dass es sofort auffällt.

**Aufwand**  
Ein DNS-Eintrag mit allen genutzten Versanddiensten.

**Technische Zeile**  
SPF: {text} · DMARC-Richtlinie: {policy}

**Schritt in der Maßnahme**  
SPF-Eintrag mit allen genutzten Versanddiensten korrekt veröffentlichen

### `spf_nicht_pruefbar`  ·  Gering  ·  SPF

**Titel**  
SPF konnte nicht geprüft werden

**Ein Satz**  
Die Abfrage des SPF-Eintrags war zum Prüfzeitpunkt nicht möglich.

**Feststellung**  
Die DNS-Abfrage für den SPF-Eintrag von {domain} ist fehlgeschlagen. Ob ein SPF-Eintrag vorhanden und korrekt ist, lässt sich aus dieser Prüfung nicht sagen.

**Was passieren kann**  
Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offen bleibt.

**Folgen für Sie**  
Für diesen Bereich liegt kein belastbares Ergebnis vor.

**Aufwand**  
Prüfung wiederholen.

**Technische Zeile**  
SPF: {text}

**Schritt in der Maßnahme**  
SPF-Eintrag selbst prüfen oder die Prüfung wiederholen lassen

### `dkim_nicht_pruefbar`  ·  Gering  ·  DKIM

**Titel**  
DKIM konnte nicht geprüft werden

**Ein Satz**  
Die Abfrage der DKIM-Schlüssel war zum Prüfzeitpunkt nicht möglich.

**Feststellung**  
Die DNS-Abfrage der DKIM-Selektoren für {domain} ist fehlgeschlagen. Ob eine DKIM-Signatur eingerichtet ist, lässt sich aus dieser Prüfung nicht sagen.

**Was passieren kann**  
Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offen bleibt.

**Folgen für Sie**  
Für diesen Bereich liegt kein belastbares Ergebnis vor.

**Aufwand**  
Prüfung wiederholen.

**Technische Zeile**  
DKIM: {text}

**Schritt in der Maßnahme**  
DKIM beim Mailanbieter selbst prüfen oder die Prüfung wiederholen lassen

### `mx_ohne_ip`  ·  Hoch  ·  MX (Mailserver)

**Titel**  
Mailserver ohne erreichbare Adresse

**Ein Satz**  
Ein eingetragener Mailserver ist nicht erreichbar.

**Feststellung**  
Für mindestens einen eingetragenen Mailserver von {domain} ist keine Netzadresse hinterlegt (kein A- oder AAAA-Eintrag). Zustellversuche an diesen Server schlagen fehl.

**Was passieren kann**  
Kein Angriffsweg. Ob Post trotzdem ankommt, hängt davon ab, ob ein weiterer eingetragener Mailserver erreichbar ist.

**Folgen für Sie**  
E-Mails von Kunden und Partnern könnten Sie verzögert oder gar nicht erreichen.

**Aufwand**  
Fehlenden DNS-Eintrag ergänzen oder den Mailserver-Eintrag korrigieren.

**Technische Zeile**  
MX: {text}

**Schritt in der Maßnahme**  
Netzadresse des Mailservers ergänzen oder den MX-Eintrag korrigieren

**Bleibt offen**  
Ob ein weiterer eingetragener Mailserver den Ausfall abfängt

### `mx_nicht_pruefbar`  ·  Gering  ·  MX (Mailserver)

**Titel**  
Mailserver konnten nicht geprüft werden

**Ein Satz**  
Die Abfrage der Mailserver-Einträge war zum Prüfzeitpunkt nicht möglich.

**Feststellung**  
Die DNS-Abfrage der Mailserver-Einträge von {domain} ist fehlgeschlagen. Welche Mailserver eingetragen sind, lässt sich aus dieser Prüfung nicht sagen.

**Was passieren kann**  
Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offen bleibt.

**Folgen für Sie**  
Für diesen Bereich liegt kein belastbares Ergebnis vor.

**Aufwand**  
Prüfung wiederholen.

**Technische Zeile**  
MX: {text}

**Schritt in der Maßnahme**  
Mailserver-Einträge selbst prüfen oder die Prüfung wiederholen lassen

---

## E-Mail — Transportverschlüsselung

### `mta_sts_fehlt`  ·  Gering  ·  MTA-STS

**Titel**  
Verschlüsselte Zustellung nicht verbindlich

**Ein Satz**  
E-Mails an Sie können auf dem Transportweg unverschlüsselt übertragen werden.

**Feststellung**  
Es ist nicht verbindlich festgelegt, dass E-Mails an Ihre Domain nur verschlüsselt zugestellt werden dürfen (MTA-STS).

**Was passieren kann**  
Wer Zugriff auf den Übertragungsweg zwischen den Mailservern hat, kann die Verschlüsselung unterdrücken und E-Mails mitlesen.

**Folgen für Sie**  
Vertrauliche E-Mails an Sie sind auf dem Transportweg weniger geschützt.

**Aufwand**  
Richtliniendatei mit gültigem Zertifikat und DNS-Eintrag anlegen.

**Technische Zeile**  
MTA-STS: {text}

**Schritt in der Maßnahme**  
MTA-STS einrichten, damit E-Mails an Sie nur verschlüsselt zugestellt werden dürfen

### `tls_rpt_fehlt`  ·  Gering  ·  TLS-RPT

**Titel**  
Keine Fehlerberichte zur Verschlüsselung

**Ein Satz**  
Sie erfahren nicht, wenn verschlüsselte Zustellung scheitert.

**Feststellung**  
Für Berichte über Probleme bei der verschlüsselten Zustellung ist keine gültige Adresse hinterlegt (TLS-RPT).

**Was passieren kann**  
Störungen oder Manipulationen der Transportverschlüsselung bleiben unbemerkt.

**Folgen für Sie**  
Probleme werden erst bemerkt, wenn E-Mails fehlen.

**Aufwand**  
Ein DNS-Eintrag.

**Technische Zeile**  
TLS-RPT: {text}

**Schritt in der Maßnahme**  
TLS-RPT einrichten, damit Probleme bei der verschlüsselten Zustellung gemeldet werden

### `mta_sts_hinweis`  ·  Gering  ·  MTA-STS

**Titel**  
MTA-STS eingerichtet, aber nicht wirksam

**Ein Satz**  
Die Regel zur verschlüsselten Zustellung ist vorhanden, greift aber nicht vollständig.

**Feststellung**  
Für {domain} ist MTA-STS eingerichtet, die Richtlinie ist aber nicht vollständig wirksam, etwa weil sie im Testmodus läuft oder nur kurz gilt. Das genaue Prüfergebnis steht im technischen Detail.

**Was passieren kann**  
Sendende Mailserver dürfen bei einem Verschlüsselungsproblem weiterhin unverschlüsselt zustellen. In fremden Netzen ließen sich solche E-Mails mitlesen.

**Folgen für Sie**  
Der angestrebte Schutz der eingehenden Post greift noch nicht.

**Aufwand**  
Richtlinie auf „enforce“ stellen und Gültigkeitsdauer erhöhen.

**Technische Zeile**  
MTA-STS: {text}

**Schritt in der Maßnahme**  
MTA-STS-Richtlinie von „testing“ auf „enforce“ stellen

### `mta_sts_nicht_pruefbar`  ·  Gering  ·  MTA-STS

**Titel**  
MTA-STS konnte nicht geprüft werden

**Ein Satz**  
Die Abfrage der MTA-STS-Einstellung war zum Prüfzeitpunkt nicht möglich.

**Feststellung**  
Die Abfrage für MTA-STS von {domain} ist fehlgeschlagen. Ob eine Richtlinie zur verschlüsselten Zustellung veröffentlicht ist, lässt sich aus dieser Prüfung nicht sagen.

**Was passieren kann**  
Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offen bleibt.

**Folgen für Sie**  
Für diesen Bereich liegt kein belastbares Ergebnis vor.

**Aufwand**  
Prüfung wiederholen.

**Technische Zeile**  
MTA-STS: {text}

**Schritt in der Maßnahme**  
MTA-STS selbst prüfen oder die Prüfung wiederholen lassen

### `tls_rpt_hinweis`  ·  Gering  ·  TLS-RPT

**Titel**  
TLS-RPT-Eintrag fehlerhaft

**Ein Satz**  
Der Eintrag für Berichte über Verschlüsselungsprobleme ist nicht verwertbar.

**Feststellung**  
Für {domain} ist ein TLS-RPT-Eintrag veröffentlicht, er ist aber nicht auswertbar. Sendende Mailserver können keine Berichte über fehlgeschlagene verschlüsselte Zustellungen schicken.

**Was passieren kann**  
Kein Angriffsweg. Probleme bei der verschlüsselten Zustellung bleiben unbemerkt.

**Folgen für Sie**  
Störungen und Angriffe auf die Transportverschlüsselung würden Ihnen nicht gemeldet.

**Aufwand**  
Eintrag korrigieren.

**Technische Zeile**  
TLS-RPT: {text}

**Schritt in der Maßnahme**  
TLS-RPT-Eintrag korrigieren

### `tls_rpt_nicht_pruefbar`  ·  Gering  ·  TLS-RPT

**Titel**  
TLS-RPT konnte nicht geprüft werden

**Ein Satz**  
Die Abfrage des TLS-RPT-Eintrags war zum Prüfzeitpunkt nicht möglich.

**Feststellung**  
Die Abfrage für TLS-RPT von {domain} ist fehlgeschlagen. Ob ein Eintrag für Berichte über Verschlüsselungsprobleme vorhanden ist, lässt sich aus dieser Prüfung nicht sagen.

**Was passieren kann**  
Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offen bleibt.

**Folgen für Sie**  
Für diesen Bereich liegt kein belastbares Ergebnis vor.

**Aufwand**  
Prüfung wiederholen.

**Technische Zeile**  
TLS-RPT: {text}

**Schritt in der Maßnahme**  
TLS-RPT selbst prüfen oder die Prüfung wiederholen lassen

---

## Domain — DNSSEC

### `dnssec_fehlt`  ·  Mittel  ·  DNSSEC

**Titel**  
Adressauskünfte der Domain nicht signiert

**Ein Satz**  
Mit erheblichem Aufwand ließen sich Besucher und E-Mails auf gefälschte Server umleiten.

**Feststellung**  
Die Adressauskünfte Ihrer Domain (DNS), unter welcher Adresse Website und Mailserver erreichbar sind, tragen keine digitale Signatur (DNSSEC).

**Was passieren kann**  
Mit erheblichem Aufwand lassen sich Adressauskünfte fälschen und, ohne MTA-STS, E-Mails umleiten. Besucher schützt vor allem erzwungenes HTTPS.

**Folgen für Sie**  
E-Mails an Sie oder Eingaben Ihrer Besucher könnten abgefangen werden.

**Aufwand**  
Meist beim DNS-Anbieter einschaltbar, dazu ein Eintrag beim Domain-Anbieter.

**Technische Zeile**  
DNSSEC: Zone nicht signiert

**Schritt in der Maßnahme**  
DNSSEC beim DNS-Anbieter aktivieren und den DS-Eintrag beim Registrar hinterlegen

### `dnssec_fehlerhaft`  ·  Hoch  ·  DNSSEC

**Titel**  
DNSSEC eingerichtet, aber fehlerhaft

**Ein Satz**  
Die Signatur der Domain ist vorhanden, wird bei der Prüfung aber zurückgewiesen.

**Feststellung**  
Für {domain} ist DNSSEC bei der übergeordneten Stelle eingetragen, die Prüfung der Signatur schlägt jedoch fehl.

**Was passieren kann**  
Kein Angriffsweg im engeren Sinn. Prüfende DNS-Server (Resolver) verwerfen fehlerhaft signierte Antworten; da die großen öffentlichen Resolver prüfen, kann die Domain für einen erheblichen Teil der Nutzer nicht erreichbar sein, einschließlich der Mailzustellung.

**Folgen für Sie**  
Website und E-Mail könnten für einen erheblichen Teil Ihrer Kunden ausfallen.

**Aufwand**  
Schlüssel beim DNS-Anbieter und Registrar abgleichen.

**Technische Zeile**  
DNSSEC: {text}

**Schritt in der Maßnahme**  
Signatur beim DNS-Anbieter und den DS-Eintrag beim Registrar abgleichen

### `dnssec_nicht_pruefbar`  ·  Gering  ·  DNSSEC

**Titel**  
DNSSEC konnte nicht geprüft werden

**Ein Satz**  
Die Abfrage des DNSSEC-Status war zum Prüfzeitpunkt nicht möglich.

**Feststellung**  
Die Abfrage des DNSSEC-Status von {domain} ist fehlgeschlagen. Ob die Zone signiert ist, lässt sich aus dieser Prüfung nicht sagen.

**Was passieren kann**  
Aus dem fehlenden Prüfergebnis entsteht kein Angriffsweg. Es bedeutet nur, dass dieser Punkt offen bleibt.

**Folgen für Sie**  
Für diesen Bereich liegt kein belastbares Ergebnis vor.

**Aufwand**  
Prüfung wiederholen.

**Technische Zeile**  
DNSSEC: {text}

**Schritt in der Maßnahme**  
DNSSEC selbst prüfen oder die Prüfung wiederholen lassen

---

## Website — Schutzregel für Skripte (CSP)

### `obs_csp_missing`  ·  Mittel  ·  Content Security Policy  ·  MDN: `csp-not-implemented` (-25 Punkte)

**Titel**  
Keine Schutzregel für Skripte

**Ein Satz**  
Eingeschleuster Programmcode würde auf Ihrer Website nicht blockiert.

**Feststellung**  
Die Website legt nicht fest, welcher Programmcode ausgeführt werden darf (Content Security Policy fehlt).

**Was passieren kann**  
Gelingt es, Code einzuschleusen, etwa über ein Formular oder ein veraltetes Plugin, wird er nicht blockiert. Er kann Eingaben mitlesen oder Besucher umleiten.

**Folgen für Sie**  
Ihre Website könnte gegen Ihre eigenen Besucher eingesetzt werden.

**Aufwand**  
Erfordert Abstimmung mit der Website-Entwicklung.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_csp_unsafe`  ·  Mittel  ·  Content Security Policy  ·  MDN: `csp-implemented-with-unsafe-inline` (-20 Punkte)

**Titel**  
Schutzregel für Skripte zu weit gefasst

**Ein Satz**  
Eingeschleuster Programmcode würde auf Ihrer Website nicht blockiert.

**Feststellung**  
Die Regel, welcher Programmcode laufen darf (Content Security Policy), lässt unsichere Skriptquellen zu und verliert so viel Schutzwirkung.

**Was passieren kann**  
Gelingt es, Code einzuschleusen, etwa über ein Formular oder ein veraltetes Plugin, wird er nicht blockiert. Er kann Eingaben mitlesen oder Besucher umleiten.

**Folgen für Sie**  
Ihre Website könnte gegen Ihre eigenen Besucher eingesetzt werden.

**Aufwand**  
Erfordert Abstimmung mit der Website-Entwicklung.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_csp_unsafe-eval`  ·  Mittel  ·  Content Security Policy  ·  MDN: `csp-implemented-with-unsafe-eval` (-10 Punkte)

**Titel**  
Schutzregel erlaubt nachgeladenen Code

**Ein Satz**  
Die Schutzregel für Skripte lässt eine riskante Technik zu.

**Feststellung**  
Die Schutzregel für Skripte (Content Security Policy) erlaubt, Programmcode zur Laufzeit aus Text zu erzeugen („unsafe-eval“). Damit lässt sich die Regel teilweise umgehen.

**Was passieren kann**  
Eingeschleuster Text könnte über diesen Weg doch als Code ausgeführt werden.

**Folgen für Sie**  
Der Schutz der Regel greift nicht vollständig.

**Aufwand**  
Erfordert Abstimmung mit der Website-Entwicklung.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_csp_http`  ·  Mittel  ·  Content Security Policy  ·  MDN: `csp-implemented-with-insecure-scheme` (-20 Punkte)

**Titel**  
Schutzregel erlaubt unverschlüsselte Quellen

**Ein Satz**  
Teile Ihrer Website dürfen laut Schutzregel unverschlüsselt geladen werden.

**Feststellung**  
Die Schutzregel für Inhalte (Content Security Policy) erlaubt, Bestandteile der Seite über unverschlüsseltes HTTP zu laden.

**Was passieren kann**  
Die Regel erlaubt Quellen, die unterwegs austauschbar wären. Aktuelle Browser blockieren solche Bestandteile auf einer verschlüsselten Seite zwar von sich aus; die Regel selbst zieht diese Grenze aber nicht und wirkt schwächer als vorgesehen.

**Folgen für Sie**  
Der Schutz der Regel greift nicht vollständig.

**Aufwand**  
Quellen in der Schutzregel auf HTTPS festlegen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_csp_http-passiv`  ·  Mittel  ·  Content Security Policy  ·  MDN: `csp-implemented-with-insecure-scheme-in-passive-content-only` (-10 Punkte)

**Titel**  
Bilder und Medien dürfen unverschlüsselt geladen werden

**Ein Satz**  
Bilder und Medien dürfen laut Schutzregel unverschlüsselt geladen werden.

**Feststellung**  
Die Schutzregel für Inhalte (Content Security Policy) ist gesetzt, erlaubt aber, Bilder und Medien über unverschlüsseltes HTTP zu laden.

**Was passieren kann**  
In öffentlichen WLANs könnten solche Bilder oder Medien unterwegs ausgetauscht werden, soweit der Browser sie nicht von sich aus auf eine verschlüsselte Verbindung umstellt. Programmcode ist davon nicht betroffen.

**Folgen für Sie**  
Besucher könnten manipulierte Bilder oder Medien sehen.

**Aufwand**  
Bild- und Medienquellen in der Schutzregel auf HTTPS festlegen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_csp_ungueltig`  ·  Mittel  ·  Content Security Policy  ·  MDN: `csp-header-invalid` (-25 Punkte)

**Titel**  
Schutzregel für Skripte fehlerhaft

**Ein Satz**  
Die Schutzregel für Skripte ist gesetzt, aber für Browser nicht verwertbar.

**Feststellung**  
Die Website sendet eine Schutzregel für Programmcode (Content Security Policy), die Browser nicht auswerten können. Sie wirkt damit nicht.

**Was passieren kann**  
Gelingt es, Code einzuschleusen, etwa über ein Formular oder ein veraltetes Plugin, wird er nicht blockiert. Er kann Eingaben mitlesen oder Besucher umleiten.

**Folgen für Sie**  
Die Regel ist vorhanden, schützt aber nicht.

**Aufwand**  
Den Kopfzeilen-Eintrag korrigieren; der Aufbau ist bereits vorhanden.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_csp_nur-report`  ·  Mittel  ·  Content Security Policy  ·  MDN: `csp-not-implemented-but-reporting-enabled` (-25 Punkte)

**Titel**  
Schutzregel nur im Beobachtungsbetrieb

**Ein Satz**  
Die Schutzregel für Skripte meldet Verstöße, blockiert aber nichts.

**Feststellung**  
Die Website setzt eine Schutzregel für Programmcode nur im Beobachtungsbetrieb (Content-Security-Policy-Report-Only). Verstöße werden gemeldet, aber nicht verhindert.

**Was passieren kann**  
Gelingt es, Code einzuschleusen, etwa über ein Formular oder ein veraltetes Plugin, wird er nicht blockiert. Er kann Eingaben mitlesen oder Besucher umleiten.

**Folgen für Sie**  
Der Beobachtungsbetrieb ist ein guter Zwischenschritt, schützt aber noch nicht.

**Aufwand**  
Die erprobte Regel aktiv schalten.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

---

## Website — Cookies

### `obs_cookies_no-httponly`  ·  Mittel  ·  Cookie-Attribut HttpOnly  ·  MDN: `cookies-session-without-httponly-flag` (-30 Punkte)

**Titel**  
Sitzungs-Cookie für Skripte lesbar

**Ein Satz**  
Nutzersitzungen sind schlechter gegen Übernahme geschützt.

**Feststellung**  
Ein Sitzungs-Cookie, das Besucher wiedererkennt, ist nicht gegen das Auslesen durch Skripte geschützt (HttpOnly fehlt).

**Was passieren kann**  
In Verbindung mit eingeschleustem Code können angemeldete Sitzungen übernommen werden.

**Folgen für Sie**  
Bei Anmeldebereichen könnten Unbefugte Konten übernehmen.

**Aufwand**  
Cookie-Attribute in der Anwendung setzen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_cookies_session-no-secure`  ·  Hoch  ·  Cookie-Attribut Secure  ·  MDN: `cookies-session-without-secure-flag` (-40 Punkte)

**Titel**  
Sitzungs-Cookie ohne Verschlüsselungszwang

**Ein Satz**  
Ein Sitzungs-Cookie kann unverschlüsselt übertragen werden.

**Feststellung**  
Ein Sitzungs-Cookie, das Besucher wiedererkennt, ist nicht auf verschlüsselte Verbindungen beschränkt (Secure fehlt), und die Website erzwingt Verschlüsselung auch nicht anderweitig.

**Was passieren kann**  
In öffentlichen WLANs könnte das Cookie bei einem unverschlüsselten Aufruf mitgelesen werden. Damit ließe sich eine angemeldete Sitzung übernehmen.

**Folgen für Sie**  
Unbefugte könnten Konten Ihrer Nutzer übernehmen.

**Aufwand**  
Cookie-Attribut Secure setzen und HSTS aktivieren.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_cookies_session-no-secure-hsts`  ·  Mittel  ·  Cookie-Attribut Secure  ·  MDN: `cookies-session-without-secure-flag-but-protected-by-hsts` (-10 Punkte)

**Titel**  
Sitzungs-Cookie ohne Verschlüsselungszwang, HSTS greift

**Ein Satz**  
Ein Sitzungs-Cookie ist nicht ausdrücklich auf verschlüsselte Verbindungen beschränkt.

**Feststellung**  
Ein Sitzungs-Cookie ist nicht auf verschlüsselte Verbindungen beschränkt (Secure fehlt). Weil die Website Verschlüsselung über HSTS erzwingt, wirkt das derzeit nicht.

**Was passieren kann**  
Entfällt HSTS künftig oder ruft ein Browser die Seite erstmals ohne HSTS-Kenntnis auf, könnte das Cookie unverschlüsselt übertragen werden. Deckt HSTS keine Unteradressen ab, gilt das auch dort.

**Folgen für Sie**  
Derzeit gering, solange HSTS greift; der Schutz hängt an einer zweiten Einstellung.

**Aufwand**  
Cookie-Attribut Secure ergänzen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_cookies_no-secure`  ·  Mittel  ·  Cookie-Attribut Secure  ·  MDN: `cookies-without-secure-flag` (-20 Punkte)

**Titel**  
Cookies ohne Verschlüsselungszwang

**Ein Satz**  
Cookies der Website können unverschlüsselt übertragen werden.

**Feststellung**  
Mindestens ein Cookie ist nicht auf verschlüsselte Verbindungen beschränkt (Secure fehlt), und die Website erzwingt Verschlüsselung auch nicht anderweitig.

**Was passieren kann**  
In öffentlichen WLANs könnten diese Cookies bei einem unverschlüsselten Aufruf mitgelesen werden.

**Folgen für Sie**  
Inhalte der Cookies könnten Dritten bekannt werden.

**Aufwand**  
Cookie-Attribut Secure setzen und HSTS aktivieren.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_cookies_no-secure-hsts`  ·  Gering  ·  Cookie-Attribut Secure  ·  MDN: `cookies-without-secure-flag-but-protected-by-hsts` (-5 Punkte)

**Titel**  
Cookies ohne Verschlüsselungszwang, HSTS greift

**Ein Satz**  
Cookies sind nicht ausdrücklich auf verschlüsselte Verbindungen beschränkt.

**Feststellung**  
Mindestens ein Cookie ist nicht auf verschlüsselte Verbindungen beschränkt (Secure fehlt). Weil die Website Verschlüsselung über HSTS erzwingt, wirkt das derzeit nicht.

**Was passieren kann**  
Entfällt HSTS künftig oder ruft ein Browser die Seite erstmals ohne HSTS-Kenntnis auf, könnte diese Cookies unverschlüsselt übertragen werden. Deckt HSTS keine Unteradressen ab, gilt das auch dort.

**Folgen für Sie**  
Derzeit gering, solange HSTS greift; der Schutz hängt an einer zweiten Einstellung.

**Aufwand**  
Cookie-Attribut Secure ergänzen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_cookies_samesite-ungueltig`  ·  Mittel  ·  Cookie-Attribut SameSite  ·  MDN: `cookies-samesite-flag-invalid` (-20 Punkte)

**Titel**  
Cookie-Einstellung SameSite fehlerhaft

**Ein Satz**  
Eine Cookie-Einstellung ist gesetzt, aber für Browser nicht verwertbar.

**Feststellung**  
Mindestens ein Cookie trägt für die Einstellung SameSite einen Wert, den Browser nicht auswerten können. Sie regelt, ob das Cookie bei Aufrufen von fremden Seiten mitgesendet wird.

**Was passieren kann**  
Browser fallen auf ihr eigenes Standardverhalten zurück. Je nach Browser könnte das Cookie bei Anfragen fremder Seiten mitgesendet werden.

**Folgen für Sie**  
Vorhandene Formulare könnten von fremden Seiten aus ausgelöst werden.

**Aufwand**  
Den Wert korrigieren (Lax, Strict oder None).

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_cookies_csrf-no-samesite`  ·  Mittel  ·  Cookie-Attribut SameSite  ·  MDN: `cookies-anticsrf-without-samesite-flag` (-20 Punkte)

**Titel**  
Schutz-Cookie ohne SameSite-Einstellung

**Ein Satz**  
Ein Cookie zum Schutz vor fremdgesteuerten Formularen ist unvollständig gesetzt.

**Feststellung**  
Ein Cookie, das Formulare vor Auslösen durch fremde Seiten schützt, trägt keine SameSite-Einstellung. Sie regelt, ob das Cookie bei Aufrufen von fremden Seiten mitgesendet wird.

**Was passieren kann**  
Browser fallen auf ihr eigenes Standardverhalten zurück. Je nach Browser könnte eine präparierte Seite Besucher dazu bringen, unbemerkt Aktionen auf Ihrer Website auszulösen.

**Folgen für Sie**  
Vorhandene Formulare oder Konten könnten missbraucht werden.

**Aufwand**  
SameSite auf Lax oder Strict setzen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

---

## Website — Verschlüsselung und Weiterleitung

### `obs_redirection_missing`  ·  Mittel  ·  HTTPS-Weiterleitung  ·  MDN: `redirection-missing` (-20 Punkte)

**Titel**  
Keine Umleitung auf HTTPS

**Ein Satz**  
Aufrufe ohne https:// führen nicht zu einer sicheren Verbindung.

**Feststellung**  
Unverschlüsselte Aufrufe über HTTP werden nicht auf eine verschlüsselte Verbindung umgeleitet.

**Was passieren kann**  
In öffentlichen WLANs (Hotel, Messe, Bahn) lassen sich unverschlüsselte Verbindungen mitlesen und verändern.

**Folgen für Sie**  
Eingaben Ihrer Besucher könnten unverschlüsselt übertragen, mitgelesen oder verändert werden.

**Aufwand**  
Weiterleitung in der Serverkonfiguration.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_redirection_nicht-https`  ·  Mittel  ·  HTTPS-Weiterleitung  ·  MDN: `redirection-not-to-https` (-20 Punkte)

**Titel**  
Umleitung führt nicht auf HTTPS

**Ein Satz**  
Aufrufe ohne https:// landen wieder bei einer unverschlüsselten Adresse.

**Feststellung**  
Unverschlüsselte Aufrufe werden umgeleitet, das Ziel ist aber erneut eine unverschlüsselte Adresse.

**Was passieren kann**  
In öffentlichen WLANs (Hotel, Messe, Bahn) lassen sich unverschlüsselte Verbindungen mitlesen und verändern.

**Folgen für Sie**  
Eingaben Ihrer Besucher könnten unverschlüsselt übertragen, mitgelesen oder verändert werden.

**Aufwand**  
Ziel der Weiterleitung auf HTTPS ändern.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_redirection_erst-http`  ·  Mittel  ·  HTTPS-Weiterleitung  ·  MDN: `redirection-not-to-https-on-initial-redirection` (-10 Punkte)

**Titel**  
Umleitung auf HTTPS erst im zweiten Schritt

**Ein Satz**  
Die Umleitung auf HTTPS ist vorhanden, führt aber über einen Umweg.

**Feststellung**  
Unverschlüsselte Aufrufe werden auf HTTPS umgeleitet, im ersten Schritt aber noch auf eine unverschlüsselte Adresse.

**Was passieren kann**  
In öffentlichen WLANs kann der erste, noch unverschlüsselte Schritt abgefangen und umgeleitet werden. Der Browser kann die Anweisung zur dauerhaft verschlüsselten Verbindung (HSTS) für die zuerst aufgerufene Adresse nicht übernehmen.

**Folgen für Sie**  
Zusatzrisiko für Besucher, die Ihre Adresse ohne https:// eingeben.

**Aufwand**  
Zuerst auf dieselbe Adresse mit HTTPS umleiten, danach auf die Zieladresse.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_redirection_fremder-host`  ·  Gering  ·  HTTPS-Weiterleitung  ·  MDN: `redirection-off-host-from-http` (-5 Punkte)

**Titel**  
Umleitung führt über eine andere Adresse

**Ein Satz**  
Die Umleitung auf HTTPS führt zunächst über eine andere Adresse.

**Feststellung**  
Unverschlüsselte Aufrufe werden auf HTTPS umgeleitet, im ersten Schritt aber auf einen anderen Hostnamen statt auf dieselbe Adresse mit HTTPS.

**Was passieren kann**  
Der Browser kann die Anweisung zur dauerhaft verschlüsselten Verbindung (HSTS) für die zuerst aufgerufene Adresse nicht übernehmen.

**Folgen für Sie**  
Geringes Zusatzrisiko für Besucher, die Ihre Adresse ohne https:// eingeben.

**Aufwand**  
Zuerst auf dieselbe Adresse mit HTTPS umleiten, danach auf die Zieladresse.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_redirection_zertifikat`  ·  Mittel  ·  HTTPS-Weiterleitung  ·  MDN: `redirection-invalid-cert` (-20 Punkte)

**Titel**  
Zertifikat der Weiterleitung nicht gültig

**Ein Satz**  
Beim Umleiten auf HTTPS ist das Zertifikat nicht gültig.

**Feststellung**  
Unverschlüsselte Aufrufe werden auf HTTPS umgeleitet, dabei ist das Zertifikat der Zieladresse jedoch nicht gültig.

**Was passieren kann**  
Browser zeigen eine Sicherheitswarnung. Solange das Zertifikat ungültig ist, lässt sich nicht bestätigen, dass die Verbindung wirklich zu Ihrem Server besteht. Besucher, die die Warnung wegklicken, könnten eine echte Warnung später ebenso behandeln.

**Folgen für Sie**  
Besucher sehen eine Warnung, bevor Ihre Website erscheint.

**Aufwand**  
Zertifikat für die Zieladresse erneuern oder passend ausstellen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_hsts_missing`  ·  Mittel  ·  HSTS  ·  MDN: `hsts-not-implemented` (-20 Punkte)

**Titel**  
Verschlüsselung wird nicht erzwungen

**Ein Satz**  
In öffentlichen WLANs könnten Verbindungen zu Ihrer Website abgefangen werden.

**Feststellung**  
Die Website weist Browser nicht an, ausschließlich verschlüsselt zu verbinden (HSTS).

**Was passieren kann**  
In öffentlichen WLANs (Hotel, Messe, Bahn) kann der erste Aufruf auf eine unverschlüsselte Verbindung umgeleitet und mitgelesen werden.

**Folgen für Sie**  
Formulareingaben und Anmeldedaten könnten dort mitgelesen werden.

**Aufwand**  
Eine Zeile in der Serverkonfiguration.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_hsts_kurz`  ·  Mittel  ·  HSTS  ·  MDN: `hsts-implemented-max-age-less-than-six-months` (-10 Punkte)

**Titel**  
Verschlüsselung nur kurz erzwungen

**Ein Satz**  
Die Anweisung zur verschlüsselten Verbindung gilt nur für kurze Zeit.

**Feststellung**  
Die Website weist Browser an, ausschließlich verschlüsselt zu verbinden (HSTS), allerdings für weniger als sechs Monate.

**Was passieren kann**  
Besucher, die längere Zeit nicht auf der Website waren, sind beim nächsten ersten Aufruf wieder ungeschützt und könnten in öffentlichen WLANs umgeleitet werden.

**Folgen für Sie**  
Der Schutz greift nur für häufige Besucher.

**Aufwand**  
Gültigkeitsdauer auf mindestens sechs Monate erhöhen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_hsts_ungueltig`  ·  Mittel  ·  HSTS  ·  MDN: `hsts-header-invalid` (-20 Punkte)

**Titel**  
Anweisung zur Verschlüsselung fehlerhaft

**Ein Satz**  
Die Anweisung zur verschlüsselten Verbindung ist nicht verwertbar.

**Feststellung**  
Die Website sendet die Anweisung, ausschließlich verschlüsselt zu verbinden (HSTS), in einer Form, die Browser nicht auswerten können. Sie wirkt damit nicht.

**Was passieren kann**  
In öffentlichen WLANs kann der erste Aufruf auf eine unverschlüsselte Verbindung umgeleitet und mitgelesen werden.

**Folgen für Sie**  
Die Anweisung ist vorhanden, schützt aber nicht.

**Aufwand**  
Den Kopfzeilen-Eintrag korrigieren.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_hsts_kein-https`  ·  Mittel  ·  HSTS  ·  MDN: `hsts-not-implemented-no-https` (-20 Punkte)

**Titel**  
Website ohne verschlüsselten Aufruf

**Ein Satz**  
Die Website ist nicht über eine verschlüsselte Adresse erreichbar.

**Feststellung**  
Die Website ist nicht über HTTPS erreichbar, deshalb kann sie Browser auch nicht zu verschlüsselten Verbindungen anweisen (HSTS).

**Was passieren kann**  
Der Verkehr zur Website könnte in fremden Netzen mitgelesen und verändert werden.

**Folgen für Sie**  
Eingaben Ihrer Besucher könnten unterwegs mitgelesen werden.

**Aufwand**  
Zertifikat einrichten und die Website über HTTPS ausliefern.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_hsts_zertifikat`  ·  Mittel  ·  HSTS  ·  MDN: `hsts-invalid-cert` (-20 Punkte)

**Titel**  
Zertifikat nicht gültig, Verschlüsselung nicht erzwungen

**Ein Satz**  
Das Zertifikat der Website ist nicht gültig.

**Feststellung**  
Das Zertifikat der Website ist nicht gültig; eine HSTS-Anweisung bleibt deshalb wirkungslos, weil Browser sie aus einer nicht vertrauenswürdigen Verbindung verwerfen.

**Was passieren kann**  
Browser zeigen eine Sicherheitswarnung. Solange das Zertifikat ungültig ist, lässt sich nicht bestätigen, dass die Verbindung wirklich zu Ihrem Server besteht. Besucher, die die Warnung wegklicken, könnten eine echte Warnung später ebenso behandeln.

**Folgen für Sie**  
Besucher sehen eine Warnung, bevor Ihre Website erscheint.

**Aufwand**  
Zertifikat erneuern, danach HSTS setzen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

---

## Website — fremde Skripte und Einbettung

### `obs_sri_http`  ·  Hoch  ·  Subresource Integrity  ·  MDN: `sri-not-implemented-and-external-scripts-not-loaded-securely` (-50 Punkte)

**Titel**  
Fremde Skripte unverschlüsselt und ungeprüft

**Ein Satz**  
Fremder Programmcode wird unverschlüsselt geladen, ohne Prüfung auf Veränderungen.

**Feststellung**  
Die Website bindet fremde Skripte ohne Prüfung auf Veränderungen ein (Subresource Integrity) und teils ohne erzwungene Verschlüsselung.

**Was passieren kann**  
Wird einer der fremden Anbieter gehackt, führen die Browser Ihrer Besucher den veränderten Code automatisch aus, ohne dass Ihre Website es bemerkt. Läuft Ihre Seite selbst unverschlüsselt, könnte der Code zusätzlich unterwegs ausgetauscht werden; auf einer verschlüsselten Seite laden Browser ihn nicht.

**Folgen für Sie**  
Veränderter Code eines Drittanbieters liefe mit den Rechten Ihrer Website.

**Aufwand**  
Skripte über HTTPS laden und Prüfsummen ergänzen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_sri_https`  ·  Gering  ·  Subresource Integrity  ·  MDN: `sri-not-implemented-but-external-scripts-loaded-securely` (-5 Punkte)

**Titel**  
Fremde Skripte ohne Prüfung auf Veränderungen

**Ein Satz**  
Fremder Programmcode wird geladen, ohne zu prüfen, ob er verändert wurde.

**Feststellung**  
Die Website lädt Programmcode fremder Server verschlüsselt, aber ohne dass Browser prüfen können, ob er verändert wurde (Subresource Integrity).

**Was passieren kann**  
Wird einer der fremden Anbieter gehackt, führen die Browser Ihrer Besucher den veränderten Code automatisch aus, ohne dass Ihre Website es bemerkt.

**Folgen für Sie**  
Abhängigkeit von der Sicherheit fremder Anbieter.

**Aufwand**  
Prüfsummen für externe Skripte ergänzen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_sri_teilweise-http`  ·  Mittel  ·  Subresource Integrity  ·  MDN: `sri-implemented-but-external-scripts-not-loaded-securely` (-20 Punkte)

**Titel**  
Prüfsummen vorhanden, Skripte teils unverschlüsselt

**Ein Satz**  
Die Prüfung fremder Skripte ist eingerichtet, einzelne werden aber unverschlüsselt geladen.

**Feststellung**  
Die Website prüft fremde Skripte auf Veränderungen (Subresource Integrity), lädt einzelne davon aber nicht über eine verschlüsselte Verbindung.

**Was passieren kann**  
Aktuelle Browser laden unverschlüsselt eingebundenen Programmcode auf einer verschlüsselten Seite gar nicht erst. Die betroffene Funktion fällt dadurch aus; die hinterlegte Prüfsumme kommt in diesem Fall nicht zum Tragen.

**Folgen für Sie**  
Teile Ihrer Website funktionieren in aktuellen Browsern möglicherweise schon heute nicht.

**Aufwand**  
Die betroffenen Skripte über HTTPS laden.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_xcto_missing`  ·  Gering  ·  X-Content-Type-Options  ·  MDN: `x-content-type-options-not-implemented` (-5 Punkte)

**Titel**  
Dateityp-Schutz fehlt

**Ein Satz**  
Browser könnten Dateien Ihrer Website falsch interpretieren.

**Feststellung**  
Die Website verbietet Browsern nicht, den Typ ausgelieferter Dateien selbst zu erraten (X-Content-Type-Options).

**Was passieren kann**  
Hochgeladene oder fremde Dateien könnten als ausführbarer Code interpretiert werden. Einzeln ein geringes Risiko.

**Folgen für Sie**  
Geringes Zusatzrisiko, das sich mit einer Zeile beheben lässt.

**Aufwand**  
Eine Zeile in der Serverkonfiguration.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_xcto_ungueltig`  ·  Gering  ·  X-Content-Type-Options  ·  MDN: `x-content-type-options-header-invalid` (-5 Punkte)

**Titel**  
Dateityp-Schutz fehlerhaft gesetzt

**Ein Satz**  
Die Einstellung zum Dateityp-Schutz ist nicht verwertbar.

**Feststellung**  
Die Website sendet für den Dateityp-Schutz (X-Content-Type-Options) einen Wert, den Browser nicht auswerten können. Erwartet wird „nosniff“.

**Was passieren kann**  
Hochgeladene oder fremde Dateien könnten als ausführbarer Code interpretiert werden. Einzeln ein geringes Risiko.

**Folgen für Sie**  
Die Einstellung ist vorhanden, wirkt aber nicht.

**Aufwand**  
Den Wert auf „nosniff“ setzen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_xfo_missing`  ·  Mittel  ·  X-Frame-Options  ·  MDN: `x-frame-options-not-implemented` (-20 Punkte)

**Titel**  
Kein Schutz vor unsichtbarer Einbettung

**Ein Satz**  
Ihre Website kann in fremde Seiten eingebettet und missbraucht werden.

**Feststellung**  
Die Website kann unsichtbar in fremde Webseiten eingebettet werden (X-Frame-Options bzw. frame-ancestors fehlt).

**Was passieren kann**  
Angreifer könnten Besucher unbemerkt Aktionen auf Ihrer Website auslösen lassen (Clickjacking).

**Folgen für Sie**  
Vorhandene Formulare oder Konten könnten missbraucht werden.

**Aufwand**  
Eine Zeile in der Serverkonfiguration.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_xfo_ungueltig`  ·  Mittel  ·  X-Frame-Options  ·  MDN: `x-frame-options-header-invalid` (-20 Punkte)

**Titel**  
Schutz vor Einbettung fehlerhaft gesetzt

**Ein Satz**  
Die Einstellung gegen das Einbetten Ihrer Website ist nicht verwertbar.

**Feststellung**  
Die Website sendet gegen das Einbetten in fremde Seiten (X-Frame-Options) einen Wert, den Browser nicht auswerten können. Sie wirkt damit nicht.

**Was passieren kann**  
Angreifer könnten Besucher unbemerkt Aktionen auf Ihrer Website auslösen lassen (Clickjacking).

**Folgen für Sie**  
Die Einstellung ist vorhanden, schützt aber nicht.

**Aufwand**  
Den Wert korrigieren (DENY oder SAMEORIGIN) oder frame-ancestors per Schutzregel setzen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

---

## Website — Freigaben und Trennung

### `obs_coep_ungueltig`  ·  Gering  ·  Cross-Origin-Embedder-Policy  ·  MDN: `coep-header-invalid` (-5 Punkte)

**Titel**  
Einstellung zur Einbettung fremder Inhalte fehlerhaft

**Ein Satz**  
Eine Einstellung zur Trennung fremder Inhalte ist nicht verwertbar.

**Feststellung**  
Die Website sendet für die Trennung eingebetteter fremder Inhalte (Cross-Origin-Embedder-Policy) einen Wert, den Browser nicht auswerten können.

**Was passieren kann**  
Die zusätzliche Trennung greift nicht. Ein eigener Angriffsweg entsteht daraus nicht.

**Folgen für Sie**  
Eine moderne Zusatzabsicherung bleibt ohne Wirkung.

**Aufwand**  
Den Kopfzeilen-Eintrag korrigieren oder entfernen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_coop_ungueltig`  ·  Gering  ·  Cross-Origin-Opener-Policy  ·  MDN: `coop-header-invalid` (-5 Punkte)

**Titel**  
Einstellung zur Fensterabschirmung fehlerhaft

**Ein Satz**  
Eine Einstellung zur Abschirmung geöffneter Fenster ist nicht verwertbar.

**Feststellung**  
Die Website sendet für die Abschirmung von Fenstern, die sie öffnet oder die sie öffnen (Cross-Origin-Opener-Policy), einen Wert, den Browser nicht auswerten können.

**Was passieren kann**  
Von Ihrer Seite geöffnete fremde Fenster könnten einen Zugriffspunkt zurück auf Ihr Fenster behalten, soweit der Browser ihn nicht ohnehin kappt.

**Folgen für Sie**  
Eine moderne Zusatzabsicherung bleibt ohne Wirkung.

**Aufwand**  
Den Kopfzeilen-Eintrag korrigieren oder entfernen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_corp_ungueltig`  ·  Gering  ·  Cross-Origin-Resource-Policy  ·  MDN: `corp-header-invalid` (-5 Punkte)

**Titel**  
Schutz vor dem Abrufen einzelner Inhalte fehlerhaft

**Ein Satz**  
Eine Einstellung gegen das Abrufen Ihrer Inhalte durch fremde Seiten ist nicht verwertbar.

**Feststellung**  
Die Website sendet für den Schutz vor dem Abrufen einzelner Inhalte durch fremde Seiten (Cross-Origin-Resource-Policy) einen Wert, den Browser nicht auswerten können.

**Was passieren kann**  
Fremde Seiten könnten einzelne Inhalte Ihrer Website weiterhin abrufen.

**Folgen für Sie**  
Eine moderne Zusatzabsicherung bleibt ohne Wirkung.

**Aufwand**  
Den Kopfzeilen-Eintrag korrigieren oder entfernen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_cors_universal`  ·  Hoch  ·  CORS  ·  MDN: `cross-origin-resource-sharing-implemented-with-universal-access` (-50 Punkte)

**Titel**  
Zu offene Freigabe für fremde Webseiten

**Ein Satz**  
Fremde Webseiten dürfen Inhalte Ihrer Website abrufen.

**Feststellung**  
Die Website erlaubt beliebigen fremden Webseiten den Zugriff auf ihre Inhalte, auch mit den Anmeldedaten Ihrer Besucher (CORS).

**Was passieren kann**  
Präparierte Seiten können Daten aus Ihrer Website im Kontext Ihrer Besucher abrufen.

**Folgen für Sie**  
Mögliche Preisgabe von Daten angemeldeter Nutzer.

**Aufwand**  
Freigaben auf benötigte Partner beschränken.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_referrer_unsafe`  ·  Gering  ·  Referrer-Policy  ·  MDN: `referrer-policy-unsafe` (-5 Punkte)

**Titel**  
Seitenadressen werden zu offen weitergegeben

**Ein Satz**  
Beim Aufruf fremder Seiten werden Adressen Ihrer Website weitergegeben.

**Feststellung**  
Die Regel, welche Adressinformationen beim Aufruf fremder Seiten weitergegeben werden (Referrer-Policy), ist zu offen gesetzt.

**Was passieren kann**  
Seitenadressen oder Teile davon können an fremde Seiten gelangen, teils auch über unverschlüsselte Verbindungen. Enthalten Adressen Kennungen, gelangen diese mit.

**Folgen für Sie**  
Geringes Datenschutzrisiko.

**Aufwand**  
Eine Zeile in der Serverkonfiguration.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_referrer_ungueltig`  ·  Gering  ·  Referrer-Policy  ·  MDN: `referrer-policy-header-invalid` (-5 Punkte)

**Titel**  
Regel zur Weitergabe von Seitenadressen fehlerhaft

**Ein Satz**  
Die Regel zur Weitergabe von Seitenadressen ist nicht verwertbar.

**Feststellung**  
Die Website sendet für die Weitergabe von Adressinformationen (Referrer-Policy) einen Wert, den Browser nicht auswerten können. Browser fallen auf ihr Standardverhalten zurück.

**Was passieren kann**  
Je nach Browser können Seitenadressen oder Teile davon an fremde Seiten gelangen.

**Folgen für Sie**  
Geringes Datenschutzrisiko.

**Aufwand**  
Den Wert korrigieren.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

---

## Website — Auswertung der Startseite

### `obs_generic`  ·  Mittel  ·  {label}

**Titel**  
Sicherheitsregel unvollständig: {label}

**Ein Satz**  
Eine Schutzregel der Website fehlt, ist fehlerhaft oder zu offen gesetzt.

**Feststellung**  
Der automatische Test „{label}“ wurde nicht bestanden ({modifier} Punkte). Die Originalmeldung des Prüfwerkzeugs steht im technischen Detail.

**Was passieren kann**  
Fehlende, fehlerhafte oder zu offene Schutzregeln erleichtern Angriffe auf Besucher der Website.

**Folgen für Sie**  
Erhöhtes Risiko für Ihre Besucher.

**Aufwand**  
Konfiguration prüfen und ergänzen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

### `obs_scan_html-unlesbar`  ·  Mittel  ·  Seitenaufbau  ·  MDN: `html-not-parseable` (-20 Punkte)

**Titel**  
Startseite konnte nicht ausgewertet werden

**Ein Satz**  
Der Aufbau der Startseite ließ sich nicht maschinell auswerten.

**Feststellung**  
Das Prüfwerkzeug konnte die Startseite nicht als HTML auswerten. Die Prüfung der eingebundenen Skripte (Subresource Integrity) liefert deshalb kein belastbares Ergebnis; die Prüfungen der Kopfzeilen sind davon nicht betroffen.

**Was passieren kann**  
Daraus entsteht kein eigener Angriffsweg. Es bedeutet aber, dass dieser Teil der Prüfung offen bleibt.

**Folgen für Sie**  
Für die Prüfung der eingebundenen Skripte liegt kein Ergebnis vor.

**Aufwand**  
Erreichbarkeit und Auslieferung der Startseite prüfen.

**Technische Zeile**  
{label}: {modifier} Punkte · „{result_text}“

---

## Was gut gemacht ist (Positivliste)

Einzeiler, die im Bericht unter „Bereits umgesetzt“ stehen.

- `dmarc_reject`  
  Gefälschte E-Mails sollen abgewiesen werden (DMARC „reject“)
- `dmarc_quarantine`  
  Gefälschte E-Mails sollen aussortiert werden (DMARC „quarantine“)
- `dmarc_rua`  
  Auswertungsberichte angefordert (DMARC)
- `spf_ok`  
  Berechtigte Mailserver festgelegt (SPF)
- `dkim_ok`  
  Signaturschlüssel veröffentlicht ({text})
- `mx_ok`  
  Mailserver eingetragen ({text})
- `mta_sts_ok`  
  Richtlinie für verschlüsselte Zustellung veröffentlicht (MTA-STS)
- `tls_rpt_ok`  
  Fehlerberichte zur verschlüsselten Zustellung angefordert (TLS-RPT)
- `dnssec_ok`  
  Adressauskünfte digital signiert (DNSSEC)
- `obs_csp_streng`  
  Streng gesetzte Schutzregel für Programmcode (Content Security Policy)
- `obs_csp_ohne-unsafe`  
  Schutzregel für Programmcode ohne unsichere Quellen (Content Security Policy)
- `obs_cookies_vorbildlich`  
  Cookies vollständig mit allen Schutzattributen gesetzt (Secure, HttpOnly, SameSite)
- `obs_coep_require-corp`  
  Fremde Inhalte sind vom eigenen Seiteninhalt getrennt (Cross-Origin-Embedder-Policy)
- `obs_coep_credentialless`  
  Fremde Inhalte werden ohne Anmeldedaten geladen (Cross-Origin-Embedder-Policy)
- `obs_coop_same-origin`  
  Geöffnete Fenster sind gegen fremden Zugriff abgeschirmt (Cross-Origin-Opener-Policy)
- `obs_coop_allow-popups`  
  Von fremden Seiten geöffnete Fenster sind abgeschirmt; selbst geöffnete Pop-ups behalten die Verbindung (Cross-Origin-Opener-Policy)
- `obs_coop_noopener`  
  Geöffnete Fenster sind gegen fremden Zugriff abgeschirmt (Cross-Origin-Opener-Policy)
- `obs_corp_same-origin`  
  Fremde Seiten können einzelne Inhalte der Website nicht abrufen (Cross-Origin-Resource-Policy)
- `obs_corp_same-site`  
  Das Abrufen der Inhalte ist auf Adressen der eigenen Domain beschränkt (Cross-Origin-Resource-Policy)
- `obs_referrer_privat`  
  Seitenadressen werden nicht an fremde Seiten weitergegeben (Referrer-Policy)
- `obs_hsts_preloaded`  
  Verschlüsselung ist erzwungen und in Browsern voreingetragen (HSTS Preload)
- `obs_sri_vollstaendig`  
  Fremde Skripte werden auf Veränderungen geprüft, alle Skripte verschlüsselt geladen (Subresource Integrity)
- `obs_sri_extern-ok`  
  Fremde Skripte werden auf Veränderungen geprüft (Subresource Integrity)
- `obs_xfo_per-csp`  
  Einbettung in fremde Seiten ist unterbunden (frame-ancestors)
- `obs_xfo_gesetzt`  
  Einbettung in fremde Seiten ist unterbunden (X-Frame-Options)
- `spf_teilerfolg`  
  Ein SPF-Eintrag ist vorhanden und kann bereinigt werden
- `dkim_teilerfolg`  
  DKIM-Schlüssel sind vorhanden und können bereinigt werden
- `mx_teilerfolg`  
  Mailserver sind eingetragen
- `mta_sts_teilerfolg`  
  MTA-STS ist eingerichtet und kann scharf gestellt werden
- `tls_rpt_teilerfolg`  
  Ein TLS-RPT-Eintrag ist vorhanden und kann korrigiert werden

---

## Sätze je Prüfbereich

### E-Mail — DMARC

- **reject**  
  Gefälschte E-Mails mit Ihrem Absender sollen abgewiesen werden.
- **quarantine**  
  Gefälschte E-Mails mit Ihrem Absender sollen nur aussortiert werden.
- **none**  
  Die Richtlinie „none“ fordert kein Abweisen gefälschter E-Mails.
- **fehlt**  
  Es ist nicht festgelegt, wie mit gefälschten Absendern umzugehen ist.
- **ungueltig**  
  Der DMARC-Eintrag enthält keine gültige Richtlinie und schützt nicht vor gefälschten Absendern.
- **nicht_pruefbar**  
  Ob eine Richtlinie gegen gefälschte Absender gesetzt ist, konnte nicht geprüft werden.
- **note_hinweis** (berechnet, aber noch nicht gedruckt)  
  Die Note bewertet nur DMARC; zu {felder} bestehen Feststellungen ({nummern}).

### Domain — DNSSEC

- **signiert**  
  Die Adressauskünfte Ihrer Domain sind digital signiert.
- **nicht_signiert**  
  Die Adressauskünfte Ihrer Domain sind nicht gegen Fälschung geschützt.
- **fehlerhaft**  
  Die Signatur der DNS-Antworten ist eingerichtet, wird bei der Prüfung aber zurückgewiesen.
- **nicht_pruefbar**  
  Ob die DNS-Antworten der Domain signiert sind, konnte nicht geprüft werden.

### Website — HTTP Observatory

- **bewertet**  
  {passed} von {total} Tests bestanden. Die Note gewichtet nach Schwere.
- **nicht_verfuegbar**  
  Nicht automatisch bewertbar: weder Mangel noch Entwarnung.
- **bewertet_alle**  
  Alle {total} Sicherheitstests bestanden.

---

## Maßnahmen

### `M_MAIL_AUTH` — E-Mail-Absender absichern

**Text**  
{schritte}.

**Üblicherweise zuständig** (berechnet, aber noch nicht gedruckt)  
Ihre IT oder Ihr IT-Dienstleister, gemeinsam mit dem Mailanbieter

### `M_DNSSEC` — Adressauskünfte signieren (DNSSEC)

**Text**  
{schritte}.

**Üblicherweise zuständig** (berechnet, aber noch nicht gedruckt)  
Ihr DNS-Anbieter und Ihr Registrar

### `M_WEB` — Website-Schutzregeln ergänzen und verschärfen

**Text**  
Betroffen: {liste}.

**Üblicherweise zuständig** (berechnet, aber noch nicht gedruckt)  
Ihre Webagentur oder Ihr Hosting-Anbieter

### `M_MAIL_TRANSPORT` — Verschlüsselte E-Mail-Zustellung absichern

**Text**  
{schritte}.

**Üblicherweise zuständig** (berechnet, aber noch nicht gedruckt)  
Ihre IT oder Ihr IT-Dienstleister, gemeinsam mit dem Mailanbieter

### `M_MX` — E-Mail-Empfang über DNS instandsetzen

**Text**  
{schritte}.

**Üblicherweise zuständig** (berechnet, aber noch nicht gedruckt)  
Ihr Mailanbieter

### `M_RETEST` — Umsetzung überprüfen

**Text**  
Nach der Umsetzung prüfen wir kostenfrei erneut. Der neue Befund zeigt, was behoben ist.

**Üblicherweise zuständig** (berechnet, aber noch nicht gedruckt)  
Reineke Technik

**Ohne Feststellungen**  
Wir wiederholen die Prüfung auf Wunsch kostenfrei, etwa nach Änderungen an Website oder Mailsystem.

