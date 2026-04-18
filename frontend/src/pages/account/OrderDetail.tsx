import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Package, MapPin, CreditCard, Truck, Shield, Printer } from 'lucide-react'
import { orderService } from '@/services/order.service'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { formatDate, formatPrice, getOrderStatusColor } from '@/lib/utils'
import toast from 'react-hot-toast'
import api from '@/lib/api'

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: order, isLoading, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn:  () => orderService.getOrder(id!).then(r => r.data.data),
    enabled:  !!id,
  })

  const { mutate: cancel, isPending: cancelling } = useMutation({
    mutationFn: () => orderService.cancelOrder(id!, 'Cancelled by customer'),
    onSuccess: () => { toast.success('Order cancelled'); refetch() },
  })

  const { mutate: reorder, isPending: reordering } = useMutation({
    mutationFn: () => api.post(`/features/reorder/${id}`),
    onSuccess: () => toast.success('Items added to cart! 🛒'),
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to reorder'),
  })

  const { mutate: retryPayment, isPending: retrying } = useMutation({
    mutationFn: () => api.post('/payments/retry', { orderId: id }),
    onSuccess: (res: any) => {
      const url = res.data?.data?.checkoutUrl
      if (url) window.location.href = url
      else toast.success('Payment retry initiated')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to retry payment'),
  })

  const { mutate: claimInsurance, isPending: claiming } = useMutation({
    mutationFn: () => api.post(`/features/insurance/claim/${id}`),
    onSuccess: () => toast.success('Insurance claim submitted! We\'ll review within 24 hours.'),
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to submit claim'),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>
  if (!order)    return <div className="text-center py-20 text-gray-400">Order not found</div>

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-card p-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-extrabold text-gray-900">Order #{order.id.slice(-8).toUpperCase()}</h2>
          <p className="text-sm text-gray-400">{formatDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`badge ${getOrderStatusColor(order.status)}`}>{order.status.replace(/_/g,' ')}</span>
          {['PENDING','CONFIRMED'].includes(order.status) && (
            <Button variant="danger" size="sm" loading={cancelling} onClick={() => cancel()}>Cancel</Button>
          )}
          {order.delivery?.trackingCode && (
            <Link to={`/track/${order.delivery.trackingCode}`}><Button size="sm" variant="outline"><Truck size={14} /> Track</Button></Link>
          )}
          {/* Reorder button */}
          {['DELIVERED', 'CANCELLED'].includes(order.status) && (
            <Button size="sm" variant="outline" loading={reordering} onClick={() => reorder()}>
              🔄 Reorder
            </Button>
          )}
          {/* Retry payment for failed/pending orders */}
          {order.status === 'PENDING' && order.payment?.status === 'FAILED' && (
            <Button size="sm" loading={retrying} onClick={() => retryPayment()}>
              💳 Retry Payment
            </Button>
          )}
          {/* Feature 19: Insurance claim button */}
          {(order as any).hasInsurance && ['DELIVERED', 'CANCELLED'].includes(order.status) && !(order as any).insuranceClaimed && (
            <Button size="sm" variant="outline" loading={claiming} onClick={() => claimInsurance()}>
              <Shield size={14} /> Claim Insurance
            </Button>
          )}
          {/* Invoice — opens server-rendered printable invoice in new tab */}
          <Button size="sm" variant="outline"
            onClick={() => window.open(`${import.meta.env.VITE_API_URL}/orders/${order.id}/invoice?print=1`, '_blank')}>
            <Printer size={14} /> Invoice
          </Button>
          {/* Packing slip — seller only (shown for all, backend enforces seller-only) */}
          <Button size="sm" variant="outline"
            onClick={() => window.open(`${import.meta.env.VITE_API_URL}/orders/${order.id}/invoice/packing-slip?print=1`, '_blank')}>
            📦 Packing Slip
          </Button>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Package size={18} className="text-green-primary" /> Items</h3>
        <div className="space-y-3">
          {order.items?.map(item => (
            <div key={item.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
                {(item as any).productImg
                  ? <img src={(item as any).productImg} alt={item.productName} className="w-full h-full object-cover rounded-xl" />
                  : <span>🛒</span>
                }
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-800">{item.productName}</p>
                <p className="text-xs text-gray-400">{item.quantity} {item.unit} × {formatPrice(item.unitPrice)}</p>
              </div>
              <span className="font-bold text-gray-900">{formatPrice(item.totalPrice)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-1.5">
          <div className="flex justify-between text-sm text-gray-500"><span>Subtotal</span><span>{formatPrice(order.subtotal)}</span></div>
          <div className="flex justify-between text-sm text-gray-500"><span>Delivery</span><span>{order.deliveryFee === 0 ? 'FREE' : formatPrice(order.deliveryFee)}</span></div>
          {order.discount > 0 && <div className="flex justify-between text-sm text-green-primary"><span>Discount</span><span>-{formatPrice(order.discount)}</span></div>}
          <div className="flex justify-between font-extrabold text-gray-900 text-base pt-2 border-t border-gray-100"><span>Total</span><span className="text-green-primary">{formatPrice(order.total)}</span></div>
        </div>
      </div>

      {/* Status History Timeline */}
      {order.statusHistory && order.statusHistory.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Truck size={16} className="text-green-primary" /> Order Timeline
          </h3>
          <div className="relative">
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-100" />
            <div className="space-y-4">
              {order.statusHistory.map((h: any, i: number) => (
                <div key={h.id || i} className="flex items-start gap-4 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 flex-shrink-0 ${i === 0 ? 'bg-green-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                    <div className="w-2 h-2 rounded-full bg-current" />
                  </div>
                  <div className="flex-1 pb-1">
                    <p className="font-semibold text-sm text-gray-800 capitalize">{h.status.replace(/_/g,' ')}</p>
                    {h.note && <p className="text-xs text-gray-500 mt-0.5">{h.note}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(h.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Address + Payment */}
      <div className="grid sm:grid-cols-2 gap-5">
        {order.address && (
          <div className="bg-white rounded-2xl shadow-card p-5">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><MapPin size={16} className="text-green-primary" /> Delivery Address</h3>
            <p className="text-sm text-gray-700 font-semibold">{order.address.fullName}</p>
            <p className="text-sm text-gray-500">{order.address.phone}</p>
            <p className="text-sm text-gray-500">{order.address.street}, {order.address.city}</p>
            <p className="text-sm text-gray-500">{order.address.country}</p>
          </div>
        )}
        {order.payment && (
          <div className="bg-white rounded-2xl shadow-card p-5">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><CreditCard size={16} className="text-green-primary" /> Payment</h3>
            <p className="text-sm text-gray-700 font-semibold">{order.payment.method?.replace(/_/g,' ')}</p>
            <p className="text-sm text-gray-500">Status: <span className={order.payment.status === 'PAID' ? 'text-green-primary font-bold' : 'text-orange-500 font-bold'}>{order.payment.status}</span></p>
            {order.payment.paidAt && <p className="text-sm text-gray-400">Paid: {formatDate(order.payment.paidAt)}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
