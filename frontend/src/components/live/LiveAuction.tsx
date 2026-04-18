/**
 * LiveAuction.tsx — Whatnot-style live auction component
 *
 * Seller starts auction via SellerAuctionStarter.
 * All viewers see LiveAuctionViewer with real-time bid counter.
 * Winner gets a checkout prompt.
 */
import { useState, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Socket } from 'socket.io-client'
import { Gavel, TrendingUp, Clock, Trophy, ShoppingCart, X, ChevronUp } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'
import Spinner from '@/components/ui/Spinner'
import { Link } from 'react-router-dom'

// ── Countdown timer ───────────────────────────────────────────────────────────
function AuctionCountdown({ endsAt, onExpire }: { endsAt: string; onExpire: () => void }) {
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000))
      setSecs(diff)
      if (diff === 0) onExpire()
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  const m = Math.floor(secs / 60)
  const s = secs % 60
  const urgent = secs <= 10

  return (
    <span className={`font-mono font-black text-lg ${urgent ? 'text-red-400 animate-pulse' : 'text-white'}`}>
      {m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`}
    </span>
  )
}

// ── Seller: start an auction ──────────────────────────────────────────────────
export function SellerAuctionStarter({ sessionId, socket }: { sessionId: string; socket: Socket | null }) {
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ productId: '', startPrice: '', durationSecs: '60', minIncrement: '5' })

  const { data: myProducts = [] } = useQuery({
    queryKey: ['seller-products-live'],
    queryFn: () => api.get('/sellers/me/products?limit=100').then(r => r.data.data || []),
  })

  const { mutate: startAuction, isPending } = useMutation({
    mutationFn: () => api.post(`/live/${sessionId}/auction/start`, {
      productId: form.productId,
      startPrice: parseFloat(form.startPrice),
      durationSecs: parseInt(form.durationSecs),
      minIncrement: parseFloat(form.minIncrement),
    }),
    onSuccess: () => {
      toast.success('Auction started! 🔨')
      setShow(false)
      setForm({ productId: '', startPrice: '', durationSecs: '60', minIncrement: '5' })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to start auction'),
  })

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gavel size={14} className="text-yellow-400" />
          <span className="text-white/70 text-xs font-bold uppercase tracking-wide">Live Auction</span>
        </div>
        <button onClick={() => setShow(!show)}
          className="text-xs bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-3 py-1.5 rounded-lg transition-colors">
          🔨 Start Auction
        </button>
      </div>

      {show && (
        <div className="p-4 space-y-3">
          <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white outline-none">
            <option value="">Select product to auction…</option>
            {myProducts.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} — ETB {p.price}/{p.unit}</option>
            ))}
          </select>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-white/40 text-[10px] mb-1">Start price (ETB)</p>
              <input type="number" value={form.startPrice} onChange={e => setForm(f => ({ ...f, startPrice: e.target.value }))}
                placeholder="e.g. 30"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-yellow-400" />
            </div>
            <div>
              <p className="text-white/40 text-[10px] mb-1">Min bid step</p>
              <input type="number" value={form.minIncrement} onChange={e => setForm(f => ({ ...f, minIncrement: e.target.value }))}
                placeholder="5"
                className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-yellow-400" />
            </div>
            <div>
              <p className="text-white/40 text-[10px] mb-1">Duration</p>
              <select value={form.durationSecs} onChange={e => setForm(f => ({ ...f, durationSecs: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-2 py-1.5 text-sm text-white outline-none">
                <option value="30">30 sec</option>
                <option value="60">1 min</option>
                <option value="120">2 min</option>
                <option value="300">5 min</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => startAuction()} disabled={isPending || !form.productId || !form.startPrice}
              className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded-xl text-sm disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5">
              {isPending ? <Spinner /> : <><Gavel size={14} /> Start Now</>}
            </button>
            <button onClick={() => setShow(false)} className="text-white/40 hover:text-white text-xs px-3">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Viewer: live auction panel ────────────────────────────────────────────────
export function LiveAuctionViewer({ sessionId, socket }: { sessionId: string; socket: Socket | null }) {
  const { user } = useAuth()
  const [auction, setAuction] = useState<any>(null)
  const [bids, setBids] = useState<any[]>([])
  const [ended, setEnded] = useState<any>(null)
  const [bidInput, setBidInput] = useState('')
  const [showCheckout, setShowCheckout] = useState(false)

  // Load active auction on mount
  useEffect(() => {
    api.get(`/live/${sessionId}/auction/active`)
      .then(r => { if (r.data.data) setAuction(r.data.data) })
      .catch(() => {})
  }, [sessionId])

  // Socket listeners
  useEffect(() => {
    if (!socket) return

    const onStarted = (data: any) => {
      setAuction(data)
      setEnded(null)
      setBids([])
      toast('🔨 Auction started!', { icon: '⚡', duration: 2000 })
    }

    const onBid = (data: any) => {
      setAuction((prev: any) => prev ? {
        ...prev,
        currentPrice: data.amount,
        leaderId: data.userId,
        leaderName: data.userName,
      } : prev)
      setBids(prev => [data, ...prev.slice(0, 19)])
    }

    const onEnded = (data: any) => {
      setEnded(data)
      setAuction(null)
      if (data.winnerId === user?.id) {
        toast.success(`🏆 You won! ETB ${data.finalPrice}`, { duration: 6000 })
        setShowCheckout(true)
      } else if (data.winnerName) {
        toast(`🏆 ${data.winnerName} won at ETB ${data.finalPrice}`, { duration: 4000 })
      }
    }

    socket.on('live:auction_started', onStarted)
    socket.on('live:auction_bid', onBid)
    socket.on('live:auction_ended', onEnded)

    return () => {
      socket.off('live:auction_started', onStarted)
      socket.off('live:auction_bid', onBid)
      socket.off('live:auction_ended', onEnded)
    }
  }, [socket, user?.id])

  const { mutate: placeBid, isPending: bidding } = useMutation({
    mutationFn: (amount: number) => api.post(`/live/${sessionId}/auction/${auction.auctionId || auction.id}/bid`, { amount }),
    onSuccess: (_, amount) => {
      setBidInput('')
      // Optimistic socket broadcast
      socket?.emit('live:bid_optimistic', {
        sessionId, auctionId: auction.auctionId || auction.id,
        amount, userName: user?.name,
      })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Bid failed'),
  })

  const minBid = auction ? auction.currentPrice + (auction.minIncrement || 5) : 0

  if (!auction && !ended) return null

  return (
    <>
      {/* Checkout modal for winner */}
      {showCheckout && ended && (
        <AuctionWinnerCheckout
          sessionId={sessionId}
          auctionId={ended.auctionId}
          productName={ended.productName}
          finalPrice={ended.finalPrice}
          onClose={() => setShowCheckout(false)}
        />
      )}

      <div className="bg-gradient-to-br from-yellow-900/80 to-orange-900/80 border border-yellow-500/40 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-yellow-500/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gavel size={14} className="text-yellow-400" />
            <span className="text-yellow-300 text-xs font-black uppercase tracking-wide">
              {auction ? '🔨 LIVE AUCTION' : '🏆 Auction Ended'}
            </span>
          </div>
          {auction?.endsAt && (
            <div className="flex items-center gap-1.5">
              <Clock size={12} className="text-yellow-400" />
              <AuctionCountdown endsAt={auction.endsAt} onExpire={() => {}} />
            </div>
          )}
        </div>

        <div className="p-4">
          {auction ? (
            <>
              {/* Product */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
                  {auction.images?.[0]
                    ? <img src={auction.images[0]} className="w-full h-full object-cover" alt="" />
                    : <span className="flex items-center justify-center h-full text-2xl">🛒</span>
                  }
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold">{auction.name}</p>
                  {auction.nameAm && <p className="text-white/50 text-xs">{auction.nameAm}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <div>
                      <p className="text-yellow-300 text-[10px]">Current bid</p>
                      <p className="text-yellow-400 font-extrabold text-xl">ETB {auction.currentPrice}</p>
                    </div>
                    {auction.leaderName && (
                      <div>
                        <p className="text-white/40 text-[10px]">Leading</p>
                        <p className="text-white text-sm font-bold">
                          {auction.leaderId === user?.id ? '🏆 You!' : auction.leaderName}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Bid input */}
              {user ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={bidInput}
                      onChange={e => setBidInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && bidInput && placeBid(parseFloat(bidInput))}
                      placeholder={`Min ETB ${minBid}`}
                      className="flex-1 bg-white/10 border border-yellow-500/30 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-yellow-400 placeholder-white/30"
                    />
                    <button
                      onClick={() => bidInput && placeBid(parseFloat(bidInput))}
                      disabled={bidding || !bidInput || parseFloat(bidInput) < minBid}
                      className="bg-yellow-500 hover:bg-yellow-400 text-black font-black px-5 py-2.5 rounded-xl disabled:opacity-40 transition-colors flex items-center gap-1.5">
                      {bidding ? <Spinner /> : <><Gavel size={14} /> Bid</>}
                    </button>
                  </div>
                  {/* Quick bid buttons */}
                  <div className="flex gap-2">
                    {[minBid, minBid + 10, minBid + 25].map(amt => (
                      <button key={amt} onClick={() => placeBid(amt)}
                        className="flex-1 bg-white/10 hover:bg-yellow-500/20 text-white text-xs font-bold py-1.5 rounded-lg border border-white/10 hover:border-yellow-400 transition-colors">
                        ETB {amt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <Link to="/login" className="block w-full text-center bg-yellow-500 text-black font-bold py-3 rounded-xl text-sm hover:bg-yellow-400 transition-colors">
                  Sign in to bid
                </Link>
              )}

              {/* Recent bids */}
              {bids.length > 0 && (
                <div className="mt-3 space-y-1 max-h-24 overflow-y-auto scrollbar-hide">
                  {bids.slice(0, 5).map((b, i) => (
                    <div key={b.bidId || i} className={`flex items-center gap-2 text-xs ${i === 0 ? 'text-yellow-300' : 'text-white/50'}`}>
                      <TrendingUp size={10} className="flex-shrink-0" />
                      <span className="font-semibold">{b.userId === user?.id ? 'You' : b.userName}</span>
                      <span className="ml-auto font-bold">ETB {b.amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : ended ? (
            <div className="text-center py-2">
              <Trophy size={32} className="mx-auto text-yellow-400 mb-2" />
              <p className="text-white font-bold">
                {ended.winnerId === user?.id ? '🏆 You won!' : `${ended.winnerName || 'No winner'}`}
              </p>
              <p className="text-yellow-400 font-extrabold text-xl">ETB {ended.finalPrice}</p>
              {ended.winnerId === user?.id && (
                <button onClick={() => setShowCheckout(true)}
                  className="mt-3 bg-green-500 hover:bg-green-400 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2 mx-auto">
                  <ShoppingCart size={14} /> Complete Purchase
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}

// ── Winner checkout ───────────────────────────────────────────────────────────
function AuctionWinnerCheckout({ sessionId, auctionId, productName, finalPrice, onClose }: {
  sessionId: string; auctionId: string; productName: string; finalPrice: number; onClose: () => void
}) {
  const [paymentMethod, setPaymentMethod] = useState('CASH_ON_DELIVERY')
  const { data: addresses = [] } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/users/addresses').then(r => r.data.data || []),
  })
  const defaultAddr = addresses.find((a: any) => a.isDefault) || addresses[0]
  const [selectedAddress, setSelectedAddress] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (addresses.length && !selectedAddress) setSelectedAddress(addresses[0]?.id)
  }, [addresses])

  const { mutate: checkout, isPending } = useMutation({
    mutationFn: () => api.post(`/live/${sessionId}/auction/${auctionId}/checkout`, {
      addressId: selectedAddress || defaultAddr?.id,
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
            <Trophy size={48} className="mx-auto text-yellow-500 mb-3" />
            <h3 className="text-xl font-extrabold text-gray-900">Order Placed! 🎉</h3>
            <p className="text-gray-500 text-sm mt-1">Your auction win is confirmed.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900 flex items-center gap-2">
                <Trophy size={18} className="text-yellow-500" /> You Won!
              </h3>
              <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
              <p className="font-bold text-gray-900">{productName}</p>
              <p className="text-yellow-600 font-extrabold text-2xl">ETB {finalPrice}</p>
              <p className="text-xs text-gray-500 mt-1">Winning bid — complete your purchase</p>
            </div>

            {defaultAddr && (
              <div className="bg-gray-50 rounded-xl p-3 mb-4 flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-700">{defaultAddr.label}</p>
                  <p className="text-xs text-gray-500">{defaultAddr.street}, {defaultAddr.city}</p>
                </div>
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
              {isPending ? <Spinner /> : <><ShoppingCart size={16} /> Confirm Purchase — ETB {finalPrice}</>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
