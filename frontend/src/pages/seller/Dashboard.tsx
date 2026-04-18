import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, Package, ShoppingBag, Star, CreditCard, Store, ArrowRight, CheckCircle, DollarSign, X } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import OnboardingChecklist from '@/components/seller/OnboardingChecklist'
import { formatPrice, formatDate, getOrderStatusColor } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Seller Onboarding ────────────────────────────────────────────────────────
function SellerOnboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    storeName: '', description: '', phone: '', email: '',
    city: 'Hossana', region: 'Hadiya Zone', country: 'Ethiopia',
    bankName: '', bankAccount: '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.storeName.trim()) { toast.error('Store name is required'); return }
    setLoading(true)
    try {
      await api.post('/sellers/register', form)
      toast.success('Store created! Pending admin verification 🎉')
      onDone()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create store')
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-3 mb-8">
        {[1, 2, 3].map(n => (
          <div key={n} className="flex items-center gap-3 flex-1">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 transition-all ${
              step > n ? 'bg-green-primary text-white' :
              step === n ? 'bg-green-primary text-white ring-4 ring-green-100' :
              'bg-gray-100 text-gray-400'
            }`}>
              {step > n ? <CheckCircle size={16} /> : n}
            </div>
            {n < 3 && <div className={`flex-1 h-1 rounded-full transition-all ${step > n ? 'bg-green-primary' : 'bg-gray-100'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-card p-8">
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 mb-1">🌿 Set Up Your Store</h2>
              <p className="text-gray-400 text-sm">Tell buyers about your farm or business</p>
            </div>
            <Input label="Store Name *" placeholder="e.g. Abebe's Fresh Farm" value={form.storeName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('storeName', e.target.value)} />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Tell buyers what you sell, your farming methods, location..."
                rows={4} className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none" />
            </div>
            <Button fullWidth onClick={() => { if (!form.storeName.trim()) { toast.error('Store name is required'); return } setStep(2) }}>
              Continue <ArrowRight size={16} />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 mb-1">📞 Contact & Location</h2>
              <p className="text-gray-400 text-sm">How buyers and Hafa Market can reach you</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Phone Number" placeholder="+251 911 000 000" value={form.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('phone', e.target.value)} />
              <Input label="Business Email" type="email" placeholder="store@email.com" value={form.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('email', e.target.value)} />
              <Input label="City" value={form.city}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('city', e.target.value)} />
              <Input label="Region" value={form.region}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('region', e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button fullWidth onClick={() => setStep(3)}>Continue <ArrowRight size={16} /></Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-extrabold text-gray-900 mb-1">💳 Payment Details</h2>
              <p className="text-gray-400 text-sm">Where we send your earnings (optional — add later)</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Bank Name" placeholder="e.g. Commercial Bank of Ethiopia" value={form.bankName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('bankName', e.target.value)} />
              <Input label="Account Number" placeholder="Your bank account number" value={form.bankAccount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('bankAccount', e.target.value)} />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              ⏳ After submitting, your store will be reviewed by our team within 24 hours before going live.
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button fullWidth loading={loading} onClick={handleSubmit}>
                🚀 Submit Store Application
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Pending Verification Screen ─────────────────────────────────────────────
function PendingVerification() {
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="text-6xl mb-4">⏳</div>
      <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Store Under Review</h2>
      <p className="text-gray-500 mb-2">Your store application has been submitted. Our team reviews applications within <strong>24 hours</strong> on business days.</p>
      <p className="text-gray-400 text-sm mb-6">You'll receive an email and in-app notification once approved.</p>
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-left space-y-3 mb-6">
        {[
          { icon: '✅', text: 'Store profile created' },
          { icon: '⏳', text: 'Admin verification — usually within 24 hours' },
          { icon: '🔒', text: 'List products — available after verification' },
          { icon: '💰', text: 'Start selling & earning' },
        ].map(item => (
          <div key={item.text} className="flex items-center gap-3 text-sm">
            <span className="text-lg">{item.icon}</span>
            <span className="text-gray-700">{item.text}</span>
          </div>
        ))}
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-bold mb-1">Need help or have questions?</p>
        <p>Email us at <a href="mailto:sellers@hafamarket.com" className="underline font-semibold">sellers@hafamarket.com</a> or message us on <a href="https://t.me/HafaMarketBot" target="_blank" rel="noreferrer" className="underline font-semibold">Telegram</a>.</p>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function SellerDashboard() {
  const qc = useQueryClient()

  const { data: storeData, isLoading: storeLoading } = useQuery({
    queryKey: ['my-store'],
    queryFn: () => api.get('/sellers/me/store').then(r => r.data.data).catch(err => {
      if (err?.response?.status === 404) return null
      throw err
    }),
    retry: false,
  })

  // Feature 8: Seller tier — use storeData.id once available
  const { data: tierData } = useQuery({
    queryKey: ['my-seller-tier', storeData?.id],
    queryFn: () => api.get(`/features/seller-tier/${storeData!.id}`).then(r => r.data.data).catch(() => null),
    enabled: !!storeData?.id,
  })

  const { data, isLoading: analyticsLoading } = useQuery({
    queryKey: ['seller-analytics'],
    queryFn: () => api.get('/sellers/me/analytics').then(r => r.data.data),
    enabled: storeData?.status === 'VERIFIED',
  })

  const { data: payouts } = useQuery({
    queryKey: ['seller-payouts'],
    queryFn: () => api.get('/sellers/me/payouts').then(r => r.data.data),
    enabled: storeData?.status === 'VERIFIED',
  })

  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutAmount, setPayoutAmount] = useState('')
  const [payoutMethod, setPayoutMethod] = useState('BANK_TRANSFER')

  const { mutate: requestPayout, isPending: payoutLoading } = useMutation({
    mutationFn: () => api.post('/sellers/me/payouts', {
      amount: parseFloat(payoutAmount),
      method: payoutMethod,
    }),
    onSuccess: () => {
      toast.success('Payout request submitted!')
      setShowPayoutModal(false)
      setPayoutAmount('')
      qc.invalidateQueries({ queryKey: ['seller-payouts'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Request failed'),
  })

  if (storeLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  // No store yet — show onboarding
  if (!storeData) {
    return <SellerOnboarding onDone={() => qc.invalidateQueries({ queryKey: ['my-store'] })} />
  }

  // Store exists but pending verification
  if (storeData.status === 'PENDING') {
    return <PendingVerification />
  }

  // Store is verified — show full dashboard
  const stats = [
    { label: 'Total Revenue',  value: formatPrice(data?.overview?.totalRevenue || 0), icon: <TrendingUp size={22} />, color: 'bg-green-50 text-green-primary' },
    { label: 'Total Sales',    value: data?.overview?.totalSales || 0,                icon: <ShoppingBag size={22} />, color: 'bg-blue-50 text-blue-600' },
    { label: 'Today Revenue',  value: formatPrice(data?.today?.revenue || 0),         icon: <TrendingUp size={22} />, color: 'bg-orange-50 text-orange-600' },
    { label: 'Rating',         value: `${data?.overview?.rating?.toFixed(1) || '—'}★`, icon: <Star size={22} />,      color: 'bg-yellow-50 text-yellow-600' },
  ]

  return (
    <div className="space-y-6">
      {/* Store header */}
      <div className="bg-gradient-to-br from-green-dark to-green-primary rounded-2xl p-5 text-white flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0">
          <Store size={28} />
        </div>
        <div>
          <h2 className="text-xl font-extrabold">{storeData.storeName}</h2>
          <p className="text-white/70 text-sm">{storeData.city}, {storeData.country}</p>
        </div>
        <div className="ml-auto">
          <span className="bg-green-400/30 border border-green-300/40 text-white text-xs font-bold px-3 py-1 rounded-full">
            ✓ Verified
          </span>
        </div>
      </div>

      {/* Onboarding checklist */}
      <OnboardingChecklist store={storeData} />

      {/* Feature 8: Seller Tier Card */}
      {tierData && (
        <div className={`rounded-2xl p-4 flex items-center gap-4 ${
          tierData.tier === 'PLATINUM' ? 'bg-gradient-to-r from-purple-600 to-purple-800' :
          tierData.tier === 'GOLD'     ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
          tierData.tier === 'SILVER'   ? 'bg-gradient-to-r from-gray-400 to-gray-600' :
          'bg-gradient-to-r from-orange-400 to-orange-600'
        } text-white`}>
          <div className="text-4xl">
            {tierData.tier === 'PLATINUM' ? '💎' : tierData.tier === 'GOLD' ? '🥇' : tierData.tier === 'SILVER' ? '🥈' : '🥉'}
          </div>
          <div className="flex-1">
            <p className="font-extrabold text-lg">{tierData.tier} Seller</p>
            <p className="text-white/80 text-sm">{tierData.benefit || 'Keep selling to unlock higher tiers!'}</p>
          </div>
          {tierData.nextTier && (
            <div className="text-right">
              <p className="text-xs text-white/70">Next: {tierData.nextTier}</p>
              <div className="w-24 h-2 bg-white/20 rounded-full mt-1">
                <div className="h-full bg-white rounded-full" style={{ width: `${tierData.progress || 0}%` }} />
              </div>
              <p className="text-xs text-white/70 mt-0.5">{tierData.progress || 0}%</p>
            </div>
          )}
        </div>
      )}

      {analyticsLoading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(s => (
              <div key={s.label} className="bg-white rounded-2xl shadow-card p-5">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>{s.icon}</div>
                <div className="text-2xl font-extrabold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-card p-5">
              <h3 className="font-extrabold text-gray-900 mb-4 flex items-center gap-2">
                <Package size={18} className="text-green-primary" /> Top Products
              </h3>
              {!data?.topProducts?.length ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <ShoppingBag size={32} className="mx-auto mb-2 opacity-30" />
                  No products yet. <a href="/dashboard/products" className="text-green-primary font-semibold">Add your first product →</a>
                </div>
              ) : data.topProducts.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">
                    {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" alt="" /> : '🛒'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.soldCount} sold · {p.stock} in stock</p>
                  </div>
                  <span className="font-bold text-green-primary text-sm flex-shrink-0">{formatPrice(p.price)}</span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-card p-5">
              <h3 className="font-extrabold text-gray-900 mb-4">Recent Orders</h3>
              {!data?.recentOrders?.length ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <Package size={32} className="mx-auto mb-2 opacity-30" />
                  No orders yet
                </div>
              ) : data.recentOrders.slice(0, 5).map((o: any) => (
                <div key={o.id} className="flex items-center gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">#{o.id.slice(-8).toUpperCase()}</p>
                    <p className="text-xs text-gray-400">{formatDate(o.createdAt)}</p>
                  </div>
                  <span className={`badge text-xs ${getOrderStatusColor(o.status)}`}>{o.status.replace(/_/g,' ')}</span>
                  <span className="font-bold text-sm flex-shrink-0">{formatPrice(o.total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payout History */}
          <div className="bg-white rounded-2xl shadow-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900 flex items-center gap-2">
                <CreditCard size={18} className="text-green-primary" /> Payout History
              </h3>
              <Button size="sm" onClick={() => setShowPayoutModal(true)}>
                <DollarSign size={14} /> Request Payout
              </Button>
            </div>
            {!payouts?.length ? (
              <p className="text-sm text-gray-400 text-center py-6">No payouts yet. Payouts are processed weekly.</p>
            ) : payouts.slice(0, 5).map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{formatPrice(p.amount)}</p>
                  <p className="text-xs text-gray-400">{p.method?.replace(/_/g,' ')} · {formatDate(p.createdAt)}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  p.status === 'COMPLETED' ? 'bg-green-100 text-green-primary' :
                  p.status === 'PENDING'   ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-600'
                }`}>{p.status}</span>
              </div>
            ))}
          </div>

          {/* Payout Request Modal */}
          {showPayoutModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPayoutModal(false)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-extrabold text-gray-900">Request Payout</h3>
                  <button onClick={() => setShowPayoutModal(false)}><X size={20} className="text-gray-400" /></button>
                </div>
                <div className="bg-green-50 rounded-xl p-3 mb-4 text-sm text-green-800">
                  Available balance: <span className="font-extrabold">{formatPrice(data?.overview?.totalRevenue || 0)}</span>
                </div>
                <div className="space-y-4">
                  <Input label="Amount (ETB)" type="number" placeholder="e.g. 500"
                    value={payoutAmount} onChange={(e: any) => setPayoutAmount(e.target.value)} />
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Payment Method</label>
                    <select value={payoutMethod} onChange={e => setPayoutMethod(e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary">
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="TELEBIRR">TeleBirr</option>
                      <option value="CBE_BIRR">CBE Birr</option>
                      <option value="MPESA">M-Pesa</option>
                    </select>
                  </div>
                  <div className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">
                    ⏱ Payouts are processed within 2–3 business days. Minimum payout: ETB 100.
                  </div>
                  <Button fullWidth loading={payoutLoading}
                    disabled={!payoutAmount || parseFloat(payoutAmount) < 100}
                    onClick={() => requestPayout()}>
                    <DollarSign size={16} /> Submit Payout Request
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
