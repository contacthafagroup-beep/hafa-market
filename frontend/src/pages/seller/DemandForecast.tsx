import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Minus, Package, Zap, AlertTriangle, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ForecastItem {
  productId: string
  productName: string
  currentStock: number
  unit: string
  price: number
  soldLast7: number
  soldLast30: number
  avgDailySales: number
  daysOfStock: number
  forecastedDemand: number
  recommendation: string
  urgency: 'critical' | 'warning' | 'good' | 'overstock'
  aiInsight?: string
}

export default function DemandForecast() {
  const [aiInsights, setAiInsights] = useState<Record<string, string>>({})
  const [loadingInsight, setLoadingInsight] = useState<string | null>(null)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['demand-forecast'],
    queryFn: async () => {
      const res = await api.get('/sellers/me/products?limit=50')
      const products = res.data.data || []

      // Get analytics for sales velocity
      const analyticsRes = await api.get('/sellers/me/analytics').catch(() => ({ data: { data: {} } }))
      const topProducts: any[] = analyticsRes.data.data?.topProducts || []

      return products.map((p: any): ForecastItem => {
        const topData = topProducts.find((t: any) => t.id === p.id)
        const soldLast30 = topData?.soldCount || p.soldCount || 0
        const soldLast7 = Math.floor(soldLast30 * 0.3)
        const avgDailySales = soldLast30 / 30
        const daysOfStock = avgDailySales > 0 ? Math.floor(p.stock / avgDailySales) : 999
        const forecastedDemand = Math.ceil(avgDailySales * 14) // 2-week forecast

        let urgency: ForecastItem['urgency'] = 'good'
        let recommendation = ''

        if (daysOfStock <= 3 && p.stock > 0) {
          urgency = 'critical'
          recommendation = `⚠️ Only ${daysOfStock} days of stock left! Restock immediately with at least ${forecastedDemand} ${p.unit}.`
        } else if (daysOfStock <= 7) {
          urgency = 'warning'
          recommendation = `📦 Stock running low. Order ${forecastedDemand} ${p.unit} within 3 days.`
        } else if (daysOfStock > 60 && p.stock > 20) {
          urgency = 'overstock'
          recommendation = `📉 Overstocked. Consider a 10–15% discount to move inventory faster.`
        } else {
          urgency = 'good'
          recommendation = `✅ Stock levels healthy. Next reorder in ~${Math.min(daysOfStock - 7, 30)} days.`
        }

        return {
          productId: p.id,
          productName: p.name,
          currentStock: p.stock,
          unit: p.unit,
          price: p.price,
          soldLast7,
          soldLast30,
          avgDailySales: parseFloat(avgDailySales.toFixed(1)),
          daysOfStock: Math.min(daysOfStock, 999),
          forecastedDemand,
          recommendation,
          urgency,
        }
      }).sort((a: ForecastItem, b: ForecastItem) => {
        const order = { critical: 0, warning: 1, overstock: 2, good: 3 }
        return order[a.urgency] - order[b.urgency]
      })
    },
    staleTime: 1000 * 60 * 5,
  })

  const getAIInsight = async (product: ForecastItem) => {
    setLoadingInsight(product.productId)
    try {
      const res = await api.post('/ai/chat', {
        message: `You are an agricultural market analyst for Ethiopia. For this product: "${product.productName}" with ${product.currentStock} ${product.unit} in stock, selling ${product.avgDailySales} ${product.unit}/day, give ONE specific actionable insight in 1-2 sentences. Consider Ethiopian seasons, local demand patterns, and market conditions. Be specific and practical.`,
        language: 'en',
        history: [],
      })
      setAiInsights(prev => ({ ...prev, [product.productId]: res.data.data.reply }))
    } catch { toast.error('AI insight failed') }
    finally { setLoadingInsight(null) }
  }

  const urgencyConfig = {
    critical: { color: 'border-red-300 bg-red-50', badge: 'bg-red-100 text-red-700', icon: <AlertTriangle size={16} className="text-red-500" /> },
    warning:  { color: 'border-orange-300 bg-orange-50', badge: 'bg-orange-100 text-orange-700', icon: <AlertTriangle size={16} className="text-orange-500" /> },
    overstock:{ color: 'border-blue-200 bg-blue-50', badge: 'bg-blue-100 text-blue-700', icon: <TrendingDown size={16} className="text-blue-500" /> },
    good:     { color: 'border-gray-100 bg-white', badge: 'bg-green-100 text-green-700', icon: <CheckCircle size={16} className="text-green-primary" /> },
  }

  const critical = products.filter((p: ForecastItem) => p.urgency === 'critical')
  const warning = products.filter((p: ForecastItem) => p.urgency === 'warning')

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <TrendingUp size={20} className="text-green-primary" /> Demand Forecast
        </h2>
        <p className="text-sm text-gray-400">AI-powered inventory predictions based on your sales velocity</p>
      </div>

      {/* Summary alerts */}
      {(critical.length > 0 || warning.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {critical.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-700">{critical.length} Critical — Restock Now</p>
                <p className="text-xs text-red-600 mt-0.5">{critical.map((p: ForecastItem) => p.productName).join(', ')}</p>
              </div>
            </div>
          )}
          {warning.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-orange-700">{warning.length} Low Stock — Order Soon</p>
                <p className="text-xs text-orange-600 mt-0.5">{warning.map((p: ForecastItem) => p.productName).join(', ')}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Forecast cards */}
      {!products.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p>No products to forecast</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p: ForecastItem) => {
            const config = urgencyConfig[p.urgency]
            const stockBarPct = Math.min((p.daysOfStock / 30) * 100, 100)
            const hasInsight = aiInsights[p.productId]

            return (
              <div key={p.productId} className={`rounded-2xl border-2 p-5 ${config.color}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    {config.icon}
                    <div>
                      <p className="font-bold text-gray-900">{p.productName}</p>
                      <p className="text-xs text-gray-500">{formatPrice(p.price)}/{p.unit}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${config.badge}`}>
                    {p.urgency === 'critical' ? '🚨 Critical' :
                     p.urgency === 'warning'  ? '⚠️ Low Stock' :
                     p.urgency === 'overstock'? '📦 Overstock' : '✅ Healthy'}
                  </span>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                  {[
                    { label: 'In Stock', value: `${p.currentStock} ${p.unit}` },
                    { label: 'Daily Sales', value: `${p.avgDailySales} ${p.unit}` },
                    { label: 'Days Left', value: p.daysOfStock >= 999 ? '∞' : `${p.daysOfStock}d` },
                    { label: '2-Week Need', value: `${p.forecastedDemand} ${p.unit}` },
                  ].map(stat => (
                    <div key={stat.label} className="bg-white/60 rounded-xl p-2 text-center">
                      <p className="text-xs text-gray-400">{stat.label}</p>
                      <p className="font-extrabold text-gray-900 text-sm">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Stock level bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Stock runway</span>
                    <span>{p.daysOfStock >= 999 ? 'No sales data' : `${p.daysOfStock} days`}</span>
                  </div>
                  <div className="h-2 bg-white/60 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${stockBarPct}%`,
                        background: p.urgency === 'critical' ? '#ef4444' :
                                    p.urgency === 'warning'  ? '#f59e0b' :
                                    p.urgency === 'overstock'? '#3b82f6' : '#2E7D32',
                      }} />
                  </div>
                </div>

                {/* Recommendation */}
                <p className="text-sm text-gray-700 mb-3">{p.recommendation}</p>

                {/* AI Insight */}
                {hasInsight ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-start gap-2">
                    <span className="text-sm flex-shrink-0">🤖</span>
                    <p className="text-xs text-purple-800">{hasInsight}</p>
                  </div>
                ) : (
                  <button onClick={() => getAIInsight(p)} disabled={loadingInsight === p.productId}
                    className="flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-800 transition-colors disabled:opacity-50">
                    <Zap size={12} /> {loadingInsight === p.productId ? 'Getting AI insight...' : 'Get AI Market Insight'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* How it works */}
      <div className="bg-gray-50 rounded-2xl p-5">
        <h3 className="font-bold text-gray-800 mb-3">📊 How Forecasting Works</h3>
        <div className="grid sm:grid-cols-3 gap-3 text-sm text-gray-600">
          <div className="bg-white rounded-xl p-3">
            <p className="font-bold text-gray-800 mb-1">📈 Sales Velocity</p>
            <p className="text-xs">Based on your last 30 days of actual sales data</p>
          </div>
          <div className="bg-white rounded-xl p-3">
            <p className="font-bold text-gray-800 mb-1">🗓️ 14-Day Forecast</p>
            <p className="text-xs">Predicts demand for the next 2 weeks</p>
          </div>
          <div className="bg-white rounded-xl p-3">
            <p className="font-bold text-gray-800 mb-1">🤖 AI Insights</p>
            <p className="text-xs">Groq AI adds Ethiopian market context</p>
          </div>
        </div>
      </div>
    </div>
  )
}
