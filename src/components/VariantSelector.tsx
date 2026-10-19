import { optionValueState, type ProductOption, type Selection, type VariantProductLike } from '../lib/variants'

const SWATCH: Record<string, string> = {
  black: '#111827', white: '#ffffff', red: '#dc2626', blue: '#2563eb', green: '#16a34a', yellow: '#facc15',
  orange: '#f97316', grey: '#9ca3af', gray: '#9ca3af', silver: '#cbd5e1', gold: '#d4af37', brown: '#92400e',
}

interface Props {
  product: VariantProductLike
  selection: Selection
  onChange: (optionName: string, value: string) => void
  showErrors?: boolean
}

export default function VariantSelector({ product, selection, onChange, showErrors }: Props) {
  const options: ProductOption[] = product.options ?? []
  return (
    <div className="flex flex-col gap-4 mb-5" data-testid="variant-selector">
      {options.map((option) => {
        const missing = showErrors && !selection[option.name]
        const isColor = /colou?r/i.test(option.name)
        return (
          <fieldset key={option.name} className="min-w-0">
            <legend className="font-ui text-[12px] font-600 mb-2" style={{ color: 'var(--nb-navy)' }}>
              {option.name}
              {selection[option.name] && <span className="font-400 ml-1.5" style={{ color: 'var(--nb-text-secondary)' }}>{selection[option.name]}</span>}
            </legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={option.name}>
              {option.values.map((value) => {
                const state = optionValueState(product, selection, option.name, value)
                const selected = selection[option.name] === value
                const disabled = state !== 'available' && !selected
                const swatch = isColor ? SWATCH[value.toLowerCase()] : undefined
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={disabled}
                    title={state === 'invalid' ? 'Combination not available' : state === 'out_of_stock' ? 'Out of stock' : value}
                    onClick={() => onChange(option.name, value)}
                    className="rounded-md inline-flex items-center gap-2 min-h-10 px-3 font-ui text-[12px] font-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--nb-primary)] disabled:cursor-not-allowed"
                    style={{
                      border: `1.5px solid ${selected ? 'var(--nb-primary)' : 'var(--nb-border)'}`,
                      background: selected ? 'var(--nb-light-blue)' : disabled ? '#F1F5F9' : '#fff',
                      color: disabled ? '#94A3B8' : 'var(--nb-navy)',
                      textDecoration: disabled ? 'line-through' : 'none',
                    }}
                  >
                    {swatch && <span aria-hidden="true" className="w-4 h-4 rounded-full shrink-0" style={{ background: swatch, border: '1px solid #cbd5e1' }} />}
                    {value}
                    {state === 'out_of_stock' && !selected && <span className="sr-only"> (out of stock)</span>}
                  </button>
                )
              })}
            </div>
            {missing && <p role="alert" className="font-ui text-[11px] mt-1.5" style={{ color: '#991B1B' }}>Select {option.name}</p>}
          </fieldset>
        )
      })}
    </div>
  )
}
