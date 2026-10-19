import { ChangeEvent, FormEvent, useState } from 'react'
import { CATEGORIES, CATEGORY_SUBS, Product } from '../../data'
import { useStore } from '../../store'
import { getBrandName } from '../../brands'
import VariantEditor from './VariantEditor'
import { useCommerce } from '../../commerce/CommerceProvider'
import { LEGACY_PRICE_CURRENCY } from '../../commerce/engine'
import { validateVariants, aggregateStock, hasVariants, isObsoleteVariant } from '../../lib/variants'
import { getStockStatus, STOCK_STATUS_STYLE } from '../../lib/stockStatus'

const CATALOG_AUDIT_KEY = 'nblao_catalog_audit'
function logCatalogAudit(action: string, product: Product, detail: string) {
  try {
    const log = JSON.parse(localStorage.getItem(CATALOG_AUDIT_KEY) || '[]')
    log.push({ at: new Date().toISOString(), actor: 'admin', action, productId: product.id, sku: product.sku, detail })
    localStorage.setItem(CATALOG_AUDIT_KEY, JSON.stringify(log.slice(-500)))
  } catch { /* audit is best effort when storage is full */ }
}

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const fieldClass = 'rounded-md w-full font-ui text-[12px] px-3 py-2.5 outline-none bg-white'
const fieldStyle = { border: '1px solid var(--nb-border)', color: NAVY }

function newProduct(id: number): Product {
  return {
    id, name: '', sku: '', brandId: '', category: CATEGORIES[0],
    subcategory: CATEGORY_SUBS[CATEGORIES[0]][0], model: '', price: 0,
    priceDisplay: '$0', priceUnit: 'per unit', stock: 0, stockLabel: 'Out of Stock',
    img: '', images: [], shortDesc: '', description: '', spec: '', specs: [],
    applications: [], tags: [], featured: false, certifications: [],
  }
}

const readImages = (files: FileList) =>
  Promise.all(Array.from(files).map(file => new Promise<string>((resolve, reject) => {
    if (!file.type.startsWith('image/') || file.size > 4 * 1024 * 1024) {
      reject(new Error('Use image files no larger than 4 MB.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Unable to read image.'))
    reader.readAsDataURL(file)
  })))

export default function ProductManagement() {
  const { allProducts: products, brands, lang, saveProduct, deleteProduct } = useStore()
  const { db } = useCommerce()
  const currencyOf = (p: Product) => p.priceCurrency ?? LEGACY_PRICE_CURRENCY
  const currencyInfo = (code: string) => db.currencies.find(c => c.code === code)
  const [editing, setEditing] = useState<Product | null>(null)
  const [error, setError] = useState('')

  const setField = <K extends keyof Product>(key: K, value: Product[K]) =>
    setEditing(current => current ? { ...current, [key]: value } : current)

  const handleImages = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !editing) return
    try {
      const uploaded = await readImages(event.target.files)
      const images = [...editing.images, ...uploaded]
      setEditing({ ...editing, images, img: editing.img || images[0] || '' })
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to upload images.')
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    const images = editing.images.filter(Boolean)
    if (!editing.name.trim() || !editing.sku.trim() || !editing.brandId || !editing.category || (!editing.img && images.length === 0)) {
      setError('Name, SKU, brand, category, and a product image are required.')
      return
    }
    const options = (editing.options ?? []).filter(o => o.name.trim())
    const variants = options.length ? (editing.variants ?? []) : []
    const otherSkus = products.filter(p => p.id !== editing.id).flatMap(p => [p.sku, ...(p.variants ?? []).map(v => v.sku)])
    if (otherSkus.some(x => x.trim().toLowerCase() === editing.sku.trim().toLowerCase())) {
      setError('This SKU is already used by another product.')
      return
    }
    const issues = validateVariants(options, variants, otherSkus)
    if (issues.length) { setError(issues[0].message); return }
    const previous = products.find(p => p.id === editing.id)
    const dropped = (previous?.variants ?? []).filter(pv => !variants.some(v => v.id === pv.id))
    // Variants referenced by history are never removed; they are kept as inactive.
    const kept = [...variants, ...dropped].map(v => (isObsoleteVariant(options, v) || dropped.includes(v) ? { ...v, active: false, visible: false } : v))
    const nextStock = hasVariants({ options, variants: kept }) ? aggregateStock({ price: editing.price, stock: editing.stock, variants: kept }) : editing.stock
    logCatalogAudit(previous ? 'product.update' : 'product.create', editing, `variants=${kept.length}, stock=${nextStock}, active=${editing.active !== false}`)
    saveProduct({
      ...editing,
      options,
      variants: kept.length ? kept : undefined,
      stock: nextStock,
      name: editing.name.trim(),
      sku: editing.sku.trim(),
      priceCurrency: currencyOf(editing),
      priceDisplay: `${currencyInfo(currencyOf(editing))?.symbol ?? ''}${editing.price.toLocaleString()} ${currencyOf(editing)}`,
      stockLabel: STOCK_STATUS_STYLE[getStockStatus({ stock: nextStock, active: editing.active !== false })].label,
      images,
      img: editing.img || images[0] || '',
    })
    setEditing(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="font-display font-700 text-[22px]" style={{ color: NAVY }}>Product Management</h2>
          <p className="font-ui text-[12px] mt-1 text-slate-500">Product images here are used across the storefront, comparison, and related products.</p>
        </div>
        <button onClick={() => setEditing({ ...newProduct(Math.max(0, ...products.map(product => product.id)) + 1), priceCurrency: db.settings.baseCurrency })} className="rounded-md font-ui text-[12px] font-600 px-4 py-2.5 text-white" style={{ background: BLUE }}>+ Add Product</button>
      </div>

      <div className="rounded-lg bg-white overflow-x-auto" style={{ border: '1px solid var(--nb-border)' }}>
        <table className="w-full min-w-[760px]">
          <thead><tr className="bg-slate-50 border-b border-slate-200">
            {['Product', 'SKU', 'Brand', 'Category', 'Price', 'Stock', 'Featured', 'Actions'].map(label => <th key={label} className="px-4 py-3 text-left font-ui text-[10px] font-700 uppercase tracking-wider text-slate-500">{label}</th>)}
          </tr></thead>
          <tbody>
            {products.map(product => (
              <tr key={product.id} className="border-b border-slate-100">
                <td className="px-4 py-3"><div className="flex items-center gap-3">
                  <img src={product.img || '/product-placeholder.svg'} onError={event => { event.currentTarget.src = '/product-placeholder.svg' }} alt="" className="w-12 h-10 object-contain bg-slate-50" />
                  <span className="font-ui text-[12px] font-600 max-w-52 line-clamp-2" style={{ color: NAVY }}>{product.name}</span>
                </div></td>
                <td className="px-4 py-3 font-ui text-[11px] text-slate-500">{product.sku}</td>
                <td className="px-4 py-3 font-ui text-[12px] text-slate-600">{getBrandName(brands.find(brand => brand.id === product.brandId), lang)}</td>
                <td className="px-4 py-3 font-ui text-[11px] text-slate-600">{product.category}</td>
                <td className="px-4 py-3 font-display font-700 text-[13px]" style={{ color: NAVY }}>{product.priceDisplay}</td>
                <td className="px-4 py-3 font-ui text-[12px]">{product.stock}{product.variants?.length ? <span className="text-slate-400"> ({product.variants.length} var.)</span> : null}{product.active === false && <span className="ml-1 rounded-sm px-1.5 py-0.5 text-[10px] font-600" style={{ background: '#E2E8F0', color: '#475569' }}>Inactive</span>}</td>
                <td className="px-4 py-3 font-ui text-[11px]">{product.featured ? 'Yes' : 'No'}</td>
                <td className="px-4 py-3"><div className="flex gap-2">
                  <button onClick={() => { setEditing({ ...product, images: [...product.images] }); setError('') }} className="rounded-sm font-ui text-[11px] px-2.5 py-1 border border-slate-300 text-slate-600">Edit</button>
                  <button onClick={() => window.confirm('Delete this product?') && deleteProduct(product.id)} className="rounded-sm font-ui text-[11px] px-2.5 py-1 border border-red-200 text-red-600">Delete</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <form onSubmit={submit} className="rounded-lg bg-white w-full max-w-4xl max-h-[90vh] overflow-y-auto p-5 sm:p-7">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-display font-700 text-[20px]" style={{ color: NAVY }}>{products.some(product => product.id === editing.id) ? 'Edit Product' : 'Add Product'}</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-500">Close</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="font-ui text-[11px] text-slate-600">Product name<input value={editing.name} onChange={event => setField('name', event.target.value)} className={`${fieldClass} mt-1`} style={fieldStyle} /></label>
              <label className="font-ui text-[11px] text-slate-600">SKU<input value={editing.sku} onChange={event => setField('sku', event.target.value)} className={`${fieldClass} mt-1`} style={fieldStyle} /></label>
              <label className="font-ui text-[11px] text-slate-600">Brand<select value={editing.brandId} onChange={event => setField('brandId', event.target.value)} className={`${fieldClass} mt-1`} style={fieldStyle}><option value="">Select brand</option>{brands.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
              <label className="font-ui text-[11px] text-slate-600">Category<select value={editing.category} onChange={event => { const category = event.target.value; setEditing(current => current ? { ...current, category, subcategory: CATEGORY_SUBS[category]?.[0] || '' } : current) }} className={`${fieldClass} mt-1`} style={fieldStyle}>{CATEGORIES.map(category => <option key={category}>{category}</option>)}</select></label>
              <label className="font-ui text-[11px] text-slate-600">Subcategory<select value={editing.subcategory} onChange={event => setField('subcategory', event.target.value)} className={`${fieldClass} mt-1`} style={fieldStyle}>{(CATEGORY_SUBS[editing.category] || []).map(subcategory => <option key={subcategory}>{subcategory}</option>)}</select></label>
              <label className="font-ui text-[11px] text-slate-600">Model<input value={editing.model} onChange={event => setField('model', event.target.value)} className={`${fieldClass} mt-1`} style={fieldStyle} /></label>
              <div className="grid grid-cols-[1fr_7rem] gap-2">
                <label className="font-ui text-[11px] text-slate-600">Price ({currencyOf(editing)})<input type="number" min="0" step="any" value={editing.price} onChange={event => setField('price', Number(event.target.value))} className={`rounded-md ${fieldClass} mt-1`} style={fieldStyle} /></label>
                <label className="font-ui text-[11px] text-slate-600">Currency<select aria-label="Price currency" value={currencyOf(editing)} onChange={event => setField('priceCurrency', event.target.value)} className={`${fieldClass} mt-1`} style={fieldStyle}>
                  {db.currencies.filter(c => c.enabled || c.code === currencyOf(editing)).map(c => <option key={c.code} value={c.code}>{c.code}{c.code === db.settings.baseCurrency ? ' (base)' : ''}{c.enabled ? '' : ' (off)'}</option>)}
                </select></label>
                <p className="col-span-2 font-ui text-[10.5px] text-slate-500 -mt-1">The price and every variant price that inherits it are written in {currencyOf(editing)}. Other currencies use manual prices or exchange rates (Currency &amp; Pricing).{(currencyInfo(currencyOf(editing))?.decimals ?? 2) === 0 ? ' This currency has no decimals.' : ''}</p>
              </div>
              <label className="font-ui text-[11px] text-slate-600">Stock{editing.variants?.length ? ' (sum of variants)' : ''}<input disabled={!!editing.variants?.length} type="number" min="0" value={editing.stock} onChange={event => setField('stock', Number(event.target.value))} className={`${fieldClass} mt-1`} style={fieldStyle} /></label>
              <label className="sm:col-span-2 font-ui text-[11px] text-slate-600">Short description<textarea value={editing.shortDesc} onChange={event => setField('shortDesc', event.target.value)} className={`${fieldClass} mt-1 min-h-20`} style={fieldStyle} /></label>
              <label className="sm:col-span-2 font-ui text-[11px] text-slate-600">Full description<textarea value={editing.description} onChange={event => setField('description', event.target.value)} className={`${fieldClass} mt-1 min-h-24`} style={fieldStyle} /></label>
              <label className="font-ui text-[11px] text-slate-600">Product images<input type="file" accept="image/*" multiple onChange={handleImages} className={`${fieldClass} mt-1`} style={fieldStyle} /></label>
              <label className="flex items-center gap-2 self-end pb-2 font-ui text-[12px]" style={{ color: NAVY }}><input type="checkbox" checked={editing.featured} onChange={event => setField('featured', event.target.checked)} /> Featured product</label>
              <label className="flex items-center gap-2 pb-2 font-ui text-[12px]" style={{ color: NAVY }}><input type="checkbox" checked={editing.active !== false} onChange={event => setField('active', event.target.checked)} /> Active (visible and purchasable on storefront)</label>
              <VariantEditor options={editing.options ?? []} variants={editing.variants ?? []} basePrice={editing.price} currency={currencyOf(editing)} baseSku={editing.sku || 'SKU'}
                otherSkus={products.filter(p => p.id !== editing.id).flatMap(p => [p.sku, ...(p.variants ?? []).map(v => v.sku)])}
                onChange={(options, variants) => setEditing(current => current ? { ...current, options, variants } : current)} />
            </div>
            {editing.images.length > 0 && <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">{editing.images.map((image, index) => <div key={`${image.slice(0, 30)}-${index}`} className="relative border p-1" style={{ borderColor: editing.img === image ? BLUE : 'var(--nb-border)' }}><button type="button" onClick={() => setField('img', image)} className="block w-full"><img src={image} alt="" className="w-full h-16 object-contain" /></button><button type="button" onClick={() => { const images = editing.images.filter((_, imageIndex) => imageIndex !== index); setEditing({ ...editing, images, img: editing.img === image ? images[0] || '' : editing.img }) }} className="absolute top-0 right-0 bg-white text-red-600 px-1">×</button><span className="block text-center font-ui text-[9px] text-slate-500">{editing.img === image ? 'Primary' : 'Set primary'}</span></div>)}</div>}
            {error && <p className="font-ui text-[12px] text-red-600 mt-4">{error}</p>}
            <div className="flex justify-end gap-2 mt-6"><button type="button" onClick={() => setEditing(null)} className="rounded-md font-ui text-[12px] px-4 py-2 border border-slate-300">Cancel</button><button className="rounded-md font-ui text-[12px] font-600 px-5 py-2 text-white" style={{ background: BLUE }}>Save Product</button></div>
          </form>
        </div>
      )}
    </div>
  )
}
