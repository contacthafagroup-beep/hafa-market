import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Megaphone, ToggleLeft, ToggleRight, TrendingUp, MousePointer, DollarSign, X } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

const PLACEMENTS = [
  { value: 'SEARCH_TOP',    label: 'Search Results Top',  desc: 'Appear above organic search results' },
  { value: 'HOMEPAGE',      label: 'Homepage Featured',   desc: 'Show on the homepage' },
  { value: 'CATEGORY_PAGE', label: 'Category Page',       desc: 'Top of category listings' },
  { value: 'PRODUCT_PAGE',  label: 'Product Page',        desc: 'Shown on similar product pages' },
]

export default function SellerAds() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ productId:'', placement:'SEARCH_TOP', budget:'', bidPerClick:'1', endsAt:'' })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const { data: ads, isLoading } = useQuery({
    queryKey: ['seller-ads'],
    queryFn: () => api.get('/ads/my').then(r => r.data.data),
  })

  const { data: products } = useQuery({
    queryKey: ['seller-products-for-ads'],
    queryFn: () => api.get('/sellers/me/products?limit=50').then(r => r.data.data),
  })

  const { mutate: create, isLoading: creating } = useMutation({
    mutationFn: () => api.post('/ads', {
      productId: form.productId || undefined,
      placement: form.placement,
      budget: parseFloat(form.budget),
      bidPerClick: parseFloat(form.bidPerClick),
      endsAt: form.endsAt || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['seller-ads'] }); setShowForm(false); toast.success('Ad campaign launched!') },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create ad'),
  })

  const { mutate: toggleAd } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/ads/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['seller-ads'] }),
  })

  const adList = ads || []
  const totalSpent  = adList.reduce((s: number, a: any) => s + (a.spent || 0), 0)
  const totalClicks = adList.reduce((s: number, a: any) => s + (a.clicks || 0), 0)
  const activeCount = adList.filter((a: any) => a.status === 'ACTIVE').length

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Megaphone size={20} className="text-blue-500"/> Sponsored Ads
          </h2>
          <p className="text-sm text-gray-400">{activeCount} active campaigns</p>
        </div>
        <Button onClick={() => setShowForm(true)}><Plus size={16}/> Create Ad</Button>
      </div>

      {/* Summary stats */}
      {adList.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label:'Total Spent',  value: formatPrice(totalSpent),  icon:<DollarSign size={18}/>, color:'bg-red-50 text-red-500' },
            { label:'Total Clicks', value: totalClicks,              icon:<MousePointer size={18}/>, color:'bg-blue-50 text-blue-500' },
            { label:'Active Ads',   value: activeCount,              icon:<TrendingUp size={18}/>, color:'bg-green-50 text-green-primary' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl shadow-card p-4 text-center">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2 ${s.color}`}>{s.icon}</div>
              <p className="text-xl font-extrabold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-gray-900">Create Ad Campaign</h3>
            <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={18}/></button>
          </div>

          <div className="space-y-4">
            {/* Product selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Product to Promote</label>
              <select value={form.productId} onChange={e => set('productId', e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
                <option value="">All my products (store promotion)</option>
                {products?.map((p: any) => <option key={p.id} value={p.id}>{p.name} — ETB {p.price}</option>)}
              </select>
            </div>

            {/* Placement */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Ad Placement</label>
              <div className="grid sm:grid-cols-2 gap-3">
                {PLACEMENTS.map(pl => (
                  <label key={pl.value} className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${form.placement===pl.value ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" value={pl.value} checked={form.placement===pl.value} onChange={() => set('placement', pl.value)} className="mt-0.5 accent-green-primary" />
                    <div>
                      <p className="text-sm font-bold text-gray-800">{pl.label}</p>
                      <p className="text-xs text-gray-400">{pl.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <Input label="Total Budget (ETB) *" type="number" placeholder="e.g. 500" value={form.budget} onChange={(e: any) => set('budget', e.target.value)} />
              <Input label="Bid per Click (ETB)" type="number" placeholder="e.g. 1.50" value={form.bidPerClick} onChange={(e: any) => set('bidPerClick', e.target.value)} />
              <Input label="End Date (optional)" type="date" value={form.endsAt} onChange={(e: any) => set('endsAt', e.target.value)} />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
              💡 Budget is deducted from your wallet per click. Higher bid = better placement. Campaign pauses automatically when budget is exhausted.
            </div>

            <div className="flex gap-3">
              <Button onClick={() => create()} loading={creating} disabled={!form.budget || !form.placement}>
                <Megaphone size={15}/> Launch Campaign
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Ads list */}
      {!adList.length && !showForm ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <Megaphone size={40} className="mx-auto text-gray-200 mb-3"/>
          <h3 className="font-bold text-gray-700 mb-2">No ad campaigns yet</h3>
          <p className="text-gray-400 text-sm mb-4">Boost your products to reach more buyers</p>
          <Button onClick={() => setShowForm(true)}><Plus size={14}/> Create Your First Ad</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {adList.map((ad: any) => (
            <div key={ad.id} className="bg-white rounded-2xl shadow-card p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${ad.status==='ACTIVE' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                  <Megaphone size={18} className={ad.status==='ACTIVE' ? 'text-blue-500' : 'text-gray-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">{ad.product?.name || 'Store Promotion'}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ad.status==='ACTIVE' ? 'bg-green-100 text-green-700' : ad.status==='PAUSED' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                      {ad.status}
                    </span>
                    <span className="text-xs text-gray-400">{ad.placement.replace(/_/g,' ')}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 flex-wrap">
                    <span>💰 ETB {ad.spent?.toFixed(2)} / {ad.budget}</span>
                    <span>👆 {ad.clicks} clicks</span>
                    <span>👁 {ad.impressions} impressions</span>
                    <span className="font-bold text-blue-600">CTR: {ad.ctr}</span>
                  </div>
                  {/* Budget progress */}
                  <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${Math.min(ad.budgetUsed, 100)}%` }} />
                  </div>
                </div>
                <button onClick={() => toggleAd({ id: ad.id, status: ad.status==='ACTIVE' ? 'PAUSED' : 'ACTIVE' })}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
                  {ad.status==='ACTIVE' ? <ToggleRight size={22} className="text-green-primary"/> : <ToggleLeft size={22} className="text-gray-400"/>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
