import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, ChevronDown, ChevronUp, Phone, Mail, RotateCcw, Search } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<string,string> = {
  PENDING:    'bg-yellow-100 text-yellow-700',
  QUOTED:     'bg-blue-100 text-blue-700',
  CONFIRMED:  'bg-purple-100 text-purple-700',
  PROCESSING: 'bg-orange-100 text-orange-700',
  DELIVERED:  'bg-green-100 text-green-700',
  CANCELLED:  'bg-red-100 text-red-700',
}

export default function AdminBulkOrders() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string|null>(null)
  const [quotePrice, setQuotePrice] = useState<Record<string,string>>({})
  const [adminNotes, setAdminNotes] = useState<Record<string,string>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['admin-bulk-orders', statusFilter],
    queryFn: () => api.get('/bulk-orders', {
      params: statusFilter !== 'ALL' ? { status: statusFilter } : {},
    }).then(r => r.data.data),
    refetchInterval: 30000,
  })

  const { mutate: update } = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) =>
      api.patch(`/bulk-orders/${id}`, payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-bulk-orders'] }); toast.success('Updated!') },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed'),
  })

  const orders = (data || []).filter((o: any) =>
    !search || o.orgName?.toLowerCase().includes(search.toLowerCase()) ||
    o.contactName?.toLowerCase().includes(search.toLowerCase()) ||
    o.city?.toLowerCase().includes(search.toLowerCase())
  )

  const counts: Record<string,number> = { ALL: data?.length || 0 }
  ;(data || []).forEach((o: any) => { counts[o.status] = (counts[o.status] || 0) + 1 })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Bulk Orders</h2>
          <p className="text-sm text-gray-400">{orders.length} requests</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by org, contact, city..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-primary"/>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['ALL','PENDING','QUOTED','CONFIRMED','DELIVERED'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${statusFilter===s ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-500 border-gray-200'}`}>
              {s} {counts[s] ? <span className="opacity-60">({counts[s]})</span> : ''}
            </button>
          ))}
        </div>
      </div>

      {/* Pending alert */}
      {counts.PENDING > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-amber-500 text-lg">⏳</span>
          <p className="text-sm text-amber-800 font-medium">
            <strong>{counts.PENDING}</strong> bulk order{counts.PENDING > 1 ? 's' : ''} waiting for a quote
          </p>
          <button onClick={() => setStatusFilter('PENDING')} className="ml-auto text-xs font-bold text-amber-700 underline">
            Review now
          </button>
        </div>
      )}

      {/* Orders */}
      {!orders.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <Package size={40} className="mx-auto text-gray-200 mb-3"/>
          <p className="text-gray-400">No bulk orders found</p>
        </div>
      ) : orders.map((o: any) => (
        <div key={o.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
          {/* Header row */}
          <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(expanded===o.id ? null : o.id)}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="font-extrabold text-gray-900">{o.orgName}</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{o.orgType}</span>
                <span className={`badge text-xs ${STATUS_COLORS[o.status] || 'bg-gray-100 text-gray-600'}`}>{o.status}</span>
                {o.isRecurring && <span className="badge text-xs bg-purple-100 text-purple-700">🔄 {o.recurringFreq}</span>}
              </div>
              <p className="text-xs text-gray-400">{o.contactName} · {o.phone} · {o.city} · {formatDate(o.createdAt)}</p>
            </div>
            <div className="text-right flex-shrink-0">
              {o.quotedPrice && <p className="font-extrabold text-green-primary">ETB {o.quotedPrice.toFixed(2)}</p>}
              <p className="text-xs text-gray-400">{(o.items as any[]).length} items</p>
            </div>
            {expanded===o.id ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0"/> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0"/>}
          </div>

          {/* Expanded */}
          {expanded === o.id && (
            <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-4">
              {/* Items */}
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Items Requested</p>
                <div className="space-y-1.5">
                  {(o.items as any[]).map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 bg-white rounded-xl p-2.5">
                      <Package size={14} className="text-green-primary flex-shrink-0"/>
                      <span className="flex-1 text-sm font-medium text-gray-800">{item.product}</span>
                      <span className="text-sm text-gray-500 flex-shrink-0">{item.quantity} {item.unit}</span>
                      {item.notes && <span className="text-xs text-gray-400 italic">{item.notes}</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Contact */}
              <div className="flex gap-3 flex-wrap">
                <a href={`tel:${o.phone}`} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-primary rounded-xl text-sm font-bold hover:bg-green-100 transition-colors">
                  <Phone size={14}/> {o.phone}
                </a>
                {o.email && (
                  <a href={`mailto:${o.email}`} className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-100 transition-colors">
                    <Mail size={14}/> {o.email}
                  </a>
                )}
              </div>

              {/* Notes */}
              {o.notes && (
                <div className="bg-amber-50 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-700 mb-1">Customer Notes</p>
                  <p className="text-sm text-amber-800">{o.notes}</p>
                </div>
              )}

              {/* Admin actions */}
              <div className="bg-white rounded-xl p-4 space-y-3 border border-gray-100">
                <p className="text-sm font-bold text-gray-700">Send Quote / Update Status</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Quoted Price (ETB)</label>
                    <input type="number" value={quotePrice[o.id]||''} onChange={e => setQuotePrice(p => ({...p,[o.id]:e.target.value}))}
                      placeholder="e.g. 5000"
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Admin Notes</label>
                    <input value={adminNotes[o.id]||''} onChange={e => setAdminNotes(p => ({...p,[o.id]:e.target.value}))}
                      placeholder="Notes to customer..."
                      className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary"/>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {quotePrice[o.id] && (
                    <Button size="sm" onClick={() => update({ id:o.id, payload:{ status:'QUOTED', quotedPrice:quotePrice[o.id], adminNotes:adminNotes[o.id] } })}>
                      💰 Send Quote
                    </Button>
                  )}
                  {['CONFIRMED','PROCESSING','DELIVERED','CANCELLED'].map(s => (
                    <button key={s} onClick={() => update({ id:o.id, payload:{ status:s } })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${STATUS_COLORS[s] || 'border-gray-200 text-gray-600'} border-current hover:opacity-80`}>
                      → {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
