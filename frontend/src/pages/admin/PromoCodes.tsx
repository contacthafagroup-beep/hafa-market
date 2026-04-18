import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Tag, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface PromoForm {
  code: string; description: string; discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: string; minOrderAmount: string; maxUses: string; expiresAt: string
}

const EMPTY: PromoForm = {
  code: '', description: '', discountType: 'PERCENTAGE',
  discountValue: '', minOrderAmount: '0', maxUses: '', expiresAt: '',
}

export default function AdminPromoCodes() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PromoForm>(EMPTY)
  const set = (k: keyof PromoForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const { data, isLoading } = useQuery({
    queryKey: ['admin-promos'],
    queryFn: () => api.get('/admin/promo-codes').then(r => r.data.data),
  })

  const { mutate: create, isLoading: creating } = useMutation({
    mutationFn: () => api.post('/admin/promo-codes', {
      code: form.code.toUpperCase().trim(),
      description: form.description,
      discountType: form.discountType,
      discountValue: parseFloat(form.discountValue),
      minOrderAmount: parseFloat(form.minOrderAmount) || 0,
      maxUses: form.maxUses ? parseInt(form.maxUses) : null,
      expiresAt: form.expiresAt || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-promos'] })
      setShowForm(false); setForm(EMPTY)
      toast.success('Promo code created!')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create'),
  })

  const { mutate: toggle } = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/promo-codes/${id}`, { isActive }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-promos'] }); toast.success('Updated') },
  })

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/promo-codes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-promos'] }); toast.success('Deleted') },
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  const promos = data || []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Promo Codes</h2>
          <p className="text-sm text-gray-400">{promos.length} codes</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} /> New Code
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-gray-900">Create Promo Code</h3>
            <button onClick={() => { setShowForm(false); setForm(EMPTY) }}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Code *" placeholder="e.g. HAFA20" value={form.code}
              onChange={(e: any) => set('code', e.target.value.toUpperCase())} />
            <Input label="Description" placeholder="e.g. 20% off first order" value={form.description}
              onChange={(e: any) => set('description', e.target.value)} />

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Discount Type</label>
              <div className="flex gap-3">
                {(['PERCENTAGE', 'FIXED'] as const).map(t => (
                  <label key={t} className={`flex items-center gap-2 px-4 py-2.5 border-2 rounded-xl cursor-pointer text-sm font-medium transition-all ${form.discountType === t ? 'border-green-primary bg-green-50 text-green-primary' : 'border-gray-200 text-gray-600'}`}>
                    <input type="radio" value={t} checked={form.discountType === t}
                      onChange={() => set('discountType', t)} className="accent-green-primary" />
                    {t === 'PERCENTAGE' ? '% Percentage' : '$ Fixed Amount'}
                  </label>
                ))}
              </div>
            </div>

            <Input label={`Discount Value ${form.discountType === 'PERCENTAGE' ? '(%)' : '($)'} *`}
              type="number" placeholder={form.discountType === 'PERCENTAGE' ? '10' : '5.00'}
              value={form.discountValue} onChange={(e: any) => set('discountValue', e.target.value)} />

            <Input label="Min Order Amount ($)" type="number" placeholder="0"
              value={form.minOrderAmount} onChange={(e: any) => set('minOrderAmount', e.target.value)} />
            <Input label="Max Uses (leave blank = unlimited)" type="number" placeholder="100"
              value={form.maxUses} onChange={(e: any) => set('maxUses', e.target.value)} />
            <Input label="Expires At (optional)" type="datetime-local"
              value={form.expiresAt} onChange={(e: any) => set('expiresAt', e.target.value)} />
          </div>
          <div className="flex gap-3 mt-5">
            <Button onClick={() => create()} loading={creating}
              disabled={!form.code || !form.discountValue}>
              <Tag size={15} /> Create Code
            </Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY) }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Promo list */}
      {!promos.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <Tag size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400">No promo codes yet. Create your first one!</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Code', 'Discount', 'Min Order', 'Used / Max', 'Expires', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {promos.map((p: any) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-extrabold text-gray-900 font-mono bg-gray-100 px-2 py-0.5 rounded-lg text-sm">
                        {p.code}
                      </span>
                      {p.description && <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>}
                    </td>
                    <td className="py-3 px-4 font-bold text-green-primary">
                      {p.discountType === 'PERCENTAGE' ? `${p.discountValue}%` : `$${p.discountValue}`}
                    </td>
                    <td className="py-3 px-4 text-gray-500">${p.minOrderAmount || 0}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {p.usedCount} / {p.maxUses || '∞'}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs">
                      {p.expiresAt ? formatDate(p.expiresAt) : 'Never'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge text-xs ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggle({ id: p.id, isActive: !p.isActive })}
                          title={p.isActive ? 'Deactivate' : 'Activate'}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                          {p.isActive ? <ToggleRight size={18} className="text-green-primary" /> : <ToggleLeft size={18} />}
                        </button>
                        <button onClick={() => { if (confirm('Delete this promo code?')) remove(p.id) }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
