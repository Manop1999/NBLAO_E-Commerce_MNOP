import { describe, expect, it } from 'vitest'
import { CsvError, parseCsvBytes, parseCsvText, stripProtectiveApostrophe } from '../../src/csv/parse'

const utf8 = (text: string) => new TextEncoder().encode(text)
const withBom = (text: string) => new Uint8Array([0xef, 0xbb, 0xbf, ...utf8(text)])

const csvError = (fn: () => unknown): CsvError => {
  try {
    fn()
  } catch (error) {
    if (error instanceof CsvError) return error
    throw error
  }
  throw new Error('expected a CsvError')
}

describe('parseCsvText: valid CSV', () => {
  it('parses a simple header and rows', () => {
    expect(parseCsvText('sku,name,qty\nA1,Pump,2\nA2,Valve,10\n')).toEqual([
      ['sku', 'name', 'qty'],
      ['A1', 'Pump', '2'],
      ['A2', 'Valve', '10'],
    ])
  })

  it('handles quoted fields, commas inside fields and escaped double quotes', () => {
    expect(parseCsvText('sku,description\nA1,"Pump, 3-phase"\nA2,"He said ""fast"""\nA3,""""\n')).toEqual([
      ['sku', 'description'],
      ['A1', 'Pump, 3-phase'],
      ['A2', 'He said "fast"'],
      ['A3', '"'],
    ])
  })

  it('accepts CRLF, LF and lone CR line endings, and line breaks inside quotes', () => {
    expect(parseCsvText('a,b\r\n1,2\n3,4\r5,6')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
      ['5', '6'],
    ])
    expect(parseCsvText('note\r\n"line one\r\nline two"\r\n"cr\ronly"\r\n')).toEqual([['note'], ['line one\r\nline two'], ['cr\ronly']])
  })

  it('keeps empty values', () => {
    expect(parseCsvText('a,b,c\n1,,3\n,,\n"",x,""\n4,5,\n')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
      ['', '', ''],
      ['', 'x', ''],
      ['4', '5', ''],
    ])
  })

  it('keeps a final record without a trailing line break and ignores one trailing line break', () => {
    expect(parseCsvText('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(parseCsvText('a,b\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('keeps spaces and does not evaluate formula-like text', () => {
    expect(parseCsvText(' a , b \n=1+2,@SUM(A1)\n')).toEqual([
      [' a ', ' b '],
      ['=1+2', '@SUM(A1)'],
    ])
  })
})

describe('parseCsvText: malformed input', () => {
  it('reports an unterminated quoted field with the line where it starts', () => {
    const error = csvError(() => parseCsvText('sku,name\nA1,"open\nstill open'))
    expect(error.code).toBe('unterminated_quote')
    expect(error.line).toBe(2)
  })

  it('rejects a quote inside an unquoted field', () => {
    const error = csvError(() => parseCsvText('sku,name\nA1,ab"c\n'))
    expect(error.code).toBe('unexpected_quote')
    expect(error.line).toBe(2)
  })

  it('rejects text after a closing quote', () => {
    expect(csvError(() => parseCsvText('sku,name\nA1,"ab"c\n')).code).toBe('unexpected_quote')
  })

  it('rejects NUL characters with a typed error and line number, inside or outside quotes', () => {
    const nul = String.fromCharCode(0)
    const unquoted = csvError(() => parseCsvText(`sku,name\nA1,Pu${nul}mp\n`))
    expect(unquoted.code).toBe('nul_character')
    expect(unquoted.line).toBe(2)
    expect(unquoted.message).toContain('NUL character on line 2')
    const quoted = csvError(() => parseCsvText(`sku,name\nA1,"line one\nline${nul}two"\n`))
    expect(quoted.code).toBe('nul_character')
    expect(quoted.line).toBe(3)
    expect(csvError(() => parseCsvBytes(new Uint8Array([0x61, 0x0a, 0x62, 0x00, 0x63, 0x0a]))).code).toBe('nul_character')
  })
})

describe('parseCsvBytes: encoding and file checks', () => {
  it('keeps Lao, Thai and English text intact', () => {
    const { records } = parseCsvBytes(utf8('sku,name_en,name_lo,name_th\r\nTRF-001,Transformer,ໝໍ້ແປງໄຟ,หม้อแปลงไฟฟ้า\r\n'))
    expect(records).toEqual([
      ['sku', 'name_en', 'name_lo', 'name_th'],
      ['TRF-001', 'Transformer', 'ໝໍ້ແປງໄຟ', 'หม้อแปลงไฟฟ้า'],
    ])
  })

  it('accepts and removes a UTF-8 BOM', () => {
    const withMark = parseCsvBytes(withBom('sku\nA1\n'))
    expect(withMark.hadBom).toBe(true)
    expect(withMark.records).toEqual([['sku'], ['A1']])
    expect(parseCsvBytes(utf8('sku\nA1\n')).hadBom).toBe(false)
  })

  it('rejects bytes that are not valid UTF-8', () => {
    const windows1252 = new Uint8Array([0x73, 0x6b, 0x75, 0x0a, 0x93, 0x41, 0x94]) // smart quotes
    const tis620Thai = new Uint8Array([0xca, 0xc7, 0xd1, 0xca, 0xb4, 0xd5]) // "สวัสดี" in TIS-620
    const truncated = new Uint8Array([0x61, 0xe0, 0xba]) // cut-off 3-byte sequence
    for (const bytes of [windows1252, tis620Thai, truncated]) {
      expect(csvError(() => parseCsvBytes(bytes)).code).toBe('invalid_utf8')
    }
  })

  it('rejects empty and whitespace-only files', () => {
    expect(csvError(() => parseCsvBytes(utf8(''))).code).toBe('empty_file')
    expect(csvError(() => parseCsvBytes(withBom(''))).code).toBe('empty_file')
    expect(csvError(() => parseCsvBytes(utf8(' \r\n\n'))).code).toBe('empty_file')
  })

  it('rejects semicolon-separated files but allows semicolons inside comma-separated fields', () => {
    const error = csvError(() => parseCsvBytes(utf8('sku;name\nA1;Pump\n')))
    expect(error.code).toBe('semicolon_delimited')
    expect(error.message).toContain('CSV UTF-8 (Comma delimited)')
    expect(parseCsvBytes(utf8('sku,note\nA1,a;b\n')).records[1]).toEqual(['A1', 'a;b'])
  })

  it('gives the semicolon guidance for quoted semicolon-separated files', () => {
    const error = csvError(() => parseCsvBytes(utf8('"sku";"name"\r\n"A1";"Pump, 3-phase"\r\n')))
    expect(error.code).toBe('semicolon_delimited')
    expect(error.message).toContain('CSV UTF-8 (Comma delimited)')
  })

  it('detects semicolon files that use decimal commas in data rows', () => {
    expect(csvError(() => parseCsvBytes(utf8('sku;price\nA1;1,5\nA2;12,75\n'))).code).toBe('semicolon_delimited')
  })

  it('does not reject a one-column file just because its header contains a semicolon', () => {
    expect(parseCsvBytes(utf8('note;remark\nhello\nworld\n')).records).toEqual([['note;remark'], ['hello'], ['world']])
    expect(parseCsvBytes(utf8('note;remark\n')).records).toEqual([['note;remark']])
    expect(parseCsvBytes(utf8('"note;remark"\n"a;b"\n')).records).toEqual([['note;remark'], ['a;b']])
  })

  it('removes a duplicated leading BOM instead of gluing it to the first header name', () => {
    const doubleBom = new Uint8Array([0xef, 0xbb, 0xbf, 0xef, 0xbb, 0xbf, ...utf8('sku,name\nA1,Pump\n')])
    const result = parseCsvBytes(doubleBom)
    expect(result.hadBom).toBe(true)
    expect(result.records[0]).toEqual(['sku', 'name'])
    expect(result.records[0]?.[0]?.charCodeAt(0)).toBe('s'.charCodeAt(0))
  })

  it('treats a file that is only BOMs as empty', () => {
    expect(csvError(() => parseCsvBytes(new Uint8Array([0xef, 0xbb, 0xbf, 0xef, 0xbb, 0xbf]))).code).toBe('empty_file')
  })

  it('enforces optional size and row limits only when given', () => {
    expect(csvError(() => parseCsvBytes(utf8('sku\nA1\nA2\n'), { maxRows: 1 })).code).toBe('too_many_rows')
    expect(csvError(() => parseCsvBytes(utf8('sku\nA1\n'), { maxBytes: 3 })).code).toBe('too_large')
    expect(parseCsvBytes(utf8('sku\nA1\nA2\n'), { maxRows: 2 }).records).toHaveLength(3)
    expect(parseCsvBytes(utf8('sku\nA1\nA2\n')).records).toHaveLength(3)
  })
})

describe('protective apostrophes (import side of the escaping policy)', () => {
  it('removes exactly one apostrophe before a formula trigger', () => {
    expect(stripProtectiveApostrophe("'=SUM(A1)")).toBe('=SUM(A1)')
    expect(stripProtectiveApostrophe("'+1")).toBe('+1')
    expect(stripProtectiveApostrophe("'-40 °C rated")).toBe('-40 °C rated')
    expect(stripProtectiveApostrophe("'@sales")).toBe('@sales')
    expect(stripProtectiveApostrophe("'\tindented")).toBe('\tindented')
    expect(stripProtectiveApostrophe("'\rx")).toBe('\rx')
    expect(stripProtectiveApostrophe("''=1")).toBe("'=1")
  })

  it('leaves every other value unchanged', () => {
    for (const value of ["'hello", "'", "''", '=raw', 'plain', '', "it's"]) {
      expect(stripProtectiveApostrophe(value)).toBe(value)
    }
  })

  it('is applied by parseCsvBytes unless disabled', () => {
    const bytes = utf8("value\n'=1+2\n")
    expect(parseCsvBytes(bytes).records[1]).toEqual(['=1+2'])
    expect(parseCsvBytes(bytes, { stripProtectiveApostrophes: false }).records[1]).toEqual(["'=1+2"])
  })
})
