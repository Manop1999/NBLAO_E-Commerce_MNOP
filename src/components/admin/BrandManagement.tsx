import { ChangeEvent, FormEvent, useMemo, useState } from 'react'
import { Brand, sortBrands } from '../../brands'
import { useStore } from '../../store'
import { assetUrl } from '../../lib/assetUrl'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const EMPTY_FORM: Brand = {
  id: '',
  name: '',
  nameEn: '',
  nameLo: '',
  logo: '',
  active: true,
  displayOrder: 1,
  websiteUrl: '',
  description: '',
}

const fieldClass = 'rounded-md w-full font-ui text-[12px] px-3 py-2.5 outline-none bg-white'
const fieldStyle = { border: '1px solid var(--nb-border)', color: NAVY }

function createBrandId(name: string) {
  const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `brand-${slug || Date.now()}`
}

export default function BrandManagement() {
  const { brands, saveBrand, toggleBrandStatus, deleteBrand, allProducts: products } = useStore()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all')
  const [editing, setEditing] = useState<Brand | null>(null)
  const [error, setError] = useState('')

  const filteredBrands = useMemo(() => sortBrands(brands).filter(brand => {
    const matchesSearch = `${brand.name} ${brand.nameEn} ${brand.nameLo}`.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = status === 'all' || (status === 'active' ? brand.active : !brand.active)
    return matchesSearch && matchesStatus
  }), [brands, search, status])

  const openNew = () => {
    const nextOrder = Math.max(0, ...brands.map(brand => brand.displayOrder)) + 1
    setEditing({ ...EMPTY_FORM, displayOrder: nextOrder })
    setError('')
  }

  const setField = <K extends keyof Brand>(key: K, value: Brand[K]) =>
    setEditing(current => current ? { ...current, [key]: value } : current)

  const handleLogo = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const allowed = ['image/svg+xml', 'image/png', 'image/webp', 'image/jpeg']
    if (!allowed.includes(file.type)) {
      setError('Use an SVG, PNG, WebP, JPG, or JPEG logo.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo files must be 2 MB or smaller.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      setField('logo', String(reader.result))
      setError('')
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    if (!editing.name.trim() || !editing.logo || editing.displayOrder < 1) {
      setError('Brand name, logo, status, and a positive display order are required.')
      return
    }
    const id = editing.id || createBrandId(editing.name)
    if (!editing.id && brands.some(brand => brand.id === id)) {
      setError('A brand with this identifier already exists.')
      return
    }
    saveBrand({
      ...editing,
      id,
      name: editing.name.trim(),
      nameEn: editing.nameEn.trim() || editing.name.trim(),
      nameLo: editing.nameLo.trim(),
      websiteUrl: editing.websiteUrl.trim(),
      description: editing.description.trim(),
    })
    setEditing(null)
  }

  const isReferenced = (id: string) => products.some(product => product.brandId === id)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display font-700 text-[22px]" style={{ color: NAVY }}>Brand Logos</h2>
          <p className="font-ui text-[12px] mt-1" style={{ color: '#64748b' }}>
            One source for the homepage, About Us, product filters, and product brand references.
          </p>
        </div>
        <button onClick={openNew} className="rounded-md font-ui text-[12px] font-600 px-4 py-2.5 text-white" style={{ background: BLUE }}>
          + Add Brand
        </button>
      </div>

      <div className="rounded-lg bg-white p-4 mb-4 grid sm:grid-cols-[1fr_auto] gap-3" style={{ border: '1px solid var(--nb-border)' }}>
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search brand logos..." className={fieldClass} style={fieldStyle} />
        <select value={status} onChange={event => setStatus(event.target.value as typeof status)} className={`rounded-md ${fieldClass} sm:w-40`} style={fieldStyle}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="rounded-lg bg-white overflow-x-auto" style={{ border: '1px solid var(--nb-border)' }}>
        <table className="w-full border-collapse min-w-[760px]">
          <thead>
            <tr style={{ background: 'var(--nb-bg)', borderBottom: '1px solid var(--nb-border)' }}>
              {['Logo', 'Brand Name', 'Status', 'Display Order', 'Product Links', 'Actions'].map(label => (
                <th key={label} className="text-left font-ui text-[10px] uppercase tracking-wider px-4 py-3" style={{ color: '#64748b' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredBrands.map(brand => {
              const referenced = isReferenced(brand.id)
              return (
                <tr key={brand.id} style={{ borderBottom: '1px solid #eef2f6' }}>
                  <td className="px-4 py-3">
                    <div className="rounded-lg w-24 h-12 flex items-center justify-center p-2" style={{ border: '1px solid #eef2f6', background: '#fff' }}>
                      {brand.logo
                        ? <img src={assetUrl(brand.logo)} alt={brand.name} className="max-w-full max-h-full object-contain" />
                        : <span className="font-ui text-[10px]" style={{ color: '#94a3b8' }}>No logo</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-display font-700 text-[14px]" style={{ color: NAVY }}>{brand.name}</div>
                    <div className="font-ui text-[10px]" style={{ color: '#94a3b8' }}>{brand.id}</div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleBrandStatus(brand.id)}
                      disabled={!brand.logo && !brand.active}
                      title={!brand.logo && !brand.active ? 'Upload a logo before activating this brand.' : `Mark ${brand.name} ${brand.active ? 'inactive' : 'active'}`}
                      className="rounded-sm font-ui text-[10px] font-700 px-2.5 py-1 disabled:opacity-50"
                      style={{
                      color: brand.active ? '#15803d' : '#64748b',
                      background: brand.active ? '#ecfdf5' : '#f1f5f9',
                    }}>
                      {brand.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-ui text-[12px]" style={{ color: '#475569' }}>{brand.displayOrder}</td>
                  <td className="px-4 py-3 font-ui text-[11px]" style={{ color: referenced ? NAVY : '#94a3b8' }}>
                    {referenced ? `${products.filter(product => product.brandId === brand.id).length} product(s)` : 'Not referenced'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditing({ ...brand }); setError('') }} className="rounded-sm font-ui text-[11px] px-2.5 py-1.5" style={{ border: '1px solid var(--nb-border)', color: '#475569' }}>Edit</button>
                      <button
                        disabled={referenced}
                        title={referenced ? 'Deactivate instead: products reference this brand.' : 'Delete brand'}
                        onClick={() => deleteBrand(brand.id)}
                        className="rounded-sm font-ui text-[11px] px-2.5 py-1.5 disabled:opacity-35"
                        style={{ border: '1px solid #fecaca', color: '#dc2626' }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8" style={{ background: 'rgba(3,12,27,0.72)' }}>
          <form onSubmit={handleSubmit} className="rounded-lg bg-white w-full max-w-3xl my-auto" style={{ borderTop: `3px solid ${BLUE}` }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--nb-border)' }}>
              <div>
                <h3 className="font-display font-700 text-[18px]" style={{ color: NAVY }}>{editing.id ? 'Edit Brand Logo' : 'Add Brand Logo'}</h3>
                <p className="font-ui text-[10px] mt-0.5" style={{ color: '#64748b' }}>Updates are reflected in every public brand display.</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="font-ui text-[20px] px-2" aria-label="Close" style={{ color: '#64748b' }}>×</button>
            </div>

            <div className="p-5 grid md:grid-cols-[1fr_180px] gap-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="sm:col-span-2 font-ui text-[11px] font-600" style={{ color: NAVY }}>
                  Brand Name *
                  <input value={editing.name} onChange={event => setField('name', event.target.value)} className={`rounded-md ${fieldClass} mt-1.5`} style={fieldStyle} required />
                </label>
                <label className="font-ui text-[11px] font-600" style={{ color: NAVY }}>
                  English Name
                  <input value={editing.nameEn} onChange={event => setField('nameEn', event.target.value)} className={`rounded-md ${fieldClass} mt-1.5`} style={fieldStyle} />
                </label>
                <label className="font-ui text-[11px] font-600" style={{ color: NAVY }}>
                  Lao Name
                  <input value={editing.nameLo} onChange={event => setField('nameLo', event.target.value)} className={`rounded-md ${fieldClass} mt-1.5`} style={fieldStyle} />
                </label>
                <label className="font-ui text-[11px] font-600" style={{ color: NAVY }}>
                  Status *
                  <select value={editing.active ? 'active' : 'inactive'} onChange={event => setField('active', event.target.value === 'active')} className={`rounded-md ${fieldClass} mt-1.5`} style={fieldStyle}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label className="font-ui text-[11px] font-600" style={{ color: NAVY }}>
                  Display Order *
                  <input type="number" min="1" value={editing.displayOrder} onChange={event => setField('displayOrder', Number(event.target.value))} className={`rounded-md ${fieldClass} mt-1.5`} style={fieldStyle} required />
                </label>
                <label className="sm:col-span-2 font-ui text-[11px] font-600" style={{ color: NAVY }}>
                  Website URL
                  <input type="url" value={editing.websiteUrl} onChange={event => setField('websiteUrl', event.target.value)} className={`rounded-md ${fieldClass} mt-1.5`} style={fieldStyle} placeholder="https://" />
                </label>
                <label className="sm:col-span-2 font-ui text-[11px] font-600" style={{ color: NAVY }}>
                  Short Description
                  <textarea value={editing.description} onChange={event => setField('description', event.target.value)} className={`rounded-md ${fieldClass} mt-1.5 min-h-20 resize-y`} style={fieldStyle} />
                </label>
              </div>

              <div>
                <div className="font-ui text-[11px] font-600 mb-1.5" style={{ color: NAVY }}>Logo *</div>
                <div className="h-32 flex items-center justify-center p-4 mb-3" style={{ border: '1px dashed #cbd5e1', background: '#F8FAFC' }}>
                  {editing.logo
                    ? <img src={assetUrl(editing.logo)} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                    : <span className="font-ui text-[11px] text-center" style={{ color: '#94a3b8' }}>Logo preview</span>}
                </div>
                <label className="rounded-sm block text-center font-ui text-[11px] font-600 px-3 py-2.5 cursor-pointer" style={{ border: '1px solid var(--nb-border)', color: NAVY }}>
                  {editing.logo ? 'Replace Logo' : 'Upload Logo'}
                  <input type="file" accept=".svg,.png,.webp,.jpg,.jpeg,image/svg+xml,image/png,image/webp,image/jpeg" onChange={handleLogo} className="sr-only" />
                </label>
                <p className="font-ui text-[9px] leading-relaxed mt-2" style={{ color: '#94a3b8' }}>SVG or transparent PNG preferred. Max 2 MB. Original aspect ratio is preserved.</p>
                <div className="rounded-lg mt-5 p-3" style={{ background: 'var(--nb-bg)', border: '1px solid #e2e8f0' }}>
                  <div className="font-ui text-[10px] font-700 mb-1.5" style={{ color: NAVY }}>Used in</div>
                  {['Homepage marquee', 'About Us partners', 'Product references', 'Brand filters'].map(place => (
                    <div key={place} className="font-ui text-[9px] py-0.5" style={{ color: 'var(--nb-text-secondary)' }}>✓ {place}</div>
                  ))}
                </div>
              </div>
            </div>

            {error && <div className="mx-5 mb-4 px-3 py-2 font-ui text-[11px]" style={{ background: '#fef2f2', color: '#b91c1c' }}>{error}</div>}
            <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid var(--nb-border)' }}>
              <button type="button" onClick={() => setEditing(null)} className="rounded-md font-ui text-[12px] font-600 px-4 py-2" style={{ border: '1px solid var(--nb-border)', color: '#475569' }}>Cancel</button>
              <button type="submit" className="rounded-md font-ui text-[12px] font-600 px-5 py-2 text-white" style={{ background: BLUE }}>Save Brand</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
