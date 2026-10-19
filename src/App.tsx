import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom"
import { StoreProvider } from "./store"
import { AuthProvider, useAuth } from "./auth"
import { CommerceProvider } from "./commerce/CommerceProvider"
import { ToastProvider } from "./components/Toast"
import { PageLayout } from "./components/Layout"
import GlobalLanguage from "./components/GlobalLanguage"

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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) {
    return <Navigate to="/admin/login" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <StoreProvider>
      <AuthProvider>
        <CommerceProvider>
        <ToastProvider>
          <BrowserRouter>
            <GlobalLanguage />
            <Routes>
              {/* Auth pages — standalone layout (no main nav) */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/admin/login" element={<AdminLogin />} />

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
                          <ProtectedRoute>
                            <Checkout />
                          </ProtectedRoute>
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
  )
}
