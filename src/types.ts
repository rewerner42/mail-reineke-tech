export type Severity = "pass" | "warn" | "fail" | "info";

export interface CheckIssue {
  severity: Severity;
  code: string;
  message: string;
  recommendation?: string;
}

export interface CheckResult<T = unknown> {
  status: Severity;
  summary: string;
  issues: CheckIssue[];
  data: T;
}

export interface MxRecord {
  preference: number;
  exchange: string;
  ips?: { a: string[]; aaaa: string[] };
}

export interface DmarcRecord {
  raw: string;
  version: string;
  p?: string;
  sp?: string;
  pct?: number;
  rua?: string[];
  ruf?: string[];
  adkim?: string;
  aspf?: string;
  fo?: string[];
  rf?: string;
  ri?: number;
}

export interface SpfRecord {
  raw: string;
  mechanisms: SpfMechanism[];
  all?: SpfQualifier;
  dnsLookupCount: number;
}

export type SpfQualifier = "+" | "-" | "~" | "?";

export interface SpfMechanism {
  qualifier: SpfQualifier;
  type: string;
  value?: string;
  raw: string;
  causesLookup: boolean;
}

export interface DkimRecord {
  selector: string;
  raw: string;
  v?: string;
  k?: string;
  p?: string;
  t?: string[];
  h?: string[];
  s?: string[];
  keySize?: number;
}

export interface MtaStsRecord {
  dnsTxt: string | null;
  id?: string;
  policyFetched: boolean;
  policyVersion?: string;
  mode?: "none" | "testing" | "enforce";
  maxAge?: number;
  mx?: string[];
}

export interface TlsRptRecord {
  raw: string | null;
  version?: string;
  rua: string[];
}

export interface DnssecResult {
  /** Chain of trust is intact and the resolver validated the answer. */
  secure: boolean;
  /** AD (Authenticated Data) flag from the validating resolver. */
  authenticated: boolean;
  /** Number of DNSKEY records published by the zone. */
  dnskeyCount: number;
  /** Parent zone publishes a DS record (delegation is signed). */
  dsPresent: boolean;
  /** Parent says signed (DS) but validation fails (SERVFAIL / no AD) → broken. */
  validationFailed: boolean;
}

export interface ObservatoryTest {
  name: string;
  title: string;
  pass: boolean | null;
  scoreModifier: number;
  reason: string;
  recommendation: string;
  link: string | null;
}

export interface ObservatoryResult {
  grade: string | null;
  score: number | null;
  testsPassed: number | null;
  testsFailed: number | null;
  testsQuantity: number | null;
  scannedAt: string | null;
  detailsUrl: string | null;
  tests: ObservatoryTest[];
}

export interface AnalysisResponse {
  domain: string;
  queriedAt: string;
  dmarc: CheckResult<DmarcRecord | null>;
  spf: CheckResult<SpfRecord | null>;
  dkim: CheckResult<DkimRecord[]>;
  mx: CheckResult<MxRecord[]>;
  mtaSts: CheckResult<MtaStsRecord>;
  tlsRpt: CheckResult<TlsRptRecord>;
  dnssec: CheckResult<DnssecResult>;
}
