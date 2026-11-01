// The security headers every response gets, and the one deliberate exception.

import { describe, expect, it } from "vitest";
import app from "../src/index.js";

const env = {
  BRAND: "reineke",
  ASSETS: {
    fetch: async (req: Request) =>
      new Response(new URL(req.url).pathname.endsWith(".png") ? "png" : "<!doctype html>", {
        headers: { "Content-Type": new URL(req.url).pathname.endsWith(".png") ? "image/png" : "text/html" },
      }),
  },
};

describe("Cross-Origin-Resource-Policy", () => {
  it("keeps pages same-origin", async () => {
    const res = await app.request("https://scan.reineke.tech/", {}, env);
    expect(res.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
  });

  // The PDF renderer loads these into a page without an origin of its own; with
  // "same-origin" Chrome blocked logo, portrait and QR code and no report was made.
  it("lets the report renderer load the images under /assets/", async () => {
    const res = await app.request("https://scan.reineke.tech/assets/logo.png", {}, env);
    expect(res.headers.get("Cross-Origin-Resource-Policy")).toBe("cross-origin");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
