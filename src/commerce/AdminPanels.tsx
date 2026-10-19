import { useState } from "react"
import { useCommerce } from "./CommerceProvider"
import { useExplain } from "./ui"
import {
  ORDER_STATUSES,
  STATUS_TRANSITIONS,
  SHIPPING_COUNTRIES,
  OrderStatus,
  PaymentStatus,
  LoyaltyRule,
  CommerceError,
  setOrderStatus,
  setPaymentStatus,
  setCurrencyEnabled,
  setBaseCurrency,
  LEGACY_PRICE_CURRENCY,
  setConversionEnabled,
  saveFxRate,
  deleteFxRate,
  saveProductPrice,
  deleteProductPrice,
  saveShippingRate,
  deleteShippingRate,
  saveLoyaltyRule,
  adjustPoints,
  validateLoyaltyRule,
  listLedger,
} from "./engine"
import { formatMinor, minorToDecimalString, parseDecimalToMinor } from "./money"
import { useStore } from "../store"
import { useToast } from "../components/Toast"
import { ConfirmModal } from "../components/Modal"
import { orderMoney } from "./AccountPanels"

const NAVY = "var(--nb-navy)"
const BLUE = "var(--nb-primary)"
const field =
  "border border-[#D9E2EC] bg-white px-2.5 py-2 text-[13px] text-[#082E61] focus:outline-none focus:border-[#0099FF]"
const btn = "font-ui text-[12px] font-semibold px-3.5 py-2 text-white disabled:opacity-50"
const card = { border: "1px solid var(--nb-border)" }
const th = "px-3 py-2.5 text-left font-ui text-[10px] font-bold tracking-widest uppercase"

function Tabs({ tabs, value, onChange }: { tabs: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 mb-5" role="tablist">
      {tabs.map(([id, label]) => (
        <button
          key={id}
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className="font-ui text-[12px] font-semibold px-4 py-2"
          style={{ background: value === id ? NAVY : "#fff", color: value === id ? "#fff" : NAVY, border: `1px solid ${NAVY}` }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white py-10 text-center font-ui text-[13px]" style={{ ...card, color: "var(--nb-text-secondary)" }}>
      {children}
    </div>
  )
}

function useAdminAction() {
  const { runAdmin } = useCommerce()
  const explain = useExplain()
  const { addToast } = useToast()
  return <T,>(fn: Parameters<typeof runAdmin<T>>[0], okMessage?: string): T | undefined => {
    try {
      const r = runAdmin(fn)
      if (okMessage) addToast(okMessage, "success")
      return r
    } catch (e) {
      const extra = e instanceof CommerceError && e.params?.problem ? ` (${String(e.params.problem)})` : ""
      addToast(explain(e) + extra, "error")
      return undefined
    }
  }
}

// ─── Orders ───────────────────────────────────────────────────────────────────
export function StoredOrdersAdmin() {
  const { db, applyStock } = useCommerce()
  const act = useAdminAction()
  const [pending, setPending] = useState<{ id: string; status: OrderStatus } | null>(null)

  const changeStatus = (id: string, status: OrderStatus) => {
    const r = act((d, a, now) => setOrderStatus(d, a, id, status, now), `Order ${id} → ${status}`)
    if (r) applyStock(r.stockDeltas)
  }

  return (
    <div className="mb-8">
      <h3 className="font-display font-bold text-[16px] mb-3" style={{ color: NAVY }}>
        Storefront orders ({db.orders.length})
      </h3>
      {db.orders.length === 0 ? (
        <Empty>No orders have been placed through checkout yet.</Empty>
      ) : (
        <div className="bg-white overflow-x-auto" style={card}>
          <table className="w-full" style={{ minWidth: 820 }}>
            <thead style={{ background: "var(--nb-surface)", color: "#8f9faf" }}>
              <tr>
                {["Order", "Customer", "Date", "Currency", "Total", "Ship to", "Status", "Payment"].map((h) => (
                  <th key={h} className={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {db.orders.map((o) => (
                <tr key={o.id} style={{ borderTop: "1px solid var(--nb-bg)" }} className="font-ui text-[12px]">
                  <td className="px-3 py-2.5 font-display font-bold text-[13px]" style={{ color: NAVY }}>{o.id}</td>
                  <td className="px-3 py-2.5">{o.contact.name}<div className="text-[11px] text-[#8f9faf]">{o.customerId}</div></td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{o.createdAt.slice(0, 10)}</td>
                  <td className="px-3 py-2.5">{o.currency}</td>
                  <td className="px-3 py-2.5 font-bold whitespace-nowrap" style={{ color: NAVY }}>
                    {orderMoney(o, o.totalMinor)}
                    {o.shippingStatus === "to_be_confirmed" && <div className="text-[10px] font-normal text-[#92400e]">+ shipping TBC</div>}
                  </td>
                  <td className="px-3 py-2.5">{o.address.province}, {o.address.countryCode}</td>
                  <td className="px-3 py-2.5">
                    <select
                      aria-label={`Status for ${o.id}`}
                      className={field}
                      value={o.status}
                      onChange={(e) => {
                        const s = e.target.value as OrderStatus
                        if (s === "Cancelled" || s === "Refunded") setPending({ id: o.id, status: s })
                        else changeStatus(o.id, s)
                      }}
                    >
                      {ORDER_STATUSES.filter((s) => s === o.status || STATUS_TRANSITIONS[o.status].includes(s)).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      aria-label={`Payment for ${o.id}`}
                      className={field}
                      value={o.paymentStatus}
                      onChange={(e) => act((d, a, now) => setPaymentStatus(d, a, o.id, e.target.value as PaymentStatus, now), `Payment updated for ${o.id}`)}
                    >
                      {["unpaid", "paid", "refunded"].map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmModal
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) changeStatus(pending.id, pending.status)
          setPending(null)
        }}
        title={`Mark order as ${pending?.status ?? ""}?`}
        message={
          pending?.status === "Cancelled"
            ? "Cancelling restores stock and any redeemed points, and reverses earned points. This cannot be undone."
            : "Refunding reverses earned points and restores redeemed points. This cannot be undone."
        }
        confirmLabel={pending?.status ?? "Confirm"}
        confirmDanger
      />
    </div>
  )
}

// ─── Currency & pricing ───────────────────────────────────────────────────────
function CurrenciesTab() {
  const { db } = useCommerce()
  const act = useAdminAction()
  return (
    <div className="grid gap-5">
      <div className="bg-white overflow-x-auto" style={card}>
        <table className="w-full" style={{ minWidth: 520 }}>
          <thead style={{ background: "var(--nb-surface)", color: "#8f9faf" }}>
            <tr>{["Code", "Name", "Symbol", "Decimals", "Role", "Enabled"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {db.currencies.map((c) => (
              <tr key={c.code} className="font-ui text-[13px]" style={{ borderTop: "1px solid var(--nb-bg)" }}>
                <td className="px-3 py-2.5 font-bold" style={{ color: NAVY }}>{c.code}</td>
                <td className="px-3 py-2.5">{c.name}</td>
                <td className="px-3 py-2.5">{c.symbol}</td>
                <td className="px-3 py-2.5">{c.decimals}</td>
                <td className="px-3 py-2.5">{c.code === db.settings.baseCurrency ? "Base currency" : "Display"}</td>
                <td className="px-3 py-2.5">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={c.enabled}
                      disabled={c.code === db.settings.baseCurrency}
                      onChange={(e) => act((d, a, now) => setCurrencyEnabled(d, a, c.code, e.target.checked, now), `${c.code} ${e.target.checked ? "enabled" : "disabled"}`)}
                      style={{ accentColor: BLUE }}
                    />
                    <span>{c.enabled ? "On" : "Off"}</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-white p-5" style={card}>
        <label className="flex items-start gap-3 font-ui text-[13px]">
          <input
            type="checkbox"
            checked={db.settings.conversionEnabled}
            onChange={(e) => act((d, a, now) => setConversionEnabled(d, a, e.target.checked, now), "Conversion setting saved")}
            style={{ accentColor: BLUE }}
            className="mt-1"
          />
          <span>
            <strong style={{ color: NAVY }}>Convert from the base price when no manual price exists</strong>
            <br />
            Uses the active exchange rate. Manual per-currency prices always win. With this off, products without a manual price show “Price unavailable” and can't be purchased in that currency.
          </span>
        </label>
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--nb-bg)" }}>
          <label className="font-ui text-[13px] font-semibold block" style={{ color: NAVY }}>Base currency
            <select
              value={db.settings.baseCurrency}
              onChange={(e) => {
                if (e.target.value === db.settings.baseCurrency) return
                if (!window.confirm(`Make ${e.target.value} the base currency?\n\nNo product, order or manual price is rewritten: each product keeps the currency its price was entered in (older products: ${LEGACY_PRICE_CURRENCY}). Exchange rates are entered against the base, so re-enter rates for ${e.target.value} before enabling conversion; until then other currencies show “Price unavailable” unless they have a manual price.`)) return
                act((d, a, now) => setBaseCurrency(d, a, e.target.value, now), `Base currency set to ${e.target.value}`)
              }}
              className="rounded-md mt-1 ml-3 px-2 py-1.5 font-ui text-[13px]"
              style={{ border: "1px solid var(--nb-border)" }}
            >
              {db.currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </label>
          <p className="font-ui text-[12px] mt-2 text-[#52677D]">
            The base currency anchors exchange rates and is the storefront's default. Each product's price currency is chosen in Products; changing a price or the base never alters existing orders (they keep their recorded price, currency and rate).
          </p>
        </div>
      </div>
    </div>
  )
}

function RatesTab() {
  const { db } = useCommerce()
  const act = useAdminAction()
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const targets = db.currencies.filter((c) => c.code !== db.settings.baseCurrency)
  const todayStr = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({ target: targets[0]?.code ?? "THB", rate: "", effectiveFrom: todayStr, expiresAt: "" })
  const rateState = (r: (typeof db.fxRates)[number]) =>
    r.status !== "active" ? "Inactive" : r.expiresAt && r.expiresAt < todayStr ? "Expired" : r.effectiveFrom > todayStr ? "Scheduled" : "Current"
  return (
    <div className="grid gap-5">
      <form
        className="bg-white p-5 grid sm:grid-cols-5 gap-3 items-end"
        style={card}
        onSubmit={(e) => {
          e.preventDefault()
          if (act((d, a, now) => saveFxRate(d, a, { ...form, expiresAt: form.expiresAt || undefined, status: "active" }, now), "Exchange rate saved"))
            setForm({ ...form, rate: "", expiresAt: "" })
        }}
      >
        <label className="font-ui text-[12px] font-semibold">Target
          <select className={`${field} w-full mt-1`} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })}>
            {targets.map((c) => <option key={c.code}>{c.code}</option>)}
          </select>
        </label>
        <label className="font-ui text-[12px] font-semibold">1 {db.settings.baseCurrency} =
          <input className={`${field} w-full mt-1`} inputMode="decimal" placeholder="e.g. 34.5" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} required />
        </label>
        <label className="font-ui text-[12px] font-semibold">Effective from
          <input type="date" className={`${field} w-full mt-1`} value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required />
        </label>
        <label className="font-ui text-[12px] font-semibold">Expires (optional)
          <input type="date" className={`${field} w-full mt-1`} value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
        </label>
        <button className={btn} style={{ background: BLUE }}>Add rate</button>
        <p className="sm:col-span-5 font-ui text-[11px] text-[#52677D]">
          Rates are entered by an administrator; no live exchange-rate provider is connected. Positive number, up to 6 decimals. Expired rates are ignored at checkout.
        </p>
      </form>
      {db.fxRates.length === 0 ? (
        <Empty>No exchange rates yet. Without a rate (or manual prices), non-base currencies show “Price unavailable”.</Empty>
      ) : (
        <div className="bg-white overflow-x-auto" style={card}>
          <table className="w-full" style={{ minWidth: 600 }}>
            <thead style={{ background: "var(--nb-surface)", color: "#8f9faf" }}>
              <tr>{["Pair", "Rate", "From", "Expires", "State", "Actions"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {[...db.fxRates].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)).map((r) => (
                <tr key={r.id} className="font-ui text-[13px]" style={{ borderTop: "1px solid var(--nb-bg)" }}>
                  <td className="px-3 py-2.5 font-bold" style={{ color: NAVY }}>{r.base}→{r.target}</td>
                  <td className="px-3 py-2.5">{r.rate}</td>
                  <td className="px-3 py-2.5">{r.effectiveFrom}</td>
                  <td className="px-3 py-2.5">{r.expiresAt ?? "—"}</td>
                  <td className="px-3 py-2.5">{rateState(r)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <button className="text-[12px] font-semibold mr-3" style={{ color: BLUE }} onClick={() => act((d, a, now) => saveFxRate(d, a, { id: r.id, target: r.target, rate: r.rate, effectiveFrom: r.effectiveFrom, expiresAt: r.expiresAt, status: r.status === "active" ? "inactive" : "active" }, now), "Rate updated")}>
                      {r.status === "active" ? "Deactivate" : "Activate"}
                    </button>
                    <button className="text-[12px] font-semibold text-red-600" onClick={() => setConfirmDel(r.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmModal
        open={!!confirmDel}
        onClose={() => setConfirmDel(null)}
        onConfirm={() => {
          if (confirmDel) act((d, a, now) => deleteFxRate(d, a, confirmDel, now), "Rate deleted")
          setConfirmDel(null)
        }}
        title="Delete exchange rate?"
        message="Existing orders keep the rate recorded on them. New quotes will no longer use this rate."
        confirmLabel="Delete"
        confirmDanger
      />
    </div>
  )
}

function ProductPricesTab() {
  const { db, priceFor } = useCommerce()
  const { allProducts: products } = useStore()
  const act = useAdminAction()
  const priceCurrencies = db.currencies
  const [code, setCode] = useState(db.currencies.find((c) => c.code !== db.settings.baseCurrency)?.code ?? db.settings.baseCurrency)
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [q, setQ] = useState("")
  const currency = db.currencies.find((c) => c.code === code)
  if (!currency) return null
  const manual = (id: number) => db.productPrices.find((p) => p.productId === id && p.currency === code && !p.variantId)
  const list = products.filter((p) => !q || `${p.name} ${p.sku}`.toLowerCase().includes(q.toLowerCase()))

  const save = (id: number) => {
    const raw = drafts[id] ?? ""
    const minor = parseDecimalToMinor(raw, currency.decimals)
    if (minor === null || minor <= 0) {
      act(() => { throw new CommerceError("amount_invalid") })
      return
    }
    const catalog = { products: products.map((p) => ({ id: p.id, name: p.name, sku: p.sku, price: p.price, stock: p.stock })), placements: [] }
    if (act((d, a, now) => saveProductPrice(d, a, { productId: id, currency: code, amountMinor: minor }, catalog, now), "Manual price saved"))
      setDrafts((s) => { const n = { ...s }; delete n[id]; return n })
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <label className="font-ui text-[12px] font-semibold">Currency{" "}
          <select className={field} value={code} onChange={(e) => { setCode(e.target.value); setDrafts({}) }}>
            {priceCurrencies.map((c) => <option key={c.code} value={c.code}>{c.code}{c.enabled ? "" : " (disabled)"}</option>)}
          </select>
        </label>
        <input className={`${field} flex-1 min-w-[180px]`} placeholder="Search products or SKU" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!currency.enabled && <p className="font-ui text-[12px] mb-3 text-[#92400e]">{code} is disabled in the storefront. Prices can be prepared here but won't be shown until it is enabled.</p>}
      <div className="bg-white overflow-x-auto" style={card}>
        <table className="w-full" style={{ minWidth: 760 }}>
          <thead style={{ background: "var(--nb-surface)", color: "#8f9faf" }}>
            <tr>{["Product", "List price (product currency)", `Manual ${code}`, "Effective price", "Source", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const m = manual(p.id)
              const r = priceFor(p, code)
              const draft = drafts[p.id]
              return (
                <tr key={p.id} className="font-ui text-[12px]" style={{ borderTop: "1px solid var(--nb-bg)" }}>
                  <td className="px-3 py-2"><div className="font-semibold" style={{ color: NAVY }}>{p.name}</div><div className="text-[11px] text-[#8f9faf]">{p.sku}</div></td>
                  <td className="px-3 py-2 whitespace-nowrap">{p.price.toLocaleString()} {p.priceCurrency ?? LEGACY_PRICE_CURRENCY}</td>
                  <td className="px-3 py-2">
                    <input
                      className={`${field} w-32`}
                      inputMode="decimal"
                      aria-label={`Manual ${code} price for ${p.name}`}
                      placeholder={m ? "" : "not set"}
                      value={draft ?? (m ? minorToDecimalString(m.amountMinor, currency.decimals) : "")}
                      onChange={(e) => setDrafts((s) => ({ ...s, [p.id]: e.target.value }))}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap font-semibold" style={{ color: NAVY }}>
                    {r.ok ? formatMinor(r.unitMinor, currency) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.ok ? (
                      <span className="px-2 py-0.5 font-bold text-[10px]" style={{ background: r.method === "manual" ? "#ecfdf5" : "var(--nb-light-blue)", color: r.method === "manual" ? "#16a34a" : BLUE }}>
                        {r.method === "manual" ? "MANUAL" : "CONVERTED"}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 font-bold text-[10px]" style={{ background: "#fef2f2", color: "#b91c1c" }} title={r.reason}>UNAVAILABLE</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button disabled={draft === undefined} className="text-[12px] font-semibold mr-3 disabled:opacity-40" style={{ color: BLUE }} onClick={() => save(p.id)}>Save</button>
                    {m && <button className="text-[12px] font-semibold text-red-600" onClick={() => act((d, a, now) => deleteProductPrice(d, a, m.id, now), "Manual price removed")}>Remove</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ShippingTab() {
  const { db } = useCommerce()
  const act = useAdminAction()
  const [form, setForm] = useState({ countryCode: "LA", currency: db.settings.baseCurrency, amount: "" })
  const cur = db.currencies.find((c) => c.code === form.currency)
  return (
    <div className="grid gap-5">
      <form
        className="bg-white p-5 grid sm:grid-cols-4 gap-3 items-end"
        style={card}
        onSubmit={(e) => {
          e.preventDefault()
          const minor = cur ? parseDecimalToMinor(form.amount, cur.decimals) : null
          if (minor === null) { act(() => { throw new CommerceError("amount_invalid") }); return }
          if (act((d, a, now) => saveShippingRate(d, a, { countryCode: form.countryCode, currency: form.currency, amountMinor: minor, active: true }, now), "Shipping rate saved")) setForm({ ...form, amount: "" })
        }}
      >
        <label className="font-ui text-[12px] font-semibold">Destination
          <select className={`${field} w-full mt-1`} value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value })}>
            {SHIPPING_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
        <label className="font-ui text-[12px] font-semibold">Currency
          <select className={`${field} w-full mt-1`} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {db.currencies.map((c) => <option key={c.code}>{c.code}</option>)}
          </select>
        </label>
        <label className="font-ui text-[12px] font-semibold">Flat amount
          <input className={`${field} w-full mt-1`} inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        </label>
        <button className={btn} style={{ background: BLUE }}>Save rate</button>
        <p className="sm:col-span-4 font-ui text-[11px] text-[#52677D]">
          Flat rates you define per destination and currency. No carrier is integrated; where no active rate exists the customer sees “To be confirmed” and the order is placed with shipping unpriced.
        </p>
      </form>
      {db.shippingRates.length === 0 ? (
        <Empty>No shipping rates configured. All orders will show shipping as “To be confirmed”.</Empty>
      ) : (
        <div className="bg-white overflow-x-auto" style={card}>
          <table className="w-full" style={{ minWidth: 480 }}>
            <thead style={{ background: "var(--nb-surface)", color: "#8f9faf" }}>
              <tr>{["Destination", "Currency", "Amount", "Active", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {db.shippingRates.map((r) => {
                const c = db.currencies.find((x) => x.code === r.currency)
                return (
                  <tr key={r.id} className="font-ui text-[13px]" style={{ borderTop: "1px solid var(--nb-bg)" }}>
                    <td className="px-3 py-2.5">{SHIPPING_COUNTRIES.find((x) => x.code === r.countryCode)?.name ?? r.countryCode}</td>
                    <td className="px-3 py-2.5">{r.currency}</td>
                    <td className="px-3 py-2.5">{c ? formatMinor(r.amountMinor, c) : r.amountMinor}</td>
                    <td className="px-3 py-2.5">
                      <input type="checkbox" aria-label="Active" checked={r.active} style={{ accentColor: BLUE }}
                        onChange={(e) => act((d, a, now) => saveShippingRate(d, a, { countryCode: r.countryCode, currency: r.currency, amountMinor: r.amountMinor, active: e.target.checked }, now), "Shipping rate updated")} />
                    </td>
                    <td className="px-3 py-2.5"><button className="text-[12px] font-semibold text-red-600" onClick={() => act((d, a, now) => deleteShippingRate(d, a, r.id, now), "Shipping rate deleted")}>Delete</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AuditTab() {
  const { db } = useCommerce()
  const rows = [...db.audit].reverse().slice(0, 100)
  return rows.length === 0 ? (
    <Empty>No configuration changes recorded yet.</Empty>
  ) : (
    <div className="bg-white overflow-x-auto" style={card}>
      <table className="w-full" style={{ minWidth: 560 }}>
        <thead style={{ background: "var(--nb-surface)", color: "#8f9faf" }}>
          <tr>{["When (UTC)", "Actor", "Action", "Detail"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="font-ui text-[12px]" style={{ borderTop: "1px solid var(--nb-bg)" }}>
              <td className="px-3 py-2 whitespace-nowrap">{r.at.replace("T", " ").slice(0, 19)}</td>
              <td className="px-3 py-2">{r.actorId}</td>
              <td className="px-3 py-2">{r.action}</td>
              <td className="px-3 py-2 text-[#52677D]">{r.summary}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PricingAdmin() {
  const [tab, setTab] = useState("currencies")
  return (
    <div>
      <h2 className="font-display font-bold text-[22px] mb-1" style={{ color: NAVY }}>Currency &amp; Pricing</h2>
      <p className="font-ui text-[13px] mb-5 text-[#52677D]">Manual per-currency prices take priority, then conversion from the USD base price, otherwise the product is unavailable in that currency.</p>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[["currencies", "Currencies"], ["rates", "Exchange rates"], ["prices", "Product prices"], ["shipping", "Shipping rates"], ["audit", "Audit log"]]}
      />
      {tab === "currencies" && <CurrenciesTab />}
      {tab === "rates" && <RatesTab />}
      {tab === "prices" && <ProductPricesTab />}
      {tab === "shipping" && <ShippingTab />}
      {tab === "audit" && <AuditTab />}
    </div>
  )
}

// ─── Loyalty ──────────────────────────────────────────────────────────────────
const EARN_STATUSES: OrderStatus[] = ["Confirmed", "Processing", "Shipped", "Delivered"]

function RuleEditor({ rule }: { rule: LoyaltyRule }) {
  const { db } = useCommerce()
  const act = useAdminAction()
  const cur = db.currencies.find((c) => c.code === rule.currency)!
  const dec = cur.decimals
  const toStr = (n: number) => minorToDecimalString(n, dec)
  const [f, setF] = useState({
    enabled: rule.enabled,
    threshold: toStr(rule.spendThresholdMinor),
    points: String(rule.pointsPerThreshold),
    minOrder: toStr(rule.minOrderMinor),
    pointValue: toStr(rule.pointValueMinor),
    minRedeem: String(rule.minRedeemPoints),
    maxPct: String(rule.maxRedeemPercent),
    maxPerOrder: String(rule.maxPointsPerOrder),
    effectiveFrom: rule.effectiveFrom,
    statuses: rule.eligibleStatuses,
  })
  const save = () => {
    const next: LoyaltyRule = {
      ...rule,
      enabled: f.enabled,
      spendThresholdMinor: parseDecimalToMinor(f.threshold || "0", dec) ?? -1,
      pointsPerThreshold: Number(f.points),
      minOrderMinor: parseDecimalToMinor(f.minOrder || "0", dec) ?? -1,
      pointValueMinor: parseDecimalToMinor(f.pointValue || "0", dec) ?? -1,
      minRedeemPoints: Number(f.minRedeem),
      maxRedeemPercent: Number(f.maxPct),
      maxPointsPerOrder: Number(f.maxPerOrder),
      effectiveFrom: f.effectiveFrom,
      eligibleStatuses: f.statuses,
    }
    const problem = validateLoyaltyRule(next)
    act((d, a, now) => {
      if (problem) throw new CommerceError("loyalty_rule_invalid", { problem })
      saveLoyaltyRule(d, a, next, now)
    }, `${rule.currency} loyalty rule saved`)
  }
  const num = (key: keyof typeof f, label: string, hint?: string) => (
    <label className="font-ui text-[12px] font-semibold block">
      {label}
      <input className={`${field} w-full mt-1`} inputMode="decimal" value={String(f[key])} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
      {hint && <span className="block text-[10px] font-normal text-[#8f9faf] mt-0.5">{hint}</span>}
    </label>
  )
  return (
    <div className="bg-white p-5" style={card}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-[16px]" style={{ color: NAVY }}>{rule.currency} rule</h3>
        <label className="inline-flex items-center gap-2 font-ui text-[13px]">
          <input type="checkbox" checked={f.enabled} onChange={(e) => setF({ ...f, enabled: e.target.checked })} style={{ accentColor: BLUE }} />
          Enabled
        </label>
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {num("threshold", `Spend threshold (${rule.currency})`, "Every this much eligible spend…")}
        {num("points", "Points earned per threshold", "…earns this many points")}
        {num("minOrder", `Minimum order (${rule.currency})`, "0 = no minimum")}
        {num("pointValue", `Value of 1 point (${rule.currency})`, "Redemption value")}
        {num("minRedeem", "Minimum points to redeem")}
        {num("maxPct", "Max % of order payable with points")}
        {num("maxPerOrder", "Max points per order", "0 = no cap")}
        <label className="font-ui text-[12px] font-semibold block">
          Effective from
          <input type="date" className={`${field} w-full mt-1`} value={f.effectiveFrom} onChange={(e) => setF({ ...f, effectiveFrom: e.target.value })} />
        </label>
      </div>
      <fieldset className="mt-4">
        <legend className="font-ui text-[12px] font-semibold mb-1">Points are earned when an order reaches</legend>
        <div className="flex flex-wrap gap-4">
          {EARN_STATUSES.map((s) => (
            <label key={s} className="inline-flex items-center gap-1.5 font-ui text-[13px]">
              <input type="checkbox" checked={f.statuses.includes(s)} style={{ accentColor: BLUE }}
                onChange={(e) => setF({ ...f, statuses: e.target.checked ? [...f.statuses, s] : f.statuses.filter((x) => x !== s) })} />
              {s}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center justify-between mt-5">
        <span className="font-ui text-[11px] text-[#8f9faf]">Last updated {rule.updatedAt ? rule.updatedAt.slice(0, 10) : "—"} by {rule.updatedBy || "system"}. Existing orders keep the rule they were placed under.</span>
        <button className={btn} style={{ background: BLUE }} onClick={save}>Save rule</button>
      </div>
    </div>
  )
}

export function LoyaltyAdmin() {
  const { db } = useCommerce()
  const act = useAdminAction()
  const [tab, setTab] = useState("rules")
  const [customer, setCustomer] = useState("C-001")
  const [points, setPoints] = useState("")
  const [reason, setReason] = useState("")
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const actor = { id: "A-001", role: "admin" as const }
  const ledger = listLedger(db, actor, customer.trim())
  const balance = ledger.reduce((n, e) => n + e.points, 0)
  return (
    <div>
      <h2 className="font-display font-bold text-[22px] mb-1" style={{ color: NAVY }}>Loyalty Program</h2>
      <p className="font-ui text-[13px] mb-5 text-[#52677D]">Rules are configured per currency. The ledger is append-only: corrections are recorded as adjustments or reversals, never edits.</p>
      <Tabs value={tab} onChange={setTab} tabs={[["rules", "Rules"], ["ledger", "Ledger & adjustments"]]} />
      {tab === "rules" && (
        <div className="grid gap-5">
          {db.loyaltyRules.map((r) => <RuleEditor key={`${r.currency}-${r.updatedAt}`} rule={r} />)}
        </div>
      )}
      {tab === "ledger" && (
        <div className="grid gap-5">
          <div className="bg-white p-5 grid sm:grid-cols-4 gap-3 items-end" style={card}>
            <label className="font-ui text-[12px] font-semibold">Customer ID
              <input className={`${field} w-full mt-1`} value={customer} onChange={(e) => setCustomer(e.target.value)} />
            </label>
            <label className="font-ui text-[12px] font-semibold">Points (+/−)
              <input className={`${field} w-full mt-1`} inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} />
            </label>
            <label className="font-ui text-[12px] font-semibold">Reason (required)
              <input className={`${field} w-full mt-1`} value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <button
              className={btn}
              style={{ background: BLUE }}
              onClick={() => {
                const ok = act((d, a, now) => adjustPoints(d, a, { customerId: customer.trim(), points: Number(points), reason, requestId }, now), "Adjustment recorded")
                if (ok) { setPoints(""); setReason(""); setRequestId(crypto.randomUUID()) }
              }}
            >
              Record adjustment
            </button>
            <p className="sm:col-span-4 font-ui text-[12px] text-[#52677D]">Balance for {customer || "—"}: <strong style={{ color: NAVY }}>{balance.toLocaleString()}</strong> pts</p>
          </div>
          {ledger.length === 0 ? (
            <Empty>No ledger entries for this customer.</Empty>
          ) : (
            <div className="bg-white overflow-x-auto" style={card}>
              <table className="w-full" style={{ minWidth: 560 }}>
                <thead style={{ background: "var(--nb-surface)", color: "#8f9faf" }}>
                  <tr>{["When (UTC)", "Type", "Order", "Points", "Detail"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id} className="font-ui text-[12px]" style={{ borderTop: "1px solid var(--nb-bg)" }}>
                      <td className="px-3 py-2 whitespace-nowrap">{e.createdAt.replace("T", " ").slice(0, 19)}</td>
                      <td className="px-3 py-2">{e.type}</td>
                      <td className="px-3 py-2">{e.orderId ?? "—"}</td>
                      <td className="px-3 py-2 font-bold" style={{ color: e.points >= 0 ? "#16a34a" : "#b91c1c" }}>{e.points > 0 ? "+" : ""}{e.points}</td>
                      <td className="px-3 py-2 text-[#52677D]">{Object.entries(e.details).map(([k, v]) => `${k}: ${v}`).join(" · ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
