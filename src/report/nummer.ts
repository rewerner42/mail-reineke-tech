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

/** `ir.sequence.code` of the counter. Created on first use if it is missing. */
const SEQUENZ_CODE = "reineke.bericht";

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
export function ersatzNummer(now: Date = new Date()): string {
  const zeit = [now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()]
    .map((x) => String(x).padStart(2, "0"))
    .join("");
  return `RT-DS-${datumsteil(now)}-T${zeit}`;
}

/**
 * Draws the next report number. Never throws: a report must not fail because a
 * counter was unreachable, so the caller gets the fallback instead.
 */
export async function berichtNummer(
  cfg: OdooConfig | null,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number; now?: Date } = {},
): Promise<{ nummer: string; aus: "odoo" | "ersatz" }> {
  const now = opts.now ?? new Date();
  if (!cfg) return { nummer: ersatzNummer(now), aus: "ersatz" };

  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000);
  try {
    const uid = await authUid(cfg, fetchImpl, controller.signal);
    if (!uid) return { nummer: ersatzNummer(now), aus: "ersatz" };
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
      [["code", "=", SEQUENZ_CODE]],
    ]);
    if (!vorhanden.length) {
      await exec("ir.sequence", "create", [
        {
          name: "Sicherheitsbefund — Bericht-Nr.",
          code: SEQUENZ_CODE,
          implementation: "standard",
          padding: 4,
          number_increment: 1,
          number_next: 1,
        },
      ]);
    }
    const laufend = await exec<string | false>("ir.sequence", "next_by_code", [SEQUENZ_CODE]);
    if (!laufend) return { nummer: ersatzNummer(now), aus: "ersatz" };
    return { nummer: `RT-DS-${datumsteil(now)}-${laufend}`, aus: "odoo" };
  } catch {
    return { nummer: ersatzNummer(now), aus: "ersatz" };
  } finally {
    clearTimeout(timer);
  }
}
