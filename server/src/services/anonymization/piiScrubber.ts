/**
 * PII field scrubbing for research data exports.
 * Ensures personally identifiable information never appears in exported data.
 * DD-V2-190: Anonymization pipeline.
 */

/**
 * Canonical PII field names that must never appear in research exports.
 * Lowercase; the scrubber compares case-insensitively.
 */
const PII_FIELDS = new Set([
  'email',
  'password',
  'displayname',
  'name',
  'ip',
  'ipaddress',
  'deviceid',
  'devicefingerprint',
  'phonenumber',
  'realname',
  'birthdate',
])

/**
 * Recursively remove PII fields from an arbitrary object.
 * Works on plain objects and arrays; primitives are returned unchanged.
 * Does NOT mutate the input — returns a new deep copy.
 *
 * @param value - Any serializable value.
 * @returns Scrubbed deep copy with PII fields removed.
 */
export function scrubPii(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(scrubPii)
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (!PII_FIELDS.has(k.toLowerCase())) {
        result[k] = scrubPii(v)
      }
    }
    return result
  }
  return value
}
