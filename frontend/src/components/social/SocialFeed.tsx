/**
 * SocialFeed.tsx — Community activity feed
 * Shows: purchases from followed sellers, trending products, UGC photos
 * Appears on the Home page between Featured Products and Recommendations
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ShoppingCart, Camera, Heart, TrendingUp, Users, ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { formatPrice } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'

const EVENT_CONFIG: Record<string, { icon: string; color: string; verb: string }> = {
  PURCHASE:         { icon: '🛒', color: 'bg-green-100 text-green-700',  verb: 'bought' },
  UGC:              { icon: '📸', color: 'bg-purple-100 text-purple-700', verb: 'shared a photo of' },
  REVIEW:           { icon: '⭐', color: 'bg-yellow-100 text-yellow-700', verb: 'reviewed' },
  SHARE_CONVERTED:  { icon: '🤝', color: 'bg-blue-100 text-blue-700',    verb: 'referred a friend who bought' },
  LIVE_JOIN:        { icon: '📺', color: 'bg-red-100 text-red-700',      verb: 'watched live' },
}

function FeedEventCard({ event }: { event: any }) {
  const cfg = EVENT_CONFIG[event.type] || { icon: '🌿', color: 'bg-gray-100 text-gray-600', verb: 'interacted with' }
  const timeAgo = getTimeAgo(event.createdAt)

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {event.userName?.[0]?.toUpperCase() || '?'}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 leading-snug">
          <span className="font-bold">{event.userName?.split(' ')[0] || 'Someone'}</span>
          {' '}<span className="text-gray-500">{cfg.verb}</span>{' '}
          {event.productName && (
            <Link to={`/products/${event.productSlug}`}
              className="font-semibold text-green-primary hover:underline">
              {event.productName}
            </Link>
          )}
        </p>

        {/* Product preview */}
        {event.productImages?.[0] && event.productSlug && (
          <Link to={`/products/${event.productSlug}`}
            className="flex items-center gap-2 mt-2 bg-gray-50 rounded-xl p-2 hover:bg-gray-100 transition-colors">
            <img src={event.productImages[0]} alt={event.productName}
              className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{event.productName}</p>
              {event.productNameAm && <p className="text-[10px] text-gray-400 truncate">{event.productNameAm}</p>}
              {event.productPrice && (
                <p className="text-xs font-bold text-green-primary">ETB {event.productPrice}</p>
              )}
            </div>
          </Link>
        )}

        {/* UGC photo */}
        {event.ugcPhoto?.photoUrl && (
          <div className="mt-2">
            <img src={event.ugcPhoto.photoUrl} alt="Customer photo"
              className="w-full max-h-48 rounded-xl object-cover" />
            {event.ugcPhoto.caption && (
              <p className="text-xs text-gray-500 mt-1 italic">"{event.ugcPhoto.caption}"</p>
            )}
          </div>
        )}

        <p className="text-[10px] text-gray-400 mt-1">{timeAgo}</p>
      </div>

      {/* Event type badge */}
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.color}`}>
        {cfg.icon}
      </span>
    </div>
  )
}

function TrendingCard({ item }: { item: any }) {
  return (
    <Link to={`/products/${item.slug}`}
      className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-green-200 hover:shadow-sm transition-all">
      <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0">
        {item.images?.[0]
          ? <img src={item.images[0]} className="w-full h-full object-cover" alt="" />
          : <span className="flex items-center justify-center h-full text-xl">🛒</span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
        <p className="text-xs text-green-primary font-bold">ETB {item.price}</p>
        <p className="text-[10px] text-gray-400 flex items-center gap-1">
          <TrendingUp size={9} /> {Number(item.activityCount)} activities today
        </p>
      </div>
    </Link>
  )
}

export default function SocialFeed() {
  const { isAuthenticated } = useAuth()

  const { data: feed = [], isLoading: feedLoading } = useQuery({
    queryKey: ['social-feed'],
    queryFn: () => api.get('/social/feed?limit=10').then(r => r.data.data || []),
    staleTime: 60000,
    refetchInterval: 120000,
  })

  const { data: trending = [] } = useQuery({
    queryKey: ['social-trending'],
    queryFn: () => api.get('/social/feed/trending').then(r => r.data.data || []),
    staleTime: 300000,
  })

  if (!feed.length && !trending.length) return null

  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-6">
          <div>
            <p className="text-xs font-bold text-green-primary uppercase tracking-widest mb-1">
              🌍 Community
            </p>
            <h2 className="text-2xl font-extrabold text-gray-800">
              What's Happening in <span className="text-green-primary">Hafa Market</span>
            </h2>
          </div>
          {!isAuthenticated && (
            <Link to="/register" className="text-green-primary font-semibold text-sm flex items-center gap-1 hover:gap-2 transition-all">
              Join Community <ArrowRight size={16} />
            </Link>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Activity feed */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users size={16} className="text-green-primary" />
                <h3 className="font-bold text-gray-900 text-sm">Community Activity</h3>
                <span className="ml-auto text-[10px] text-gray-400">Live updates</span>
              </div>

              {feedLoading ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : feed.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Users size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Be the first to shop and appear here!</p>
                </div>
              ) : (
                <div>
                  {feed.slice(0, 8).map((event: any) => (
                    <FeedEventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Trending sidebar */}
          <div className="space-y-4">
            {trending.length > 0 && (
              <div className="bg-white rounded-2xl shadow-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={16} className="text-orange-500" />
                  <h3 className="font-bold text-gray-900 text-sm">Trending Today</h3>
                </div>
                <div className="space-y-2">
                  {trending.slice(0, 5).map((item: any, i: number) => (
                    <div key={item.productId} className="flex items-center gap-2">
                      <span className={`text-xs font-black w-5 text-center ${i < 3 ? 'text-orange-500' : 'text-gray-400'}`}>
                        {i + 1}
                      </span>
                      <TrendingCard item={item} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Share to earn CTA */}
            <div className="bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl p-5 text-white">
              <div className="text-2xl mb-2">💰</div>
              <h3 className="font-extrabold text-lg mb-1">Share & Earn</h3>
              <p className="text-white/80 text-sm mb-3">
                Share products with friends. Earn ETB 10 every time they buy!
              </p>
              <Link to="/products"
                className="inline-flex items-center gap-1.5 bg-white text-green-700 font-bold text-sm px-4 py-2 rounded-xl hover:bg-green-50 transition-colors">
                Start Sharing <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
