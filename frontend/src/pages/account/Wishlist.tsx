import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Heart, Share2, Copy, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { userService } from '@/services/user.service'
import ProductCard from '@/components/product/ProductCard'
import Spinner from '@/components/ui/Spinner'
import api from '@/lib/api'
import toast from 'react-hot-toast'

export default function Wishlist() {
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['wishlist'],
    queryFn:  () => userService.getWishlist().then(r => r.data.data),
  })

  const { mutate: shareWishlist, isPending: sharing } = useMutation({
    mutationFn: () => {
      // Build productIds from current wishlist items
      const productIds = (data || []).map((item: any) => item.productId)
      return api.post('/features/wishlists/share', {
        name: 'My Wishlist',
        productIds,
      }).then(r => r.data.data)
    },
    onSuccess: (resData: any) => {
      const token = resData.shareToken || resData.token
      const url = `${window.location.origin}/wishlist/${token}`
      setShareUrl(url)
    },
    onError: () => toast.error('Failed to generate share link'),
  })

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div>
      {data?.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">{data.length} saved items</p>
          <div className="flex items-center gap-2">
            {shareUrl ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                <span className="text-xs text-gray-600 max-w-[180px] truncate">{shareUrl}</span>
                <button onClick={copyLink} className="text-green-primary hover:text-green-dark flex-shrink-0">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            ) : (
              <button
                onClick={() => shareWishlist()}
                disabled={sharing}
                className="flex items-center gap-1.5 text-sm font-semibold text-green-primary hover:text-green-dark transition-colors disabled:opacity-50"
              >
                <Share2 size={15} /> {sharing ? 'Generating...' : 'Share Wishlist'}
              </button>
            )}
          </div>
        </div>
      )}

      {!data?.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <Heart size={48} className="text-gray-200 mx-auto mb-4" />
          <h3 className="font-bold text-gray-700 mb-2">Your wishlist is empty</h3>
          <p className="text-gray-400 text-sm mb-4">Save products you love!</p>
          <Link to="/products" className="text-green-primary font-semibold hover:underline">Browse Products →</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.map((item: { productId: string; product: Parameters<typeof ProductCard>[0]['product'] }) => (
            <ProductCard key={item.productId} product={item.product} />
          ))}
        </div>
      )}
    </div>
  )
}
