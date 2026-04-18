import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Trash2, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatPrice, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const FREQ_LABELS: Record<string, string> = {
  WEEKLY: '🔄 Every week',
  BIWEEKLY: '🔄 Every 2 weeks',
  MONTHLY: '🔄 Every month',
}

export default function Subscriptions() {
  const qc = useQueryClient()

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ['my-subscriptions'],
    queryFn: () => api.get('/features/subscriptions').then(r => r.data.data),
  })

  const { mutate: cancel } = useMutation({
    mutationFn: (id: string) => api.delete(`/features/subscriptions/${id}`),
    onSuccess: () => { toast.success('Subscription cancelled'); qc.invalidateQueries({ queryKey: ['my-subscriptions'] }) },
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900">Subscribe & Save</h2>
          <p className="text-sm text-gray-400">Auto-delivery for your staples</p>
        </div>
        <Link to="/products" className="flex items-center gap-1.5 text-sm text-green-primary font-bold hover:underline">
          <Plus size={14} /> Add subscription
        </Link>
      </div>

      {!subs.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <RefreshCw size={40} className="mx-auto text-gray-200 mb-4" />
          <h3 className="font-bold text-gray-700 mb-2">No active subscriptions</h3>
          <p className="text-gray-400 text-sm mb-4">Subscribe to products for automatic weekly or monthly delivery</p>
          <Link to="/products" className="text-green-primary font-semibold hover:underline">Browse Products →</Link>
        </div>
      ) : subs.map((sub: any) => (
        <div key={sub.id} className="bg-white rounded-2xl shadow-card p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0">
            {sub.product?.images?.[0]
              ? <img src={sub.product.images[0]} alt={sub.product?.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-2xl">🛒</div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <Link to={`/products/${sub.product?.slug}`} className="font-bold text-gray-900 hover:text-green-primary transition-colors">
              {sub.product?.name}
            </Link>
            <p className="text-sm text-gray-500">{sub.quantity} {sub.product?.unit} · {formatPrice(sub.product?.price * sub.quantity, 'ETB')}</p>
            <p className="text-xs text-green-primary font-semibold mt-0.5">{FREQ_LABELS[sub.frequency]}</p>
            <p className="text-xs text-gray-400">Next delivery: {formatDate(sub.nextOrderAt)}</p>
          </div>
          <button onClick={() => cancel(sub.id)}
            className="p-2 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0" title="Cancel subscription">
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
