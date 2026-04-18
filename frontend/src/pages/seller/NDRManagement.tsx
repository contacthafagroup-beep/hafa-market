import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Phone, RefreshCw, MapPin, TrendingDown, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { formatDate, formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

// NDR = Non-Delivery Report — failed/undelivered orders
export default function NDRManagement() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState<'all' | 'failed' | 'returned'>('all')

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['ndr-orders', filter],
    queryFn: () => api.get('/sellers/me/orders', {
      params: { status: filter === 'all' ? 'CANCELLED' : filter === 'failed' ? 'CANCELLED' : 'REFUNDED', limit: 50 },
    }).then(r => r.data.data || []),
  })

  // Filter to only delivery-failed orders (those with delivery records)
  const ndrOrders = orders.filter((o: any) =>
    o.cancelReason?.toLowerCase().includes('deliver') ||
    o.cancelReason?.toLowerCase().includes('not found') ||
    o.cancelReason?.toLowerCase().includes('refused') ||
    o.delivery?.status === 'FAILED' ||
    o.status === 'CANCELLED'
  )

  const { mutate: reattempt } = useMutation({
    mutationFn: (orderId: string) => api.patch(`/sellers/me/orders/${orderId}/status`, { status: 'CONFIRMED' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ndr-orders'] }); toast.success('Order re-queued for delivery!') },
    onError: () => toast.error('Failed to re-attempt delivery'),
  })

  // NDR stats
  const totalNDR = ndrOrders.length
  const totalLost = ndrOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0)
  const reasons: Record<string, number> = {}
  ndrOrders.forEach((o: any) => {
    const reason = o.cancelReason || 'Unknown'
    reasons[reason] = (reasons[reason] || 0) + 1
  })
  const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0]

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <AlertTriangle size={20} className="text-orange-500" /> NDR Management
        </h2>
        <p className="text-sm text-gray-400">Non-Delivery Reports — analyze and recover failed deliveries</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-card p-4 text-center">
          <p className="text-2xl font-extrabold text-red-500">{totalNDR}</p>
          <p className="text-xs text-gray-400 mt-1">Failed Deliveries</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-4 text-center">
          <p className="text-2xl font-extrabold text-orange-500">{formatPrice(totalLost)}</p>
          <p className="text-xs text-gray-400 mt-1">Revenue at Risk</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-4 text-center">
          <p className="text-2xl font-extrabold text-blue-500">
            {orders.length > 0 ? Math.round((totalNDR / orders.length) * 100) : 0}%
          </p>
          <p className="text-xs text-gray-400 mt-1">NDR Rate</p>
        </div>
      </div>

      {/* Top failure reason */}
      {topReason && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-start gap-3">
          <TrendingDown size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-orange-800 text-sm">Top Failure Reason</p>
            <p className="text-orange-700 text-sm mt-0.5">"{topReason[0]}" — {topReason[1]} orders</p>
            <p className="text-xs text-orange-600 mt-1">
              💡 Consider adding more detailed address instructions or calling customers before delivery
            </p>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {[['all', 'All NDR'], ['failed', 'Failed'], ['returned', 'Returned']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val as any)}
            className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${filter === val ? 'bg-green-primary text-white border-green-primary' : 'bg-white border-gray-200 text-gray-600 hover:border-green-primary'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* NDR Orders */}
      {!ndrOrders.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <CheckCircle size={40} className="mx-auto text-green-primary mb-3" />
          <p className="font-bold text-gray-700 mb-1">No failed deliveries!</p>
          <p className="text-gray-400 text-sm">All your orders are being delivered successfully.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ndrOrders.map((order: any) => (
            <div key={order.id} className="bg-white rounded-2xl shadow-card p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-bold text-gray-900">#{order.id.slice(-8).toUpperCase()}</p>
                  <p className="text-xs text-gray-400">{formatDate(order.createdAt)} · {formatPrice(order.total)}</p>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-100 text-red-600">
                  {order.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Delivery address */}
              {order.address && (
                <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3 mb-3">
                  <MapPin size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-700">{order.address.fullName}</p>
                    <p className="text-xs text-gray-500">{order.address.street}, {order.address.city}</p>
                  </div>
                  {order.address.phone && (
                    <a href={`tel:${order.address.phone}`}
                      className="flex items-center gap-1 text-xs font-bold text-green-primary hover:underline flex-shrink-0">
                      <Phone size={12} /> Call
                    </a>
                  )}
                </div>
              )}

              {/* Failure reason */}
              {order.cancelReason && (
                <div className="bg-red-50 rounded-xl p-3 mb-3">
                  <p className="text-xs font-bold text-red-600 mb-0.5">Failure Reason:</p>
                  <p className="text-xs text-red-700">{order.cancelReason}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => reattempt(order.id)}>
                  <RefreshCw size={13} /> Re-attempt Delivery
                </Button>
                {order.address?.phone && (
                  <a href={`tel:${order.address.phone}`}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-primary rounded-xl text-xs font-bold hover:bg-green-100 transition-colors">
                    <Phone size={13} /> Call Customer
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <h3 className="font-bold text-blue-800 mb-3">📋 Reduce NDR Rate</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm text-blue-700">
          {[
            '📞 Call customers 30 min before delivery',
            '📍 Ask for GPS location at checkout',
            '💬 Send Telegram/SMS with ETA',
            '🏪 Offer pickup station as alternative',
            '⏰ Confirm delivery time slot with customer',
            '📸 Take proof-of-delivery photo',
          ].map(tip => (
            <div key={tip} className="flex items-start gap-2">
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
