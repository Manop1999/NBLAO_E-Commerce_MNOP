import { describe, expect, it } from 'vitest'
import { FORMULA_TRIGGERS, parseCsvBytes } from '../../src/csv/parse'
import { escapeFormula, toCsvDocument, toCsvField, toCsvRow, type CsvValue } from '../../src/csv/write'

describe('escapeFormula (export side of the escaping policy)', () => {
  it('prefixes an apostrophe for every formula trigger', () => {
    expect(escapeFormula('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)")
    expect(escapeFormula('+1')).toBe("'+1")
    expect(escapeFormula('-40 °C rated')).toBe("'-40 °C rated")
    expect(escapeFormula('@sales')).toBe("'@sales")
    expect(escapeFormula('\tindented')).toBe("'\tindented")
    expect(escapeFormula('\rx')).toBe("'\rx")
    expect(escapeFormula('\nline')).toBe("'\nline")
  })

  it('also protects text that already starts with apostrophes before a trigger', () => {
    expect(escapeFormula("'=x")).toBe("''=x")
    expect(escapeFormula("''@y")).toBe("'''@y")
  })

  it('leaves safe text unchanged', () => {
    for (const text of ['', 'Pump', 'A-1', "'hello", "it's", '1=1', ' =1', 'ໝໍ້ແປງໄຟ', 'หม้อแปลง']) {
      expect(escapeFormula(text)).toBe(text)
    }
  })
})

describe('toCsvField / toCsvRow', () => {
  it('quotes fields containing commas, quotes or line breaks and doubles quotes', () => {
    expect(toCsvField('Pump, 3-phase')).toBe('"Pump, 3-phase"')
    expect(toCsvField('He said "fast"')).toBe('"He said ""fast"""')
    expect(toCsvField('line one\r\nline two')).toBe('"line one\r\nline two"')
    expect(toCsvField('plain')).toBe('plain')
  })

  it('escapes formulas before quoting', () => {
    expect(toCsvField('=1,2')).toBe(`"'=1,2"`)
    expect(toCsvField('\rcarriage')).toBe(`"'\rcarriage"`)
    expect(toCsvField('\n=1')).toBe(`"'\n=1"`)
  })

  it('writes numbers and booleans as plain values and null/undefined as empty', () => {
    expect(toCsvField(-5)).toBe('-5')
    expect(toCsvField(1250.5)).toBe('1250.5')
    expect(toCsvField(0)).toBe('0')
    expect(toCsvField(true)).toBe('true')
    expect(toCsvField(false)).toBe('false')
    expect(toCsvField(null)).toBe('')
    expect(toCsvField(undefined)).toBe('')
  })

  it('refuses non-finite numbers', () => {
    expect(() => toCsvField(Number.NaN)).toThrow(RangeError)
    expect(() => toCsvField(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })

  it('refuses NUL characters', () => {
    const nul = String.fromCharCode(0)
    expect(() => toCsvField(`a${nul}b`)).toThrow(RangeError)
    expect(() => toCsvDocument([['v'], [`a${nul}b`]])).toThrow(RangeError)
  })

  it('joins fields with commas', () => {
    expect(toCsvRow(['A1', 'Pump, 3-phase', 2, null, '=x'])).toBe(`A1,"Pump, 3-phase",2,,'=x`)
  })
})

describe('toCsvDocument', () => {
  it('uses a UTF-8 BOM and CRLF line endings by default', () => {
    expect(toCsvDocument([['sku', 'qty'], ['A1', 2]])).toBe('\uFEFFsku,qty\r\nA1,2\r\n')
  })

  it('can omit the BOM and handles an empty document', () => {
    expect(toCsvDocument([['sku']], { bom: false })).toBe('sku\r\n')
    expect(toCsvDocument([], { bom: false })).toBe('')
  })
})

describe('round trip: toCsvDocument -> parseCsvBytes', () => {
  const header = ['sku', 'value']
  const values: string[] = [
    'plain',
    '=1+2',
    '+66 20 1234 5678',
    '-40 °C rated',
    '@sales',
    '\tindented',
    '\n=1',
    '\nstarts with newline',
    "'=already protected",
    "'hello",
    "it's",
    'Pump, 3-phase',
    'He said "fast"',
    'line one\r\nline two',
    'line one\nline two',
    'ໝໍ້ແປງໄຟຟ້າ 3 ເຟສ',
    'หม้อแปลงไฟฟ้า',
    '',
    ' padded ',
  ]

  it('returns exactly the original text values when stripping is enabled for our own export', () => {
    const rows: CsvValue[][] = [header, ...values.map((value, i) => [`R${i}`, value])]
    const bytes = new TextEncoder().encode(toCsvDocument(rows))
    const parsed = parseCsvBytes(bytes, { stripProtectiveApostrophes: true })
    expect(parsed.hadBom).toBe(true)
    expect(parsed.records).toEqual([header, ...values.map((value, i) => [`R${i}`, value])])
  })

  it('returns numbers and booleans as their text form', () => {
    const bytes = new TextEncoder().encode(toCsvDocument([['n', 'b', 'empty'], [-5, true, null]], { bom: false }))
    expect(parseCsvBytes(bytes).records).toEqual([
      ['n', 'b', 'empty'],
      ['-5', 'true', ''],
    ])
  })

  it('keeps protective apostrophes when stripping is not enabled', () => {
    const bytes = new TextEncoder().encode(toCsvDocument([['=1+2'], ['\n=1'], ['plain']], { bom: false }))
    expect(parseCsvBytes(bytes).records).toEqual([["'=1+2"], ["'\n=1"], ['plain']])
  })

  it('never leaves an unprotected formula in any cell', () => {
    const triggerCases = ["=cmd|' /c calc'!A0", '+1', '-1', '@SUM(A1)', '\t=1', '\r=1', '\n=1', 'line one\n=line two']
    const doc = toCsvDocument([...values, ...triggerCases].map(v => [v]), { bom: false })
    // Parse the written file (without stripping) so quoted multi-line cells are seen exactly as a spreadsheet sees them.
    const cells = parseCsvBytes(new TextEncoder().encode(doc), { stripProtectiveApostrophes: false }).records.flat()
    expect(cells).toHaveLength(values.length + triggerCases.length)
    for (const cell of cells) {
      expect(cell.length === 0 || !FORMULA_TRIGGERS.has(cell[0] as string)).toBe(true)
    }
  })
})
