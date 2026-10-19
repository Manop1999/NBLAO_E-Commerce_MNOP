import { useStore } from '../store'
import { useT } from '../i18n'
import type { Lang } from '../lib/language'

const OPTIONS: { lang: Lang; code: string; native: string }[] = [
  { lang: 'en', code: 'EN', native: 'English' },
  { lang: 'lo', code: 'LA', native: 'ລາວ' },
  { lang: 'th', code: 'TH', native: 'ไทย' },
]

export default function LanguageSwitcher({ variant = 'header' }: { variant?: 'header' | 'drawer' }) {
  const { lang, setLang } = useStore()
  const t = useT()
  const l = t.language as Record<string, string>
  const labels: Record<Lang, string> = { en: l.select_english, lo: l.select_lao, th: l.select_thai }
  const drawer = variant === 'drawer'
  return (
    <label
      data-i18n-skip
      className={`relative inline-flex items-center overflow-hidden rounded-md bg-white ${drawer ? 'flex-1 min-w-0' : 'shrink-0'}`}
      style={{ border: '1px solid var(--nb-border)' }}
    >
      <span className="sr-only">{l.label}</span>
      <select
        value={lang}
        onChange={event => setLang(event.target.value as Lang)}
        aria-label={l.label}
        className={`appearance-none min-w-0 bg-transparent font-ui font-700 outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--nb-primary)] ${
          drawer ? 'min-h-11 w-full text-[13px] pl-3 pr-8' : 'h-8 text-[10px] pl-2 pr-6'
        }`}
        style={{ color: 'var(--nb-navy)' }}
      >
        {OPTIONS.map(({ lang: value, code, native }) => (
          <option key={value} value={value} lang={value} aria-label={labels[value]}>
            {drawer ? `${code} — ${native}` : code}
          </option>
        ))}
      </select>
      <svg className={`pointer-events-none absolute right-2 ${drawer ? 'w-3.5 h-3.5' : 'w-3 h-3'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </label>
  )
}
