import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MessageSquare, Plus, Send, CheckCircle, XCircle, Clock, DollarSign, Package, ChevronDown, ChevronUp } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatDate, formatPrice } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

const UNITS = ['kg', 'g', 'piece', 'bunch', 'liter', 'bag', 'box', 'dozen', 'quintal', 'ton']

interface RFQItem { product: string; quantity: string; unit: string; targetPrice: string; notes: string }

const EMPTY_ITEM: RFQItem = { product: '', quantity: '', unit: 'kg', targetPrice: '', notes: '' }

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  PENDING:   { color: 'bg-yellow-100 text-yellow-700', label: 'Awaiting Quotes', icon: <Clock size={12} /> },
  QUOTED:    { color: 'bg-blue-100 text-blue-700',     label: 'Quote Received',  icon: <DollarSign size={12} /> },
  ACCEPTED:  { color: 'bg-green-100 text-green-700',   label: 'Accepted',        icon: <CheckCircle size={12} /> },
  REJECTED:  { color: 'bg-red-100 text-red-700',       label: 'Rejected',        icon: <XCircle size={12} /> },
  COMPLETED: { color: 'bg-gray-100 text-gray-600',     label: 'Completed',       icon: <CheckCircle size={12} /> },
}

export default function RFQWorkspace() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [items, setItems] = useState<RFQItem[]>([{ ...EMPTY_ITEM }])
  const [form, setForm] = useState({ title: '', description: '', deadline: '', budget: '' })

  const { data: rfqs = [], isLoading } = useQuery({
    queryKey: ['my-rfqs'],
    queryFn: () => api.get('/bulk-orders/my').then(r => r.data.data || []),
  })

  const { mutate: createRFQ, isPending: creating } = useMutation({
    mutationFn: () => api.post('/bulk-orders', {
      orgName: user?.name || 'RFQ Request',
      orgType: 'OTHER',
      city: 'Hossana',
      contactName: user?.name || '',
      phone: user?.phone || '',
      email: user?.email || '',
      items: items.filter(i => i.product && i.quantity).map(i => ({
        product: i.product,
        quantity: parseFloat(i.quantity),
        unit: i.unit,
        targetPrice: i.targetPrice ? parseFloat(i.targetPrice) : undefined,
        notes: i.notes,
      })),
      notes: `${form.title}\n${form.description}${form.budget ? `\nBudget: ETB ${form.budget}` : ''}`,
      deliveryDate: form.deadline || null,
      isRecurring: false,
      language: 'en',
      userId: user?.id,
      rfqMode: true,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-rfqs'] })
      toast.success('RFQ submitted! Sellers will respond within 24 hours.')
      setShowForm(false)
      setItems([{ ...EMPTY_ITEM }])
      setForm({ title: '', description: '', deadline: '', budget: '' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to submit RFQ'),
  })

  const { mutate: acceptQuote } = useMutation({
    mutationFn: (rfqId: string) => api.patch(`/bulk-orders/${rfqId}`, { status: 'CONFIRMED' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-rfqs'] }); toast.success('Quote accepted! Order confirmed.') },
  })

  const { mutate: rejectQuote } = useMutation({
    mutationFn: (rfqId: string) => api.patch(`/bulk-orders/${rfqId}`, { status: 'CANCELLED' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-rfqs'] }); toast.success('Quote rejected.') },
  })

  const addItem = () => setItems(p => [...p, { ...EMPTY_ITEM }])
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i))
  const setItem = (i: number, k: keyof RFQItem, v: string) =>
    setItems(p => p.map((item, idx) => idx === i ? { ...item, [k]: v } : item))

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <MessageSquare size={22} className="text-blue-600" /> RFQ Workspace
          </h1>
          <p className="text-gray-400 text-sm mt-1">Request for Quotation — get competitive prices from multiple sellers</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} /> New RFQ
        </Button>
      </div>

      {/* How it works */}
      {!rfqs.length && !showForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-6">
          <h3 className="font-bold text-blue-800 mb-4">💡 How RFQ Works</h3>
          <div className="grid sm:grid-cols-4 gap-4 text-center text-sm">
            {[
              { icon: '📝', step: '1', text: 'Submit your requirements & target price' },
              { icon: '📨', step: '2', text: 'Sellers receive your request and respond' },
              { icon: '💰', step: '3', text: 'Compare quotes and negotiate' },
              { icon: '✅', step: '4', text: 'Accept the best offer and order' },
            ].map(s => (
              <div key={s.step} className="bg-white rounded-xl p-3">
                <div className="text-2xl mb-1">{s.icon}</div>
                <div className="text-xs font-bold text-blue-700 mb-1">Step {s.step}</div>
                <div className="text-xs text-gray-600">{s.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create RFQ Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-6 mb-6">
          <h3 className="font-extrabold text-gray-900 mb-5">📋 New Request for Quotation</h3>

          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <Input label="RFQ Title *" placeholder="e.g. Monthly Vegetable Supply for Restaurant"
              value={form.title} onChange={(e: any) => setForm(f => ({ ...f, title: e.target.value }))} />
            <Input label="Total Budget (ETB, optional)" type="number" placeholder="e.g. 50000"
              value={form.budget} onChange={(e: any) => setForm(f => ({ ...f, budget: e.target.value }))} />
            <Input label="Response Deadline" type="date"
              value={form.deadline} onChange={(e: any) => setForm(f => ({ ...f, deadline: e.target.value }))} />
            <div className="sm:col-span-1">
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} placeholder="Quality requirements, delivery terms, special conditions..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none" />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-3 mb-4">
            <p className="text-sm font-bold text-gray-700">Items Required</p>
            {items.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="col-span-2">
                    <input value={item.product} onChange={e => setItem(i, 'product', e.target.value)}
                      placeholder="Product name *"
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" />
                  </div>
                  <input type="number" value={item.quantity} onChange={e => setItem(i, 'quantity', e.target.value)}
                    placeholder="Qty *"
                    className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" />
                  <select value={item.unit} onChange={e => setItem(i, 'unit', e.target.value)}
                    className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary bg-white">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <input type="number" value={item.targetPrice} onChange={e => setItem(i, 'targetPrice', e.target.value)}
                      placeholder="Target ETB"
                      className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" />
                    {items.length > 1 && (
                      <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 px-2">✕</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addItem}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-blue-200 rounded-xl text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
              <Plus size={15} /> Add Item
            </button>
          </div>

          <div className="flex gap-3">
            <Button loading={creating}
              disabled={!form.title || !items.some(i => i.product && i.quantity)}
              onClick={() => createRFQ()}>
              <Send size={15} /> Submit RFQ
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* RFQ List */}
      {!rfqs.length && !showForm ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center text-gray-400">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p>No RFQs yet. Create your first request to get competitive quotes.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rfqs.map((rfq: any) => {
            const status = rfq.status === 'QUOTED' ? 'QUOTED' :
                          rfq.status === 'CONFIRMED' ? 'ACCEPTED' :
                          rfq.status === 'DELIVERED' ? 'COMPLETED' :
                          rfq.status === 'CANCELLED' ? 'REJECTED' : 'PENDING'
            const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING
            const isOpen = expanded === rfq.id

            return (
              <div key={rfq.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
                <div className="p-5 flex items-start gap-4 cursor-pointer" onClick={() => setExpanded(isOpen ? null : rfq.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-gray-900">{rfq.orgName}</p>
                      <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${config.color}`}>
                        {config.icon} {config.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {(rfq.items as any[])?.length || 0} items · Submitted {formatDate(rfq.createdAt)}
                      {rfq.quotedPrice && ` · Quote: ${formatPrice(rfq.quotedPrice)}`}
                    </p>
                    {rfq.notes && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{rfq.notes}</p>}
                  </div>
                  {isOpen ? <ChevronUp size={18} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />}
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50 space-y-4">
                    {/* Items */}
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Items Requested</p>
                      <div className="space-y-2">
                        {(rfq.items as any[])?.map((item: any, i: number) => (
                          <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-3">
                            <Package size={14} className="text-gray-400 flex-shrink-0" />
                            <span className="flex-1 text-sm font-medium text-gray-800">{item.product}</span>
                            <span className="text-sm text-gray-500">{item.quantity} {item.unit}</span>
                            {item.targetPrice && <span className="text-xs font-bold text-blue-600">Target: ETB {item.targetPrice}</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quote received */}
                    {rfq.quotedPrice && (
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <p className="text-xs font-bold text-blue-700 mb-2">💰 Quote Received</p>
                        <p className="text-2xl font-extrabold text-blue-800">{formatPrice(rfq.quotedPrice)}</p>
                        {rfq.adminNotes && <p className="text-sm text-blue-700 mt-2">{rfq.adminNotes}</p>}
                        {status === 'QUOTED' && (
                          <div className="flex gap-3 mt-4">
                            <Button size="sm" onClick={() => acceptQuote(rfq.id)}>
                              <CheckCircle size={14} /> Accept Quote
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => rejectQuote(rfq.id)}>
                              <XCircle size={14} /> Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Negotiation chat */}
                    <div>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Negotiation</p>
                      <div className="flex gap-2">
                        <input value={replyText[rfq.id] || ''}
                          onChange={e => setReplyText(p => ({ ...p, [rfq.id]: e.target.value }))}
                          placeholder="Ask a question or counter-offer..."
                          className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-primary" />
                        <Button size="sm" disabled={!replyText[rfq.id]?.trim()}
                          onClick={() => {
                            toast.success('Message sent to seller!')
                            setReplyText(p => ({ ...p, [rfq.id]: '' }))
                          }}>
                          <Send size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
