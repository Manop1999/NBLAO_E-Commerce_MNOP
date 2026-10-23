/**
 * CSV writer with spreadsheet formula-injection protection (no dependencies). Foundation only: no module,
 * endpoint or job uses it yet.
 *
 * Escaping policy (export side), following the OWASP CSV-injection guidance:
 * - Text that starts with = + - @ TAB or CR (optionally after leading apostrophes) gets one more leading
 *   apostrophe, so Excel/LibreOffice show it as text instead of running it as a formula. parse.ts removes
 *   exactly that apostrophe again on import, so values round-trip unchanged.
 * - Numbers and booleans are written as plain values without the prefix (a negative number stays -5).
 * - Fields containing a comma, a double quote, CR or LF are wrapped in double quotes; quotes are doubled.
 * - null/undefined become an empty field.
 * - Documents use CRLF line endings and, by default, a UTF-8 BOM so Excel opens Lao/Thai text correctly.
 */
import { startsWithGuardedFormula } from './parse'

export type CsvValue = string | number | boolean | null | undefined

/** Prefix a protective apostrophe when text would be (or, after import stripping, would become) a formula. */
export function escapeFormula(text: string): string {
  return startsWithGuardedFormula(text) ? `'${text}` : text
}

function quoteIfNeeded(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsvField(value: CsvValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new RangeError(`Cannot write a non-finite number to CSV: ${value}`)
    return String(value)
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return quoteIfNeeded(escapeFormula(value))
}

export function toCsvRow(values: readonly CsvValue[]): string {
  return values.map(toCsvField).join(',')
}

export interface CsvDocumentOptions {
  /** Prepend a UTF-8 byte-order mark. Defaults to true (Excel needs it to read UTF-8 correctly). */
  bom?: boolean
}

/** Rows joined with CRLF and ending with CRLF; the first row is normally the header. */
export function toCsvDocument(rows: readonly (readonly CsvValue[])[], options: CsvDocumentOptions = {}): string {
  const body = rows.map(toCsvRow).join('\r\n') + (rows.length > 0 ? '\r\n' : '')
  return (options.bom === false ? '' : '\uFEFF') + body
}
