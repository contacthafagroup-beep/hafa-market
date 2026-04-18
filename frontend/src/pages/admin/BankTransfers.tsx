import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatPrice, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function AdminBankTransfers() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-bank-transfers'],
    queryFn:  () => api.get('/bank-transfers/pending').then(r => r.data.data),
  })

  const { mutate: verify } = useMutation({
    mutationFn: ({ referenceCode, action }: { referenceCode: string; action: string }) =>
      api.post('/bank-transfers/verify', { referenceCode, action }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-bank-transfers'] }); toast.success('Transfer processed') },
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      <h2 className="font-extrabold text-gray-900">Pending Bank Transfers ({data?.length || 0})</h2>
      {!data?.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center text-gray-400">No pending transfers</div>
      ) : data.map((t: {
        id: string; referenceCode: string; bankName: string; amount: number;
        senderName?: string; proofImageUrl?: string; fraudFlags?: string[];
        autoMatchScore?: number; adminContext?: { riskLevel: string }; createdAt: string
      }) => (
        <div key={t.id} className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-bold text-gray-900">{t.referenceCode}</p>
              <p className="text-sm text-gray-500">{t.bankName} · {t.senderName || 'Unknown sender'}</p>
              <p className="text-green-primary font-bold text-lg">{formatPrice(t.amount)}</p>
              <p className="text-xs text-gray-400">{formatDate(t.createdAt)}</p>
            </div>
            <div className="text-right">
              {t.adminContext && (
                <span className={`badge text-xs ${
                  t.adminContext.riskLevel === 'LOW'  ? 'bg-green-100 text-green-700' :
                  t.adminContext.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'}`}>
                  {t.adminContext.riskLevel} RISK
                </span>
              )}
              {t.autoMatchScore !== undefined && (
                <p className="text-xs text-gray-400 mt-1">Match score: {t.autoMatchScore}%</p>
              )}
            </div>
          </div>

          {t.fraudFlags && t.fraudFlags.length > 0 && (
            <div className="flex items-center gap-2 bg-red-50 rounded-xl p-3 mb-3">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600 font-medium">⚠️ Flags: {t.fraudFlags.join(', ')}</p>
            </div>
          )}

          {t.proofImageUrl && (
            <a href={t.proofImageUrl} target="_blank" rel="noreferrer"
              className="text-xs text-green-primary underline block mb-3">
              View Receipt →
            </a>
          )}

          <div className="flex gap-2">
            <button onClick={() => verify({ referenceCode: t.referenceCode, action: 'approve' })}
              className="flex items-center gap-1 px-4 py-2 bg-green-50 text-green-primary rounded-xl text-sm font-semibold hover:bg-green-100 transition-colors">
              <CheckCircle size={15} /> Approve
            </button>
            <button onClick={() => verify({ referenceCode: t.referenceCode, action: 'reject' })}
              className="flex items-center gap-1 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors">
              <XCircle size={15} /> Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
