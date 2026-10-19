import { normalizeProduct } from "./lib/productNormalize"
import { hasVariants } from "./lib/variants"
import { type Lang, normalizeLang, DEFAULT_LANG, LANG_STORAGE_KEY, HTML_LANG } from "./lib/language"
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  createElement,
} from "react"
import {
  Brand,
  DEFAULT_BRANDS,
  getActiveBrands,
  getBrand,
  sortBrands,
} from "./brands"
import { Product, PRODUCTS } from "./data"
import { applyDemoDefaults, ensureProductLists } from "./lib/demoProducts"
import {
  Advertisement,
  CustomerServiceSettings,
  DEFAULT_ADVERTISEMENTS,
  LEGACY_DEFAULT_AD_ID,
  DEFAULT_CUSTOMER_SERVICE,
  DEFAULT_LEADERSHIP,
  DEFAULT_PARTNERS,
  getActiveAdvertisements,
  LeadershipItem,
  migrateCustomerService,
  Partner,
} from "./content"

export interface CartItem {
  id: number
  name: string
  sku: string
  price: number
  qty: number
  img: string
  category: string
  brand: string
  stock: number
  priceUnit?: string
  variantId?: string
  variantLabel?: string
}

export const sameLine = (a: { id: number; variantId?: string }, id: number, variantId?: string) =>
  a.id === id && (a.variantId ?? '') === (variantId ?? '')

export interface RFQItem {
  id: number
  name: string
  sku: string
  img: string
  qty: number
  category: string
  variantId?: string
  variantLabel?: string
}

export interface Address {
  id: string
  name: string
  company: string
  phone: string
  address: string
  district: string
  province: string
  postalCode: string
  country: string
  isDefault: boolean
}

export interface SalesPlacement {
  id: string
  productId: number
  type: "promotion" | "recommended"
  active: boolean
  displayOrder: number
  promotionalPrice?: number
  startDate?: string
  endDate?: string
}

interface StoreCtx {
  cart: CartItem[]
  wishlist: number[]
  compare: number[]
  rfqItems: RFQItem[]
  addresses: Address[]
  addToCart: (item: Omit<CartItem, "qty">, qty?: number) => void
  removeFromCart: (id: number, variantId?: string) => void
  updateQty: (id: number, qty: number, variantId?: string) => void
  clearCart: () => void
  toggleWishlist: (id: number) => void
  toggleCompare: (id: number) => void
  addToRFQ: (item: Omit<RFQItem, "qty">, qty?: number) => void
  removeFromRFQ: (id: number, variantId?: string) => void
  updateRFQQty: (id: number, qty: number, variantId?: string) => void
  clearRFQ: () => void
  cartTotal: number
  cartCount: number
  addAddress: (addr: Omit<Address, "id">) => void
  updateAddress: (id: string, addr: Partial<Address>) => void
  deleteAddress: (id: string) => void
  setDefaultAddress: (id: string) => void
  activeDrawer: "nav" | "filters" | null
  setActiveDrawer: (d: "nav" | "filters" | null) => void
  lang: Lang
  setLang: (l: Lang) => void
  brands: Brand[]
  activeBrands: Brand[]
  getBrandById: (id: string) => Brand | undefined
  saveBrand: (brand: Brand) => void
  toggleBrandStatus: (id: string) => void
  deleteBrand: (id: string) => void
  /** Active products only (storefront). */
  products: Product[]
  /** Every product including inactive ones (admin, commerce engine). */
  allProducts: Product[]
  saveProduct: (product: Product) => void
  deleteProduct: (id: number) => void
  salesPlacements: SalesPlacement[]
  saveSalesPlacement: (placement: SalesPlacement) => void
  deleteSalesPlacement: (id: string) => void
  advertisements: Advertisement[]
  activeAdvertisements: Advertisement[]
  saveAdvertisement: (advertisement: Advertisement) => void
  deleteAdvertisement: (id: string) => void
  customerService: CustomerServiceSettings
  saveCustomerService: (settings: CustomerServiceSettings) => void
  partners: Partner[]
  savePartner: (partner: Partner) => void
  deletePartner: (id: string) => void
  leadership: LeadershipItem[]
  saveLeadershipItem: (item: LeadershipItem) => void
  deleteLeadershipItem: (id: string) => void
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

// Browsers still holding only the untouched original sample ad get the initial campaigns; any Admin-edited list is kept.
function migrateLegacyAdvertisements(saved: Advertisement[]): Advertisement[] {
  const legacy = DEFAULT_LEGACY_AD
  const untouched =
    saved.length === 1 &&
    saved[0].id === LEGACY_DEFAULT_AD_ID &&
    saved[0].titleEn === legacy.titleEn &&
    saved[0].destinationUrl === legacy.destinationUrl &&
    saved[0].active === true
  return untouched ? DEFAULT_ADVERTISEMENTS : saved
}

const DEFAULT_LEGACY_AD = {
  titleEn: "Engineered Power Solutions for Industry",
  destinationUrl: "/products?category=Power%20%26%20Energy",
}

const DEMO_SEED_KEY = "nblao_demo_seed_v1"

function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota exceeded or private mode */
  }
}

// Keep the context identity stable across Vite hot updates. Without this,
// a preserved Layout module can retain a consumer for an older context while
// App renders a provider created by the refreshed store module.
const contextHost = globalThis as typeof globalThis & {
  __nbLaoStoreContext__?: ReturnType<typeof createContext<StoreCtx | null>>
}
const Ctx =
  contextHost.__nbLaoStoreContext__ ??
  (contextHost.__nbLaoStoreContext__ = createContext<StoreCtx | null>(null))

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => load("nblao_cart", []))
  const [wishlist, setWishlist] = useState<number[]>(() =>
    load("nblao_wishlist", []),
  )
  const [compare, setCompare] = useState<number[]>(() =>
    load("nblao_compare", []),
  )
  const [rfqItems, setRFQItems] = useState<RFQItem[]>(() =>
    load("nblao_rfq", []),
  )
  const [addresses, setAddresses] = useState<Address[]>(() =>
    load("nblao_addresses", []),
  )
  const [brands, setBrands] = useState<Brand[]>(() =>
    load("nblao_brands", DEFAULT_BRANDS),
  )
  const [products, setProducts] = useState<Product[]>(() => {
    // Demo defaults are applied once per saved product id, so later Admin edits (incl. removing variants) stick.
    const seeded = new Set(load<number[]>(DEMO_SEED_KEY, []))
    const loaded = load<Product[]>("nblao_products", PRODUCTS).map((product) => {
      const bundledProduct = PRODUCTS.find((item) => item.id === product.id)
      if (!bundledProduct) return ensureProductLists(product)
      if (!seeded.has(product.id)) product = applyDemoDefaults(product)
      return {
        ...product,
        img: product.img.includes("images.unsplash.com")
          ? bundledProduct.img
          : product.img,
        images: product.images.map((image, index) =>
          image.includes("images.unsplash.com")
            ? bundledProduct.images[index] || bundledProduct.img
            : image,
        ),
      }
    })
    save(DEMO_SEED_KEY, Array.from(new Set([...seeded, ...PRODUCTS.map((p) => p.id)])))
    return loaded
  })
  const [salesPlacements, setSalesPlacements] = useState<SalesPlacement[]>(() =>
    load("nblao_sales_placements", []),
  )
  const [advertisements, setAdvertisements] = useState<Advertisement[]>(() =>
    migrateLegacyAdvertisements(load<Advertisement[]>("nblao_advertisements", DEFAULT_ADVERTISEMENTS)).map(
      (advertisement) => ({
        ...advertisement,
        placement: advertisement.placement || "main",
        image: advertisement.image.includes("photo-1509390144018-eeaf65052242")
          ? "/advertisements/power-solutions.jpg"
          : advertisement.image,
      }),
    ),
  )
  const [customerService, setCustomerService] =
    useState<CustomerServiceSettings>(() =>
      migrateCustomerService(load("nblao_customer_service", DEFAULT_CUSTOMER_SERVICE)),
    )
  const [partners, setPartners] = useState<Partner[]>(() =>
    load("nblao_partners", DEFAULT_PARTNERS),
  )
  const [leadership, setLeadership] = useState<LeadershipItem[]>(() =>
    load("nblao_leadership", DEFAULT_LEADERSHIP),
  )
  const [activeDrawer, setActiveDrawer] = useState<"nav" | "filters" | null>(
    null,
  )
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return normalizeLang(localStorage.getItem(LANG_STORAGE_KEY))
    } catch {
      return DEFAULT_LANG
    }
  })
  const setLang = (raw: Lang) => {
    const l = normalizeLang(raw)
    setLangState(l)
    try {
      localStorage.setItem(LANG_STORAGE_KEY, l)
    } catch {
      /* quota */
    }
  }

  useEffect(() => {
    save("nblao_cart", cart)
  }, [cart])
  useEffect(() => {
    save("nblao_wishlist", wishlist)
  }, [wishlist])
  useEffect(() => {
    save("nblao_compare", compare)
  }, [compare])
  useEffect(() => {
    save("nblao_rfq", rfqItems)
  }, [rfqItems])
  useEffect(() => {
    save("nblao_addresses", addresses)
  }, [addresses])
  useEffect(() => {
    save("nblao_brands", brands)
  }, [brands])
  useEffect(() => {
    save("nblao_products", products)
  }, [products])
  useEffect(() => {
    save("nblao_sales_placements", salesPlacements)
  }, [salesPlacements])
  useEffect(() => {
    save("nblao_advertisements", advertisements)
  }, [advertisements])
  useEffect(() => {
    save("nblao_customer_service", customerService)
  }, [customerService])
  useEffect(() => {
    save("nblao_partners", partners)
  }, [partners])
  useEffect(() => {
    save("nblao_leadership", leadership)
  }, [leadership])
  useEffect(() => {
    document.documentElement.lang = HTML_LANG[lang]
  }, [lang])

  const addToCart = (item: Omit<CartItem, "qty">, qty = 1) => {
    const src = products.find((p) => p.id === item.id)
    if (!item.variantId && src && hasVariants(src)) {
      window.dispatchEvent(new CustomEvent("nblao:variant-required", { detail: { id: item.id } }))
      return
    }
    if (item.stock <= 0) return
    window.dispatchEvent(new CustomEvent("nblao:cart-added", { detail: { name: item.name, variantLabel: item.variantLabel } }))
    setCart((prev) => {
      const existing = prev.find((c) => sameLine(c, item.id, item.variantId))
      if (existing)
        return prev.map((c) =>
          c === existing ? { ...c, price: item.price, stock: item.stock, qty: Math.max(1, Math.min(c.qty + qty, item.stock)) } : c,
        )
      return [...prev, { ...item, qty: Math.max(1, Math.min(qty, item.stock)) }]
    })
  }

  const removeFromCart = (id: number, variantId?: string) =>
    setCart((p) => p.filter((c) => !sameLine(c, id, variantId)))

  const updateQty = (id: number, qty: number, variantId?: string) => {
    if (qty < 1) return removeFromCart(id, variantId)
    setCart((p) =>
      p.map((c) => (sameLine(c, id, variantId) ? { ...c, qty: Math.min(qty, c.stock) } : c)),
    )
  }

  const clearCart = () => setCart([])

  const toggleWishlist = (id: number) =>
    setWishlist((p) =>
      p.includes(id) ? p.filter((w) => w !== id) : [...p, id],
    )

  const toggleCompare = (id: number) =>
    setCompare((p) =>
      p.includes(id)
        ? p.filter((c) => c !== id)
        : p.length < 4
          ? [...p, id]
          : p,
    )

  const addToRFQ = (item: Omit<RFQItem, "qty">, qty = 1) => {
    const src = products.find((p) => p.id === item.id)
    if (!item.variantId && src && hasVariants(src)) {
      window.dispatchEvent(new CustomEvent("nblao:variant-required", { detail: { id: item.id } }))
      return
    }
    setRFQItems((prev) => {
      const existing = prev.find((r) => sameLine(r, item.id, item.variantId))
      if (existing)
        return prev.map((r) => (r === existing ? { ...r, qty: r.qty + qty } : r))
      return [...prev, { ...item, qty }]
    })
  }

  const removeFromRFQ = (id: number, variantId?: string) =>
    setRFQItems((p) => p.filter((r) => !sameLine(r, id, variantId)))

  const updateRFQQty = (id: number, qty: number, variantId?: string) => {
    if (qty < 1) return removeFromRFQ(id, variantId)
    setRFQItems((p) => p.map((r) => (sameLine(r, id, variantId) ? { ...r, qty } : r)))
  }

  const clearRFQ = () => setRFQItems([])

  const addAddress = (addr: Omit<Address, "id">) => {
    const id = `addr-${Date.now()}`
    setAddresses((prev) => {
      const list = addr.isDefault
        ? prev.map((a) => ({ ...a, isDefault: false }))
        : prev
      return [...list, { ...addr, id }]
    })
  }

  const updateAddress = (id: string, addr: Partial<Address>) => {
    setAddresses((prev) => {
      let list = prev
      if (addr.isDefault) list = prev.map((a) => ({ ...a, isDefault: false }))
      return list.map((a) => (a.id === id ? { ...a, ...addr } : a))
    })
  }

  const deleteAddress = (id: string) =>
    setAddresses((p) => p.filter((a) => a.id !== id))

  const setDefaultAddress = (id: string) =>
    setAddresses((p) => p.map((a) => ({ ...a, isDefault: a.id === id })))

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0)
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0)
  const activeBrands = getActiveBrands(brands)
  const getBrandById = (id: string) => getBrand(brands, id)
  const saveBrand = (brand: Brand) =>
    setBrands((prev) => {
      const ordered = sortBrands(prev).filter((item) => item.id !== brand.id)
      const targetIndex = Math.max(
        0,
        Math.min(brand.displayOrder - 1, ordered.length),
      )
      ordered.splice(targetIndex, 0, brand)
      return ordered.map((item, index) => ({
        ...item,
        displayOrder: index + 1,
      }))
    })
  const toggleBrandStatus = (id: string) =>
    setBrands((prev) =>
      prev.map((brand) =>
        brand.id === id ? { ...brand, active: !brand.active } : brand,
      ),
    )
  const deleteBrand = (id: string) =>
    setBrands((prev) =>
      sortBrands(prev.filter((brand) => brand.id !== id)).map(
        (brand, index) => ({ ...brand, displayOrder: index + 1 }),
      ),
    )
  const saveProduct = (raw: Product) => {
    const product = normalizeProduct(raw)
    setProducts((prev) =>
      prev.some((item) => item.id === product.id)
        ? prev.map((item) => (item.id === product.id ? product : item))
        : [...prev, product],
    )
  }
  const deleteProduct = (id: number) =>
    setProducts((prev) => prev.filter((product) => product.id !== id))
  const saveSalesPlacement = (placement: SalesPlacement) =>
    setSalesPlacements((prev) => {
      const next = prev.some((item) => item.id === placement.id)
        ? prev.map((item) => (item.id === placement.id ? placement : item))
        : [...prev, placement]
      return next
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((item, index) => ({ ...item, displayOrder: index + 1 }))
    })
  const deleteSalesPlacement = (id: string) =>
    setSalesPlacements((prev) =>
      prev
        .filter((item) => item.id !== id)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((item, index) => ({ ...item, displayOrder: index + 1 })),
    )
  const saveAdvertisement = (advertisement: Advertisement) =>
    setAdvertisements((prev) =>
      prev.some((item) => item.id === advertisement.id)
        ? prev.map((item) =>
            item.id === advertisement.id ? advertisement : item,
          )
        : [...prev, advertisement],
    )
  const deleteAdvertisement = (id: string) =>
    setAdvertisements((prev) =>
      prev.filter((advertisement) => advertisement.id !== id),
    )
  const saveCustomerService = (settings: CustomerServiceSettings) =>
    setCustomerService({ ...settings, userConfigured: true })
  const savePartner = (partner: Partner) =>
    setPartners((prev) =>
      prev.some((item) => item.id === partner.id)
        ? prev.map((item) => (item.id === partner.id ? partner : item))
        : [...prev, partner],
    )
  const deletePartner = (id: string) =>
    setPartners((prev) => prev.filter((partner) => partner.id !== id))
  const saveLeadershipItem = (item: LeadershipItem) =>
    setLeadership((prev) => {
      const next = prev.some((current) => current.id === item.id)
        ? prev.map((current) => (current.id === item.id ? item : current))
        : [...prev, item]
      return next
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((current, index) => ({ ...current, displayOrder: index + 1 }))
    })
  const deleteLeadershipItem = (id: string) =>
    setLeadership((prev) =>
      prev
        .filter((item) => item.id !== id)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((item, index) => ({ ...item, displayOrder: index + 1 })),
    )
  const activeAdvertisements = getActiveAdvertisements(advertisements)

  return createElement(
    Ctx.Provider,
    {
      value: {
        cart,
        wishlist,
        compare,
        rfqItems,
        addresses,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        toggleWishlist,
        toggleCompare,
        addToRFQ,
        removeFromRFQ,
        updateRFQQty,
        clearRFQ,
        cartTotal,
        cartCount,
        addAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        activeDrawer,
        setActiveDrawer,
        lang,
        setLang,
        brands,
        activeBrands,
        getBrandById,
        saveBrand,
        toggleBrandStatus,
        deleteBrand,
        products: products.filter((p) => p.active !== false),
        allProducts: products,
        saveProduct,
        deleteProduct,
        salesPlacements,
        saveSalesPlacement,
        deleteSalesPlacement,
        advertisements,
        activeAdvertisements,
        saveAdvertisement,
        deleteAdvertisement,
        customerService,
        saveCustomerService,
        partners,
        savePartner,
        deletePartner,
        leadership,
        saveLeadershipItem,
        deleteLeadershipItem,
      },
    },
    children,
  )
}

export const useStore = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useStore must be used within StoreProvider")
  return ctx
}
