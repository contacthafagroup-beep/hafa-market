import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, ChevronDown, ChevronUp, Phone, MapPin, CheckCircle, XCircle, Truck, Clock } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatPrice, formatDate, getOrderStatusColor } from '@/lib/utils'
import toast from 'react-hot-toast'

const STATUS_ACTIONS: Record<string, { label: string; next: string; color: string; icon: React.ReactNode }[]> = {
  PENDING:    [{ label: 'Accept Order',  next: 'CONFIRMED',  color: 'bg-green-50 text-green-primary hover:bg-green-100', icon: <CheckCircle size={14}/> },
               { label: 'Reject',        next: 'CANCELLED',  color: 'bg-red-50 text-red-500 hover:bg-red-100',           icon: <XCircle size={14}/> }],
  CONFIRMED:  [{ label: 'Start Processing', next: 'PROCESSING', color: 'bg-blue-50 text-blue-600 hover:bg-blue-100',     icon: <Package size={14}/> }],
  PROCESSING: [{ label: 'Mark Shipped',  next: 'SHIPPED',    color: 'bg-purple-50 text-purple-600 hover:bg-purple-100',  icon: <Truck size={14}/> }],
}

export default function SellerOrders() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['seller-orders', statusFilter],
    queryFn: () => api.get('/sellers/me/orders', {
      params: statusFilter !== 'ALL' ? { status: statusFilter } : {},
    }).then(r => r.data.data),
    refetchInterval: 30000,
  })

  const { mutate: updateStatus, isLoading: updating } = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) =>
      api.patch(`/sellers/me/orders/${orderId}/status`, { status }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['seller-orders'] })
      toast.success(`Order ${vars.status.toLowerCase().replace(/_/g,' ')}!`)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update order'),
  })

  const FILTERS = ['ALL','PENDING','CONFIRMED','PROCESSING','SHIPPED','DELIVERED','CANCELLED']

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  const orders = data || []
  const pendingCount = orders.filter((o: any) => o.status === 'PENDING').length

  return (
    <div className="space-y-4">
      {/* Alert for pending orders */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <Clock size={20} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            You have <strong>{pendingCount}</strong> pending order{pendingCount > 1 ? 's' : ''} waiting for your response.
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold border-2 transition-all ${
              statusFilter === f ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-500 border-gray-200 hover:border-green-primary'
            }`}>
            {f === 'ALL' ? 'All Orders' : f.replace(/_/g,' ')}
            {f === 'PENDING' && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {!orders.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <Package size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400">No orders found</p>
        </div>
      ) : orders.map((o: any) => (
        <div key={o.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
          {/* Order header */}
          <div className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-gray-900">#{o.id.slice(-8).toUpperCase()}</span>
                <span className={`badge text-xs ${getOrderStatusColor(o.status)}`}>{o.status.replace(/_/g,' ')}</span>
                {o.payment?.method === 'CASH_ON_DELIVERY' && (
                  <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">💵 COD</span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{formatDate(o.createdAt)} · {o.user?.name}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="font-extrabold text-green-primary">{formatPrice(o.total)}</p>
              <p className="text-xs text-gray-400">{o.items?.length} item{o.items?.length !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={() => setExpanded(expanded === o.id ? null : o.id)}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
              {expanded === o.id ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
            </button>
          </div>

          {/* Action buttons for actionable statuses */}
          {STATUS_ACTIONS[o.status] && (
            <div className="px-4 pb-3 flex gap-2 flex-wrap">
              {STATUS_ACTIONS[o.status].map(action => (
                <button key={action.next}
                  onClick={() => updateStatus({ orderId: o.id, status: action.next })}
                  disabled={updating}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${action.color}`}>
                  {action.icon} {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Expanded details */}
          {expanded === o.id && (
            <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
              {/* Items */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Items Ordered</p>
                <div className="space-y-2">
                  {o.items?.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3 bg-white rounded-xl p-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.product?.images?.[0]
                          ? <img src={item.product.images[0]} className="w-full h-full object-cover" alt="" />
                          : <span className="text-lg">🛒</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{item.product?.name}</p>
                        <p className="text-xs text-gray-400">{item.quantity} × {formatPrice(item.unitPrice)}</p>
                      </div>
                      <span className="font-bold text-sm text-gray-800 flex-shrink-0">{formatPrice(item.totalPrice)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery address */}
              {o.address && (
                <div className="bg-white rounded-xl p-3">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                    <MapPin size={11}/> Delivery Address
                  </p>
                  <p className="text-sm font-semibold text-gray-800">{o.address.fullName}</p>
                  <p className="text-sm text-gray-600">{o.address.street}, {o.address.city}</p>
                  {o.address.latitude && <p className="text-xs text-green-600 mt-1">📍 GPS location saved</p>}
                  <a href={`tel:${o.address.phone}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-green-primary hover:underline">
                    <Phone size={12}/> {o.address.phone}
                  </a>
                </div>
              )}

              {/* Payment info */}
              <div className="bg-white rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Payment</p>
                  <p className="text-sm font-semibold text-gray-800 mt-0.5">{o.payment?.method?.replace(/_/g,' ')}</p>
                </div>
                <span className={`badge text-xs ${o.payment?.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {o.payment?.status || 'PENDING'}
                </span>
              </div>

              {/* Notes */}
              {o.notes && (
                <div className="bg-amber-50 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-700 mb-1">📝 Customer Note</p>
                  <p className="text-sm text-amber-800">{o.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
