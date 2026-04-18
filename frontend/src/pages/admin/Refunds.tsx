import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Clock, RotateCcw } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatPrice, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const STATUS_TABS = [
  { key: 'PENDING',  label: 'Pending',  color: 'bg-yellow-100 text-yellow-700' },
  { key: 'APPROVED', label: 'Approved', color: 'bg-green-100 text-green-700' },
  { key: 'REJECTED', label: 'Rejected', color: 'bg-red-100 text-red-700' },
  { key: '',         label: 'All',      color: 'bg-gray-100 text-gray-600' },
]

export default function AdminRefunds() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('PENDING')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-refunds', tab],
    queryFn: () => api.get('/refunds/all', { params: tab ? { status: tab } : {} }).then(r => r.data.data),
  })

  const { mutate: process_, isLoading: processing } = useMutation({
    mutationFn: ({ refundId, action }: { refundId: string; action: string }) =>
      api.post('/refunds/process', { refundId, action }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-refunds'] })
      toast.success(`Refund ${vars.action === 'approve' ? 'approved' : 'rejected'}`)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to process refund'),
  })

  const refunds = data || []

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
              tab === t.key ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-500 border-gray-200 hover:border-green-primary'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : !refunds.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <RotateCcw size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400">No {tab.toLowerCase() || ''} refunds</p>
        </div>
      ) : refunds.map((r: any) => (
        <div key={r.id} className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              r.status === 'APPROVED' ? 'bg-green-100' :
              r.status === 'REJECTED' ? 'bg-red-100' : 'bg-yellow-100'
            }`}>
              {r.status === 'APPROVED' ? <CheckCircle size={18} className="text-green-primary" /> :
               r.status === 'REJECTED' ? <XCircle size={18} className="text-red-500" /> :
               <Clock size={18} className="text-yellow-600" />}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-extrabold text-gray-900">#{r.orderId?.slice(-8).toUpperCase()}</span>
                <span className={`badge text-xs ${
                  r.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                  r.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>{r.status}</span>
                <span className="text-xs font-bold text-gray-500">{r.method?.replace(/_/g,' ')}</span>
              </div>
              <p className="text-sm text-gray-600 mb-0.5">
                <span className="font-semibold">{r.order?.user?.name || 'Unknown'}</span>
                {r.order?.user?.email && <span className="text-gray-400"> · {r.order.user.email}</span>}
              </p>
              <p className="text-sm text-gray-500 mb-1">Reason: {r.reason}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-lg font-extrabold text-green-primary">{formatPrice(r.amount)}</span>
                <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                {r.order?.payment?.method && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                    Paid via {r.order.payment.method.replace(/_/g,' ')}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            {r.status === 'PENDING' && (
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => process_({ refundId: r.id, action: 'approve' })}
                  disabled={processing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-primary rounded-xl text-sm font-bold hover:bg-green-100 transition-colors disabled:opacity-50">
                  <CheckCircle size={14}/> Approve
                </button>
                <button
                  onClick={() => process_({ refundId: r.id, action: 'reject' })}
                  disabled={processing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors disabled:opacity-50">
                  <XCircle size={14}/> Reject
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
