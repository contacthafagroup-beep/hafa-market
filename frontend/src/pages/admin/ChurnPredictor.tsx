import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { UserX, TrendingDown, Mail, Send, Zap, AlertTriangle, Users, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatDate, formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ChurnUser {
  id: string
  name: string
  email?: string
  phone?: string
  lastOrderDate: string | null
  totalOrders: number
  totalSpent: number
  daysSinceLastOrder: number
  churnRisk: 'high' | 'medium' | 'low'
  churnScore: number
  reason: string
}

export default function ChurnPredictor() {
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  const { data: users = [], isLoading, refetch } = useQuery({
    queryKey: ['churn-prediction'],
    queryFn: async () => {
      const res = await api.get('/admin/users', { params: { limit: 100 } })
      const allUsers = res.data.data || []

      // Compute churn risk for each user
      const now = Date.now()
      return allUsers
        .filter((u: any) => u.role === 'BUYER' && u._count?.orders > 0)
        .map((u: any): ChurnUser => {
          const lastOrderDate = u.lastOrderAt || u.updatedAt
          const daysSince = lastOrderDate
            ? Math.floor((now - new Date(lastOrderDate).getTime()) / 86400000)
            : 999

          // Churn scoring algorithm
          let score = 0
          let reasons: string[] = []

          // Days since last order (most important signal)
          if (daysSince > 90) { score += 40; reasons.push('No order in 90+ days') }
          else if (daysSince > 60) { score += 25; reasons.push('No order in 60+ days') }
          else if (daysSince > 30) { score += 15; reasons.push('No order in 30+ days') }

          // Low order frequency
          const orderFreq = u._count?.orders || 0
          if (orderFreq === 1) { score += 20; reasons.push('Only 1 order ever') }
          else if (orderFreq <= 3) { score += 10; reasons.push('Low order frequency') }

          // Low loyalty points (not engaged)
          if ((u.loyaltyPoints || 0) < 50) { score += 10; reasons.push('Low engagement') }

          // Account age vs orders ratio
          const accountAgeDays = Math.floor((now - new Date(u.createdAt).getTime()) / 86400000)
          if (accountAgeDays > 60 && orderFreq < 2) { score += 15; reasons.push('Old account, few orders') }

          const churnRisk: ChurnUser['churnRisk'] =
            score >= 50 ? 'high' :
            score >= 25 ? 'medium' : 'low'

          return {
            id: u.id,
            name: u.name,
            email: u.email,
            phone: u.phone,
            lastOrderDate,
            totalOrders: orderFreq,
            totalSpent: u.totalSpent || 0,
            daysSinceLastOrder: daysSince,
            churnRisk,
            churnScore: score,
            reason: reasons.slice(0, 2).join(' · ') || 'Active customer',
          }
        })
        .sort((a: ChurnUser, b: ChurnUser) => b.churnScore - a.churnScore)
    },
    staleTime: 1000 * 60 * 10,
  })

  const filtered = users.filter((u: ChurnUser) =>
    riskFilter === 'all' || u.churnRisk === riskFilter
  )

  const highRisk = users.filter((u: ChurnUser) => u.churnRisk === 'high').length
  const medRisk = users.filter((u: ChurnUser) => u.churnRisk === 'medium').length

  const toggleSelect = (id: string) => {
    setSelectedUsers(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAll = () => {
    const ids = filtered.map((u: ChurnUser) => u.id)
    setSelectedUsers(prev => prev.length === ids.length ? [] : ids)
  }

  const sendWinback = async () => {
    if (!selectedUsers.length) { toast.error('Select users to send win-back messages'); return }
    setSending(true)
    try {
      await Promise.all(selectedUsers.map(userId =>
        api.post(`/admin/users/${userId}/notify`, {
          title: '🌿 We miss you at Hafa Market!',
          body: 'It\'s been a while! Come back and discover fresh products. Use code COMEBACK20 for 20% off your next order.',
        }).catch(() => {})
      ))
      toast.success(`Win-back notification sent to ${selectedUsers.length} users!`)
      setSelectedUsers([])
    } catch { toast.error('Failed to send messages') }
    finally { setSending(false) }
  }

  const riskConfig = {
    high:   { color: 'bg-red-100 text-red-700', bar: '#ef4444', label: '🔴 High Risk' },
    medium: { color: 'bg-orange-100 text-orange-700', bar: '#f59e0b', label: '🟡 Medium Risk' },
    low:    { color: 'bg-green-100 text-green-700', bar: '#2E7D32', label: '🟢 Low Risk' },
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <UserX size={20} className="text-red-500" /> Churn Predictor
          </h2>
          <p className="text-sm text-gray-400">Identify at-risk customers before they leave</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:border-green-primary transition-all">
            <RefreshCw size={14} /> Refresh
          </button>
          {selectedUsers.length > 0 && (
            <button onClick={sendWinback} disabled={sending}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors disabled:opacity-50">
              <Send size={14} /> {sending ? 'Sending...' : `Send Win-back (${selectedUsers.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <p className="text-2xl font-extrabold text-red-600">{highRisk}</p>
          <p className="text-xs text-red-500 mt-1">High Risk</p>
          <p className="text-[10px] text-gray-400">Likely to churn</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-center">
          <p className="text-2xl font-extrabold text-orange-600">{medRisk}</p>
          <p className="text-xs text-orange-500 mt-1">Medium Risk</p>
          <p className="text-[10px] text-gray-400">Needs attention</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-2xl font-extrabold text-green-primary">{users.length - highRisk - medRisk}</p>
          <p className="text-xs text-green-600 mt-1">Low Risk</p>
          <p className="text-[10px] text-gray-400">Engaged customers</p>
        </div>
      </div>

      {/* Win-back tip */}
      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-start gap-3">
        <Zap size={18} className="text-purple-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-purple-800 text-sm">Win-Back Strategy</p>
          <p className="text-xs text-purple-700 mt-0.5">
            Select high-risk users and send them a personalized win-back notification with a discount code.
            Studies show 20–30% of churned customers return with the right offer.
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[['all', 'All Users'], ['high', '🔴 High Risk'], ['medium', '🟡 Medium'], ['low', '🟢 Low Risk']].map(([val, label]) => (
          <button key={val} onClick={() => setRiskFilter(val as any)}
            className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${riskFilter === val ? 'bg-green-primary text-white border-green-primary' : 'bg-white border-gray-200 text-gray-600 hover:border-green-primary'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Users table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox"
                checked={selectedUsers.length === filtered.length && filtered.length > 0}
                onChange={selectAll}
                className="w-4 h-4 accent-green-primary" />
              <span className="text-sm font-semibold text-gray-700">Select all ({filtered.length})</span>
            </label>
          </div>
          {selectedUsers.length > 0 && (
            <span className="text-xs font-bold text-purple-600">{selectedUsers.length} selected</span>
          )}
        </div>
        <div className="divide-y divide-gray-50">
          {filtered.map((u: ChurnUser) => {
            const config = riskConfig[u.churnRisk]
            const isSelected = selectedUsers.includes(u.id)
            return (
              <div key={u.id}
                className={`p-4 flex items-center gap-3 cursor-pointer transition-colors ${isSelected ? 'bg-purple-50' : 'hover:bg-gray-50'}`}
                onClick={() => toggleSelect(u.id)}>
                <input type="checkbox" checked={isSelected} onChange={() => {}}
                  className="w-4 h-4 accent-purple-600 flex-shrink-0" />
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center font-bold text-gray-600 flex-shrink-0">
                  {u.name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-gray-800">{u.name}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${config.color}`}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{u.reason}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{u.totalOrders} orders</span>
                    {u.daysSinceLastOrder < 999 && <span>Last order: {u.daysSinceLastOrder}d ago</span>}
                    {u.email && <span className="truncate max-w-[120px]">{u.email}</span>}
                  </div>
                </div>
                {/* Churn score bar */}
                <div className="w-20 flex-shrink-0">
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Risk</span>
                    <span>{u.churnScore}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.min(u.churnScore, 100)}%`, background: config.bar }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {!filtered.length && (
          <div className="p-12 text-center text-gray-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p>No users in this category</p>
          </div>
        )}
      </div>
    </div>
  )
}
