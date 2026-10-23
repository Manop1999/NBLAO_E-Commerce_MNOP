/**
 * Built-in RFC 4180 CSV reader (no dependencies). Foundation only: no module, endpoint or job uses it yet.
 *
 * Escaping policy (import side):
 * - Cell values are never evaluated; text is kept exactly as written.
 * - Exactly one leading apostrophe is removed when the value is one or more apostrophes followed by
 *   = + - @ TAB or CR. That apostrophe is the protective prefix our own exporter adds (see write.ts), so exported
 *   values round-trip unchanged, including values that themselves start with an apostrophe.
 *
 * Input rules:
 * - Must be valid UTF-8 ("CSV UTF-8" in Excel); leading BOMs (including a duplicated one) are removed.
 * - NUL characters are rejected (PostgreSQL text cannot store them).
 * - Fields are comma-separated. A file whose header has semicolons but no commas (outside quotes), and whose
 *   data rows have the same number of semicolons, is rejected as semicolon-separated with guidance.
 * - Quoted fields may contain commas, CR/LF and doubled quotes (""). CRLF, LF and lone CR end a record.
 * - One trailing line break at the end of the file is ignored; empty fields are kept as "".
 */

export type CsvErrorCode =
  | 'invalid_utf8'
  | 'empty_file'
  | 'nul_character'
  | 'semicolon_delimited'
  | 'unterminated_quote'
  | 'unexpected_quote'
  | 'too_large'
  | 'too_many_rows'

export class CsvError extends Error {
  readonly code: CsvErrorCode
  /** 1-based physical line where the problem was detected, when known. */
  readonly line: number | undefined

  constructor(code: CsvErrorCode, message: string, line?: number) {
    super(message)
    this.name = 'CsvError'
    this.code = code
    this.line = line
  }
}

export interface CsvParseOptions {
  /** Reject files larger than this many bytes. No default: limits are business decision X5. */
  maxBytes?: number
  /** Reject files with more data records than this (header excluded). No default (X5). */
  maxRows?: number
  /** Remove one protective apostrophe placed before = + - @ TAB CR. Defaults to true. */
  stripProtectiveApostrophes?: boolean
}

export interface CsvParseResult {
  records: string[][]
  hadBom: boolean
}

const BYTE_ORDER_MARK = 0xfeff
const NUL = String.fromCharCode(0)
/** Data records inspected (after the header) when deciding whether a file is semicolon-separated. */
const SEPARATOR_SAMPLE_RECORDS = 5

/** Characters that make spreadsheet software treat a cell as a formula. Shared with write.ts. */
export const FORMULA_TRIGGERS: ReadonlySet<string> = new Set(['=', '+', '-', '@', '\t', '\r'])

/** True when `text` is zero or more apostrophes followed by a formula trigger (e.g. "=1", "'=1", "''@a"). */
export function startsWithGuardedFormula(text: string): boolean {
  let i = 0
  while (text[i] === "'") i += 1
  return i < text.length && FORMULA_TRIGGERS.has(text[i] as string)
}

/**
 * Remove the one protective apostrophe the exporter adds: "'=SUM(A1)" -> "=SUM(A1)", "''=1" -> "'=1".
 * Values without a leading apostrophe, or whose apostrophes are not followed by a trigger ("'hello"), are unchanged.
 */
export function stripProtectiveApostrophe(value: string): string {
  return value.startsWith("'") && startsWithGuardedFormula(value) ? value.slice(1) : value
}

export function decodeUtf8(bytes: Uint8Array): { text: string; hadBom: boolean } {
  const hadBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  try {
    // ignoreBOM: false -> the decoder removes a leading BOM itself.
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)
    return { text, hadBom }
  } catch {
    throw new CsvError('invalid_utf8', 'The file is not valid UTF-8. In Excel use "Save As" > "CSV UTF-8 (Comma delimited)".')
  }
}

/** Parse already-decoded CSV text into records. */
export function parseCsvText(text: string): string[][] {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let inQuotes = false
  let fieldStarted = false // the current field has content or was opened with a quote
  let line = 1
  let quoteOpenedOnLine = 1
  let i = 0

  const endField = () => {
    record.push(field)
    field = ''
    fieldStarted = false
  }
  const endRecord = () => {
    endField()
    records.push(record)
    record = []
  }

  while (i < text.length) {
    const ch = text[i] as string

    if (ch === NUL) {
      throw new CsvError('nul_character', `The file contains a NUL character on line ${line}. Remove it and save again.`, line)
    }

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        const next = text[i]
        if (next !== undefined && next !== ',' && next !== '\r' && next !== '\n') {
          throw new CsvError('unexpected_quote', `Unexpected text after a closing quote on line ${line}.`, line)
        }
        continue
      }
      if (ch === '\n' || (ch === '\r' && text[i + 1] !== '\n')) line += 1
      field += ch
      i += 1
      continue
    }

    if (ch === '"') {
      if (fieldStarted) throw new CsvError('unexpected_quote', `A quote appears inside an unquoted field on line ${line}.`, line)
      inQuotes = true
      fieldStarted = true
      quoteOpenedOnLine = line
      i += 1
      continue
    }
    if (ch === ',') {
      endField()
      i += 1
      continue
    }
    if (ch === '\r' || ch === '\n') {
      endRecord()
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1
      line += 1
      continue
    }
    field += ch
    fieldStarted = true
    i += 1
  }

  if (inQuotes) {
    throw new CsvError('unterminated_quote', `A quoted field starting on line ${quoteOpenedOnLine} is never closed.`, quoteOpenedOnLine)
  }
  // Keep the last record unless the text ended with a line break (nothing pending).
  if (fieldStarted || record.length > 0) endRecord()
  return records
}

/**
 * True when the file looks semicolon-separated: outside quotes, the header has at least one `;` and no `,`,
 * and every non-blank data record among the first few has the same number of `;`. Commas inside data rows are
 * ignored (they are decimal commas in many locales). A header-only file, or a one-column file whose header
 * happens to contain `;` but whose rows do not, is NOT treated as semicolon-separated.
 */
export function looksSemicolonDelimited(text: string): boolean {
  const records: { commas: number; semicolons: number }[] = []
  let commas = 0
  let semicolons = 0
  let chars = 0
  let inQuotes = false
  const endRecord = () => {
    if (chars > 0) records.push({ commas, semicolons })
    commas = 0
    semicolons = 0
    chars = 0
  }

  for (let i = 0; i < text.length && records.length <= SEPARATOR_SAMPLE_RECORDS; i += 1) {
    const ch = text[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      chars += 1
      continue
    }
    if (!inQuotes && (ch === '\r' || ch === '\n')) {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      endRecord()
      continue
    }
    chars += 1
    if (!inQuotes && ch === ',') commas += 1
    if (!inQuotes && ch === ';') semicolons += 1
  }
  endRecord()

  const [header, ...rows] = records
  if (!header || header.commas > 0 || header.semicolons === 0 || rows.length === 0) return false
  return rows.every(row => row.semicolons === header.semicolons)
}

/** Decode, validate and parse an uploaded CSV file. The first record is the header. */
export function parseCsvBytes(bytes: Uint8Array, options: CsvParseOptions = {}): CsvParseResult {
  if (options.maxBytes !== undefined && bytes.length > options.maxBytes) {
    throw new CsvError('too_large', `The file is larger than the ${options.maxBytes}-byte limit.`)
  }
  const decoded = decodeUtf8(bytes)
  let text = decoded.text
  // The decoder removes one BOM; a file saved with a duplicated BOM would otherwise keep the second one
  // glued to the first header name.
  while (text.charCodeAt(0) === BYTE_ORDER_MARK) text = text.slice(1)
  const hadBom = decoded.hadBom

  if (text.trim() === '') throw new CsvError('empty_file', 'The file is empty.')
  if (looksSemicolonDelimited(text)) {
    throw new CsvError(
      'semicolon_delimited',
      'The file uses semicolons as separators. In Excel use "Save As" > "CSV UTF-8 (Comma delimited)".',
      1,
    )
  }

  let records = parseCsvText(text)
  if (options.maxRows !== undefined && records.length - 1 > options.maxRows) {
    throw new CsvError('too_many_rows', `The file has more than the ${options.maxRows}-row limit.`)
  }
  if (options.stripProtectiveApostrophes !== false) {
    records = records.map(r => r.map(stripProtectiveApostrophe))
  }
  return { records, hadBom }
}
