/**
 * ExportNegotiation — /export/negotiation/:rfqId
 * Chat + quote thread between buyer and seller
 */
import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send, CheckCircle, X, Paperclip } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  QUOTED: 'bg-amber-100 text-amber-700',
  CONVERTED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
}

export default function ExportNegotiation() {
  const { rfqId } = useParams<{ rfqId: string }>()
  const { user } = useAuth()
  const qc = useQueryClient()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [msg, setMsg] = useState('')
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [quote, setQuote] = useState({ unitPrice: '', quantity: '', unit: 'kg', incoterms: 'FOB', leadTimeDays: '14', validDays: '7', notes: '' })

  const isSeller = user?.role === 'ADMIN' || user?.role === 'SELLER'

  const { data: rfq } = useQuery({
    queryKey: ['export-rfq', rfqId],
    queryFn: () => api.get('/export/rfq').then(r => (r.data.data || []).find((x: any) => x.id === rfqId)),
    enabled: !!rfqId && !!user,
    staleTime: 30000,
  })

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['export-messages', rfqId],
    queryFn: () => api.get(`/export/rfq/${rfqId}/messages`).then(r => r.data.data || []),
    enabled: !!rfqId && !!user,
    refetchInterval: 5000,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendQuote = useMutation({
    mutationFn: (data: any) => api.post(`/export/rfq/${rfqId}/quote`, data),
    onSuccess: () => {
      toast.success('Quote sent!')
      setQuoteOpen(false)
      qc.invalidateQueries({ queryKey: ['export-messages', rfqId] })
      qc.invalidateQueries({ queryKey: ['export-rfq', rfqId] })
    },
    onError: () => toast.error('Failed to send quote'),
  })

  const sendMsg = useMutation({
    mutationFn: (content: string) => api.post(`/export/rfq/${rfqId}/messages`, { content }),
    onSuccess: () => {
      setMsg('')
      qc.invalidateQueries({ queryKey: ['export-messages', rfqId] })
    },
    onError: () => toast.error('Failed to send message'),
  })

  const { data: quotes = [] } = useQuery({
    queryKey: ['export-quotes', rfqId],
    queryFn: () => api.get(`/export/rfq/${rfqId}/quotes`).then(r => r.data.data || []),
    enabled: !!rfqId && !!user && rfq?.status === 'QUOTED',
  })

  const acceptQuote = useMutation({
    mutationFn: (quoteId: string) => api.patch(`/export/quotes/${quoteId}/accept`),
    onSuccess: (res) => {
      toast.success(`Quote accepted! Order created. Deposit: $${res.data.data.depositAmount?.toFixed(2)}`)
      qc.invalidateQueries({ queryKey: ['export-messages', rfqId] })
      qc.invalidateQueries({ queryKey: ['export-rfq', rfqId] })
      qc.invalidateQueries({ queryKey: ['export-quotes', rfqId] })
    },
    onError: () => toast.error('Failed to accept quote'),
  })
    mutationFn: (data: any) => api.post(`/export/rfq/${rfqId}/quote`, data),
    onSuccess: () => {
      toast.success('Quote sent!')
      setQuoteOpen(false)
      qc.invalidateQueries({ queryKey: ['export-messages', rfqId] })
      qc.invalidateQueries({ queryKey: ['export-rfq', rfqId] })
    },
    onError: () => toast.error('Failed to send quote'),
  })

  const acceptQuote = useMutation({
    mutationFn: (quoteId: string) => api.patch(`/export/quotes/${quoteId}/accept`),
    onSuccess: (res) => {
      toast.success(`Quote accepted! Order created. Deposit: $${res.data.data.depositAmount?.toFixed(2)}`)
      qc.invalidateQueries({ queryKey: ['export-messages', rfqId] })
    },
    onError: () => toast.error('Failed to accept quote'),
  })

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!msg.trim()) return
    sendMsg.mutate(msg.trim())
  }

  const handleQuoteSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!quote.unitPrice || !quote.quantity) { toast.error('Price and quantity required'); return }
    sendQuote.mutate({
      unitPrice: parseFloat(quote.unitPrice),
      quantity: parseFloat(quote.quantity),
      unit: quote.unit,
      incoterms: quote.incoterms,
      leadTimeDays: parseInt(quote.leadTimeDays),
      validDays: parseInt(quote.validDays),
      notes: quote.notes,
    })
  }

  if (!user) return (
    <div className="text-center py-32">
      <p className="text-gray-500 mb-4">Please log in to view this negotiation</p>
      <Link to="/login" className="bg-green-primary text-white px-6 py-2 rounded-xl font-bold">Login</Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/export/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-green-primary mb-6">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        <div className="bg-white rounded-2xl shadow-card overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-gray-900">
                {rfq?.listingTitle || 'Export Negotiation'}
              </h2>
              <div className="flex items-center gap-3 mt-1">
                {rfq?.status && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[rfq.status] || 'bg-gray-100 text-gray-600'}`}>
                    {rfq.status}
                  </span>
                )}
                {rfq && (
                  <span className="text-xs text-gray-400">
                    {rfq.quantity} {rfq.unit} · {rfq.buyerCountry}
                  </span>
                )}
              </div>
            </div>
            {isSeller && rfq?.status === 'OPEN' && (
              <button onClick={() => setQuoteOpen(o => !o)}
                className="flex items-center gap-2 bg-green-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-dark transition-colors">
                📋 Send Quote
              </button>
            )}
          </div>

          {/* Quote form (seller only) */}
          {quoteOpen && isSeller && (
            <div className="border-b border-gray-100 bg-green-50 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">Send a Quote</h3>
                <button onClick={() => setQuoteOpen(false)}><X size={16} className="text-gray-400" /></button>
              </div>
              <form onSubmit={handleQuoteSubmit} className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Unit Price (USD) *</label>
                  <input type="number" step="0.01" value={quote.unitPrice} onChange={e => setQuote(q => ({ ...q, unitPrice: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" placeholder="e.g. 4.50" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Quantity *</label>
                  <input type="number" value={quote.quantity} onChange={e => setQuote(q => ({ ...q, quantity: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" placeholder="e.g. 5000" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Unit</label>
                  <select value={quote.unit} onChange={e => setQuote(q => ({ ...q, unit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary">
                    {['kg','ton','MT','lb','bag','container'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Incoterms</label>
                  <select value={quote.incoterms} onChange={e => setQuote(q => ({ ...q, incoterms: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary">
                    {['FOB','CIF','CFR','EXW','DDP','FCA'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Lead Time (days)</label>
                  <input type="number" value={quote.leadTimeDays} onChange={e => setQuote(q => ({ ...q, leadTimeDays: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Valid for (days)</label>
                  <input type="number" value={quote.validDays} onChange={e => setQuote(q => ({ ...q, validDays: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" />
                </div>
                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Notes</label>
                  <input value={quote.notes} onChange={e => setQuote(q => ({ ...q, notes: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" placeholder="Additional terms, packaging, certifications..." />
                </div>
                <div className="sm:col-span-3 flex gap-2">
                  <button type="submit" disabled={sendQuote.isPending}
                    className="bg-green-primary text-white font-bold px-6 py-2 rounded-xl text-sm hover:bg-green-dark transition-colors disabled:opacity-60">
                    {sendQuote.isPending ? 'Sending...' : '📋 Send Quote'}
                  </button>
                  <button type="button" onClick={() => setQuoteOpen(false)}
                    className="border border-gray-200 text-gray-600 font-bold px-4 py-2 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : messages.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No messages yet. Start the conversation!</div>
            ) : (
              messages.map((m: any) => {
                const isMe = m.senderId === user?.id
                const isQuote = m.type === 'QUOTE'
                return (
                  <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <span className="text-[10px] text-gray-400 px-1">
                        {m.senderName} · {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        isQuote
                          ? 'bg-amber-50 border-2 border-amber-200 text-gray-800 w-full'
                          : isMe
                            ? 'bg-green-primary text-white'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {isQuote && <p className="text-xs font-black text-amber-600 mb-2">📋 QUOTE</p>}
                        <p className="whitespace-pre-wrap">{m.content}</p>
                        {isQuote && !isSeller && rfq?.status === 'QUOTED' && (
                          <button
                            onClick={() => {
                              const latestQuote = quotes[0]
                              if (latestQuote) {
                                acceptQuote.mutate(latestQuote.id)
                              } else {
                                toast.error('Quote not found')
                              }
                            }}
                            disabled={acceptQuote.isPending}
                            className="mt-3 w-full bg-green-primary text-white font-bold py-2 rounded-xl text-xs hover:bg-green-dark transition-colors flex items-center justify-center gap-1 disabled:opacity-60">
                            <CheckCircle size={12} /> {acceptQuote.isPending ? 'Accepting...' : 'Accept This Quote'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-100">
            <form onSubmit={handleSend} className="flex gap-2">
              <input value={msg} onChange={e => setMsg(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-primary"
                placeholder="Type a message..." />
              <button type="submit" disabled={sendMsg.isPending || !msg.trim()}
                className="bg-green-primary text-white p-2.5 rounded-xl hover:bg-green-dark transition-colors disabled:opacity-50">
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
