import { useState, useRef, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Star, Heart, ShoppingCart, Truck, Shield, RotateCcw, Plus, Minus, Store, Bell, ZoomIn, Send, Zap, Share2, Package } from 'lucide-react'
import { productService } from '@/services/product.service'
import { useCart } from '@/hooks/useCart'
import { useWishlist } from '@/hooks/useWishlist'
import { useAuth } from '@/hooks/useAuth'
import { formatPrice, formatDate, cn } from '@/lib/utils'
import { setPriceAlert, hasAlert } from '@/hooks/usePriceAlerts'
import { analytics } from '@/lib/analytics'
import ProductCard from '@/components/product/ProductCard'
import RecommendationSection from '@/components/ui/RecommendationSection'
import ReviewsSection from '@/components/product/ReviewsSection'
import QASection from '@/components/product/QASection'
import CROSignals from '@/components/product/CROSignals'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import OneClickCheckout from '@/components/ui/OneClickCheckout'
import ProductViewer360 from '@/components/ui/ProductViewer360'
import { useCROSignals } from '@/hooks/useCROSignals'
import ShareToEarn from '@/components/social/ShareToEarn'
import UGCPhotos from '@/components/social/UGCPhotos'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { io as socketIO } from 'socket.io-client'

// ─── Frequently Bought Together ───────────────────────────────────────────────
function FrequentlyBoughtTogether({ productId, currentProduct }: { productId: string; currentProduct: any }) {
  const { add } = useCart()

  const { data: related = [] } = useQuery({
    queryKey: ['fbt', productId],
    queryFn: () => api.get('/ai/recommendations/engine', {
      params: { context: 'product', productId, limit: 3 },
    }).then(r => r.data.data?.slice(0, 2) || []),
    staleTime: 1000 * 60 * 15,
  })

  if (!related.length) return null

  const allProducts = [currentProduct, ...related]
  const bundleTotal = allProducts.reduce((sum: number, p: any) => sum + p.price, 0)

  return (
    <div className="bg-white rounded-2xl shadow-card p-6 mb-10">
      <h3 className="font-extrabold text-gray-900 mb-5 flex items-center gap-2">
        🛒 Frequently Bought Together
      </h3>
      <div className="flex items-center gap-3 flex-wrap mb-5">
        {allProducts.map((p: any, i: number) => (
          <div key={p.id} className="flex items-center gap-3">
            <div className="text-center">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-50 mb-1">
                {p.images?.[0]
                  ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-2xl">🛒</div>
                }
              </div>
              <p className="text-xs font-semibold text-gray-700 max-w-[80px] truncate">{p.name}</p>
              <p className="text-xs font-bold text-green-primary">{formatPrice(p.price)}</p>
            </div>
            {i < allProducts.length - 1 && (
              <span className="text-2xl text-gray-300 font-light">+</span>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 flex-wrap">
        <div>
          <p className="text-xs text-gray-400">Bundle total</p>
          <p className="text-xl font-extrabold text-green-primary">{formatPrice(bundleTotal)}</p>
        </div>
        <Button onClick={() => {
          related.forEach((p: any) => add(p, 1))
          toast.success(`${related.length} items added to cart!`)
        }}>
          <ShoppingCart size={16} /> Add All to Cart
        </Button>
      </div>
    </div>
  )
}

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [qty, setQty]           = useState(1)
  const [imgIdx, setImgIdx]     = useState(0)
  const [tab, setTab]           = useState<'desc'|'reviews'|'qa'>('desc')
  const [zoom, setZoom]         = useState(false)
  const [zoomPos, setZoomPos]   = useState({ x: 50, y: 50 })
  const [alertPrice, setAlertPrice] = useState('')
  const [showAlert, setShowAlert]   = useState(false)
  const [reviewText, setReviewText] = useState('')
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewImages, setReviewImages] = useState<string[]>([])
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [liveStock, setLiveStock] = useState<number | null>(null)
  const [priceFlash, setPriceFlash] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [stockAlertEmail, setStockAlertEmail] = useState('')
  const [showStockAlert, setShowStockAlert] = useState(false)
  const [stockAlertSent, setStockAlertSent] = useState(false)
  const imgRef = useRef<HTMLDivElement>(null)
  const { add }               = useCart()
  const { isInWishlist, toggle } = useWishlist()
  const { isAuthenticated, user }   = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', slug],
    queryFn:  () => productService.getProduct(slug!).then(r => r.data.data),
    enabled:  !!slug,
  })

  // CRO signals — live urgency data (viewers, orders today, stock tier, price drop)
  const croSignals = useCROSignals(product?.id)

  useEffect(() => {
    if (product?.id) analytics.productView(product.id, product.seller?.id)
  }, [product?.id])

  // Real-time price/stock updates via Socket.IO
  useEffect(() => {
    if (!product?.id) return
    const token = localStorage.getItem('accessToken')
    const socket = socketIO(
      import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5001',
      { transports: ['websocket'], auth: { token: token || '' }, reconnectionAttempts: 3 }
    )
    socket.on('product:update', (data: any) => {
      if (data.productId !== product.id) return
      if (data.price !== undefined && data.price !== (livePrice ?? product.price)) {
        setLivePrice(data.price)
        setPriceFlash(true)
        setTimeout(() => setPriceFlash(false), 2000)
        toast('💰 Price updated!', { icon: '⚡', duration: 2500 })
      }
      if (data.stock !== undefined) setLiveStock(data.stock)
    })
    return () => { socket.disconnect() }
  }, [product?.id])

  const { data: similar } = useQuery({
    queryKey: ['similar', product?.id],
    queryFn:  () => productService.getSimilar(product!.id).then(r => r.data.data),
    enabled:  !!product?.id,
  })

  const { data: reviews, refetch: refetchReviews } = useQuery({
    queryKey: ['reviews', product?.id],
    queryFn:  () => productService.getReviews(product!.id).then(r => r.data.data),
    enabled:  !!product?.id,
  })

  const { mutate: submitReview, isLoading: submittingReview } = useMutation({
    mutationFn: () => api.post('/reviews', { productId: product!.id, rating: reviewRating, comment: reviewText, images: reviewImages }),
    onSuccess: () => { toast.success('Review submitted!'); setReviewText(''); setReviewImages([]); refetchReviews() },
    onError: () => toast.error('Failed to submit review'),
  })

  const handleZoom = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imgRef.current) return
    const rect = imgRef.current.getBoundingClientRect()
    setZoomPos({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 })
  }

  const handlePriceAlert = () => {
    const price = parseFloat(alertPrice)
    if (!price || price >= product!.price) { toast.error('Enter a price lower than current price'); return }
    setPriceAlert(product!.id, product!.name, price, product!.price)
    setShowAlert(false); setAlertPrice('')
  }

  const handleShare = (platform: string) => {
    const url = window.location.href
    const text = `Check out ${product!.name} on Hafa Market 🌿`
    const links: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      copy: url,
    }
    if (platform === 'copy') {
      navigator.clipboard.writeText(url)
      toast.success('Link copied!')
    } else {
      window.open(links[platform], '_blank')
    }
    // Track external share for A10 ranking boost
    analytics.trackExternalShare(product!.id, platform)
    setShowShareMenu(false)
  }

  const handleStockAlert = async () => {
    if (!stockAlertEmail.trim()) { toast.error('Enter your email'); return }
    try {
      await api.post('/users/newsletter', { email: stockAlertEmail, keyword: `back-in-stock:${product!.id}` })
      setStockAlertSent(true)
      toast.success('We\'ll notify you when it\'s back in stock!')
    } catch { toast.error('Failed to set alert') }
  }

  if (isLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>
  if (!product)  return <div className="text-center py-32 text-gray-400">Product not found</div>

  const inWish   = isInWishlist(product.id)
  const currentPrice = livePrice ?? product.price
  const currentStock = liveStock ?? product.stock
  const discount = product.comparePrice ? Math.round((1 - currentPrice / product.comparePrice) * 100) : 0

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-400 mb-6 flex items-center gap-2">
        <Link to="/" className="hover:text-green-primary">Home</Link> /
        <Link to="/products" className="hover:text-green-primary">Products</Link> /
        <Link to={`/products?category=${product.category?.slug}`} className="hover:text-green-primary capitalize">{product.category?.name}</Link> /
        <span className="text-gray-700 font-medium">{product.name}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-10 mb-16">
        {/* Images with zoom */}
        <div>
          {/* Main image with zoom lens */}
          <div ref={imgRef}
            className="aspect-square bg-gray-50 rounded-3xl overflow-hidden mb-3 relative cursor-zoom-in"
            onMouseEnter={() => setZoom(true)}
            onMouseLeave={() => setZoom(false)}
            onMouseMove={handleZoom}>
            {product.images?.[imgIdx] ? (
              <>
                <img src={product.images[imgIdx]} alt={product.name} className="w-full h-full object-cover" />
                {/* Zoom overlay */}
                {zoom && (
                  <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: `url(${product.images[imgIdx]})`,
                    backgroundSize: '250%',
                    backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                    opacity: 0.95,
                  }} />
                )}
                <div className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-full p-2">
                  <ZoomIn size={16} className="text-gray-600" />
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-8xl">🛒</div>
            )}
          </div>
          {product.images?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {product.images.map((img, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  className={cn('w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all', i === imgIdx ? 'border-green-primary' : 'border-transparent hover:border-gray-300')}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {/* Feature 7: Product video player */}
          {(product as any).videoUrl && (
            <div className="mt-3">
              <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1">🎥 Product Video</p>
              <video
                src={(product as any).videoUrl}
                controls
                className="w-full rounded-2xl bg-black max-h-64"
                preload="metadata"
              />
            </div>
          )}
          {/* 360° Viewer — show when 4+ images available */}
          {product.images?.length >= 4 && (
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 mb-2 flex items-center gap-1.5">
                🔄 360° Interactive View
              </p>
              <ProductViewer360 images={product.images} productName={product.name} />
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            {product.isOrganic && <span className="badge badge-green text-xs">🌿 Organic</span>}
            {discount > 0 && <span className="badge badge-orange text-xs">-{discount}% OFF</span>}
            <span className={cn('badge text-xs', currentStock > 0 ? 'badge-green' : 'bg-red-100 text-red-600')}>
              {currentStock > 0 ? `In Stock (${currentStock} ${product.unit})` : 'Out of Stock'}
            </span>
            {livePrice !== null && <span className="badge text-xs bg-yellow-100 text-yellow-700 flex items-center gap-1"><Zap size={10} /> Live Price</span>}
          </div>

          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-2">{product.name}</h1>
          {product.nameAm && <p className="text-gray-400 text-sm mb-3">{product.nameAm}</p>}
          {/* Feature 17: Harvest date display */}
          {(product as any).harvestDate && (() => {
            const days = Math.floor((Date.now() - new Date((product as any).harvestDate).getTime()) / 86400000)
            return (
              <div className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                🌱 Harvested {days === 0 ? 'today' : `${days} day${days > 1 ? 's' : ''} ago`}
              </div>
            )
          })()}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(s => <Star key={s} size={16} className={s <= Math.floor(product.rating) ? 'fill-orange-400 text-orange-400' : 'text-gray-200'} />)}
            </div>
            <span className="font-bold text-gray-800">{product.rating.toFixed(1)}</span>
            <span className="text-gray-400 text-sm">({product.reviewCount} reviews)</span>
          </div>

          <div className="flex items-baseline gap-3 mb-6">
            <span className={cn('text-4xl font-black text-green-primary transition-all', priceFlash && 'text-orange-500 scale-110')}>{formatPrice(currentPrice)}</span>
            <span className="text-gray-400">/{product.unit}</span>
            {product.comparePrice && <span className="text-xl text-gray-400 line-through">{formatPrice(product.comparePrice)}</span>}
            {(product as any).marketPrice && (product as any).marketPrice > currentPrice && (
              <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-1 rounded-full">
                Market: {formatPrice((product as any).marketPrice)} · You save {Math.round((1 - currentPrice/(product as any).marketPrice)*100)}%
              </span>
            )}
          </div>

          {/* Product Variants */}
          {product.variants && product.variants.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-700 mb-2">Options</h3>
              <div className="flex gap-2 flex-wrap">
                {product.variants.map((v: any) => (
                  <button key={v.id}
                    className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold hover:border-green-primary transition-colors">
                    {v.name}: {v.value}
                    {v.priceAdjust !== 0 && <span className="text-green-primary ml-1">{v.priceAdjust > 0 ? '+' : ''}{formatPrice(v.priceAdjust)}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* CRO urgency signals — viewers, orders today, stock, price drop */}
          {croSignals && <CROSignals signals={croSignals} />}

          {/* Qty + Add to Cart */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center border-2 border-gray-200 rounded-full overflow-hidden">
              <button onClick={() => setQty(Math.max(product.minOrder, qty - 1))} className="px-4 py-3 hover:bg-gray-50 transition-colors"><Minus size={16} /></button>
              <span className="px-4 font-bold text-lg min-w-[3rem] text-center">{qty}</span>
              <button onClick={() => setQty(qty + 1)} className="px-4 py-3 hover:bg-gray-50 transition-colors"><Plus size={16} /></button>
            </div>
            <Button onClick={() => add(product, qty)} disabled={currentStock === 0} size="lg" className="flex-1">
              <ShoppingCart size={18} /> Add to Cart
            </Button>
            <button onClick={() => toggle(product.id)} className="w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-red-300 transition-colors">
              <Heart size={20} className={inWish ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
            </button>
            {/* Social Share button */}
            <div className="relative">
              <button onClick={() => setShowShareMenu(!showShareMenu)} className="w-12 h-12 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-green-primary transition-colors">
                <Share2 size={18} className="text-gray-400" />
              </button>
              {showShareMenu && (
                <div className="absolute right-0 top-14 bg-white rounded-2xl shadow-xl border border-gray-100 p-3 z-20 min-w-[160px]">
                  {[
                    { id: 'whatsapp', label: 'WhatsApp', emoji: '💬' },
                    { id: 'telegram', label: 'Telegram', emoji: '✈️' },
                    { id: 'copy', label: 'Copy Link', emoji: '🔗' },
                  ].map(s => (
                    <button key={s.id} onClick={() => handleShare(s.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors">
                      <span>{s.emoji}</span> {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Back-in-Stock Alert (only when out of stock) */}
          {currentStock === 0 && (
            <div className="mb-4 bg-orange-50 border border-orange-200 rounded-2xl p-4">
              <p className="text-sm font-bold text-orange-800 mb-2 flex items-center gap-2">
                <Package size={16} /> Out of Stock — Get Notified
              </p>
              {stockAlertSent ? (
                <p className="text-sm text-green-700 font-semibold">✅ We'll email you when it's back!</p>
              ) : (
                <div className="flex gap-2">
                  <input value={stockAlertEmail} onChange={e => setStockAlertEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="flex-1 border border-orange-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-400 bg-white" />
                  <button onClick={handleStockAlert}
                    className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors">
                    Notify Me
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Buy Now */}
          {currentStock > 0 && (
            <Button fullWidth variant="outline" size="lg" className="mb-4 border-green-primary text-green-primary hover:bg-green-50"
              onClick={() => { add(product, qty); navigate('/checkout') }}>
              <Zap size={18} className="fill-green-primary" /> Buy Now
            </Button>
          )}

          {/* One-Click Checkout */}
          {currentStock > 0 && (
            <OneClickCheckout product={product} quantity={qty} className="mb-4" />
          )}

          {/* Share to Earn */}
          {currentStock > 0 && (
            <ShareToEarn
              productId={product.id}
              productName={product.name}
              productPrice={currentPrice}
              productUnit={product.unit}
            />
          )}

          {/* Price Alert */}
          <div className="mb-6">
            {!showAlert ? (
              <button onClick={() => setShowAlert(true)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-green-primary transition-colors">
                <Bell size={14} />
                {hasAlert(product.id) ? `🔔 Alert set at $${hasAlert(product.id)}` : 'Set price alert'}
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <Bell size={16} className="text-amber-600 flex-shrink-0" />
                <input value={alertPrice} onChange={e => setAlertPrice(e.target.value)} type="number"
                  placeholder={`Alert when below $${product.price.toFixed(2)}`}
                  className="flex-1 bg-transparent border-none outline-none text-sm" />
                <button onClick={handlePriceAlert} className="bg-amber-500 text-white px-3 py-1 rounded-lg text-xs font-bold">Set</button>
                <button onClick={() => setShowAlert(false)} className="text-gray-400 text-xs">✕</button>
              </div>
            )}
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[[<Truck size={16}/>, 'Fast Delivery', '24–48 hrs'],[<Shield size={16}/>, 'Secure', '100% safe'],[<RotateCcw size={16}/>, 'Returns', '7 days']].map(([icon, title, sub]) => (
              <div key={String(title)} className="bg-gray-50 rounded-xl p-3 text-center">
                <span className="text-green-primary flex justify-center mb-1">{icon as React.ReactNode}</span>
                <div className="text-xs font-bold text-gray-700">{String(title)}</div>
                <div className="text-[10px] text-gray-400">{String(sub)}</div>
              </div>
            ))}
          </div>

          {/* Seller */}
          <Link to={`/sellers/${product.seller?.storeSlug}`} className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl hover:bg-green-100 transition-colors">
            <div className="w-10 h-10 rounded-full bg-green-primary text-white flex items-center justify-center font-bold">
              {product.seller?.storeName?.[0]}
            </div>
            <div>
              <div className="font-bold text-gray-800 text-sm">{product.seller?.storeName}</div>
              <div className="text-xs text-gray-400 flex items-center gap-1"><Star size={11} className="fill-orange-400 text-orange-400" />{product.seller?.rating?.toFixed(1)} · {product.seller?.city}</div>
            </div>
            <Store size={16} className="ml-auto text-green-primary" />
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-10">
        <div className="flex gap-1 border-b border-gray-200 mb-6">
          {(['desc','reviews','qa'] as const).map(t => (
            <button key={t} onClick={() => setTab(t as any)}
              className={cn('px-6 py-3 text-sm font-semibold border-b-2 transition-colors capitalize', tab === t ? 'border-green-primary text-green-primary' : 'border-transparent text-gray-500 hover:text-gray-700')}>
              {t === 'desc' ? 'Description' : t === 'reviews' ? `Reviews (${product.reviewCount})` : 'Q&A'}
            </button>
          ))}
        </div>

        {tab === 'desc' ? (
          <div className="prose max-w-none text-gray-600 text-sm leading-relaxed">
            {product.description || 'No description available.'}
          </div>
        ) : tab === 'reviews' ? (
          <>
            <ReviewsSection product={product} isAuthenticated={isAuthenticated} />
            <UGCPhotos productId={product.id} productName={product.name} />
          </>
        ) : (
          <QASection
            productId={product.id}
            sellerId={product.seller?.id || ''}
            isAuthenticated={isAuthenticated}
            isSeller={user?.seller?.id === product.seller?.id}
          />
        )}
      </div>

      {/* Similar — now powered by recommendation engine */}
      {product && (
        <RecommendationSection
          context="product"
          productId={product.id}
          categoryId={product.categoryId}
          title="You May Also Like"
          titleAm="ሌሎች ምርቶችም ሊወዱ ይችላሉ"
          limit={5}
        />
      )}

      {/* Frequently Bought Together */}
      {product && (
        <FrequentlyBoughtTogether productId={product.id} currentProduct={product} />
      )}
    </div>
  )
}
