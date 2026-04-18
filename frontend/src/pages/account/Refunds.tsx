import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Plus } from 'lucide-react'
import { userService } from '@/services/user.service'
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

const REFUND_REASONS = [
  'Item not as described',
  'Wrong item received',
  'Item damaged or defective',
  'Item not delivered',
  'Changed my mind',
  'Duplicate order',
  'Other',
]

export default function Refunds() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [orderId, setOrderId]   = useState('')
  const [reason, setReason]     = useState('')
  const [amount, setAmount]     = useState('')
  const [isPartial, setIsPartial] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['my-refunds'],
    queryFn:  () => userService.getMyRefunds().then(r => r.data.data),
  })

  const { data: orders } = useQuery({
    queryKey: ['my-orders-refundable'],
    queryFn:  () => api.get('/orders?status=DELIVERED&limit=20').then(r => r.data.data),
  })

  const { mutate: submit, isLoading: submitting } = useMutation({
    mutationFn: () => api.post('/refunds/request', {
      orderId,
      reason,
      amount: isPartial && amount ? parseFloat(amount) : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-refunds'] })
      toast.success('Refund request submitted! We\'ll review it within 1–2 business days.')
      setShowForm(false); setOrderId(''); setReason(''); setAmount(''); setIsPartial(false)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to submit refund'),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-gray-900">My Refunds</h2>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus size={14} /> Request Refund
        </Button>
      </div>

      {/* Refund request form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-5 space-y-4">
          <h3 className="font-bold text-gray-900">New Refund Request</h3>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Select Order *</label>
            <select value={orderId} onChange={e => setOrderId(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
              <option value="">Choose an order...</option>
              {orders?.map((o: any) => (
                <option key={o.id} value={o.id}>
                  #{o.id.slice(-8).toUpperCase()} — {formatPrice(o.total)} ({formatDate(o.createdAt)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Reason *</label>
            <select value={reason} onChange={e => setReason(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
              <option value="">Select reason...</option>
              {REFUND_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-3">
              <input type="checkbox" checked={isPartial} onChange={e => setIsPartial(e.target.checked)} className="w-4 h-4 accent-green-primary" />
              <span className="text-sm font-medium text-gray-700">Request partial refund</span>
            </label>
            {isPartial && (
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Refund Amount ($)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="Enter amount..."
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary" />
                <p className="text-xs text-gray-400 mt-1">Leave empty for full refund</p>
              </div>
            )}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            ⏱ Refunds are processed within 3–5 business days. You have 7 days from delivery to request a refund.
          </div>

          <div className="flex gap-3">
            <Button onClick={() => submit()} loading={submitting} disabled={!orderId || !reason}>
              Submit Request
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Refund list */}
      {!data?.length && !showForm ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <RotateCcw size={48} className="text-gray-200 mx-auto mb-4" />
          <h3 className="font-bold text-gray-700 mb-2">No refund requests</h3>
          <p className="text-gray-400 text-sm">Your refund history will appear here</p>
        </div>
      ) : data?.map((r: any) => (
        <div key={r.id} className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-gray-900 text-sm">Order #{r.orderId.slice(-8).toUpperCase()}</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
          </div>
          <p className="text-sm text-gray-500 mb-1">Amount: <span className="font-bold text-green-primary">{formatPrice(r.amount)}</span></p>
          <p className="text-sm text-gray-500 mb-1">Reason: {r.reason}</p>
          {r.walletCredited && <p className="text-xs text-green-primary font-medium">✓ Credited to wallet</p>}
          <p className="text-xs text-gray-400 mt-2">{formatDate(r.createdAt)}</p>
        </div>
      ))}
    </div>
  )
}
