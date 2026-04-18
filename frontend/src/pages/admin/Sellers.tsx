import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, ChevronDown, ChevronUp, Package, ShoppingBag, BarChart2, Edit2, X, Search, ShieldCheck } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatDate, formatPrice, getOrderStatusColor } from '@/lib/utils'
import toast from 'react-hot-toast'

type Tab = 'overview' | 'products' | 'orders' | 'analytics'

function SellerDetail({ seller, onClose }: { seller: any; onClose: () => void }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('overview')
  const [editMode, setEditMode] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [showSuspendForm, setShowSuspendForm] = useState(false)

  const { data: products } = useQuery({
    queryKey: ['admin-seller-products', seller.id],
    queryFn: () => api.get(`/admin/orders?sellerId=${seller.id}&limit=1`).then(() =>
      // Use the seller's store slug to get their products via public endpoint
      api.get(`/sellers/${seller.storeSlug || seller.id}`).then(r => r.data.data?.products || [])
    ).catch(() => []),
    enabled: tab === 'products',
  })

  const { data: orders } = useQuery({
    queryKey: ['admin-seller-orders', seller.id],
    queryFn: () => api.get(`/admin/orders?sellerId=${seller.id}&limit=20`).then(r => r.data.data).catch(() => []),
    enabled: tab === 'orders',
  })

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) =>
      api.patch(`/admin/sellers/${seller.id}/status`, { status, reason }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-sellers'] })
      toast.success(`Seller ${vars.status.toLowerCase()}`)
      setShowSuspendForm(false)
      onClose()
    },
  })

  const { mutate: moderateProduct } = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) =>
      api.patch(`/admin/products/${id}/moderate`, { action }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-seller-products', seller.id] }); toast.success('Product moderated') },
  })

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key:'overview',  label:'Overview',  icon:<BarChart2 size={14}/> },
    { key:'products',  label:'Products',  icon:<Package size={14}/> },
    { key:'orders',    label:'Orders',    icon:<ShoppingBag size={14}/> },
  ]

  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:'20px', width:'100%', maxWidth:'720px', maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1b5e20,#2E7D32)', padding:'20px 24px', display:'flex', alignItems:'center', gap:'12px', flexShrink:0 }}>
          <div style={{ width:'48px', height:'48px', borderRadius:'12px', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:'1.3rem' }}>
            {seller.storeName?.[0]}
          </div>
          <div style={{ flex:1 }}>
            <p style={{ color:'#fff', fontWeight:800, fontSize:'1.1rem', margin:0 }}>{seller.storeName}</p>
            <p style={{ color:'rgba(255,255,255,.7)', fontSize:'.78rem', margin:0 }}>{seller.user?.name} · {seller.city || 'Hossana'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full ${
              seller.status === 'VERIFIED' ? 'bg-green-400/30 text-white' :
              seller.status === 'PENDING'  ? 'bg-yellow-400/30 text-white' :
              'bg-red-400/30 text-white'
            }`}>{seller.status}</span>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,.15)', border:'none', borderRadius:'50%', width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
              <X size={16}/>
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ padding:'12px 24px', borderBottom:'1px solid #f3f4f6', display:'flex', gap:'8px', flexWrap:'wrap', flexShrink:0 }}>
          {seller.status !== 'VERIFIED' && (
            <button onClick={() => updateStatus({ status:'VERIFIED' })}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-primary rounded-xl text-sm font-bold hover:bg-green-100 transition-colors">
              <CheckCircle size={14}/> Verify Seller
            </button>
          )}
          {seller.status !== 'SUSPENDED' && (
            <button onClick={() => setShowSuspendForm(!showSuspendForm)}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-500 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors">
              <XCircle size={14}/> Suspend
            </button>
          )}
          {seller.status === 'SUSPENDED' && (
            <button onClick={() => updateStatus({ status:'PENDING' })}
              className="flex items-center gap-1.5 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-xl text-sm font-bold hover:bg-yellow-100 transition-colors">
              Reinstate
            </button>
          )}
        </div>

        {/* Suspend reason form */}
        {showSuspendForm && (
          <div style={{ padding:'12px 24px', background:'#fef2f2', borderBottom:'1px solid #fecaca', flexShrink:0 }}>
            <div className="flex gap-3">
              <input value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
                placeholder="Reason for suspension (optional)..."
                className="flex-1 border border-red-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
              <button onClick={() => updateStatus({ status:'SUSPENDED', reason: suspendReason })}
                className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors">
                Confirm Suspend
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', gap:'4px', padding:'12px 24px 0', borderBottom:'1px solid #f3f4f6', flexShrink:0 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-sm font-semibold transition-all ${tab===t.key ? 'bg-green-primary text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

          {tab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label:'Rating',       value:`${(seller.rating||0).toFixed(1)} ★` },
                  { label:'Total Sales',  value: seller.totalSales||0 },
                  { label:'Revenue',      value: formatPrice(seller.totalRevenue||0) },
                  { label:'Joined',       value: formatDate(seller.createdAt) },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                    <p className="font-extrabold text-gray-900 text-sm">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Email</span><span className="font-medium">{seller.email || seller.user?.email || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Phone</span><span className="font-medium">{seller.phone || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">City</span><span className="font-medium">{seller.city || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Bank</span><span className="font-medium">{seller.bankName || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Account</span><span className="font-medium">{seller.bankAccount || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Telebirr</span><span className="font-medium">{seller.telebirrNumber || '—'}</span></div>
              </div>
              {seller.description && (
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-xs font-bold text-gray-500 mb-1">Store Description</p>
                  <p className="text-sm text-gray-700">{seller.description}</p>
                </div>
              )}
              {/* KYC status */}
              {seller.kyc && (
                <div className={`rounded-xl p-4 flex items-center gap-3 ${
                  seller.kyc.status === 'APPROVED' ? 'bg-green-50 border border-green-200' :
                  seller.kyc.status === 'PENDING'  ? 'bg-amber-50 border border-amber-200' :
                  'bg-red-50 border border-red-200'
                }`}>
                  <ShieldCheck size={18} className={
                    seller.kyc.status === 'APPROVED' ? 'text-green-primary' :
                    seller.kyc.status === 'PENDING'  ? 'text-amber-600' : 'text-red-500'
                  } />
                  <div>
                    <p className="text-sm font-bold text-gray-800">KYC: {seller.kyc.status}</p>
                    <p className="text-xs text-gray-500">{seller.kyc.fullName} · ID: {seller.kyc.nationalIdNo}</p>
                    {seller.kyc.rejectionReason && <p className="text-xs text-red-600 mt-0.5">Reason: {seller.kyc.rejectionReason}</p>}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'products' && (
            <div className="space-y-3">
              {!products?.length ? (
                <p className="text-gray-400 text-sm text-center py-8">No products</p>
              ) : products.map((p: any) => (
                <div key={p.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover rounded-lg" alt="" /> : '🛒'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{formatPrice(p.price)} · Stock: {p.stock}</p>
                  </div>
                  <span className={`badge text-xs flex-shrink-0 ${
                    p.status==='ACTIVE' ? 'bg-green-100 text-green-700' :
                    p.status==='PENDING_REVIEW' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{p.status?.replace(/_/g,' ')}</span>
                  {p.status === 'PENDING_REVIEW' && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => moderateProduct({ id:p.id, action:'approve' })}
                        className="p-1.5 bg-green-50 text-green-primary rounded-lg hover:bg-green-100 text-xs font-bold">✓</button>
                      <button onClick={() => moderateProduct({ id:p.id, action:'reject' })}
                        className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 text-xs font-bold">✗</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'orders' && (
            <div className="space-y-3">
              {!orders?.length ? (
                <p className="text-gray-400 text-sm text-center py-8">No orders</p>
              ) : orders.map((o: any) => (
                <div key={o.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-800">#{o.id.slice(-8).toUpperCase()}</p>
                    <p className="text-xs text-gray-400">{o.user?.name} · {formatDate(o.createdAt)}</p>
                  </div>
                  <span className={`badge text-xs ${getOrderStatusColor(o.status)}`}>{o.status.replace(/_/g,' ')}</span>
                  <span className="font-bold text-sm text-green-primary flex-shrink-0">{formatPrice(o.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminSellers() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-sellers', search, statusFilter],
    queryFn: async () => {
      const [sellersRes, kycsRes] = await Promise.all([
        api.get('/admin/sellers', {
          params: { ...(search && { search }), ...(statusFilter !== 'ALL' && { status: statusFilter }) }
        }),
        api.get('/kyc').catch(() => ({ data: { data: [] } })),
      ])
      const sellers = sellersRes.data.data || []
      const kycs: any[] = kycsRes.data.data || []
      // Attach KYC status to each seller
      return sellers.map((s: any) => ({
        ...s,
        kyc: kycs.find((k: any) => k.sellerId === s.id) || null,
      }))
    },
  })

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/sellers/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-sellers'] }); toast.success('Seller status updated') },
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  const sellers = data || []
  const counts = {
    ALL: sellers.length,
    PENDING: sellers.filter((s: any) => s.status === 'PENDING').length,
    VERIFIED: sellers.filter((s: any) => s.status === 'VERIFIED').length,
    SUSPENDED: sellers.filter((s: any) => s.status === 'SUSPENDED').length,
  }

  return (
    <>
      {selected && <SellerDetail seller={selected} onClose={() => setSelected(null)} />}

      <div className="space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search sellers by name..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-primary" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(['ALL','PENDING','VERIFIED','SUSPENDED'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                  statusFilter===s ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-500 border-gray-200'
                }`}>
                {s} <span className="opacity-60">({counts[s]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Pending alert */}
        {counts.PENDING > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <span className="text-amber-500 text-lg">⏳</span>
            <p className="text-sm text-amber-800 font-medium">
              <strong>{counts.PENDING}</strong> seller{counts.PENDING > 1 ? 's' : ''} waiting for verification
            </p>
            <button onClick={() => setStatusFilter('PENDING')} className="ml-auto text-xs font-bold text-amber-700 underline">Review now</button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['Store','Owner','City','Rating','Sales','Status','KYC','Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sellers.map((s: any) => (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelected(s)}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-primary to-green-mid flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {s.storeName?.[0]}
                        </div>
                        <span className="font-bold text-gray-900">{s.storeName}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600">{s.user?.name}</td>
                    <td className="py-3 px-4 text-gray-400">{s.city || '—'}</td>
                    <td className="py-3 px-4 text-gray-600">{(s.rating||0).toFixed(1)} ★</td>
                    <td className="py-3 px-4 text-gray-600">{s.totalSales||0}</td>
                    <td className="py-3 px-4">
                      <span className={`badge text-xs ${
                        s.status==='VERIFIED'  ? 'bg-green-100 text-green-700' :
                        s.status==='PENDING'   ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {s.kyc ? (
                        <span className={`badge text-xs flex items-center gap-1 w-fit ${
                          s.kyc.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                          s.kyc.status === 'PENDING'  ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-600'
                        }`}>
                          <ShieldCheck size={10} />
                          {s.kyc.status === 'APPROVED' ? 'Verified' : s.kyc.status === 'PENDING' ? 'Pending' : 'Rejected'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {s.status !== 'VERIFIED' && (
                          <button onClick={() => updateStatus({ id:s.id, status:'VERIFIED' })}
                            className="p-1.5 bg-green-50 text-green-primary rounded-lg hover:bg-green-100 transition-colors" title="Verify">
                            <CheckCircle size={14}/>
                          </button>
                        )}
                        {s.status !== 'SUSPENDED' && (
                          <button onClick={() => updateStatus({ id:s.id, status:'SUSPENDED' })}
                            className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors" title="Suspend">
                            <XCircle size={14}/>
                          </button>
                        )}
                        <button onClick={() => setSelected(s)}
                          className="p-1.5 bg-blue-50 text-blue-500 rounded-lg hover:bg-blue-100 transition-colors" title="View details">
                          <BarChart2 size={14}/>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!sellers.length && <div className="p-12 text-center text-gray-400">No sellers found</div>}
        </div>
      </div>
    </>
  )
}
