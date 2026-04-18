import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Calendar, Package, CheckCircle, ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { formatDate, formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

// FEFO = First Expired, First Out
// Shows products sorted by harvest date / expiry — oldest first
export default function FEFOInventory() {
  const qc = useQueryClient()
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['fefo-inventory'],
    queryFn: () => api.get('/sellers/me/products?limit=100').then(r => r.data.data),
  })

  // Sort by harvest date (oldest first = should be sold first)
  const sorted = [...products].sort((a: any, b: any) => {
    const aDate = a.harvestDate || a.season || a.createdAt
    const bDate = b.harvestDate || b.season || b.createdAt
    return new Date(aDate).getTime() - new Date(bDate).getTime()
  })

  const getFreshnessStatus = (p: any) => {
    const harvestDate = p.harvestDate || p.season
    if (!harvestDate) return { label: 'No date set', color: 'bg-gray-100 text-gray-500', days: null, urgent: false }
    const days = Math.floor((Date.now() - new Date(harvestDate).getTime()) / 86400000)
    if (days <= 2) return { label: `${days}d old — Very Fresh`, color: 'bg-green-100 text-green-700', days, urgent: false }
    if (days <= 5) return { label: `${days}d old — Fresh`, color: 'bg-blue-100 text-blue-700', days, urgent: false }
    if (days <= 10) return { label: `${days}d old — Sell Soon`, color: 'bg-yellow-100 text-yellow-700', days, urgent: true }
    return { label: `${days}d old — ⚠️ Urgent`, color: 'bg-red-100 text-red-700', days, urgent: true }
  }

  const markDiscounted = async (product: any) => {
    setUpdatingId(product.id)
    try {
      const discountedPrice = (product.price * 0.8).toFixed(2)
      await api.patch(`/sellers/me/products/${product.id}`, {
        comparePrice: product.price,
        price: parseFloat(discountedPrice),
      })
      qc.invalidateQueries({ queryKey: ['fefo-inventory'] })
      toast.success(`Price reduced to ETB ${discountedPrice} to move stock faster!`)
    } catch { toast.error('Failed to update price') }
    finally { setUpdatingId(null) }
  }

  const urgent = sorted.filter((p: any) => {
    const status = getFreshnessStatus(p)
    return status.urgent && p.stock > 0
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <Calendar size={20} className="text-green-primary" /> FEFO Inventory
        </h2>
        <p className="text-sm text-gray-400">First Expired, First Out — sell oldest stock first to minimize waste</p>
      </div>

      {/* Urgent alert */}
      {urgent.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-red-500" />
            <p className="font-bold text-red-700">{urgent.length} product{urgent.length > 1 ? 's' : ''} need immediate attention</p>
          </div>
          <div className="space-y-2">
            {urgent.map((p: any) => {
              const status = getFreshnessStatus(p)
              return (
                <div key={p.id} className="flex items-center gap-3 bg-white rounded-xl p-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-50 overflow-hidden flex-shrink-0">
                    {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" alt="" /> : <span className="flex items-center justify-center h-full">🛒</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-red-600 font-bold">{status.label} · {p.stock} {p.unit} remaining</p>
                  </div>
                  <Button size="sm" variant="outline" loading={updatingId === p.id}
                    onClick={() => markDiscounted(p)}>
                    -20% Price
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* FEFO sorted list */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <p className="font-bold text-gray-900">All Products — Oldest First</p>
          <span className="text-xs text-gray-400">{sorted.length} products</span>
        </div>
        <div className="divide-y divide-gray-50">
          {sorted.map((p: any, i: number) => {
            const status = getFreshnessStatus(p)
            return (
              <div key={p.id} className="p-4 flex items-center gap-4">
                {/* Priority rank */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                  i === 0 ? 'bg-red-100 text-red-600' :
                  i === 1 ? 'bg-orange-100 text-orange-600' :
                  i === 2 ? 'bg-yellow-100 text-yellow-600' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {i + 1}
                </div>

                <div className="w-12 h-12 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0">
                  {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" alt="" /> : <span className="flex items-center justify-center h-full text-xl">🛒</span>}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800 truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${status.color}`}>
                      {status.label}
                    </span>
                    <span className="text-xs text-gray-400">{p.stock} {p.unit} in stock</span>
                    <span className="text-xs font-bold text-green-primary">{formatPrice(p.price)}</span>
                  </div>
                </div>

                {/* Action */}
                {status.urgent && p.stock > 0 && (
                  <Button size="sm" variant="outline" loading={updatingId === p.id}
                    onClick={() => markDiscounted(p)}>
                    Discount
                  </Button>
                )}
                {!status.urgent && p.stock > 0 && (
                  <CheckCircle size={16} className="text-green-primary flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>
        {!sorted.length && (
          <div className="p-12 text-center text-gray-400">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p>No products yet</p>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
        <h3 className="font-bold text-gray-800 mb-3">💡 FEFO Best Practices</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-start gap-2"><ArrowRight size={14} className="text-green-primary mt-0.5 flex-shrink-0" /><span>Always set harvest dates when listing fresh produce</span></div>
          <div className="flex items-start gap-2"><ArrowRight size={14} className="text-green-primary mt-0.5 flex-shrink-0" /><span>Products older than 7 days should be discounted 15–25%</span></div>
          <div className="flex items-start gap-2"><ArrowRight size={14} className="text-green-primary mt-0.5 flex-shrink-0" /><span>Use flash sales to move aging stock quickly</span></div>
          <div className="flex items-start gap-2"><ArrowRight size={14} className="text-green-primary mt-0.5 flex-shrink-0" /><span>Update stock to 0 when product is no longer sellable</span></div>
        </div>
      </div>
    </div>
  )
}
