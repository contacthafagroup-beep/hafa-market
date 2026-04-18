import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, AlertTriangle, CheckCircle, EyeOff, Star, RefreshCw, Package } from 'lucide-react'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

const FLAG_LABELS: Record<string, { label: string; color: string }> = {
  BURST_REVIEWS:    { label: 'Review burst',       color: 'bg-red-100 text-red-700' },
  NEW_ACCOUNT_5STAR:{ label: 'New acct + 5★',      color: 'bg-orange-100 text-orange-700' },
  DUPLICATE_COMMENT:{ label: 'Duplicate comment',  color: 'bg-yellow-100 text-yellow-700' },
  ANONYMOUS_1STAR:  { label: 'Anon 1★ no comment', color: 'bg-red-100 text-red-700' },
  NO_PURCHASE:      { label: 'No purchase',         color: 'bg-gray-100 text-gray-600' },
}

const STATUS_TABS = [
  { value: 'FLAGGED',   label: '🚩 Flagged',  color: 'text-orange-600' },
  { value: 'HIDDEN',    label: '🙈 Hidden',   color: 'text-red-600' },
  { value: 'APPROVED',  label: '✅ Approved', color: 'text-green-600' },
]

export default function ReviewModeration() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('FLAGGED')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reviews-moderation', tab, page],
    queryFn: () => api.get('/reviews/admin/flagged', { params: { status: tab, page, limit: 20 } }).then(r => r.data),
    keepPreviousData: true,
  })

  const { mutate: moderate, isLoading: moderating } = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.patch(`/reviews/admin/${id}/moderate`, { action }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-reviews-moderation'] })
      const msg = vars.action === 'APPROVE' ? 'Review approved ✅'
                : vars.action === 'HIDE'    ? 'Review hidden 🙈'
                : 'Review dismissed'
      toast.success(msg)
    },
    onError: () => toast.error('Action failed'),
  })

  const reviews = data?.data || []
  const summary = data?.summary || {}
  const pagination = data?.pagination || {}

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
          <Shield size={20} className="text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Review Trust Engine</h1>
          <p className="text-sm text-gray-400">Amazon-style fraud detection — 5 signals</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-orange-600">{summary.flagged ?? '—'}</div>
          <div className="text-xs text-orange-500 font-semibold mt-1">🚩 Flagged</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-red-600">{summary.hidden ?? '—'}</div>
          <div className="text-xs text-red-500 font-semibold mt-1">🙈 Hidden</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-green-600">{summary.approved ?? '—'}</div>
          <div className="text-xs text-green-500 font-semibold mt-1">✅ Approved</div>
        </div>
      </div>

      {/* Signal legend */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6">
        <p className="text-xs font-bold text-blue-700 mb-2">🔍 Detection Signals</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(FLAG_LABELS).map(([key, { label, color }]) => (
            <span key={key} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{label}</span>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {STATUS_TABS.map(t => (
          <button key={t.value} onClick={() => { setTab(t.value); setPage(1) }}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
              tab === t.value ? 'border-gray-800 bg-gray-800 text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Review list */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Shield size={40} className="mx-auto mb-3 opacity-30" />
          <p>No {tab.toLowerCase()} reviews</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r: any) => (
            <div key={r.id} className={`bg-white rounded-2xl border-2 p-5 ${
              r.moderationStatus === 'FLAGGED' ? 'border-orange-200' :
              r.moderationStatus === 'HIDDEN'  ? 'border-red-200 opacity-70' :
              'border-gray-100'
            }`}>
              <div className="flex items-start gap-4">
                {/* Product thumbnail */}
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  {r.product?.images?.[0]
                    ? <img src={r.product.images[0]} className="w-full h-full object-cover" alt="" />
                    : <Package size={20} className="m-auto mt-3 text-gray-300" />
                  }
                </div>

                <div className="flex-1 min-w-0">
                  {/* Product + user */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <p className="font-bold text-sm text-gray-800 truncate">{r.product?.name}</p>
                      <p className="text-xs text-gray-400">
                        by <span className="font-semibold text-gray-600">{r.user?.name}</span>
                        {' · '}{r.user?.email}
                        {' · '}account {Math.round((Date.now() - new Date(r.user?.createdAt).getTime()) / (1000*60*60*24))}d old
                      </p>
                    </div>
                    {/* Stars */}
                    <div className="flex gap-0.5 flex-shrink-0">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={13} className={s <= r.rating ? 'fill-orange-400 text-orange-400' : 'text-gray-200'} />
                      ))}
                    </div>
                  </div>

                  {/* Comment */}
                  {r.comment && (
                    <p className="text-sm text-gray-700 mb-2 leading-relaxed">{r.comment}</p>
                  )}

                  {/* Fraud flags */}
                  {r.fraudFlags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {r.fraudFlags.map((flag: string) => {
                        const meta = FLAG_LABELS[flag] || { label: flag, color: 'bg-gray-100 text-gray-600' }
                        return (
                          <span key={flag} className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${meta.color}`}>
                            <AlertTriangle size={9} /> {meta.label}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* Meta + actions */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                    <div className="flex gap-2">
                      {r.moderationStatus !== 'APPROVED' && (
                        <button
                          onClick={() => moderate({ id: r.id, action: 'APPROVE' })}
                          disabled={moderating}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold rounded-lg border border-green-200 transition-colors">
                          <CheckCircle size={12} /> Approve
                        </button>
                      )}
                      {r.moderationStatus !== 'HIDDEN' && (
                        <button
                          onClick={() => moderate({ id: r.id, action: 'HIDE' })}
                          disabled={moderating}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 transition-colors">
                          <EyeOff size={12} /> Hide
                        </button>
                      )}
                      {r.moderationStatus === 'FLAGGED' && (
                        <button
                          onClick={() => moderate({ id: r.id, action: 'DISMISS' })}
                          disabled={moderating}
                          className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-bold rounded-lg border border-gray-200 transition-colors">
                          <RefreshCw size={12} /> Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl border-2 border-gray-200 text-sm font-semibold disabled:opacity-40">← Prev</button>
          <span className="px-4 py-2 text-sm text-gray-500">{page} / {pagination.pages}</span>
          <button onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}
            className="px-4 py-2 rounded-xl border-2 border-gray-200 text-sm font-semibold disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  )
}
