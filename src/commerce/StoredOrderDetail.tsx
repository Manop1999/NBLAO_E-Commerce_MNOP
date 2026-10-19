import { Link } from "react-router-dom"
import { Order } from "./engine"
import { useCT, fill } from "./text"
import { AddressLines } from "./AddressForm"
import { OrderStatusBadge, orderMoney } from "./AccountPanels"

const NAVY = "var(--nb-navy)"
const BLUE = "var(--nb-primary)"

export function StoredOrderDetail({ order }: { order: Order }) {
  const ct = useCT()
  const m = (n: number) => orderMoney(order, n)
  const row = (label: string, value: string, strong = false) => (
    <div className="flex justify-between gap-4 py-1.5 font-ui text-[13px]" style={{ color: strong ? NAVY : "var(--nb-text-secondary)" }}>
      <span className={strong ? "font-bold" : ""}>{label}</span>
      <span className={strong ? "font-bold text-[16px]" : ""} style={{ color: NAVY }}>{value}</span>
    </div>
  )
  return (
    <div style={{ background: "var(--nb-bg)" }}>
      <div className="max-w-[1100px] mx-auto px-6 py-8">
        <Link to="/account?tab=orders" className="font-ui text-[12px] no-underline" style={{ color: BLUE }}>← {ct.orders.title}</Link>
        <div className="flex flex-wrap items-center gap-3 mt-3 mb-6">
          <h1 className="font-display font-extrabold text-[28px]" style={{ color: NAVY }}>{order.id}</h1>
          <OrderStatusBadge status={order.status} />
          <span className="font-ui text-[11px] font-bold px-2.5 py-1" style={{ background: order.paymentStatus === "paid" ? "#ecfdf5" : "#fef9ec", color: order.paymentStatus === "paid" ? "#16a34a" : "#92400e" }}>
            {ct.status[order.paymentStatus]}
          </span>
          <span className="font-ui text-[11px] font-bold px-2.5 py-1" style={{ background: "var(--nb-light-blue)", color: BLUE }}>{order.currency}</span>
        </div>
        <div className="grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="bg-white" style={{ border: "1px solid var(--nb-border)" }}>
            <div className="px-5 py-3 font-display font-bold text-[14px]" style={{ color: NAVY, borderBottom: "1px solid var(--nb-border)" }}>{ct.orders.items}</div>
            {order.lines.map((l) => (
              <div key={l.productId} className="px-5 py-4 flex justify-between gap-4" style={{ borderBottom: "1px solid var(--nb-bg)" }}>
                <div className="min-w-0">
                  <div className="font-ui text-[13px] font-semibold" style={{ color: NAVY }}>{l.name}</div>
                  <div className="font-ui text-[11px]" style={{ color: "#8f9faf" }}>
                    SKU {l.sku} · {l.qty} × {m(l.unitPriceMinor)}
                  </div>
                  <div className="font-ui text-[11px]" style={{ color: "#8f9faf" }}>
                    {l.method === "base" ? ct.orders.method.base : l.method === "manual" ? fill(ct.orders.method.manual, { code: order.currency }) : fill(ct.orders.method.converted, { rate: l.fxRate ?? "" })}
                    {l.promoApplied ? ` · ${ct.promo}` : ""}
                  </div>
                </div>
                <div className="font-display font-bold text-[14px] shrink-0" style={{ color: NAVY }}>{m(l.lineTotalMinor)}</div>
              </div>
            ))}
            <p className="px-5 py-3 font-ui text-[11px]" style={{ color: "#8f9faf" }}>{ct.orders.snapshot_note}</p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="bg-white p-5" style={{ border: "1px solid var(--nb-border)" }}>
              <div className="font-display font-bold text-[14px] mb-2" style={{ color: NAVY }}>{ct.orders.order_summary}</div>
              {row(ct.checkout.subtotal, m(order.subtotalMinor))}
              {order.loyaltyDiscountMinor > 0 && row(`${ct.checkout.points_discount} (${order.loyaltyRedeemedPoints})`, `−${m(order.loyaltyDiscountMinor)}`)}
              {row(ct.checkout.shipping, order.shippingStatus === "calculated" ? m(order.shippingMinor) : ct.checkout.shipping_tbc)}
              {row(ct.checkout.tax, ct.checkout.tax_none)}
              <div style={{ borderTop: "2px solid var(--nb-border)", marginTop: 8, paddingTop: 8 }}>{row(ct.checkout.total, m(order.totalMinor), true)}</div>
            </div>
            <div className="bg-white p-5" style={{ border: "1px solid var(--nb-border)" }}>
              <div className="font-display font-bold text-[14px] mb-2" style={{ color: NAVY }}>{ct.orders.delivery_address}</div>
              <AddressLines a={order.address} />
              {order.notes && <p className="font-ui text-[12px] mt-2" style={{ color: "var(--nb-text-secondary)" }}>{order.notes}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
