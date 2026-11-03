/**
 * DNS-over-HTTPS client using Cloudflare 1.1.1.1
 * Docs: https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/
 */

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

export type DnsRecordType =
  | "A"
  | "AAAA"
  | "MX"
  | "TXT"
  | "CNAME"
  | "NS"
  | "DNSKEY"
  | "DS";

export interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export interface DohResponse {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: Array<{ name: string; type: number }>;
  Answer?: DohAnswer[];
  Authority?: DohAnswer[];
  Comment?: string;
}

const TYPE_CODES: Record<DnsRecordType, number> = {
  A: 1,
  AAAA: 28,
  MX: 15,
  TXT: 16,
  CNAME: 5,
  NS: 2,
  DNSKEY: 48,
  DS: 43,
};

/** DNS RCODEs we act on. SERVFAIL is the one that must not look like "no record". */
const SERVFAIL = 2;

/**
 * Thrown when the resolver could not answer at all, as opposed to answering
 * "nothing published".
 *
 * Cloudflare's resolver validates DNSSEC, so a zone with a broken signature
 * answers SERVFAIL for every record type. Treating that as an empty answer would
 * make the report state "no SPF record published", "no DMARC record published"
 * and so on about a domain where nothing could be read at all — definite
 * statements about something that was never measured.
 *
 * analyzeDnssec deliberately does NOT go through these helpers: there a SERVFAIL
 * next to a DS record at the parent is the very signal it is looking for.
 */
export class DnsUnresolvable extends Error {
  constructor(name: string, type: DnsRecordType, status: number) {
    super(`DNS-Abfrage für ${name} ${type} nicht auflösbar (RCODE ${status})`);
    this.name = "DnsUnresolvable";
  }
}

/** Raises when the resolver failed; returns the response otherwise. */
function pruefeAufloesbar(res: DohResponse, name: string, type: DnsRecordType): DohResponse {
  if (res.Status === SERVFAIL) throw new DnsUnresolvable(name, type, res.Status);
  return res;
}

export async function dohQuery(
  name: string,
  type: DnsRecordType,
  timeoutMs = 4000,
): Promise<DohResponse> {
  const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(name)}&type=${type}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // NOTE: do NOT use `cf: { cacheEverything: true }` here. cloudflare-dns.com
    // varies its body on the Accept header (JSON vs binary dns-message), but
    // Cloudflare's edge cache keys only on the URL — so a cached non-JSON
    // response poisons subsequent application/dns-json reads and Answer comes
    // back empty (observed: MX hosts resolving to "keine IPs" in production
    // while working locally). DoH is fast; skip the edge cache.
    const res = await fetch(url, {
      headers: { Accept: "application/dns-json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`DoH HTTP ${res.status} for ${name} ${type}`);
    }
    return (await res.json()) as DohResponse;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Get TXT records and reassemble multi-string TXT records.
 * DoH JSON puts each TXT string in quotes; long records are split.
 */
export async function queryTxt(name: string): Promise<string[]> {
  const res = pruefeAufloesbar(await dohQuery(name, "TXT"), name, "TXT");
  if (res.Status !== 0 || !res.Answer) return [];
  return res.Answer
    .filter((a) => a.type === TYPE_CODES.TXT)
    .map((a) => parseTxtData(a.data));
}

/**
 * DoH returns TXT data like: "v=spf1 ..." or for multi-string: "\"part1\" \"part2\"".
 * Strip outer quotes and concatenate adjacent quoted strings (no separator).
 */
export function parseTxtData(data: string): string {
  const parts: string[] = [];
  let i = 0;
  while (i < data.length) {
    if (data[i] === '"') {
      let j = i + 1;
      let buf = "";
      while (j < data.length && data[j] !== '"') {
        if (data[j] === "\\" && j + 1 < data.length) {
          buf += data[j + 1];
          j += 2;
        } else {
          buf += data[j];
          j++;
        }
      }
      parts.push(buf);
      i = j + 1;
    } else {
      i++;
    }
  }
  return parts.length > 0 ? parts.join("") : data;
}

export async function queryMx(
  name: string,
): Promise<Array<{ preference: number; exchange: string }>> {
  const res = pruefeAufloesbar(await dohQuery(name, "MX"), name, "MX");
  if (res.Status !== 0 || !res.Answer) return [];
  return res.Answer
    .filter((a) => a.type === TYPE_CODES.MX)
    .map((a) => {
      const [pref, exchange] = a.data.split(/\s+/, 2);
      return {
        preference: Number(pref ?? 0),
        exchange: (exchange ?? "").replace(/\.$/, ""),
      };
    });
}

// queryA/queryAaaa deliberately keep the old behaviour: a mail server whose own
// address cannot be resolved really is undeliverable, so "no address" is the
// right finding there, not "not assessable".
export async function queryA(name: string): Promise<string[]> {
  const res = await dohQuery(name, "A");
  if (res.Status !== 0 || !res.Answer) return [];
  return res.Answer.filter((a) => a.type === TYPE_CODES.A).map((a) => a.data);
}

export async function queryAaaa(name: string): Promise<string[]> {
  const res = await dohQuery(name, "AAAA");
  if (res.Status !== 0 || !res.Answer) return [];
  return res.Answer.filter((a) => a.type === TYPE_CODES.AAAA).map((a) => a.data);
}
