import { ChangeEvent, FormEvent, useState } from 'react'
import { LeadershipItem, LeadershipSection } from '../../content'
import { useStore } from '../../store'
import { assetUrl } from '../../lib/assetUrl'

const NAVY = 'var(--nb-navy)'
const BLUE = 'var(--nb-primary)'
const fieldClass = 'rounded-md w-full font-ui text-[12px] px-3 py-2.5 outline-none bg-white border border-slate-300'

const emptyItem = (order: number): LeadershipItem => ({
  id: '',
  section: 'team',
  image: '',
  nameEn: '',
  nameLo: '',
  positionEn: '',
  positionLo: '',
  titleEn: '',
  titleLo: '',
  descriptionEn: '',
  descriptionLo: '',
  messageEn: '',
  messageLo: '',
  active: true,
  displayOrder: order,
})

const uploadImage = (event: ChangeEvent<HTMLInputElement>, callback: (value: string) => void) => {
  const file = event.target.files?.[0]
  if (!file || !file.type.startsWith('image/') || file.size > 4 * 1024 * 1024) return
  const reader = new FileReader()
  reader.onload = () => callback(String(reader.result))
  reader.readAsDataURL(file)
}

const sectionLabels: Record<LeadershipSection, string> = {
  owner: 'Message From Owner',
  management: 'Management',
  expertise: 'Expertise',
  team: 'Leadership Team',
}

export default function LeadershipManagement() {
  const { leadership, saveLeadershipItem, deleteLeadershipItem } = useStore()
  const [editing, setEditing] = useState<LeadershipItem | null>(null)
  const setField = <K extends keyof LeadershipItem>(key: K, value: LeadershipItem[K]) =>
    setEditing(current => current ? { ...current, [key]: value } : current)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return
    if (!editing.nameEn.trim() || !editing.positionEn.trim()) return
    saveLeadershipItem({ ...editing, id: editing.id || `leadership-${Date.now()}` })
    setEditing(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="font-display font-700 text-[22px]" style={{ color: NAVY }}>Leadership Content</h2>
          <p className="font-ui text-[12px] text-slate-500 mt-1">Manage owner, management, expertise, and leadership team content.</p>
        </div>
        <button onClick={() => setEditing(emptyItem(leadership.length + 1))} className="rounded-md font-ui text-[12px] font-600 px-4 py-2.5 text-white shrink-0" style={{ background: BLUE }}>+ Add Item</button>
      </div>

      <div className="rounded-lg bg-white border border-slate-200 divide-y">
        {[...leadership].sort((a, b) => a.displayOrder - b.displayOrder).map(item => (
          <div key={item.id} className="p-4 flex items-center gap-4">
            <div className="w-16 h-14 bg-slate-100 shrink-0">
              {item.image && <img src={assetUrl(item.image)} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-ui text-[10px] uppercase tracking-wide text-blue-600">{sectionLabels[item.section]} · Order {item.displayOrder}</div>
              <div className="font-display font-700 text-[14px] truncate" style={{ color: NAVY }}>{item.nameEn || item.titleEn}</div>
              <div className="font-ui text-[10px] text-slate-500">{item.active ? 'Active' : 'Inactive'}</div>
            </div>
            <button onClick={() => saveLeadershipItem({ ...item, active: !item.active })} className="font-ui text-[11px] text-slate-600">{item.active ? 'Disable' : 'Enable'}</button>
            <button onClick={() => setEditing({ ...item })} className="font-ui text-[11px] text-blue-600">Edit</button>
            <button onClick={() => window.confirm('Delete this leadership item?') && deleteLeadershipItem(item.id)} className="font-ui text-[11px] text-red-600">Delete</button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <form onSubmit={submit} className="rounded-lg bg-white w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <h3 className="font-display font-700 text-[20px] mb-4" style={{ color: NAVY }}>Leadership Details</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="font-ui text-[11px] text-slate-600">Section
                <select value={editing.section} onChange={event => setField('section', event.target.value as LeadershipSection)} className={`rounded-md ${fieldClass} mt-1`}>
                  {Object.entries(sectionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="font-ui text-[11px] text-slate-600">Display order
                <input type="number" min="1" value={editing.displayOrder} onChange={event => setField('displayOrder', Number(event.target.value))} className={`rounded-md ${fieldClass} mt-1`} />
              </label>
              <label className="font-ui text-[11px] text-slate-600">Full name (English)<input required value={editing.nameEn} onChange={event => setField('nameEn', event.target.value)} className={`rounded-md ${fieldClass} mt-1`} /></label>
              <label className="font-ui text-[11px] text-slate-600">Full name (Lao)<input value={editing.nameLo} onChange={event => setField('nameLo', event.target.value)} className={`rounded-md ${fieldClass} mt-1`} /></label>
              <label className="font-ui text-[11px] text-slate-600">Position / title (English)<input required value={editing.positionEn} onChange={event => setField('positionEn', event.target.value)} className={`rounded-md ${fieldClass} mt-1`} /></label>
              <label className="font-ui text-[11px] text-slate-600">Position / title (Lao)<input value={editing.positionLo} onChange={event => setField('positionLo', event.target.value)} className={`rounded-md ${fieldClass} mt-1`} /></label>
              {editing.section === 'expertise' && <>
                <label className="font-ui text-[11px] text-slate-600">Expertise title (English)<input value={editing.titleEn} onChange={event => setField('titleEn', event.target.value)} className={`rounded-md ${fieldClass} mt-1`} /></label>
                <label className="font-ui text-[11px] text-slate-600">Expertise title (Lao)<input value={editing.titleLo} onChange={event => setField('titleLo', event.target.value)} className={`rounded-md ${fieldClass} mt-1`} /></label>
              </>}
              <label className="font-ui text-[11px] text-slate-600 sm:col-span-2">Description (English)<textarea value={editing.descriptionEn} onChange={event => setField('descriptionEn', event.target.value)} className={`rounded-md ${fieldClass} mt-1`} /></label>
              <label className="font-ui text-[11px] text-slate-600 sm:col-span-2">Description (Lao)<textarea value={editing.descriptionLo} onChange={event => setField('descriptionLo', event.target.value)} className={`rounded-md ${fieldClass} mt-1`} /></label>
              {editing.section === 'owner' && <>
                <label className="font-ui text-[11px] text-slate-600 sm:col-span-2">Message (English)<textarea value={editing.messageEn} onChange={event => setField('messageEn', event.target.value)} className={`rounded-md ${fieldClass} mt-1`} /></label>
                <label className="font-ui text-[11px] text-slate-600 sm:col-span-2">Message (Lao)<textarea value={editing.messageLo} onChange={event => setField('messageLo', event.target.value)} className={`rounded-md ${fieldClass} mt-1`} /></label>
              </>}
              <label className="font-ui text-[11px] text-slate-600">{editing.image ? 'Replace image' : 'Profile image'}
                <input type="file" accept="image/*" onChange={event => uploadImage(event, image => setField('image', image))} className={`${fieldClass} mt-1`} />
              </label>
              {editing.image && <button type="button" onClick={() => setField('image', '')} className="font-ui text-[11px] text-red-600 self-end pb-2 text-left">Remove image</button>}
              <label className="flex items-center gap-2 font-ui text-[12px] self-end pb-2">
                <input type="checkbox" checked={editing.active} onChange={event => setField('active', event.target.checked)} /> Active
              </label>
            </div>
            {editing.image && <img src={assetUrl(editing.image)} alt="" className="w-32 h-24 object-cover mt-4" />}
            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setEditing(null)} className="rounded-md px-4 py-2 border border-slate-300 font-ui text-[12px]">Cancel</button>
              <button className="rounded-md px-5 py-2 text-white font-ui text-[12px] font-600" style={{ background: BLUE }}>Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
