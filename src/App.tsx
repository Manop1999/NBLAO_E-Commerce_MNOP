import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom"
import { StoreProvider } from "./store"
import { CATALOG_SOURCE } from "./catalog/source"
import { CatalogProvider } from "./catalog/CatalogProvider"
import { AuthProvider, useAuth } from "./auth"
import { CommerceProvider } from "./commerce/CommerceProvider"
import { ToastProvider } from "./components/Toast"
import { PageLayout } from "./components/Layout"
import GlobalLanguage from "./components/GlobalLanguage"
import DemoBanner from "./components/DemoBanner"
import { useEffect } from "react"
import { pageTitleFor } from "./lib/pageTitle"

// Pages
import Home from "./pages/Home"
import Products from "./pages/Products"
import ProductDetail from "./pages/ProductDetail"
import Cart from "./pages/Cart"
import Checkout from "./pages/Checkout"
import RFQ from "./pages/RFQ"
import Account from "./pages/Account"
import Admin from "./pages/Admin"
import About from "./pages/About"
import Contact from "./pages/Contact"
import Login from "./pages/Login"
import Register from "./pages/Register"
import ForgotPassword from "./pages/ForgotPassword"
import AdminLogin from "./pages/AdminLogin"
import SetPassword from "./pages/SetPassword"
import NotFound from "./pages/NotFound"
import Compare from "./pages/Compare"
import Services from "./pages/Services"
import Privacy from "./pages/Privacy"
import Terms from "./pages/Terms"
import OrderDetail from "./pages/OrderDetail"
import QuotationDetail from "./pages/QuotationDetail"
import Partners from "./pages/Partners"
import Industries from "./pages/Industries"
import Sales from "./pages/Sales"

/** Shown while the first server session check runs (API mode), so no route decides before the server answers. */
function SessionCheck() {
  return (
    <div role="status" className="font-ui text-[13px] py-24 text-center" style={{ color: "var(--nb-text-secondary)" }}>
      Checking your session…
    </div>
  )
}

/** Customer pages: only a customer session counts (staff sessions never do). */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, ready } = useAuth()
  const location = useLocation()
  if (!ready) return <SessionCheck />
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

/** Admin Portal: only a staff session with full access (password and 2FA steps done, checked by the server). */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, ready } = useAuth()
  if (!ready) return <SessionCheck />
  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />
  }
  return <>{children}</>
}

function RouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    document.title = pageTitleFor(pathname)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <CatalogProvider>
    <StoreProvider>
      <AuthProvider>
        <CommerceProvider>
        <ToastProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <GlobalLanguage />
            <RouteTitle />
            <DemoBanner />
            <Routes>
              {/* Auth pages — standalone layout (no main nav) */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/account/set-password" element={<SetPassword />} />

              {/* Admin panel — its own layout */}
              <Route
                path="/admin/*"
                element={
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                }
              />

              {/* All public and protected routes share the main site Layout */}
              <Route
                path="/*"
                element={
                  <PageLayout>
                    <Routes>
                      <Route path="/" element={<Home />} />
                      <Route path="/products" element={<Products />} />
                      <Route path="/products/:id" element={<ProductDetail />} />
                      <Route path="/cart" element={<Cart />} />
                      <Route
                        path="/checkout"
                        element={
                          CATALOG_SOURCE === "api" ? (
                            <Checkout />
                          ) : (
                            <ProtectedRoute>
                              <Checkout />
                            </ProtectedRoute>
                          )
                        }
                      />
                      <Route path="/rfq" element={<RFQ />} />
                      <Route path="/compare" element={<Compare />} />
                      <Route path="/services" element={<Services />} />
                      <Route path="/industries" element={<Industries />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/partners" element={<Partners />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/sales" element={<Sales />} />

                      {/* Protected customer routes */}
                      <Route
                        path="/account"
                        element={
                          <ProtectedRoute>
                            <Account />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/account/orders/:id"
                        element={
                          <ProtectedRoute>
                            <OrderDetail />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/account/quotations/:id"
                        element={
                          <ProtectedRoute>
                            <QuotationDetail />
                          </ProtectedRoute>
                        }
                      />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </PageLayout>
                }
              />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
        </CommerceProvider>
      </AuthProvider>
    </StoreProvider>
    </CatalogProvider>
  )
}
