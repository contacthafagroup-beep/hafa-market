/**
 * LiveBulkPurchase.tsx
 * One buyer, multiple units, quantity-based discounts during live session.
 * Seller sets: "Buy 5kg = 10% off, Buy 10kg = 20% off, Buy 20kg = 30% off"
 * Buyer picks quantity, sees discount applied live, checks out instantly.
 */
import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Socket } from 'socket.io-client'
import { Package, Minus, Plus, X, ShoppingCart, CheckCircle, TrendingDown, Zap } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'
import Spinner from '@/components/ui/Spinner'
import { Link } from 'react-router-dom'

// ── Seller: create a bulk deal ────────────────────────────────────────────────
export function SellerBulkStarter({ sessionId, socket }: { sessionId: string; socket: Socket | null }) {
  const [show, setShow] = useState(false)
  const [productId, setProductId] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [maxQty, setMaxQty] = useState('')
  const [durationMins, setDurationMins] = useState('0')
  const [tiers, setTiers] = useState([
    { minQty: 5,  discount: 10 },
    { minQty: 10, discount: 20 },
    { minQty: 20, discount: 30 },
  ])

  const { data: myProducts = [] } = useQuery({
    queryKey: ['seller-products-live'],
    queryFn: () => api.get('/sellers/me/products?limit=100').then(r => r.data.data || []),
  })

  const selectedProduct: any = myProducts.find((p: any) => p.id === productId)

  const { mutate: startBulk, isPending } = useMutation({
    mutationFn: () => api.post(`/live/${sessionId}/bulk/start`, {
      productId,
      basePrice: parseFloat(basePrice),
      tiers: tiers.filter(t => t.discount > 0),
      maxQty: maxQty ? parseInt(maxQty) : undefined,
      durationMins: parseInt(durationMins),
    }),
    onSuccess: () => {
      toast.success('Bulk deal started! 📦')
      setShow(false)
      setProductId(''); setBasePrice(''); setMaxQty('')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  })

  const previewPrice = (discount: number) =>
    basePrice ? (parseFloat(basePrice) * (1 - discount / 100)).toFixed(0) : '—'

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-purple-400" />
          <span className="text-white/70 text-xs font-bold uppercase tracking-wide">Bulk Deal</span>
        </div>
        <button onClick={() => setShow(!show)}
          className="text-xs bg-purple-500 hover:bg-purple-400 text-white font-bold px-3 py-1.5 rounded-lg transition-colors">
          📦 Start Bulk Deal
        </button>
      </div>

      {show && (
        <div className="p-4 space-y-3">
          {/* Product */}
          <select value={productId} onChange={e => setProductId(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white outline-none">
            <option value="">Select product…</option>
            {myProducts.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} — ETB {p.price}/{p.unit} (Stock: {p.stock})</option>
            ))}
          </select>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-white/40 text-[10px] mb-1">Base price (ETB)</p>
              <input type="number" value={basePrice}
                onChange={e => setBasePrice(e.target.value)}
                placeholder={selectedProduct ? String(selectedProduct.price) : ''}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-purple-400" />
            </div>
            <div>
              <p className="text-white/40 text-[10px] mb-1">Max per buyer</p>
              <input type="number" value={maxQty} onChange={e => setMaxQty(e.target.value)}
                placeholder="No limit"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-purple-400" />
            </div>
            <div>
              <p className="text-white/40 text-[10px] mb-1">Duration</p>
              <select value={durationMins} onChange={e => setDurationMins(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white outline-none">
                <option value="0">No limit</option>
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="60">1 hour</option>
              </select>
            </div>
          </div>

          {/* Discount tiers */}
          <div>
            <p className="text-white/40 text-[10px] mb-2">
              Quantity discount tiers — {selectedProduct ? `per ${selectedProduct.unit}` : ''}
            </p>
            <div className="space-y-2">
              {tiers.map((tier, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-white/50 text-xs w-6 flex-shrink-0">{i + 1}.</span>
                  <div className="flex items-center gap-1 flex-1">
                    <span className="text-white/40 text-xs">Buy</span>
                    <input type="number" value={tier.minQty}
                      onChange={e => setTiers(prev => prev.map((t, j) => j === i ? { ...t, minQty: parseInt(e.target.value) || 0 } : t))}
                      className="w-14 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-purple-400 text-center" />
                    <span className="text-white/40 text-xs">{selectedProduct?.unit || 'units'}+</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <input type="number" value={tier.discount}
                      onChange={e => setTiers(prev => prev.map((t, j) => j === i ? { ...t, discount: parseInt(e.target.value) || 0 } : t))}
                      className="w-12 bg-white/10 border border-white/20 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-purple-400 text-center" />
                    <span className="text-white/40 text-xs">% off</span>
                  </div>
                  {basePrice && (
                    <span className="text-green-400 text-xs font-bold w-16 text-right flex-shrink-0">
                      ETB {previewPrice(tier.discount)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {basePrice && selectedProduct && (
            <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3">
              <p className="text-purple-300 text-xs font-bold mb-2">📢 What buyers will see:</p>
              <p className="text-white text-xs">1–{tiers[0].minQty - 1} {selectedProduct.unit} → ETB {parseFloat(basePrice).toFixed(0)} each</p>
              {tiers.map(t => (
                <p key={t.minQty} className="text-green-400 text-xs">
                  {t.minQty}+ {selectedProduct.unit} → ETB {previewPrice(t.discount)} each ({t.discount}% off) 🎉
                </p>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => startBulk()} disabled={isPending || !productId || !basePrice}
              className="flex-1 bg-purple-500 hover:bg-purple-400 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
              {isPending ? <Spinner /> : <><Package size={14} /> Start Bulk Deal</>}
            </button>
            <button onClick={() => setShow(false)} className="text-white/40 hover:text-white text-xs px-3">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Buyer: bulk purchase panel ────────────────────────────────────────────────
export function LiveBulkViewer({ sessionId, socket }: { sessionId: string; socket: Socket | null }) {
  const { user } = useAuth()
  const [deals, setDeals] = useState<any[]>([])
  const [checkoutDeal, setCheckoutDeal] = useState<any>(null)

  // Load active bulk deals on mount
  useEffect(() => {
    api.get(`/live/${sessionId}/bulk/active`)
      .then(r => setDeals(r.data.data || []))
      .catch(() => {})
  }, [sessionId])

  // Socket listeners
  useEffect(() => {
    if (!socket) return

    const onStarted = (data: any) => {
      setDeals(prev => [data, ...prev])
      toast('📦 Bulk deal started! Buy more, save more', { icon: '💰', duration: 3000 })
    }

    const onOrder = (data: any) => {
      // Update total sold
      setDeals(prev => prev.map(d =>
        (d.bulkId || d.id) === data.bulkId
          ? { ...d, totalSold: data.newTotalSold }
          : d
      ))
      // Social proof flash
      toast(`📦 ${data.buyerName} bought ${data.quantity} ${data.unit} at ${data.discount}% off!`,
        { icon: '🛒', duration: 3000 })
    }

    const onEnded = ({ bulkId }: any) => {
      setDeals(prev => prev.filter(d => (d.bulkId || d.id) !== bulkId))
    }

    socket.on('live:bulk_started', onStarted)
    socket.on('live:bulk_order', onOrder)
    socket.on('live:bulk_ended', onEnded)

    return () => {
      socket.off('live:bulk_started', onStarted)
      socket.off('live:bulk_order', onOrder)
      socket.off('live:bulk_ended', onEnded)
    }
  }, [socket])

  if (!deals.length) return null

  return (
    <>
      {checkoutDeal && (
        <BulkCheckoutModal
          sessionId={sessionId}
          deal={checkoutDeal}
          onClose={() => setCheckoutDeal(null)}
        />
      )}

      <div className="space-y-3">
        {deals.map((deal: any) => (
          <BulkDealCard
            key={deal.bulkId || deal.id}
            deal={deal}
            sessionId={sessionId}
            user={user}
            onCheckout={() => setCheckoutDeal(deal)}
          />
        ))}
      </div>
    </>
  )
}

// ── Individual bulk deal card ─────────────────────────────────────────────────
function BulkDealCard({ deal, sessionId, user, onCheckout }: {
  deal: any; sessionId: string; user: any; onCheckout: () => void
}) {
  const [qty, setQty] = useState(1)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  // Countdown
  useEffect(() => {
    if (!deal.endsAt) return
    const tick = () => {
      const diff = new Date(deal.endsAt).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('Ended'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`)
    }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [deal.endsAt])

  const tiers: any[] = deal.tiers || []
  const maxQty = deal.maxQty || deal.stock || 999

  // Find applicable tier for current qty
  const activeTier = [...tiers].reverse().find(t => qty >= t.minQty)
  const unitPrice = activeTier ? activeTier.price : deal.basePrice
  const discount = activeTier ? activeTier.discount : 0
  const subtotal = unitPrice * qty
  const savings = (deal.basePrice - unitPrice) * qty

  // Next tier
  const nextTier = tiers.find(t => qty < t.minQty)
  const toNextTier = nextTier ? nextTier.minQty - qty : 0

  return (
    <div className="bg-gradient-to-br from-purple-900/80 to-violet-900/80 border border-purple-500/30 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-purple-500/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-purple-400" />
          <span className="text-purple-300 text-xs font-black uppercase tracking-wide">📦 Bulk Deal</span>
        </div>
        <div className="flex items-center gap-2">
          {deal.totalSold > 0 && (
            <span className="text-white/50 text-[10px]">{deal.totalSold} {deal.unit} sold</span>
          )}
          {timeLeft && timeLeft !== 'Ended' && (
            <span className="text-orange-400 text-[10px] font-mono font-bold">⏱ {timeLeft}</span>
          )}
        </div>
      </div>

      <div className="p-4">
        {/* Product */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
            {deal.images?.[0]
              ? <img src={deal.images[0]} className="w-full h-full object-cover" alt="" />
              : <span className="flex items-center justify-center h-full text-2xl">📦</span>
            }
          </div>
          <div className="flex-1">
            <p className="text-white font-bold">{deal.name}</p>
            {deal.nameAm && <p className="text-white/40 text-[10px]">{deal.nameAm}</p>}
            <p className="text-white/50 text-xs">Base: ETB {deal.basePrice}/{deal.unit}</p>
          </div>
        </div>

        {/* Tier table */}
        <div className="mb-4">
          <p className="text-white/40 text-[10px] uppercase tracking-wide mb-2">Buy more, save more</p>
          <div className="space-y-1.5">
            {/* Base row */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
              !activeTier ? 'bg-purple-500/20 border border-purple-400/40' : 'bg-white/5'
            }`}>
              <span className="text-xs text-white/60">
                1–{tiers[0]?.minQty - 1 || '∞'} {deal.unit}
              </span>
              <span className={`text-sm font-bold ${!activeTier ? 'text-purple-300' : 'text-white/40'}`}>
                ETB {deal.basePrice}
              </span>
            </div>
            {/* Discount tiers */}
            {tiers.map((tier: any, i: number) => {
              const isActive = activeTier?.minQty === tier.minQty
              const isPassed = activeTier && activeTier.minQty > tier.minQty
              return (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                  isActive ? 'bg-green-500/20 border border-green-400/40' :
                  isPassed ? 'bg-green-500/10 border border-green-500/20' :
                  'bg-white/5'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${isActive || isPassed ? 'text-green-300' : 'text-white/50'}`}>
                      {tier.minQty}+ {deal.unit}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-green-500 text-white' :
                      isPassed ? 'bg-green-500/30 text-green-400' :
                      'bg-white/10 text-white/30'
                    }`}>
                      -{tier.discount}%
                    </span>
                  </div>
                  <span className={`text-sm font-bold ${
                    isActive ? 'text-green-300' : isPassed ? 'text-green-400/70' : 'text-white/40'
                  }`}>
                    ETB {tier.price}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Quantity selector */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60 text-xs">Quantity ({deal.unit})</span>
            {deal.maxQty && (
              <span className="text-white/30 text-[10px]">Max {deal.maxQty} per buyer</span>
            )}
          </div>

          {/* Qty stepper */}
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
              <Minus size={16} />
            </button>
            <div className="flex-1 text-center">
              <span className="text-white font-extrabold text-2xl">{qty}</span>
              <span className="text-white/40 text-sm ml-1">{deal.unit}</span>
            </div>
            <button onClick={() => setQty(q => Math.min(maxQty, q + 1))}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
              <Plus size={16} />
            </button>
          </div>

          {/* Quick qty buttons */}
          <div className="flex gap-2">
            {tiers.map((tier: any) => (
              <button key={tier.minQty} onClick={() => setQty(Math.min(maxQty, tier.minQty))}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                  qty >= tier.minQty
                    ? 'bg-green-500/20 border-green-500/40 text-green-400'
                    : 'bg-white/5 border-white/10 text-white/40 hover:border-purple-400 hover:text-purple-300'
                }`}>
                {tier.minQty} {deal.unit}
              </button>
            ))}
          </div>
        </div>

        {/* Next tier nudge */}
        {nextTier && (
          <div className="mb-4 bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2 flex items-center gap-2">
            <TrendingDown size={13} className="text-orange-400 flex-shrink-0" />
            <p className="text-orange-300 text-xs">
              Add <span className="font-bold">{toNextTier} more {deal.unit}</span> to unlock{' '}
              <span className="font-bold text-green-400">ETB {nextTier.price}</span> ({nextTier.discount}% off)
            </p>
          </div>
        )}

        {/* Price summary */}
        <div className="bg-white/5 rounded-xl p-3 mb-4 space-y-1">
          <div className="flex justify-between text-xs text-white/50">
            <span>{qty} × ETB {unitPrice}</span>
            <span>ETB {subtotal.toFixed(0)}</span>
          </div>
          {savings > 0 && (
            <div className="flex justify-between text-xs text-green-400 font-bold">
              <span>You save ({discount}% off)</span>
              <span>-ETB {savings.toFixed(0)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-extrabold text-white border-t border-white/10 pt-1">
            <span>Total</span>
            <span className="text-purple-300">ETB {subtotal.toFixed(0)}</span>
          </div>
        </div>

        {/* CTA */}
        {user ? (
          <button onClick={onCheckout}
            className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white font-extrabold rounded-xl transition-colors flex items-center justify-center gap-2">
            <Zap size={16} />
            {discount > 0
              ? `Buy ${qty} ${deal.unit} — Save ETB ${savings.toFixed(0)}`
              : `Buy ${qty} ${deal.unit} — ETB ${subtotal.toFixed(0)}`
            }
          </button>
        ) : (
          <Link to="/login"
            className="block w-full text-center bg-purple-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-purple-400 transition-colors">
            Sign in to buy
          </Link>
        )}
      </div>
    </div>
  )
}

// ── Bulk checkout modal ───────────────────────────────────────────────────────
function BulkCheckoutModal({ sessionId, deal, onClose }: {
  sessionId: string; deal: any; onClose: () => void
}) {
  const { user } = useAuth()
  const [qty, setQty] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState('CASH_ON_DELIVERY')
  const [step, setStep] = useState<'order' | 'processing' | 'done'>('order')

  const { data: addresses = [] } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/users/addresses').then(r => r.data.data || []),
  })
  const defaultAddr = addresses.find((a: any) => a.isDefault) || addresses[0]
  const [selectedAddress, setSelectedAddress] = useState('')

  useEffect(() => {
    if (addresses.length && !selectedAddress) setSelectedAddress(addresses[0]?.id)
  }, [addresses])

  const tiers: any[] = deal.tiers || []
  const maxQty = deal.maxQty || deal.stock || 999
  const activeTier = [...tiers].reverse().find(t => qty >= t.minQty)
  const unitPrice = activeTier ? activeTier.price : deal.basePrice
  const discount = activeTier ? activeTier.discount : 0
  const subtotal = unitPrice * qty
  const deliveryFee = subtotal >= 50 ? 0 : 3.99
  const total = subtotal + deliveryFee
  const savings = (deal.basePrice - unitPrice) * qty

  const { mutate: placeOrder, isPending } = useMutation({
    mutationFn: () => api.post(`/live/${sessionId}/bulk/${deal.bulkId || deal.id}/order`, {
      quantity: qty,
      addressId: selectedAddress || defaultAddr?.id,
      paymentMethod,
    }),
    onSuccess: () => {
      setStep('done')
      setTimeout(onClose, 2500)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Order failed'),
  })

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto">

        {step === 'done' && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={40} className="text-purple-600" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Order Placed! 🎉</h2>
            <p className="text-gray-500 text-sm">
              {qty} {deal.unit} of {deal.name} ordered.
              {savings > 0 && <span className="text-green-600 font-bold"> You saved ETB {savings.toFixed(0)}!</span>}
            </p>
          </div>
        )}

        {step === 'order' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
                <Package size={18} className="text-purple-600" /> Bulk Purchase
              </h3>
              <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
            </div>

            {/* Product summary */}
            <div className="flex items-center gap-3 bg-purple-50 rounded-2xl p-4 mb-4">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-purple-100 flex-shrink-0">
                {deal.images?.[0]
                  ? <img src={deal.images[0]} className="w-full h-full object-cover" alt="" />
                  : <span className="flex items-center justify-center h-full text-2xl">📦</span>
                }
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900">{deal.name}</p>
                <p className="text-purple-600 font-extrabold text-lg">ETB {unitPrice}/{deal.unit}</p>
                {discount > 0 && (
                  <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
                    {discount}% bulk discount applied!
                  </span>
                )}
              </div>
            </div>

            {/* Quantity */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Quantity ({deal.unit})
              </label>
              <div className="flex items-center gap-3">
                <button onClick={() => setQty(q => Math.max(1, q - 1))}
                  className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-purple-400 transition-colors">
                  <Minus size={16} />
                </button>
                <span className="flex-1 text-center font-extrabold text-2xl text-gray-900">{qty}</span>
                <button onClick={() => setQty(q => Math.min(maxQty, q + 1))}
                  className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-purple-400 transition-colors">
                  <Plus size={16} />
                </button>
              </div>
              {/* Quick tier buttons */}
              {tiers.length > 0 && (
                <div className="flex gap-2 mt-2">
                  {tiers.map((t: any) => (
                    <button key={t.minQty} onClick={() => setQty(Math.min(maxQty, t.minQty))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border-2 transition-all ${
                        qty >= t.minQty
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-gray-200 text-gray-500 hover:border-purple-400'
                      }`}>
                      {t.minQty} {deal.unit} (-{t.discount}%)
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Price breakdown */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-600">
                <span>{qty} × ETB {unitPrice}</span>
                <span>ETB {subtotal.toFixed(0)}</span>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-sm text-green-600 font-bold">
                  <span>Bulk discount ({discount}%)</span>
                  <span>-ETB {savings.toFixed(0)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-gray-600">
                <span>Delivery</span>
                <span className={deliveryFee === 0 ? 'text-green-600 font-bold' : ''}>
                  {deliveryFee === 0 ? 'FREE' : `ETB ${deliveryFee.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between font-extrabold text-gray-900 border-t border-gray-200 pt-1.5">
                <span>Total</span>
                <span className="text-purple-600">ETB {total.toFixed(0)}</span>
              </div>
            </div>

            {/* Address */}
            {addresses.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Delivery Address</label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {addresses.map((addr: any) => (
                    <label key={addr.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedAddress === addr.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="radio" name="addr" value={addr.id} checked={selectedAddress === addr.id}
                        onChange={() => setSelectedAddress(addr.id)} className="mt-0.5 accent-purple-500" />
                      <div>
                        <p className="font-bold text-sm text-gray-800">{addr.label}</p>
                        <p className="text-xs text-gray-500">{addr.street}, {addr.city}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Payment */}
            <div className="mb-5">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Payment</label>
              <div className="space-y-2">
                {[
                  { value: 'CASH_ON_DELIVERY', label: 'Cash on Delivery', icon: '💵' },
                  { value: 'TELEBIRR', label: 'TeleBirr', icon: '📱' },
                  { value: 'CBE_BIRR', label: 'CBE Birr', icon: '🏦' },
                  { value: 'CHAPA', label: 'Chapa', icon: '🇪🇹' },
                ].map(opt => (
                  <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === opt.value ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="pay" value={opt.value} checked={paymentMethod === opt.value}
                      onChange={() => setPaymentMethod(opt.value)} className="accent-purple-500" />
                    <span>{opt.icon}</span>
                    <span className="text-sm font-semibold text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={() => placeOrder()} disabled={isPending || !selectedAddress}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-extrabold text-base transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {isPending ? <Spinner /> : (
                <>
                  <Package size={18} />
                  {discount > 0
                    ? `Place Order — Save ETB ${savings.toFixed(0)}`
                    : `Place Order — ETB ${total.toFixed(0)}`
                  }
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
