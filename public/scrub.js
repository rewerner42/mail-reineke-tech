/* Entfernt die geprüfte Domain aus URLs, bevor sie PostHog erreichen.
 *
 * Eigene Datei, damit es testbar ist: app.js läuft nur im Browser, und die
 * vorige Fassung dieser Funktion war unter dem falschen PostHog-Schlüssel
 * verdrahtet (maskNetworkRequestFn statt maskCapturedNetworkRequestFn) und
 * damit wirkungslos — ohne dass ein Test das gemerkt hätte.
 *
 * Der Query trägt auf scan.reineke.tech die Domain der geprüften Organisation.
 * Die gehört weder in Ereignisse noch in die URL-Zeile des Replay-Players.
 */
export const SCRUB_PARAMS = ["d", "s", "domain", "selectors", "host"];

export function scrubUrl(value) {
  if (typeof value !== "string" || value.indexOf("?") === -1) return value;
  try {
    const u = new URL(value, "https://scan.reineke.tech");
    let touched = false;
    for (const k of SCRUB_PARAMS) {
      if (u.searchParams.has(k)) {
        u.searchParams.set(k, "maskiert");
        touched = true;
      }
    }
    if (!touched) return value;
    // Relative Eingaben bleiben relativ.
    return /^https?:/i.test(value) ? u.toString() : u.pathname + u.search + u.hash;
  } catch {
    return value;
  }
}

/** Bereinigt die Eigenschaften eines PostHog-Ereignisses. */
export const URL_PROPS = [
  "$current_url", "$pathname", "$session_entry_url", "$session_entry_pathname",
  "$referrer", "$session_referrer",
];

export function scrubEvent(event) {
  if (!event || !event.properties) return event;
  const props = event.properties;
  for (const k of URL_PROPS) if (props[k]) props[k] = scrubUrl(props[k]);
  // $set_once traegt die Einstiegs-URL noch einmal separat.
  if (props.$set_once) {
    for (const k of Object.keys(props.$set_once)) {
      if (/url$/i.test(k)) props.$set_once[k] = scrubUrl(props.$set_once[k]);
    }
  }
  // Die URL-Zeile des Replay-Players kommt NICHT aus den Properties, sondern
  // aus rrwebs Meta-Ereignis (type 4) in $snapshot_data. before_send sieht
  // auch $snapshot-Ereignisse -- also hier mitnehmen, sonst steht die
  // gepruefte Domain oben im Player.
  if (Array.isArray(props.$snapshot_data)) {
    for (const e of props.$snapshot_data) {
      if (e && e.data && typeof e.data.href === "string") e.data.href = scrubUrl(e.data.href);
    }
  }
  // Autocapture hängt Attribute in $elements bzw. $elements_chain, nicht oben.
  if (Array.isArray(props.$elements)) {
    for (const el of props.$elements) {
      if (el && typeof el.attr__href === "string") el.attr__href = scrubUrl(el.attr__href);
    }
  }
  if (typeof props.$elements_chain === "string") {
    props.$elements_chain = props.$elements_chain.replace(
      /href="([^"]*)"/g,
      (_m, u) => 'href="' + scrubUrl(u) + '"',
    );
  }
  return event;
}
