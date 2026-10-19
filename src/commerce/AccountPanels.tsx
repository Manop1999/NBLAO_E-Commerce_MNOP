import { useState } from "react"
import { Link } from "react-router-dom"
import { useCommerce } from "./CommerceProvider"
import { useCT, fill } from "./text"
import { useExplain } from "./ui"
import { AddressForm, AddressLines, EMPTY_ADDRESS } from "./AddressForm"
import {
  AddressInput,
  CustomerAddress,
  CommerceError,
  Order,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  listAddresses,
  listLedger,
  listOrders,
  loyaltyBalance,
  validateAddressInput,
} from "./engine"
import { formatMinor } from "./money"
import { useToast } from "../components/Toast"
import { ConfirmModal } from "../components/Modal"
import { useStore } from "../store"

const NAVY = "var(--nb-navy)"
const BLUE = "var(--nb-primary)"
const GOLD = "var(--nb-gold)"

export const orderMoney = (o: Order, minor: number) =>
  formatMinor(minor, { code: o.currency, symbol: o.currencySymbol, decimals: o.currencyDecimals })

export function useMyOrders() {
  const { db, actor } = useCommerce()
  return actor?.role === "customer" ? listOrders(db, actor) : []
}

export function useMyPoints() {
  const { db, actor } = useCommerce()
  return actor?.role === "customer" ? loyaltyBalance(db, actor.id) : 0
}

const STATUS_COLORS: Record<string, string> = {
  Delivered: "#16a34a",
  Shipped: "#0099FF",
  Processing: "#0099FF",
  Confirmed: "#007ACC",
  Pending: "#d97706",
  Cancelled: "#ef4444",
  Refunded: "#7c3aed",
}

export function OrderStatusBadge({ status }: { status: string }) {
  const ct = useCT()
  const color = STATUS_COLORS[status] || "#94a3b8"
  return (
    <span className="font-ui text-[10px] font-bold tracking-wide px-2.5 py-1 whitespace-nowrap" style={{ background: `${color}18`, color }}>
      {(ct.status as Record<string, string>)[status] ?? status}
    </span>
  )
}

export function StoredOrders() {
  const orders = useMyOrders()
  const ct = useCT()
  if (!orders.length) return null
  return (
    <div className="bg-white mb-6" style={{ border: "1px solid var(--nb-border)" }}>
      {orders.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--nb-bg)" }}>
          <div className="min-w-0">
            <div className="font-display font-bold text-[13px]" style={{ color: NAVY }}>{o.id}</div>
            <div className="font-ui text-[11px] mt-0.5" style={{ color: "#8f9faf" }}>
              {o.createdAt.slice(0, 10)} · {o.lines.reduce((n, l) => n + l.qty, 0)} {ct.orders.items.toLowerCase()} · {ct.status[o.paymentStatus]}
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-display font-bold text-[14px]" style={{ color: NAVY }}>{orderMoney(o, o.totalMinor)}</span>
            <OrderStatusBadge status={o.status} />
            <Link to={`/account/orders/${o.id}`} className="font-ui text-[11px] font-semibold no-underline px-3 py-1.5" style={{ background: BLUE, color: "#fff" }}>
              →
            </Link>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AddressBook() {
  const { db, actor, run } = useCommerce()
  const ct = useCT()
  const explain = useExplain()
  const { addToast } = useToast()
  const { lang } = useStore()
  void lang
  const mine = actor?.role === "customer" ? listAddresses(db, actor) : []
  const [editing, setEditing] = useState<{ id?: string; value: AddressInput } | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toDelete, setToDelete] = useState<CustomerAddress | null>(null)

  const save = () => {
    if (!editing) return
    const errs = validateAddressInput(editing.value)
    setErrors(errs)
    if (Object.keys(errs).length) return
    try {
      run((d, a, _c, now) =>
        editing.id ? updateAddress(d, a, editing.id, editing.value, now) : createAddress(d, a, editing.value, now),
      )
      addToast(ct.address.saved, "success")
      setEditing(null)
    } catch (e) {
      if (e instanceof CommerceError && e.code === "address_invalid") setErrors((e.params?.errors as Record<string, string>) ?? {})
      addToast(explain(e), "error")
    }
  }

  const remove = () => {
    if (!toDelete) return
    try {
      run((d, a) => deleteAddress(d, a, toDelete.id))
      addToast(ct.address.deleted, "success")
    } catch (e) {
      addToast(explain(e), "error")
    }
    setToDelete(null)
  }

  const makeDefault = (id: string) => {
    try {
      run((d, a) => setDefaultAddress(d, a, id))
    } catch (e) {
      addToast(explain(e), "error")
    }
  }

  const startNew = () => {
    setErrors({})
    setEditing({
      value: {
        ...EMPTY_ADDRESS,
        recipientName: "",
      },
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="font-display font-bold text-[22px]" style={{ color: NAVY }}>{ct.address.title}</h2>
          <p className="font-ui text-[13px] mt-1" style={{ color: "var(--nb-text-secondary)" }}>{ct.address.subtitle}</p>
        </div>
        {!editing && (
          <button onClick={startNew} className="font-ui text-[12px] font-semibold px-4 py-2.5 text-white" style={{ background: BLUE }}>
            + {ct.address.add}
          </button>
        )}
      </div>

      {editing ? (
        <div className="bg-white p-5 sm:p-6" style={{ border: "1px solid var(--nb-border)" }}>
          <AddressForm value={editing.value} onChange={(value) => setEditing({ ...editing, value })} errors={errors} showDefault />
          <div className="flex justify-end gap-3 mt-6">
            <button onClick={() => setEditing(null)} className="font-ui text-[13px] font-semibold px-5 py-2.5" style={{ border: `1px solid ${NAVY}`, color: NAVY }}>
              {ct.address.cancel}
            </button>
            <button onClick={save} className="font-ui text-[13px] font-semibold px-6 py-2.5 text-white" style={{ background: BLUE }}>
              {ct.address.save}
            </button>
          </div>
        </div>
      ) : mine.length === 0 ? (
        <div className="bg-white py-14 text-center px-6" style={{ border: "1px solid var(--nb-border)" }}>
          <p className="font-display font-bold text-[16px] mb-1" style={{ color: NAVY }}>{ct.address.empty}</p>
          <p className="font-ui text-[13px] mb-5" style={{ color: "var(--nb-text-secondary)" }}>{ct.address.empty_desc}</p>
          <button onClick={startNew} className="font-ui text-[13px] font-semibold px-6 py-3 text-white" style={{ background: BLUE }}>{ct.address.add}</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {mine.map((a) => (
            <div key={a.id} className="bg-white p-5 flex flex-col" style={{ border: `1px solid ${a.isDefault ? BLUE : "var(--nb-border)"}` }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-display font-bold text-[14px]" style={{ color: NAVY }}>{a.label}</span>
                {a.isDefault && <span className="font-ui text-[10px] px-1.5 py-0.5 text-white" style={{ background: GOLD }}>{ct.address.default}</span>}
              </div>
              <AddressLines a={a} className="flex-1" />
              <div className="flex flex-wrap gap-2 mt-4 font-ui text-[12px] font-semibold">
                <button onClick={() => { setErrors({}); setEditing({ id: a.id, value: { ...a, isDefault: a.isDefault } }) }} style={{ color: BLUE }}>{ct.address.edit}</button>
                {!a.isDefault && <button onClick={() => makeDefault(a.id)} style={{ color: NAVY }}>{ct.address.set_default}</button>}
                <button onClick={() => setToDelete(a)} className="ml-auto" style={{ color: "#ef4444" }}>{ct.address.delete}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
        title={ct.address.delete}
        message={ct.address.confirm_delete}
        confirmLabel={ct.address.delete}
        confirmDanger
      />
    </div>
  )
}

export function LoyaltyPanel() {
  const { db, actor, currency, fmt } = useCommerce()
  const ct = useCT()
  const mine = actor?.role === "customer" ? actor : null
  const ledger = mine ? listLedger(db, mine, mine.id) : []
  const balance = ledger.reduce((n, e) => n + e.points, 0)
  const earned = ledger.filter((e) => e.points > 0 && (e.type === "earn" || e.type === "adjustment")).reduce((n, e) => n + e.points, 0)
  const redeemed = -ledger.filter((e) => e.type === "redeem").reduce((n, e) => n + e.points, 0)
  const rule = db.loyaltyRules.find((r) => r.currency === currency.code)
  const statusList = rule?.eligibleStatuses.map((s) => ct.status[s]).join(", ") ?? ""
  const dateOf = (iso: string) => iso.slice(0, 10)

  return (
    <div>
      <h2 className="font-display font-bold text-[22px] mb-4" style={{ color: NAVY }}>{ct.loyalty.title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          [ct.loyalty.balance, balance, GOLD],
          [ct.loyalty.earned, earned, BLUE],
          [ct.loyalty.redeemed, redeemed, "#7c3aed"],
        ].map(([label, value, color]) => (
          <div key={label as string} className="bg-white p-5" style={{ border: "1px solid var(--nb-border)" }}>
            <div className="font-display font-extrabold text-[28px] leading-none mb-1" style={{ color: color as string }}>{(value as number).toLocaleString()}</div>
            <div className="font-ui text-[12px]" style={{ color: "var(--nb-text-secondary)" }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white p-5 mb-6" style={{ border: "1px solid var(--nb-border)" }}>
        <h3 className="font-display font-bold text-[15px] mb-2" style={{ color: NAVY }}>{ct.loyalty.how} · {currency.code}</h3>
        {rule && rule.enabled ? (
          <ul className="font-ui text-[13px] leading-relaxed list-disc pl-5" style={{ color: "var(--nb-text-secondary)" }}>
            <li>{fill(ct.loyalty.earn_rule, { points: rule.pointsPerThreshold, amount: fmt(rule.spendThresholdMinor), code: currency.code })}</li>
            <li>{fill(ct.loyalty.redeem_rule, { value: fmt(rule.pointValueMinor), percent: rule.maxRedeemPercent, min: rule.minRedeemPoints })}</li>
            <li>{fill(ct.loyalty.eligible_policy, { statuses: statusList })}</li>
            <li>{ct.loyalty.reversal_policy}</li>
          </ul>
        ) : (
          <p className="font-ui text-[13px]" style={{ color: "var(--nb-text-secondary)" }}>{fill(ct.loyalty.rule_off, { code: currency.code })}</p>
        )}
      </div>

      <h3 className="font-display font-bold text-[16px] mb-3" style={{ color: NAVY }}>{ct.loyalty.history}</h3>
      {ledger.length === 0 ? (
        <div className="bg-white py-12 text-center px-6" style={{ border: "1px solid var(--nb-border)" }}>
          <p className="font-display font-bold text-[15px] mb-1" style={{ color: NAVY }}>{ct.loyalty.empty}</p>
          <p className="font-ui text-[13px]" style={{ color: "var(--nb-text-secondary)" }}>{ct.loyalty.empty_desc}</p>
        </div>
      ) : (
        <div className="bg-white overflow-x-auto" style={{ border: "1px solid var(--nb-border)" }}>
          <table className="w-full font-ui text-[12px]">
            <thead>
              <tr className="text-left" style={{ background: "var(--nb-surface)", color: "#8f9faf" }}>
                <th className="px-4 py-2.5 font-semibold">{ct.loyalty.date}</th>
                <th className="px-4 py-2.5 font-semibold">{ct.loyalty.type}</th>
                <th className="px-4 py-2.5 font-semibold">{ct.loyalty.order}</th>
                <th className="px-4 py-2.5 font-semibold text-right">{ct.loyalty.points}</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((e) => (
                <tr key={e.id} style={{ borderTop: "1px solid var(--nb-bg)" }}>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--nb-text-secondary)" }}>{dateOf(e.createdAt)}</td>
                  <td className="px-4 py-2.5" style={{ color: NAVY }}>{ct.loyalty.types[e.type]}</td>
                  <td className="px-4 py-2.5">{e.orderId ? <Link to={`/account/orders/${e.orderId}`} style={{ color: BLUE }}>{e.orderId}</Link> : "—"}</td>
                  <td className="px-4 py-2.5 text-right font-bold" style={{ color: e.points >= 0 ? "#16a34a" : "#b91c1c" }}>
                    {e.points > 0 ? "+" : ""}{e.points.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
