/**
 * PostCard.tsx — Individual post in the social commerce feed
 * Shows: video/image, seller info, caption, tagged products with buy buttons
 * Tracks interactions for feed ranking
 */
import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart, Zap, MessageCircle, Store, Play, ChevronRight, MapPin } from 'lucide-react'
import api from '@/lib/api'
import { useCart } from '@/hooks/useCart'
import { useAuth } from '@/hooks/useAuth'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Props {
  post: any
}

export default function PostCard({ post }: Props) {
  const { add } = useCart()
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(post.products?.[0] || null)
  const [showProductSheet, setShowProductSheet] = useState(false)
  const [interacted, setInteracted] = useState(false)

  // Track view when post enters viewport
  useEffect(() => {
    if (!cardRef.current || interacted) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !interacted) {
          setInteracted(true)
          api.post(`/posts/${post.id}/interact`, { type: 'VIEW' }).catch(() => {})
        }
      },
      { threshold: 0.5 }
    )
    obs.observe(cardRef.current)
    return () => obs.disconnect()
  }, [post.id, interacted])

  // Auto-play video when in viewport
  useEffect(() => {
    if (post.type !== 'VIDEO' || !videoRef.current) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => {})
        } else {
          videoRef.current?.pause()
          setIsPlaying(false)
        }
      },
      { threshold: 0.7 }
    )
    obs.observe(videoRef.current)
    return () => obs.disconnect()
  }, [post.type])

  const trackClick = () => {
    api.post(`/posts/${post.id}/interact`, { type: 'CLICK' }).catch(() => {})
  }

  const handleAddToCart = (product: any) => {
    add({
      id: product.productId || product.id,
      name: product.name,
      price: product.price,
      images: product.images,
      unit: product.unit,
      stock: product.stock,
      slug: product.slug,
    } as any, 1)
    api.post(`/posts/${post.id}/interact`, { type: 'CART_ADD' }).catch(() => {})
    toast.success(`${product.name} added to cart! 🛒`)
  }

  const handleBuyNow = (product: any) => {
    if (!isAuthenticated) { toast.error('Sign in to buy'); navigate('/login'); return }
    add({
      id: product.productId || product.id,
      name: product.name,
      price: product.price,
      images: product.images,
      unit: product.unit,
      stock: product.stock,
      slug: product.slug,
    } as any, 1)
    api.post(`/posts/${post.id}/interact`, { type: 'CART_ADD' }).catch(() => {})
    navigate('/checkout')
  }

  const handleProductClick = (product: any) => {
    setSelectedProduct(product)
    setShowProductSheet(true)
    trackClick()
  }

  const openChat = () => {
    if (!isAuthenticated) { toast.error('Sign in to chat'); navigate('/login'); return }
    navigate(`/chat?sellerId=${post.sellerDbId || post.sellerId}`)
  }

  return (
    <div ref={cardRef} className="bg-white rounded-3xl shadow-card overflow-hidden">
      {/* Seller header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Link to={`/sellers/${post.sellerSlug}`}
          className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-primary overflow-hidden flex-shrink-0">
          {post.sellerLogo
            ? <img src={post.sellerLogo} className="w-full h-full object-cover" alt="" />
            : post.sellerName?.[0]
          }
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/sellers/${post.sellerSlug}`}
            className="font-bold text-gray-900 text-sm hover:text-green-primary transition-colors">
            {post.sellerName}
          </Link>
          {post.sellerCity && (
            <p className="text-xs text-gray-400 flex items-center gap-0.5">
              <MapPin size={10} /> {post.sellerCity}
            </p>
          )}
        </div>
        <button onClick={openChat}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-primary border border-gray-200 hover:border-green-primary px-3 py-1.5 rounded-full transition-colors">
          <MessageCircle size={13} /> Ask
        </button>
      </div>

      {/* Media */}
      <div className="relative bg-gray-900 cursor-pointer" onClick={() => post.type === 'VIDEO' && videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}>
        {post.type === 'VIDEO' ? (
          <div className="relative aspect-[4/5]">
            <video
              ref={videoRef}
              src={post.mediaUrl}
              poster={post.thumbnailUrl}
              loop muted playsInline
              className="w-full h-full object-cover"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-black/40 rounded-full flex items-center justify-center">
                  <Play size={28} className="text-white ml-1" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="aspect-[4/5]">
            <img src={post.mediaUrl} alt={post.caption || 'Product post'}
              className="w-full h-full object-cover" />
          </div>
        )}

        {/* Product tags on media (tap to open product) */}
        {post.products?.map((product: any) => (
          product.tagX !== null && product.tagY !== null && (
            <button
              key={product.productId || product.id}
              onClick={(e) => { e.stopPropagation(); handleProductClick(product) }}
              className="absolute w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center border-2 border-green-primary hover:scale-110 transition-transform"
              style={{ left: `${product.tagX}%`, top: `${product.tagY}%`, transform: 'translate(-50%, -50%)' }}>
              <ShoppingCart size={14} className="text-green-primary" />
            </button>
          )
        ))}
      </div>

      {/* Caption */}
      {(post.caption || post.captionAm) && (
        <div className="px-4 pt-3">
          {post.caption && <p className="text-sm text-gray-800 leading-relaxed">{post.caption}</p>}
          {post.captionAm && <p className="text-sm text-gray-500 mt-0.5">{post.captionAm}</p>}
        </div>
      )}

      {/* Tagged products strip */}
      {post.products?.length > 0 && (
        <div className="px-4 py-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {post.products.map((product: any) => {
              const pid = product.productId || product.id
              const discount = product.comparePrice && product.comparePrice > product.price
                ? Math.round((1 - product.price / product.comparePrice) * 100) : 0

              return (
                <div key={pid}
                  className="flex-shrink-0 bg-gray-50 rounded-2xl overflow-hidden border border-gray-100 hover:border-green-200 transition-all"
                  style={{ width: post.products.length === 1 ? '100%' : '200px' }}>
                  <div className="flex items-center gap-3 p-3">
                    {/* Product image */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer"
                      onClick={() => handleProductClick(product)}>
                      {product.images?.[0]
                        ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                        : <span className="flex items-center justify-center h-full text-2xl">🛒</span>
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleProductClick(product)}>
                      <p className="font-bold text-gray-900 text-sm truncate">{product.name}</p>
                      {product.nameAm && <p className="text-gray-400 text-[10px] truncate">{product.nameAm}</p>}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-extrabold text-green-primary text-sm">ETB {product.price}</span>
                        <span className="text-gray-400 text-[10px]">/{product.unit}</span>
                        {discount > 0 && (
                          <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">-{discount}%</span>
                        )}
                      </div>
                      {product.stock <= 5 && product.stock > 0 && (
                        <p className="text-[10px] text-orange-500 font-bold">Only {product.stock} left</p>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  {product.stock > 0 ? (
                    <div className="flex border-t border-gray-100">
                      <button onClick={() => handleAddToCart(product)}
                        className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-bold text-green-primary hover:bg-green-50 transition-colors border-r border-gray-100">
                        <ShoppingCart size={12} /> Cart
                      </button>
                      <button onClick={() => handleBuyNow(product)}
                        className="flex-1 flex items-center justify-center gap-1 py-2.5 text-xs font-bold text-white bg-green-primary hover:bg-green-dark transition-colors">
                        <Zap size={12} /> Buy Now
                      </button>
                    </div>
                  ) : (
                    <div className="border-t border-gray-100 py-2.5 text-center text-xs text-gray-400 font-semibold">
                      Out of Stock
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4 px-4 pb-3 text-[10px] text-gray-400">
        <span>{post.views} views</span>
        <span>{post.clicks} clicks</span>
        <span className="text-green-primary font-bold">{post.purchases} sold</span>
        <Link to={`/posts/${post.id}`} className="ml-auto flex items-center gap-0.5 hover:text-green-primary transition-colors">
          View post <ChevronRight size={11} />
        </Link>
      </div>

      {/* Product detail bottom sheet */}
      {showProductSheet && selectedProduct && (
        <ProductSheet
          product={selectedProduct}
          postId={post.id}
          onClose={() => setShowProductSheet(false)}
          onAddCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          onChat={openChat}
        />
      )}
    </div>
  )
}

// ── Product detail bottom sheet ───────────────────────────────────────────────
function ProductSheet({ product, postId, onClose, onAddCart, onBuyNow, onChat }: any) {
  const discount = product.comparePrice && product.comparePrice > product.price
    ? Math.round((1 - product.price / product.comparePrice) * 100) : 0

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 pb-8"
        onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <div className="flex items-start gap-4 mb-5">
          {/* Image */}
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0">
            {product.images?.[0]
              ? <img src={product.images[0]} className="w-full h-full object-cover" alt="" />
              : <span className="flex items-center justify-center h-full text-3xl">🛒</span>
            }
          </div>

          {/* Info */}
          <div className="flex-1">
            <p className="font-extrabold text-gray-900 text-lg leading-tight">{product.name}</p>
            {product.nameAm && <p className="text-gray-400 text-sm">{product.nameAm}</p>}
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-extrabold text-green-primary">ETB {product.price}</span>
              <span className="text-gray-400 text-sm">/{product.unit}</span>
              {discount > 0 && (
                <span className="text-sm text-gray-400 line-through">ETB {product.comparePrice}</span>
              )}
            </div>
            {discount > 0 && (
              <span className="text-xs bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full">
                -{discount}% OFF
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <p className="text-sm text-gray-600 mb-4 leading-relaxed line-clamp-3">{product.description}</p>
        )}

        {/* Stock */}
        {product.stock <= 10 && product.stock > 0 && (
          <p className="text-sm text-orange-500 font-bold mb-4">🔥 Only {product.stock} {product.unit} left!</p>
        )}

        {/* Actions */}
        {product.stock > 0 ? (
          <div className="space-y-3">
            <div className="flex gap-3">
              <button onClick={() => { onAddCart(product); onClose() }}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 border-2 border-green-primary text-green-primary font-bold rounded-2xl hover:bg-green-50 transition-colors">
                <ShoppingCart size={16} /> Add to Cart
              </button>
              <button onClick={() => { onBuyNow(product); onClose() }}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-green-primary text-white font-bold rounded-2xl hover:bg-green-dark transition-colors">
                <Zap size={16} /> Buy Now
              </button>
            </div>
            <button onClick={() => { onChat(); onClose() }}
              className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-600 font-semibold rounded-2xl hover:border-green-primary hover:text-green-primary transition-colors text-sm">
              <MessageCircle size={15} /> Ask Seller a Question
            </button>
            <Link to={`/products/${product.slug}`} onClick={onClose}
              className="block w-full text-center text-sm text-gray-400 hover:text-green-primary transition-colors py-1">
              View full product page →
            </Link>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500 font-semibold mb-3">This product is out of stock</p>
            <button onClick={() => { onChat(); onClose() }}
              className="flex items-center justify-center gap-2 mx-auto py-3 px-6 border border-gray-200 text-gray-600 font-semibold rounded-2xl hover:border-green-primary hover:text-green-primary transition-colors text-sm">
              <MessageCircle size={15} /> Ask Seller When Available
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
