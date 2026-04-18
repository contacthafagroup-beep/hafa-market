/**
 * Seller Live Analytics — /dashboard/live-analytics
 * Shows analytics for all past and current live sessions
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Video, Users, MessageSquare, TrendingUp, Clock, Zap, Star } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import { Link } from 'react-router-dom'

function SessionCard({ session }: { session: any }) {
  const { data: analytics } = useQuery({
    queryKey: ['live-analytics', session.id],
    queryFn: () => api.get(`/live/${session.id}/analytics`).then(r => r.data.data),
    staleTime: 1000 * 60 * 5,
  })

  const { data: highlights } = useQuery({
    queryKey: ['live-highlights', session.id],
    queryFn: () => api.get(`/live/${session.id}/highlights`).then(r => r.data.data),
    enabled: session.status === 'ENDED',
    staleTime: 1000 * 60 * 60,
  })

  const statusColor = session.status === 'LIVE'
    ? 'bg-red-100 text-red-700'
    : session.status === 'ENDED'
      ? 'bg-gray-100 text-gray-600'
      : 'bg-yellow-100 text-yellow-700'

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Video size={18} className="text-red-500" />
            </div>
            <div>
              <p className="font-bold text-gray-900 line-clamp-1">{session.title}</p>
              <p className="text-xs text-gray-400">{formatDate(session.createdAt)}</p>
            </div>
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${statusColor}`}>
            {session.status === 'LIVE' && <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block mr-1 animate-pulse" />}
            {session.status}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 divide-x divide-gray-100">
        {[
          { icon: <Users size={14} />, label: 'Peak Viewers', value: analytics?.peakViewers ?? session.peakViewers ?? '—', color: 'text-blue-600' },
          { icon: <MessageSquare size={14} />, label: 'Messages', value: analytics?.totalMessages ?? '—', color: 'text-purple-600' },
          { icon: <Zap size={14} />, label: 'Questions', value: analytics?.totalQuestions ?? '—', color: 'text-yellow-600' },
          { icon: <Clock size={14} />, label: 'Duration', value: analytics?.durationMinutes ? `${analytics.durationMinutes}m` : '—', color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="p-3 text-center">
            <div className={`flex justify-center mb-1 ${s.color}`}>{s.icon}</div>
            <p className={`text-lg font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Engagement rate */}
      {analytics?.engagementRate !== undefined && (
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Engagement rate</span>
            <span className="text-xs font-bold text-green-primary">{analytics.engagementRate}% of viewers chatted</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
            <div className="h-full bg-green-primary rounded-full" style={{ width: `${Math.min(analytics.engagementRate, 100)}%` }} />
          </div>
        </div>
      )}

      {/* AI Highlights */}
      {highlights?.summary && (
        <div className="px-5 py-4 border-t border-gray-100">
          <p className="text-xs font-bold text-purple-700 mb-2 flex items-center gap-1">
            <Star size={11} /> AI Session Summary
          </p>
          <p className="text-sm text-gray-700 leading-relaxed">{highlights.summary}</p>
          {highlights.amharicSummary && (
            <p className="text-xs text-gray-500 mt-1 italic">{highlights.amharicSummary}</p>
          )}
          {highlights.topQuestions?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-gray-500 mb-1.5">Top viewer questions:</p>
              <ul className="space-y-1">
                {highlights.topQuestions.slice(0, 3).map((q: string, i: number) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                    <span className="text-yellow-500 flex-shrink-0">❓</span> {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
        {session.status === 'LIVE' && (
          <Link to="/live" className="text-xs text-red-500 font-bold hover:underline flex items-center gap-1">
            <Video size={11} /> View Live Session
          </Link>
        )}
        {session.streamUrl && (
          <a href={session.streamUrl} target="_blank" rel="noreferrer"
            className="text-xs text-blue-500 font-bold hover:underline">
            Watch Recording →
          </a>
        )}
      </div>
    </div>
  )
}

export default function LiveAnalytics() {
  const [filter, setFilter] = useState<'ALL' | 'LIVE' | 'ENDED' | 'SCHEDULED'>('ALL')

  // Get seller's sessions
  const { data: allSessions = [], isLoading } = useQuery({
    queryKey: ['seller-live-sessions'],
    queryFn: async () => {
      // Get seller info first
      const sellerRes = await api.get('/sellers/me/store').catch(() => null)
      const sellerId = sellerRes?.data?.data?.id
      if (!sellerId) return []

      // Fetch live + scheduled sessions
      const liveRes = await api.get('/live').catch(() => ({ data: { data: [] } }))
      const liveSessions: any[] = (liveRes.data.data || []).filter((s: any) => s.sellerId === sellerId)

      // Also fetch ended sessions via features endpoint
      const endedRes = await api.get('/features/live').catch(() => ({ data: { data: [] } }))
      const endedSessions: any[] = (endedRes.data.data || []).filter((s: any) => s.sellerId === sellerId && s.status === 'ENDED')

      // Merge, deduplicate by id
      const all = [...liveSessions, ...endedSessions]
      const seen = new Set<string>()
      return all.filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true })
    },
    staleTime: 1000 * 30,
    refetchInterval: 30000,
  })

  const filtered = filter === 'ALL' ? allSessions : allSessions.filter((s: any) => s.status === filter)

  // Summary stats
  const totalSessions = allSessions.length
  const liveSessions = allSessions.filter((s: any) => s.status === 'LIVE').length
  const totalViewers = allSessions.reduce((sum: number, s: any) => sum + (s.peakViewers || 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Live Analytics</h2>
          <p className="text-sm text-gray-400">Performance data for your live sessions</p>
        </div>
        <Link to="/live">
          <button className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-colors">
            <Video size={14} /> Go Live
          </button>
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-card p-4 text-center">
          <div className="text-2xl font-black text-gray-900">{totalSessions}</div>
          <div className="text-xs text-gray-400 mt-1">Total Sessions</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-red-600">{liveSessions}</div>
          <div className="text-xs text-red-400 mt-1">🔴 Live Now</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-blue-600">{totalViewers}</div>
          <div className="text-xs text-blue-400 mt-1">Total Viewers</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['ALL', 'LIVE', 'SCHEDULED', 'ENDED'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
              filter === f ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-500 hover:border-gray-400'
            }`}>
            {f === 'LIVE' && <span className="w-1.5 h-1.5 bg-red-500 rounded-full inline-block mr-1 animate-pulse" />}
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Video size={40} className="mx-auto mb-3 opacity-30" />
          <p>No {filter !== 'ALL' ? filter.toLowerCase() : ''} sessions yet</p>
          <Link to="/live" className="text-red-500 font-bold hover:underline text-sm mt-2 inline-block">
            Start your first live session →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((s: any) => <SessionCard key={s.id} session={s} />)}
        </div>
      )}
    </div>
  )
}
