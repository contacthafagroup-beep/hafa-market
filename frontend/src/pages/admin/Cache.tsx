import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { RefreshCw, Trash2, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'

export default function AdminCache() {
  const [pattern, setPattern] = useState('')
  const [confirmFlush, setConfirmFlush] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-cache-stats'],
    queryFn: () => api.get('/admin/cache/stats').then(r => r.data.data),
    refetchInterval: 10000,
  })

  const { mutate: flushAll, isPending: flushing } = useMutation({
    mutationFn: () => api.delete('/admin/cache/flush'),
    onSuccess: () => { toast.success('Cache flushed!'); setConfirmFlush(false); refetch() },
    onError: () => toast.error('Failed to flush cache'),
  })

  const { mutate: flushPattern, isPending: flushingPattern } = useMutation({
    mutationFn: () => api.delete('/admin/cache/pattern', { data: { pattern } }),
    onSuccess: (res: any) => { toast.success(res.data?.message || 'Pattern deleted'); setPattern(''); refetch() },
    onError: () => toast.error('Failed to delete pattern'),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  const stats = data?.stats || {}
  const redis = data?.redis || {}

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <RefreshCw size={20} className="text-green-primary" /> Cache Management
          </h2>
          <p className="text-sm text-gray-400">Monitor and manage Redis cache</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Cache Hits', value: stats.hits || 0, color: 'text-green-primary' },
          { label: 'Cache Misses', value: stats.misses || 0, color: 'text-red-500' },
          { label: 'Hit Rate', value: stats.hits + stats.misses > 0 ? `${Math.round((stats.hits / (stats.hits + stats.misses)) * 100)}%` : '—', color: 'text-blue-600' },
          { label: 'Redis Keys', value: redis.keys || '—', color: 'text-purple-600' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-card p-4 text-center">
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Redis info */}
      {redis.memory && (
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="font-bold text-gray-900 mb-3">Redis Info</h3>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-400">Memory Used:</span> <span className="font-semibold">{redis.memory}</span></div>
            <div><span className="text-gray-400">Version:</span> <span className="font-semibold">{redis.version || '—'}</span></div>
            <div><span className="text-gray-400">Uptime:</span> <span className="font-semibold">{redis.uptime ? `${Math.floor(redis.uptime / 3600)}h` : '—'}</span></div>
          </div>
        </div>
      )}

      {/* Pattern delete */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-gray-900 mb-3">Delete by Pattern</h3>
        <p className="text-xs text-gray-400 mb-3">Use wildcards: e.g. <code className="bg-gray-100 px-1 rounded">products:*</code> or <code className="bg-gray-100 px-1 rounded">user:123:*</code></p>
        <div className="flex gap-3">
          <input
            value={pattern}
            onChange={e => setPattern(e.target.value)}
            placeholder="e.g. products:*"
            className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-primary font-mono"
          />
          <Button
            variant="outline"
            loading={flushingPattern}
            disabled={!pattern.trim()}
            onClick={() => flushPattern()}
          >
            <Trash2 size={14} /> Delete
          </Button>
        </div>
      </div>

      {/* Flush all */}
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-red-700 mb-1">Flush All Cache</h3>
            <p className="text-sm text-red-600 mb-3">This will delete ALL cached data. The app will be slower temporarily while cache rebuilds. Use only if necessary.</p>
            {!confirmFlush ? (
              <Button variant="danger" size="sm" onClick={() => setConfirmFlush(true)}>
                Flush All Cache
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm font-bold text-red-700">Are you sure?</p>
                <Button variant="danger" size="sm" loading={flushing} onClick={() => flushAll()}>
                  Yes, Flush All
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmFlush(false)}>Cancel</Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
