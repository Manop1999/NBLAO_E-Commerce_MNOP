import { useState } from 'react'
import {
  generateMissingVariants, isObsoleteVariant, previewCombinations, validateVariants,
  type ProductOption, type ProductVariant, type VariantIssue,
} from '../../lib/variants'
import { getStockStatus, STOCK_STATUS_STYLE } from '../../lib/stockStatus'

const fieldClass = 'rounded-md font-ui text-[12px] px-2.5 py-2 outline-none bg-white w-full'
const fieldStyle = { border: '1px solid var(--nb-border)', color: 'var(--nb-navy)' }
const errStyle = { border: '1px solid #dc2626', color: 'var(--nb-navy)' }
const btn = 'rounded-sm font-ui text-[11px] px-3 py-1.5 border border-slate-300 text-slate-600 disabled:opacity-50'

interface Props {
  options: ProductOption[]
  variants: ProductVariant[]
  basePrice: number
  currency: string
  otherSkus: string[]
  baseSku: string
  onChange: (options: ProductOption[], variants: ProductVariant[]) => void
}

const norm = (x: string) => x.trim().toLowerCase()

function ValueChip({ value, onRename, onRemove }: { value: string; onRename: (next: string) => string | null; onRemove: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState('')
  const commit = () => {
    const problem = draft.trim() === value ? null : onRename(draft.trim())
    if (problem) { setError(problem); return }
    setError(''); setEditing(false)
  }
  if (editing)
    return (
      <span className="inline-flex flex-col">
        <input autoFocus aria-label={`Rename value ${value}`} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit() } if (e.key === 'Escape') { setDraft(value); setError(''); setEditing(false) } }}
          className="rounded-full font-ui text-[11px] px-2.5 py-1 w-28" style={error ? errStyle : fieldStyle} />
        {error && <span role="alert" className="font-ui text-[10px] text-red-600 mt-0.5">{error}</span>}
      </span>
    )
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 font-ui text-[11px]" style={{ color: 'var(--nb-navy)' }}>
      <button type="button" title="Click to rename" onClick={() => { setDraft(value); setEditing(true) }} className="pl-3 pr-1.5 py-1">{value}</button>
      <button type="button" aria-label={`Remove value ${value}`} onClick={onRemove} className="pr-2.5 pl-0.5 py-1 text-slate-500 hover:text-red-600">×</button>
    </span>
  )
}

function OptionCard({
  option, index, issues, variantsUsing, onRename, onValues, onRemove,
}: {
  option: ProductOption
  index: number
  issues: VariantIssue[]
  variantsUsing: (value?: string) => number
  onRename: (name: string) => void
  onValues: (values: string[], renamed?: { from: string; to: string }) => void
  onRemove: () => void
}) {
  const [name, setName] = useState(option.name)
  const [draft, setDraft] = useState('')
  const [valueError, setValueError] = useState('')
  const own = issues.filter((i) => i.optionIndex === index)

  const addValues = (raw: string) => {
    const parts = raw.split(/[,\n]/).map((x) => x.trim()).filter(Boolean)
    if (!parts.length) return
    const next = [...option.values]
    const dupes: string[] = []
    for (const p of parts) (next.some((v) => norm(v) === norm(p)) ? dupes : next).push(p)
    onValues(next)
    setDraft('')
    setValueError(dupes.length ? `Already added: ${dupes.join(', ')}` : '')
  }

  return (
    <div className="rounded-md p-3 mb-3 bg-slate-50" style={{ border: '1px solid var(--nb-border)' }} data-testid="option-card">
      <div className="flex gap-2 items-start">
        <label className="flex-1 font-ui text-[10px] uppercase tracking-wider text-slate-500">Option name
          <input aria-label="Option name" placeholder="e.g. Voltage" value={name} onChange={(e) => setName(e.target.value)}
            onBlur={() => { if (name.trim() !== option.name) onRename(name) }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onRename(name) } }}
            className={`${fieldClass} mt-1 normal-case tracking-normal text-[12px]`} style={own.some((i) => i.code === 'option_duplicate') || !option.name.trim() ? errStyle : fieldStyle} />
        </label>
        <button type="button" onClick={onRemove} className="rounded-sm font-ui text-[11px] px-2 py-2 mt-5 border border-red-200 text-red-600 bg-white">Remove option</button>
      </div>
      <div className="mt-2">
        <div className="font-ui text-[10px] uppercase tracking-wider text-slate-500 mb-1">Values</div>
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-7 items-start">
          {option.values.map((v) => (
            <ValueChip key={v} value={v}
              onRename={(next) => {
                if (!next) return 'Value cannot be empty.'
                if (option.values.some((x) => x !== v && norm(x) === norm(next))) return `"${next}" already exists.`
                onValues(option.values.map((x) => (x === v ? next : x)), { from: v, to: next })
                return null
              }}
              onRemove={() => {
                const n = variantsUsing(v)
                if (n && !window.confirm(`${n} combination${n > 1 ? 's use' : ' uses'} "${v}". They will be retired (deactivated and hidden, history kept) when you save. Remove this value?`)) return
                onValues(option.values.filter((x) => x !== v))
              }} />
          ))}
          {!option.values.length && <span className="font-ui text-[11px] text-slate-400">No values yet</span>}
        </div>
        <div className="flex gap-2">
          <input aria-label={`Add value to ${option.name || 'option'}`} placeholder="Type a value, press Enter (or paste 220V, 380V)" value={draft}
            onChange={(e) => { setDraft(e.target.value); setValueError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addValues(draft) } }}
            onBlur={() => addValues(draft)}
            className={fieldClass} style={valueError ? errStyle : fieldStyle} />
          <button type="button" onClick={() => addValues(draft)} className={`${btn} bg-white shrink-0`}>Add value</button>
        </div>
        {valueError && <p role="alert" className="font-ui text-[11px] text-red-600 mt-1">{valueError}</p>}
        {own.filter((i) => i.code !== 'option_duplicate').map((i, n) => <p key={n} role="alert" className="font-ui text-[11px] text-red-600 mt-1">{i.message}</p>)}
        {own.some((i) => i.code === 'option_duplicate') && <p role="alert" className="font-ui text-[11px] text-red-600 mt-1">Option names must be unique.</p>}
      </div>
    </div>
  )
}

export default function VariantEditor({ options, variants, basePrice, currency, otherSkus, baseSku, onChange }: Props) {
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [nameError, setNameError] = useState('')
  const issues = validateVariants(options, variants, otherSkus)
  const preview = previewCombinations(options, variants)
  const missing = preview.filter((c) => !c.existing)
  const current = variants.filter((v) => !isObsoleteVariant(options, v))
  const retired = variants.filter((v) => isObsoleteVariant(options, v))
  const rowIssues = (id: string, codes: VariantIssue['code'][]) => issues.filter((i) => i.variantId === id && codes.includes(i.code))
  const otherIssues = issues.filter((i) => i.optionIndex === undefined && !i.variantId)

  const setVariant = (id: string, patch: Partial<ProductVariant>) =>
    onChange(options, variants.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  const countUsing = (name: string, value?: string) =>
    variants.filter((v) => (value === undefined ? v.options[name] !== undefined : v.options[name] === value)).length

  const rename = (i: number, raw: string) => {
    const next = raw.trim()
    const old = options[i].name
    if (!next) { setNameError('Option name cannot be empty.'); return }
    if (options.some((o, n) => n !== i && norm(o.name) === norm(next))) { setNameError(`An option named "${next}" already exists.`); return }
    setNameError('')
    if (next === old) return
    onChange(
      options.map((o, n) => (n === i ? { ...o, name: next } : o)),
      variants.map((v) => {
        if (!(old in v.options)) return v
        const { [old]: val, ...rest } = v.options
        return { ...v, options: { ...rest, [next]: val } }
      }),
    )
  }

  const setValues = (i: number, values: string[], renamed?: { from: string; to: string }) =>
    onChange(
      options.map((o, n) => (n === i ? { ...o, values } : o)),
      renamed ? variants.map((v) => (v.options[options[i].name] === renamed.from ? { ...v, options: { ...v.options, [options[i].name]: renamed.to } } : v)) : variants,
    )

  const removeOption = (i: number) => {
    const n = countUsing(options[i].name)
    const label = options[i].name || 'this option'
    if (!window.confirm(n ? `Remove "${label}"? ${n} existing combination${n > 1 ? 's' : ''} will be retired (deactivated and hidden, history kept) when you save.` : `Remove "${label}"?`)) return
    onChange(options.filter((_, k) => k !== i), variants)
  }

  const generate = () => {
    const added = generateMissingVariants(options, variants, baseSku, otherSkus)
    if (!added.length) return
    setFresh((prev) => new Set([...prev, ...added.map((v) => v.id)]))
    onChange(options, [...variants, ...added])
  }

  const cell = 'px-2 py-2 align-top'
  const heads = ['Combination', 'SKU', `Price (${currency})`, 'Stock', 'Status', 'Active', 'Visible', 'Buyable']

  return (
    <fieldset className="sm:col-span-2 rounded-lg p-4" style={{ border: '1px solid var(--nb-border)' }}>
      <legend className="font-ui text-[12px] font-700 px-2" style={{ color: 'var(--nb-navy)' }}>Variants (optional)</legend>
      <p className="font-ui text-[11px] text-slate-500 mb-3">
        1) Add option groups (Voltage, Size…) and their values. 2) Review the combinations below and generate the missing ones. 3) Set each combination's SKU, price and stock.
        Variants are never hard-deleted; removed values retire their combinations so past orders keep their history. Product stock is the sum of purchasable variants.
      </p>

      {options.map((o, i) => (
        <OptionCard key={i} option={o} index={i} issues={issues} variantsUsing={(v) => countUsing(o.name, v)}
          onRename={(name) => rename(i, name)} onValues={(values, renamed) => setValues(i, values, renamed)} onRemove={() => removeOption(i)} />
      ))}
      {nameError && <p role="alert" className="font-ui text-[11px] text-red-600 mb-2">{nameError}</p>}

      <div className="flex flex-wrap gap-2 mb-3">
        <button type="button" onClick={() => { setNameError(''); onChange([...options, { name: '', values: [] }], variants) }} className={btn}>+ Add option</button>
      </div>

      {preview.length > 0 && (
        <div className="rounded-md p-3 mb-3" style={{ border: '1px dashed var(--nb-border)' }} data-testid="combination-preview">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="font-ui text-[12px] font-600" style={{ color: 'var(--nb-navy)' }}>
              {preview.length} possible combination{preview.length > 1 ? 's' : ''} · {preview.length - missing.length} existing · {missing.length} to create
            </span>
            <button type="button" disabled={!missing.length} onClick={generate} className={btn}>
              {missing.length ? `Generate ${missing.length} missing combination${missing.length > 1 ? 's' : ''}` : 'All combinations exist'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {preview.map((c) => (
              <span key={c.label} className="rounded-sm px-2 py-0.5 font-ui text-[11px]"
                style={c.existing ? { background: '#E8EEF4', color: '#475569' } : { background: '#FEF3C7', color: '#92400E' }}>
                {c.label}{c.existing ? '' : ' · new'}
              </span>
            ))}
          </div>
        </div>
      )}

      {current.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead><tr className="bg-slate-50">{heads.map((h) => <th key={h} className="px-2 py-2 font-ui text-[10px] uppercase tracking-wider text-slate-500">{h}</th>)}</tr></thead>
            <tbody>
              {current.map((v) => {
                const st = STOCK_STATUS_STYLE[getStockStatus({ stock: v.stock, active: v.active && v.purchasable })]
                const skuErr = rowIssues(v.id, ['sku_required', 'sku_duplicate', 'sku_conflict'])
                const priceErr = rowIssues(v.id, ['price_invalid'])
                const stockErr = rowIssues(v.id, ['stock_invalid'])
                return (
                  <tr key={v.id} className="border-b border-slate-100" style={v.active ? undefined : { opacity: 0.6 }}>
                    <td className={`${cell} font-ui text-[11px]`}>
                      {options.map((o) => v.options[o.name]).join(' / ')}
                      <span className="ml-1.5 rounded-sm px-1.5 py-0.5 text-[9px] font-700 uppercase" style={fresh.has(v.id) ? { background: '#FEF3C7', color: '#92400E' } : { background: '#E8EEF4', color: '#475569' }}>{fresh.has(v.id) ? 'New' : 'Existing'}</span>
                    </td>
                    <td className={cell}>
                      <input aria-label="Variant SKU" aria-invalid={!!skuErr.length} value={v.sku} onChange={(e) => setVariant(v.id, { sku: e.target.value })} className={fieldClass} style={skuErr.length ? errStyle : fieldStyle} />
                      {skuErr.map((i, n) => <p key={n} role="alert" className="font-ui text-[10px] text-red-600 mt-0.5">{i.message}</p>)}
                    </td>
                    <td className={cell}>
                      <input aria-label="Variant price" aria-invalid={!!priceErr.length} type="number" min="0" step="any" placeholder={`${basePrice} (product)`} value={v.price ?? ''} onChange={(e) => setVariant(v.id, { price: e.target.value === '' ? undefined : Number(e.target.value) })} className={fieldClass} style={priceErr.length ? errStyle : fieldStyle} />
                      {priceErr.length > 0 ? <p role="alert" className="font-ui text-[10px] text-red-600 mt-0.5">Price must be greater than 0.</p> : <p className="font-ui text-[10px] text-slate-400 mt-0.5">{currency}{v.price === undefined ? ' · inherits product' : ''}</p>}
                    </td>
                    <td className={cell}>
                      <input aria-label="Variant stock" aria-invalid={!!stockErr.length} type="number" min="0" value={v.stock} onChange={(e) => setVariant(v.id, { stock: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className={fieldClass} style={stockErr.length ? errStyle : fieldStyle} />
                    </td>
                    <td className={cell}><span className="rounded-sm px-2 py-0.5 font-ui text-[10px] font-600 whitespace-nowrap" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                    <td className={cell}><input aria-label="Active" type="checkbox" checked={v.active} onChange={(e) => setVariant(v.id, { active: e.target.checked })} /></td>
                    <td className={cell}><input aria-label="Visible" type="checkbox" checked={v.visible} onChange={(e) => setVariant(v.id, { visible: e.target.checked })} /></td>
                    <td className={cell}><input aria-label="Purchasable" type="checkbox" checked={v.purchasable} onChange={(e) => setVariant(v.id, { purchasable: e.target.checked })} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {retired.length > 0 && (
        <details className="mt-3 font-ui text-[11px] text-slate-500" data-testid="retired-variants">
          <summary className="cursor-pointer">{retired.length} retired combination{retired.length > 1 ? 's' : ''} (kept for order history, not sold)</summary>
          <ul className="mt-1 list-disc pl-4">
            {retired.map((v) => <li key={v.id}>{v.sku} — {Object.entries(v.options).map(([k, val]) => `${k}: ${val}`).join(', ')}. Re-add the removed option or value to bring it back.</li>)}
          </ul>
        </details>
      )}

      {otherIssues.length > 0 && <ul className="mt-3 font-ui text-[11px] text-red-600 list-disc pl-4">{otherIssues.map((x, n) => <li key={n}>{x.message}</li>)}</ul>}
    </fieldset>
  )
}
