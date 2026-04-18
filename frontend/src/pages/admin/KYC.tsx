import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, CheckCircle, XCircle, Clock, Eye, X } from 'lucide-react'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const STATUS_BADGE: Record<string, string> = {
  PENDING:  'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
}

export default function AdminKYC() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('PENDING')
  const [selected, setSelected] = useState<any>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  const { data: kycs = [], isLoading } = useQuery({
    queryKey: ['admin-kyc', filter],
    queryFn: () => api.get(`/kyc?status=${filter}`).then(r => r.data.data),
  })

  const { mutate: decide, isLoading: deciding } = useMutation({
    mutationFn: ({ sellerId, status, rejectionReason }: any) =>
      api.patch(`/kyc/${sellerId}`, { status, rejectionReason }),
    onSuccess: (_, vars) => {
      toast.success(vars.status === 'APPROVED' ? 'KYC Approved ✅' : 'KYC Rejected')
      qc.invalidateQueries({ queryKey: ['admin-kyc'] })
      setSelected(null)
      setShowReject(false)
      setRejectReason('')
    },
    onError: () => toast.error('Action failed'),
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck size={22} className="text-green-primary" />
        <h2 className="text-xl font-extrabold text-gray-900">KYC Verification Queue</h2>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {['PENDING', 'APPROVED', 'REJECTED'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${filter === s ? 'bg-green-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-green-primary'}`}>
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : kycs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p>No {filter.toLowerCase()} submissions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {kycs.map((kyc: any) => (
            <div key={kyc.id} className="bg-white rounded-2xl shadow-card p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-primary flex-shrink-0">
                {kyc.seller?.storeName?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">{kyc.seller?.storeName}</p>
                <p className="text-xs text-gray-500">{kyc.seller?.user?.name} · {kyc.seller?.user?.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">Submitted: {formatDate(kyc.createdAt)}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${STATUS_BADGE[kyc.status]}`}>{kyc.status}</span>
              <button onClick={() => setSelected(kyc)}
                className="flex items-center gap-1 text-sm text-green-primary font-semibold hover:underline">
                <Eye size={15} /> Review
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-extrabold text-gray-900">KYC Review</h3>
              <button onClick={() => setSelected(null)}><X size={20} className="text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Full Name</span><p className="font-bold">{selected.fullName}</p></div>
                <div><span className="text-gray-500">ID Number</span><p className="font-bold">{selected.nationalIdNo}</p></div>
                {selected.taxId && <div><span className="text-gray-500">Tax ID</span><p className="font-bold">{selected.taxId}</p></div>}
              </div>

              {/* Document images */}
              <div className="space-y-3">
                {[
                  { url: selected.nationalIdImage, label: 'National ID' },
                  { url: selected.selfieWithId,    label: 'Selfie with ID' },
                  { url: selected.businessLicense, label: 'Business License' },
                ].filter(d => d.url).map(doc => (
                  <div key={doc.label}>
                    <p className="text-xs font-semibold text-gray-500 mb-1">{doc.label}</p>
                    <a href={doc.url} target="_blank" rel="noreferrer">
                      <img src={doc.url} alt={doc.label} className="w-full rounded-xl border border-gray-200 hover:opacity-90 transition-opacity" />
                    </a>
                  </div>
                ))}
              </div>

              {selected.status === 'REJECTED' && selected.rejectionReason && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                  Rejection reason: {selected.rejectionReason}
                </div>
              )}

              {showReject && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Rejection Reason</label>
                  <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
                    placeholder="Explain why the KYC is rejected..."
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-400 resize-none" />
                </div>
              )}

              {selected.status !== 'APPROVED' && (
                <div className="flex gap-3 pt-2">
                  <Button
                    fullWidth
                    loading={deciding}
                    onClick={() => decide({ sellerId: selected.sellerId, status: 'APPROVED' })}
                    className="bg-green-primary hover:bg-green-dark"
                  >
                    <CheckCircle size={16} /> Approve
                  </Button>
                  {!showReject ? (
                    <Button fullWidth variant="outline" onClick={() => setShowReject(true)}
                      className="border-red-300 text-red-600 hover:bg-red-50">
                      <XCircle size={16} /> Reject
                    </Button>
                  ) : (
                    <Button fullWidth loading={deciding}
                      onClick={() => decide({ sellerId: selected.sellerId, status: 'REJECTED', rejectionReason: rejectReason })}
                      className="bg-red-500 hover:bg-red-600 text-white">
                      Confirm Reject
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
