import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Package, ChevronRight, RotateCcw } from 'lucide-react'
import { orderService } from '@/services/order.service'
import Spinner from '@/components/ui/Spinner'
import { formatDate, formatPrice, getOrderStatusColor } from '@/lib/utils'
import api from '@/lib/api'
import toast from 'react-hot-toast'

export default function Orders() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn:  () => orderService.getOrders().then(r => r.data),
  })

  const { mutate: reorder, isPending: reordering } = useMutation({
    mutationFn: (orderId: string) => api.post(`/features/reorder/${orderId}`),
    onSuccess: () => {
      toast.success('Items added to cart! 🛒')
      navigate('/cart')
    },
    onError: () => toast.error('Failed to reorder'),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      {!data?.data?.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <Package size={48} className="text-gray-200 mx-auto mb-4" />
          <h3 className="font-bold text-gray-700 mb-2">No orders yet</h3>
          <p className="text-gray-400 text-sm mb-4">Start shopping to see your orders here</p>
          <Link to="/products" className="text-green-primary font-semibold hover:underline">Browse Products →</Link>
        </div>
      ) : data.data.map((order: any) => (
        <div key={order.id} className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-center gap-4">
            <Link to={`/account/orders/${order.id}`}
              className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-green-primary flex-shrink-0">
              <Package size={22} />
            </Link>
            <Link to={`/account/orders/${order.id}`} className="flex-1 min-w-0 group">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-gray-900 text-sm">#{order.id.slice(-8).toUpperCase()}</span>
                <span className={`badge text-xs ${getOrderStatusColor(order.status)}`}>{order.status.replace(/_/g,' ')}</span>
              </div>
              <p className="text-xs text-gray-400">{formatDate(order.createdAt)} · {order.items?.length} items</p>
            </Link>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="text-right">
                <div className="font-extrabold text-green-primary">{formatPrice(order.total)}</div>
              </div>
              {/* Reorder button — show for delivered orders */}
              {order.status === 'DELIVERED' && (
                <button
                  onClick={() => reorder(order.id)}
                  disabled={reordering}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-primary rounded-xl text-xs font-bold hover:bg-green-100 transition-colors border border-green-200"
                  title="Add all items to cart again">
                  <RotateCcw size={13} /> Reorder
                </button>
              )}
              <Link to={`/account/orders/${order.id}`}>
                <ChevronRight size={16} className="text-gray-300 hover:text-green-primary transition-colors" />
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
