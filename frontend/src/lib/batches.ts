// Batches for the "Run a check" panel. The sample files are shared with the backend's CLI,
// imported as raw text so they appear exactly as written.
import recoveryBatch from '../../../sample-data/recovery-batch.json?raw'
import sampleBatch from '../../../sample-data/sample-batch.json?raw'

export const SAMPLE_BATCH = sampleBatch
export const RECOVERY_BATCH = recoveryBatch

const API_NAMES = [
  'PatientDataAPI',
  'AppointmentAPI',
  'BillingAPI',
  'InventoryAPI',
  'LabResultsAPI',
  'PrescriptionAPI',
  'InsuranceAPI',
  'AuthAPI',
  'DoctorScheduleAPI',
  'ReferralAPI',
  'ImagingAPI',
  'HealthCheckAPI',
  'PharmacyAPI',
  'VitalsAPI',
  'ClaimsAPI',
  'TelehealthAPI',
]

type ApiResult = Record<string, string | number>

/** Random API results, mostly healthy, with every kind of anomaly mixed in. Formatted like the sample files. */
export function randomBatch(size = 50): string {
  const items = Array.from({ length: size }, randomResult)
  return `[\n${items.map((item) => `  ${formatItem(item)}`).join(',\n')}\n]\n`
}

function randomResult(): ApiResult {
  const api_name = pick(API_NAMES)
  const response_time_ms = between(80, 1400)
  const records_returned = between(1, 250)
  const roll = Math.random()

  if (roll < 0.6) return { api_name, response_time_ms, status_code: 200, records_returned }
  if (roll < 0.68) return { api_name, response_time_ms: between(2100, 4900), status_code: 200, records_returned }
  if (roll < 0.73) return { api_name, response_time_ms: between(5100, 9000), status_code: 200, records_returned }
  if (roll < 0.8) return { api_name, response_time_ms, status_code: pick([500, 502, 503, 504]), records_returned: 0 }
  if (roll < 0.86) return { api_name, response_time_ms, status_code: pick([400, 401, 403, 404, 429]), records_returned: 0 }
  if (roll < 0.89) return { api_name, response_time_ms, status_code: pick([301, 302]), records_returned: 0 }
  if (roll < 0.94) return { api_name, response_time_ms, status_code: 200, records_returned: 0 }
  if (roll < 0.97) return { api_name, response_time_ms, status_code: 200 }
  return { api_name, response_time_ms: 'timeout', status_code: 200, records_returned }
}

function formatItem(item: ApiResult): string {
  const fields = Object.entries(item).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`)
  return `{ ${fields.join(', ')} }`
}

function pick<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)] as T
}

function between(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min))
}
