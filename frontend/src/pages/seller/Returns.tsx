import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, CheckCircle, XCircle, Clock } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { formatDate, formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<string, string> = {
  PENDING:    'bg-yellow-100 text-yellow-700',
  APPROVED:   'bg-blue-100 text-blue-700',
  PROCESSING: 'bg-purple-100 text-purple-700',
  COMPLETED:  'bg-green-100 text-green-700',
  REJECTED:   'bg-red-100 text-red-700',
}

export default function SellerReturns() {
  const qc = useQueryClient()

  const { data: refunds = [], isLoading } = useQuery({
    queryKey: ['seller-returns'],
    queryFn: () => api.get('/refunds/all').then(r => r.data.data).catch(() => []),
  })

  const { mutate: process } = useMutation({
    mutationFn: ({ refundId, action }: { refundId: string; action: string }) =>
      api.post('/refunds/process', { refundId, action }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['seller-returns'] })
      toast.success(vars.action === 'approve' ? 'Return approved!' : 'Return rejected')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  })

  const pending = refunds.filter((r: any) => r.status === 'PENDING')
  const processed = refunds.filter((r: any) => r.status !== 'PENDING')

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <RotateCcw size={20} className="text-green-primary" /> Returns & Refunds
        </h2>
        <p className="text-sm text-gray-400">Manage customer return requests for your products</p>
      </div>

      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <Clock size={18} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            <strong>{pending.length}</strong> return request{pending.length > 1 ? 's' : ''} waiting for your response
          </p>
        </div>
      )}

      {/* Pending returns */}
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">⏳ Awaiting Response</p>
          <div className="space-y-3">
            {pending.map((r: any) => (
              <div key={r.id} className="bg-white rounded-2xl shadow-card p-5 border-l-4 border-amber-400">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-bold text-gray-900">Order #{r.orderId?.slice(-8).toUpperCase()}</p>
                    <p className="text-xs text-gray-400">{formatDate(r.createdAt)}</p>
                  </div>
                  <span className="font-extrabold text-green-primary">{formatPrice(r.amount)}</span>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 mb-4">
                  <p className="text-xs font-bold text-gray-500 mb-1">Customer Reason:</p>
                  <p className="text-sm text-gray-700">{r.reason}</p>
                </div>
                <div className="flex gap-3">
                  <Button size="sm" onClick={() => process({ refundId: r.id, action: 'approve' })}>
                    <CheckCircle size={14} /> Approve Return
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => process({ refundId: r.id, action: 'reject' })}>
                    <XCircle size={14} /> Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Processed returns */}
      {processed.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">✅ Processed</p>
          <div className="space-y-2">
            {processed.map((r: any) => (
              <div key={r.id} className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-gray-800">Order #{r.orderId?.slice(-8).toUpperCase()}</p>
                  <p className="text-xs text-gray-400">{r.reason} · {formatDate(r.createdAt)}</p>
                </div>
                <span className="font-bold text-sm text-gray-700">{formatPrice(r.amount)}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-500'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!refunds.length && (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <RotateCcw size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400">No return requests yet</p>
        </div>
      )}

      {/* Policy info */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
        <h3 className="font-bold text-gray-800 mb-2">📋 Return Policy Reminder</h3>
        <ul className="space-y-1 text-sm text-gray-600">
          <li>• Buyers have <strong>7 days</strong> from delivery to request a return</li>
          <li>• You have <strong>48 hours</strong> to respond to return requests</li>
          <li>• Unanswered requests are auto-approved after 48 hours</li>
          <li>• Approved refunds are processed within 3–5 business days</li>
        </ul>
      </div>
    </div>
  )
}
