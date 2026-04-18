import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { formatPrice } from '@/lib/utils'
import api from '@/lib/api'

// Get recently viewed from localStorage (set by ProductDetail analytics)
function getRecentlyViewedIds(): string[] {
  try {
    const data = JSON.parse(localStorage.getItem('hafa_behavior') || '{}')
    const views = data.productViews || {}
    return Object.entries(views)
      .sort((a: any, b: any) => b[1] - a[1])
      .slice(0, 8)
      .map(([id]) => id)
  } catch { return [] }
}

export default function RecentlyViewed() {
  const ids = getRecentlyViewedIds()

  const { data: products = [] } = useQuery({
    queryKey: ['recently-viewed', ids.join(',')],
    queryFn: async () => {
      if (!ids.length) return []
      const results = await Promise.all(
        ids.slice(0, 6).map(id =>
          api.get(`/products/${id}`).then(r => r.data.data).catch(() => null)
        )
      )
      return results.filter(Boolean)
    },
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  if (!products.length) return null

  return (
    <section className="py-10 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-2 mb-5">
          <Clock size={18} className="text-gray-400" />
          <h2 className="text-lg font-extrabold text-gray-800">Recently Viewed</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
          {products.map((p: any) => (
            <Link key={p.id} to={`/products/${p.slug}`}
              className="flex-shrink-0 w-36 bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden group">
              <div className="h-28 bg-gray-50 overflow-hidden">
                {p.images?.[0]
                  ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  : <div className="w-full h-full flex items-center justify-center text-4xl">🛒</div>
                }
              </div>
              <div className="p-2.5">
                <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug group-hover:text-green-primary transition-colors">{p.name}</p>
                <p className="text-xs font-extrabold text-green-primary mt-1">{formatPrice(p.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
