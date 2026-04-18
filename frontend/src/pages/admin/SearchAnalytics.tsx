import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, TrendingUp, AlertCircle, MousePointer, BarChart2 } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'

function MiniBar({ value, max, color = '#2E7D32' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '6px', background: '#f3f4f6', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width .3s ease' }} />
      </div>
      <span style={{ fontSize: '.72rem', color: '#6b7280', width: '28px', textAlign: 'right', flexShrink: 0 }}>{value}</span>
    </div>
  )
}

export default function SearchAnalytics() {
  const [days, setDays] = useState(7)

  const { data, isLoading } = useQuery({
    queryKey: ['search-analytics', days],
    queryFn: () => api.get(`/search/analytics?days=${days}`).then(r => r.data.data),
    staleTime: 1000 * 60 * 5,
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  const maxSearches = Math.max(...(data?.topQueries?.map((q: any) => q.count) || [1]))
  const maxClicks   = Math.max(...(data?.topClicked?.map((c: any) => c._count?.productId || 0) || [1]))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Search Intelligence</h2>
          <p className="text-sm text-gray-400">Click-through rates, trending queries, content gaps</p>
        </div>
        <div className="flex gap-2">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${days === d ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-500 border-gray-200'}`}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* Top Searches */}
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Search size={18} className="text-green-primary" />
            <h3 className="font-extrabold text-gray-900">Top Searches</h3>
            <span className="ml-auto text-xs text-gray-400">{data?.period}</span>
          </div>
          <div className="space-y-3">
            {data?.topQueries?.slice(0, 10).map((q: any, i: number) => (
              <div key={q.query}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-300 w-5">{i + 1}</span>
                    <span className="text-sm font-semibold text-gray-800">{q.query}</span>
                    {q.avgResults === 0 && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-bold">0 results</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{q.avgResults} avg results</span>
                </div>
                <MiniBar value={q.count} max={maxSearches} />
              </div>
            ))}
            {!data?.topQueries?.length && <p className="text-gray-400 text-sm text-center py-4">No search data yet</p>}
          </div>
        </div>

        {/* CTR by Query */}
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <MousePointer size={18} className="text-blue-500" />
            <h3 className="font-extrabold text-gray-900">Click-Through Rate</h3>
          </div>
          <div className="space-y-2">
            {data?.ctrByQuery?.slice(0, 10).map((q: any) => (
              <div key={q.query} className="flex items-center gap-3 py-1.5 border-b border-gray-50 last:border-0">
                <span className="flex-1 text-sm text-gray-700 truncate">{q.query}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{q.searches} searches</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                  parseFloat(q.ctr) >= 20 ? 'bg-green-100 text-green-700' :
                  parseFloat(q.ctr) >= 5  ? 'bg-yellow-100 text-yellow-700' :
                  'bg-red-100 text-red-600'
                }`}>{q.ctr}</span>
              </div>
            ))}
            {!data?.ctrByQuery?.length && <p className="text-gray-400 text-sm text-center py-4">No click data yet</p>}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            🟢 ≥20% good · 🟡 5–20% ok · 🔴 &lt;5% needs improvement
          </p>
        </div>

        {/* Zero Results — Content Gaps */}
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={18} className="text-red-500" />
            <h3 className="font-extrabold text-gray-900">Content Gaps</h3>
            <span className="text-xs text-gray-400 ml-1">— searches with 0 results</span>
          </div>
          {data?.zeroResults?.length ? (
            <div className="space-y-2">
              {data.zeroResults.map((q: any) => (
                <div key={q.query} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <span className="text-sm font-semibold text-gray-800">{q.query}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{q.count}× searched</span>
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">No products</span>
                  </div>
                </div>
              ))}
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                💡 These are products buyers want but can't find. Consider adding them or improving product descriptions.
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-sm text-gray-500">No zero-result searches! All queries are finding products.</p>
            </div>
          )}
        </div>

        {/* Most Clicked Products from Search */}
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-orange-500" />
            <h3 className="font-extrabold text-gray-900">Most Clicked from Search</h3>
          </div>
          <div className="space-y-3">
            {data?.topClicked?.map((c: any, i: number) => (
              <div key={c.productId}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-300 w-5">{i + 1}</span>
                    <span className="text-sm font-semibold text-gray-800 truncate max-w-[180px]">
                      {c.product?.name || c.productId.slice(-8)}
                    </span>
                  </div>
                  {c.product?.price && (
                    <span className="text-xs text-green-primary font-bold flex-shrink-0">ETB {c.product.price}</span>
                  )}
                </div>
                <MiniBar value={c._count?.productId || 0} max={maxClicks} color="#f59e0b" />
              </div>
            ))}
            {!data?.topClicked?.length && <p className="text-gray-400 text-sm text-center py-4">No click data yet. Clicks are tracked when users search and click products.</p>}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
          <BarChart2 size={16} className="text-green-primary" /> How Search Intelligence Works
        </h3>
        <div className="grid sm:grid-cols-4 gap-4 text-sm">
          {[
            { icon: '🔍', title: 'User searches', desc: 'Query expanded with Ethiopian synonyms (teff=ጤፍ)' },
            { icon: '📊', title: 'Results ranked', desc: 'Click scores + trending + user preferences applied' },
            { icon: '👆', title: 'User clicks', desc: 'Click position tracked → feeds back into ranking' },
            { icon: '🔄', title: 'Loop improves', desc: 'Every 30min trending scores refresh automatically' },
          ].map(s => (
            <div key={s.title} className="text-center">
              <div className="text-2xl mb-1">{s.icon}</div>
              <p className="font-bold text-gray-800 text-xs">{s.title}</p>
              <p className="text-gray-500 text-xs mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
