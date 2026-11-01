// The traps in porting the generator from Python/Jinja2 to TypeScript.
//
// Each of these is a place where the two languages agree on syntax and disagree
// on meaning, so a faithful-looking port is wrong and nothing errors. Commit
// f2f8f24 proved the port reproduced all eleven reference view models field for
// field; these tests keep the individual mechanics from drifting back.

import { describe, expect, it } from "vitest";
import { datumText, fill, minus, truthy } from "../src/report/viewmodel.js";

describe("fill", () => {
  it("replaces every occurrence, not just the first", () => {
    // Python's str.replace and re.sub replace all; JS's String.replace(str, str)
    // replaces one. A finding that names the domain twice would keep a raw
    // {domain} in the second half.
    expect(fill("{domain} und noch einmal {domain}", { domain: "beispiel.de" })).toBe(
      "beispiel.de und noch einmal beispiel.de",
    );
  });

  it("leaves unknown placeholders standing so the coverage test can catch them", () => {
    expect(fill("Wert: {unbekannt}", { domain: "x" })).toBe("Wert: {unbekannt}");
  });

  it("leaves a placeholder standing when the value is null or undefined", () => {
    expect(fill("{a}/{b}", { a: null, b: undefined })).toBe("{a}/{b}");
  });

  it("renders 0 and false rather than dropping them", () => {
    expect(fill("{passed} von {total}", { passed: 0, total: 12 })).toBe("0 von 12");
  });

  it("passes non-strings through untouched", () => {
    const liste = ["a", "b"];
    expect(fill(liste, {})).toBe(liste);
  });
});

describe("minus", () => {
  it("replaces every hyphen with a typographic minus", () => {
    expect(minus(-50)).toBe("−50");
  });

  it("returns an empty string for null and undefined, not the word", () => {
    expect(minus(null)).toBe("");
    expect(minus(undefined)).toBe("");
  });

  it("keeps 0 as a number", () => {
    expect(minus(0)).toBe("0");
  });
});

describe("truthy", () => {
  it("treats an empty array as false, as Python does", () => {
    // The single most dangerous difference: in Jinja2 `{% if liste %}` is false
    // for [], in JavaScript `if (liste)` is true. One of the affected sites
    // decides the report's total page count.
    expect(truthy([])).toBe(false);
    expect(truthy(["x"])).toBe(true);
  });

  it("treats an empty object as false", () => {
    expect(truthy({})).toBe(false);
    expect(truthy({ a: 1 })).toBe(true);
  });

  it("treats empty string and zero as false", () => {
    expect(truthy("")).toBe(false);
    expect(truthy(0)).toBe(false);
    expect(truthy("0")).toBe(true);
  });

  it("treats null and undefined as false", () => {
    expect(truthy(null)).toBe(false);
    expect(truthy(undefined)).toBe(false);
  });
});

describe("datumText", () => {
  it("writes the German long form without a leading zero", () => {
    expect(datumText("2026-10-22")).toBe("22. Oktober 2026");
    expect(datumText("2026-01-05")).toBe("5. Januar 2026");
  });

  it("refuses a date it cannot read instead of rendering undefined", () => {
    expect(() => datumText("kein-datum")).toThrow();
    expect(() => datumText("2026-13-01")).toThrow();
  });
});
