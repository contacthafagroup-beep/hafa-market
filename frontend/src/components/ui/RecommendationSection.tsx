import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import ProductCard from '@/components/product/ProductCard'
import api from '@/lib/api'
import { useCallback } from 'react'

interface Props {
  context: 'homepage' | 'product' | 'cart' | 'category'
  productId?: string
  categoryId?: string
  title?: string
  titleAm?: string
  limit?: number
}

// Get or create session ID for real-time tracking
function getSessionId() {
  let sid = sessionStorage.getItem('hafa_sid')
  if (!sid) { sid = Math.random().toString(36).slice(2); sessionStorage.setItem('hafa_sid', sid) }
  return sid
}

export default function RecommendationSection({ context, productId, categoryId, title, titleAm, limit = 8 }: Props) {
  const { user } = useAuth()
  const city = (() => {
    try { return JSON.parse(localStorage.getItem('hafa_location') || '{}').city } catch { return undefined }
  })()
  const sessionId = getSessionId()

  const { data, isLoading } = useQuery({
    queryKey: ['recommendations', context, productId, categoryId, user?.id, sessionId],
    queryFn: () => api.get('/ai/recommendations/engine', {
      params: { context, productId, categoryId, city, limit, sessionId },
    }).then(r => r.data.data),
    staleTime: 1000 * 60 * 5, // 5min — shorter for real-time feel
    enabled: true,
  })

  // Real-time click tracking — updates user vector instantly (Two-Tower)
  const handleProductClick = useCallback((clickedProductId: string) => {
    api.post('/ai/recommendations/click', { productId: clickedProductId }).catch(() => {})
  }, [])

  if (isLoading || !data?.length) return null

  const reasons = [...new Set(data.map((p: any) => p._reason).filter(Boolean))]

  const defaultTitle = context === 'product' ? 'You May Also Like' :
                       context === 'cart'    ? 'Complete Your Order' :
                       context === 'homepage'? 'Recommended For You' :
                       'Popular Products'

  const defaultTitleAm = context === 'product' ? 'ሌሎች ምርቶችም ሊወዱ ይችላሉ' :
                         context === 'cart'    ? 'ትዕዛዝዎን ያሟሉ' :
                         context === 'homepage'? 'ለእርስዎ የሚመከሩ' :
                         'ታዋቂ ምርቶች'

  // Reason badge config
  const reasonBadge = (reason: string) => {
    if (reason?.includes('season'))    return { text: '🌿 In Season', color: 'bg-green-primary' }
    if (reason?.includes('harvested')) return { text: '🌱 Fresh', color: 'bg-emerald-500' }
    if (reason?.includes('organic'))   return { text: '🌿 Organic', color: 'bg-green-600' }
    if (reason?.includes('together'))  return { text: '🛒 Together', color: 'bg-blue-500' }
    if (reason?.includes('history'))   return { text: '✨ For You', color: 'bg-purple-500' }
    if (reason?.includes('Trending'))  return { text: '🔥 Trending', color: 'bg-orange-500' }
    return { text: '💡 Similar', color: 'bg-gray-500' }
  }

  return (
    <section className="py-10">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-xs font-bold text-green-primary uppercase tracking-widest mb-1">
              🤖 Two-Tower AI
            </p>
            <h2 className="text-xl md:text-2xl font-extrabold text-gray-800">
              {title || defaultTitle}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">{titleAm || defaultTitleAm}</p>
          </div>
          {reasons.length > 0 && (
            <div className="hidden sm:flex gap-2">
              {reasons.slice(0, 2).map(r => (
                <span key={r as string} className="text-xs bg-green-50 text-green-700 border border-green-100 px-3 py-1 rounded-full font-medium">
                  {r as string}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Products grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {data.slice(0, limit).map((p: any) => {
            const badge = p._reason ? reasonBadge(p._reason) : null
            return (
              <div key={p.id} className="relative" onClick={() => handleProductClick(p.id)}>
                {badge && (
                  <div className={`absolute -top-1 -right-1 z-10 ${badge.color} text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-tight max-w-[80px] text-center`}>
                    {badge.text}
                  </div>
                )}
                <ProductCard product={p} />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}