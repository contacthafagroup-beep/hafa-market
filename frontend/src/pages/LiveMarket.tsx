/**
 * LiveMarket.tsx — Hafa Live Marketplace (v2)
 *
 * 10 improvements applied:
 * 1. Auto-load ALL seller products — seller ticks which ones go live
 * 2. Live discount badges: LIVE DEAL, FLASH, HOT, FRESH
 * 3. One-tap Buy Now — instant order if default address exists
 * 4. Live cart — add multiple, checkout all at once
 * 5. Real-time stock counter — decrements live for all viewers
 * 6. Seller spotlight mode — one product fills the panel
 * 7. Live order feed for seller — running revenue + order list
 * 8. Session ended screen — shop full store, cart recovery
 * 9. Viewer "want" reactions on product cards
 * 10. Amharic names + ETB formatting
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { io as socketIO, Socket } from 'socket.io-client'
import {
  Video, VideoOff, Mic, MicOff, Users, ShoppingCart, Send,
  Plus, X, Package, CheckCircle, Zap, Star, ArrowRight,
  Eye, TrendingUp, Bell, Heart, Maximize2, Minimize2,
  DollarSign, BarChart2, MapPin
} from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'
import Spinner from '@/components/ui/Spinner'
import { SellerAuctionStarter, LiveAuctionViewer } from '@/components/live/LiveAuction'
import { SellerGroupBuyStarter, LiveGroupBuyViewer } from '@/components/live/LiveGroupBuy'
import { SellerBulkStarter, LiveBulkViewer } from '@/components/live/LiveBulkPurchase'
// ─────────────────────────────────────────────────────────────────────────────
// CHANGE #2 — Badge computation helper
// ─────────────────────────────────────────────────────────────────────────────
function getProductBadges(product: any, hotProductIds: Set<string>) {
  const badges: { label: string; color: string; pulse?: boolean }[] = []

  if (product.isSpotlight) {
    badges.push({ label: '⭐ SPOTLIGHT', color: 'bg-yellow-500 text-white', pulse: true })
  }
  if (product.isLiveDeal && product.specialPrice) {
    const disc = Math.round((1 - product.specialPrice / (product.originalPrice || product.price)) * 100)
    if (disc > 0) badges.push({ label: `🔴 -${disc}% LIVE`, color: 'bg-red-500 text-white', pulse: true })
  }
  if (product.endsAt && new Date(product.endsAt) > new Date()) {
    badges.push({ label: '⚡ FLASH', color: 'bg-orange-500 text-white' })
  }
  if (hotProductIds.has(product.id || product.productId)) {
    badges.push({ label: '🔥 HOT', color: 'bg-pink-500 text-white' })
  }
  if (product.harvestDate) {
    const days = Math.floor((Date.now() - new Date(product.harvestDate).getTime()) / 86400000)
    if (days <= 3) badges.push({ label: `🌿 ${days === 0 ? 'Today' : days + 'd'} Fresh`, color: 'bg-green-500 text-white' })
  }
  return badges
}

// ─────────────────────────────────────────────────────────────────────────────
// SELLER STREAM (WebRTC)
// ─────────────────────────────────────────────────────────────────────────────
function SellerStream({ sessionId, socket, onEnd }: {
  sessionId: string; socket: Socket | null; onEnd: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Record<string, RTCPeerConnection>>({})
  const [camOn, setCamOn] = useState(true)
  const [micOn, setMicOn] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream
      if (videoRef.current) videoRef.current.srcObject = stream
      setStreaming(true)
      socket?.emit('live:seller_ready', { sessionId })
    } catch (e: any) {
      setError(e.message || 'Camera access denied. Please allow camera permissions.')
    }
  }

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setStreaming(false)
    socket?.emit('live:seller_stopped', { sessionId })
    onEnd()
  }

  useEffect(() => {
    if (!socket || !streaming) return
    const handleViewerJoined = async ({ viewerId }: { viewerId: string }) => {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
      peersRef.current[viewerId] = pc
      streamRef.current?.getTracks().forEach(t => pc.addTrack(t, streamRef.current!))
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('live:ice', { to: viewerId, candidate: e.candidate, sessionId })
      }
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('live:offer', { to: viewerId, offer, sessionId })
    }
    const handleAnswer = async ({ from, answer }: any) => {
      const pc = peersRef.current[from]
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer))
    }
    const handleIce = async ({ from, candidate }: any) => {
      const pc = peersRef.current[from]
      if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
    }
    socket.on('live:viewer_joined', handleViewerJoined)
    socket.on('live:answer', handleAnswer)
    socket.on('live:ice_candidate', handleIce)
    return () => {
      socket.off('live:viewer_joined', handleViewerJoined)
      socket.off('live:answer', handleAnswer)
      socket.off('live:ice_candidate', handleIce)
    }
  }, [socket, streaming, sessionId])

  useEffect(() => () => { streamRef.current?.getTracks().forEach(t => t.stop()) }, [])

  return (
    <div className="relative bg-black rounded-2xl overflow-hidden aspect-video">
      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
      {!streaming ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
          <Video size={48} className="text-gray-600 mb-4" />
          {error
            ? <p className="text-red-400 text-sm text-center px-6 mb-4">{error}</p>
            : <p className="text-gray-400 text-sm mb-4">Start your camera to go live</p>
          }
          <button onClick={startStream}
            className="bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-colors">
            <Video size={16} /> Start Broadcasting
          </button>
        </div>
      ) : (
        <>
          <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <button onClick={() => { const t = streamRef.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCamOn(t.enabled) } }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${camOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500'}`}>
              {camOn ? <Video size={16} className="text-white" /> : <VideoOff size={16} className="text-white" />}
            </button>
            <button onClick={() => { const t = streamRef.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setMicOn(t.enabled) } }}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${micOn ? 'bg-white/20 hover:bg-white/30' : 'bg-red-500'}`}>
              {micOn ? <Mic size={16} className="text-white" /> : <MicOff size={16} className="text-white" />}
            </button>
            <button onClick={stopStream}
              className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-full transition-colors">
              End Stream
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BUYER STREAM (WebRTC)
// ─────────────────────────────────────────────────────────────────────────────
function BuyerStream({ sessionId, socket, viewerId }: {
  sessionId: string; socket: Socket | null; viewerId: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const [connected, setConnected] = useState(false)
  const [sellerOnline, setSellerOnline] = useState(false)

  useEffect(() => {
    if (!socket) return
    socket.emit('live:viewer_join', { sessionId, viewerId })
    const handleOffer = async ({ offer }: any) => {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
      pcRef.current = pc
      pc.ontrack = (e) => { if (videoRef.current) videoRef.current.srcObject = e.streams[0]; setConnected(true) }
      pc.onicecandidate = (e) => { if (e.candidate) socket.emit('live:ice', { to: 'seller', candidate: e.candidate, sessionId }) }
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('live:answer', { sessionId, answer })
    }
    const handleIce = async ({ candidate }: any) => {
      if (pcRef.current && candidate) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {})
    }
    socket.on('live:offer', handleOffer)
    socket.on('live:ice_candidate', handleIce)
    socket.on('live:seller_ready', () => setSellerOnline(true))
    socket.on('live:seller_stopped', () => { setSellerOnline(false); setConnected(false) })
    return () => {
      socket.off('live:offer', handleOffer)
      socket.off('live:ice_candidate', handleIce)
      pcRef.current?.close()
    }
  }, [socket, sessionId, viewerId])

  return (
    <div className="relative bg-black rounded-2xl overflow-hidden aspect-video">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      {!connected && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <Video size={28} className="text-red-400" />
          </div>
          <p className="text-white font-bold mb-1">{sellerOnline ? 'Connecting…' : 'Waiting for seller…'}</p>
          <p className="text-gray-400 text-sm">Live marketplace will appear here</p>
          {sellerOnline && <div className="mt-3 flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-red-400 rounded-full animate-bounce" style={{ animationDelay: `${i*150}ms` }} />)}</div>}
        </div>
      )}
      {connected && (
        <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE #1 — Seller Product Selector (tick to go live)
// ─────────────────────────────────────────────────────────────────────────────
function SellerProductSelector({ sessionId, socket, activeIds, onToggle, onSpotlight, spotlightId }: {
  sessionId: string; socket: Socket | null
  activeIds: Set<string>; onToggle: (p: any, active: boolean) => void
  onSpotlight: (id: string | null) => void; spotlightId: string | null
}) {
  const [search, setSearch] = useState('')
  const [editPrices, setEditPrices] = useState<Record<string, string>>({})
  const [editStock, setEditStock] = useState<Record<string, string>>({})
  const [editDuration, setEditDuration] = useState<Record<string, string>>({})

  const { data: myProducts = [], isLoading } = useQuery({
    queryKey: ['seller-products-live'],
    queryFn: () => api.get('/sellers/me/products?limit=100&status=ACTIVE').then(r => r.data.data || []),
  })

  const filtered = myProducts.filter((p: any) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.nameAm?.includes(search)
  )

  const handleToggle = (product: any) => {
    const isActive = activeIds.has(product.id)
    if (!isActive) {
      // Going live — emit pin with optional special price
      const pinData = {
        sessionId,
        productId: product.id,
        specialPrice: editPrices[product.id] ? parseFloat(editPrices[product.id]) : undefined,
        limitedStock: editStock[product.id] ? parseInt(editStock[product.id]) : undefined,
        durationSeconds: editDuration[product.id] ? parseInt(editDuration[product.id]) : 0,
      }
      socket?.emit('live:pin_product', pinData)
      api.post(`/live/${sessionId}/pin`, pinData).catch(() => {})
      toast.success(`${product.name} is now live!`)
    } else {
      // Removing from live
      socket?.emit('live:unpin_product', { sessionId, pinId: product.id })
      if (spotlightId === product.id) onSpotlight(null)
    }
    onToggle(product, !isActive)
  }

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={14} className="text-green-400" />
          <span className="text-white/70 text-xs font-bold uppercase tracking-wide">Your Products</span>
          <span className="bg-green-500/20 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {activeIds.size} live
          </span>
        </div>
        <span className="text-white/30 text-[10px]">Tick to go live</span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-white/5">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search products…"
          className="w-full bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-green-400" />
      </div>

      {/* Product list */}
      <div className="max-h-80 overflow-y-auto scrollbar-hide">
        {isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <p className="text-white/30 text-xs text-center py-6">No products found</p>
        ) : filtered.map((p: any) => {
          const isActive = activeIds.has(p.id)
          const isSpotlit = spotlightId === p.id
          return (
            <div key={p.id} className={`border-b border-white/5 last:border-0 transition-colors ${isActive ? 'bg-green-500/10' : ''}`}>
              {/* Main row */}
              <div className="flex items-center gap-3 px-3 py-2.5">
                {/* Checkbox */}
                <button onClick={() => handleToggle(p)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${isActive ? 'bg-green-500 border-green-500' : 'border-white/30 hover:border-green-400'}`}>
                  {isActive && <CheckCircle size={12} className="text-white" />}
                </button>

                {/* Image */}
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                  {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" alt="" /> : <span className="flex items-center justify-center h-full text-sm">🛒</span>}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-semibold truncate">{p.name}</p>
                  {p.nameAm && <p className="text-white/40 text-[10px] truncate">{p.nameAm}</p>}
                  <div className="flex items-center gap-2">
                    <p className="text-green-400 text-xs font-bold">ETB {p.price}/{p.unit}</p>
                    <p className="text-white/30 text-[10px]">Stock: {p.stock}</p>
                  </div>
                </div>

                {/* Spotlight toggle */}
                {isActive && (
                  <button onClick={() => onSpotlight(isSpotlit ? null : p.id)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors flex-shrink-0 ${isSpotlit ? 'bg-yellow-500 text-white' : 'bg-white/10 text-white/40 hover:bg-yellow-500/30 hover:text-yellow-400'}`}
                    title="Spotlight this product">
                    <Star size={12} />
                  </button>
                )}
              </div>

              {/* Expanded options when active */}
              {isActive && (
                <div className="px-3 pb-2.5 grid grid-cols-3 gap-1.5">
                  <div>
                    <p className="text-white/30 text-[9px] mb-0.5">Live price (ETB)</p>
                    <input type="number" placeholder={String(p.price)}
                      value={editPrices[p.id] || ''} onChange={e => setEditPrices(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="w-full bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:border-green-400" />
                  </div>
                  <div>
                    <p className="text-white/30 text-[9px] mb-0.5">Limit qty</p>
                    <input type="number" placeholder="All"
                      value={editStock[p.id] || ''} onChange={e => setEditStock(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="w-full bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:border-green-400" />
                  </div>
                  <div>
                    <p className="text-white/30 text-[9px] mb-0.5">Flash timer</p>
                    <select value={editDuration[p.id] || '0'} onChange={e => setEditDuration(prev => ({ ...prev, [p.id]: e.target.value }))}
                      className="w-full bg-white/10 border border-white/10 rounded-lg px-1 py-1 text-[11px] text-white outline-none">
                      <option value="0">None</option>
                      <option value="300">5 min</option>
                      <option value="600">10 min</option>
                      <option value="1800">30 min</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE #7 — Live Order Feed (seller dashboard)
// ─────────────────────────────────────────────────────────────────────────────
function LiveOrderFeed({ socket, sessionId }: { socket: Socket | null; sessionId: string }) {
  const [orders, setOrders] = useState<{ msg: string; time: string }[]>([])
  const [revenue, setRevenue] = useState(0)
  const [orderCount, setOrderCount] = useState(0)

  useEffect(() => {
    if (!socket) return
    const h = ({ message, amount }: any) => {
      setOrders(p => [{ msg: message, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }, ...p.slice(0, 19)])
      setOrderCount(c => c + 1)
      if (amount) setRevenue(r => r + amount)
    }
    socket.on('live:order_flash', h)
    return () => { socket.off('live:order_flash', h) }
  }, [socket])

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} className="text-green-400" />
          <span className="text-white/70 text-xs font-bold uppercase tracking-wide">Live Orders</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-green-400 font-bold">{orderCount} orders</span>
          {revenue > 0 && <span className="text-yellow-400 font-bold">ETB {revenue.toFixed(0)}</span>}
        </div>
      </div>
      <div className="max-h-40 overflow-y-auto scrollbar-hide">
        {orders.length === 0 ? (
          <p className="text-white/20 text-xs text-center py-4">Orders will appear here</p>
        ) : orders.map((o, i) => (
          <div key={i} className={`flex items-center gap-2 px-3 py-2 border-b border-white/5 last:border-0 ${i === 0 ? 'bg-green-500/10' : ''}`}>
            <TrendingUp size={11} className="text-green-400 flex-shrink-0" />
            <span className="text-green-300 text-xs flex-1">{o.msg}</span>
            <span className="text-white/30 text-[10px] flex-shrink-0">{o.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE #2 + #5 + #9 — Live Product Card (badges, stock, want reactions)
// ─────────────────────────────────────────────────────────────────────────────
function LiveProductCard({ product, sessionId, socket, onBuy, onAddCart, isSpotlight, hotProductIds }: {
  product: any; sessionId: string; socket: Socket | null
  onBuy: (p: any) => void; onAddCart: (p: any) => void
  isSpotlight: boolean; hotProductIds: Set<string>
}) {
  const [stock, setStock] = useState<number>(product.limitedStock ?? product.stock ?? 999)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)
  const [wants, setWants] = useState(product.wants || 0)
  const [wantedByMe, setWantedByMe] = useState(false)
  const isSoldOut = stock <= 0

  // CHANGE #5 — real-time stock
  useEffect(() => {
    if (!socket) return
    const h = ({ pinId, remaining }: any) => {
      if (pinId === product.pinId || pinId === product.id) setStock(remaining)
    }
    socket.on('live:stock_update', h)
    return () => { socket.off('live:stock_update', h) }
  }, [socket, product.pinId, product.id])

  // CHANGE #9 — want reactions
  useEffect(() => {
    if (!socket) return
    const h = ({ productId, count }: any) => {
      if (productId === (product.id || product.productId)) setWants(count)
    }
    socket.on('live:want_update', h)
    return () => { socket.off('live:want_update', h) }
  }, [socket, product.id, product.productId])

  // Countdown timer
  useEffect(() => {
    if (!product.endsAt) return
    const tick = () => {
      const diff = new Date(product.endsAt).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft(null); return }
      const m = Math.floor(diff / 60000), s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`)
    }
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [product.endsAt])

  const handleWant = () => {
    if (wantedByMe) return
    setWantedByMe(true)
    setWants((w: number) => w + 1)
    socket?.emit('live:want', { sessionId, productId: product.id || product.productId })
  }

  const badges = getProductBadges(product, hotProductIds)
  const displayPrice = product.specialPrice || product.price
  const originalPrice = product.originalPrice || product.price

  return (
    <div className={`bg-white rounded-xl overflow-hidden border-2 transition-all ${
      isSpotlight ? 'border-yellow-400 shadow-lg shadow-yellow-400/20' :
      isSoldOut ? 'border-gray-200 opacity-60' :
      'border-green-200 hover:border-green-400'
    }`}>
      {isSpotlight ? (
        /* Spotlight — keep tall image */
        <>
          <div className="relative bg-gray-50" style={{ aspectRatio: '16/9' }}>
            {product.images?.[0]
              ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-5xl">🛒</div>
            }
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {badges.map((b, i) => (
                <span key={i} className={`text-[10px] font-black px-2 py-0.5 rounded-full ${b.color} ${b.pulse ? 'animate-pulse' : ''}`}>{b.label}</span>
              ))}
            </div>
            <button onClick={handleWant}
              className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold transition-all ${wantedByMe ? 'bg-red-500 text-white' : 'bg-black/50 text-white hover:bg-red-500'}`}>
              <Heart size={10} className={wantedByMe ? 'fill-white' : ''} /> {wants > 0 ? wants : ''}
            </button>
            {isSoldOut && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="bg-red-500 text-white font-black text-sm px-4 py-2 rounded-full">SOLD OUT</span>
              </div>
            )}
            {timeLeft && (
              <div className="absolute bottom-2 left-2 bg-black/70 text-orange-400 text-[10px] font-mono font-black px-2 py-1 rounded-full">⏱ {timeLeft}</div>
            )}
          </div>
          <div className="p-4">
            <p className="font-bold text-gray-900 line-clamp-2 leading-snug mb-0.5 text-base">{product.name}</p>
            {product.nameAm && <p className="text-gray-400 text-[11px] mb-1">{product.nameAm}</p>}
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="font-extrabold text-green-primary text-2xl">ETB {displayPrice.toFixed(0)}</span>
              <span className="text-xs text-gray-400">/{product.unit}</span>
              {displayPrice < originalPrice && <span className="text-xs text-gray-400 line-through">ETB {originalPrice.toFixed(0)}</span>}
            </div>
            {stock <= 10 && !isSoldOut && (
              <div className="mb-2">
                <span className={`text-[10px] font-bold ${stock <= 3 ? 'text-red-500 animate-pulse' : 'text-orange-500'}`}>
                  {stock <= 3 ? `🔥 Only ${stock} left!` : `${stock} remaining`}
                </span>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden mt-1">
                  <div className={`h-full rounded-full ${stock <= 3 ? 'bg-red-500' : 'bg-orange-400'}`}
                    style={{ width: `${Math.min(100, (stock / 10) * 100)}%` }} />
                </div>
              </div>
            )}
            {wants >= 3 && !isSoldOut && <p className="text-[10px] text-pink-500 font-bold mb-2">❤️ {wants} people want this</p>}
            {!isSoldOut && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => onAddCart(product)}
                  className="flex-1 flex items-center justify-center gap-1 border-2 border-green-primary text-green-primary font-bold rounded-xl py-3 text-sm hover:bg-green-50 transition-colors">
                  <ShoppingCart size={15} /> Cart
                </button>
                <button onClick={() => onBuy(product)}
                  className="flex-1 flex items-center justify-center gap-1 bg-green-primary text-white font-bold rounded-xl py-3 text-sm hover:bg-green-dark transition-colors">
                  <Zap size={15} /> Buy Now
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Non-spotlight — compact horizontal row */
        <div className="flex items-center gap-2.5 p-2.5">
          {/* Thumbnail */}
          <div className="relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gray-100">
            {product.images?.[0]
              ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-2xl">🛒</div>
            }
            {isSoldOut && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-[8px] font-black">SOLD</span>
              </div>
            )}
            {badges[0] && (
              <span className={`absolute bottom-0 left-0 right-0 text-center text-[7px] font-black py-0.5 leading-none ${badges[0].color} ${badges[0].pulse ? 'animate-pulse' : ''}`}>
                {badges[0].label.slice(0, 8)}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-xs leading-tight line-clamp-1">{product.name}</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-extrabold text-green-primary text-sm">ETB {displayPrice.toFixed(0)}</span>
              <span className="text-[10px] text-gray-400">/{product.unit}</span>
              {displayPrice < originalPrice && (
                <span className="text-[10px] text-gray-400 line-through">ETB {originalPrice.toFixed(0)}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {stock <= 5 && !isSoldOut && (
                <span className="text-[9px] text-red-500 font-bold">🔥 {stock} left</span>
              )}
              {timeLeft && (
                <span className="text-[9px] text-orange-400 font-mono font-bold">⏱ {timeLeft}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          {!isSoldOut ? (
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button onClick={() => onBuy(product)}
                className="flex items-center gap-1 bg-green-primary text-white font-bold rounded-lg px-2.5 py-1.5 text-[10px] hover:bg-green-dark transition-colors whitespace-nowrap">
                <Zap size={10} /> Buy
              </button>
              <button onClick={() => onAddCart(product)}
                className="flex items-center gap-1 border border-green-primary text-green-primary font-bold rounded-lg px-2.5 py-1.5 text-[10px] hover:bg-green-50 transition-colors whitespace-nowrap">
                <ShoppingCart size={10} /> Cart
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-gray-400 font-bold flex-shrink-0">Sold out</span>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE #3 + #4 — Instant Checkout + Live Cart
// ─────────────────────────────────────────────────────────────────────────────
function LiveCheckout({ items, sessionId, socket, onClose, onSuccess }: {
  items: any[]; sessionId: string; socket: Socket | null
  onClose: () => void; onSuccess: (orderId: string) => void
}) {
  const { user } = useAuth()
  const [step, setStep] = useState<'confirm' | 'address' | 'payment' | 'processing' | 'done'>('confirm')
  const [paymentMethod, setPaymentMethod] = useState('CASH_ON_DELIVERY')
  const [notes, setNotes] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(items.map(p => [p.id || p.productId, 1]))
  )

  const { data: addresses = [] } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.get('/users/addresses').then(r => r.data.data || []),
  })
  const defaultAddr = addresses.find((a: any) => a.isDefault) || addresses[0]
  const [selectedAddress, setSelectedAddress] = useState<string>(defaultAddr?.id || '')

  useEffect(() => {
    if (addresses.length && !selectedAddress) setSelectedAddress(addresses[0]?.id)
  }, [addresses])

  const subtotal = items.reduce((sum, p) => {
    const qty = quantities[p.id || p.productId] || 1
    return sum + (p.specialPrice || p.price) * qty
  }, 0)
  const deliveryFee = subtotal >= 50 ? 0 : 3.99
  const total = subtotal + deliveryFee

  // CHANGE #3 — one-tap if default address exists
  const canOneTap = !!defaultAddr && paymentMethod === 'CASH_ON_DELIVERY'

  const { mutate: placeOrder, isPending } = useMutation({
    mutationFn: () => api.post('/orders', {
      addressId: selectedAddress || defaultAddr?.id,
      paymentMethod,
      items: items.map(p => ({
        productId: p.id || p.productId,
        quantity: quantities[p.id || p.productId] || 1,
      })),
      notes: notes || `Live order — session ${sessionId}`,
    }),
    onSuccess: async (res) => {
      const order = res.data.data
      setStep('processing')
      // Broadcast social proof for each item
      items.forEach(p => {
        socket?.emit('live:order_placed', {
          sessionId,
          productName: p.name,
          buyerName: user?.name?.split(' ')[0] || 'Someone',
          amount: (p.specialPrice || p.price) * (quantities[p.id || p.productId] || 1),
        })
      })
      if (paymentMethod !== 'CASH_ON_DELIVERY' && paymentMethod !== 'PAYMENT_ON_DELIVERY') {
        try {
          const payRes = await api.post('/payments/initiate', { orderId: order.id, method: paymentMethod })
          const { checkoutUrl } = payRes.data.data
          if (checkoutUrl) {
            // CHANGE #3 — open in popup, not full redirect
            const popup = window.open(checkoutUrl, 'payment', 'width=500,height=700')
            if (!popup) window.location.href = checkoutUrl
            else {
              const check = setInterval(() => {
                if (popup.closed) { clearInterval(check); setStep('done'); setTimeout(() => onSuccess(order.id), 1000) }
              }, 500)
            }
            return
          }
        } catch {}
      }
      setStep('done')
      setTimeout(() => onSuccess(order.id), 1500)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Order failed'),
  })

  const PAYMENT_OPTIONS = [
    { value: 'CASH_ON_DELIVERY', label: 'Cash on Delivery', icon: '💵' },
    { value: 'PAYMENT_ON_DELIVERY', label: 'Pay on Delivery', icon: '🚚' },
    { value: 'TELEBIRR', label: 'TeleBirr', icon: '📱' },
    { value: 'CBE_BIRR', label: 'CBE Birr', icon: '🏦' },
    { value: 'CHAPA', label: 'Chapa', icon: '🇪🇹' },
  ]

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto">

        {step === 'done' && (
          <div className="p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={40} className="text-green-primary" />
            </div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Order Placed! 🎉</h2>
            <p className="text-gray-500 text-sm">Delivery in 24–48 hours to {defaultAddr?.city || 'your address'}.</p>
          </div>
        )}

        {step === 'processing' && (
          <div className="p-8 text-center">
            <Spinner size="lg" />
            <p className="text-gray-600 mt-4 font-semibold">Processing your order…</p>
          </div>
        )}

        {step === 'confirm' && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900 text-lg">Your Cart ({items.length})</h3>
              <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
            </div>

            {/* Items */}
            <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {items.map((p: any) => {
                const pid = p.id || p.productId
                const qty = quantities[pid] || 1
                const price = p.specialPrice || p.price
                return (
                  <div key={pid} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" alt="" /> : <span className="flex items-center justify-center h-full text-xl">🛒</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 truncate">{p.name}</p>
                      <p className="text-green-primary text-sm font-bold">ETB {price.toFixed(0)}/{p.unit}</p>
                      {p.specialPrice && <span className="text-[10px] bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded-full">🔴 Live Price</span>}
                    </div>
                    <div className="flex items-center border border-gray-200 rounded-full overflow-hidden flex-shrink-0">
                      <button onClick={() => setQuantities(q => ({ ...q, [pid]: Math.max(1, (q[pid] || 1) - 1) }))} className="px-2 py-1 text-sm hover:bg-gray-100">−</button>
                      <span className="px-2 text-sm font-bold">{qty}</span>
                      <button onClick={() => setQuantities(q => ({ ...q, [pid]: (q[pid] || 1) + 1 }))} className="px-2 py-1 text-sm hover:bg-gray-100">+</button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Totals */}
            <div className="bg-green-50 rounded-xl p-3 mb-4 space-y-1">
              <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>ETB {subtotal.toFixed(0)}</span></div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Delivery</span>
                <span className={deliveryFee === 0 ? 'text-green-primary font-bold' : ''}>{deliveryFee === 0 ? 'FREE' : `ETB ${deliveryFee.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between font-extrabold text-gray-900 border-t border-green-200 pt-1">
                <span>Total</span><span className="text-green-primary">ETB {total.toFixed(0)}</span>
              </div>
            </div>

            {/* CHANGE #3 — One-tap if default address */}
            {canOneTap && defaultAddr ? (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2">
                  <MapPin size={14} className="text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-blue-800">Delivering to {defaultAddr.label}</p>
                    <p className="text-xs text-blue-600 truncate">{defaultAddr.street}, {defaultAddr.city}</p>
                  </div>
                  <button onClick={() => setStep('address')} className="text-[10px] text-blue-500 hover:underline flex-shrink-0">Change</button>
                </div>
                <button onClick={() => placeOrder()} disabled={isPending}
                  className="w-full py-4 bg-green-primary text-white rounded-2xl font-extrabold text-base hover:bg-green-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  {isPending ? <Spinner /> : <><Zap size={18} /> Place Order — ETB {total.toFixed(0)}</>}
                </button>
                <button onClick={() => setStep('payment')} className="w-full text-center text-xs text-gray-400 hover:text-gray-600">
                  Change payment method (currently: Cash on Delivery)
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

        {step === 'address' && (
          <div className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setStep('confirm')} className="text-gray-400 hover:text-gray-600">←</button>
              <h3 className="font-extrabold text-gray-900 text-lg">Delivery Address</h3>
            </div>
            {addresses.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-500 text-sm mb-3">No saved addresses.</p>
                <Link to="/account/addresses" onClick={onClose} className="text-green-primary font-bold hover:underline text-sm">Add address →</Link>
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {addresses.map((addr: any) => (
                  <label key={addr.id} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedAddress === addr.id ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="addr" value={addr.id} checked={selectedAddress === addr.id} onChange={() => setSelectedAddress(addr.id)} className="mt-1 accent-green-primary" />
                    <div>
                      <p className="font-bold text-sm text-gray-800">{addr.label} {addr.isDefault && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full ml-1">Default</span>}</p>
                      <p className="text-xs text-gray-500">{addr.fullName} · {addr.phone}</p>
                      <p className="text-xs text-gray-400">{addr.street}, {addr.city}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Notes (optional)"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none mb-4" />
            <button onClick={() => setStep('payment')} disabled={!selectedAddress}
              className="w-full py-3 bg-green-primary text-white rounded-xl text-sm font-bold hover:bg-green-dark disabled:opacity-40 flex items-center justify-center gap-2">
              Choose Payment <ArrowRight size={14} />
            </button>
          </div>
        )}

        {step === 'payment' && (
          <div className="p-5">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setStep('address')} className="text-gray-400 hover:text-gray-600">←</button>
              <h3 className="font-extrabold text-gray-900 text-lg">Payment</h3>
            </div>
            <div className="space-y-2 mb-5">
              {PAYMENT_OPTIONS.map(opt => (
                <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === opt.value ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="pay" value={opt.value} checked={paymentMethod === opt.value} onChange={() => setPaymentMethod(opt.value)} className="accent-green-primary" />
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
// LIVE CHAT
// ─────────────────────────────────────────────────────────────────────────────
function LiveChat({ sessionId, socket, userName }: { sessionId: string; socket: Socket | null; userName: string }) {
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [listening, setListening] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.get(`/live/${sessionId}/messages`).then(r => setMessages(r.data.data || [])).catch(() => {})
  }, [sessionId])

  useEffect(() => {
    if (!socket) return
    const h = (msg: any) => setMessages(p => [...p.slice(-149), msg])
    socket.on('live:message', h)
    return () => { socket.off('live:message', h) }
  }, [socket])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = () => {
    if (!input.trim() || !socket) return
    socket.emit('live:message', { sessionId, content: input.trim() })
    setInput('')
  }

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return toast.error('Voice not supported')
    const r = new SR(); r.lang = 'am-ET'; r.interimResults = false
    r.onstart = () => setListening(true)
    r.onend = () => setListening(false)
    r.onresult = (e: any) => setInput(p => p + e.results[0][0].transcript)
    r.start()
  }

  const MSG_COLORS: Record<string, string> = {
    ORDER: 'text-green-400 font-bold', SYSTEM: 'text-yellow-300 italic', CHAT: 'text-white',
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-2xl overflow-hidden">
      <div className="px-3 py-2.5 border-b border-white/10 flex items-center gap-2">
        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
        <span className="text-white/70 text-xs font-bold uppercase tracking-wide">Live Chat</span>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-hide">
        {messages.length === 0 && <p className="text-white/30 text-xs text-center py-4">Chat will appear here…</p>}
        {messages.map((m: any) => (
          <div key={m.id} className="flex items-start gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 mt-0.5">
              {(m.userName || '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-green-400 text-[11px] font-bold mr-1">{m.userName}</span>
              <span className={`text-xs break-words ${MSG_COLORS[m.type] || 'text-white'}`}>{m.content}</span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="px-3 pt-2 flex gap-2">
        {['❤️','🔥','👏','😍','💯','🛒'].map(e => (
          <button key={e} onClick={() => socket?.emit('live:reaction', { sessionId, emoji: e })}
            className="text-base hover:scale-125 transition-transform">{e}</button>
        ))}
      </div>
      <div className="px-3 py-2 flex gap-1.5">
        <button onClick={startVoice}
          className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors ${listening ? 'bg-red-500 border-red-500 animate-pulse' : 'border-white/20 text-white/50'}`}>
          🎤
        </button>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Say something… (Amharic supported)"
          className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 outline-none focus:border-green-400" />
        <button onClick={send} disabled={!input.trim()}
          className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center disabled:opacity-40 hover:bg-green-400 transition-colors flex-shrink-0">
          <Send size={13} className="text-white" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CHANGE #8 — Session Ended Screen
// ─────────────────────────────────────────────────────────────────────────────
function SessionEndedScreen({ session, cartItems, onCheckout, onGoToStore }: {
  session: any; cartItems: any[]; onCheckout: () => void; onGoToStore: () => void
}) {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Video size={36} className="text-gray-400" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Session Ended</h2>
        <p className="text-gray-500 text-sm mb-6">
          {session?.title || 'The live session'} has ended. You can still shop from the seller's store.
        </p>

        {cartItems.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 text-left">
            <p className="font-bold text-green-800 mb-2 flex items-center gap-2">
              <ShoppingCart size={16} /> You have {cartItems.length} item{cartItems.length > 1 ? 's' : ''} in your cart
            </p>
            <div className="space-y-1 mb-3">
              {cartItems.slice(0, 3).map((p: any) => (
                <p key={p.id} className="text-sm text-green-700 truncate">• {p.name} — ETB {(p.specialPrice || p.price).toFixed(0)}</p>
              ))}
              {cartItems.length > 3 && <p className="text-xs text-green-600">+{cartItems.length - 3} more</p>}
            </div>
            <button onClick={onCheckout}
              className="w-full py-3 bg-green-primary text-white rounded-xl font-bold hover:bg-green-dark transition-colors flex items-center justify-center gap-2">
              <Zap size={16} /> Checkout Now
            </button>
          </div>
        )}

        <button onClick={onGoToStore}
          className="w-full py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:border-green-primary hover:text-green-primary transition-colors flex items-center justify-center gap-2">
          <Package size={15} /> Shop Full Store
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function LiveMarket() {
  const { id: sessionId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { add, items: cartItems } = useCart()
  const qc = useQueryClient()

  const socketRef = useRef<Socket | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [viewers, setViewers] = useState(0)
  const [reactions, setReactions] = useState<{ id: string; emoji: string }[]>([])
  const [orderFlashes, setOrderFlashes] = useState<string[]>([])
  const [sessionEnded, setSessionEnded] = useState(false)

  // CHANGE #1 — all seller products + which are active
  const [activeProductIds, setActiveProductIds] = useState<Set<string>>(new Set())
  const [listedProducts, setListedProducts] = useState<any[]>([])

  // CHANGE #4 — live cart (products added during session)
  const [liveCart, setLiveCart] = useState<any[]>([])
  const [showCheckout, setShowCheckout] = useState(false)

  // CHANGE #6 — spotlight
  const [spotlightId, setSpotlightId] = useState<string | null>(null)

  // CHANGE #2 — hot products (3+ orders in session)
  const [hotProductIds, setHotProductIds] = useState<Set<string>>(new Set())
  const [orderCountByProduct, setOrderCountByProduct] = useState<Record<string, number>>({})

  const [activeTab, setActiveTab] = useState<'products' | 'chat'>('products')
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null)

  const isSeller = user?.role === 'ADMIN' || user?.role === 'SELLER'
  const viewerId = user?.id || `guest-${Math.random().toString(36).slice(2)}`

  // Fetch session info
  const { data: session } = useQuery({
    queryKey: ['live-session', sessionId],
    queryFn: () => api.get('/live').then(r => r.data.data?.find((s: any) => s.id === sessionId)),
    enabled: !!sessionId,
    refetchInterval: 30000,
  })

  // Fetch seller info from session
  const { data: sellerInfo } = useQuery({
    queryKey: ['live-seller', session?.sellerId],
    queryFn: () => api.get(`/sellers/${session?.seller?.storeSlug || session?.sellerId}`).then(r => r.data.data),
    enabled: !!session?.sellerId,
  })

  // Connect socket
  useEffect(() => {
    if (!sessionId) return
    const token = localStorage.getItem('accessToken')
    const s = socketIO(
      import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5001',
      { transports: ['websocket'], auth: { token: token || '' }, reconnectionAttempts: 5 }
    )
    socketRef.current = s
    setSocket(s)

    s.on('connect', () => s.emit('live:join', sessionId))
    s.on('live:viewers', ({ count }: any) => setViewers(count))
    s.on('live:reaction', ({ emoji, id }: any) => {
      setReactions(p => [...p, { emoji, id }])
      setTimeout(() => setReactions(p => p.filter(r => r.id !== id)), 2000)
    })
    s.on('live:product_pinned', (pin: any) => {
      setListedProducts(p => {
        if (p.find(x => (x.pinId || x.id) === (pin.pinId || pin.id))) return p
        return [...p, { ...pin, isLiveDeal: true }]
      })
      setActiveProductIds(prev => new Set([...prev, pin.productId || pin.id]))
      if (!isSeller) toast('🛒 New product listed!', { icon: '🔥', duration: 2000 })
    })
    s.on('live:product_unpinned', ({ pinId }: any) => {
      setListedProducts(p => p.filter(x => (x.pinId || x.id) !== pinId))
      setActiveProductIds(prev => { const n = new Set(prev); n.delete(pinId); return n })
    })
    s.on('live:stock_update', ({ pinId, remaining }: any) => {
      setListedProducts(p => p.map(x => (x.pinId || x.id) === pinId ? { ...x, limitedStock: remaining, stock: remaining } : x))
    })
    s.on('live:order_flash', ({ message, productId }: any) => {
      setOrderFlashes(p => [message, ...p.slice(0, 4)])
      setTimeout(() => setOrderFlashes(p => p.slice(0, -1)), 5000)
      // Track hot products
      if (productId) {
        setOrderCountByProduct(prev => {
          const count = (prev[productId] || 0) + 1
          if (count >= 3) setHotProductIds(h => new Set([...h, productId]))
          return { ...prev, [productId]: count }
        })
      }
    })
    s.on('live:seller_stopped', () => setSessionEnded(true))

    return () => { s.emit('live:leave', sessionId); s.disconnect() }
  }, [sessionId])

  // Load existing pinned products on join
  useEffect(() => {
    if (!sessionId) return
    api.get(`/live/${sessionId}/pinned`)
      .then(r => {
        const pinned = r.data.data || []
        setListedProducts(pinned.map((p: any) => ({ ...p, isLiveDeal: !!p.specialPrice })))
        setActiveProductIds(new Set(pinned.map((p: any) => p.productId || p.id)))
      })
      .catch(() => {})
  }, [sessionId])

  // CHANGE #1 — seller toggles product
  const handleProductToggle = (product: any, active: boolean) => {
    setActiveProductIds(prev => {
      const n = new Set(prev)
      if (active) n.add(product.id)
      else n.delete(product.id)
      return n
    })
    if (active) {
      setListedProducts(p => {
        if (p.find(x => x.id === product.id)) return p
        return [...p, { ...product, isLiveDeal: false }]
      })
    } else {
      setListedProducts(p => p.filter(x => x.id !== product.id))
    }
  }

  // CHANGE #4 — add to live cart
  const handleAddToCart = (product: any) => {
    const pid = product.id || product.productId
    setLiveCart(prev => {
      const exists = prev.find(p => (p.id || p.productId) === pid)
      if (exists) return prev
      return [...prev, product]
    })
    add({
      id: pid, name: product.name,
      price: product.specialPrice || product.price,
      images: product.images, unit: product.unit,
      stock: product.limitedStock || product.stock,
      slug: product.slug, seller: product.seller,
    } as any, 1)
    socket?.emit('live:order_placed', {
      sessionId, productName: product.name,
      buyerName: user?.name?.split(' ')[0] || 'Someone',
    })
    toast.success(`${product.name} added to cart!`, { icon: '🛒' })
  }

  // CHANGE #3 — buy now
  const handleBuyNow = (product: any) => {
    if (!user) { toast.error('Sign in to buy'); navigate('/login'); return }
    const pid = product.id || product.productId
    setLiveCart(prev => prev.find(p => (p.id || p.productId) === pid) ? prev : [...prev, product])
    setShowCheckout(true)
  }

  // CHANGE #6 — spotlight product
  const spotlightProduct = listedProducts.find(p => (p.id || p.productId) === spotlightId)

  if (!sessionId) return <div className="text-center py-20 text-gray-400">Session not found</div>

  // CHANGE #8 — session ended
  if (sessionEnded) {
    return (
      <SessionEndedScreen
        session={session}
        cartItems={liveCart}
        onCheckout={() => { setSessionEnded(false); setShowCheckout(true) }}
        onGoToStore={() => navigate(sellerInfo?.storeSlug ? `/sellers/${sellerInfo.storeSlug}` : '/products')}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* CHANGE #4 — Checkout modal */}
      {showCheckout && liveCart.length > 0 && (
        <LiveCheckout
          items={liveCart}
          sessionId={sessionId}
          socket={socket}
          onClose={() => setShowCheckout(false)}
          onSuccess={(orderId) => {
            setShowCheckout(false)
            setLiveCart([])
            setOrderSuccess(orderId)
            setTimeout(() => setOrderSuccess(null), 6000)
          }}
        />
      )}

      {/* Order success banner */}
      {orderSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-2 font-bold animate-bounce">
          <CheckCircle size={18} /> Order placed!{' '}
          <Link to={`/account/orders/${orderSuccess}`} className="underline text-sm font-normal">View →</Link>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/live')} className="text-gray-400 hover:text-white transition-colors text-lg">←</button>
            <div>
              <h1 className="text-white font-extrabold text-lg line-clamp-1">{session?.title || 'Live Marketplace'}</h1>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1 text-red-400 font-bold">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" /> LIVE
                </span>
                <span className="flex items-center gap-1"><Eye size={11} /> {viewers} watching</span>
                <span className="flex items-center gap-1"><Package size={11} /> {listedProducts.length} products</span>
              </div>
            </div>
          </div>

          {/* CHANGE #4 — Live cart button */}
          <button onClick={() => { if (liveCart.length > 0) setShowCheckout(true); else navigate('/cart') }}
            className="relative flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors">
            <ShoppingCart size={15} />
            {liveCart.length > 0 ? `Checkout (${liveCart.length})` : 'Cart'}
            {liveCart.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-[10px] font-black flex items-center justify-center">
                {liveCart.length}
              </span>
            )}
          </button>
        </div>

        {/* Main layout */}
        <div className="grid lg:grid-cols-3 gap-4">

          {/* LEFT: Stream + tools */}
          <div className="lg:col-span-2 space-y-4">
            {isSeller
              ? <SellerStream sessionId={sessionId} socket={socket} onEnd={() => setSessionEnded(true)} />
              : <BuyerStream sessionId={sessionId} socket={socket} viewerId={viewerId} />
            }

            {/* Order flashes */}
            {orderFlashes.length > 0 && (
              <div className="space-y-1.5">
                {orderFlashes.map((msg, i) => (
                  <div key={i} className="flex items-center gap-2 bg-green-500/20 border border-green-500/30 rounded-xl px-4 py-2">
                    <TrendingUp size={13} className="text-green-400 flex-shrink-0" />
                    <span className="text-green-300 text-sm font-semibold">{msg}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Floating reactions */}
            <div className="relative h-8 pointer-events-none overflow-hidden">
              {reactions.map(r => (
                <span key={r.id} className="absolute text-2xl"
                  style={{ right: `${Math.random() * 80}%`, animation: 'floatUp 2s ease-out forwards' }}>
                  {r.emoji}
                </span>
              ))}
            </div>

            {/* CHANGE #1 — Seller product selector */}
            {isSeller && (
              <div className="space-y-3">
                <SellerProductSelector
                  sessionId={sessionId} socket={socket}
                  activeIds={activeProductIds} onToggle={handleProductToggle}
                  onSpotlight={setSpotlightId} spotlightId={spotlightId}
                />
                {/* Auction tool */}
                <SellerAuctionStarter sessionId={sessionId} socket={socket} />
                {/* Group buy tool */}
                <SellerGroupBuyStarter sessionId={sessionId} socket={socket} />
                {/* Bulk deal tool */}
                <SellerBulkStarter sessionId={sessionId} socket={socket} />
                {/* CHANGE #7 — Live order feed */}
                <LiveOrderFeed socket={socket} sessionId={sessionId} />
              </div>
            )}

            {/* Mobile tabs */}
            <div className="lg:hidden flex border-b border-gray-800">
              {(['products', 'chat'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2.5 text-sm font-bold capitalize transition-colors ${activeTab === tab ? 'text-green-400 border-b-2 border-green-400' : 'text-gray-500'}`}>
                  {tab === 'products' ? `🛒 Products (${listedProducts.length})` : '💬 Chat'}
                </button>
              ))}
            </div>

            {activeTab === 'products' && (
              <div className="lg:hidden space-y-3">
                {/* Auction + group buy + bulk on mobile */}
                <LiveAuctionViewer sessionId={sessionId} socket={socket} />
                <LiveGroupBuyViewer sessionId={sessionId} socket={socket} />
                <LiveBulkViewer sessionId={sessionId} socket={socket} />

                {/* CHANGE #6 — Spotlight on mobile */}
                {spotlightProduct && (
                  <LiveProductCard product={{ ...spotlightProduct, isSpotlight: true }}
                    sessionId={sessionId} socket={socket}
                    onBuy={handleBuyNow} onAddCart={handleAddToCart}
                    isSpotlight hotProductIds={hotProductIds} />
                )}
                <div className="grid grid-cols-2 gap-3">
                  {listedProducts.filter(p => (p.id || p.productId) !== spotlightId).map((p: any) => (
                    <LiveProductCard key={p.pinId || p.id} product={p}
                      sessionId={sessionId} socket={socket}
                      onBuy={handleBuyNow} onAddCart={handleAddToCart}
                      isSpotlight={false} hotProductIds={hotProductIds} />
                  ))}
                </div>
                {listedProducts.length === 0 && (
                  <div className="text-center py-10 text-gray-500">
                    <Package size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{isSeller ? 'Tick products above to list them' : 'Seller is preparing products…'}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="lg:hidden h-80">
                <LiveChat sessionId={sessionId} socket={socket} userName={user?.name || 'Guest'} />
              </div>
            )}
          </div>

          {/* RIGHT: Products + Chat (desktop) */}
          <div className="hidden lg:flex flex-col gap-4 h-[calc(100vh-120px)]">
            <div className="flex-1 overflow-hidden flex flex-col bg-gray-900 rounded-2xl">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart size={14} className="text-green-400" />
                  <span className="text-white/70 text-xs font-bold uppercase tracking-wide">
                    Marketplace ({listedProducts.length})
                  </span>
                </div>
                {spotlightId && (
                  <span className="text-yellow-400 text-[10px] font-bold flex items-center gap-1">
                    <Star size={10} /> Spotlight active
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-3 scrollbar-hide space-y-3">
                {/* Auction viewer — shown to all */}
                <LiveAuctionViewer sessionId={sessionId} socket={socket} />
                {/* Group buy viewer — shown to all */}
                <LiveGroupBuyViewer sessionId={sessionId} socket={socket} />
                {/* Bulk purchase viewer — shown to all */}
                <LiveBulkViewer sessionId={sessionId} socket={socket} />

                {/* CHANGE #6 — Spotlight product first, full width */}
                {spotlightProduct && (
                  <LiveProductCard
                    product={{ ...spotlightProduct, isSpotlight: true }}
                    sessionId={sessionId} socket={socket}
                    onBuy={handleBuyNow} onAddCart={handleAddToCart}
                    isSpotlight hotProductIds={hotProductIds}
                  />
                )}

                {/* Rest of products */}
                {listedProducts.filter(p => (p.id || p.productId) !== spotlightId).length === 0 && !spotlightProduct ? (
                  <div className="text-center py-10 text-gray-600">
                    <Package size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">{isSeller ? 'Tick products to list them' : 'Seller hasn\'t listed products yet'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {listedProducts.filter(p => (p.id || p.productId) !== spotlightId).map((p: any) => (
                      <LiveProductCard key={p.pinId || p.id} product={p}
                        sessionId={sessionId} socket={socket}
                        onBuy={handleBuyNow} onAddCart={handleAddToCart}
                        isSpotlight={false} hotProductIds={hotProductIds} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="h-72 flex-shrink-0">
              <LiveChat sessionId={sessionId} socket={socket} userName={user?.name || 'Guest'} />
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-60px) scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
