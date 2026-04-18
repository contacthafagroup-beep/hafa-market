import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Plus, Send, X, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const REASONS = ['ITEM_NOT_RECEIVED','NOT_AS_DESCRIBED','DAMAGED','WRONG_ITEM','OTHER']
const STATUS_COLORS: Record<string,string> = {
  OPEN: 'bg-yellow-100 text-yellow-700',
  SELLER_RESPONDED: 'bg-blue-100 text-blue-700',
  ADMIN_REVIEW: 'bg-purple-100 text-purple-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-500',
}

export default function Disputes() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [reply, setReply] = useState('')
  const [form, setForm] = useState({ orderId:'', reason:'ITEM_NOT_RECEIVED', description:'' })

  const { data, isLoading } = useQuery({
    queryKey: ['my-disputes'],
    queryFn: () => api.get('/disputes/my').then(r => r.data.data),
  })

  const { data: orders } = useQuery({
    queryKey: ['orders-for-dispute'],
    queryFn: () => api.get('/orders?status=DELIVERED&limit=20').then(r => r.data.data),
  })

  const { mutate: openDispute, isLoading: opening } = useMutation({
    mutationFn: () => api.post('/disputes', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-disputes'] }); setShowForm(false); toast.success('Dispute opened!') },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  })

  const { mutate: sendReply, isLoading: sending } = useMutation({
    mutationFn: () => api.post(`/disputes/${selected.id}/messages`, { content: reply }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-disputes'] }); setReply(''); toast.success('Message sent') },
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold text-gray-900">My Disputes</h2>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus size={14}/> Open Dispute</Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-5 space-y-4">
          <h3 className="font-bold text-gray-900">Open a Dispute</h3>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Order *</label>
            <select value={form.orderId} onChange={e => setForm(f => ({...f, orderId: e.target.value}))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
              <option value="">Select order...</option>
              {orders?.map((o: any) => <option key={o.id} value={o.id}>#{o.id.slice(-8).toUpperCase()} — {formatDate(o.createdAt)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Reason *</label>
            <select value={form.reason} onChange={e => setForm(f => ({...f, reason: e.target.value}))}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
              {REASONS.map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description *</label>
            <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} rows={4}
              placeholder="Describe the issue in detail..."
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none" />
          </div>
          <div className="flex gap-3">
            <Button onClick={() => openDispute()} loading={opening} disabled={!form.orderId || !form.description}>Submit Dispute</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {!data?.length && !showForm ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <CheckCircle size={40} className="mx-auto text-gray-200 mb-3"/>
          <p className="text-gray-400">No disputes. All your orders are going well!</p>
        </div>
      ) : data?.map((d: any) => (
        <div key={d.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setSelected(selected?.id === d.id ? null : d)}>
            <AlertTriangle size={18} className="text-amber-500 flex-shrink-0"/>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">Order #{d.orderId.slice(-8).toUpperCase()}</span>
                <span className={`badge text-xs ${STATUS_COLORS[d.status]}`}>{d.status.replace(/_/g,' ')}</span>
              </div>
              <p className="text-xs text-gray-400">{d.reason.replace(/_/g,' ')} · {formatDate(d.createdAt)}</p>
            </div>
          </div>
          {selected?.id === d.id && (
            <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {d.messages?.map((m: any) => (
                  <div key={m.id} className={`flex ${m.role === 'BUYER' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${m.role === 'BUYER' ? 'bg-green-primary text-white' : m.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-white shadow-sm text-gray-800'}`}>
                      <p className="text-xs font-bold mb-1 opacity-70">{m.role}</p>
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
              {d.status !== 'RESOLVED' && d.status !== 'CLOSED' && (
                <div className="flex gap-2">
                  <input value={reply} onChange={e => setReply(e.target.value)} placeholder="Reply..."
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary"/>
                  <Button size="sm" loading={sending} onClick={() => sendReply()} disabled={!reply.trim()}>
                    <Send size={13}/>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
