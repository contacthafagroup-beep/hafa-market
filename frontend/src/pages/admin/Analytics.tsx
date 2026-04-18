import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, ShoppingBag, Users, DollarSign, ArrowDown, Trophy } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatPrice } from '@/lib/utils'

function BarChart({ data, color = '#2E7D32' }: { data: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:'6px', height:'160px', padding:'0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', position:'relative' }}
          onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
          {hovered === i && (
            <div style={{ position:'absolute', bottom:'100%', left:'50%', transform:'translateX(-50%)',
              background:'#1f2937', color:'#fff', fontSize:'.7rem', fontWeight:700,
              padding:'3px 8px', borderRadius:'6px', whiteSpace:'nowrap', zIndex:10, marginBottom:'4px' }}>
              {formatPrice(d.value)}
            </div>
          )}
          <div style={{ width:'100%', background: hovered===i ? color : color+'cc',
            borderRadius:'4px 4px 0 0', height:`${Math.max((d.value/max)*100, 2)}%`,
            transition:'all .2s ease', cursor:'pointer' }} />
          <span style={{ fontSize:'.6rem', color:'#9ca3af', textAlign:'center', lineHeight:1 }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState(30)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-revenue', period],
    queryFn: () => api.get(`/admin/analytics/revenue?days=${period}`).then(r => r.data.data),
  })

  const { data: dash } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => api.get('/admin/dashboard').then(r => r.data.data),
  })

  const { data: funnel } = useQuery({
    queryKey: ['admin-funnel', period],
    queryFn: () => api.get(`/admin/analytics/funnel?days=${period}`).then(r => r.data.data),
  })

  const { data: topSellers } = useQuery({
    queryKey: ['admin-top-sellers', period],
    queryFn: () => api.get(`/admin/analytics/sellers?days=${period}&limit=5`).then(r => r.data.data),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  const chartData = (data?.daily || data?.chartData || []).map((d: any) => ({
    label: new Date(d.date).toLocaleDateString('en', { month:'short', day:'numeric' }),
    value: d.revenue || 0,
  }))

  const s = dash?.stats || {}
  const cards = [
    { label:'Total Revenue',  value: formatPrice(s.monthRevenue||0),  icon:<DollarSign size={20}/>, color:'bg-green-50 text-green-primary', sub:`${s.revenueGrowth||0}% vs last month` },
    { label:'Total Orders',   value: s.totalOrders||0,                icon:<ShoppingBag size={20}/>, color:'bg-blue-50 text-blue-600',     sub:`${s.todayOrders||0} today` },
    { label:'Total Users',    value: s.totalUsers||0,                 icon:<Users size={20}/>,       color:'bg-purple-50 text-purple-600', sub:`${s.newUsersToday||0} new today` },
    { label:'Active Sellers', value: s.totalSellers||0,               icon:<TrendingUp size={20}/>,  color:'bg-orange-50 text-orange-600', sub:`${s.pendingSellers||0} pending` },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-extrabold text-gray-900">Revenue Analytics</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white rounded-2xl shadow-card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${c.color}`}>{c.icon}</div>
            <div className="text-xl font-extrabold text-gray-900">{c.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{c.label}</div>
            <div className="text-xs text-green-primary font-medium mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-gray-900">Daily Revenue</h3>
          <div className="flex gap-2">
            {[7, 30, 90].map(d => (
              <button key={d} onClick={() => setPeriod(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period===d ? 'bg-green-primary text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {d}d
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 0
          ? <BarChart data={chartData} />
          : <div className="h-40 flex items-center justify-center text-gray-400 text-sm">No revenue data for this period</div>
        }
        {data && (
          <div className="flex gap-6 mt-4 pt-4 border-t border-gray-100">
            <div><p className="text-xs text-gray-400">Total ({period}d)</p><p className="font-extrabold text-green-primary">{formatPrice(data?.total || data?.totalRevenue || 0)}</p></div>
            <div><p className="text-xs text-gray-400">Avg/day</p><p className="font-extrabold text-gray-800">{formatPrice((data?.total || data?.totalRevenue || 0)/period)}</p></div>
            <div><p className="text-xs text-gray-400">Orders</p><p className="font-extrabold text-gray-800">{data?.orderCount||0}</p></div>
          </div>
        )}
      </div>

      {/* Conversion Funnel */}
      {funnel && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-extrabold text-gray-900">Conversion Funnel</h3>
              <p className="text-xs text-gray-400 mt-0.5">Overall conversion rate: <span className="font-bold text-green-primary">{funnel.conversionRate}%</span></p>
            </div>
          </div>
          <div className="space-y-3">
            {funnel.funnel?.map((stage: any, i: number) => {
              const maxCount = funnel.funnel[0]?.count || 1
              const pct = Math.round((stage.count / maxCount) * 100)
              return (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-700">{stage.icon} {stage.stage}</span>
                    <div className="flex items-center gap-3">
                      {stage.dropoff > 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                          <ArrowDown size={11}/> {stage.dropoff}% drop
                        </span>
                      )}
                      <span className="text-sm font-bold text-gray-800">{stage.count.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="h-8 bg-gray-100 rounded-xl overflow-hidden">
                    <div className="h-full rounded-xl transition-all flex items-center px-3"
                      style={{ width: `${Math.max(pct, 2)}%`, background: i === 0 ? '#2E7D32' : i === 4 ? '#FFA726' : '#43a047' }}>
                      <span className="text-white text-xs font-bold">{pct}%</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top Sellers Leaderboard */}
      {topSellers?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <h3 className="font-extrabold text-gray-900 mb-4 flex items-center gap-2">
            <Trophy size={18} className="text-orange-500" /> Top Sellers ({period}d)
          </h3>
          <div className="space-y-3">
            {topSellers.map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-3">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${i===0?'bg-yellow-100 text-yellow-700':i===1?'bg-gray-100 text-gray-600':i===2?'bg-orange-100 text-orange-600':'bg-gray-50 text-gray-400'}`}>
                  {i+1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{s.storeName}</p>
                  <p className="text-xs text-gray-400">{s.city} · {s.orders} orders · ⭐ {(s.rating||0).toFixed(1)}</p>
                </div>
                <span className="font-extrabold text-green-primary text-sm flex-shrink-0">{formatPrice(s.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
