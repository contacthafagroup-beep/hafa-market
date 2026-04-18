import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText, Plus, Download, CheckCircle, Clock, XCircle, Building2 } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatDate, formatPrice } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  DRAFT:     { color: 'bg-gray-100 text-gray-600',    label: 'Draft' },
  SUBMITTED: { color: 'bg-blue-100 text-blue-700',    label: 'Submitted' },
  APPROVED:  { color: 'bg-green-100 text-green-700',  label: 'Approved' },
  REJECTED:  { color: 'bg-red-100 text-red-700',      label: 'Rejected' },
  FULFILLED: { color: 'bg-purple-100 text-purple-700',label: 'Fulfilled' },
}

function printPO(po: any, user: any) {
  const win = window.open('', '_blank')
  if (!win) return
  const items = (po.items || []).map((item: any) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6">${item.product}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:center">${item.quantity} ${item.unit}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right">ETB ${parseFloat(item.unitPrice || 0).toFixed(2)}</td>
      <td style="padding:8px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700">ETB ${(parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0)).toFixed(2)}</td>
    </tr>
  `).join('')

  win.document.write(`
    <!DOCTYPE html><html><head><title>PO #${po.poNumber}</title>
    <style>
      body{font-family:'Segoe UI',sans-serif;max-width:700px;margin:40px auto;color:#1f2937}
      .header{display:flex;justify-content:space-between;margin-bottom:32px}
      .logo{font-size:1.5rem;font-weight:900;color:#2E7D32}
      table{width:100%;border-collapse:collapse;margin:24px 0}
      th{background:#f9fafb;padding:10px 8px;text-align:left;font-size:.8rem;color:#6b7280;text-transform:uppercase}
      .total td{padding:12px 8px;font-weight:700;font-size:1.1rem;border-top:2px solid #2E7D32;color:#2E7D32}
      .box{background:#f9fafb;border-radius:12px;padding:16px;margin:8px 0}
      @media print{body{margin:20px}}
    </style></head><body>
    <div class="header">
      <div><div class="logo">🌿 Hafa Market</div><div style="color:#6b7280;font-size:.85rem">Purchase Order</div></div>
      <div style="text-align:right">
        <div style="font-size:1.3rem;font-weight:900">PO #${po.poNumber}</div>
        <div style="color:#6b7280;font-size:.85rem">${new Date(po.createdAt).toLocaleDateString()}</div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d;padding:4px 12px;border-radius:50px;font-size:.8rem;font-weight:700;display:inline-block;margin-top:8px">${po.status}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:24px 0">
      <div class="box"><h4 style="font-size:.75rem;color:#9ca3af;text-transform:uppercase;margin:0 0 8px">Bill From</h4>
        <div style="font-weight:700">${user?.name || 'Buyer'}</div>
        <div style="color:#6b7280;font-size:.85rem">${user?.email || ''}</div>
        <div style="color:#6b7280;font-size:.85rem">${po.orgName || ''}</div>
      </div>
      <div class="box"><h4 style="font-size:.75rem;color:#9ca3af;text-transform:uppercase;margin:0 0 8px">Payment Terms</h4>
        <div style="font-weight:700">${po.paymentTerms || 'Net-30'}</div>
        <div style="color:#6b7280;font-size:.85rem">Due: ${po.dueDate ? new Date(po.dueDate).toLocaleDateString() : 'TBD'}</div>
      </div>
    </div>
    <table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit Price</th><th style="text-align:right">Total</th></tr></thead>
    <tbody>${items}
      <tr class="total"><td colspan="3" style="text-align:right">Total</td><td style="text-align:right">ETB ${parseFloat(po.totalAmount || 0).toFixed(2)}</td></tr>
    </tbody></table>
    <div style="text-align:center;color:#9ca3af;font-size:.8rem;margin-top:40px;padding-top:20px;border-top:1px solid #f3f4f6">
      <p>Hafa Market · hafamarket.com · hello@hafamarket.com</p>
    </div>
    <script>window.onload=()=>{window.print()}</script>
    </body></html>
  `)
  win.document.close()
}

export default function PurchaseOrders() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [showForm, setShowForm] = useState(false)
  const [items, setItems] = useState([{ product: '', quantity: '', unit: 'kg', unitPrice: '' }])
  const [form, setForm] = useState({ orgName: '', paymentTerms: 'NET_30', dueDate: '', notes: '' })

  const { data: pos = [], isLoading } = useQuery({
    queryKey: ['my-purchase-orders'],
    queryFn: () => api.get('/bulk-orders/my').then(r =>
      (r.data.data || []).filter((o: any) => o.paymentMethod === 'INVOICE' || o.rfqMode)
    ),
  })

  const { mutate: createPO, isPending: creating } = useMutation({
    mutationFn: () => api.post('/bulk-orders', {
      orgName: form.orgName || user?.name || 'Purchase Order',
      orgType: 'OTHER',
      city: 'Hossana',
      contactName: user?.name || '',
      phone: user?.phone || '',
      email: user?.email || '',
      items: items.filter(i => i.product && i.quantity).map(i => ({
        product: i.product,
        quantity: parseFloat(i.quantity),
        unit: i.unit,
        unitPrice: parseFloat(i.unitPrice) || 0,
      })),
      notes: form.notes,
      paymentMethod: 'INVOICE',
      isRecurring: false,
      language: 'en',
      userId: user?.id,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-purchase-orders'] })
      toast.success('Purchase Order created!')
      setShowForm(false)
      setItems([{ product: '', quantity: '', unit: 'kg', unitPrice: '' }])
      setForm({ orgName: '', paymentTerms: 'NET_30', dueDate: '', notes: '' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  })

  const addItem = () => setItems(p => [...p, { product: '', quantity: '', unit: 'kg', unitPrice: '' }])
  const setItem = (i: number, k: string, v: string) =>
    setItems(p => p.map((item, idx) => idx === i ? { ...item, [k]: v } : item))

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-green-primary" /> Purchase Orders
          </h1>
          <p className="text-gray-400 text-sm mt-1">Create and manage formal purchase orders for your business</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} /> New PO
        </Button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-6 mb-6">
          <h3 className="font-extrabold text-gray-900 mb-5">📄 New Purchase Order</h3>
          <div className="grid sm:grid-cols-2 gap-4 mb-5">
            <Input label="Organization Name" placeholder="Your company/restaurant name"
              value={form.orgName} onChange={(e: any) => setForm(f => ({ ...f, orgName: e.target.value }))} />
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Payment Terms</label>
              <select value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
                <option value="NET_7">Net-7 (7 days)</option>
                <option value="NET_15">Net-15 (15 days)</option>
                <option value="NET_30">Net-30 (30 days)</option>
                <option value="NET_60">Net-60 (60 days)</option>
                <option value="IMMEDIATE">Immediate Payment</option>
              </select>
            </div>
            <Input label="Due Date" type="date"
              value={form.dueDate} onChange={(e: any) => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            <Input label="Notes" placeholder="Special terms or conditions"
              value={form.notes} onChange={(e: any) => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div className="space-y-3 mb-4">
            <p className="text-sm font-bold text-gray-700">Line Items</p>
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-4 gap-3 bg-gray-50 rounded-xl p-3">
                <input value={item.product} onChange={e => setItem(i, 'product', e.target.value)}
                  placeholder="Product *" className="col-span-2 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" />
                <input type="number" value={item.quantity} onChange={e => setItem(i, 'quantity', e.target.value)}
                  placeholder="Qty" className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" />
                <input type="number" value={item.unitPrice} onChange={e => setItem(i, 'unitPrice', e.target.value)}
                  placeholder="Unit Price (ETB)" className="border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" />
              </div>
            ))}
            <button onClick={addItem}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm font-semibold text-gray-500 hover:border-green-primary hover:text-green-primary transition-colors">
              <Plus size={15} /> Add Line Item
            </button>
          </div>

          <div className="flex gap-3">
            <Button loading={creating} disabled={!items.some(i => i.product && i.quantity)} onClick={() => createPO()}>
              <FileText size={15} /> Create PO
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {!pos.length && !showForm ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p>No purchase orders yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pos.map((po: any) => {
            const status = po.status === 'CONFIRMED' ? 'APPROVED' :
                          po.status === 'DELIVERED' ? 'FULFILLED' :
                          po.status === 'CANCELLED' ? 'REJECTED' :
                          po.status === 'PENDING' ? 'SUBMITTED' : 'DRAFT'
            const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT
            const total = (po.items as any[])?.reduce((s: number, i: any) =>
              s + (parseFloat(i.quantity || 0) * parseFloat(i.unitPrice || 0)), 0) || po.quotedPrice || 0

            return (
              <div key={po.id} className="bg-white rounded-2xl shadow-card p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                  <FileText size={20} className="text-green-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-bold text-gray-900">PO #{po.id.slice(-8).toUpperCase()}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.color}`}>{config.label}</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {(po.items as any[])?.length || 0} items · {formatDate(po.createdAt)}
                    {total > 0 && ` · ${formatPrice(total)}`}
                  </p>
                  {po.orgName && <p className="text-xs text-gray-500">{po.orgName}</p>}
                </div>
                <button onClick={() => printPO({ ...po, poNumber: po.id.slice(-8).toUpperCase(), totalAmount: total }, user)}
                  className="flex items-center gap-1.5 px-3 py-2 border-2 border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-green-primary transition-all flex-shrink-0">
                  <Download size={13} /> Print PO
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
