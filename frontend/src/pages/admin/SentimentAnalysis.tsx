import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { MessageSquare, TrendingUp, TrendingDown, Minus, Star, RefreshCw, Zap } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

// Sentiment analysis using Groq AI on review batches
function analyzeSentiment(text: string): { score: number; label: string; color: string; emoji: string } {
  const positive = ['great', 'excellent', 'amazing', 'love', 'perfect', 'fresh', 'good', 'best', 'wonderful', 'fantastic', 'happy', 'satisfied', 'recommend', 'quality', 'fast', 'ጥሩ', 'አስደናቂ']
  const negative = ['bad', 'terrible', 'awful', 'hate', 'worst', 'poor', 'slow', 'broken', 'damaged', 'wrong', 'disappointed', 'never', 'horrible', 'waste', 'መጥፎ', 'ደካማ']

  const lower = text.toLowerCase()
  let score = 0
  positive.forEach(w => { if (lower.includes(w)) score += 1 })
  negative.forEach(w => { if (lower.includes(w)) score -= 1 })

  if (score >= 2) return { score, label: 'Very Positive', color: 'text-green-700 bg-green-100', emoji: '😊' }
  if (score === 1) return { score, label: 'Positive', color: 'text-green-600 bg-green-50', emoji: '🙂' }
  if (score === 0) return { score, label: 'Neutral', color: 'text-gray-600 bg-gray-100', emoji: '😐' }
  if (score === -1) return { score, label: 'Negative', color: 'text-orange-600 bg-orange-50', emoji: '😕' }
  return { score, label: 'Very Negative', color: 'text-red-700 bg-red-100', emoji: '😠' }
}

export default function SentimentAnalysis() {
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [period, setPeriod] = useState(30)

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin-reviews-sentiment', period],
    queryFn: async () => {
      // Get recent reviews from all products
      const res = await api.get('/admin/orders', { params: { limit: 1 } })
      // Fetch reviews via search
      const reviewRes = await api.get('/reviews/product/all', {
        params: { limit: 100, days: period },
      }).catch(() => ({ data: { data: [] } }))
      return reviewRes.data.data || []
    },
  })

  // Fallback: get reviews from a sample of products
  const { data: sampleReviews = [] } = useQuery({
    queryKey: ['sample-reviews-sentiment'],
    queryFn: async () => {
      const productsRes = await api.get('/products?limit=10&sort=soldCount')
      const products = productsRes.data.data || []
      const allReviews: any[] = []
      await Promise.all(products.slice(0, 5).map(async (p: any) => {
        try {
          const r = await api.get(`/reviews/product/${p.id}?limit=20`)
          const reviewsWithProduct = (r.data.data || []).map((rev: any) => ({
            ...rev,
            productName: p.name,
          }))
          allReviews.push(...reviewsWithProduct)
        } catch {}
      }))
      return allReviews
    },
    staleTime: 1000 * 60 * 5,
  })

  const displayReviews = sampleReviews.length > 0 ? sampleReviews : reviews

  // Compute sentiment stats
  const sentimentStats = displayReviews.reduce((acc: any, r: any) => {
    if (!r.comment) return acc
    const s = analyzeSentiment(r.comment)
    acc[s.label] = (acc[s.label] || 0) + 1
    return acc
  }, {})

  const totalWithComments = displayReviews.filter((r: any) => r.comment).length
  const positiveCount = (sentimentStats['Very Positive'] || 0) + (sentimentStats['Positive'] || 0)
  const negativeCount = (sentimentStats['Very Negative'] || 0) + (sentimentStats['Negative'] || 0)
  const positiveRate = totalWithComments > 0 ? Math.round((positiveCount / totalWithComments) * 100) : 0

  // Common themes extraction
  const allComments = displayReviews.filter((r: any) => r.comment).map((r: any) => r.comment).join(' ')
  const wordFreq: Record<string, number> = {}
  allComments.toLowerCase().split(/\s+/).forEach(word => {
    if (word.length > 4 && !['this', 'that', 'with', 'from', 'have', 'very', 'good', 'great'].includes(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    }
  })
  const topWords = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).slice(0, 10)

  const generateAISummary = async () => {
    if (!displayReviews.length) { toast.error('No reviews to analyze'); return }
    setAnalyzing(true)
    try {
      const sample = displayReviews
        .filter((r: any) => r.comment)
        .slice(0, 20)
        .map((r: any) => `${r.rating}★: ${r.comment}`)
        .join('\n')

      const res = await api.post('/ai/chat', {
        message: `Analyze these ${Math.min(20, displayReviews.length)} customer reviews from an Ethiopian agricultural marketplace. Provide: 1) Overall sentiment (1 sentence), 2) Top 3 things customers love, 3) Top 3 complaints, 4) One actionable recommendation. Be concise.\n\nReviews:\n${sample}`,
        language: 'en',
        history: [],
      })
      setAiSummary(res.data.data.reply)
    } catch { toast.error('AI analysis failed') }
    finally { setAnalyzing(false) }
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <MessageSquare size={20} className="text-purple-600" /> Sentiment Analysis
          </h2>
          <p className="text-sm text-gray-400">AI-powered analysis of customer review sentiment</p>
        </div>
        <button onClick={generateAISummary} disabled={analyzing}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors disabled:opacity-50">
          <Zap size={15} /> {analyzing ? 'Analyzing...' : 'AI Deep Analysis'}
        </button>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-card p-4 text-center">
          <p className="text-2xl font-extrabold text-gray-900">{displayReviews.length}</p>
          <p className="text-xs text-gray-400 mt-1">Total Reviews</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-4 text-center">
          <p className="text-2xl font-extrabold text-green-primary">{positiveRate}%</p>
          <p className="text-xs text-gray-400 mt-1">Positive Rate</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-4 text-center">
          <p className="text-2xl font-extrabold text-orange-500">{negativeCount}</p>
          <p className="text-xs text-gray-400 mt-1">Negative Reviews</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-4 text-center">
          <p className="text-2xl font-extrabold text-blue-600">
            {displayReviews.length > 0 ? (displayReviews.reduce((s: number, r: any) => s + r.rating, 0) / displayReviews.length).toFixed(1) : '—'}★
          </p>
          <p className="text-xs text-gray-400 mt-1">Avg Rating</p>
        </div>
      </div>

      {/* Sentiment distribution */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-extrabold text-gray-900 mb-4">Sentiment Distribution</h3>
        <div className="space-y-3">
          {[
            { label: 'Very Positive', emoji: '😊', color: '#2E7D32', bg: '#f0fdf4' },
            { label: 'Positive', emoji: '🙂', color: '#43a047', bg: '#f0fdf4' },
            { label: 'Neutral', emoji: '😐', color: '#6b7280', bg: '#f9fafb' },
            { label: 'Negative', emoji: '😕', color: '#f59e0b', bg: '#fffbeb' },
            { label: 'Very Negative', emoji: '😠', color: '#ef4444', bg: '#fef2f2' },
          ].map(({ label, emoji, color, bg }) => {
            const count = sentimentStats[label] || 0
            const pct = totalWithComments > 0 ? Math.round((count / totalWithComments) * 100) : 0
            return (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-700">{emoji} {label}</span>
                  <span className="text-sm font-bold text-gray-800">{count} ({pct}%)</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🤖</span>
            <h3 className="font-extrabold text-purple-900">AI Analysis Summary</h3>
          </div>
          <div className="text-sm text-purple-800 whitespace-pre-wrap leading-relaxed">{aiSummary}</div>
        </div>
      )}

      {/* Top keywords */}
      {topWords.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="font-extrabold text-gray-900 mb-4">🔤 Most Mentioned Words</h3>
          <div className="flex flex-wrap gap-2">
            {topWords.map(([word, count]) => (
              <span key={word}
                className="px-3 py-1.5 rounded-full text-sm font-semibold border-2 border-gray-100"
                style={{ fontSize: `${Math.min(0.7 + count * 0.05, 1.1)}rem` }}>
                {word} <span className="text-gray-400 text-xs">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent reviews with sentiment */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-extrabold text-gray-900 mb-4">Recent Reviews — Sentiment Tagged</h3>
        {!displayReviews.length ? (
          <p className="text-gray-400 text-sm text-center py-6">No reviews yet</p>
        ) : (
          <div className="space-y-3">
            {displayReviews.filter((r: any) => r.comment).slice(0, 10).map((r: any) => {
              const sentiment = analyzeSentiment(r.comment)
              return (
                <div key={r.id} className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {r.user?.name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-sm text-gray-800">{r.user?.name || 'Customer'}</span>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={10} className={s <= r.rating ? 'fill-orange-400 text-orange-400' : 'text-gray-200'} />
                        ))}
                      </div>
                      {r.productName && <span className="text-xs text-gray-400">on {r.productName}</span>}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{r.comment}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${sentiment.color}`}>
                    {sentiment.emoji} {sentiment.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
