// The report number: one running counter, kept in Odoo.
//
// Until now every report of a given day carried the same number
// RT-DS-JJJJMMTT-01 (B16), so two reports could not be told apart — including in
// Odoo, where the number is what records that a recipient agreed to receive one.
//
// The counter lives in Odoo's own `ir.sequence`, which is transactional, so two
// requests at the same moment cannot draw the same number. The date stays in the
// number because it is what a reader looks for.

import { authUid, jsonRpc, type OdooConfig } from "../leads/odoo.js";

/**
 * Ein Nummernkreis: Kürzel vor dem Datum und der Odoo-Zähler dahinter. Jede
 * Marke mit eigener Berichtsfassung zählt für sich (Sharp: SH-DS, eigener
 * Zähler — Werner, 01.11.2026).
 */
export interface Nummernkreis {
  /** Steht vor dem Datum, z. B. "RT-DS". */
  kuerzel: string;
  /** `ir.sequence.code` des Zählers. Fehlt er, wird er beim ersten Gebrauch angelegt. */
  code: string;
  /** Name, unter dem der Zähler in Odoo angelegt wird. */
  name: string;
}

/** Der Nummernkreis von Reineke Technik, wie er seit v15 besteht. */
export const REINEKE_KREIS: Nummernkreis = {
  kuerzel: "RT-DS",
  code: "reineke.bericht",
  name: "Sicherheitsbefund — Bericht-Nr.",
};

function datumsteil(now: Date): string {
  return [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
}

/**
 * A number that is unique without a counter, for when Odoo cannot be reached.
 * Carries the time to the second, so two reports collide only if they are drawn
 * in the same second. Marked with `T` so it is recognisable as the fallback.
 */
export function ersatzNummer(now: Date = new Date(), kuerzel = REINEKE_KREIS.kuerzel): string {
  const zeit = [now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()]
    .map((x) => String(x).padStart(2, "0"))
    .join("");
  return `${kuerzel}-${datumsteil(now)}-T${zeit}`;
}

/**
 * Draws the next report number. Never throws: a report must not fail because a
 * counter was unreachable, so the caller gets the fallback instead.
 */
export async function berichtNummer(
  cfg: OdooConfig | null,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number; now?: Date; kreis?: Nummernkreis } = {},
): Promise<{ nummer: string; aus: "odoo" | "ersatz" }> {
  const now = opts.now ?? new Date();
  const kreis = opts.kreis ?? REINEKE_KREIS;
  const ersatz = () => ({ nummer: ersatzNummer(now, kreis.kuerzel), aus: "ersatz" as const });
  if (!cfg) return ersatz();

  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  try {
    const uid = await authUid(cfg, fetchImpl, controller.signal);
    if (!uid) return ersatz();
    const exec = <T>(model: string, method: string, args: unknown[]) =>
      jsonRpc<T>(
        cfg.url,
        "object",
        "execute_kw",
        [cfg.db, uid, cfg.apiKey, model, method, args],
        fetchImpl,
        controller.signal,
      );

    const vorhanden = await exec<number[]>("ir.sequence", "search", [
      [["code", "=", kreis.code]],
    ]);
    if (!vorhanden.length) {
      await exec("ir.sequence", "create", [
        {
          name: kreis.name,
          code: kreis.code,
          implementation: "standard",
          padding: 4,
          number_increment: 1,
          number_next: 1,
        },
      ]);
    }
    const laufend = await exec<string | false>("ir.sequence", "next_by_code", [kreis.code]);
    if (!laufend) return ersatz();
    return { nummer: `${kreis.kuerzel}-${datumsteil(now)}-${laufend}`, aus: "odoo" };
  } catch {
    return ersatz();
  } finally {
    clearTimeout(timer);
  }
}
