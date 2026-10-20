import { useState } from "react"
import BrandLogo from "../components/BrandLogo"
import { Link } from "react-router-dom"
import { ORDERS, QUOTATIONS } from "../data"
import { useStore } from "../store"
import { StoredOrdersAdmin, PricingAdmin, LoyaltyAdmin } from "../commerce/AdminPanels"
import BrandManagement from "../components/admin/BrandManagement"
import ProductManagement from "../components/admin/ProductManagement"
import ReviewModeration from "../components/admin/ReviewModeration"
import { getStockStatus, STOCK_STATUS_STYLE } from "../lib/stockStatus"
import {
  AdvertisementManagement,
  CustomerServiceManagement,
  PartnerManagement,
} from "../components/admin/ContentManagement"
import LeadershipManagement from "../components/admin/LeadershipManagement"
import SalesManagement from "../components/admin/SalesManagement"
import { assetUrl } from "../lib/assetUrl"

const NAVY = "var(--nb-navy)"
const BLUE = "var(--nb-primary)"
const GOLD = "var(--nb-gold)"
const SIDEBAR_BG = "#070f1e"

const DashboardIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </svg>
)
const ProductsIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
  </svg>
)
const OrdersIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
)
const QuoteIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)
const UsersIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)
const InventoryIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
)
const ReportsIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
)
const SettingsIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M4.93 19.07l1.41-1.41M18.66 18.66l-1.41-1.41M22 12h-2M2 12h2" />
  </svg>
)
const BrandsIcon = () => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L3.41 13.4a2 2 0 0 1 0-2.82V4h6.59a2 2 0 0 1 1.41.59l9.18 9.18a2 2 0 0 1 0 2.82z" />
    <circle cx="7.5" cy="8.5" r="1.5" />
  </svg>
)
const BackIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
)

const STATUS_COLORS: Record<string, string> = {
  Delivered: "#16a34a",
  Processing: "var(--nb-primary)",
  Pending: "#d97706",
  Cancelled: "#ef4444",
  Quoted: "#7c3aed",
  Accepted: "#16a34a",
  Rejected: "#ef4444",
  Expired: "#94a3b8",
  "Low Stock": "#d97706",
  "In Stock": "#16a34a",
}
const Badge = ({ label }: { label: string }) => {
  const c = STATUS_COLORS[label] || "#94a3b8"
  return (
    <span
      className="rounded-sm font-ui text-[10px] font-700 tracking-wide px-2 py-0.5"
      style={{ background: `${c}18`, color: c }}
    >
      {label}
    </span>
  )
}

const SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: <DashboardIcon /> },
  { id: "products", label: "Products", icon: <ProductsIcon /> },
  { id: "sales", label: "Sales & Promotions", icon: <ReportsIcon /> },
  { id: "brands", label: "Brand Logos", icon: <BrandsIcon /> },
  { id: "advertisements", label: "Advertisements", icon: <ReportsIcon /> },
  { id: "partners", label: "Business Partners", icon: <BrandsIcon /> },
  { id: "leadership", label: "Leadership", icon: <UsersIcon /> },
  { id: "customer-service", label: "Customer Service", icon: <SettingsIcon /> },
  { id: "reviews", label: "Reviews", icon: <ReportsIcon /> },
  { id: "inventory", label: "Inventory", icon: <InventoryIcon /> },
  { id: "orders", label: "Orders", icon: <OrdersIcon /> },
  { id: "pricing", label: "Currency & Pricing", icon: <ReportsIcon /> },
  { id: "loyalty", label: "Loyalty", icon: <UsersIcon /> },
  { id: "quotations", label: "Quotations", icon: <QuoteIcon /> },
  { id: "customers", label: "Customers", icon: <UsersIcon /> },
  { id: "reports", label: "Reports", icon: <ReportsIcon /> },
  { id: "settings", label: "Settings", icon: <SettingsIcon /> },
]

const CUSTOMERS = [
  {
    id: "C-001",
    name: "Lao Power Co., Ltd.",
    contact: "John Doe",
    email: "j.doe@laopower.la",
    orders: 5,
    spent: 92000,
    status: "Active",
  },
  {
    id: "C-002",
    name: "Mekong Industrial Group",
    contact: "Sara Chen",
    email: "s.chen@mig.la",
    orders: 3,
    spent: 48000,
    status: "Active",
  },
  {
    id: "C-003",
    name: "VTE Construction",
    contact: "Mike Vong",
    email: "m.vong@vtec.la",
    orders: 8,
    spent: 185000,
    status: "Active",
  },
  {
    id: "C-004",
    name: "Lao Cement Plant",
    contact: "Alice Nam",
    email: "a.nam@lcp.la",
    orders: 2,
    spent: 28000,
    status: "Inactive",
  },
]

function DashboardPanel() {
  const { allProducts: products } = useStore()
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2
          className="font-display font-700 text-[22px]"
          style={{ color: NAVY }}
        >
          Dashboard Overview
        </h2>
        <div
          className="rounded-md font-ui text-[12px] px-3 py-1.5"
          style={{
            background: "var(--nb-bg)",
            color: "var(--nb-text-secondary)",
            border: "1px solid var(--nb-border)",
          }}
        >
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {[
          {
            label: "Total Orders",
            value: ORDERS.length,
            sub: "+2 this week",
            color: BLUE,
          },
          {
            label: "Pending RFQs",
            value: 3,
            sub: "Needs attention",
            color: "#d97706",
          },
          {
            label: "Total Products",
            value: products.length,
            sub: `${products.filter((p) => ['low', 'out'].includes(getStockStatus({ stock: p.stock, active: p.active !== false }))).length} low or out of stock`,
            color: NAVY,
          },
          {
            label: "Revenue (USD)",
            value:
              "$" + ORDERS.reduce((s, o) => s + o.total, 0).toLocaleString(),
            sub: "From all orders",
            color: "#16a34a",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-lg bg-white p-5"
            style={{ border: "1px solid var(--nb-border)" }}
          >
            <div
              className="font-display font-800 text-[26px] leading-none mb-1"
              style={{ color: k.color }}
            >
              {k.value}
            </div>
            <div
              className="font-display font-700 text-[13px] mb-0.5"
              style={{ color: NAVY }}
            >
              {k.label}
            </div>
            <div className="font-ui text-[11px]" style={{ color: "#8f9faf" }}>
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="grid lg:grid-cols-2 gap-5">
        <div>
          <div
            className="font-display font-700 text-[14px] mb-3"
            style={{ color: NAVY }}
          >
            Recent Orders
          </div>
          <div
            className="rounded-lg bg-white"
            style={{ border: "1px solid var(--nb-border)" }}
          >
            {ORDERS.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: "1px solid var(--nb-bg)" }}
              >
                <div>
                  <div
                    className="font-ui text-[12px] font-600"
                    style={{ color: NAVY }}
                  >
                    {o.id}
                  </div>
                  <div
                    className="font-ui text-[11px]"
                    style={{ color: "#8f9faf" }}
                  >
                    {o.date}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className="font-display font-700 text-[13px]"
                    style={{ color: NAVY }}
                  >
                    ${o.total.toLocaleString()}
                  </span>
                  <Badge label={o.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low stock alert */}
        <div>
          <div
            className="font-display font-700 text-[14px] mb-3"
            style={{ color: NAVY }}
          >
            Inventory Alerts
          </div>
          <div
            className="rounded-lg bg-white"
            style={{ border: "1px solid var(--nb-border)" }}
          >
            {products
              .filter((p) => ['low', 'out'].includes(getStockStatus({ stock: p.stock, active: p.active !== false })))
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-3"
                  style={{ borderBottom: "1px solid var(--nb-bg)" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-md overflow-hidden shrink-0"
                      style={{
                        width: 40,
                        height: 30,
                        background: "var(--nb-bg)",
                      }}
                    >
                      <img
                        src={assetUrl(p.img)}
                        alt={p.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div
                        className="font-ui text-[12px] font-600"
                        style={{ color: NAVY }}
                      >
                        {p.name}
                      </div>
                      <div
                        className="font-ui text-[10px]"
                        style={{ color: "#8f9faf" }}
                      >
                        SKU: {p.sku}
                      </div>
                    </div>
                  </div>
                  {(() => { const st = STOCK_STATUS_STYLE[getStockStatus({ stock: p.stock, active: p.active !== false })]; return <span className="rounded-sm font-ui text-[10px] font-700 px-2 py-0.5" style={{ background: st.bg, color: st.color }}>{st.label}</span> })()}
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function OrdersPanel() {
  return (
    <div>
      <StoredOrdersAdmin />
      <h2
        className="font-display font-700 text-[22px] mb-5"
        style={{ color: NAVY }}
      >
        Order Management
      </h2>
      <div
        className="rounded-lg bg-white overflow-x-auto"
        style={{ border: "1px solid var(--nb-border)" }}
      >
        <table className="w-full" style={{ minWidth: 620 }}>
          <thead>
            <tr
              style={{
                background: "var(--nb-surface)",
                borderBottom: "1px solid var(--nb-border)",
              }}
            >
              {[
                "Order ID",
                "Date",
                "Items",
                "Total",
                "Delivery",
                "Status",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-ui text-[10px] font-700 tracking-widest uppercase"
                  style={{ color: "#8f9faf" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ORDERS.map((o, i) => (
              <tr
                key={o.id}
                style={{
                  borderBottom: "1px solid var(--nb-bg)",
                  background: i % 2 === 0 ? "#fff" : "var(--nb-surface)",
                }}
              >
                <td
                  className="px-4 py-3 font-display font-700 text-[13px]"
                  style={{ color: NAVY }}
                >
                  {o.id}
                </td>
                <td
                  className="px-4 py-3 font-ui text-[12px]"
                  style={{ color: "var(--nb-text-secondary)" }}
                >
                  {o.date}
                </td>
                <td
                  className="px-4 py-3 font-ui text-[12px]"
                  style={{ color: "var(--nb-text-secondary)" }}
                >
                  {o.items.length} item{o.items.length !== 1 ? "s" : ""}
                </td>
                <td
                  className="px-4 py-3 font-display font-700 text-[14px]"
                  style={{ color: NAVY }}
                >
                  ${o.total.toLocaleString()}
                </td>
                <td
                  className="px-4 py-3 font-ui text-[12px]"
                  style={{ color: "var(--nb-text-secondary)" }}
                >
                  {o.deliveryDate}
                </td>
                <td className="px-4 py-3">
                  <Badge label={o.status} />
                </td>
                <td className="px-4 py-3">
                  <button
                    className="rounded-sm font-ui text-[11px] px-2.5 py-1"
                    style={{
                      border: "1px solid var(--nb-border)",
                      color: "#475569",
                    }}
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function QuotationsPanel() {
  return (
    <div>
      <h2
        className="font-display font-700 text-[22px] mb-5"
        style={{ color: NAVY }}
      >
        RFQ & Quotation Management
      </h2>
      <div
        className="rounded-lg bg-white overflow-x-auto"
        style={{ border: "1px solid var(--nb-border)" }}
      >
        <table className="w-full" style={{ minWidth: 520 }}>
          <thead>
            <tr
              style={{
                background: "var(--nb-surface)",
                borderBottom: "1px solid var(--nb-border)",
              }}
            >
              {[
                "Ref.",
                "Date",
                "Valid Until",
                "Total",
                "Status",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-ui text-[10px] font-700 tracking-widest uppercase"
                  style={{ color: "#8f9faf" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {QUOTATIONS.map((q, i) => (
              <tr
                key={q.id}
                style={{
                  borderBottom: "1px solid var(--nb-bg)",
                  background: i % 2 === 0 ? "#fff" : "var(--nb-surface)",
                }}
              >
                <td
                  className="px-4 py-3 font-display font-700 text-[13px]"
                  style={{ color: NAVY }}
                >
                  {q.id}
                </td>
                <td
                  className="px-4 py-3 font-ui text-[12px]"
                  style={{ color: "var(--nb-text-secondary)" }}
                >
                  {q.date}
                </td>
                <td
                  className="px-4 py-3 font-ui text-[12px]"
                  style={{ color: "var(--nb-text-secondary)" }}
                >
                  {q.validUntil}
                </td>
                <td
                  className="px-4 py-3 font-display font-700 text-[14px]"
                  style={{ color: NAVY }}
                >
                  ${q.total.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <Badge label={q.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      className="rounded-sm font-ui text-[11px] px-2.5 py-1"
                      style={{
                        border: "1px solid var(--nb-border)",
                        color: "#475569",
                      }}
                    >
                      View
                    </button>
                    {q.status === "Pending" && (
                      <button
                        className="rounded-sm font-ui text-[11px] px-2.5 py-1 text-white"
                        style={{ background: BLUE }}
                      >
                        Quote
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CustomersPanel() {
  return (
    <div>
      <h2
        className="font-display font-700 text-[22px] mb-5"
        style={{ color: NAVY }}
      >
        Customer Management
      </h2>
      <div
        className="rounded-lg bg-white overflow-x-auto"
        style={{ border: "1px solid var(--nb-border)" }}
      >
        <table className="w-full" style={{ minWidth: 560 }}>
          <thead>
            <tr
              style={{
                background: "var(--nb-surface)",
                borderBottom: "1px solid var(--nb-border)",
              }}
            >
              {[
                "Company",
                "Contact",
                "Orders",
                "Total Spent",
                "Status",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-ui text-[10px] font-700 tracking-widest uppercase"
                  style={{ color: "#8f9faf" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CUSTOMERS.map((c, i) => (
              <tr
                key={c.id}
                style={{
                  borderBottom: "1px solid var(--nb-bg)",
                  background: i % 2 === 0 ? "#fff" : "var(--nb-surface)",
                }}
              >
                <td className="px-4 py-3">
                  <div
                    className="font-ui text-[12px] font-600"
                    style={{ color: NAVY }}
                  >
                    {c.name}
                  </div>
                  <div
                    className="font-ui text-[10px]"
                    style={{ color: "#8f9faf" }}
                  >
                    {c.id}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div
                    className="font-ui text-[12px]"
                    style={{ color: "var(--nb-text-secondary)" }}
                  >
                    {c.contact}
                  </div>
                  <div
                    className="font-ui text-[11px]"
                    style={{ color: "#8f9faf" }}
                  >
                    {c.email}
                  </div>
                </td>
                <td
                  className="px-4 py-3 font-ui text-[12px]"
                  style={{ color: "var(--nb-text-secondary)" }}
                >
                  {c.orders}
                </td>
                <td
                  className="px-4 py-3 font-display font-700 text-[13px]"
                  style={{ color: NAVY }}
                >
                  ${c.spent.toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <Badge label={c.status} />
                </td>
                <td className="px-4 py-3">
                  <button
                    className="rounded-sm font-ui text-[11px] px-2.5 py-1"
                    style={{
                      border: "1px solid var(--nb-border)",
                      color: "#475569",
                    }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const PANELS: Record<string, React.ReactNode> = {
  dashboard: <DashboardPanel />,
  products: <ProductManagement />,
  sales: <SalesManagement />,
  brands: <BrandManagement />,
  advertisements: <AdvertisementManagement />,
  partners: <PartnerManagement />,
  leadership: <LeadershipManagement />,
  "customer-service": <CustomerServiceManagement />,
  reviews: <ReviewModeration />,
  inventory: <ProductManagement />,
  orders: <OrdersPanel />,
  pricing: <PricingAdmin />,
  loyalty: <LoyaltyAdmin />,
  quotations: <QuotationsPanel />,
  customers: <CustomersPanel />,
  reports: (
    <div className="font-display font-700 text-[22px]" style={{ color: NAVY }}>
      Reports — Coming Soon
    </div>
  ),
  settings: (
    <div className="font-display font-700 text-[22px]" style={{ color: NAVY }}>
      Settings — Coming Soon
    </div>
  ),
}

const MenuIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)
const CloseMenuIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export default function Admin() {
  const [active, setActive] = useState("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleNav = (id: string) => {
    setActive(id)
    setSidebarOpen(false)
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div
        className="px-5 py-5"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-[2px] mb-4"
          style={{
            background: `linear-gradient(90deg, ${GOLD} 0%, transparent 100%)`,
          }}
        />
        <div className="flex flex-col gap-2">
          <BrandLogo onDark className="h-9" />
          <div className="font-ui text-[8px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
            Admin Portal
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4">
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            onClick={() => handleNav(sec.id)}
            className="rounded-md w-full flex items-center gap-3 px-3 py-2.5 mb-0.5 text-left transition-all"
            style={{
              background:
                active === sec.id ? "rgba(0,153,255,0.12)" : "transparent",
              color: active === sec.id ? "#fff" : "rgba(255,255,255,0.45)",
              borderLeft: `2px solid ${
                active === sec.id ? BLUE : "transparent"
              }`,
            }}
          >
            <span
              style={{
                color: active === sec.id ? BLUE : "rgba(255,255,255,0.35)",
              }}
            >
              {sec.icon}
            </span>
            <span className="font-ui text-[13px] font-500">{sec.label}</span>
          </button>
        ))}
      </nav>

      {/* Back to site */}
      <div
        className="px-4 py-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <Link
          to="/"
          className="flex items-center gap-2 font-ui text-[12px] no-underline"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          <BackIcon /> Back to Website
        </Link>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen" style={{ background: "var(--nb-bg)" }}>
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex fixed top-0 left-0 bottom-0 flex-col w-56 shrink-0 overflow-y-auto"
        style={{ background: SIDEBAR_BG, zIndex: 40 }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="flex flex-col w-64 overflow-y-auto"
            style={{ background: SIDEBAR_BG }}
          >
            <SidebarContent />
          </div>
          <div
            className="flex-1"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={() => setSidebarOpen(false)}
          />
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-56 min-w-0">
        {/* Top bar */}
        <div
          className="bg-white px-4 lg:px-8 py-3 lg:py-4 flex items-center justify-between sticky top-0 z-30"
          style={{ borderBottom: "1px solid var(--nb-border)" }}
        >
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 -ml-1"
              style={{ color: NAVY }}
              onClick={() => setSidebarOpen(true)}
            >
              <MenuIcon />
            </button>
            <div
              className="font-display font-700 text-[14px] lg:text-[15px]"
              style={{ color: NAVY }}
            >
              {SECTIONS.find((s) => s.id === active)?.label}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="font-ui text-[12px] hidden sm:block"
              style={{ color: "var(--nb-text-secondary)" }}
            >
              Admin User
            </div>
            <div
              className="w-7 h-7 lg:w-8 lg:h-8 flex items-center justify-center font-display font-700 text-white text-[12px]"
              style={{ background: NAVY }}
            >
              A
            </div>
          </div>
        </div>

        {/* Panel */}
        <div className="p-4 sm:p-6 lg:p-8">{PANELS[active]}</div>
      </main>
    </div>
  )
}
