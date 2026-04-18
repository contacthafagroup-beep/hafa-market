import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Star, Package, TrendingUp, MessageSquare, Phone, Search, ChevronDown, ChevronUp } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatDate, formatPrice } from '@/lib/utils'

interface BuyerProfile {
  id: string
  name: string
  phone?: string
  email?: string
  totalOrders: number
  totalSpent: number
  lastOrderDate: string
  avgOrderValue: number
  segment: 'VIP' | 'Regular' | 'New' | 'At Risk'
  notes?: string
}

function getSegment(totalOrders: number, totalSpent: number, daysSinceLastOrder: number): BuyerProfile['segment'] {
  if (totalSpent >= 5000 || totalOrders >= 10) return 'VIP'
  if (daysSinceLastOrder > 60) return 'At Risk'
  if (totalOrders <= 1) return 'New'
  return 'Regular'
}

const SEGMENT_CONFIG = {
  VIP:      { color: 'bg-yellow-100 text-yellow-700', emoji: '⭐' },
  Regular:  { color: 'bg-green-100 text-green-700',  emoji: '✅' },
  New:      { color: 'bg-blue-100 text-blue-700',    emoji: '🆕' },
  'At Risk':{ color: 'bg-red-100 text-red-700',      emoji: '⚠️' },
}

export default function BuyerCRM() {
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState<string>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['crm-orders'],
    queryFn: () => api.get('/sellers/me/orders?limit=200').then(r => r.data.data || []),
    staleTime: 1000 * 60 * 5,
  })

  // Build buyer profiles from orders
  const buyerMap: Record<string, any> = {}
  orders.forEach((order: any) => {
    const userId = order.userId || order.user?.id
    if (!userId) return
    if (!buyerMap[userId]) {
      buyerMap[userId] = {
        id: userId,
        name: order.user?.name || 'Unknown',
        phone: order.user?.phone || order.address?.phone,
        email: order.user?.email,
        orders: [],
        totalSpent: 0,
      }
    }
    buyerMap[userId].orders.push(order)
    buyerMap[userId].totalSpent += order.total || 0
  })

  const buyers: BuyerProfile[] = Object.values(buyerMap).map((b: any) => {
    const sortedOrders = b.orders.sort((a: any, c: any) => new Date(c.createdAt).getTime() - new Date(a.createdAt).getTime())
    const lastOrderDate = sortedOrders[0]?.createdAt
    const daysSince = lastOrderDate ? Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / 86400000) : 999
    return {
      id: b.id,
      name: b.name,
      phone: b.phone,
      email: b.email,
      totalOrders: b.orders.length,
      totalSpent: b.totalSpent,
      lastOrderDate,
      avgOrderValue: b.totalSpent / b.orders.length,
      segment: getSegment(b.orders.length, b.totalSpent, daysSince),
      notes: notes[b.id] || '',
    }
  }).sort((a, b) => b.totalSpent - a.totalSpent)

  const filtered = buyers.filter(b => {
    const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.phone?.includes(search) || b.email?.toLowerCase().includes(search.toLowerCase())
    const matchSegment = segment === 'all' || b.segment === segment
    return matchSearch && matchSegment
  })

  const stats = {
    total: buyers.length,
    vip: buyers.filter(b => b.segment === 'VIP').length,
    atRisk: buyers.filter(b => b.segment === 'At Risk').length,
    totalRevenue: buyers.reduce((s, b) => s + b.totalSpent, 0),
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <Users size={20} className="text-green-primary" /> Buyer CRM
        </h2>
        <p className="text-sm text-gray-400">Track and manage your customer relationships</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Buyers', value: stats.total, icon: <Users size={18} />, color: 'bg-blue-50 text-blue-600' },
          { label: 'VIP Customers', value: stats.vip, icon: <Star size={18} />, color: 'bg-yellow-50 text-yellow-600' },
          { label: 'At Risk', value: stats.atRisk, icon: <TrendingUp size={18} />, color: 'bg-red-50 text-red-500' },
          { label: 'Total Revenue', value: formatPrice(stats.totalRevenue), icon: <Package size={18} />, color: 'bg-green-50 text-green-primary' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-card p-4">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${s.color}`}>{s.icon}</div>
            <p className="text-xl font-extrabold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, email..."
            className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-green-primary" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'VIP', 'Regular', 'New', 'At Risk'].map(s => (
            <button key={s} onClick={() => setSegment(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${segment === s ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-500 border-gray-200 hover:border-green-primary'}`}>
              {s === 'all' ? 'All' : `${SEGMENT_CONFIG[s as keyof typeof SEGMENT_CONFIG]?.emoji} ${s}`}
            </button>
          ))}
        </div>
      </div>

      {/* Buyer list */}
      {!filtered.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p>No buyers found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(buyer => {
            const config = SEGMENT_CONFIG[buyer.segment]
            const isOpen = expanded === buyer.id
            return (
              <div key={buyer.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
                <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(isOpen ? null : buyer.id)}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-primary to-green-mid flex items-center justify-center text-white font-bold flex-shrink-0">
                    {buyer.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-gray-800">{buyer.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.color}`}>
                        {config.emoji} {buyer.segment}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {buyer.totalOrders} orders · {formatPrice(buyer.totalSpent)} total
                      {buyer.lastOrderDate && ` · Last: ${formatDate(buyer.lastOrderDate)}`}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm text-green-primary">{formatPrice(buyer.avgOrderValue)}</p>
                    <p className="text-[10px] text-gray-400">avg order</p>
                  </div>
                  {isOpen ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                    {/* Contact */}
                    <div className="flex items-center gap-4 flex-wrap">
                      {buyer.phone && (
                        <a href={`tel:${buyer.phone}`} className="flex items-center gap-1.5 text-sm text-green-primary font-semibold hover:underline">
                          <Phone size={14} /> {buyer.phone}
                        </a>
                      )}
                      {buyer.email && (
                        <a href={`mailto:${buyer.email}`} className="flex items-center gap-1.5 text-sm text-blue-600 font-semibold hover:underline">
                          ✉️ {buyer.email}
                        </a>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">📝 Notes</label>
                      <textarea
                        value={notes[buyer.id] || ''}
                        onChange={e => setNotes(prev => ({ ...prev, [buyer.id]: e.target.value }))}
                        placeholder="Add notes about this customer..."
                        rows={2}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-green-primary resize-none bg-white"
                      />
                    </div>

                    {/* Segment tips */}
                    {buyer.segment === 'VIP' && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-xs text-yellow-800">
                        ⭐ VIP Customer — Consider offering exclusive discounts or early access to new products
                      </div>
                    )}
                    {buyer.segment === 'At Risk' && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
                        ⚠️ At Risk — Hasn't ordered in 60+ days. Send a win-back offer via WhatsApp or Telegram
                      </div>
                    )}
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
