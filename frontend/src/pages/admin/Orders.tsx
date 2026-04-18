import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, ChevronDown, ChevronUp, MapPin, Package } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatPrice, formatDate, getOrderStatusColor } from '@/lib/utils'
import toast from 'react-hot-toast'

const ORDER_STATUSES = ['PENDING','CONFIRMED','PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','CANCELLED','REFUNDED']

export default function AdminOrders() {
  const qc = useQueryClient()
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [expanded, setExpanded]     = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', statusFilter, search],
    queryFn: () => api.get('/admin/orders', {
      params: {
        ...(statusFilter !== 'ALL' && { status: statusFilter }),
        ...(search && { search }),
        limit: 50,
      },
    }).then(r => r.data.data),
  })

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      api.patch(`/orders/${orderId}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-orders'] }); toast.success('Order status updated') },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update'),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  const orders = data || []

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by order ID or customer name..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-primary" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary bg-white">
          <option value="ALL">All Statuses</option>
          {ORDER_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>
      </div>

      <p className="text-sm text-gray-400 px-1">{orders.length} orders</p>

      {/* Orders */}
      {!orders.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center text-gray-400">No orders found</div>
      ) : orders.map((o: any) => (
        <div key={o.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-gray-900">#{o.id.slice(-8).toUpperCase()}</span>
                <span className={`badge text-xs ${getOrderStatusColor(o.status)}`}>{o.status.replace(/_/g,' ')}</span>
                <span className={`badge text-xs ${o.payment?.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {o.payment?.status || 'UNPAID'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{o.user?.name} · {formatDate(o.createdAt)}</p>
            </div>
            <span className="font-extrabold text-green-primary flex-shrink-0">{formatPrice(o.total)}</span>
            <button onClick={() => setExpanded(expanded === o.id ? null : o.id)}
              className="p-2 text-gray-400 hover:text-gray-600 flex-shrink-0">
              {expanded === o.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
            </button>
          </div>

          {expanded === o.id && (
            <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
              {/* Status update */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-gray-500">Update Status:</span>
                <div className="flex gap-2 flex-wrap">
                  {ORDER_STATUSES.filter(s => s !== o.status).map(s => (
                    <button key={s} onClick={() => updateStatus({ orderId: o.id, status: s })}
                      className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:border-green-primary hover:text-green-primary transition-colors">
                      → {s.replace(/_/g,' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Items */}
              {o.items?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Items</p>
                  <div className="space-y-1.5">
                    {o.items.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-2 bg-white rounded-xl p-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {item.product?.images?.[0]
                            ? <img src={item.product.images[0]} className="w-full h-full object-cover rounded-lg" alt="" />
                            : <Package size={14} className="text-gray-400" />}
                        </div>
                        <span className="flex-1 text-sm text-gray-700 truncate">{item.product?.name}</span>
                        <span className="text-xs text-gray-400">{item.quantity}×</span>
                        <span className="text-sm font-bold text-gray-800">{formatPrice(item.totalPrice)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Address */}
              {o.address && (
                <div className="bg-white rounded-xl p-3 flex items-start gap-2">
                  <MapPin size={14} className="text-green-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{o.address.fullName} · {o.address.phone}</p>
                    <p className="text-sm text-gray-500">{o.address.street}, {o.address.city}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
