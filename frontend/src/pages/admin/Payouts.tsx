import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, CheckCircle, XCircle, Clock } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatPrice, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<string, string> = {
  PENDING:    'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED:  'bg-green-100 text-green-700',
  FAILED:     'bg-red-100 text-red-700',
}

export default function AdminPayouts() {
  const qc = useQueryClient()
  const [notes, setNotes] = useState<Record<string, string>>({})

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: () => api.get('/admin/payouts').then(r => r.data.data),
    refetchInterval: 30000,
  })

  const { mutate: process } = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      api.patch(`/admin/payouts/${id}`, { status, notes: note }),
    onSuccess: (_, vars) => {
      toast.success(`Payout ${vars.status.toLowerCase()}`)
      qc.invalidateQueries({ queryKey: ['admin-payouts'] })
    },
    onError: () => toast.error('Action failed'),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  const pending   = payouts.filter((p: any) => p.status === 'PENDING')
  const processed = payouts.filter((p: any) => p.status !== 'PENDING')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign size={22} className="text-green-primary" />
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Payout Requests</h2>
          <p className="text-sm text-gray-400">{pending.length} pending · {formatPrice(pending.reduce((s: number, p: any) => s + p.amount, 0), 'ETB')} total</p>
        </div>
      </div>

      {pending.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">⏳ Pending</p>
          <div className="space-y-3">
            {pending.map((p: any) => (
              <div key={p.id} className="bg-white rounded-2xl shadow-card p-5">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-gray-900 text-lg">{formatPrice(p.amount, 'ETB')}</p>
                    <p className="text-sm text-gray-600 font-semibold">{p.seller?.storeName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {p.method?.replace(/_/g,' ')} → {p.accountRef || p.seller?.bankAccount || p.seller?.mpesaNumber || '—'}
                    </p>
                    <p className="text-xs text-gray-400">{formatDate(p.createdAt)}</p>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <div className="flex gap-2">
                      <button
                        onClick={() => process({ id: p.id, status: 'COMPLETED', note: notes[p.id] })}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-primary rounded-xl text-sm font-bold hover:bg-green-100 transition-colors">
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button
                        onClick={() => process({ id: p.id, status: 'FAILED', note: notes[p.id] || 'Rejected by admin' })}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors">
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                    <input
                      value={notes[p.id] || ''}
                      onChange={e => setNotes(prev => ({ ...prev, [p.id]: e.target.value }))}
                      placeholder="Note (optional)..."
                      className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-green-primary"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!pending.length && (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <CheckCircle size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400">No pending payouts</p>
        </div>
      )}

      {processed.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">✅ History</p>
          <div className="space-y-2">
            {processed.slice(0, 20).map((p: any) => (
              <div key={p.id} className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900">{formatPrice(p.amount, 'ETB')}</p>
                  <p className="text-xs text-gray-400">{p.seller?.storeName} · {p.method?.replace(/_/g,' ')} · {formatDate(p.createdAt)}</p>
                  {p.notes && <p className="text-xs text-gray-500 mt-0.5">{p.notes}</p>}
                </div>
                <span className={`badge text-xs ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-500'}`}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
