"""Prüft das Inhaltsverzeichnis: Jede Seitenzahl muss der Seite entsprechen, auf der das Sprungziel steht.
Aufruf: python inhalt_pruefen.py <bericht.html> [...]"""
import sys
from html.parser import HTMLParser

class P(HTMLParser):
    def __init__(self):
        super().__init__(); self.seite = 0; self.ids = {}; self.toc = []; self.in_inh = 0; self.akt = None; self.feld = None; self.tiefe = 0
    def handle_starttag(self, tag, attrs):
        a = dict(attrs); kl = (a.get("class") or "").split()
        if tag == "section" and "page" in kl: self.seite += 1
        if "id" in a: self.ids.setdefault(a["id"], self.seite)
        if tag == "div" and "inh" in kl: self.in_inh = 1
        if self.in_inh and tag == "a": self.akt = {"ziel": a.get("href", "")[1:], "t": "", "s": "", "seite": self.seite}
        if self.akt is not None and tag == "span":
            if "inh-t" in kl: self.feld = "t"
            elif "inh-s" in kl: self.feld = "s"
    def handle_endtag(self, tag):
        if tag == "span": self.feld = None
        if tag == "a" and self.akt is not None: self.toc.append(self.akt); self.akt = None
        if tag == "section": self.in_inh = 0
    def handle_data(self, d):
        if self.akt is not None and self.feld: self.akt[self.feld] += d

for datei in sys.argv[1:]:
    p = P(); p.feed(open(datei).read())
    fehler = [f"{e['t'].strip()[:40]}: steht auf Seite {p.ids.get(e['ziel'])}, Inhalt sagt {e['s'].strip()}" for e in p.toc
              if str(p.ids.get(e["ziel"])) != e["s"].strip()]
    print(f"{datei.split('/')[-1]:45} {len(p.toc):2} Einträge, Seiten gesamt {p.seite}: " + ("alle Seitenzahlen stimmen" if not fehler else "FEHLER " + "; ".join(fehler)))
