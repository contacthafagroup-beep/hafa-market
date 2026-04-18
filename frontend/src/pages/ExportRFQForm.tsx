/**
 * ExportRFQForm — /export/rfq
 * Buyer posts a buying request (open RFQ) — sellers can respond
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Globe, Package } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { value: 'COFFEE', label: 'Coffee', emoji: '☕' },
  { value: 'TEFF', label: 'Teff', emoji: '🌾' },
  { value: 'HONEY', label: 'Honey', emoji: '🍯' },
  { value: 'SPICES', label: 'Spices', emoji: '🌿' },
  { value: 'AVOCADO', label: 'Avocado', emoji: '🥑' },
  { value: 'SESAME', label: 'Sesame', emoji: '🌱' },
  { value: 'PULSES', label: 'Pulses', emoji: '🫘' },
  { value: 'OIL_SEEDS', label: 'Oil Seeds', emoji: '🌻' },
  { value: 'LEATHER', label: 'Leather', emoji: '👜' },
  { value: 'FLOWERS', label: 'Flowers', emoji: '🌸' },
  { value: 'OTHER', label: 'Other', emoji: '📦' },
]

const COUNTRIES = [
  'United States','United Kingdom','Germany','France','Netherlands','Italy','Spain',
  'China','Japan','South Korea','UAE','Saudi Arabia','India','Canada','Australia',
  'Belgium','Switzerland','Sweden','Norway','Denmark','Singapore','Malaysia','Other'
]

const PAYMENT_TERMS = ['TT','LC','DP','DA','CAD','Open Account','Escrow']

export default function ExportRFQForm() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    buyerName: user?.name || '',
    buyerEmail: user?.email || '',
    buyerCountry: '',
    buyerCompany: '',
    category: '',
    message: '',
    quantity: '',
    unit: 'kg',
    targetPrice: '',
    currency: 'USD',
    deliveryPort: '',
    deliveryDate: '',
    paymentTerms: 'TT',
  })

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/export/rfq', data),
    onSuccess: (res) => {
      toast.success('Buying request posted! Sellers will respond within 24 hours.')
      navigate(`/export/negotiation/${res.data.data.rfqId}`)
    },
    onError: () => toast.error('Failed to post request. Please try again.'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.buyerName || !form.buyerEmail || !form.buyerCountry || !form.message || !form.quantity) {
      toast.error('Please fill all required fields')
      return
    }
    mutation.mutate({
      ...form,
      quantity: parseFloat(form.quantity),
      targetPrice: form.targetPrice ? parseFloat(form.targetPrice) : undefined,
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link to="/export" className="flex items-center gap-2 text-sm text-gray-500 hover:text-green-primary mb-6">
          <ArrowLeft size={14} /> Back to Export Marketplace
        </Link>

        <div className="bg-white rounded-3xl shadow-card overflow-hidden">
          <div className="bg-gradient-to-r from-green-dark to-green-primary p-8 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <Package size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold">Post a Buying Request</h1>
                <p className="text-white/70 text-sm">Tell sellers what you need — they'll come to you</p>
              </div>
            </div>
            <div className="flex gap-6 mt-4 text-sm text-white/80">
              <span>✅ Free to post</span>
              <span>✅ Multiple quotes</span>
              <span>✅ No commitment</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-5">
            {/* Buyer info */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Globe size={16} className="text-green-primary" /> Your Information
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Full Name *</label>
                  <input value={form.buyerName} onChange={e => setForm(f => ({ ...f, buyerName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" placeholder="Your full name" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Email *</label>
                  <input type="email" value={form.buyerEmail} onChange={e => setForm(f => ({ ...f, buyerEmail: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" placeholder="your@email.com" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Country *</label>
                  <select value={form.buyerCountry} onChange={e => setForm(f => ({ ...f, buyerCountry: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" required>
                    <option value="">Select your country</option>
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Company Name</label>
                  <input value={form.buyerCompany} onChange={e => setForm(f => ({ ...f, buyerCompany: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" placeholder="Your company (optional)" />
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Product info */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Package size={16} className="text-green-primary" /> What Are You Looking For?
              </h3>

              <div className="mb-4">
                <label className="text-xs font-bold text-gray-600 mb-2 block">Product Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button key={cat.value} type="button" onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                        form.category === cat.value
                          ? 'bg-green-primary text-white border-green-primary'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-green-primary'
                      }`}>
                      {cat.emoji} {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1 block">Describe Your Requirements *</label>
                <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary resize-none"
                  placeholder="e.g. I need Grade 1 Ethiopian Yirgacheffe coffee, washed process, with Organic and Fair Trade certifications. Looking for a long-term supplier..." required />
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Quantity + Price */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Quantity & Price</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Quantity *</label>
                  <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" placeholder="e.g. 5000" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Unit</label>
                  <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary">
                    {['kg','ton','MT','lb','bag','container'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Target Price (USD)</label>
                  <input type="number" step="0.01" value={form.targetPrice} onChange={e => setForm(f => ({ ...f, targetPrice: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" placeholder="Per unit" />
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Logistics */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Logistics & Payment</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Delivery Port</label>
                  <input value={form.deliveryPort} onChange={e => setForm(f => ({ ...f, deliveryPort: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" placeholder="e.g. Rotterdam" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Required By</label>
                  <input type="date" value={form.deliveryDate} onChange={e => setForm(f => ({ ...f, deliveryDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Payment Terms</label>
                  <select value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary">
                    {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <button type="submit" disabled={mutation.isPending}
              className="w-full bg-green-primary hover:bg-green-dark text-white font-extrabold py-4 rounded-2xl transition-colors disabled:opacity-60 text-base">
              {mutation.isPending ? 'Posting...' : '🚀 Post Buying Request'}
            </button>
            <p className="text-xs text-gray-400 text-center">
              By posting, you agree to our export terms. Sellers will contact you directly.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
