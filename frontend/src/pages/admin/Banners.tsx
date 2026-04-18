import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Image, Trash2, Edit2, X, ToggleLeft, ToggleRight } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import toast from 'react-hot-toast'

const EMPTY = { title: '', subtitle: '', image: '', linkUrl: '', sortOrder: '0' }

export default function AdminBanners() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [uploading, setUploading] = useState(false)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ['admin-banners'],
    queryFn: () => api.get('/banners/all').then(r => r.data.data),
  })

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => {
      const data = { ...form, sortOrder: parseInt(form.sortOrder) || 0 }
      return editId
        ? api.patch(`/banners/${editId}`, data)
        : api.post('/banners', data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-banners'] })
      toast.success(editId ? 'Banner updated!' : 'Banner created!')
      setShowForm(false); setEditId(null); setForm(EMPTY)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  })

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => api.delete(`/banners/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-banners'] }); toast.success('Banner deleted') },
  })

  const { mutate: toggle } = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/banners/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-banners'] }),
  })

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      set('image', res.data.data.url)
      toast.success('Image uploaded!')
    } catch { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  const startEdit = (b: any) => {
    setEditId(b.id)
    setForm({ title: b.title, subtitle: b.subtitle || '', image: b.image, linkUrl: b.linkUrl || '', sortOrder: String(b.sortOrder || 0) })
    setShowForm(true)
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Image size={20} className="text-green-primary" /> Banners
          </h2>
          <p className="text-sm text-gray-400">{banners.length} banners · shown on homepage</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY) }}>
          <Plus size={16} /> Add Banner
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-gray-900">{editId ? 'Edit Banner' : 'New Banner'}</h3>
            <button onClick={() => { setShowForm(false); setEditId(null) }}><X size={18} className="text-gray-400" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Title *" placeholder="e.g. Fresh Vegetables Sale" value={form.title} onChange={(e: any) => set('title', e.target.value)} />
            <Input label="Subtitle" placeholder="e.g. Up to 40% off" value={form.subtitle} onChange={(e: any) => set('subtitle', e.target.value)} />
            <Input label="Link URL" placeholder="e.g. /products?category=vegetables" value={form.linkUrl} onChange={(e: any) => set('linkUrl', e.target.value)} />
            <Input label="Sort Order" type="number" placeholder="0" value={form.sortOrder} onChange={(e: any) => set('sortOrder', e.target.value)} />
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">Banner Image *</label>
              {form.image ? (
                <div className="relative">
                  <img src={form.image} alt="Banner" className="w-full h-32 object-cover rounded-xl" />
                  <button onClick={() => set('image', '')} className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">×</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-4 hover:border-green-primary transition-colors">
                  <Image size={20} className="text-gray-400" />
                  <span className="text-sm text-gray-500">{uploading ? 'Uploading...' : 'Upload banner image'}</span>
                  <input type="file" accept="image/*" onChange={uploadImage} className="hidden" disabled={uploading} />
                </label>
              )}
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button loading={saving} disabled={!form.title || !form.image} onClick={() => save()}>
              {editId ? 'Update' : 'Create'} Banner
            </Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditId(null) }}>Cancel</Button>
          </div>
        </div>
      )}

      {!banners.length && !showForm ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <Image size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400">No banners yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b: any) => (
            <div key={b.id} className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4">
              <div className="w-24 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                {b.image && <img src={b.image} alt={b.title} className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{b.title}</p>
                {b.subtitle && <p className="text-xs text-gray-400">{b.subtitle}</p>}
                {b.linkUrl && <p className="text-xs text-blue-500">{b.linkUrl}</p>}
                <p className="text-xs text-gray-400">Sort: {b.sortOrder}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggle({ id: b.id, isActive: !b.isActive })} className="p-1.5 rounded-lg hover:bg-gray-100">
                  {b.isActive ? <ToggleRight size={20} className="text-green-primary" /> : <ToggleLeft size={20} className="text-gray-400" />}
                </button>
                <button onClick={() => startEdit(b)} className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"><Edit2 size={15} /></button>
                <button onClick={() => remove(b.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
