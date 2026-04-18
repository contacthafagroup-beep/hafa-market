import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Zap, X, ToggleLeft, ToggleRight, Clock } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface SaleForm {
  name: string; discountType: 'PERCENTAGE'|'FIXED'; discountValue: string
  startsAt: string; endsAt: string; maxUses: string; productIds: string
}
const EMPTY: SaleForm = { name:'', discountType:'PERCENTAGE', discountValue:'', startsAt:'', endsAt:'', maxUses:'', productIds:'' }

function Countdown({ endsAt }: { endsAt: string }) {
  const end  = new Date(endsAt).getTime()
  const now  = Date.now()
  const diff = Math.max(0, end - now)
  const h    = Math.floor(diff / 3600000)
  const m    = Math.floor((diff % 3600000) / 60000)
  const s    = Math.floor((diff % 60000) / 1000)
  if (diff === 0) return <span className="text-red-500 text-xs font-bold">Ended</span>
  return <span className="text-orange-600 text-xs font-bold font-mono">{h}h {m}m {s}s</span>
}

export default function AdminFlashSales() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<SaleForm>(EMPTY)
  const set = (k: keyof SaleForm, v: string) => setForm(f => ({ ...f, [k]: v }))

  const { data, isLoading } = useQuery({
    queryKey: ['admin-flash-sales'],
    queryFn: () => api.get('/admin/flash-sales').then(r => r.data.data),
    refetchInterval: 10000,
  })

  const { mutate: create, isLoading: creating } = useMutation({
    mutationFn: () => api.post('/admin/flash-sales', {
      name: form.name,
      discountType: form.discountType,
      discountValue: parseFloat(form.discountValue),
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      maxUses: form.maxUses ? parseInt(form.maxUses) : null,
      productIds: form.productIds ? form.productIds.split(',').map(s => s.trim()).filter(Boolean) : [],
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-flash-sales'] }); setShowForm(false); setForm(EMPTY); toast.success('Flash sale created!') },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  })

  const { mutate: toggle } = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/admin/flash-sales/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-flash-sales'] }),
  })

  const sales = data || []
  const now = new Date()
  const active  = sales.filter((s: any) => s.isActive && new Date(s.endsAt) > now)
  const upcoming = sales.filter((s: any) => s.isActive && new Date(s.startsAt) > now)
  const ended   = sales.filter((s: any) => !s.isActive || new Date(s.endsAt) <= now)

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Zap size={20} className="text-orange-500" /> Flash Sales
          </h2>
          <p className="text-sm text-gray-400">{active.length} active · {upcoming.length} upcoming</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={16}/> New Flash Sale</Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-gray-900">Create Flash Sale</h3>
            <button onClick={() => { setShowForm(false); setForm(EMPTY) }} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={18}/></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Sale Name *" placeholder="e.g. Weekend Veggie Sale" value={form.name} onChange={(e: any) => set('name', e.target.value)} />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Discount Type</label>
              <div className="flex gap-3">
                {(['PERCENTAGE','FIXED'] as const).map(t => (
                  <label key={t} className={`flex items-center gap-2 px-4 py-2.5 border-2 rounded-xl cursor-pointer text-sm font-medium transition-all ${form.discountType===t ? 'border-green-primary bg-green-50 text-green-primary' : 'border-gray-200 text-gray-600'}`}>
                    <input type="radio" value={t} checked={form.discountType===t} onChange={() => set('discountType', t)} className="accent-green-primary" />
                    {t === 'PERCENTAGE' ? '% Off' : 'ETB Off'}
                  </label>
                ))}
              </div>
            </div>
            <Input label={`Discount Value ${form.discountType==='PERCENTAGE'?'(%)':'(ETB)'} *`} type="number" placeholder="e.g. 30" value={form.discountValue} onChange={(e: any) => set('discountValue', e.target.value)} />
            <Input label="Max Uses (blank = unlimited)" type="number" placeholder="e.g. 100" value={form.maxUses} onChange={(e: any) => set('maxUses', e.target.value)} />
            <Input label="Starts At *" type="datetime-local" value={form.startsAt} onChange={(e: any) => set('startsAt', e.target.value)} />
            <Input label="Ends At *" type="datetime-local" value={form.endsAt} onChange={(e: any) => set('endsAt', e.target.value)} />
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product IDs (comma-separated, blank = all products)</label>
              <input value={form.productIds} onChange={e => set('productIds', e.target.value)} placeholder="Leave blank to apply to all products..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary" />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <Button onClick={() => create()} loading={creating} disabled={!form.name || !form.discountValue || !form.startsAt || !form.endsAt}>
              <Zap size={15}/> Launch Flash Sale
            </Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setForm(EMPTY) }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Active sales */}
      {active.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">🔥 Active Now</p>
          <div className="space-y-3">
            {active.map((s: any) => <SaleCard key={s.id} sale={s} onToggle={toggle} />)}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">⏰ Upcoming</p>
          <div className="space-y-3">
            {upcoming.map((s: any) => <SaleCard key={s.id} sale={s} onToggle={toggle} />)}
          </div>
        </div>
      )}

      {/* Ended */}
      {ended.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">✅ Ended</p>
          <div className="space-y-2 opacity-60">
            {ended.slice(0, 5).map((s: any) => <SaleCard key={s.id} sale={s} onToggle={toggle} />)}
          </div>
        </div>
      )}

      {!sales.length && !showForm && (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <Zap size={40} className="mx-auto text-gray-200 mb-3"/>
          <p className="text-gray-400">No flash sales yet. Create your first one!</p>
        </div>
      )}
    </div>
  )
}

function SaleCard({ sale, onToggle }: { sale: any; onToggle: any }) {
  const now    = new Date()
  const isLive = sale.isActive && new Date(sale.startsAt) <= now && new Date(sale.endsAt) > now
  const disc   = sale.discount || {}

  return (
    <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isLive ? 'bg-orange-100' : 'bg-gray-100'}`}>
        <Zap size={18} className={isLive ? 'text-orange-500' : 'text-gray-400'} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-gray-900">{sale.name}</span>
          {isLive && <span className="text-[10px] bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
          <span className="text-xs font-bold text-green-primary bg-green-50 px-2 py-0.5 rounded-full">
            {disc.type === 'PERCENTAGE' ? `-${disc.value}%` : `-ETB ${disc.value}`}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1"><Clock size={10}/> {formatDate(sale.startsAt)} → {formatDate(sale.endsAt)}</span>
          {isLive && <Countdown endsAt={sale.endsAt} />}
          {sale.usedCount > 0 && <span>{sale.usedCount}/{sale.maxUses || '∞'} used</span>}
        </div>
      </div>
      <button onClick={() => onToggle({ id: sale.id, isActive: !sale.isActive })}
        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 flex-shrink-0">
        {sale.isActive ? <ToggleRight size={22} className="text-green-primary"/> : <ToggleLeft size={22}/>}
      </button>
    </div>
  )
}
