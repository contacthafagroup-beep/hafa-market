import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Clock, CheckCircle, AlertTriangle, FileText, TrendingUp } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { formatDate, formatPrice } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

export default function CreditTerms() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [applying, setApplying] = useState(false)
  const [selectedTerm, setSelectedTerm] = useState<'NET_15' | 'NET_30' | 'NET_60'>('NET_30')

  // Fetch user's order history to determine credit eligibility
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['credit-orders'],
    queryFn: () => api.get('/orders', { params: { limit: 50, status: 'DELIVERED' } })
      .then(r => r.data.data || []),
  })

  // Credit eligibility calculation
  const totalSpent = orders.reduce((s: number, o: any) => s + o.total, 0)
  const orderCount = orders.length
  const avgOrderValue = orderCount > 0 ? totalSpent / orderCount : 0
  const accountAgeDays = user?.createdAt
    ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000)
    : 0

  const isEligible = orderCount >= 5 && totalSpent >= 5000 && accountAgeDays >= 30
  const creditLimit = isEligible ? Math.min(avgOrderValue * 3, 50000) : 0

  // Outstanding credit (simulated from bulk orders with INVOICE payment)
  const { data: creditOrders = [] } = useQuery({
    queryKey: ['credit-outstanding'],
    queryFn: () => api.get('/bulk-orders/my').then(r =>
      (r.data.data || []).filter((o: any) => o.paymentMethod === 'NET_30' || o.paymentMethod === 'NET_15' || o.paymentMethod === 'NET_60')
    ),
  })

  const outstanding = creditOrders
    .filter((o: any) => o.status !== 'DELIVERED' && o.paymentStatus !== 'PAID')
    .reduce((s: number, o: any) => s + (o.quotedPrice || o.totalEstimate || 0), 0)

  const applyForCredit = async () => {
    setApplying(true)
    try {
      await api.post('/bulk-orders', {
        orgName: user?.name || 'Credit Application',
        orgType: 'CREDIT_APPLICATION',
        city: 'Hossana',
        contactName: user?.name,
        phone: user?.phone,
        email: user?.email,
        items: [{ product: 'Credit Terms Application', quantity: '1', unit: 'application' }],
        notes: `Applying for ${selectedTerm} credit terms. Requested limit: ETB ${creditLimit.toFixed(0)}`,
        paymentMethod: selectedTerm,
        language: 'en',
        userId: user?.id,
      })
      toast.success('Credit application submitted! We\'ll review within 2 business days.')
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Application failed')
    } finally { setApplying(false) }
  }

  const TERMS = [
    { value: 'NET_15', label: 'Net 15', desc: 'Pay within 15 days of delivery', discount: '1%', icon: '⚡' },
    { value: 'NET_30', label: 'Net 30', desc: 'Pay within 30 days of delivery', discount: '0%', icon: '📅' },
    { value: 'NET_60', label: 'Net 60', desc: 'Pay within 60 days of delivery', discount: null, icon: '🗓️' },
  ]

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <CreditCard size={22} className="text-blue-600" /> Net Credit Terms
        </h1>
        <p className="text-gray-400 text-sm">Buy now, pay later with formal credit terms for your business</p>
      </div>

      {/* Eligibility card */}
      <div className={`rounded-2xl p-6 mb-6 ${isEligible ? 'bg-gradient-to-br from-green-dark to-green-primary text-white' : 'bg-gray-50 border-2 border-gray-200'}`}>
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${isEligible ? 'bg-white/20' : 'bg-gray-200'}`}>
            {isEligible ? <CheckCircle size={24} className="text-white" /> : <Clock size={24} className="text-gray-400" />}
          </div>
          <div className="flex-1">
            <p className={`font-extrabold text-lg ${isEligible ? 'text-white' : 'text-gray-700'}`}>
              {isEligible ? '✅ You Qualify for Credit Terms!' : '⏳ Not Yet Eligible'}
            </p>
            <p className={`text-sm mt-1 ${isEligible ? 'text-white/80' : 'text-gray-500'}`}>
              {isEligible
                ? `Credit limit up to ${formatPrice(creditLimit)} based on your purchase history`
                : 'Complete 5+ orders totaling ETB 5,000+ to qualify'
              }
            </p>
          </div>
        </div>

        {/* Progress to eligibility */}
        {!isEligible && (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: 'Orders', current: orderCount, required: 5, unit: '' },
              { label: 'Total Spent', current: totalSpent, required: 5000, unit: 'ETB' },
              { label: 'Account Age', current: accountAgeDays, required: 30, unit: 'days' },
            ].map(req => {
              const pct = Math.min((req.current / req.required) * 100, 100)
              const done = req.current >= req.required
              return (
                <div key={req.label} className="bg-white rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-gray-600">{req.label}</p>
                    {done && <CheckCircle size={12} className="text-green-primary" />}
                  </div>
                  <p className="text-sm font-extrabold text-gray-900">
                    {req.unit === 'ETB' ? formatPrice(req.current) : `${req.current}${req.unit ? ' ' + req.unit : ''}`}
                  </p>
                  <div className="h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                    <div className="h-full rounded-full bg-green-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Need: {req.unit === 'ETB' ? formatPrice(req.required) : `${req.required}${req.unit ? ' ' + req.unit : ''}`}
                  </p>
                </div>
              )
            })}
          </div>
        )}

        {isEligible && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Credit Limit', value: formatPrice(creditLimit) },
              { label: 'Outstanding', value: formatPrice(outstanding) },
              { label: 'Available', value: formatPrice(Math.max(creditLimit - outstanding, 0)) },
            ].map(s => (
              <div key={s.label} className="bg-white/15 rounded-xl p-3 text-center">
                <p className="text-xs text-white/70">{s.label}</p>
                <p className="font-extrabold text-white">{s.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Credit terms options */}
      {isEligible && (
        <div className="bg-white rounded-2xl shadow-card p-6 mb-6">
          <h3 className="font-extrabold text-gray-900 mb-4">Select Credit Terms</h3>
          <div className="grid sm:grid-cols-3 gap-4 mb-5">
            {TERMS.map(term => (
              <label key={term.value}
                className={`flex flex-col p-4 border-2 rounded-2xl cursor-pointer transition-all ${selectedTerm === term.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                <input type="radio" value={term.value} checked={selectedTerm === term.value}
                  onChange={() => setSelectedTerm(term.value as any)} className="hidden" />
                <span className="text-2xl mb-2">{term.icon}</span>
                <p className="font-extrabold text-gray-900">{term.label}</p>
                <p className="text-xs text-gray-500 mt-1">{term.desc}</p>
                {term.discount && (
                  <span className="mt-2 text-xs font-bold text-green-primary bg-green-50 px-2 py-0.5 rounded-full self-start">
                    {term.discount} early payment discount
                  </span>
                )}
              </label>
            ))}
          </div>
          <Button fullWidth size="lg" loading={applying} onClick={applyForCredit}>
            <CreditCard size={18} /> Apply for {selectedTerm.replace('_', ' ')} Credit Terms
          </Button>
        </div>
      )}

      {/* Outstanding invoices */}
      {creditOrders.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="font-extrabold text-gray-900 mb-4 flex items-center gap-2">
            <FileText size={18} className="text-blue-600" /> Outstanding Invoices
          </h3>
          <div className="space-y-3">
            {creditOrders.map((order: any) => {
              const dueDate = order.deliveryDate
                ? new Date(new Date(order.deliveryDate).getTime() + 30 * 86400000)
                : null
              const isOverdue = dueDate && dueDate < new Date()
              return (
                <div key={order.id} className={`flex items-center gap-3 p-3 rounded-xl ${isOverdue ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-800">
                      {order.orgName} — {(order.items as any[])?.[0]?.product}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(order.createdAt)}
                      {dueDate && ` · Due: ${formatDate(dueDate.toISOString())}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">{formatPrice(order.quotedPrice || order.totalEstimate || 0)}</p>
                    {isOverdue && <p className="text-xs text-red-600 font-bold">OVERDUE</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Benefits */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <h3 className="font-bold text-blue-800 mb-3">💼 Benefits of Credit Terms</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm text-blue-700">
          {[
            '📦 Order now, pay after you sell',
            '💰 Improve cash flow for your business',
            '🔄 Recurring orders without upfront payment',
            '📊 Build credit history with Hafa Market',
            '⚡ 1% discount for early payment (Net 15)',
            '🤝 Dedicated account manager for Net 60',
          ].map(b => (
            <div key={b} className="flex items-start gap-2">
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
