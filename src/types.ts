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

export interface AnalysisResponse {
  domain: string;
  queriedAt: string;
  dmarc: CheckResult<DmarcRecord | null>;
  spf: CheckResult<SpfRecord | null>;
  dkim: CheckResult<DkimRecord[]>;
  mx: CheckResult<MxRecord[]>;
}
