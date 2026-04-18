import { useState, useEffect, useRef, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Video, Users, Play, Clock, Plus, X, ExternalLink, ShoppingCart, Send, Heart, Zap, MessageSquare, Star, AlertTriangle, CheckCircle } from "lucide-react"
import { io as socketIO, Socket } from "socket.io-client"
import api from "@/lib/api"
import Spinner from "@/components/ui/Spinner"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { formatDate, formatPrice } from "@/lib/utils"
import toast from "react-hot-toast"
import { useAuth } from "@/hooks/useAuth"
import { useCart } from "@/hooks/useCart"
import { Link } from "react-router-dom"

// ── Streaming URL → embeddable iframe src ─────────────────────────────────────
function toEmbedUrl(url: string): string | null {
  if (!url) return null
  try {
    const ytWatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
    if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}?autoplay=1&rel=0`
    const ytLive = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/)
    if (ytLive) return `https://www.youtube.com/embed/${ytLive[1]}?autoplay=1&rel=0`
    if (url.includes('/embed/')) return url
    if (url.includes('facebook.com') || url.includes('fb.com')) return null
    return url
  } catch { return null }
}

// ── Floating emoji reaction animation ────────────────────────────────────────
function FloatingReaction({ emoji, id }: { emoji: string; id: string }) {
  return (
    <div key={id} className="absolute bottom-4 right-4 text-2xl animate-bounce pointer-events-none"
      style={{ animation: 'floatUp 2s ease-out forwards' }}>
      {emoji}
    </div>
  )
}

// ── Live chat panel ───────────────────────────────────────────────────────────
function LiveChat({ sessionId, socket, isAdmin }: { sessionId: string; socket: Socket | null; isAdmin: boolean }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState("")
  const [isQuestion, setIsQuestion] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load chat history — use new /live route
  useEffect(() => {
    api.get(`/live/${sessionId}/messages`)
      .then(r => setMessages(r.data.data || []))
      .catch(() => {})
  }, [sessionId])

  // Socket listener
  useEffect(() => {
    if (!socket) return
    const handler = (msg: any) => {
      setMessages(prev => [...prev.slice(-199), msg]) // keep last 200
    }
    socket.on('live:message', handler)
    return () => { socket.off('live:message', handler) }
  }, [socket])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const [isListening, setIsListening] = useState(false)

  const startVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) { toast.error('Voice not supported in this browser'); return }
    const recognition = new SpeechRecognition()
    recognition.lang = 'am-ET' // Amharic — falls back to device language
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput(prev => prev + transcript)
    }
    recognition.onerror = () => setIsListening(false)
    recognition.start()
  }

  const send = () => {
    if (!input.trim() || !socket) return
    socket.emit('live:message', { sessionId, content: input.trim(), isQuestion })
    setInput("")
    setIsQuestion(false)
  }

  const TYPE_COLORS: Record<string, string> = {
    CHAT: 'text-white',
    SYSTEM: 'text-yellow-300 italic',
    ORDER: 'text-green-400 font-bold',
  }

  return (
    <div className="flex flex-col h-full bg-black/60">
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2">
        <MessageSquare size={14} className="text-white/60" />
        <span className="text-white/60 text-xs font-bold uppercase tracking-wide">Live Chat</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-hide">
        {messages.map((m: any) => (
          <div key={m.id} className="flex items-start gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0 mt-0.5">
              {m.userName?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-green-400 text-[11px] font-bold mr-1">{m.userName}</span>
              {m.isQuestion && <span className="text-yellow-400 text-[10px] mr-1">❓</span>}
              <span className={`text-xs ${TYPE_COLORS[m.type] || 'text-white'} break-words`}>{m.content}</span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-white/10">
        <div className="flex gap-1.5 mb-1.5">
          {['❤️','🔥','👏','😍','💯'].map(e => (
            <button key={e} onClick={() => socket?.emit('live:reaction', { sessionId, emoji: e })}
              className="text-base hover:scale-125 transition-transform">
              {e}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setIsQuestion(!isQuestion)}
            className={`text-xs px-2 py-1.5 rounded-lg border transition-colors flex-shrink-0 ${isQuestion ? 'bg-yellow-500 border-yellow-500 text-white' : 'border-white/20 text-white/50 hover:border-yellow-400'}`}>
            ❓
          </button>
          {/* Voice-to-text (Amharic support) */}
          <button onClick={startVoice} disabled={isListening}
            className={`text-xs px-2 py-1.5 rounded-lg border transition-colors flex-shrink-0 ${isListening ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'border-white/20 text-white/50 hover:border-red-400'}`}
            title="Voice input (Amharic supported)">
            🎤
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={isListening ? "Listening..." : isQuestion ? "Ask a question..." : "Say something..."}
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/40 outline-none focus:border-green-400"
          />
          <button onClick={send} disabled={!input.trim()}
            className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center disabled:opacity-40 hover:bg-green-400 transition-colors flex-shrink-0">
            <Send size={13} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pinned product "Buy Now" overlay ─────────────────────────────────────────
function PinnedProduct({ pin, onBuy, onClose }: { pin: any; onBuy: () => void; onClose: () => void }) {
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  useEffect(() => {
    if (!pin.endsAt) return
    const tick = () => {
      const diff = new Date(pin.endsAt).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('Expired'); return }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${m}:${s.toString().padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [pin.endsAt])

  return (
    <div className="bg-gradient-to-r from-green-900/90 to-green-800/90 border border-green-500/50 rounded-2xl p-4 mx-3 mb-3">
      <div className="flex items-center gap-3">
        {/* Product image */}
        <div className="w-14 h-14 rounded-xl overflow-hidden bg-white/10 flex-shrink-0">
          {pin.images?.[0]
            ? <img src={pin.images[0]} className="w-full h-full object-cover" alt="" />
            : <span className="flex items-center justify-center h-full text-2xl">🛒</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-black text-red-400 bg-red-400/20 px-1.5 py-0.5 rounded-full animate-pulse">
              🔴 LIVE DEAL
            </span>
            {pin.discount > 0 && (
              <span className="text-[10px] font-black text-green-400">-{pin.discount}% OFF</span>
            )}
          </div>
          <p className="text-white font-bold text-sm truncate">{pin.name}</p>
          <div className="flex items-center gap-2">
            <span className="text-green-400 font-extrabold">{formatPrice(pin.specialPrice)}</span>
            {pin.discount > 0 && (
              <span className="text-white/40 line-through text-xs">{formatPrice(pin.originalPrice)}</span>
            )}
          </div>
          {pin.limitedStock && (
            <p className="text-orange-400 text-[10px] font-bold">Only {pin.limitedStock} left!</p>
          )}
          {timeLeft && (
            <p className="text-yellow-400 text-[10px] font-mono font-bold">⏱ {timeLeft}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button onClick={onBuy}
            className="bg-green-500 hover:bg-green-400 text-white text-xs font-black px-4 py-2 rounded-xl transition-colors flex items-center gap-1">
            <ShoppingCart size={12} /> Buy Now
          </button>
          <button onClick={onClose} className="text-white/40 hover:text-white/70 text-[10px] text-center transition-colors">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Full-screen live player ───────────────────────────────────────────────────
function LivePlayer({ session, onClose }: { session: any; onClose: () => void }) {
  const { user } = useAuth()
  const { add } = useCart()
  const qc = useQueryClient()
  const socketRef = useRef<Socket | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [viewers, setViewers] = useState(session.viewerCount || 0)
  const [reactions, setReactions] = useState<{ id: string; emoji: string }[]>([])
  const [pinnedProduct, setPinnedProduct] = useState<any>(null)
  const [orderFlashes, setOrderFlashes] = useState<string[]>([])
  const embedUrl = toEmbedUrl(session.streamUrl || '')
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SELLER'

  // Connect socket
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    const s = socketIO(
      import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5001',
      { transports: ['websocket'], auth: { token: token || '' }, reconnectionAttempts: 5 }
    )
    socketRef.current = s
    setSocket(s)

    s.on('connect', () => {
      s.emit('live:join', session.id)
    })

    s.on('live:viewers', ({ count }: { count: number }) => setViewers(count))

    s.on('live:reaction', ({ emoji, id }: { emoji: string; id: string }) => {
      setReactions(prev => [...prev, { emoji, id }])
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 2000)
    })

    s.on('live:product_pinned', (pin: any) => {
      setPinnedProduct(pin)
      toast('🔥 New live deal!', { icon: '🛒', duration: 3000 })
    })

    s.on('live:product_unpinned', () => setPinnedProduct(null))

    s.on('live:order_flash', ({ message }: { message: string }) => {
      setOrderFlashes(prev => [...prev, message])
      setTimeout(() => setOrderFlashes(prev => prev.slice(1)), 4000)
    })

    return () => {
      s.emit('live:leave', session.id)
      s.disconnect()
    }
  }, [session.id])

  // Load existing pinned products
  useEffect(() => {
    api.get(`/features/live/${session.id}/pinned`)
      .then(r => { if (r.data.data?.[0]) setPinnedProduct(r.data.data[0]) })
      .catch(() => {})
  }, [session.id])

  const handleBuyNow = () => {
    if (!pinnedProduct) return
    const product = {
      id: pinnedProduct.productId,
      name: pinnedProduct.name,
      price: pinnedProduct.specialPrice || pinnedProduct.price,
      images: pinnedProduct.images,
      unit: pinnedProduct.unit,
      stock: pinnedProduct.limitedStock || pinnedProduct.stock,
      slug: pinnedProduct.slug,
    }
    add(product as any, 1)
    toast.success('Added to cart! 🛒')
    // Broadcast social proof
    socket?.emit('live:order_placed', {
      sessionId: session.id,
      productName: pinnedProduct.name,
      buyerName: user?.name?.split(' ')[0] || 'Someone',
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col lg:flex-row">
      {/* ── Video side ── */}
      <div className="flex-1 flex flex-col relative">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
            </div>
            <p className="text-white font-bold text-sm truncate max-w-[200px]">{session.title}</p>
            <span className="text-white/60 text-xs flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full">
              <Users size={11} /> {viewers}
            </span>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Video */}
        <div className="flex-1 bg-black flex items-center justify-center">
          {embedUrl ? (
            <iframe src={embedUrl} className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen title={session.title} />
          ) : session.streamUrl ? (
            <div className="text-center text-white p-8">
              <Video size={48} className="mx-auto mb-4 opacity-40" />
              <p className="font-bold mb-3">Can't embed this stream</p>
              <a href={session.streamUrl} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 bg-red-500 text-white px-6 py-3 rounded-full font-bold hover:bg-red-600 transition-colors">
                <ExternalLink size={16} /> Watch on Platform
              </a>
            </div>
          ) : (
            <div className="text-center text-white p-8">
              <Video size={48} className="mx-auto mb-4 opacity-40" />
              <p className="font-bold">Stream starting soon…</p>
            </div>
          )}
        </div>

        {/* Floating reactions */}
        <div className="absolute bottom-20 right-4 pointer-events-none">
          {reactions.map(r => (
            <div key={r.id} className="text-2xl" style={{ animation: 'floatUp 2s ease-out forwards' }}>
              {r.emoji}
            </div>
          ))}
        </div>

        {/* Order flash notifications */}
        <div className="absolute top-16 left-4 space-y-1 pointer-events-none">
          {orderFlashes.map((msg, i) => (
            <div key={i} className="bg-green-500/90 text-white text-xs font-bold px-3 py-1.5 rounded-full">
              {msg}
            </div>
          ))}
        </div>

        {/* Pinned product overlay */}
        {pinnedProduct && (
          <div className="absolute bottom-0 left-0 right-0">
            <PinnedProduct
              pin={pinnedProduct}
              onBuy={handleBuyNow}
              onClose={() => setPinnedProduct(null)}
            />
          </div>
        )}

        {/* Seller controls */}
        {isAdmin && (
          <SellerLiveControls sessionId={session.id} socket={socket} />
        )}
      </div>

      {/* ── Chat side (desktop) ── */}
      <div className="w-full lg:w-80 flex flex-col bg-black/80 border-l border-white/10 max-h-[40vh] lg:max-h-full">
        <LiveChat sessionId={session.id} socket={socket} isAdmin={isAdmin} />
      </div>

      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-80px) scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

// ── Seller controls panel (pin products, end stream) ─────────────────────────
function SellerLiveControls({ sessionId, socket }: { sessionId: string; socket: Socket | null }) {
  const [showPin, setShowPin] = useState(false)
  const [pinForm, setPinForm] = useState({ productId: '', specialPrice: '', limitedStock: '', durationSeconds: '300' })

  const { data: myProducts = [] } = useQuery({
    queryKey: ['seller-products-live'],
    queryFn: () => api.get('/sellers/me/products?limit=50').then(r => r.data.data || []),
  })

  const pinProduct = () => {
    if (!pinForm.productId || !socket) return
    socket.emit('live:pin_product', {
      sessionId,
      productId: pinForm.productId,
      specialPrice: pinForm.specialPrice ? parseFloat(pinForm.specialPrice) : undefined,
      limitedStock: pinForm.limitedStock ? parseInt(pinForm.limitedStock) : undefined,
      durationSeconds: parseInt(pinForm.durationSeconds) || 300,
    })
    toast.success('Product pinned! Viewers can now buy it.')
    setShowPin(false)
    setPinForm({ productId: '', specialPrice: '', limitedStock: '', durationSeconds: '300' })
  }

  return (
    <div className="absolute bottom-4 left-4">
      <button onClick={() => setShowPin(!showPin)}
        className="flex items-center gap-1.5 bg-green-500 hover:bg-green-400 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors">
        <ShoppingCart size={13} /> Pin Product
      </button>

      {showPin && (
        <div className="absolute bottom-10 left-0 bg-gray-900 border border-white/20 rounded-2xl p-4 w-72 space-y-3">
          <p className="text-white font-bold text-sm">📌 Pin a Product</p>
          <select value={pinForm.productId} onChange={e => setPinForm(f => ({ ...f, productId: e.target.value }))}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white outline-none">
            <option value="">Select product...</option>
            {myProducts.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name} — ETB {p.price}</option>
            ))}
          </select>
          <input type="number" placeholder="Special price (optional)"
            value={pinForm.specialPrice} onChange={e => setPinForm(f => ({ ...f, specialPrice: e.target.value }))}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder-white/40" />
          <input type="number" placeholder="Limited stock (optional)"
            value={pinForm.limitedStock} onChange={e => setPinForm(f => ({ ...f, limitedStock: e.target.value }))}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white outline-none placeholder-white/40" />
          <div>
            <label className="text-white/60 text-xs mb-1 block">Duration</label>
            <select value={pinForm.durationSeconds} onChange={e => setPinForm(f => ({ ...f, durationSeconds: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-sm text-white outline-none">
              <option value="60">1 minute</option>
              <option value="300">5 minutes</option>
              <option value="600">10 minutes</option>
              <option value="0">Until manually removed</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={pinProduct} disabled={!pinForm.productId}
              className="flex-1 bg-green-500 hover:bg-green-400 text-white text-xs font-bold py-2 rounded-xl disabled:opacity-40 transition-colors">
              Pin Now
            </button>
            <button onClick={() => setShowPin(false)}
              className="text-white/50 hover:text-white text-xs px-3 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LiveCommerce() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: "", description: "", scheduledAt: "", streamUrl: "", productIds: [] as string[] })
  const [watchingSession, setWatchingSession] = useState<any>(null)
  const [startingSession, setStartingSession] = useState<string | null>(null)
  const [startStreamUrl, setStartStreamUrl] = useState("")

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["live-sessions"],
    queryFn: () => api.get("/live").then(r => r.data.data),  // new dedicated route
    refetchInterval: 15000,
  })

  // Personalized recommendations (separate query)
  const { data: recommended = [] } = useQuery({
    queryKey: ["live-recommended"],
    queryFn: () => api.get("/live/recommended").then(r => r.data.data),
    staleTime: 60000,
  })

  const { mutate: create, isLoading: creating } = useMutation({
    mutationFn: () => api.post("/live", form),
    onSuccess: () => {
      toast.success("Session created! Start it when you're ready to go live.")
      setShowCreate(false)
      setForm({ title: "", description: "", scheduledAt: "", streamUrl: "", productIds: [] })
      qc.invalidateQueries({ queryKey: ["live-sessions"] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed to create session"),
  })

  const { mutate: startSession } = useMutation({
    mutationFn: ({ id, streamUrl }: { id: string; streamUrl?: string }) =>
      api.patch(`/live/${id}/start`, { streamUrl }),
    onSuccess: () => {
      toast.success("You are now LIVE! 🔴")
      setStartingSession(null)
      setStartStreamUrl("")
      qc.invalidateQueries({ queryKey: ["live-sessions"] })
    },
  })

  const { mutate: endSession } = useMutation({
    mutationFn: (id: string) => api.patch(`/live/${id}/end`),
    onSuccess: () => {
      toast.success("Stream ended")
      qc.invalidateQueries({ queryKey: ["live-sessions"] })
    },
  })

  const live = sessions.filter((s: any) => s.status === "LIVE")
  const scheduled = sessions.filter((s: any) => s.status === "SCHEDULED")

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Full-screen player */}
      {watchingSession && (
        <LivePlayer session={watchingSession} onClose={() => setWatchingSession(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
              <Video size={20} className="text-white" />
            </div>
            Live Commerce
          </h1>
          <p className="text-gray-400 mt-1">Watch, chat, and buy in real-time</p>
        </div>
        {(user?.role === "SELLER" || user?.role === "ADMIN") && (
          <Button onClick={() => setShowCreate(true)} className="bg-red-500 hover:bg-red-600 text-white border-red-500">
            <Video size={16} /> Go Live
          </Button>
        )}
      </div>

      {/* Create session form */}
      {showCreate && (
        <div className="bg-white rounded-2xl shadow-card p-6 mb-8 border-2 border-red-100">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-extrabold text-gray-900 flex items-center gap-2">
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <Video size={12} className="text-white" />
              </div>
              Create Live Session
            </h3>
            <button onClick={() => setShowCreate(false)}><X size={18} className="text-gray-400" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input label="Session Title *" placeholder="e.g. Fresh Teff Harvest — Live from Hossana Farm"
                value={form.title} onChange={(e: any) => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} placeholder="What will you show? Products, prices, farm tour..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-400 resize-none" />
            </div>
            <Input label="Schedule for (optional)" type="datetime-local" value={form.scheduledAt}
              onChange={(e: any) => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                📺 Stream URL
                <span className="text-gray-400 font-normal ml-1 text-xs">(YouTube Live, Facebook Live)</span>
              </label>
              <input value={form.streamUrl} onChange={e => setForm(f => ({ ...f, streamUrl: e.target.value }))}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-400" />
              <p className="text-xs text-gray-400 mt-1">Start your YouTube/Facebook Live first, then paste the URL</p>
            </div>
          </div>

          {/* How it works */}
          <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-xs font-bold text-red-700 mb-2">📋 How Live Commerce Works</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { step: '1', icon: '📱', text: 'Start YouTube/Facebook Live on your phone' },
                { step: '2', icon: '🔗', text: 'Paste the URL here and create session' },
                { step: '3', icon: '🛒', text: 'Pin products during stream — viewers buy instantly' },
              ].map(s => (
                <div key={s.step} className="bg-white rounded-xl p-3">
                  <div className="text-xl mb-1">{s.icon}</div>
                  <p className="text-[10px] text-gray-600">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <Button loading={creating} onClick={() => create()} disabled={!form.title}>
              Create Session
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* LIVE NOW */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          {live.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <p className="text-sm font-black text-red-500 uppercase tracking-widest">Live Now</p>
                <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">{live.length}</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                {live.map((s: any) => (
                  <div key={s.id} className="bg-white rounded-2xl shadow-card overflow-hidden border-2 border-red-200 hover:border-red-400 transition-all group">
                    {/* Thumbnail */}
                    <div className="bg-gradient-to-br from-red-600 to-red-900 h-40 flex items-center justify-center relative overflow-hidden cursor-pointer"
                      onClick={() => { api.post(`/features/live/${s.id}/view`).catch(() => {}); setWatchingSession(s) }}>
                      <Video size={48} className="text-white/20" />
                      {/* LIVE badge */}
                      <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                      </div>
                      {/* Viewer count */}
                      <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <Users size={11} /> {s.viewerCount}
                      </div>
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                        <div className="w-14 h-14 bg-white/0 group-hover:bg-white/20 rounded-full flex items-center justify-center transition-all">
                          <Play size={28} className="text-white/0 group-hover:text-white transition-all ml-1" />
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{s.title}</h3>
                      {s.description && <p className="text-xs text-gray-400 mb-3 line-clamp-2">{s.description}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" fullWidth
                          onClick={() => { api.post(`/features/live/${s.id}/view`).catch(() => {}); setWatchingSession(s) }}
                          className="bg-red-500 hover:bg-red-600 text-white border-red-500">
                          <Play size={14} /> Watch Live
                        </Button>
                        {(user?.role === "SELLER" || user?.role === "ADMIN") && (
                          <Button size="sm" variant="outline" onClick={() => endSession(s.id)}>End</Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scheduled */}
          {scheduled.length > 0 && (
            <div className="mb-8">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">⏰ Upcoming Sessions</p>
              <div className="space-y-3">
                {scheduled.map((s: any) => (
                  <div key={s.id} className="bg-white rounded-2xl shadow-card p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Clock size={20} className="text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900">{s.title}</p>
                        {s.scheduledAt && <p className="text-xs text-gray-400">{formatDate(s.scheduledAt)}</p>}
                        {s.streamUrl && (
                          <p className="text-xs text-green-primary truncate flex items-center gap-1">
                            <Video size={10} /> Stream URL set
                          </p>
                        )}
                      </div>
                      {(user?.role === "SELLER" || user?.role === "ADMIN") && (
                        <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white border-red-500"
                          onClick={() => setStartingSession(startingSession === s.id ? null : s.id)}>
                          <Play size={13} /> Start
                        </Button>
                      )}
                    </div>

                    {startingSession === s.id && (
                      <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 mb-1">
                            📺 Stream URL — paste your YouTube/Facebook Live link
                          </label>
                          <input value={startStreamUrl} onChange={e => setStartStreamUrl(e.target.value)}
                            placeholder="https://youtube.com/watch?v=..."
                            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-400" />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white border-red-500"
                            onClick={() => startSession({ id: s.id, streamUrl: startStreamUrl || undefined })}>
                            🔴 Go Live Now
                          </Button>
                          <Button size="sm" variant="ghost"
                            onClick={() => { setStartingSession(null); setStartStreamUrl("") }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!live.length && !scheduled.length && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video size={36} className="text-red-300" />
              </div>
              <h3 className="font-bold text-gray-700 mb-2">No live sessions right now</h3>
              <p className="text-gray-400 text-sm mb-6">Check back soon — sellers go live to show fresh products</p>
              {(user?.role === "SELLER" || user?.role === "ADMIN") && (
                <Button onClick={() => setShowCreate(true)} className="bg-red-500 hover:bg-red-600 text-white border-red-500">
                  <Video size={16} /> Start Your First Live Session
                </Button>
              )}
            </div>
          )}

          {/* Personalized recommendations — shown when user is logged in */}
          {recommended.length > 0 && (
            <div className="mt-8">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                ✨ Recommended for You
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {recommended.slice(0, 4).map((s: any) => (
                  <div key={s.id} className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3 hover:shadow-card-hover transition-all cursor-pointer"
                    onClick={() => { api.post(`/live/${s.id}/view`).catch(() => {}); setWatchingSession(s) }}>
                    <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Video size={20} className="text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{s.title}</p>
                      <p className="text-xs text-gray-400">{s.seller?.storeName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                          s.status === 'LIVE' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {s.status === 'LIVE' && <span className="w-1 h-1 bg-red-500 rounded-full inline-block mr-0.5 animate-pulse" />}
                          {s.status}
                        </span>
                        {s.isFollowing && <span className="text-[10px] text-green-primary font-bold">Following</span>}
                        <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Users size={9} /> {s.viewerCount}
                        </span>
                      </div>
                    </div>
                    <Play size={16} className="text-gray-300 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* How it works for buyers */}
          {!user && (
            <div className="mt-10 bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-2xl p-6">
              <h3 className="font-extrabold text-gray-900 mb-4 text-center">🛒 How Live Shopping Works</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { icon: '📺', title: 'Watch Live', desc: 'Join a live stream and see fresh products in real-time' },
                  { icon: '💬', title: 'Chat & Ask', desc: 'Ask questions, react with emojis, interact with the seller' },
                  { icon: '⚡', title: 'Buy Instantly', desc: 'Tap "Buy Now" on pinned products — one-click checkout' },
                ].map(s => (
                  <div key={s.title} className="bg-white rounded-xl p-4 text-center">
                    <div className="text-3xl mb-2">{s.icon}</div>
                    <p className="font-bold text-gray-800 mb-1">{s.title}</p>
                    <p className="text-xs text-gray-500">{s.desc}</p>
                  </div>
                ))}
              </div>
              <div className="text-center mt-4">
                <Link to="/register" className="text-red-500 font-bold hover:underline text-sm">
                  Sign up free to join live sessions →
                </Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
