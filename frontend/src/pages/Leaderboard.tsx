import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Trophy, Star, Package, TrendingUp } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatPrice } from '@/lib/utils'

export default function Leaderboard() {
  const [period, setPeriod] = useState('30')

  const { data: sellers = [], isLoading } = useQuery({
    queryKey: ['leaderboard', period],
    queryFn: () => api.get(`/features/leaderboard?period=${period}`).then(r => r.data.data),
    staleTime: 1000 * 60 * 5,
  })

  const RANK_STYLES = [
    'bg-gradient-to-br from-yellow-400 to-orange-400 text-white',
    'bg-gradient-to-br from-gray-300 to-gray-400 text-white',
    'bg-gradient-to-br from-orange-300 to-orange-500 text-white',
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-full px-4 py-1.5 mb-4">
          <Trophy size={16} className="text-orange-500" />
          <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">Top Sellers</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Seller Leaderboard</h1>
        <p className="text-gray-400">Ethiopia's best agricultural sellers, ranked by performance</p>
      </div>

      {/* Period filter */}
      <div className="flex justify-center gap-2 mb-8">
        {[['7','7 Days'],['30','30 Days'],['90','3 Months']].map(([val, label]) => (
          <button key={val} onClick={() => setPeriod(val)}
            className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${period === val ? 'bg-green-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-green-primary'}`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* Top 3 podium */}
          {sellers.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[sellers[1], sellers[0], sellers[2]].map((s: any, i) => {
                const actualRank = i === 0 ? 2 : i === 1 ? 1 : 3
                const heights = ['h-32', 'h-40', 'h-28']
                return (
                  <Link key={s.id} to={`/sellers/${s.storeSlug}`}
                    className={`${heights[i]} rounded-2xl ${RANK_STYLES[actualRank - 1]} flex flex-col items-center justify-end p-4 text-center hover:opacity-90 transition-opacity`}>
                    <div className="text-3xl mb-1">{actualRank === 1 ? '🥇' : actualRank === 2 ? '🥈' : '🥉'}</div>
                    <p className="font-extrabold text-sm line-clamp-1">{s.storeName}</p>
                    <p className="text-xs opacity-80">{formatPrice(s.revenue, 'ETB')}</p>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Full list */}
          <div className="space-y-3">
            {sellers.map((s: any) => (
              <Link key={s.id} to={`/sellers/${s.storeSlug}`}
                className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4 hover:shadow-card-hover transition-all">
                {/* Rank */}
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${
                  s.rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                  s.rank === 2 ? 'bg-gray-100 text-gray-600' :
                  s.rank === 3 ? 'bg-orange-100 text-orange-600' :
                  'bg-gray-50 text-gray-400'
                }`}>
                  {s.rank <= 3 ? ['🥇','🥈','🥉'][s.rank - 1] : s.rank}
                </div>

                {/* Logo */}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-primary to-green-mid flex items-center justify-center text-white font-black text-lg flex-shrink-0 overflow-hidden">
                  {s.logo ? <img src={s.logo} alt={s.storeName} className="w-full h-full object-cover" /> : s.storeName?.[0]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-extrabold text-gray-900 truncate">{s.storeName}</p>
                    {s.badge && <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full flex-shrink-0">{s.badge}</span>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                    {s.city && <span>📍 {s.city}</span>}
                    <span className="flex items-center gap-0.5"><Star size={10} className="fill-orange-400 text-orange-400" />{(s.rating||0).toFixed(1)}</span>
                    <span className="flex items-center gap-0.5"><Package size={10} />{s.orders} orders</span>
                    <span>{s.productCount} products</span>
                  </div>
                </div>

                {/* Revenue */}
                <div className="text-right flex-shrink-0">
                  <p className="font-extrabold text-green-primary">{formatPrice(s.revenue, 'ETB')}</p>
                  <p className="text-xs text-gray-400">revenue</p>
                </div>
              </Link>
            ))}
          </div>

          {!sellers.length && (
            <div className="text-center py-16 text-gray-400">
              <Trophy size={40} className="mx-auto mb-3 opacity-30" />
              <p>No data yet for this period</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
