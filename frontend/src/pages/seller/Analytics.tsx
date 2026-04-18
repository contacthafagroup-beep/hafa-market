import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { TrendingUp, ShoppingBag, Star, Users, ArrowUp, ArrowDown, CreditCard, Save, MessageSquare, Send } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatPrice, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

// ─── Seller Review Responses ──────────────────────────────────────────────────
function SellerReviewResponses() {
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: storeInfo } = useQuery({
    queryKey: ['my-store-id'],
    queryFn: () => api.get('/sellers/me/store').then(r => r.data.data),
  })

  const { data: reviews, refetch } = useQuery({
    queryKey: ['seller-reviews-manage', storeInfo?.id],
    queryFn: () => api.get(`/reviews/seller/${storeInfo!.id}?limit=10`).then(r => r.data.data),
    enabled: !!storeInfo?.id,
  })

  const { mutate: respond, isPending: respondingId } = useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) =>
      api.post(`/reviews/${id}/seller-response`, { response }),
    onSuccess: (_, vars) => {
      toast.success('Response posted!')
      setReplyText(prev => ({ ...prev, [vars.id]: '' }))
      setExpanded(null)
      refetch()
    },
    onError: () => toast.error('Failed to post response'),
  })

  if (!reviews?.length) return null

  const unanswered = reviews.filter((r: any) => !r.sellerResponse)

  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-extrabold text-gray-900 flex items-center gap-2">
          <MessageSquare size={18} className="text-green-primary" /> Customer Reviews
        </h3>
        {unanswered.length > 0 && (
          <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-1 rounded-full">
            {unanswered.length} need response
          </span>
        )}
      </div>
      <div className="space-y-3">
        {reviews.slice(0, 5).map((r: any) => (
          <div key={r.id} className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 text-green-primary font-bold text-sm flex items-center justify-center flex-shrink-0">
                {r.user?.name?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-gray-800">{r.user?.name}</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={11} className={s <= r.rating ? 'fill-orange-400 text-orange-400' : 'text-gray-200'} />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400 ml-auto">{formatDate(r.createdAt)}</span>
                </div>
                {r.product && <p className="text-xs text-gray-400 mt-0.5">on {r.product.name}</p>}
                {r.comment && <p className="text-sm text-gray-700 mt-1">{r.comment}</p>}

                {r.sellerResponse ? (
                  <div className="mt-2 bg-green-50 border border-green-100 rounded-lg p-2">
                    <p className="text-xs font-bold text-green-primary mb-0.5">Your response:</p>
                    <p className="text-xs text-gray-600">{r.sellerResponse}</p>
                  </div>
                ) : (
                  <div className="mt-2">
                    {expanded === r.id ? (
                      <div className="flex gap-2">
                        <input
                          value={replyText[r.id] || ''}
                          onChange={e => setReplyText(prev => ({ ...prev, [r.id]: e.target.value }))}
                          placeholder="Write a response..."
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-green-primary"
                        />
                        <button
                          onClick={() => respond({ id: r.id, response: replyText[r.id] || '' })}
                          disabled={!replyText[r.id]?.trim()}
                          className="p-1.5 bg-green-primary text-white rounded-lg disabled:opacity-40 hover:bg-green-dark transition-colors"
                        >
                          <Send size={13} />
                        </button>
                        <button onClick={() => setExpanded(null)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setExpanded(r.id)}
                        className="text-xs text-green-primary font-semibold hover:underline flex items-center gap-1"
                      >
                        <MessageSquare size={11} /> Reply to this review
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Simple bar chart ─────────────────────────────────────────────────────────
function BarChart({ data, valueKey, labelKey, color = '#2E7D32' }: {
  data: any[]; valueKey: string; labelKey: string; color?: string
}) {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1)
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px', padding: '0 4px' }}>
      {data.map((d, i) => {
        const h = ((d[valueKey] || 0) / max) * 100
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', position: 'relative' }}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            {hovered === i && (
              <div style={{
                position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                background: '#1f2937', color: '#fff', fontSize: '.7rem', fontWeight: 700,
                padding: '3px 8px', borderRadius: '6px', whiteSpace: 'nowrap', zIndex: 10, marginBottom: '4px',
              }}>
                {typeof d[valueKey] === 'number' && d[valueKey] > 100 ? formatPrice(d[valueKey]) : d[valueKey]}
              </div>
            )}
            <div style={{
              width: '100%', background: hovered === i ? color : color + 'cc',
              borderRadius: '4px 4px 0 0', height: `${Math.max(h, 3)}%`,
              transition: 'all .2s ease', cursor: 'pointer',
            }} />
            <span style={{ fontSize: '.6rem', color: '#9ca3af', textAlign: 'center', lineHeight: 1 }}>
              {d[labelKey]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Payout Settings ─────────────────────────────────────────────────────────
function PayoutSettings({ store }: { store: any }) {
  const [form, setForm] = useState({
    bankName:       store?.bankName       || '',
    bankAccount:    store?.bankAccount    || '',
    mpesaNumber:    store?.mpesaNumber    || '',
    telebirrNumber: store?.telebirrNumber || '',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const { mutate: save, isPending: isLoading } = useMutation({
    mutationFn: () => api.patch('/sellers/me/payout-settings', form),
    onSuccess: () => toast.success('Payout settings saved!'),
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to save'),
  })

  return (
    <div className="bg-white rounded-2xl shadow-card p-6">
      <h3 className="font-extrabold text-gray-900 mb-1 flex items-center gap-2">
        <CreditCard size={18} className="text-green-primary" /> Payout Settings
      </h3>
      <p className="text-xs text-gray-400 mb-5">Where we send your earnings. Payouts are processed weekly.</p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">🏦 Bank Transfer</p>
          <div className="space-y-3">
            <Input label="Bank Name" placeholder="e.g. Commercial Bank of Ethiopia"
              value={form.bankName} onChange={(e: any) => set('bankName', e.target.value)} />
            <Input label="Account Number" placeholder="Your bank account number"
              value={form.bankAccount} onChange={(e: any) => set('bankAccount', e.target.value)} />
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">📱 Mobile Money</p>
          <div className="space-y-3">
            <Input label="Telebirr Number" placeholder="+251 9XX XXX XXX"
              value={form.telebirrNumber} onChange={(e: any) => set('telebirrNumber', e.target.value)} />
            <Input label="M-Pesa Number" placeholder="+254 7XX XXX XXX"
              value={form.mpesaNumber} onChange={(e: any) => set('mpesaNumber', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={() => save()} loading={isLoading}>
          <Save size={15} /> Save Payout Settings
        </Button>
        <p className="text-xs text-gray-400">Changes take effect on next payout cycle</p>
      </div>
    </div>
  )
}

// ─── Competitor Intelligence ──────────────────────────────────────────────────
function CompetitorIntelligence({ topProducts }: { topProducts: any[] }) {
  // Backend endpoint is per-product: GET /features/seller-intelligence/:productId
  // We fetch for the top 3 products in parallel
  const productIds = topProducts.slice(0, 3).map((p: any) => p.id)

  const { data: intel, isLoading } = useQuery({
    queryKey: ['competitor-intel', productIds.join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        productIds.map((id: string) =>
          api.get(`/features/seller-intelligence/${id}`).then(r => ({
            productId: id,
            productName: topProducts.find((p: any) => p.id === id)?.name || id,
            yourPrice: r.data.data.yourPrice,
            avgMarketPrice: r.data.data.avgCompetitorPrice,
            lowestPrice: r.data.data.competitors?.[0]?.price || r.data.data.yourPrice,
            suggestion: r.data.data.suggestion,
            priceRank: r.data.data.priceRank,
          })).catch(() => null)
        )
      )
      return results.filter(Boolean)
    },
    enabled: productIds.length > 0,
    staleTime: 1000 * 60 * 10,
  })

  if (isLoading || !intel?.length) return null

  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <h3 className="font-extrabold text-gray-900 mb-1 flex items-center gap-2">
        🔍 Market Intelligence
      </h3>
      <p className="text-xs text-gray-400 mb-4">How your top products compare to market prices</p>
      <div className="space-y-3">
        {intel.map((item: any) => (
          <div key={item.productId} className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-sm text-gray-800">{item.productName}</p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                item.yourPrice <= item.avgMarketPrice ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
              }`}>
                {item.yourPrice <= item.avgMarketPrice ? '✅ Competitive' : '⚠️ Above Market'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-gray-400">Your Price</p>
                <p className="font-extrabold text-gray-900">ETB {item.yourPrice}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Market Avg</p>
                <p className="font-extrabold text-blue-600">ETB {item.avgMarketPrice}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Lowest</p>
                <p className="font-extrabold text-green-primary">ETB {item.lowestPrice}</p>
              </div>
            </div>
            {item.suggestion && (
              <p className="text-xs text-orange-600 mt-2 font-semibold">💡 {item.suggestion}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function SellerAnalytics() {
  const [exporting, setExporting] = useState(false)

  const exportCSV = async () => {
    setExporting(true)
    try {
      const res = await api.get('/sellers/me/orders?limit=500')
      const orders = res.data.data || []
      const rows = [
        ['Order ID', 'Date', 'Status', 'Total (ETB)', 'Items', 'Payment Method'],
        ...orders.map((o: any) => [
          o.id.slice(-8).toUpperCase(),
          new Date(o.createdAt).toLocaleDateString(),
          o.status,
          o.total.toFixed(2),
          o.items?.length || 0,
          o.payment?.method?.replace(/_/g, ' ') || '—',
        ])
      ]
      const csv = rows.map(r => r.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `hafa-orders-${new Date().toISOString().split('T')[0]}.csv`
      a.click(); URL.revokeObjectURL(url)
      toast.success('CSV exported!')
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['seller-analytics-full'],
    queryFn: () => api.get('/sellers/me/analytics').then(r => r.data.data),
  })

  const { data: storeData } = useQuery({
    queryKey: ['my-store'],
    queryFn: () => api.get('/sellers/me/store').then(r => r.data.data).catch(() => null),
  })

  const { data: revenueChart = [] } = useQuery({
    queryKey: ['seller-revenue-chart'],
    queryFn: () => api.get('/sellers/me/revenue-chart').then(r => r.data.data),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  const overview    = data?.overview    || {}
  const today       = data?.today       || {}
  const monthly     = data?.thisMonth   || {}
  const topProducts = data?.topProducts || []
  const recentOrders = data?.recentOrders || []

  // Use real monthly revenue from dedicated endpoint
  const monthlyChart = revenueChart.length > 0 ? revenueChart : (() => {
    const result = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      result.push({ label: d.toLocaleDateString('en', { month: 'short' }), revenue: 0, orders: 0 })
    }
    return result
  })()

  const stats = [
    { label: 'Total Revenue',   value: formatPrice(overview.totalRevenue || 0),  icon: <TrendingUp size={20}/>,  color: 'bg-green-50 text-green-primary',  change: overview.revenueGrowth },
    { label: 'Total Sales',     value: overview.totalSales || 0,                  icon: <ShoppingBag size={20}/>, color: 'bg-blue-50 text-blue-600',        change: null },
    { label: 'This Month',      value: formatPrice(monthly.revenue || 0),         icon: <TrendingUp size={20}/>,  color: 'bg-orange-50 text-orange-600',    change: null },
    { label: 'Today Revenue',   value: formatPrice(today.revenue || 0),           icon: <TrendingUp size={20}/>,  color: 'bg-teal-50 text-teal-600',        change: null },
    { label: 'Avg Rating',      value: `${(overview.rating || 0).toFixed(1)} ★`,  icon: <Star size={20}/>,        color: 'bg-yellow-50 text-yellow-600',    change: null },
    { label: 'Pending Payout',  value: formatPrice(overview.pendingPayout || 0),  icon: <CreditCard size={20}/>,  color: 'bg-purple-50 text-purple-600',    change: null },
  ]

  const insights = data?.insights || {}

  return (
    <div className="space-y-6">
      {/* Export button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-gray-900">Analytics</h2>
        <button onClick={exportCSV} disabled={exporting}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-green-primary hover:text-green-primary transition-all disabled:opacity-50">
          📥 {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>{s.icon}</div>
            <div className="text-xl font-extrabold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              {s.label}
              {s.change != null && (
                <span className={`flex items-center gap-0.5 font-bold ${Number(s.change) >= 0 ? 'text-green-primary' : 'text-red-500'}`}>
                  {Number(s.change) >= 0 ? <ArrowUp size={9}/> : <ArrowDown size={9}/>}
                  {Math.abs(Number(s.change))}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-gray-900">Revenue Trend</h3>
          <span className="text-xs text-gray-400">Last 6 months (actual data)</span>
        </div>
        <BarChart data={monthlyChart} valueKey="revenue" labelKey="label" color="#2E7D32" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top products */}
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="font-extrabold text-gray-900 mb-4">🏆 Top Products</h3>
          {!topProducts.length ? (
            <p className="text-sm text-gray-400 text-center py-6">No sales data yet</p>
          ) : (
            <div className="space-y-3">
              {topProducts.slice(0, 5).map((p: any, i: number) => {
                const maxSold = Math.max(...topProducts.map((x: any) => x.soldCount || 0), 1)
                return (
                  <div key={p.id}>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-black text-gray-300 w-5">{i + 1}</span>
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover rounded-lg" alt="" /> : '🛒'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                      </div>
                      <span className="text-xs font-bold text-gray-500 flex-shrink-0">{p.soldCount} sold</span>
                    </div>
                    <div className="ml-8 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-primary rounded-full transition-all"
                        style={{ width: `${(p.soldCount / maxSold) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Today's orders */}
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="font-extrabold text-gray-900 mb-4">📦 Recent Orders</h3>
          {!recentOrders.length ? (
            <p className="text-sm text-gray-400 text-center py-6">No orders yet</p>
          ) : recentOrders.slice(0, 6).map((o: any) => (
            <div key={o.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800">#{o.id.slice(-8).toUpperCase()}</p>
                <p className="text-xs text-gray-400">{new Date(o.createdAt).toLocaleDateString()}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                o.status === 'DELIVERED' ? 'bg-green-100 text-green-primary' :
                o.status === 'PENDING'   ? 'bg-yellow-100 text-yellow-700' :
                'bg-blue-100 text-blue-600'
              }`}>{o.status.replace(/_/g,' ')}</span>
              <span className="font-bold text-sm flex-shrink-0">{formatPrice(o.total)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Insights */}
      {Object.keys(insights).length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="font-extrabold text-gray-900 mb-4">📊 Performance Insights</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: 'Conversion Rate',  value: `${insights.conversionRate}%`,  sub: 'Views → Orders', color: 'text-green-primary' },
              { label: 'Avg Order Value',  value: `ETB ${insights.avgOrderValue}`, sub: 'This month',    color: 'text-blue-600' },
              { label: 'Unique Customers', value: insights.uniqueCustomers || 0,   sub: 'This month',    color: 'text-purple-600' },
              { label: 'Repeat Customers', value: `${insights.repeatRate}%`,       sub: 'Loyalty rate',  color: 'text-orange-600' },
              { label: 'Product Views',    value: insights.productViews || 0,      sub: 'This month',    color: 'text-teal-600' },
              { label: 'Revenue Growth',   value: `${overview.revenueGrowth || 0}%`, sub: 'vs last month', color: (overview.revenueGrowth || 0) >= 0 ? 'text-green-primary' : 'text-red-500' },
            ].map(ins => (
              <div key={ins.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className={`text-xl font-extrabold ${ins.color}`}>{ins.value}</p>
                <p className="text-xs font-semibold text-gray-700 mt-0.5">{ins.label}</p>
                <p className="text-[10px] text-gray-400">{ins.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Responses */}
      <SellerReviewResponses />

      {/* Feature 12: Competitor Intelligence */}
      {topProducts.length > 0 && (
        <CompetitorIntelligence topProducts={topProducts} />
      )}

      {/* Payout settings — single instance */}
      <PayoutSettings store={storeData} />
    </div>
  )
}
