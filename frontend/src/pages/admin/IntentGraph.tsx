import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Brain, Plus, Trash2, Edit2, Search, TrendingUp, Globe, Zap, X } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import toast from 'react-hot-toast'

const INTENT_TYPES = [
  'holiday', 'recipe', 'bulk', 'fasting', 'post_fasting', 'seasonal',
  'harvest', 'fresh', 'organic', 'cheap', 'event', 'coffee', 'dairy',
  'meat', 'grain', 'vegetable', 'legumes', 'specialty', 'snack', 'ingredient', 'farming', 'meal',
]

const LANG_LABELS: Record<string, string> = {
  am: '🇪🇹 Amharic',
  om: '🌿 Afaan Oromo',
  en: '🇬🇧 English',
  ti: '🇪🇹 Tigrinya',
  mixed: '🔀 Mixed',
}

const SOURCE_COLORS: Record<string, string> = {
  seed:  'bg-green-100 text-green-700',
  db:    'bg-blue-100 text-blue-700',
  ai:    'bg-purple-100 text-purple-700',
  admin: 'bg-orange-100 text-orange-700',
}

export default function IntentGraph() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [testQuery, setTestQuery] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [testing, setTesting] = useState(false)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState({ query: '', terms: '', intent: 'recipe', boost: '8', language: 'am' })

  const { data, isLoading } = useQuery({
    queryKey: ['admin-intent-graph'],
    queryFn: () => api.get('/admin/intent-graph').then(r => r.data.data),
    staleTime: 30000,
  })

  const { mutate: addEntry, isPending: adding } = useMutation({
    mutationFn: () => api.post('/admin/intent-graph', {
      query: form.query.trim(),
      terms: form.terms.split(',').map(t => t.trim()).filter(Boolean),
      intent: form.intent,
      boost: parseInt(form.boost),
      language: form.language,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-intent-graph'] })
      toast.success('Entry added!')
      setShowForm(false)
      setForm({ query: '', terms: '', intent: 'recipe', boost: '8', language: 'am' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  })

  const { mutate: deleteEntry } = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/intent-graph/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-intent-graph'] }); toast.success('Deleted') },
  })

  const testIntent = async () => {
    if (!testQuery.trim()) return
    setTesting(true)
    try {
      const res = await api.get('/search/intent-graph', { params: { q: testQuery } })
      setTestResult(res.data.data)
    } catch { toast.error('Test failed') }
    finally { setTesting(false) }
  }

  const stats = data?.stats
  const entries = (data?.entries || []).filter((e: any) =>
    !search || e.query.toLowerCase().includes(search.toLowerCase()) ||
    e.intent.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <Brain size={20} className="text-purple-600" /> Ethiopian Intent Graph
          </h2>
          <p className="text-sm text-gray-400">Self-learning COSMO equivalent — grows with every search</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} /> Add Entry
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-card p-4 text-center">
            <p className="text-2xl font-extrabold text-purple-600">{stats.totalEntries}</p>
            <p className="text-xs text-gray-400 mt-1">Total Entries</p>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-4 text-center">
            <p className="text-2xl font-extrabold text-green-primary">{stats.seedEntries}</p>
            <p className="text-xs text-gray-400 mt-1">Seed (hardcoded)</p>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-4 text-center">
            <p className="text-2xl font-extrabold text-blue-600">{stats.learnedEntries}</p>
            <p className="text-xs text-gray-400 mt-1">AI Learned</p>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-4 text-center">
            <p className="text-2xl font-extrabold text-orange-500">
              {Object.values(stats.byLanguage || {}).reduce((a: number, b: any) => a + b, 0)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Languages</p>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
        <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
          <Zap size={16} /> How the Self-Learning Graph Works
        </h3>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-white rounded-xl p-3">
            <p className="font-bold text-green-700 mb-1">🌱 Layer 1: Seed (~0ms)</p>
            <p className="text-xs text-gray-500">{stats?.seedEntries || 80} hardcoded entries. Instant. No DB or AI needed. Common Ethiopian terms.</p>
          </div>
          <div className="bg-white rounded-xl p-3">
            <p className="font-bold text-blue-700 mb-1">💾 Layer 2: Database (~5ms)</p>
            <p className="text-xs text-gray-500">{stats?.learnedEntries || 0} learned entries. Grows automatically. Every new query Groq learns gets saved here.</p>
          </div>
          <div className="bg-white rounded-xl p-3">
            <p className="font-bold text-purple-700 mb-1">🤖 Layer 3: Groq AI (~300ms)</p>
            <p className="text-xs text-gray-500">Unlimited. Handles any Amharic, Oromo, Tigrinya, or mixed query. Saves result to DB for next time.</p>
          </div>
        </div>
      </div>

      {/* Test the graph */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Search size={16} className="text-green-primary" /> Test Intent Resolution
        </h3>
        <div className="flex gap-3 mb-3">
          <input value={testQuery} onChange={e => setTestQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && testIntent()}
            placeholder="Type any Amharic, Oromo, or English query... e.g. ፋሲካ, irreechaa, ዶሮ ወጥ"
            className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-400" />
          <Button loading={testing} onClick={testIntent} disabled={!testQuery.trim()}>
            Test
          </Button>
        </div>
        {testResult && (
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SOURCE_COLORS[testResult.source] || 'bg-gray-100 text-gray-600'}`}>
                {testResult.source === 'seed' ? '🌱 Seed' :
                 testResult.source === 'db'   ? '💾 Database' :
                 testResult.source === 'ai'   ? '🤖 AI Learned' : testResult.source}
              </span>
              <span className="text-xs font-bold text-gray-600">Intent: {testResult.intent}</span>
              <span className="text-xs text-gray-400">Boost: +{testResult.boost}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {testResult.terms?.map((t: string) => (
                <span key={t} className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
            {testResult.confidence && (
              <p className="text-xs text-gray-400 mt-2">Confidence: {(testResult.confidence * 100).toFixed(0)}%</p>
            )}
          </div>
        )}
        {testResult === null && testQuery && !testing && (
          <p className="text-sm text-gray-400">No intent found for this query.</p>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-gray-900">Add Intent Entry</h3>
            <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Query (Amharic/Oromo/English) *" placeholder="e.g. ፋሲካ or irreechaa"
              value={form.query} onChange={(e: any) => setForm(f => ({ ...f, query: e.target.value }))} />
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Language</label>
              <select value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400 bg-white">
                {Object.entries(LANG_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Product Terms * (comma-separated)</label>
              <input value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))}
                placeholder="e.g. eggs, lamb, injera, teff, honey, butter"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Intent Type</label>
              <select value={form.intent} onChange={e => setForm(f => ({ ...f, intent: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400 bg-white">
                {INTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <Input label="Boost (6-20)" type="number" placeholder="8"
              value={form.boost} onChange={(e: any) => setForm(f => ({ ...f, boost: e.target.value }))} />
          </div>
          <div className="flex gap-3 mt-4">
            <Button loading={adding} disabled={!form.query || !form.terms} onClick={() => addEntry()}>
              <Plus size={15} /> Add Entry
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Search + entries */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search entries..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-purple-400" />
          </div>
          <span className="text-xs text-gray-400">{entries.length} entries (DB only — seed not shown)</span>
        </div>
        {!entries.length ? (
          <div className="p-12 text-center text-gray-400">
            <Brain size={40} className="mx-auto mb-3 opacity-30" />
            <p>No learned entries yet. The graph grows as users search.</p>
            <p className="text-xs mt-1">Seed entries ({stats?.seedEntries || 80}) are hardcoded and not shown here.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {entries.map((entry: any) => (
              <div key={entry.id} className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-bold text-gray-900">{entry.query}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SOURCE_COLORS[entry.source] || 'bg-gray-100 text-gray-600'}`}>
                      {entry.source}
                    </span>
                    <span className="text-[10px] text-gray-400">{LANG_LABELS[entry.language] || entry.language}</span>
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-full">{entry.intent}</span>
                    <span className="text-[10px] text-gray-400">+{entry.boost} boost</span>
                    <span className="text-[10px] text-gray-400">{entry.useCount}× used</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {entry.terms?.map((t: string) => (
                      <span key={t} className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
                <button onClick={() => deleteEntry(entry.id)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
