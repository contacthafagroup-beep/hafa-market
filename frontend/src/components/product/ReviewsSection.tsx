import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Star, ThumbsUp, ThumbsDown, Send, CheckCircle, ShieldCheck } from 'lucide-react'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Props { product: any; isAuthenticated: boolean }

export default function ReviewsSection({ product, isAuthenticated }: Props) {
  const qc = useQueryClient()
  const [sort, setSort]         = useState('helpful')
  const [verified, setVerified] = useState(false)
  const [reviewText, setReviewText]     = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewImages, setReviewImages] = useState<string[]>([])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reviews', product.id, sort, verified],
    queryFn: () => api.get(`/reviews/product/${product.id}`, {
      params: { sort, verified: verified ? 'true' : undefined, limit: 20 },
    }).then(r => r.data),
    enabled: !!product.id,
  })

  const { data: aiSummary } = useQuery({
    queryKey: ['review-summary', product.id],
    queryFn: () => api.get(`/reviews/product/${product.id}/summary`).then(r => r.data.data),
    enabled: !!product.id && (product.reviewCount || 0) >= 3,
    staleTime: 1000 * 60 * 30,
  })

  const { mutate: submitReview, isLoading: submitting } = useMutation({
    mutationFn: () => api.post('/reviews', { productId: product.id, rating: reviewRating, comment: reviewText, images: reviewImages }),
    onSuccess: () => { toast.success('Review submitted!'); setReviewText(''); setReviewImages([]); refetch() },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to submit'),
  })

  const { mutate: voteReview } = useMutation({
    mutationFn: ({ id, isHelpful }: { id: string; isHelpful: boolean }) =>
      api.post(`/reviews/${id}/vote`, { isHelpful }),
    onSuccess: () => refetch(),
  })

  const reviews = data?.data || []
  const dist    = data?.ratingDistribution || {}
  const total   = Object.values(dist).reduce((s: number, v: any) => s + v, 0) as number

  return (
    <div className="space-y-6">
      {/* AI Summary */}
      {aiSummary?.summary && (
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">🤖</span>
          <div>
            <p className="text-xs font-bold text-purple-700 mb-1">AI Review Summary</p>
            <p className="text-sm text-purple-800">{aiSummary.summary}</p>
            <p className="text-xs text-purple-500 mt-1">{aiSummary.reviewCount} reviews · {aiSummary.avgRating}★ average</p>
          </div>
        </div>
      )}

      {/* Rating distribution */}
      {total > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center gap-6">
            <div className="text-center flex-shrink-0">
              <div className="text-4xl font-black text-gray-900">{product.rating?.toFixed(1)}</div>
              <div className="flex justify-center gap-0.5 my-1">
                {[1,2,3,4,5].map(s => <Star key={s} size={14} className={s <= Math.round(product.rating||0) ? 'fill-orange-400 text-orange-400' : 'text-gray-200'} />)}
              </div>
              <div className="text-xs text-gray-400">{total} reviews</div>
            </div>
            <div className="flex-1 space-y-1.5">
              {[5,4,3,2,1].map(star => {
                const count = (dist as any)[star] || 0
                const pct   = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-3">{star}</span>
                    <Star size={10} className="fill-orange-400 text-orange-400 flex-shrink-0" />
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-6 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Sort + filter controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {[['helpful','Most Helpful'],['newest','Newest'],['highest','Highest'],['lowest','Lowest']].map(([v,l]) => (
            <button key={v} onClick={() => setSort(v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${sort===v ? 'bg-green-primary text-white border-green-primary' : 'border-gray-200 text-gray-500 hover:border-green-primary'}`}>
              {l}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 cursor-pointer ml-auto">
          <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="accent-green-primary" />
          <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
            <CheckCircle size={12} className="text-green-primary" /> Verified only
          </span>
        </label>
      </div>

      {/* Write review */}
      {isAuthenticated && (
        <div className="bg-green-50 rounded-2xl p-5">
          <h4 className="font-bold text-gray-800 mb-3">Write a Review</h4>
          <div className="flex gap-1 mb-3">
            {[1,2,3,4,5].map(s => (
              <button key={s} onClick={() => setReviewRating(s)}>
                <Star size={26} className={s <= reviewRating ? 'fill-orange-400 text-orange-400' : 'text-gray-300'} />
              </button>
            ))}
          </div>
          <textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
            placeholder="Share your experience with this product..."
            rows={3} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none mb-3" />
          <label className="flex items-center gap-2 cursor-pointer bg-white border border-dashed border-gray-200 rounded-xl p-2 mb-3 hover:border-green-primary transition-colors text-sm text-gray-500">
            📷 Add photos (optional)
            <input type="file" accept="image/*" multiple className="hidden"
              onChange={async e => {
                const files = Array.from(e.target.files || [])
                for (const file of files) {
                  const fd = new FormData(); fd.append('file', file)
                  try { const res = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); setReviewImages(prev => [...prev, res.data.data.url]) } catch {}
                }
              }} />
          </label>
          {reviewImages.length > 0 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {reviewImages.map((img, i) => (
                <div key={i} className="relative">
                  <img src={img} className="w-14 h-14 rounded-lg object-cover" alt="" />
                  <button onClick={() => setReviewImages(prev => prev.filter((_,j) => j!==i))}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">×</button>
                </div>
              ))}
            </div>
          )}
          <Button onClick={() => submitReview()} loading={submitting} size="sm" disabled={!reviewText.trim()}>
            <Send size={14} /> Submit Review
          </Button>
        </div>
      )}

      {/* Reviews list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Star size={32} className="mx-auto mb-2 opacity-30" />
          <p>No reviews yet. Be the first to review!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((r: any) => (
            <div key={r.id} className={`bg-gray-50 rounded-2xl p-4 ${r.isSuspicious ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-3 mb-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-primary to-green-mid flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  {r.user?.avatar ? <img src={r.user.avatar} className="w-full h-full rounded-full object-cover" alt="" /> : r.user?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-gray-800">{r.user?.name}</span>
                    {/* Verified purchase badge */}
                    {r.isVerified && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                        <CheckCircle size={9} /> Verified Purchase
                      </span>
                    )}
                    {/* Unverified signal — subtle, not alarming */}
                    {!r.isVerified && (
                      <span className="text-[10px] text-gray-400 px-2 py-0.5 rounded-full bg-gray-100">
                        Unverified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => <Star key={s} size={11} className={s <= r.rating ? 'fill-orange-400 text-orange-400' : 'text-gray-200'} />)}
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(r.createdAt)}</span>
                  </div>
                </div>
              </div>

              {r.comment && <p className="text-sm text-gray-700 mb-3 leading-relaxed">{r.comment}</p>}

              {/* Review images */}
              {r.images?.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {r.images.map((img: string, i: number) => (
                    <img key={i} src={img} className="w-16 h-16 rounded-xl object-cover cursor-pointer hover:opacity-90" alt="" />
                  ))}
                </div>
              )}

              {/* Seller response */}
              {r.sellerResponse && (
                <div className="bg-white border border-green-100 rounded-xl p-3 mb-3">
                  <p className="text-xs font-bold text-green-primary mb-1 flex items-center gap-1">
                    <ShieldCheck size={11} /> Seller Response
                  </p>
                  <p className="text-xs text-gray-600">{r.sellerResponse}</p>
                </div>
              )}

              {/* Helpful votes */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">Helpful?</span>
                <button onClick={() => voteReview({ id: r.id, isHelpful: true })}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-primary transition-colors">
                  <ThumbsUp size={13} /> {r.helpfulVotes || 0}
                </button>
                <button onClick={() => voteReview({ id: r.id, isHelpful: false })}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors">
                  <ThumbsDown size={13} /> {r.unhelpfulVotes || 0}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
