export interface Thresholds {
  /** Response times above this many milliseconds raise a HIGH_LATENCY warning. */
  latencyWarningMs: number;
  /** Response times above this many milliseconds raise a critical HIGH_LATENCY issue. */
  latencyCriticalMs: number;
  /** Whether returning 0 records is suspicious (EMPTY_DATA). */
  expectRecords: boolean;
}

export const DEFAULT_THRESHOLDS: Readonly<Thresholds> = {
  latencyWarningMs: 2000,
  latencyCriticalMs: 5000,
  expectRecords: true,
};

/** Per-API rules, merged over the defaults. Keyed by api_name. */
const API_OVERRIDES = new Map<string, Partial<Thresholds>>([
  // Clinicians wait on patient lookups, so slowness matters sooner.
  ['PatientDataAPI', { latencyWarningMs: 1500, latencyCriticalMs: 3000 }],
  // A health check returns no records by design.
  ['HealthCheckAPI', { expectRecords: false }],
]);

export function thresholdsFor(apiName: string): Thresholds {
  return { ...DEFAULT_THRESHOLDS, ...API_OVERRIDES.get(apiName) };
}
