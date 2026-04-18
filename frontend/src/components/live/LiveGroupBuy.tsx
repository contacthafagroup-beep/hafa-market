/**
 * LiveGroupBuy.tsx — Pinduoduo-style group buy component
 *
 * Seller sets tiered pricing: price drops as more people join.
 * All viewers see the counter and current price in real-time.
 * When buyer joins, price may drop for everyone.
 */
import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Socket } from 'socket.io-client'
import { Users, TrendingDown, Plus, X, Share2, ShoppingCart, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'
import Spinner from '@/components/ui/Spinner'
import { Link } from 'react-router-dom'

// ── Seller: start a group buy ─────────────────────────────────────────────────
export function SellerGroupBuyStarter({ sessionId, socket }: { sessionId: string; socket: Socket | null }) {
  const [show, setShow] = useState(false)
  const [productId, setProductId] = useState('')
  const [basePrice, setBasePrice] = useState('')
  const [durationMins, setDurationMins] = useState('30')
  const [tiers, setTiers] = useState([
    { qty: 5, price: '' },
    { qty: 10, price: '' },
    { qty: 20, price: '' },
  ])

  const { data: myProducts = [] } = useQuery({
    queryKey: ['seller-products-live'],
    queryFn: () => api.get('/sellers/me/products?limit=100').then(r => r.data.data || []),
  })

  const selectedProduct = myProducts.find((p: any) => p.id === productId)

  const { mutate: startGroupBuy, isPending } = useMutation({
    mutationFn: () => api.post(`/live/${sessionId}/groupbuy/start`, {
      productId,
      basePrice: parseFloat(basePrice),
      tiers: tiers.filter(t => t.price).map(t => ({ qty: t.qty, price: parseFloat(t.price) })),
      durationMins: parseInt(durationMins),
    }),
    onSuccess: () => {
      toast.success('Group buy started! 👥')
      setShow(false)
      setProductId(''); setBasePrice(''); setTiers([{ qty: 5, price: '' }, { qty: 10, price: '' }, { qty: 20, price: '' }])
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  })

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-blue-400" />
          <span className="text-white/70 text-xs font-bold uppercase tracking-wide">Group Buy</span>
        </div>
        <button onClick={() => setShow(!show)}
          className="text-xs bg-blue-500 hover:bg-blue-400 text-white font-bold px-3 py-1.5 rounded-lg transition-colors">
          👥 Start Group Buy
        </button>
      </div>

      {show && (
        <div className="p-4 space-y-3">
          <select value={productId} onChange={e => setProductId(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white outline-none">
            <option value="">Select product…</option>
            {myProducts.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} — ETB {p.price}/{p.unit}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-white/40 text-[10px] mb-1">Base price (1 buyer)</p>
              <input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)}
                placeholder={selectedProduct ? String(selectedProduct.price) : 'ETB'}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-blue-400" />
            </div>
            <div>
              <p className="text-white/40 text-[10px] mb-1">Duration</p>
              <select value={durationMins} onChange={e => setDurationMins(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white outline-none">
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="60">1 hour</option>
                <option value="0">No limit</option>
              </select>
            </div>
          </div>

          {/* Price tiers */}
          <div>
            <p className="text-white/40 text-[10px] mb-2">Price tiers (price drops as more join)</p>
            <div className="space-y-2">
              {tiers.map((tier, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-white/50 text-xs w-20 flex-shrink-0">{tier.qty}+ buyers:</span>
                  <input type="number" value={tier.price}
                    onChange={e => setTiers(prev => prev.map((t, j) => j === i ? { ...t, price: e.target.value } : t))}
                    placeholder="ETB price"
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-blue-400" />
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {basePrice && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
              <p className="text-blue-300 text-xs font-bold mb-1">Preview for buyers:</p>
              <p className="text-white text-xs">1 buyer → ETB {basePrice}</p>
              {tiers.filter(t => t.price).map(t => (
                <p key={t.qty} className="text-green-400 text-xs">{t.qty}+ buyers → ETB {t.price} 🎉</p>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => startGroupBuy()} disabled={isPending || !productId || !basePrice}
              className="flex-1 bg-blue-500 hover:bg-blue-400 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
              {isPending ? <Spinner /> : <><Users size={14} /> Start</>}
            </button>
            <button onClick={() => setShow(false)} className="text-white/40 hover:text-white text-xs px-3">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Viewer: group buy panel ───────────────────────────────────────────────────
export function LiveGroupBuyViewer({ sessionId, socket }: { sessionId: string; socket: Socket | null }) {
  const { user } = useAuth()
  const [groupBuys, setGroupBuys] = useState<any[]>([])
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set())
  const [checkoutGb, setCheckoutGb] = useState<any>(null)

  // Load active group buys
  useEffect(() => {
    api.get(`/live/${sessionId}/groupbuy/active`)
      .then(r => setGroupBuys(r.data.data || []))
      .catch(() => {})
  }, [sessionId])

  // Socket listeners
  useEffect(() => {
    if (!socket) return

    const onStarted = (data: any) => {
      setGroupBuys(prev => [data, ...prev])
      toast('👥 Group buy started! Join to unlock lower price', { icon: '💰', duration: 3000 })
    }

    const onUpdate = (data: any) => {
      setGroupBuys(prev => prev.map(gb =>
        gb.groupBuyId === data.groupBuyId || gb.id === data.groupBuyId
          ? { ...gb, currentQty: data.currentQty, currentPrice: data.currentPrice, nextTier: data.nextTier }
          : gb
      ))
      if (data.priceDropped) {
        toast(`🎉 Price dropped to ETB ${data.currentPrice}!`, { icon: '📉', duration: 3000 })
      }
    }

    socket.on('live:groupbuy_started', onStarted)
    socket.on('live:groupbuy_update', onUpdate)

    return () => {
      socket.off('live:groupbuy_started', onStarted)
      socket.off('live:groupbuy_update', onUpdate)
    }
  }, [socket])

  const { mutate: joinGroupBuy, isPending: joining } = useMutation({
    mutationFn: ({ gbId, qty }: { gbId: string; qty: number }) =>
      api.post(`/live/${sessionId}/groupbuy/${gbId}/join`, { quantity: qty }),
    onSuccess: (res, vars) => {
      setJoinedIds(prev => new Set([...prev, vars.gbId]))
      const data = res.data.data
      toast.success(`Joined! Current price: ETB ${data.currentPrice}`)
      // Optimistic socket broadcast
      socket?.emit('live:groupbuy_join_optimistic', {
        sessionId, groupBuyId: vars.gbId,
        userName: user?.name, quantity: vars.qty,
      })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to join'),
  })

  if (!groupBuys.length) return null

  return (
    <>
      {checkoutGb && (
        <GroupBuyCheckout
          sessionId={sessionId}
          groupBuy={checkoutGb}
          onClose={() => setCheckoutGb(null)}
        />
      )}

      <div className="space-y-3">
        {groupBuys.map((gb: any) => {
          const gbId = gb.groupBuyId || gb.id
          const hasJoined = joinedIds.has(gbId)
          const tiers = gb.tiers || []
          const nextTier = gb.nextTier || tiers.find((t: any) => t.qty > gb.currentQty)
          const toNextTier = nextTier ? nextTier.qty - gb.currentQty : 0
          const progress = nextTier ? Math.min(100, (gb.currentQty / nextTier.qty) * 100) : 100

          return (
            <div key={gbId} className="bg-gradient-to-br from-blue-900/80 to-indigo-900/80 border border-blue-500/30 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="px-4 py-3 border-b border-blue-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-blue-400" />
                  <span className="text-blue-300 text-xs font-black uppercase tracking-wide">👥 Group Buy</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-xs">{gb.currentQty} joined</span>
                  {gb.endsAt && (
                    <span className="text-white/40 text-[10px]">
                      Ends {new Date(gb.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4">
                {/* Product */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
                    {gb.images?.[0]
                      ? <img src={gb.images[0]} className="w-full h-full object-cover" alt="" />
                      : <span className="flex items-center justify-center h-full text-xl">🛒</span>
                    }
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">{gb.name}</p>
                    {gb.nameAm && <p className="text-white/40 text-[10px]">{gb.nameAm}</p>}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-blue-300 font-extrabold text-lg">ETB {gb.currentPrice}</span>
                      {gb.currentPrice < gb.basePrice && (
                        <span className="text-white/40 line-through text-xs">ETB {gb.basePrice}</span>
                      )}
                      {gb.currentPrice < gb.basePrice && (
                        <span className="text-green-400 text-[10px] font-bold bg-green-400/20 px-1.5 py-0.5 rounded-full">
                          -{Math.round((1 - gb.currentPrice / gb.basePrice) * 100)}% OFF
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress to next tier */}
                {nextTier && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-white/60 text-xs">
                        {toNextTier} more to unlock <span className="text-green-400 font-bold">ETB {nextTier.price}</span>
                      </span>
                      <span className="text-white/40 text-[10px]">{gb.currentQty}/{nextTier.qty}</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}

                {/* All tiers */}
                <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide pb-1">
                  {[{ qty: 1, price: gb.basePrice }, ...tiers].map((tier: any, i: number) => {
                    const isActive = gb.currentQty >= tier.qty
                    const isCurrent = i === 0
                      ? gb.currentQty < (tiers[0]?.qty || 999)
                      : gb.currentQty >= tier.qty && (i === tiers.length - 1 || gb.currentQty < tiers[i]?.qty)
                    return (
                      <div key={i} className={`flex-shrink-0 text-center px-3 py-2 rounded-xl border transition-all ${
                        isCurrent ? 'border-blue-400 bg-blue-500/20' :
                        isActive ? 'border-green-500/50 bg-green-500/10' :
                        'border-white/10 bg-white/5'
                      }`}>
                        <p className={`text-[10px] font-bold ${isActive ? 'text-green-400' : 'text-white/40'}`}>
                          {tier.qty === 1 ? '1 buyer' : `${tier.qty}+ buyers`}
                        </p>
                        <p className={`text-sm font-extrabold ${isCurrent ? 'text-blue-300' : isActive ? 'text-green-400' : 'text-white/50'}`}>
                          ETB {tier.price}
                        </p>
                      </div>
                    )
                  })}
                </div>

                {/* Actions */}
                {user ? (
                  hasJoined ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-xl px-4 py-3">
                        <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-green-300 text-sm font-bold">You're in! Price: ETB {gb.currentPrice}</p>
                          <p className="text-green-400/70 text-xs">Price may drop further as more join</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setCheckoutGb(gb)}
                          className="flex-1 bg-green-500 hover:bg-green-400 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5">
                          <ShoppingCart size={14} /> Checkout — ETB {gb.currentPrice}
                        </button>
                        <button
                          onClick={() => {
                            const url = `${window.location.origin}/live/${sessionId}`
                            navigator.clipboard.writeText(`Join group buy on Hafa Market! ${gb.currentQty} people already joined. Price: ETB ${gb.currentPrice}. ${url}`)
                            toast.success('Share link copied!')
                          }}
                          className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                          <Share2 size={14} className="text-white" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => joinGroupBuy({ gbId, qty: 1 })} disabled={joining}
                        className="flex-1 bg-blue-500 hover:bg-blue-400 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                        {joining ? <Spinner /> : <><Plus size={14} /> Join — ETB {gb.currentPrice}</>}
                      </button>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/live/${sessionId}`
                          navigator.clipboard.writeText(`Join group buy on Hafa Market! ${url}`)
                          toast.success('Share link copied!')
                        }}
                        className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
                        title="Share to get more people to join">
                        <Share2 size={15} className="text-white" />
                      </button>
                    </div>
                  )
                ) : (
                  <Link to="/login"
                    className="block w-full text-center bg-blue-500 text-white font-bold py-3 rounded-xl text-sm hover:bg-blue-400 transition-colors">
                    Sign in to join group buy
                  </Link>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

// ── Group buy checkout ────────────────────────────────────────────────────────
function GroupBuyCheckout({ sessionId, groupBuy, onClose }: {
  sessionId: string; groupBuy: any; onClose: () => void
}) {
  const [paymentMethod, setPaymentMethod] = useState('CASH_ON_DELIVERY')
  const { data: addresses = [] } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/users/addresses').then(r => r.data.data || []),
  })
  const defaultAddr = addresses.find((a: any) => a.isDefault) || addresses[0]
  const [done, setDone] = useState(false)
  const gbId = groupBuy.groupBuyId || groupBuy.id

  const { mutate: checkout, isPending } = useMutation({
    mutationFn: () => api.post(`/live/${sessionId}/groupbuy/${gbId}/checkout`, {
      addressId: defaultAddr?.id,
      paymentMethod,
    }),
    onSuccess: () => { setDone(true); setTimeout(onClose, 2000) },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Checkout failed'),
  })

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6">
        {done ? (
          <div className="text-center py-4">
            <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
            <h3 className="text-xl font-extrabold text-gray-900">Order Placed! 🎉</h3>
            <p className="text-gray-500 text-sm mt-1">Group buy order confirmed.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900 flex items-center gap-2">
                <Users size={18} className="text-blue-500" /> Group Buy Checkout
              </h3>
              <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="font-bold text-gray-900">{groupBuy.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-blue-600 font-extrabold text-xl">ETB {groupBuy.currentPrice}</p>
                {groupBuy.currentPrice < groupBuy.basePrice && (
                  <span className="text-green-600 text-xs font-bold bg-green-100 px-2 py-0.5 rounded-full">
                    Group price!
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{groupBuy.currentQty} people in this group</p>
            </div>

            {defaultAddr && (
              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <p className="text-xs font-bold text-gray-700">{defaultAddr.label}</p>
                <p className="text-xs text-gray-500">{defaultAddr.street}, {defaultAddr.city}</p>
              </div>
            )}

            <div className="space-y-2 mb-4">
              {[
                { value: 'CASH_ON_DELIVERY', label: 'Cash on Delivery', icon: '💵' },
                { value: 'TELEBIRR', label: 'TeleBirr', icon: '📱' },
                { value: 'CHAPA', label: 'Chapa', icon: '🇪🇹' },
              ].map(opt => (
                <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === opt.value ? 'border-green-primary bg-green-50' : 'border-gray-200'}`}>
                  <input type="radio" name="pay" value={opt.value} checked={paymentMethod === opt.value}
                    onChange={() => setPaymentMethod(opt.value)} className="accent-green-primary" />
                  <span>{opt.icon}</span>
                  <span className="text-sm font-semibold text-gray-700">{opt.label}</span>
                </label>
              ))}
            </div>

            <button onClick={() => checkout()} disabled={isPending}
              className="w-full py-3 bg-green-primary text-white rounded-xl font-bold hover:bg-green-dark disabled:opacity-50 flex items-center justify-center gap-2">
              {isPending ? <Spinner /> : <><ShoppingCart size={16} /> Place Order — ETB {groupBuy.currentPrice}</>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
