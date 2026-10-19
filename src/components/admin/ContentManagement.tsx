import { ChangeEvent, FormEvent, useState } from 'react'
import { Advertisement, Partner, getWhatsAppUrl, isValidHttpUrl, validateCustomerService } from '../../content'
import { useToast } from '../Toast'
import { useStore } from '../../store'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const fieldClass = 'rounded-md w-full font-ui text-[12px] px-3 py-2.5 outline-none bg-white border border-slate-300'

const uploadImage = (event: ChangeEvent<HTMLInputElement>, callback: (value: string) => void) => {
  const file = event.target.files?.[0]
  if (!file || !file.type.startsWith('image/') || file.size > 4 * 1024 * 1024) return
  const reader = new FileReader()
  reader.onload = () => callback(String(reader.result))
  reader.readAsDataURL(file)
}

const emptyAd = (order: number): Advertisement => ({
  id: '', placement: 'main', titleEn: '', titleLo: '', descriptionEn: '', descriptionLo: '', ctaEn: '',
  ctaLo: '', image: '', destinationUrl: '', active: true, displayOrder: order,
  startDate: '', endDate: '',
})

export function AdvertisementManagement() {
  const { advertisements, saveAdvertisement, deleteAdvertisement } = useStore()
  const [editing, setEditing] = useState<Advertisement | null>(null)
  const setField = <K extends keyof Advertisement>(key: K, value: Advertisement[K]) => setEditing(current => current ? { ...current, [key]: value } : current)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!editing || !editing.image) return
    saveAdvertisement({ ...editing, id: editing.id || `ad-${Date.now()}` })
    setEditing(null)
  }
  return <div>
    <div className="flex items-center justify-between mb-5"><div><h2 className="font-display font-700 text-[22px]" style={{ color: NAVY }}>Advertisements</h2><p className="font-ui text-[12px] text-slate-500 mt-1">Only active, currently scheduled campaigns appear on the homepage.</p></div><button onClick={() => setEditing(emptyAd(advertisements.length + 1))} className="rounded-md font-ui text-[12px] font-600 px-4 py-2.5 text-white" style={{ background: BLUE }}>+ Add Advertisement</button></div>
    <div className="grid lg:grid-cols-2 gap-4">{[...advertisements].sort((a, b) => a.displayOrder - b.displayOrder).map(ad => <div key={ad.id} className="rounded-lg bg-white border border-slate-200 overflow-hidden"><img src={ad.image} alt="" className="w-full h-36 object-cover" /><div className="p-4"><div className="flex justify-between gap-3"><div><h3 className="font-display font-700 text-[16px]" style={{ color: NAVY }}>{ad.titleEn || `Campaign ${ad.displayOrder}`}</h3><p className="font-ui text-[11px] text-slate-500 mt-1">{(ad.placement || 'main') === 'side' ? 'Side advertisement' : 'Main advertisement'} · Order {ad.displayOrder} · {ad.active ? 'Active' : 'Inactive'}</p></div><button onClick={() => saveAdvertisement({ ...ad, active: !ad.active })} className="rounded-sm font-ui text-[10px] px-2 py-1 h-fit" style={{ background: ad.active ? '#dcfce7' : '#f1f5f9', color: ad.active ? '#15803d' : '#64748b' }}>{ad.active ? 'Active' : 'Inactive'}</button></div><div className="flex gap-2 mt-4"><button onClick={() => setEditing({ ...ad, placement: ad.placement || 'main' })} className="rounded-sm font-ui text-[11px] border border-slate-300 px-3 py-1">Edit</button><button onClick={() => window.confirm('Delete this advertisement?') && deleteAdvertisement(ad.id)} className="rounded-sm font-ui text-[11px] border border-red-200 text-red-600 px-3 py-1">Delete</button></div></div></div>)}</div>
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"><form onSubmit={submit} className="rounded-lg bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"><h3 className="font-display font-700 text-[20px] mb-1" style={{ color: NAVY }}>Advertisement Details</h3><p className="font-ui text-[11px] text-slate-500 mb-4">Campaigns display the uploaded artwork only. Add any text to the image itself; the destination URL makes the banner clickable.</p><div className="grid sm:grid-cols-2 gap-3">
      <label className="font-ui text-[11px] text-slate-600">Placement<select value={editing.placement} onChange={e => setField('placement', e.target.value as Advertisement['placement'])} className={`${fieldClass} mt-1`}><option value="main">Main advertisement</option><option value="side">Side advertisement (desktop only)</option></select></label>
      <label className="font-ui text-[11px] text-slate-600">Destination URL (optional)<input value={editing.destinationUrl} onChange={e => setField('destinationUrl', e.target.value)} className={`${fieldClass} mt-1`} /></label><label className="font-ui text-[11px] text-slate-600">Banner image<input type="file" required={!editing.image} accept="image/*" onChange={e => uploadImage(e, image => setField('image', image))} className={`${fieldClass} mt-1`} /></label>
      <label className="font-ui text-[11px] text-slate-600">Start date<input type="date" value={editing.startDate} onChange={e => setField('startDate', e.target.value)} className={`${fieldClass} mt-1`} /></label><label className="font-ui text-[11px] text-slate-600">End date<input type="date" value={editing.endDate} onChange={e => setField('endDate', e.target.value)} className={`${fieldClass} mt-1`} /></label>
      <label className="font-ui text-[11px] text-slate-600">Display order<input type="number" min="1" value={editing.displayOrder} onChange={e => setField('displayOrder', Number(e.target.value))} className={`${fieldClass} mt-1`} /></label><label className="flex items-center gap-2 font-ui text-[12px] self-end pb-2"><input type="checkbox" checked={editing.active} onChange={e => setField('active', e.target.checked)} /> Active</label>
    </div>{editing.image && <img src={editing.image} alt="" className="w-full h-32 object-cover mt-4" />}<div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditing(null)} className="rounded-md px-4 py-2 border border-slate-300 font-ui text-[12px]">Cancel</button><button className="rounded-md px-5 py-2 text-white font-ui text-[12px] font-600" style={{ background: BLUE }}>Save</button></div></form></div>}
  </div>
}

type CsKey = 'addressEn' | 'addressLo' | 'phone' | 'email' | 'whatsapp' | 'mapUrl' | 'line' | 'facebook' | 'wechat' | 'tiktok'
const CS_FIELDS: { key: CsKey; label: string; help: string; example?: string; wide?: boolean; test?: boolean }[] = [
  { key: 'addressEn', label: 'Address (English)', help: 'Shown in the footer and on the Contact page.', wide: true },
  { key: 'addressLo', label: 'Address (Lao)', help: 'Shown instead of the English address when the site is in Lao.', wide: true },
  { key: 'phone', label: 'Phone', help: 'Public phone number; tapping it starts a call.', example: '+856 20 5237 1258' },
  { key: 'email', label: 'Email', help: 'Public contact email address.', example: 'info@nblaosolelao.com' },
  { key: 'whatsapp', label: 'WhatsApp number or link', help: 'Enables the floating WhatsApp button. Digits are normalised to https://wa.me/<number>.', example: '+8562052371258  or  https://wa.me/8562052371258', test: true },
  { key: 'mapUrl', label: 'Map URL', help: 'Link for “Open map”. Leave blank to hide it.', example: 'https://www.google.com/maps', test: true },
  { key: 'line', label: 'LINE URL', help: 'Leave blank to hide the LINE link.', example: 'https://line.me/', test: true },
  { key: 'facebook', label: 'Facebook URL', help: 'Leave blank to hide the Facebook link.', example: 'https://www.facebook.com/', test: true },
  { key: 'wechat', label: 'WeChat link', help: 'Needs a valid business link or QR destination; leave blank until one is available.', test: true },
  { key: 'tiktok', label: 'TikTok URL', help: 'Leave blank to hide the TikTok link.', example: 'https://www.tiktok.com/', test: true },
]

export function CustomerServiceManagement() {
  const { customerService, saveCustomerService } = useStore()
  const { addToast } = useToast()
  const [form, setForm] = useState({ ...customerService })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const waUrl = getWhatsAppUrl(form.whatsapp)
  const testTarget = (key: CsKey) => (key === 'whatsapp' ? waUrl : isValidHttpUrl(form[key]) ? form[key].trim() : '')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const found = validateCustomerService(form)
    setErrors(found)
    if (Object.keys(found).length) { addToast('Fix the highlighted fields before saving.', 'error'); return }
    saveCustomerService({ ...form, phone: form.phone.trim(), email: form.email.trim(), whatsapp: form.whatsapp.trim() })
    addToast('Customer service settings saved.', 'success')
  }
  return <form onSubmit={submit} noValidate className="max-w-3xl"><h2 className="font-display font-700 text-[22px]" style={{ color: NAVY }}>Customer Service Settings</h2><p className="font-ui text-[12px] text-slate-500 mt-1 mb-5">Blank optional fields are hidden publicly; no placeholder destinations are generated. Grey text inside a field is only an example of the format, not an official NB LAO account.</p>
    <div className="rounded-lg bg-white border border-slate-200 p-5 grid sm:grid-cols-2 gap-4">{CS_FIELDS.map(field => {
      const target = testTarget(field.key)
      return <div key={field.key} className={field.wide ? 'sm:col-span-2' : ''}>
        <label htmlFor={`cs-${field.key}`} className="font-ui text-[11px] font-600 text-slate-700">{field.label}</label>
        <div className="flex gap-2 mt-1">
          <input id={`cs-${field.key}`} type={field.key === 'email' ? 'email' : 'text'} value={form[field.key]} placeholder={field.example} aria-invalid={!!errors[field.key]} aria-describedby={`cs-${field.key}-help`}
            onChange={event => { setForm(current => ({ ...current, [field.key]: event.target.value })); setErrors(current => ({ ...current, [field.key]: '' })) }} className={`rounded-md ${fieldClass}`} style={errors[field.key] ? { borderColor: '#dc2626' } : undefined} />
          {field.test && <a href={target || undefined} target="_blank" rel="noreferrer" aria-disabled={!target} onClick={e => { if (!target) e.preventDefault() }} className={`rounded-md shrink-0 font-ui text-[11px] font-600 px-3 inline-flex items-center border border-slate-300 no-underline ${target ? 'text-slate-700' : 'text-slate-300 pointer-events-none'}`}>Test</a>}
        </div>
        <p id={`cs-${field.key}-help`} className="font-ui text-[10.5px] text-slate-500 mt-1">{field.help}</p>
        {field.key === 'whatsapp' && (form.whatsapp.trim() ? (waUrl ? <p className="font-ui text-[10.5px] mt-0.5" style={{ color: '#166534' }}>Button opens: {waUrl}</p> : null) : <p className="font-ui text-[10.5px] mt-0.5" style={{ color: '#92400E' }}>No WhatsApp number: the floating button is hidden.</p>)}
        {errors[field.key] && <p role="alert" className="font-ui text-[11px] mt-0.5" style={{ color: '#dc2626' }}>{errors[field.key]}</p>}
      </div>
    })}</div>
    <p className="font-ui text-[10.5px] text-slate-500 mt-2">“Test” opens the link in a new tab using the value currently typed; nothing is saved until you press Save.</p>
    <button className="rounded-md mt-4 px-5 py-2.5 text-white font-ui text-[12px] font-600" style={{ background: BLUE }}>Save Customer Service</button></form>
}

const emptyPartner = (order: number): Partner => ({ id: '', name: '', logo: '', url: '', active: true, displayOrder: order })

export function PartnerManagement() {
  const { partners, brands, savePartner, deletePartner } = useStore()
  const [editing, setEditing] = useState<Partner | null>(null)
  const setField = <K extends keyof Partner>(key: K, value: Partner[K]) => setEditing(current => current ? { ...current, [key]: value } : current)
  const resolveLogo = (partner: Partner) => partner.logo || brands.find(brand => brand.id === partner.brandId)?.logo || ''
  return <div><div className="flex items-center justify-between mb-5"><div><h2 className="font-display font-700 text-[22px]" style={{ color: NAVY }}>Business Partners</h2><p className="font-ui text-[12px] text-slate-500 mt-1">Partners may reference a centrally managed brand or use a dedicated logo.</p></div><button onClick={() => setEditing(emptyPartner(partners.length + 1))} className="rounded-md font-ui text-[12px] font-600 px-4 py-2.5 text-white" style={{ background: BLUE }}>+ Add Partner</button></div><div className="rounded-lg bg-white border border-slate-200 divide-y">{[...partners].sort((a, b) => a.displayOrder - b.displayOrder).map(partner => <div key={partner.id} className="p-4 flex items-center gap-4"><img src={resolveLogo(partner)} alt="" className="w-24 h-10 object-contain" /><div className="flex-1"><div className="font-display font-700 text-[14px]" style={{ color: NAVY }}>{partner.name}</div><div className="font-ui text-[10px] text-slate-500">Order {partner.displayOrder} · {partner.active ? 'Active' : 'Inactive'}</div></div><button onClick={() => savePartner({ ...partner, active: !partner.active })} className="font-ui text-[11px] text-slate-600">{partner.active ? 'Disable' : 'Enable'}</button><button onClick={() => setEditing({ ...partner })} className="font-ui text-[11px] text-blue-600">Edit</button><button onClick={() => deletePartner(partner.id)} className="font-ui text-[11px] text-red-600">Delete</button></div>)}</div>
    {editing && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"><form onSubmit={event => { event.preventDefault(); if (!editing.name || !resolveLogo(editing)) return; savePartner({ ...editing, id: editing.id || `partner-${Date.now()}` }); setEditing(null) }} className="rounded-lg bg-white w-full max-w-xl p-6"><h3 className="font-display font-700 text-[20px] mb-4" style={{ color: NAVY }}>Partner Details</h3><div className="grid gap-3"><label className="font-ui text-[11px] text-slate-600">Name<input value={editing.name} onChange={e => setField('name', e.target.value)} className={`${fieldClass} mt-1`} /></label><label className="font-ui text-[11px] text-slate-600">Use managed brand<select value={editing.brandId || ''} onChange={e => setField('brandId', e.target.value || undefined)} className={`${fieldClass} mt-1`}><option value="">Dedicated partner logo</option>{brands.map(brand => <option value={brand.id} key={brand.id}>{brand.name}</option>)}</select></label>{!editing.brandId && <label className="font-ui text-[11px] text-slate-600">Logo<input type="file" accept="image/*" onChange={e => uploadImage(e, image => setField('logo', image))} className={`${fieldClass} mt-1`} /></label>}<label className="font-ui text-[11px] text-slate-600">Optional URL<input value={editing.url} onChange={e => setField('url', e.target.value)} className={`${fieldClass} mt-1`} /></label><label className="font-ui text-[11px] text-slate-600">Display order<input type="number" min="1" value={editing.displayOrder} onChange={e => setField('displayOrder', Number(e.target.value))} className={`${fieldClass} mt-1`} /></label><label className="font-ui text-[12px] flex gap-2"><input type="checkbox" checked={editing.active} onChange={e => setField('active', e.target.checked)} /> Active</label></div><div className="flex justify-end gap-2 mt-5"><button type="button" onClick={() => setEditing(null)} className="rounded-md px-4 py-2 border border-slate-300 font-ui text-[12px]">Cancel</button><button className="rounded-md px-5 py-2 text-white font-ui text-[12px]" style={{ background: BLUE }}>Save</button></div></form></div>}
  </div>
}
