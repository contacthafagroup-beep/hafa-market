import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, Plus, Trash2, Leaf } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'

const SUGGESTIONS = [
  { keyword: 'mango', label: '🥭 Mango Season', desc: 'April–June' },
  { keyword: 'avocado', label: '🥑 Avocado Season', desc: 'March–May' },
  { keyword: 'teff harvest', label: '🌾 Teff Harvest', desc: 'October–November' },
  { keyword: 'coffee harvest', label: '☕ Coffee Harvest', desc: 'October–January' },
  { keyword: 'watermelon', label: '🍉 Watermelon', desc: 'June–August' },
  { keyword: 'honey', label: '🍯 Honey Season', desc: 'October–November' },
]

export default function SeasonalAlerts() {
  const qc = useQueryClient()
  const [keyword, setKeyword] = useState('')

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['seasonal-alerts'],
    queryFn: () => api.get('/features/seasonal-alerts').then(r => r.data.data),
  })

  const { mutate: addAlert, isLoading: adding } = useMutation({
    mutationFn: (kw: string) => api.post('/features/seasonal-alerts', { keyword: kw }),
    onSuccess: () => { toast.success('Alert set! 🔔'); setKeyword(''); qc.invalidateQueries({ queryKey: ['seasonal-alerts'] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  })

  const { mutate: removeAlert } = useMutation({
    mutationFn: (id: string) => api.delete(`/features/seasonal-alerts/${id}`),
    onSuccess: () => { toast.success('Alert removed'); qc.invalidateQueries({ queryKey: ['seasonal-alerts'] }) },
  })

  const activeKeywords = new Set(alerts.map((a: any) => a.keyword))

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
          <Leaf size={18} className="text-green-primary" /> Seasonal Alerts
        </h2>
        <p className="text-sm text-gray-400">Get notified when seasonal products become available</p>
      </div>

      {/* Quick suggestions */}
      <div className="bg-green-50 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">🌿 Ethiopian Seasons</p>
        <div className="grid grid-cols-2 gap-2">
          {SUGGESTIONS.map(s => {
            const isActive = activeKeywords.has(s.keyword)
            return (
              <button key={s.keyword}
                onClick={() => isActive ? null : addAlert(s.keyword)}
                disabled={isActive}
                className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${isActive ? 'border-green-primary bg-green-100 opacity-70 cursor-default' : 'border-gray-200 bg-white hover:border-green-primary hover:bg-green-50'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800">{s.label}</p>
                  <p className="text-[10px] text-gray-400">{s.desc}</p>
                </div>
                {isActive ? <Bell size={14} className="text-green-primary flex-shrink-0" /> : <Plus size={14} className="text-gray-400 flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom keyword */}
      <div className="bg-white rounded-2xl shadow-card p-4">
        <p className="text-sm font-bold text-gray-700 mb-3">Add custom alert</p>
        <div className="flex gap-2">
          <input value={keyword} onChange={e => setKeyword(e.target.value)}
            placeholder="e.g. fresh injera teff, organic honey..."
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-primary"
            onKeyDown={e => e.key === 'Enter' && keyword.trim() && addAlert(keyword)} />
          <Button size="sm" loading={adding} disabled={!keyword.trim()} onClick={() => addAlert(keyword)}>
            <Bell size={14} /> Alert Me
          </Button>
        </div>
      </div>

      {/* Active alerts */}
      {alerts.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">Your active alerts ({alerts.length})</p>
          <div className="space-y-2">
            {alerts.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <Bell size={16} className="text-green-primary flex-shrink-0" />
                <span className="flex-1 text-sm font-medium text-gray-800 capitalize">{a.keyword}</span>
                <button onClick={() => removeAlert(a.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
