# Vorbereitet: gemeinsame Einwilligung für www und scan.reineke-technik.de

Stand 30.08.2026. **Zurückgestellt, nicht verworfen.** Werner hat entschieden,
den Umzug zuerst ohne diesen Teil zu machen.

Dieses Dokument ist selbsttragend: Es setzt nichts aus der Sitzung voraus, in
der es entstanden ist, und enthält alles, was fünf Prüfdurchgänge ergeben haben.

---

## Was es leisten soll

Wer auf `www.reineke-technik.de` zustimmt, soll auf `scan.reineke-technik.de`
nicht erneut gefragt werden. Heute liegt die Einwilligung im `localStorage`,
und der gilt strikt pro Adresse.

**Was es NICHT leistet:** `scan.reineke.tech` bleibt außen vor. Cookies können
Domaingrenzen nicht überschreiten. Das ist kein Mangel des Entwurfs, sondern
eine Eigenschaft von Cookies.

**Was es nicht braucht:** Die durchlaufende Sitzung im Replay. Die entsteht
schon durch PostHogs eigenes Cookie auf der gemeinsamen Domain — ganz ohne
diesen Mechanismus. Die gemeinsame Einwilligung bringt allein die
Bequemlichkeit, nicht zweimal gefragt zu werden.

## Warum es zurückgestellt wurde

Fünf Prüfdurchgänge, fünfmal derselbe Befundtyp: **ein Weg zur
Bildschirmaufzeichnung ohne Einwilligung, den es heute nicht gibt.** Jede
Fassung schloss die gefundene Lücke und öffnete die nächste.

Heute ist so etwas unmöglich, weil die Einwilligung an die Adresse gebunden
ist. Jede geteilte Fassung hebt genau diese Bindung auf — das ist der Zweck und
zugleich das Risiko.

**Empfehlung für die Umsetzung: vor dem Scharfschalten von jemandem prüfen
lassen, der Sicherheitsprüfungen macht.** Nicht von Prüfläufen derselben Art,
die dieses Dokument hervorgebracht haben.

---

## Aufbau

    Cookie   __Secure-rt_consent          HttpOnly, Secure, SameSite=Lax
    Domain   .reineke-technik.de          Path=/
    Wert     <nutzlast>.<signatur>        beides base64url
    Nutzlast {"cv":1,"aud":"…","granted":[…],"ts":"…","seq":17}

Gesetzt wird **per `Set-Cookie` aus dem Worker**, nie per JavaScript. Das löst
drei Dinge auf einmal: Safari deckelt per Skript gesetzte Cookies auf sieben
Tage, Schreibfehler im Browser sind still, und nur der Worker kennt das
Geheimnis.

Gelesen wird auf dem Scanner **aus dem `brand-data`-Block**, den der Worker
ohnehin in jede HTML-Antwort schreibt — dort gehört der geprüfte Zustand hin,
das kostet keine Zusatzanfrage. Auf www über einen Endpunkt mit
`Cache-Control: no-store`, weil dort das HTML aus dem Edge-Cache kommt.

---

## Die fünf Blocker und was gegen sie steht

### 1. Der Schreib-Endpunkt braucht eine Herkunftsprüfung

Ein `POST /consent`, das ohne Prüfung ein `Set-Cookie` ausliefert, lässt sich
von **jeder fremden Website** per Formular-POST auslösen. Der Browser nimmt das
Cookie an, und beim nächsten Besuch meldet der Zustand eine **echt signierte**
Zustimmung.

- `isCrossOrigin()` verwenden — steht bereits in `src/index.ts`
- Den Endpunkt **nicht** unter `/api/*` legen: dort gilt `cors({origin:"*"})`

### 2. `seq` muss der Server vergeben

Nimmt der Worker den vom Browser gesendeten Wert, holt sich jemand einmal
legitim ein signiertes `seq: 9007199254740991` und spielt es beliebig oft ein.
Die Regel „höherer `seq` gewinnt" lässt es **jeden künftigen Widerruf
schlagen**, dauerhaft.

- Zähler serverseitig aus dem vorherigen geprüften Cookie ableiten
- Schrittweite deckeln

### 3. Die Signatur verhindert Fälschung, nicht Wiedereinspielung

Die Nutzlast bindet nichts an einen Browser. **Ein einziges gültiges Exemplar
ist ein universeller Zustimmungsschlüssel für ein Jahr.**

- `HttpOnly` — sonst liest jeder Zonenhost mit XSS gültige Token per
  `document.cookie` ab
- **Frischefenster:** Ein Token darf eine Aufzeichnung auf einem Host, wo
  lokal noch nichts steht, nur starten, wenn `ts` wenige Tage alt ist. Die 365
  Tage gelten nur für den Host, der es selbst geschrieben hat
- **Lokaler Höchststand:** Jeder Host merkt sich den höchsten je akzeptierten
  `seq` und nimmt nichts Kleineres oder Gleiches mehr an

Ohne Frischefenster und Höchststand ist „höherer `seq` gewinnt" eine
Angriffshilfe, keine Schutzregel.

### 4. Fehlendes Geheimnis muss erzwungen scheitern

`hmac(env.CONSENT_SECRET ?? "")` ist ein Totalbypass — den leeren Schlüssel
kennt jeder. Und hat nur *ein* Worker das Geheimnis, funktioniert die
gemeinsame Zustimmung still gar nicht.

- Hart abbrechen ohne Geheimnis
- Eine Prüfung, die den Zustand sichtbar macht

### 5. Der Mechanismus braucht einen Freigabeschalter

Er kann nicht geprüft werden, ohne deployt zu sein — und deployt ist er auf
allen Hosts. Ein Wegwerf-Hostpaar allein genügt nicht.

- Umgebungsvariable `CONSENT_SHARED`, Vorgabe **aus**
- Nur auf den Prüfhosts an, bis Texte und Banner stehen

---

## Weitere Punkte aus den Prüfungen

**Zuständigkeitsbereich.** www kennt `statistics` und `marketing`, der Scanner
nur `statistics`. Jeder Manager ersetzt **nur seine eigenen** Kategorien und
reicht fremde durch:

    neu = (alt ∖ EIGENE) ∪ gewaehlte

Und `withdrawing` rechnet gegen `alt ∩ EIGENE`. Ohne das löscht ein
„Einverstanden" auf dem Scanner die Marketing-Zustimmung von www.

**Konfliktregel.** Höherer `seq` gewinnt; bei gleichem oder fehlendem `seq`
**die kleinere Menge**. Nach jedem Schreiben zurücklesen. Im Zweifel weniger
Zustimmung, nie mehr.

**Empfänger (`aud`) in die Nutzlast.** Sonst ist ein auf dem Prüfhost erzeugtes
Token in der Produktion gültig — und bleibt es ein Jahr nach dessen Abbau.

**Kein Rückweg ohne Vorsorge.** Ein signiertes Cookie lässt sich ohne
Serverzustand nicht zurückrufen; die einzige Handhabe wäre ein neues Geheimnis,
das alle Einwilligungen auf einmal ungültig macht. Ohne `kid` ist kein
gleitender Wechsel möglich.

**Konstantzeit-Vergleich.** `crypto.subtle.verify` oder das vorhandene
`timingSafeEqual`. Kostenlos richtig zu machen.

**Widerruf über Tabs hinweg gibt es nicht.** `storage`-Ereignisse und
`BroadcastChannel` sind herkunftsgebunden. Entweder im Takt nachfragen oder —
empfohlen — den Satz „wird **sofort** beendet" in der Datenschutzerklärung auf
„spätestens beim nächsten Seitenaufruf oder Fensterwechsel" ändern.

**Erteilen wäre gemeinsam, Widerrufen nicht.** Wer auf einer Adresse widerruft,
wird auf der anderen weiter aufgezeichnet. Art. 7 Abs. 3 DSGVO verlangt, dass
der Widerruf so einfach ist wie die Erteilung. Das ist zu lösen, bevor der
Mechanismus scharf geht.

**Beide Bannertexte müssen den Geltungsbereich nennen.** Ohne das ist die
Einwilligung nicht informiert, und die ganze Konstruktion trägt nicht. Der Text
steht heute statisch in `public/index.html`; `applyBrandToHtml` kennt nur die
Marke, nicht den Host — die Signatur müsste den Host bekommen.

**Versionszähler hoch, alle werden neu gefragt.** Der Umfang der Einwilligung
ändert sich; wer früher zustimmte, tat das für eine Adresse.

---

## Was dabei entschieden werden muss

**PostHogs eigenes Cookie geht an alle Hosts der Zone** — `crm.`, `cloud.`,
`ticket.`, `wazuh.`, `pw.` und weitere. Das ist derselbe Mechanismus, der die
durchlaufende Sitzung ermöglicht.

Für die **Sitzung** ist das unvermeidlich. Für die **Einwilligung** nicht: Mit
`cross_subdomain_cookie: false` bliebe die Kennung hostgebunden, und nur das
eigene kleine Einwilligungs-Cookie wäre zonenweit — dann entfiele allerdings
die durchlaufende Sitzung. Beides zusammen geht nicht.

## Aufwand

**Acht bis elf Tage**, davon drei bis vier allein für die signierte Einwilligung
in zwei Repositories, die dann ein Drahtformat und ein Geheimnis im Gleichschritt
teilen.

Zum Vergleich: Der Umzug ohne diesen Teil war an einem Tag erledigt.
