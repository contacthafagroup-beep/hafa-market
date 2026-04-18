import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Star, MapPin, Package, Send, ShieldCheck, Layers, Bell, BellOff, Video } from 'lucide-react'
import api from '@/lib/api'
import ProductCard from '@/components/product/ProductCard'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { formatDate } from '@/lib/utils'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function SellerStore() {
  const { slug } = useParams<{ slug: string }>()
  const { isAuthenticated } = useAuth()
  const qc = useQueryClient()
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [activeTab, setActiveTab] = useState<'products'|'collections'|'reviews'>('products')

  const { data: seller, isLoading } = useQuery({
    queryKey: ['seller', slug],
    queryFn:  () => api.get(`/sellers/${slug}`).then(r => r.data.data),
    enabled:  !!slug,
  })

  const { data: trustData } = useQuery({
    queryKey: ['seller-trust', seller?.id],
    queryFn:  () => api.get(`/reviews/seller/${seller!.id}/trust-score`).then(r => r.data.data),
    enabled:  !!seller?.id,
    staleTime: 1000 * 60 * 10,
  })

  // Feature 8: Seller tier
  const { data: tierData } = useQuery({
    queryKey: ['seller-tier', seller?.id],
    queryFn:  () => api.get(`/features/seller-tier/${seller!.id}`).then(r => r.data.data),
    enabled:  !!seller?.id,
    staleTime: 1000 * 60 * 10,
  })

  // Follow status
  const { data: followData } = useQuery({
    queryKey: ['seller-follow', seller?.id],
    queryFn:  () => api.get(`/live/sellers/${seller!.id}/follow`).then(r => r.data),
    enabled:  !!seller?.id,
    staleTime: 1000 * 60 * 5,
  })

  const { mutate: toggleFollow, isPending: followLoading } = useMutation({
    mutationFn: () => followData?.following
      ? api.delete(`/live/sellers/${seller!.id}/follow`)
      : api.post(`/live/sellers/${seller!.id}/follow`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller-follow', seller?.id] })
      toast.success(followData?.following ? 'Unfollowed' : '🔔 Following! You\'ll be notified when they go live.')
    },
  })

  const { data: collections = [] } = useQuery({
    queryKey: ['seller-collections', slug],
    queryFn:  () => api.get(`/features/collections/${slug}`).then(r => r.data.data),
    enabled:  !!slug,
  })

  const { data: reviews, refetch } = useQuery({
    queryKey: ['seller-reviews', seller?.id],
    queryFn:  () => api.get(`/reviews/seller/${seller!.id}`).then(r => r.data.data),
    enabled:  !!seller?.id,
  })

  const { mutate: submitReview, isPending: submitting } = useMutation({
    mutationFn: () => api.post('/reviews/seller', { sellerId: seller!.id, rating: reviewRating, comment: reviewText }),
    onSuccess: () => { toast.success('Review submitted!'); setReviewText(''); refetch() },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to submit review'),
  })

  if (isLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>
  if (!seller)   return <div className="text-center py-32 text-gray-400">Store not found</div>

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-gradient-to-br from-green-dark to-green-primary rounded-3xl p-8 text-white mb-8">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 rounded-2xl bg-white/20 flex items-center justify-center text-4xl font-black flex-shrink-0">
            {seller.logo
              ? <img src={seller.logo} className="w-full h-full rounded-2xl object-cover" alt="" />
              : seller.storeName?.[0]
            }
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-extrabold">{seller.storeName}</h1>
              {trustData?.badge && (
                <span className="flex items-center gap-1.5 bg-white/20 border border-white/30 text-white text-xs font-bold px-3 py-1 rounded-full">
                  <ShieldCheck size={13} /> {trustData.badge}
                </span>
              )}
              {tierData?.tier && (
                <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border ${
                  tierData.tier === 'PLATINUM' ? 'bg-purple-500/30 border-purple-300/50 text-white' :
                  tierData.tier === 'GOLD'     ? 'bg-yellow-500/30 border-yellow-300/50 text-white' :
                  tierData.tier === 'SILVER'   ? 'bg-gray-300/30 border-gray-200/50 text-white' :
                  'bg-orange-500/30 border-orange-300/50 text-white'
                }`}>
                  {tierData.tier === 'PLATINUM' ? '💎' : tierData.tier === 'GOLD' ? '🥇' : tierData.tier === 'SILVER' ? '🥈' : '🥉'} {tierData.tier}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 text-white/80 text-sm flex-wrap">
              <span className="flex items-center gap-1"><Star size={14} className="fill-orange-300 text-orange-300" />{seller.rating?.toFixed(1)}</span>
              <span className="flex items-center gap-1"><Package size={14} />{seller.totalSales} sales</span>
              {seller.city && <span className="flex items-center gap-1"><MapPin size={14} />{seller.city}, {seller.country}</span>}
              {followData && (
                <span className="text-white/60 text-xs">{followData.followerCount} followers</span>
              )}
            </div>
            {seller.description && <p className="mt-2 text-white/70 text-sm max-w-xl">{seller.description}</p>}
            {trustData && (
              <div className="flex items-center gap-4 mt-3 text-xs text-white/60">
                <span>⭐ Trust Score: <strong className="text-white">{trustData.trustScore}/100</strong></span>
                <span>✅ Fulfillment: <strong className="text-white">{trustData.fulfillRate}%</strong></span>
                <span>📝 {trustData.reviewCount} reviews</span>
              </div>
            )}
          </div>

          {/* Follow button + Live link */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            {isAuthenticated && (
              <button
                onClick={() => toggleFollow()}
                disabled={followLoading}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                  followData?.following
                    ? 'bg-white/20 border-white/40 text-white hover:bg-red-500/30 hover:border-red-300'
                    : 'bg-white text-green-dark border-white hover:bg-green-50'
                }`}
              >
                {followData?.following
                  ? <><BellOff size={14} /> Following</>
                  : <><Bell size={14} /> Follow</>
                }
              </button>
            )}
            <Link to="/live"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-red-500/80 border-2 border-red-400/50 text-white hover:bg-red-500 transition-all">
              <Video size={14} /> Live Sessions
            </Link>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-extrabold text-gray-900 mb-5">Products from {seller.storeName}</h2>
      {seller.products?.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-10">
          {seller.products.map((p: Parameters<typeof ProductCard>[0]['product']) => <ProductCard key={p.id} product={p} />)}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400 mb-10">No products listed yet</div>
      )}      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[
          { key: 'products', label: `Products (${seller.products?.length || 0})`, icon: <Package size={15} /> },
          { key: 'collections', label: `Collections (${collections.length})`, icon: <Layers size={15} /> },
          { key: 'reviews', label: 'Reviews', icon: <Star size={15} /> },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-1.5 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${activeTab === tab.key ? 'border-green-primary text-green-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'products' && (
        seller.products?.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-10">
            {seller.products.map((p: Parameters<typeof ProductCard>[0]['product']) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400 mb-10">No products listed yet</div>
        )
      )}

      {activeTab === 'collections' && (
        <div className="space-y-8 mb-10">
          {!collections.length ? (
            <div className="text-center py-16 text-gray-400">No collections yet</div>
          ) : collections.map((col: any) => (
            <div key={col.id}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{col.emoji || '📦'}</span>
                <div>
                  <h3 className="font-extrabold text-gray-900">{col.name}</h3>
                  {col.description && <p className="text-sm text-gray-400">{col.description}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {col.products?.map((p: any) => <ProductCard key={p.id} product={p} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'reviews' && (
      <div className="max-w-2xl">
        <h2 className="text-xl font-extrabold text-gray-900 mb-5">Customer Reviews</h2>

        {isAuthenticated && (
          <div className="bg-green-50 rounded-2xl p-5 mb-6">
            <h4 className="font-bold text-gray-800 mb-3">Rate this seller</h4>
            <div className="flex gap-1 mb-3">
              {[1,2,3,4,5].map(s => (
                <button key={s} onClick={() => setReviewRating(s)}>
                  <Star size={24} className={s <= reviewRating ? 'fill-orange-400 text-orange-400' : 'text-gray-300'} />
                </button>
              ))}
            </div>
            <textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
              placeholder="Share your experience with this seller..."
              rows={3} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none mb-3" />
            <Button onClick={() => submitReview()} loading={submitting} size="sm">
              <Send size={14} /> Submit Review
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {reviews?.map((r: any) => (
            <div key={r.id} className="bg-white rounded-2xl shadow-card p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-green-100 text-green-primary font-bold text-sm flex items-center justify-center">
                  {r.user?.name?.[0] || '?'}
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-800">{r.user?.name}</div>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(s => <Star key={s} size={11} className={s <= r.rating ? 'fill-orange-400 text-orange-400' : 'text-gray-200'} />)}
                  </div>
                </div>
                <span className="ml-auto text-xs text-gray-400">{formatDate(r.createdAt)}</span>
              </div>
              {r.comment && <p className="text-sm text-gray-600">{r.comment}</p>}
            </div>
          ))}
          {!reviews?.length && <p className="text-gray-400 text-sm text-center py-6">No reviews yet. Be the first to review!</p>}
        </div>
      </div>
      )}
    </div>
  )
}
