import { AddressInput, SHIPPING_COUNTRIES, CustomerAddress, AddressSnapshot } from "./engine"
import { useCT } from "./text"
import { useStore } from "../store"

export const EMPTY_ADDRESS: AddressInput = {
  label: "",
  recipientName: "",
  phone: "",
  company: "",
  countryCode: "LA",
  province: "",
  district: "",
  village: "",
  postalCode: "",
  addressLine: "",
  instructions: "",
  isDefault: false,
}

const input =
  "w-full border border-[#D9E2EC] bg-white px-3 py-2.5 text-[13px] text-[#082E61] focus:outline-none focus:border-[#0099FF] focus:ring-1 focus:ring-[#0099FF]"

function Field({
  label,
  error,
  children,
  required,
  className = "",
}: {
  label: string
  error?: string
  children: React.ReactNode
  required?: boolean
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-[12px] font-semibold mb-1.5 text-[#082E61]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="block text-[11px] text-red-600 mt-1">
          {error}
        </span>
      )}
    </label>
  )
}

export function AddressForm({
  value,
  onChange,
  errors,
  showDefault = false,
}: {
  value: AddressInput
  onChange: (next: AddressInput) => void
  errors: Record<string, string>
  showDefault?: boolean
}) {
  const ct = useCT()
  const { lang } = useStore()
  const set = (key: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [key]: e.target.value })
  const msg = (key: string) => {
    const code = errors[key]
    if (!code) return undefined
    const a = ct.address as Record<string, unknown>
    return (typeof a[code] === "string" ? (a[code] as string) : undefined) ?? ct.address.required
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label={ct.address.label} required error={msg("label")}>
        <input className={input} value={value.label} onChange={set("label")} placeholder={ct.address.label_ph} maxLength={40} />
      </Field>
      <Field label={ct.address.recipient} required error={msg("recipientName")}>
        <input className={input} value={value.recipientName} onChange={set("recipientName")} autoComplete="name" />
      </Field>
      <Field label={ct.address.phone} required error={msg("phone")}>
        <input className={input} value={value.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" />
      </Field>
      <Field label={ct.address.company}>
        <input className={input} value={value.company} onChange={set("company")} autoComplete="organization" />
      </Field>
      <Field label={ct.address.country} required error={msg("countryCode")}>
        <select className={input} value={value.countryCode} onChange={set("countryCode")}>
          {SHIPPING_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {lang === "lo" ? c.nameLo : c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={ct.address.province} required error={msg("province")}>
        <input className={input} value={value.province} onChange={set("province")} />
      </Field>
      <Field label={ct.address.district} required error={msg("district")}>
        <input className={input} value={value.district} onChange={set("district")} />
      </Field>
      <Field label={ct.address.village}>
        <input className={input} value={value.village} onChange={set("village")} />
      </Field>
      <Field label={ct.address.postal} error={msg("postalCode")}>
        <input className={input} value={value.postalCode} onChange={set("postalCode")} inputMode="numeric" autoComplete="postal-code" />
      </Field>
      <Field label={ct.address.line} required error={msg("addressLine")} className="sm:col-span-2">
        <input className={input} value={value.addressLine} onChange={set("addressLine")} autoComplete="street-address" />
      </Field>
      <Field label={ct.address.instructions} className="sm:col-span-2">
        <textarea className={input} rows={2} value={value.instructions} onChange={set("instructions")} />
      </Field>
      {showDefault && (
        <label className="sm:col-span-2 flex items-center gap-2 text-[13px] text-[#082E61]">
          <input
            type="checkbox"
            checked={!!value.isDefault}
            onChange={(e) => onChange({ ...value, isDefault: e.target.checked })}
            style={{ accentColor: "#0099FF" }}
          />
          {ct.address.make_default}
        </label>
      )}
    </div>
  )
}

export function AddressLines({ a, className = "" }: { a: CustomerAddress | AddressSnapshot | AddressInput; className?: string }) {
  const { lang } = useStore()
  const country = SHIPPING_COUNTRIES.find((c) => c.code === a.countryCode)
  const parts = [a.addressLine, a.village, a.district, a.province, a.postalCode, country ? (lang === "lo" ? country.nameLo : country.name) : a.countryCode].filter(Boolean)
  return (
    <div className={`text-[13px] leading-relaxed text-[#52677D] ${className}`}>
      <div className="font-semibold text-[#082E61]">
        {a.recipientName}
        {a.company ? ` · ${a.company}` : ""}
      </div>
      <div>{parts.join(", ")}</div>
      <div>{a.phone}</div>
      {a.instructions && <div className="italic">{a.instructions}</div>}
    </div>
  )
}
