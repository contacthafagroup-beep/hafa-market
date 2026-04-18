import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Layers, Trash2, Edit2, X } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import toast from 'react-hot-toast'

export default function SellerCollections() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', description: '', emoji: '', productIds: '' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['my-collections'],
    queryFn: () => api.get('/features/collections/my').then(r => r.data.data),
  })

  const { data: products = [] } = useQuery({
    queryKey: ['seller-products-for-collection'],
    queryFn: () => api.get('/sellers/me/products?limit=50').then(r => r.data.data),
  })

  const { mutate: save, isLoading: saving } = useMutation({
    mutationFn: () => {
      const data = {
        ...form,
        productIds: form.productIds ? form.productIds.split(',').map(s => s.trim()).filter(Boolean) : [],
      }
      return editId
        ? api.patch(`/features/collections/${editId}`, data)
        : api.post('/features/collections', data)
    },
    onSuccess: () => {
      toast.success(editId ? 'Collection updated!' : 'Collection created!')
      qc.invalidateQueries({ queryKey: ['my-collections'] })
      setShowForm(false); setEditId(null); setForm({ name: '', description: '', emoji: '', productIds: '' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  })

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => api.delete(`/features/collections/${id}`),
    onSuccess: () => { toast.success('Collection deleted'); qc.invalidateQueries({ queryKey: ['my-collections'] }) },
  })

  const startEdit = (col: any) => {
    setEditId(col.id)
    setForm({ name: col.name, description: col.description || '', emoji: col.emoji || '', productIds: col.productIds?.join(', ') || '' })
    setShowForm(true)
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Layers size={20} className="text-green-primary" /> Collections
          </h2>
          <p className="text-sm text-gray-400">Group your products into themed collections</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', description: '', emoji: '', productIds: '' }) }}>
          <Plus size={16} /> New Collection
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-gray-900">{editId ? 'Edit Collection' : 'New Collection'}</h3>
            <button onClick={() => { setShowForm(false); setEditId(null) }}><X size={18} className="text-gray-400" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Collection Name *" placeholder="e.g. Breakfast Essentials" value={form.name} onChange={(e: any) => set('name', e.target.value)} />
            <Input label="Emoji" placeholder="e.g. 🌅" value={form.emoji} onChange={(e: any) => set('emoji', e.target.value)} />
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                placeholder="What's in this collection?"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Products</label>
              <select multiple className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary h-32"
                onChange={e => set('productIds', Array.from(e.target.selectedOptions).map(o => o.value).join(', '))}>
                {products.map((p: any) => (
                  <option key={p.id} value={p.id}
                    selected={form.productIds.includes(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button loading={saving} onClick={() => save()}>
              {editId ? 'Update' : 'Create'} Collection
            </Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditId(null) }}>Cancel</Button>
          </div>
        </div>
      )}

      {!collections.length && !showForm ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <Layers size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400">No collections yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {collections.map((col: any) => (
            <div key={col.id} className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4">
              <div className="text-3xl flex-shrink-0">{col.emoji || '📦'}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{col.name}</p>
                {col.description && <p className="text-xs text-gray-400">{col.description}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{col.productIds?.length || 0} products</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => startEdit(col)} className="p-2 text-gray-400 hover:text-blue-500 transition-colors"><Edit2 size={15} /></button>
                <button onClick={() => remove(col.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
