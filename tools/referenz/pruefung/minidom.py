"""Kleiner HTML-Baum auf Basis von html.parser (nur Standardbibliothek)."""
from html.parser import HTMLParser

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}


class Node:
    def __init__(self, tag, attrs, parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []

    @property
    def cls(self):
        return (self.attrs.get("class") or "").split()

    def iter(self):
        yield self
        for c in self.children:
            if isinstance(c, Node):
                yield from c.iter()

    def text(self, sep=""):
        out = []
        for c in self.children:
            if isinstance(c, Node):
                if c.tag in ("style", "script"):
                    continue
                out.append(c.text(sep))
                if c.tag in ("br",):
                    out.append(" ")
            else:
                out.append(c)
        return sep.join(out)

    def find_all(self, pred):
        return [n for n in self.iter() if pred(n)]

    def has_cls(self, *names):
        return all(n in self.cls for n in names)


class Builder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("#root", [])
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur)
        self.cur.children.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.children.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not None and n.tag != tag:
            n = n.parent
        if n is not None and n.parent is not None:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.children.append(data)


def parse(html):
    b = Builder()
    b.feed(html)
    return b.root


def norm(s):
    return " ".join(s.split())
