import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tag, Plus, Trash2, X, ToggleLeft, ToggleRight, Copy } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const EMPTY = {
  code: '', description: '', discountType: 'PERCENTAGE', discountValue: '',
  minOrderAmount: '', maxUses: '', expiresAt: '',
}

function genCode() {
  return 'HAFA' + Math.random().toString(36).slice(2, 6).toUpperCase()
}

export default function SellerPromoCodes() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const { data: codes = [], isLoading } = useQuery({
    queryKey: ['seller-promo-codes'],
    queryFn: () => api.get('/admin/promo-codes').then(r => r.data.data).catch(() => []),
  })

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () => api.post('/admin/promo-codes', {
      code: form.code.toUpperCase(),
      description: form.description,
      discountType: form.discountType,
      discountValue: parseFloat(form.discountValue),
      minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : 0,
      maxUses: form.maxUses ? parseInt(form.maxUses) : null,
      expiresAt: form.expiresAt || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller-promo-codes'] })
      toast.success('Promo code created!')
      setShowForm(false); setForm(EMPTY)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to create'),
  })

  const { mutate: toggle } = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/promo-codes/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seller-promo-codes'] }),
  })

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/promo-codes/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['seller-promo-codes'] }); toast.success('Deleted') },
  })

  const copy = (code: string) => { navigator.clipboard.writeText(code); toast.success('Code copied!') }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Tag size={20} className="text-green-primary" /> Promo Codes
          </h2>
          <p className="text-sm text-gray-400">Create discount codes for your customers</p>
        </div>
        <Button onClick={() => { setShowForm(true); setForm({ ...EMPTY, code: genCode() }) }}>
          <Plus size={16} /> Create Code
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-gray-900">New Promo Code</h3>
            <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Code *</label>
              <div className="flex gap-2">
                <input value={form.code} onChange={e => set('code', e.target.value.toUpperCase())}
                  placeholder="e.g. SAVE20"
                  className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary font-mono font-bold tracking-widest" />
                <button onClick={() => set('code', genCode())}
                  className="px-3 py-2 border-2 border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:border-green-primary transition-colors">
                  🎲 Random
                </button>
              </div>
            </div>
            <Input label="Description" placeholder="e.g. 20% off for new customers" value={form.description}
              onChange={(e: any) => set('description', e.target.value)} />
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Discount Type</label>
              <div className="flex gap-2">
                {[['PERCENTAGE', '% Off'], ['FIXED', 'ETB Off']].map(([val, label]) => (
                  <label key={val} className={`flex items-center gap-2 px-4 py-2.5 border-2 rounded-xl cursor-pointer text-sm font-medium transition-all flex-1 justify-center ${form.discountType === val ? 'border-green-primary bg-green-50 text-green-primary' : 'border-gray-200 text-gray-600'}`}>
                    <input type="radio" value={val} checked={form.discountType === val} onChange={() => set('discountType', val)} className="hidden" />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <Input label={`Discount Value ${form.discountType === 'PERCENTAGE' ? '(%)' : '(ETB)'} *`}
              type="number" placeholder="e.g. 20" value={form.discountValue}
              onChange={(e: any) => set('discountValue', e.target.value)} />
            <Input label="Min Order Amount (ETB)" type="number" placeholder="0 = no minimum" value={form.minOrderAmount}
              onChange={(e: any) => set('minOrderAmount', e.target.value)} />
            <Input label="Max Uses (blank = unlimited)" type="number" placeholder="e.g. 100" value={form.maxUses}
              onChange={(e: any) => set('maxUses', e.target.value)} />
            <Input label="Expires At (optional)" type="datetime-local" value={form.expiresAt}
              onChange={(e: any) => set('expiresAt', e.target.value)} />
          </div>
          <div className="flex gap-3 mt-5">
            <Button loading={creating} disabled={!form.code || !form.discountValue} onClick={() => create()}>
              <Tag size={15} /> Create Code
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {!codes.length && !showForm ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <Tag size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400">No promo codes yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {codes.map((code: any) => {
            const isExpired = code.expiresAt && new Date(code.expiresAt) < new Date()
            return (
              <div key={code.id} className={`bg-white rounded-2xl shadow-card p-4 flex items-center gap-4 ${isExpired ? 'opacity-60' : ''}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-black text-gray-900 font-mono tracking-widest text-lg">{code.code}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      isExpired ? 'bg-gray-100 text-gray-500' :
                      code.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {isExpired ? 'Expired' : code.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                      {code.discountType === 'PERCENTAGE' ? `-${code.discountValue}%` : `-ETB ${code.discountValue}`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{code.description || 'No description'}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{code.usedCount}/{code.maxUses || '∞'} used</span>
                    {code.minOrderAmount > 0 && <span>Min: ETB {code.minOrderAmount}</span>}
                    {code.expiresAt && <span>Expires: {formatDate(code.expiresAt)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => copy(code.code)} className="p-2 text-gray-400 hover:text-green-primary transition-colors" title="Copy code">
                    <Copy size={15} />
                  </button>
                  {!isExpired && (
                    <button onClick={() => toggle({ id: code.id, isActive: !code.isActive })} className="p-1.5 rounded-lg hover:bg-gray-100">
                      {code.isActive ? <ToggleRight size={20} className="text-green-primary" /> : <ToggleLeft size={20} className="text-gray-400" />}
                    </button>
                  )}
                  <button onClick={() => remove(code.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
