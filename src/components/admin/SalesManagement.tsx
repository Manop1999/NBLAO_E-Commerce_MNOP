import { FormEvent, useState } from "react"
import { useStore, type SalesPlacement } from "../../store"

const NAVY = "var(--nb-navy)"
const BLUE = "var(--nb-primary)"
const fieldClass =
  "rounded-md mt-1 w-full bg-white px-3 py-2.5 font-ui text-[12px] outline-none"
const fieldStyle = { border: "1px solid var(--nb-border)", color: NAVY }

const newPlacement = (order: number): SalesPlacement => ({
  id: `sales-${Date.now()}`,
  productId: 0,
  type: "promotion",
  active: true,
  displayOrder: order,
})

export default function SalesManagement() {
  const {
    allProducts: products,
    salesPlacements,
    saveSalesPlacement,
    deleteSalesPlacement,
  } = useStore()
  const [editing, setEditing] = useState<SalesPlacement | null>(null)
  const [error, setError] = useState("")
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    const product = products.find((item) => item.id === editing.productId)
    if (!product) return setError("Select an existing product.")
    if (
      editing.startDate &&
      editing.endDate &&
      editing.startDate > editing.endDate
    )
      return setError("End date must be on or after the start date.")
    if (
      editing.type === "promotion" &&
      (!editing.promotionalPrice ||
        editing.promotionalPrice <= 0 ||
        editing.promotionalPrice >= product.price)
    )
      return setError(
        "Promotion price must be greater than zero and lower than the base product price.",
      )
    if (
      salesPlacements.some(
        (item) =>
          item.id !== editing.id &&
          item.type === editing.type &&
          item.productId === editing.productId &&
          item.active &&
          editing.active,
      )
    )
      return setError("This product already has an active entry of this type.")
    saveSalesPlacement({
      ...editing,
      promotionalPrice:
        editing.type === "promotion" ? editing.promotionalPrice : undefined,
    })
    setEditing(null)
  }
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2
            className="font-display text-[22px] font-700"
            style={{ color: NAVY }}
          >
            Sales & Promotions
          </h2>
          <p className="mt-1 font-ui text-[12px] text-slate-500">
            Manage public promotions and recommended products. Featured products
            remain controlled through Product Management.
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(newPlacement(salesPlacements.length + 1))
            setError("")
          }}
          className="rounded-md shrink-0 px-4 py-2.5 font-ui text-[12px] font-600 text-white"
          style={{ background: BLUE }}
        >
          + Add selection
        </button>
      </div>
      <div
        className="rounded-lg overflow-x-auto bg-white"
        style={{ border: "1px solid var(--nb-border)" }}
      >
        <table className="w-full min-w-[720px]">
          <thead>
            <tr className="border-b bg-slate-50">
              {[
                "Product",
                "Placement",
                "Promotion price",
                "Schedule",
                "Status",
                "Order",
                "Actions",
              ].map((label) => (
                <th
                  key={label}
                  className="px-4 py-3 text-left font-ui text-[10px] font-700 uppercase tracking-wider text-slate-500"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {salesPlacements.map((item) => {
              const product = products.find((p) => p.id === item.productId)
              return (
                <tr key={item.id} className="border-b border-slate-100">
                  <td
                    className="px-4 py-3 font-ui text-[12px] font-600"
                    style={{ color: NAVY }}
                  >
                    {product?.name || "Deleted product"}
                  </td>
                  <td className="px-4 py-3 font-ui text-[12px] capitalize">
                    {item.type}
                  </td>
                  <td className="px-4 py-3 font-ui text-[12px]">
                    {item.promotionalPrice
                      ? `$${item.promotionalPrice.toLocaleString()}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 font-ui text-[11px] text-slate-500">
                    {item.startDate || "Now"} – {item.endDate || "No end"}
                  </td>
                  <td className="px-4 py-3 font-ui text-[12px]">
                    {item.active ? "Enabled" : "Disabled"}
                  </td>
                  <td className="px-4 py-3 font-ui text-[12px]">
                    {item.displayOrder}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => {
                        setEditing(item)
                        setError("")
                      }}
                      className="rounded-sm mr-2 border border-slate-300 px-2.5 py-1 font-ui text-[11px]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteSalesPlacement(item.id)}
                      className="rounded-sm border border-red-200 px-2.5 py-1 font-ui text-[11px] text-red-600"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={submit}
            className="rounded-lg w-full max-w-xl bg-white p-5 sm:p-7"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3
                className="font-display text-[20px] font-700"
                style={{ color: NAVY }}
              >
                {salesPlacements.some((item) => item.id === editing.id)
                  ? "Edit selection"
                  : "Add sales selection"}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-slate-500"
              >
                Close
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="font-ui text-[11px] text-slate-600">
                Product
                <select
                  value={editing.productId}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      productId: Number(event.target.value),
                    })
                  }
                  className={fieldClass}
                  style={fieldStyle}
                >
                  <option value={0}>Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} (${product.price.toLocaleString()})
                    </option>
                  ))}
                </select>
              </label>
              <label className="font-ui text-[11px] text-slate-600">
                Placement
                <select
                  value={editing.type}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      type: event.target.value as SalesPlacement["type"],
                    })
                  }
                  className={fieldClass}
                  style={fieldStyle}
                >
                  <option value="promotion">Promotional Products</option>
                  <option value="recommended">Recommended Products</option>
                </select>
              </label>
              {editing.type === "promotion" && (
                <label className="font-ui text-[11px] text-slate-600">
                  Promotion price (USD)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={editing.promotionalPrice ?? ""}
                    onChange={(event) =>
                      setEditing({
                        ...editing,
                        promotionalPrice: Number(event.target.value),
                      })
                    }
                    className={fieldClass}
                    style={fieldStyle}
                  />
                </label>
              )}
              <label className="font-ui text-[11px] text-slate-600">
                Display order
                <input
                  type="number"
                  min="1"
                  value={editing.displayOrder}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      displayOrder: Math.max(1, Number(event.target.value)),
                    })
                  }
                  className={fieldClass}
                  style={fieldStyle}
                />
              </label>
              <label className="font-ui text-[11px] text-slate-600">
                Start date (optional)
                <input
                  type="date"
                  value={editing.startDate || ""}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      startDate: event.target.value || undefined,
                    })
                  }
                  className={fieldClass}
                  style={fieldStyle}
                />
              </label>
              <label className="font-ui text-[11px] text-slate-600">
                End date (optional)
                <input
                  type="date"
                  value={editing.endDate || ""}
                  onChange={(event) =>
                    setEditing({
                      ...editing,
                      endDate: event.target.value || undefined,
                    })
                  }
                  className={fieldClass}
                  style={fieldStyle}
                />
              </label>
              <label
                className="flex items-center gap-2 self-end pb-2 font-ui text-[12px]"
                style={{ color: NAVY }}
              >
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(event) =>
                    setEditing({ ...editing, active: event.target.checked })
                  }
                />{" "}
                Enabled
              </label>
            </div>
            {error && (
              <p className="mt-4 font-ui text-[12px] text-red-600">{error}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-md border border-slate-300 px-4 py-2 font-ui text-[12px]"
              >
                Cancel
              </button>
              <button
                className="rounded-md px-5 py-2 font-ui text-[12px] font-600 text-white"
                style={{ background: BLUE }}
              >
                Save selection
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
