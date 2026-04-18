import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function AdminProducts() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-products-review'],
    queryFn:  () => api.get('/admin/products/review').then(r => r.data.data),
  })

  const { mutate: moderate } = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.patch(`/admin/products/${id}/moderate`, { action }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-products-review'] }); toast.success('Product moderated') },
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      <h2 className="font-extrabold text-gray-900">Products Pending Review ({data?.length || 0})</h2>
      {!data?.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center text-gray-400">No products pending review</div>
      ) : data.map((p: { id: string; name: string; price: number; seller?: { storeName: string }; category?: { name: string } }) => (
        <div key={p.id} className="bg-white rounded-2xl shadow-card p-5 flex items-center gap-4">
          <div className="flex-1">
            <p className="font-bold text-gray-900">{p.name}</p>
            <p className="text-sm text-gray-400">{p.seller?.storeName} · {p.category?.name}</p>
            <p className="text-green-primary font-bold">{formatPrice(p.price)}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => moderate({ id: p.id, action: 'approve' })}
              className="flex items-center gap-1 px-3 py-2 bg-green-50 text-green-primary rounded-xl text-sm font-semibold hover:bg-green-100 transition-colors">
              <CheckCircle size={15} /> Approve
            </button>
            <button onClick={() => moderate({ id: p.id, action: 'reject' })}
              className="flex items-center gap-1 px-3 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors">
              <XCircle size={15} /> Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
