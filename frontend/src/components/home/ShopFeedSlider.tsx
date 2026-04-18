/**
 * ShopFeedSlider — horizontal scrolling post cards for the Home page
 *
 * Full purchase mechanism inside each card:
 * - All tagged products shown with a switcher
 * - Add to Cart (instant, stays on page)
 * - Buy Now → opens inline checkout modal (address + payment + order)
 * - No page navigation required
 */
import { useRef, useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, ShoppingCart, Zap, Play,
  ArrowRight, X, CheckCircle, MapPin, Package
} from 'lucide-react'
import api from '@/lib/api'
import { useCart } from '@/hooks/useCart'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'
import Spinner from '@/components/ui/Spinner'

// ─────────────────────────────────────────────────────────────────────────────
// INLINE CHECKOUT MODAL — full purchase flow without leaving home page
// ─────────────────────────────────────────────────────────────────────────────
function InlineCheckout({ product, postId, onClose, onSuccess }: {
  product: any; postId: string
  onClose: () => void; onSuccess: () => void
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<'confirm' | 'address' | 'payment' | 'processing' | 'done'>('confirm')
  const [qty, setQty] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState('CASH_ON_DELIVERY')
  const [notes, setNotes] = useState('')

  const { data: addresses = [] } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/users/addresses').then(r => r.data.data || []),
    enabled: !!user,
  })
  const defaultAddr = (addresses as any[]).find((a: any) => a.isDefault) || (addresses as any[])[0]
  const [selectedAddress, setSelectedAddress] = useState('')

  useEffect(() => {
    if ((addresses as any[]).length && !selectedAddress) {
      setSelectedAddress((addresses as any[])[0]?.id || '')
    }
  }, [addresses])

  const price = product.price
  const subtotal = price * qty
  const deliveryFee = subtotal >= 50 ? 0 : 3.99
  const total = subtotal + deliveryFee
  const canOneTap = !!defaultAddr && paymentMethod === 'CASH_ON_DELIVERY'

  const { mutate: placeOrder, isPending } = useMutation({
    mutationFn: () => api.post('/orders', {
      addressId: selectedAddress || defaultAddr?.id,
      paymentMethod,
      items: [{ productId: product.productId || product.id, quantity: qty }],
      notes: notes || undefined,
    }),
    onSuccess: async (res) => {
      const order = res.data.data
      setStep('processing')
      api.post(`/posts/${postId}/interact`, { type: 'PURCHASE' }).catch(() => {})

      if (paymentMethod !== 'CASH_ON_DELIVERY' && paymentMethod !== 'PAYMENT_ON_DELIVERY') {
        try {
          const payRes = await api.post('/payments/initiate', { orderId: order.id, method: paymentMethod })
          const { checkoutUrl } = payRes.data.data
          if (checkoutUrl) {
            const popup = window.open(checkoutUrl, 'payment', 'width=500,height=700')
            if (!popup) { window.location.href = checkoutUrl; return }
            const check = setInterval(() => {
              if (popup.closed) {
                clearInterval(check)
                setStep('done')
                setTimeout(onSuccess, 1500)
              }
            }, 500)
            return
          }
        } catch {}
      }
      setStep('done')
      setTimeout(onSuccess, 1500)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Order failed'),
  })

  const PAYMENT_OPTIONS = [
    { value: 'CASH_ON_DELIVERY',    label: 'Cash on Delivery', icon: '💵' },
    { value: 'PAYMENT_ON_DELIVERY', label: 'Pay on Delivery',  icon: '🚚' },
    { value: 'TELEBIRR',            label: 'TeleBirr',         icon: '📱' },
    { value: 'CBE_BIRR',            label: 'CBE Birr',         icon: '🏦' },
    { value: 'CHAPA',               label: 'Chapa',            icon: '🇪🇹' },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>

        {/* Done */}
        {step === 'done' && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={40} className="text-green-primary" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Order Placed! 🎉</h2>
            <p className="text-gray-500 text-sm">Delivery in 24–48 hours.</p>
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="p-8 text-center">
            <Spinner size="lg" />
            <p className="text-gray-600 mt-4 font-semibold">Processing your order…</p>
          </div>
        )}

        {/* Confirm */}
        {step === 'confirm' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900 text-lg">Confirm Order</h3>
              <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
            </div>

            {/* Product */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4 mb-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                {product.images?.[0]
                  ? <img src={product.images[0]} className="w-full h-full object-cover" alt="" />
                  : <span className="flex items-center justify-center h-full text-2xl">🛒</span>
                }
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{product.name}</p>
                {product.nameAm && <p className="text-gray-400 text-xs">{product.nameAm}</p>}
                <p className="text-green-primary font-extrabold text-lg">ETB {product.price}/{product.unit}</p>
              </div>
            </div>

            {/* Qty */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-gray-700">Quantity</span>
              <div className="flex items-center border-2 border-gray-200 rounded-full overflow-hidden">
                <button onClick={() => setQty(q => Math.max(1, q - 1))} className="px-4 py-2 hover:bg-gray-50 text-lg">−</button>
                <span className="px-4 font-bold">{qty}</span>
                <button onClick={() => setQty(q => q + 1)} className="px-4 py-2 hover:bg-gray-50 text-lg">+</button>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-green-50 rounded-xl p-3 mb-4 space-y-1">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span><span>ETB {subtotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Delivery</span>
                <span className={deliveryFee === 0 ? 'text-green-primary font-bold' : ''}>
                  {deliveryFee === 0 ? 'FREE' : `ETB ${deliveryFee.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between font-extrabold text-gray-900 border-t border-green-200 pt-1">
                <span>Total</span><span className="text-green-primary">ETB {total.toFixed(0)}</span>
              </div>
            </div>

            {/* One-tap if default address */}
            {canOneTap && defaultAddr ? (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                  <MapPin size={14} className="text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-blue-800">{defaultAddr.label}</p>
                    <p className="text-xs text-blue-600 truncate">{defaultAddr.street}, {defaultAddr.city}</p>
                  </div>
                  <button onClick={() => setStep('address')} className="text-[10px] text-blue-500 hover:underline flex-shrink-0">Change</button>
                </div>
                <button onClick={() => placeOrder()} disabled={isPending}
                  className="w-full py-4 bg-green-primary text-white rounded-2xl font-extrabold text-base hover:bg-green-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {isPending ? <Spinner /> : <><Zap size={18} /> Place Order — ETB {total.toFixed(0)}</>}
                </button>
                <button onClick={() => setStep('payment')} className="w-full text-center text-xs text-gray-400 hover:text-gray-600">
                  Change payment (Cash on Delivery)
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600">Cancel</button>
                <button onClick={() => setStep('address')}
                  className="flex-1 py-3 bg-green-primary text-white rounded-xl text-sm font-bold hover:bg-green-dark flex items-center justify-center gap-2">
                  Continue <ArrowRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Address */}
        {step === 'address' && (
          <div className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setStep('confirm')} className="text-gray-400 hover:text-gray-600">←</button>
              <h3 className="font-extrabold text-gray-900 text-lg">Delivery Address</h3>
            </div>
            {(addresses as any[]).length === 0 ? (
              <div className="text-center py-6">
                <Package size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm mb-3">No saved addresses.</p>
                <button onClick={() => navigate('/account/addresses')}
                  className="text-green-primary font-bold hover:underline text-sm">Add address →</button>
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {(addresses as any[]).map((addr: any) => (
                  <label key={addr.id} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedAddress === addr.id ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="addr" value={addr.id} checked={selectedAddress === addr.id}
                      onChange={() => setSelectedAddress(addr.id)} className="mt-1 accent-green-primary" />
                    <div>
                      <p className="font-bold text-sm text-gray-800">{addr.label} {addr.isDefault && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full ml-1">Default</span>}</p>
                      <p className="text-xs text-gray-500">{addr.fullName} · {addr.phone}</p>
                      <p className="text-xs text-gray-400">{addr.street}, {addr.city}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Notes (optional)"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none mb-4" />
            <button onClick={() => setStep('payment')} disabled={!selectedAddress}
              className="w-full py-3 bg-green-primary text-white rounded-xl text-sm font-bold hover:bg-green-dark disabled:opacity-40 flex items-center justify-center gap-2">
              Choose Payment <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Payment */}
        {step === 'payment' && (
          <div className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setStep('address')} className="text-gray-400 hover:text-gray-600">←</button>
              <h3 className="font-extrabold text-gray-900 text-lg">Payment</h3>
            </div>
            <div className="space-y-2 mb-5">
              {PAYMENT_OPTIONS.map(opt => (
                <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === opt.value ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="pay" value={opt.value} checked={paymentMethod === opt.value}
                    onChange={() => setPaymentMethod(opt.value)} className="accent-green-primary" />
                  <span className="text-xl">{opt.icon}</span>
                  <span className="text-sm font-semibold text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>
            <button onClick={() => placeOrder()} disabled={isPending}
              className="w-full py-3 bg-green-primary text-white rounded-xl font-bold hover:bg-green-dark disabled:opacity-50 flex items-center justify-center gap-2">
              {isPending ? <Spinner /> : <><CheckCircle size={16} /> Place Order — ETB {total.toFixed(0)}</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SLIDER
// ─────────────────────────────────────────────────────────────────────────────
export default function ShopFeedSlider() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  const { data: posts = [] } = useQuery({
    queryKey: ['home-posts-feed'],
    queryFn: () => api.get('/posts/feed?limit=12').then(r => r.data.data || []),
    staleTime: 60000,
  })

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' })
  }

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
  }

  if (!posts.length) return null

  return (
    <section className="py-12 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-bold text-green-primary uppercase tracking-widest mb-1">🛍️ From Sellers</p>
            <h2 className="text-2xl font-extrabold text-gray-800">
              Shop <span className="text-green-primary">Live Posts</span>
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => scroll('left')} disabled={!canScrollLeft}
              className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-green-primary hover:text-green-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => scroll('right')} disabled={!canScrollRight}
              className="w-9 h-9 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-green-primary hover:text-green-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight size={18} />
            </button>
            <Link to="/social" className="text-green-primary font-semibold text-sm flex items-center gap-1 hover:gap-2 transition-all ml-2">
              See All <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        {/* Scroll strip */}
        <div ref={scrollRef} onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto scrollbar-hide pb-2"
          style={{ scrollSnapType: 'x mandatory' }}>
          {posts.map((post: any) => (
            <PostSlideCard key={post.id} post={post} />
          ))}

          {/* See all card */}
          <Link to="/social"
            className="flex-shrink-0 w-52 rounded-2xl border-2 border-dashed border-green-200 flex flex-col items-center justify-center gap-3 text-green-primary hover:border-green-primary hover:bg-green-50 transition-all"
            style={{ scrollSnapAlign: 'start', minHeight: '380px' }}>
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center">
              <ArrowRight size={22} className="text-green-primary" />
            </div>
            <p className="font-bold text-sm text-center px-4">See all posts</p>
          </Link>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// POST SLIDE CARD — full purchase mechanism inside
// ─────────────────────────────────────────────────────────────────────────────
function PostSlideCard({ post }: { post: any }) {
  const { add } = useCart()
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()
  const [activeProductIdx, setActiveProductIdx] = useState(0)
  const [checkoutProduct, setCheckoutProduct] = useState<any>(null)
  const [orderSuccess, setOrderSuccess] = useState(false)

  const products: any[] = post.products || []
  const activeProduct = products[activeProductIdx]

  const handleAddToCart = () => {
    if (!activeProduct) return
    add({
      id: activeProduct.productId || activeProduct.id,
      name: activeProduct.name,
      price: activeProduct.price,
      images: activeProduct.images,
      unit: activeProduct.unit,
      stock: activeProduct.stock,
      slug: activeProduct.slug,
    } as any, 1)
    api.post(`/posts/${post.id}/interact`, { type: 'CART_ADD' }).catch(() => {})
    toast.success(`${activeProduct.name} added to cart! 🛒`)
  }

  const handleBuyNow = () => {
    if (!isAuthenticated) { toast.error('Sign in to buy'); navigate('/login'); return }
    if (!activeProduct) return
    setCheckoutProduct(activeProduct)
    api.post(`/posts/${post.id}/interact`, { type: 'CLICK' }).catch(() => {})
  }

  return (
    <>
      {/* Checkout modal */}
      {checkoutProduct && (
        <InlineCheckout
          product={checkoutProduct}
          postId={post.id}
          onClose={() => setCheckoutProduct(null)}
          onSuccess={() => {
            setCheckoutProduct(null)
            setOrderSuccess(true)
            setTimeout(() => setOrderSuccess(false), 4000)
          }}
        />
      )}

      {/* Order success flash */}
      {orderSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-bold text-sm">
          <CheckCircle size={16} /> Order placed!
        </div>
      )}

      <div className="flex-shrink-0 w-64 bg-white rounded-2xl shadow-card overflow-hidden border border-gray-100 hover:shadow-card-hover transition-all flex flex-col"
        style={{ scrollSnapAlign: 'start' }}>

        {/* Media — click to open full post */}
        <Link to={`/posts/${post.id}`}
          onClick={() => api.post(`/posts/${post.id}/interact`, { type: 'CLICK' }).catch(() => {})}
          className="block relative bg-gray-900 flex-shrink-0"
          style={{ aspectRatio: '4/5' }}>
          {post.type === 'VIDEO' ? (
            <>
              <img src={post.thumbnailUrl} alt={post.caption || ''} className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 bg-black/40 rounded-full flex items-center justify-center">
                  <Play size={18} className="text-white ml-0.5" />
                </div>
              </div>
              <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                <Play size={8} className="fill-white" /> VIDEO
              </div>
            </>
          ) : (
            <img src={post.mediaUrl} alt={post.caption || ''} className="w-full h-full object-cover" />
          )}

          {/* Seller */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
            <div className="w-5 h-5 rounded-full bg-green-400 flex items-center justify-center text-[9px] font-bold text-white overflow-hidden flex-shrink-0">
              {post.sellerLogo
                ? <img src={post.sellerLogo} className="w-full h-full object-cover" alt="" />
                : post.sellerName?.[0]
              }
            </div>
            <span className="text-white text-[10px] font-semibold truncate max-w-[80px]">{post.sellerName}</span>
          </div>

          {/* Product count */}
          {products.length > 1 && (
            <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {products.length} products
            </div>
          )}
        </Link>

        {/* Caption */}
        {post.caption && (
          <p className="px-3 pt-2.5 text-xs text-gray-600 line-clamp-1">{post.caption}</p>
        )}

        {/* Product switcher tabs — if multiple products */}
        {products.length > 1 && (
          <div className="flex gap-1.5 px-3 pt-2 overflow-x-auto scrollbar-hide">
            {products.map((p: any, i: number) => (
              <button key={i} onClick={() => setActiveProductIdx(i)}
                className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border transition-all ${
                  activeProductIdx === i
                    ? 'bg-green-primary text-white border-green-primary'
                    : 'border-gray-200 text-gray-500 hover:border-green-primary'
                }`}>
                {p.images?.[0] && (
                  <img src={p.images[0]} className="w-4 h-4 rounded-full object-cover" alt="" />
                )}
                <span className="truncate max-w-[60px]">{p.name?.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        )}

        {/* Active product detail */}
        {activeProduct && (
          <div className="px-3 pt-2 pb-3 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                {activeProduct.images?.[0]
                  ? <img src={activeProduct.images[0]} className="w-full h-full object-cover" alt="" />
                  : <span className="flex items-center justify-center h-full text-lg">🛒</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">{activeProduct.name}</p>
                {activeProduct.nameAm && (
                  <p className="text-[10px] text-gray-400 truncate">{activeProduct.nameAm}</p>
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-extrabold text-green-primary">ETB {activeProduct.price}</span>
                  <span className="text-[10px] text-gray-400">/{activeProduct.unit}</span>
                  {activeProduct.comparePrice && activeProduct.comparePrice > activeProduct.price && (
                    <span className="text-[10px] text-gray-400 line-through">ETB {activeProduct.comparePrice}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Stock warning */}
            {activeProduct.stock > 0 && activeProduct.stock <= 5 && (
              <p className="text-[10px] text-orange-500 font-bold mb-2">🔥 Only {activeProduct.stock} left!</p>
            )}

            {/* Action buttons */}
            <div className="mt-auto">
              {(activeProduct.stock ?? 1) > 0 ? (
                <div className="space-y-1.5">
                  {/* Add to Cart */}
                  <button onClick={handleAddToCart}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-green-primary text-green-primary text-xs font-bold rounded-xl hover:bg-green-50 transition-colors">
                    <ShoppingCart size={13} /> Add to Cart
                  </button>
                  {/* Buy Now — opens inline checkout */}
                  <button onClick={handleBuyNow}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-green-primary text-white text-xs font-bold rounded-xl hover:bg-green-dark transition-colors">
                    <Zap size={13} /> Buy Now
                  </button>
                </div>
              ) : (
                <p className="text-center text-xs text-gray-400 font-semibold py-2 border border-gray-200 rounded-xl">
                  Out of Stock
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
