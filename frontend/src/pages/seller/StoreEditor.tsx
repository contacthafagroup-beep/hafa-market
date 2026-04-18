import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Store, Upload, Palette, Eye, Save, Globe, Phone, Mail, MapPin } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'

const ACCENT_COLORS = [
  '#2E7D32', '#1565C0', '#6A1B9A', '#C62828', '#E65100',
  '#00695C', '#4527A0', '#AD1457', '#F57F17', '#37474F',
]

export default function SellerStoreEditor() {
  const qc = useQueryClient()
  const [uploading, setUploading] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)

  const { data: store, isLoading } = useQuery({
    queryKey: ['my-store'],
    queryFn: () => api.get('/sellers/me/store').then(r => r.data.data),
  })

  const [form, setForm] = useState<any>(null)

  // Init form from store data
  if (store && !form) {
    setForm({
      storeName: store.storeName || '',
      description: store.description || '',
      logo: store.logo || '',
      coverImage: store.coverImage || '',
      phone: store.phone || '',
      email: store.email || '',
      city: store.city || 'Hossana',
      region: store.region || 'Hadiya Zone',
      accentColor: store.accentColor || '#2E7D32',
      tagline: store.tagline || '',
      website: store.website || '',
      instagram: store.instagram || '',
      facebook: store.facebook || '',
      telegram: store.telegram || '',
    })
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => api.patch('/sellers/me/store', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-store'] })
      toast.success('Store updated! 🎉')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to save'),
  })

  const uploadFile = async (field: 'logo' | 'coverImage', file: File) => {
    setUploading(field)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setForm((f: any) => ({ ...f, [field]: res.data.data.url }))
      toast.success('Image uploaded!')
    } catch { toast.error('Upload failed') }
    finally { setUploading(null) }
  }

  if (isLoading || !form) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Store size={20} className="text-green-primary" /> Store Editor
          </h2>
          <p className="text-sm text-gray-400">Customize how your store looks to buyers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setPreview(!preview)}
            className="flex items-center gap-1.5 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-green-primary transition-all">
            <Eye size={14} /> {preview ? 'Edit' : 'Preview'}
          </button>
          <Button loading={saving} onClick={() => save()}>
            <Save size={15} /> Save Changes
          </Button>
        </div>
      </div>

      {/* Live Preview */}
      {preview && (
        <div className="rounded-2xl overflow-hidden border-2 border-gray-200">
          <div className="h-32 relative" style={{ background: form.coverImage ? `url(${form.coverImage}) center/cover` : `linear-gradient(135deg, ${form.accentColor}, ${form.accentColor}dd)` }}>
            {!form.coverImage && <div className="absolute inset-0 flex items-center justify-center text-white/30 text-6xl">🌿</div>}
          </div>
          <div className="bg-white p-5 flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl -mt-10 border-4 border-white shadow-lg overflow-hidden flex-shrink-0"
              style={{ background: form.accentColor }}>
              {form.logo
                ? <img src={form.logo} alt="Logo" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-white text-2xl font-black">{form.storeName?.[0]}</div>
              }
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-lg">{form.storeName || 'Your Store Name'}</h3>
              {form.tagline && <p className="text-sm font-medium" style={{ color: form.accentColor }}>{form.tagline}</p>}
              <p className="text-sm text-gray-500 mt-1 line-clamp-2">{form.description || 'Your store description...'}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                {form.city && <span className="flex items-center gap-1"><MapPin size={10} />{form.city}</span>}
                {form.phone && <span className="flex items-center gap-1"><Phone size={10} />{form.phone}</span>}
              </div>
            </div>
          </div>
          <div className="px-5 pb-4">
            <Link to={`/sellers/${store?.storeSlug}`} target="_blank"
              className="text-xs font-semibold hover:underline" style={{ color: form.accentColor }}>
              View live store →
            </Link>
          </div>
        </div>
      )}

      {/* Cover Image */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-gray-900 mb-4">🖼️ Store Banner</h3>
        <div className="relative h-32 rounded-xl overflow-hidden mb-3"
          style={{ background: form.coverImage ? `url(${form.coverImage}) center/cover` : '#f3f4f6' }}>
          {!form.coverImage && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-300">
              <Upload size={32} />
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 cursor-pointer bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-3 hover:border-green-primary transition-colors">
          <Upload size={16} className="text-gray-400" />
          <span className="text-sm text-gray-500">{uploading === 'coverImage' ? 'Uploading...' : 'Upload cover image (1200×300 recommended)'}</span>
          <input type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && uploadFile('coverImage', e.target.files[0])} />
        </label>
        {form.coverImage && (
          <button onClick={() => setForm((f: any) => ({ ...f, coverImage: '' }))}
            className="mt-2 text-xs text-red-500 hover:underline">Remove cover image</button>
        )}
      </div>

      {/* Logo + Basic Info */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-gray-900 mb-4">🏪 Store Identity</h3>
        <div className="flex items-start gap-5 mb-5">
          {/* Logo */}
          <div className="flex-shrink-0">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-gray-200 mb-2"
              style={{ background: form.accentColor }}>
              {form.logo
                ? <img src={form.logo} alt="Logo" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-white text-3xl font-black">{form.storeName?.[0] || '🌿'}</div>
              }
            </div>
            <label className="flex items-center gap-1 cursor-pointer text-xs text-green-primary font-semibold hover:underline">
              <Upload size={11} /> {uploading === 'logo' ? 'Uploading...' : 'Change Logo'}
              <input type="file" accept="image/*" className="hidden"
                onChange={e => e.target.files?.[0] && uploadFile('logo', e.target.files[0])} />
            </label>
          </div>
          <div className="flex-1 grid sm:grid-cols-2 gap-3">
            <Input label="Store Name *" value={form.storeName}
              onChange={(e: any) => setForm((f: any) => ({ ...f, storeName: e.target.value }))} />
            <Input label="Tagline" placeholder="e.g. Fresh from the farm daily" value={form.tagline}
              onChange={(e: any) => setForm((f: any) => ({ ...f, tagline: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
          <textarea value={form.description}
            onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
            rows={3} placeholder="Tell buyers about your farm, products, and values..."
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none" />
        </div>
      </div>

      {/* Accent Color */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Palette size={16} className="text-green-primary" /> Brand Color
        </h3>
        <div className="flex items-center gap-3 flex-wrap">
          {ACCENT_COLORS.map(color => (
            <button key={color} onClick={() => setForm((f: any) => ({ ...f, accentColor: color }))}
              className={`w-9 h-9 rounded-full transition-all ${form.accentColor === color ? 'ring-4 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
              style={{ background: color }} />
          ))}
          <div className="flex items-center gap-2 ml-2">
            <span className="text-xs text-gray-500">Custom:</span>
            <input type="color" value={form.accentColor}
              onChange={e => setForm((f: any) => ({ ...f, accentColor: e.target.value }))}
              className="w-9 h-9 rounded-full cursor-pointer border-2 border-gray-200" />
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Phone size={16} className="text-green-primary" /> Contact & Location
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Phone" placeholder="+251 9XX XXX XXX" value={form.phone}
            onChange={(e: any) => setForm((f: any) => ({ ...f, phone: e.target.value }))} />
          <Input label="Email" type="email" placeholder="store@email.com" value={form.email}
            onChange={(e: any) => setForm((f: any) => ({ ...f, email: e.target.value }))} />
          <Input label="City" value={form.city}
            onChange={(e: any) => setForm((f: any) => ({ ...f, city: e.target.value }))} />
          <Input label="Region" value={form.region}
            onChange={(e: any) => setForm((f: any) => ({ ...f, region: e.target.value }))} />
        </div>
      </div>

      {/* Social Links */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Globe size={16} className="text-green-primary" /> Social & Web
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Input label="Website" placeholder="https://yourfarm.com" value={form.website}
            onChange={(e: any) => setForm((f: any) => ({ ...f, website: e.target.value }))} />
          <Input label="Telegram" placeholder="@yourtelegram" value={form.telegram}
            onChange={(e: any) => setForm((f: any) => ({ ...f, telegram: e.target.value }))} />
          <Input label="Instagram" placeholder="@yourinstagram" value={form.instagram}
            onChange={(e: any) => setForm((f: any) => ({ ...f, instagram: e.target.value }))} />
          <Input label="Facebook" placeholder="facebook.com/yourpage" value={form.facebook}
            onChange={(e: any) => setForm((f: any) => ({ ...f, facebook: e.target.value }))} />
        </div>
      </div>

      <Button fullWidth size="lg" loading={saving} onClick={() => save()}>
        <Save size={18} /> Save All Changes
      </Button>
    </div>
  )
}
