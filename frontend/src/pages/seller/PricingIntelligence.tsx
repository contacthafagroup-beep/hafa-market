/**
 * Seller Pricing Intelligence
 * /dashboard/pricing
 *
 * Shows competitor price comparison + dynamic pricing suggestions
 * for all seller products. Backend endpoints already exist:
 *   GET /features/seller-intelligence/:productId
 *   GET /features/pricing-suggestion/:productId
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Minus, RefreshCw, DollarSign, AlertTriangle, CheckCircle, Zap } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

type PriceStatus = 'above' | 'competitive' | 'below'

function getPriceStatus(yours: number, avg: number): PriceStatus {
  if (yours > avg * 1.1) return 'above'
  if (yours < avg * 0.9) return 'below'
  return 'competitive'
}

const STATUS_CONFIG = {
  above:       { label: 'Above Market',  color: 'bg-red-100 text-red-700',    icon: <TrendingUp size={12} />,   tip: 'Consider lowering to stay competitive' },
  competitive: { label: 'Competitive',   color: 'bg-green-100 text-green-700', icon: <CheckCircle size={12} />, tip: 'Your price is well-positioned' },
  below:       { label: 'Price Leader',  color: 'bg-blue-100 text-blue-700',   icon: <TrendingDown size={12} />, tip: 'You have a price advantage — slight increase possible' },
}

export default function PricingIntelligence() {
  const qc = useQueryClient()
  const [applying, setApplying] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Fetch seller's products
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['seller-products-pricing'],
    queryFn: () => api.get('/sellers/me/products?limit=50').then(r => r.data.data || []),
  })

  // Fetch intelligence for all products in parallel (max 10 to avoid rate limits)
  const productIds: string[] = products.slice(0, 10).map((p: any) => p.id)

  const { data: intelMap = {}, isLoading: loadingIntel, refetch } = useQuery({
    queryKey: ['pricing-intel-all', productIds.join(',')],
    queryFn: async () => {
      const results = await Promise.allSettled(
        productIds.map((id: string) =>
          Promise.all([
            api.get(`/features/seller-intelligence/${id}`).then(r => r.data.data),
            api.get(`/features/pricing-suggestion/${id}`).then(r => r.data.data),
          ]).then(([intel, suggestion]) => ({ id, intel, suggestion }))
        )
      )
      const map: Record<string, any> = {}
      results.forEach(r => {
        if (r.status === 'fulfilled') map[r.value.id] = r.value
      })
      return map
    },
    enabled: productIds.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  const applyPrice = async (productId: string, newPrice: number) => {
    setApplying(productId)
    try {
      await api.patch(`/sellers/me/products/${productId}`, { price: newPrice })
      qc.invalidateQueries({ queryKey: ['seller-products-pricing'] })
      qc.invalidateQueries({ queryKey: ['pricing-intel-all'] })
      toast.success(`Price updated to ${formatPrice(newPrice)} ✅`)
    } catch {
      toast.error('Failed to update price')
    } finally {
      setApplying(null)
    }
  }

  if (loadingProducts) return <div className="flex justify-center py-20"><Spinner /></div>

  const enriched = products.slice(0, 10).map((p: any) => ({
    ...p,
    intel: intelMap[p.id]?.intel,
    suggestion: intelMap[p.id]?.suggestion,
  }))

  // Summary stats
  const withIntel = enriched.filter((p: any) => p.intel)
  const aboveMarket = withIntel.filter((p: any) => getPriceStatus(p.price, p.intel?.avgCompetitorPrice) === 'above').length
  const competitive = withIntel.filter((p: any) => getPriceStatus(p.price, p.intel?.avgCompetitorPrice) === 'competitive').length
  const priceLeader = withIntel.filter((p: any) => getPriceStatus(p.price, p.intel?.avgCompetitorPrice) === 'below').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Pricing Intelligence</h2>
          <p className="text-sm text-gray-400">Real-time market comparison + AI pricing suggestions</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-green-primary hover:text-green-primary transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-red-600">{aboveMarket}</div>
          <div className="text-xs text-red-500 font-semibold mt-1">⚠️ Above Market</div>
          <div className="text-[10px] text-red-400 mt-0.5">May lose sales</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-green-600">{competitive}</div>
          <div className="text-xs text-green-500 font-semibold mt-1">✅ Competitive</div>
          <div className="text-[10px] text-green-400 mt-0.5">Well positioned</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-blue-600">{priceLeader}</div>
          <div className="text-xs text-blue-500 font-semibold mt-1">🏆 Price Leader</div>
          <div className="text-[10px] text-blue-400 mt-0.5">Lowest in category</div>
        </div>
      </div>

      {/* Product list */}
      {loadingIntel ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {enriched.map((p: any) => {
            const status = p.intel ? getPriceStatus(p.price, p.intel.avgCompetitorPrice) : null
            const cfg = status ? STATUS_CONFIG[status] : null
            const isExpanded = expanded === p.id
            const hasSuggestion = p.suggestion && Math.abs(p.suggestion.suggestedPrice - p.price) > 0.5

            return (
              <div key={p.id} className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
                {/* Main row */}
                <div className="p-4 flex items-center gap-4 cursor-pointer" onClick={() => setExpanded(isExpanded ? null : p.id)}>
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-xl bg-gray-50 flex-shrink-0 overflow-hidden">
                    {p.images?.[0]
                      ? <img src={p.images[0]} className="w-full h-full object-cover" alt="" />
                      : <span className="flex items-center justify-center h-full text-xl">🛒</span>
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.category?.name} · {p.stock} {p.unit} in stock</p>
                  </div>

                  {/* Your price */}
                  <div className="text-right flex-shrink-0">
                    <p className="font-extrabold text-green-primary">{formatPrice(p.price)}</p>
                    <p className="text-[10px] text-gray-400">/{p.unit}</p>
                  </div>

                  {/* Status badge */}
                  {cfg && (
                    <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${cfg.color}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  )}

                  {/* AI suggestion indicator */}
                  {hasSuggestion && (
                    <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full bg-purple-100 text-purple-700 flex-shrink-0">
                      <Zap size={10} /> AI Tip
                    </span>
                  )}
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
                    {/* Market comparison */}
                    {p.intel && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Market Comparison</p>
                        <div className="grid grid-cols-3 gap-3 text-center mb-3">
                          <div className="bg-white rounded-xl p-3">
                            <p className="text-xs text-gray-400">Your Price</p>
                            <p className="font-extrabold text-gray-900">{formatPrice(p.price)}</p>
                          </div>
                          <div className="bg-white rounded-xl p-3">
                            <p className="text-xs text-gray-400">Market Avg</p>
                            <p className="font-extrabold text-blue-600">{formatPrice(p.intel.avgCompetitorPrice)}</p>
                          </div>
                          <div className="bg-white rounded-xl p-3">
                            <p className="text-xs text-gray-400">Rank</p>
                            <p className="font-extrabold text-purple-600">{p.intel.priceRank}</p>
                          </div>
                        </div>
                        {/* Visual price bar */}
                        <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden mb-1">
                          <div className="absolute h-full bg-blue-300 rounded-full" style={{ width: '100%' }} />
                          <div
                            className="absolute h-full w-1 bg-green-600 rounded-full"
                            style={{ left: `${Math.min(100, Math.max(0, (p.price / (p.intel.avgCompetitorPrice * 1.5)) * 100))}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400">
                          <span>Lowest</span><span>Market Avg</span><span>Highest</span>
                        </div>
                        {p.intel.suggestion && (
                          <p className="text-xs text-orange-600 font-semibold mt-2 flex items-center gap-1">
                            <AlertTriangle size={11} /> {p.intel.suggestion}
                          </p>
                        )}
                      </div>
                    )}

                    {/* AI pricing suggestion */}
                    {p.suggestion && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">AI Pricing Suggestion</p>
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs text-purple-600 font-semibold">{p.suggestion.reason}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-400 line-through">{formatPrice(p.price)}</span>
                              <span className="text-lg font-extrabold text-purple-700">{formatPrice(p.suggestion.suggestedPrice)}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Sales velocity: {p.suggestion.salesVelocity} orders/week · Search demand: {p.suggestion.searchDemand} searches
                            </p>
                          </div>
                          {hasSuggestion && (
                            <button
                              onClick={() => applyPrice(p.id, p.suggestion.suggestedPrice)}
                              disabled={applying === p.id}
                              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50">
                              <DollarSign size={12} />
                              {applying === p.id ? 'Applying…' : 'Apply Price'}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Competitors */}
                    {p.intel?.competitors?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Top Competitors</p>
                        <div className="space-y-1.5">
                          {p.intel.competitors.slice(0, 4).map((c: any, i: number) => (
                            <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                              <span className="text-xs text-gray-600 truncate flex-1">{c.seller?.storeName || 'Competitor'} — {c.name}</span>
                              <span className={`text-xs font-bold ml-2 flex-shrink-0 ${c.price < p.price ? 'text-red-600' : 'text-green-600'}`}>
                                {formatPrice(c.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {products.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <DollarSign size={40} className="mx-auto mb-3 opacity-30" />
          <p>Add products first to see pricing intelligence</p>
        </div>
      )}
    </div>
  )
}
