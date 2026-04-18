import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CreditCard, CheckCircle, Clock, AlertTriangle, FileText, TrendingUp } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatDate, formatPrice } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

export default function Net30Credit() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [applying, setApplying] = useState(false)
  const [form, setForm] = useState({
    businessName: '', businessType: '', monthlyRevenue: '',
    taxId: '', bankName: '', bankAccount: '', requestedLimit: '',
  })

  // Check existing credit account via bulk orders with INVOICE payment
  const { data: creditData, isLoading } = useQuery({
    queryKey: ['credit-account'],
    queryFn: async () => {
      const res = await api.get('/bulk-orders/my')
      const invoiceOrders = (res.data.data || []).filter((o: any) => o.paymentMethod === 'INVOICE')
      const totalCredit = invoiceOrders.reduce((s: number, o: any) => s + (o.quotedPrice || o.totalEstimate || 0), 0)
      const outstanding = invoiceOrders.filter((o: any) => o.status === 'CONFIRMED' || o.status === 'PROCESSING')
        .reduce((s: number, o: any) => s + (o.quotedPrice || 0), 0)
      return {
        hasAccount: invoiceOrders.length > 0,
        creditLimit: 50000, // ETB 50,000 default
        usedCredit: outstanding,
        availableCredit: Math.max(0, 50000 - outstanding),
        totalOrders: invoiceOrders.length,
        totalSpent: totalCredit,
        invoiceOrders: invoiceOrders.slice(0, 5),
      }
    },
  })

  const applyForCredit = async () => {
    if (!form.businessName || !form.monthlyRevenue) {
      toast.error('Business name and monthly revenue required')
      return
    }
    setApplying(true)
    try {
      await api.post('/bulk-orders', {
        orgName: form.businessName,
        orgType: form.businessType || 'OTHER',
        city: 'Hossana',
        contactName: user?.name || '',
        phone: user?.phone || '',
        email: user?.email || '',
        items: [{ product: 'Net-30 Credit Application', quantity: 1, unit: 'application' }],
        notes: `NET-30 CREDIT APPLICATION\nBusiness: ${form.businessName}\nType: ${form.businessType}\nMonthly Revenue: ETB ${form.monthlyRevenue}\nTax ID: ${form.taxId}\nBank: ${form.bankName} - ${form.bankAccount}\nRequested Limit: ETB ${form.requestedLimit}`,
        paymentMethod: 'INVOICE',
        isRecurring: false,
        language: 'en',
        userId: user?.id,
      })
      qc.invalidateQueries({ queryKey: ['credit-account'] })
      toast.success('Credit application submitted! We\'ll review within 2 business days.')
      setForm({ businessName: '', businessType: '', monthlyRevenue: '', taxId: '', bankName: '', bankAccount: '', requestedLimit: '' })
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Application failed')
    } finally { setApplying(false) }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  const creditPct = creditData ? Math.round((creditData.usedCredit / creditData.creditLimit) * 100) : 0

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
          <CreditCard size={22} className="text-green-primary" /> Net-30 Credit Terms
        </h1>
        <p className="text-gray-400 text-sm mt-1">Buy now, pay within 30 days — for verified businesses</p>
      </div>

      {creditData?.hasAccount ? (
        <>
          {/* Credit dashboard */}
          <div className="bg-gradient-to-br from-green-dark to-green-primary rounded-2xl p-6 text-white mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/70 text-sm">Credit Account</p>
                <p className="text-2xl font-extrabold">{user?.name}</p>
              </div>
              <div className="bg-white/20 rounded-xl px-3 py-1.5">
                <p className="text-xs font-bold">Net-30 Terms</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-white/15 rounded-xl p-3 text-center">
                <p className="text-xs text-white/60">Credit Limit</p>
                <p className="font-extrabold text-lg">{formatPrice(creditData.creditLimit)}</p>
              </div>
              <div className="bg-white/15 rounded-xl p-3 text-center">
                <p className="text-xs text-white/60">Used</p>
                <p className="font-extrabold text-lg text-orange-300">{formatPrice(creditData.usedCredit)}</p>
              </div>
              <div className="bg-white/15 rounded-xl p-3 text-center">
                <p className="text-xs text-white/60">Available</p>
                <p className="font-extrabold text-lg text-green-300">{formatPrice(creditData.availableCredit)}</p>
              </div>
            </div>
            {/* Credit utilization bar */}
            <div>
              <div className="flex justify-between text-xs text-white/60 mb-1">
                <span>Credit Utilization</span>
                <span>{creditPct}%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${creditPct}%`, background: creditPct > 80 ? '#ef4444' : creditPct > 60 ? '#f59e0b' : '#69f0ae' }} />
              </div>
            </div>
          </div>

          {/* Outstanding invoices */}
          {creditData.invoiceOrders.length > 0 && (
            <div className="bg-white rounded-2xl shadow-card p-5 mb-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText size={16} className="text-green-primary" /> Outstanding Invoices
              </h3>
              <div className="space-y-3">
                {creditData.invoiceOrders.map((order: any) => {
                  const dueDate = new Date(order.createdAt)
                  dueDate.setDate(dueDate.getDate() + 30)
                  const isOverdue = dueDate < new Date()
                  const amount = order.quotedPrice || order.totalEstimate || 0
                  return (
                    <div key={order.id} className={`flex items-center gap-3 p-3 rounded-xl ${isOverdue ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-gray-800">#{order.id.slice(-8).toUpperCase()}</p>
                        <p className="text-xs text-gray-400">
                          Due: {formatDate(dueDate.toISOString())}
                          {isOverdue && <span className="text-red-600 font-bold ml-1">OVERDUE</span>}
                        </p>
                      </div>
                      {amount > 0 && <span className="font-bold text-gray-900">{formatPrice(amount)}</span>}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        order.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                        isOverdue ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.status === 'DELIVERED' ? 'Paid' : isOverdue ? 'Overdue' : 'Pending'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl shadow-card p-4 text-center">
              <p className="text-2xl font-extrabold text-green-primary">{creditData.totalOrders}</p>
              <p className="text-xs text-gray-400 mt-1">Total Credit Orders</p>
            </div>
            <div className="bg-white rounded-2xl shadow-card p-4 text-center">
              <p className="text-2xl font-extrabold text-blue-600">{formatPrice(creditData.totalSpent)}</p>
              <p className="text-xs text-gray-400 mt-1">Total Purchased on Credit</p>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Benefits */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {[
              { icon: '📅', title: '30-Day Terms', desc: 'Order today, pay within 30 days' },
              { icon: '💰', title: 'Up to ETB 50,000', desc: 'Credit limit based on your business' },
              { icon: '📊', title: 'Build Credit', desc: 'Good payment history increases your limit' },
            ].map(b => (
              <div key={b.title} className="bg-white rounded-2xl shadow-card p-4 text-center">
                <div className="text-3xl mb-2">{b.icon}</div>
                <p className="font-bold text-gray-800 text-sm">{b.title}</p>
                <p className="text-xs text-gray-400 mt-1">{b.desc}</p>
              </div>
            ))}
          </div>

          {/* Application form */}
          <div className="bg-white rounded-2xl shadow-card p-6">
            <h3 className="font-extrabold text-gray-900 mb-5">📋 Apply for Net-30 Credit</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Business Name *" placeholder="Your company name"
                value={form.businessName} onChange={(e: any) => setForm(f => ({ ...f, businessName: e.target.value }))} />
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Business Type</label>
                <select value={form.businessType} onChange={e => setForm(f => ({ ...f, businessType: e.target.value }))}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
                  <option value="">Select type</option>
                  {['RESTAURANT', 'HOTEL', 'CAFE', 'SCHOOL', 'HOSPITAL', 'RETAILER', 'WHOLESALER', 'OTHER'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <Input label="Monthly Revenue (ETB) *" type="number" placeholder="e.g. 100000"
                value={form.monthlyRevenue} onChange={(e: any) => setForm(f => ({ ...f, monthlyRevenue: e.target.value }))} />
              <Input label="Requested Credit Limit (ETB)" type="number" placeholder="e.g. 30000"
                value={form.requestedLimit} onChange={(e: any) => setForm(f => ({ ...f, requestedLimit: e.target.value }))} />
              <Input label="Tax ID (TIN)" placeholder="Your tax identification number"
                value={form.taxId} onChange={(e: any) => setForm(f => ({ ...f, taxId: e.target.value }))} />
              <Input label="Bank Name" placeholder="e.g. Commercial Bank of Ethiopia"
                value={form.bankName} onChange={(e: any) => setForm(f => ({ ...f, bankName: e.target.value }))} />
              <Input label="Bank Account Number" placeholder="Your account number"
                value={form.bankAccount} onChange={(e: any) => setForm(f => ({ ...f, bankAccount: e.target.value }))} />
            </div>
            <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-5">
              ⏱ Applications are reviewed within 2 business days. We may contact you for additional documents.
            </div>
            <Button fullWidth size="lg" loading={applying}
              disabled={!form.businessName || !form.monthlyRevenue}
              onClick={applyForCredit}>
              <CreditCard size={18} /> Submit Credit Application
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
