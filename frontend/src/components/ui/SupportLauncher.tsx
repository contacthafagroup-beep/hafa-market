import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'

const PHONE  = '+254700000000'
const WA_NUM = '254700000000'
const WA_MSG = encodeURIComponent('Hello! I need help with Hafa Market 🌿')

interface Msg {
  id: string
  senderId: string
  senderName: string
  senderAvatar?: string
  senderRole: string
  content: string
  type: string
  createdAt: string
}

type Tab    = 'chat' | 'info'
type Expand = 'normal' | 'half' | 'full'

export default function SupportLauncher() {
  const { user, isAuthenticated } = useAuth()
  const [launcherOpen, setLauncherOpen] = useState(false)
  const [chatOpen, setChatOpen]         = useState(false)
  const [messages, setMessages]         = useState<Msg[]>([])
  const [input, setInput]               = useState('')
  const [tab, setTab]                   = useState<Tab>('chat')
  const [expand, setExpand]             = useState<Expand>('normal')
  const [roomId, setRoomId]             = useState<string | null>(null)
  const [agentTyping, setAgentTyping]   = useState(false)
  const [connected, setConnected]       = useState(false)
  const [loading, setLoading]           = useState(false)
  const socketRef   = useRef<Socket | null>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (messagesRef.current)
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages, agentTyping])

  const connectSocket = useCallback((token: string, room: string) => {
    if (socketRef.current?.connected) return
    const socket = io(import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5001', {
      auth: { token },
      transports: ['websocket'],
    })
    socket.on('connect', () => {
      setConnected(true)
      socket.emit('chat:join', room)
    })
    socket.on('disconnect', () => setConnected(false))
    socket.on('chat:message', (msg: Msg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })
    socket.on('chat:typing', ({ isTyping }: { userId: string; isTyping: boolean }) => {
      setAgentTyping(isTyping)
    })
    socketRef.current = socket
  }, [])

  const openChat = async () => {
    setLauncherOpen(false)
    setChatOpen(true)
    if (roomId) return

    if (!isAuthenticated) {
      // Guest mode — show login prompt
      return
    }

    setLoading(true)
    try {
      const token = localStorage.getItem('accessToken') || ''
      // Create/get support room
      const { data } = await api.post('/chat/support')
      const room = data.data.id
      setRoomId(room)

      // Load history
      const hist = await api.get(`/chat/${room}/messages`)
      setMessages(hist.data.data)

      // Connect socket
      connectSocket(token, room)
    } catch (e) {
      console.error('Chat init failed', e)
    } finally {
      setLoading(false)
    }
    setTimeout(() => inputRef.current?.focus(), 500)
  }

  const send = async () => {
    const msg = input.trim()
    if (!msg || !roomId) return
    setInput('')

    // Emit via socket (primary)
    if (socketRef.current?.connected) {
      socketRef.current.emit('chat:message', { roomId, type: 'TEXT', content: msg })
    } else {
      // REST fallback
      try {
        await api.post(`/chat/${roomId}/messages`, { type: 'TEXT', content: msg })
      } catch {}
    }
  }

  const handleTyping = () => {
    if (!socketRef.current || !roomId) return
    socketRef.current.emit('chat:typing', { roomId, isTyping: true })
    if (typingTimer.current) clearTimeout(typingTimer.current)
    typingTimer.current = setTimeout(() => {
      socketRef.current?.emit('chat:typing', { roomId, isTyping: false })
    }, 1500)
  }

  const cycleExpand = () =>
    setExpand(e => e === 'normal' ? 'half' : e === 'half' ? 'full' : 'normal')

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const isMe = (msg: Msg) => msg.senderId === user?.id

  const winStyle: React.CSSProperties = expand === 'full'
    ? { left: 0, bottom: 0, width: '100vw', height: '100vh', borderRadius: 0 }
    : expand === 'half'
    ? { left: 0, bottom: 0, width: '50vw', height: '100vh', borderRadius: '0 20px 20px 0' }
    : {
        left: '28px',
        bottom: '100px',
        width: 'min(400px, calc(100vw - 40px))',
        height: 'min(600px, calc(100vh - 120px))',
        borderRadius: '20px',
      }

  return (
    <div style={{ position: 'fixed', bottom: '28px', left: '28px', zIndex: 9999, fontFamily: 'Poppins, sans-serif' }}>

      {/* Launcher menu */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
        {launcherOpen && [
          { label: 'WhatsApp Chat', icon: 'fab fa-whatsapp', bg: 'linear-gradient(135deg,#25d366,#128c7e)', pulse: 'rgba(37,211,102,.5)',  action: () => { window.open(`https://wa.me/${WA_NUM}?text=${WA_MSG}`, '_blank'); setLauncherOpen(false) } },
          { label: 'Call Support',  icon: 'fas fa-phone',    bg: 'linear-gradient(135deg,#1976d2,#1565c0)', pulse: 'rgba(25,118,210,.5)',  action: () => { window.location.href = `tel:${PHONE}` } },
          { label: 'Live Chat',     icon: 'fas fa-comments', bg: 'linear-gradient(135deg,#7b1fa2,#6a1b9a)', pulse: 'rgba(123,31,162,.5)', action: openChat },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', animation: `supItemIn .3s cubic-bezier(.34,1.56,.64,1) ${i * 0.06}s both` }}>
            <div style={{ position: 'relative' }}>
              <button onClick={item.action}
                style={{ width: '50px', height: '50px', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', background: item.bg, boxShadow: `0 6px 20px ${item.pulse}`, color: '#fff', transition: '.25s ease' }}>
                <i className={item.icon} />
                <span style={{ position: 'absolute', inset: '-4px', borderRadius: '50%', border: `2px solid ${item.pulse}`, animation: 'supPulse 2.5s ease-out infinite', pointerEvents: 'none' }} />
              </button>
            </div>
            <span style={{ background: '#1a1a1a', color: '#fff', padding: '6px 12px', borderRadius: '8px', fontSize: '.78rem', fontWeight: 600, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,.2)' }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Main toggle */}
      <button onClick={() => setLauncherOpen(o => !o)}
        style={{ width: '60px', height: '60px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: launcherOpen ? 'linear-gradient(135deg,#c62828,#e53935)' : 'linear-gradient(135deg,#e65100,#FFA726)', boxShadow: launcherOpen ? '0 8px 28px rgba(198,40,40,.4)' : '0 8px 28px rgba(230,81,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', color: '#fff', transition: '.3s ease', position: 'relative' }}>
        <span style={{ transition: '.3s ease', transform: launcherOpen ? 'rotate(90deg)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {launcherOpen ? <i className="fas fa-times" /> : <i className="fas fa-headset" />}
        </span>
        {!launcherOpen && <span style={{ position: 'absolute', inset: '-6px', borderRadius: '50%', border: '2px solid rgba(255,167,38,.4)', animation: 'supPulse 2s ease-out infinite', pointerEvents: 'none' }} />}
      </button>

      {/* ── Chat Window ── */}
      {chatOpen && (
        <div style={{ position: 'fixed', ...winStyle, background: '#fff', boxShadow: '0 20px 80px rgba(0,0,0,.22)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(123,31,162,.15)', zIndex: 9998, animation: 'supIn .35s cubic-bezier(.34,1.56,.64,1)' }}>

          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg,#4a148c,#7b1fa2)', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', position: 'relative', flexShrink: 0 }}>
              👩🏾‍💼
              <span style={{ position: 'absolute', bottom: '1px', right: '1px', width: '10px', height: '10px', background: connected ? '#69f0ae' : '#9ca3af', borderRadius: '50%', border: '2px solid #7b1fa2' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ display: 'block', color: '#fff', fontSize: '.88rem', fontWeight: 700 }}>Hafa Support</strong>
              <span style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.75)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', background: connected ? '#69f0ae' : '#9ca3af', borderRadius: '50%', display: 'inline-block' }} />
                {connected ? 'Connected · Agent will reply shortly' : 'Connecting...'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
              <a href={`tel:${PHONE}`} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.82rem', textDecoration: 'none' }} title="Call">
                <i className="fas fa-phone" />
              </a>
              <button onClick={cycleExpand} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.82rem' }} title="Expand">
                <i className={`fas fa-${expand === 'full' ? 'compress' : 'expand-alt'}`} />
              </button>
              <button onClick={() => { setChatOpen(false); setExpand('normal') }} style={{ background: 'rgba(255,255,255,.25)', border: '1px solid rgba(255,255,255,.3)', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.85rem', fontWeight: 700 }} title="Close">
                ✕
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
            {(['chat', 'info'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ flex: 1, padding: '10px 6px', border: 'none', background: 'transparent', fontSize: '.75rem', fontWeight: 600, color: tab === t ? '#7b1fa2' : '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', borderBottom: `2px solid ${tab === t ? '#7b1fa2' : 'transparent'}`, fontFamily: 'inherit', transition: '.2s' }}>
                <i className={`fas fa-${t === 'chat' ? 'comment' : 'info-circle'}`} />
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Chat tab */}
          {tab === 'chat' && (
            <>
              {/* Messages */}
              <div ref={messagesRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', background: '#faf5ff' }}>

                {/* Not logged in */}
                {!isAuthenticated && (
                  <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🔐</div>
                    <p style={{ fontSize: '.88rem', color: '#374151', fontWeight: 600, marginBottom: '6px' }}>Sign in to chat with support</p>
                    <p style={{ fontSize: '.78rem', color: '#9ca3af', marginBottom: '16px' }}>You need an account to start a live chat session</p>
                    <a href="/login" style={{ background: 'linear-gradient(135deg,#7b1fa2,#9c27b0)', color: '#fff', padding: '10px 24px', borderRadius: '50px', textDecoration: 'none', fontSize: '.85rem', fontWeight: 700 }}>Sign In</a>
                  </div>
                )}

                {/* Loading */}
                {isAuthenticated && loading && (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
                    <div style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#7b1fa2', borderRadius: '50%', animation: 'supSpin .8s linear infinite', margin: '0 auto 12px' }} />
                    <p style={{ fontSize: '.85rem' }}>Connecting to support...</p>
                  </div>
                )}

                {/* Messages */}
                {messages.map((m) => {
                  const mine = isMe(m)
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexDirection: mine ? 'row-reverse' : 'row', animation: 'msgIn .25s ease', maxWidth: '100%' }}>
                      {!mine && (
                        <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg,#4a148c,#7b1fa2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.85rem', flexShrink: 0, color: '#fff', fontWeight: 700 }}>
                          {m.senderName?.[0]?.toUpperCase() || '👩🏾‍💼'}
                        </div>
                      )}
                      <div style={{ maxWidth: '78%', minWidth: 0 }}>
                        {!mine && <div style={{ fontSize: '.65rem', color: '#9ca3af', marginBottom: '3px', paddingLeft: '4px' }}>{m.senderName}</div>}
                        <div style={{ background: mine ? 'linear-gradient(135deg,#7b1fa2,#9c27b0)' : '#fff', borderRadius: mine ? '16px 4px 16px 16px' : '4px 16px 16px 16px', padding: '10px 13px', boxShadow: mine ? '0 4px 12px rgba(123,31,162,.3)' : '0 1px 4px rgba(0,0,0,.08)', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                          <div style={{ fontSize: '.84rem', lineHeight: 1.6, color: mine ? '#fff' : '#374151' }}>{m.content}</div>
                        </div>
                        <div style={{ fontSize: '.62rem', color: '#9ca3af', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '3px', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                          {fmtTime(m.createdAt)}
                          {mine && <i className="fas fa-check-double" style={{ color: '#69f0ae', fontSize: '.65rem' }} />}
                        </div>
                      </div>
                    </div>
                  )
                })}

                {/* Agent typing */}
                {agentTyping && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', animation: 'msgIn .25s ease' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg,#4a148c,#7b1fa2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.85rem', flexShrink: 0 }}>👩🏾‍💼</div>
                    <div style={{ background: '#fff', borderRadius: '4px 16px 16px 16px', padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.08)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {[0,1,2].map(i => <span key={i} style={{ width: '7px', height: '7px', background: '#9ca3af', borderRadius: '50%', animation: `supDot 1.2s infinite ${i * 0.2}s`, display: 'inline-block' }} />)}
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              {isAuthenticated && !loading && (
                <div style={{ padding: '10px 12px 12px', borderTop: '1px solid #f3f4f6', flexShrink: 0, background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', background: '#f9fafb', borderRadius: '16px', padding: '6px 8px', border: '1.5px solid #e5e7eb', transition: '.2s' }} className="sup-input-wrap">
                    <textarea ref={inputRef} value={input}
                      onChange={e => { setInput(e.target.value); handleTyping(); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                      placeholder={roomId ? 'Type a message...' : 'Connecting...'}
                      disabled={!roomId}
                      rows={1}
                      style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '.86rem', fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5, maxHeight: '100px', minHeight: '22px', color: '#374151', overflowY: 'auto' }} />
                    <button onClick={send} disabled={!input.trim() || !roomId}
                      style={{ background: input.trim() && roomId ? 'linear-gradient(135deg,#7b1fa2,#9c27b0)' : '#e5e7eb', border: 'none', color: input.trim() && roomId ? '#fff' : '#9ca3af', width: '34px', height: '34px', borderRadius: '50%', cursor: input.trim() && roomId ? 'pointer' : 'default', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '.2s', boxShadow: input.trim() && roomId ? '0 4px 12px rgba(123,31,162,.3)' : 'none' }}>
                      <i className="fas fa-paper-plane" style={{ fontSize: '.8rem' }} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.62rem', color: '#9ca3af', marginTop: '5px', padding: '0 4px' }}>
                    <span>🔒 End-to-end encrypted</span>
                    <span>{connected ? '🟢 Live' : '🔴 Offline'}</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Info tab */}
          {tab === 'info' && (
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '8px' }}>👩🏾‍💼</div>
                <strong style={{ display: 'block', fontSize: '1rem', color: '#374151' }}>Hafa Support</strong>
                <span style={{ color: '#7b1fa2', fontSize: '.85rem' }}>Live Support Agent</span>
              </div>
              <div style={{ background: '#f9fafb', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                {[
                  { icon: 'fas fa-clock',    text: 'Mon–Sat, 8am–8pm' },
                  { icon: 'fas fa-phone',    text: PHONE },
                  { icon: 'fas fa-envelope', text: 'hello@hafamarket.com' },
                  { icon: 'fas fa-bolt',     text: 'Response within 2 hours' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '.85rem', color: '#374151' }}>
                    <i className={item.icon} style={{ color: '#7b1fa2', width: '16px' }} />
                    {item.text}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => window.open(`https://wa.me/${WA_NUM}?text=${WA_MSG}`, '_blank')}
                  style={{ background: '#25d366', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '.88rem' }}>
                  <i className="fab fa-whatsapp" /> Open WhatsApp
                </button>
                <a href={`tel:${PHONE}`} style={{ background: '#1976d2', color: '#fff', padding: '12px', borderRadius: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '.88rem', textDecoration: 'none' }}>
                  <i className="fas fa-phone" /> Call Now
                </a>
                <button onClick={() => setTab('chat')}
                  style={{ background: 'linear-gradient(135deg,#7b1fa2,#9c27b0)', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '.88rem' }}>
                  <i className="fas fa-comments" /> Start Live Chat
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes supPulse  { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.6);opacity:0} }
        @keyframes supItemIn { from{opacity:0;transform:translateY(16px) scale(.85)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes supIn     { from{opacity:0;transform:scale(.9) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes supDot    { 0%,60%,100%{transform:translateY(0);opacity:.6} 30%{transform:translateY(-5px);opacity:1} }
        @keyframes msgIn     { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes supSpin   { to{transform:rotate(360deg)} }
        .sup-input-wrap:focus-within { border-color: #7b1fa2 !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(123,31,162,.08) !important; }
      `}</style>
    </div>
  )
}
