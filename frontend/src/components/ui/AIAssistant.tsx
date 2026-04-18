import { useState, useEffect, useRef } from 'react'
import api from '@/lib/api'

const LANGS: Record<string, { name: string; flag: string; greeting: string; placeholder: string; suggestions: string[] }> = {
  en: { name:'English', flag:'🇬🇧', greeting:"Hi! I'm **Hafa AI** 🌿 — your smart agricultural shopping assistant. How can I help you today?", placeholder:'Ask me anything...', suggestions:['What products do you sell?','How does delivery work?','How do I become a seller?',"Today's deals?"] },
  am: { name:'አማርኛ', flag:'🇪🇹', greeting:'ሰላም! እኔ **ሃፋ AI** ነኝ 🌿 — የእርስዎ ብልህ የግብርና ግዢ ረዳት።', placeholder:'ማንኛውንም ጥያቄ ይጠይቁ...', suggestions:['ምን ምርቶች ይሸጣሉ?','ዕቃ ማድረስ?','ሻጭ እንዴት?','ቅናሾች?'] },
  sw: { name:'Kiswahili', flag:'🇰🇪', greeting:'Habari! Mimi ni **Hafa AI** 🌿 — msaidizi wako wa ununuzi.', placeholder:'Uliza chochote...', suggestions:['Bidhaa gani?','Uwasilishaji?','Kuwa muuzaji?','Ofa za leo?'] },
  fr: { name:'Français', flag:'🇫🇷', greeting:"Bonjour! Je suis **Hafa AI** 🌿 — votre assistant shopping.", placeholder:'Posez une question...', suggestions:['Quels produits?','Livraison?','Devenir vendeur?','Offres?'] },
}

const FALLBACK: Record<string, string> = {
  product: `🛒 We offer **10,000+ products**:\n\n🥬 Vegetables · 🍎 Fruits · 🌾 Grains\n🌿 Spices · 🥚 Poultry · ☕ Coffee\n🍯 Specialty · 🥩 Meat\n\nAll from **500+ verified local farmers**.`,
  delivery: `📦 **Delivery Info:**\n\n⏱ 24–48 hours to your door\n🚚 Free on orders over $50\n📍 30+ cities across Africa\n📱 Real-time SMS tracking`,
  payment: `💳 **We accept:**\n\n✅ M-Pesa & MTN MoMo\n✅ Credit/Debit Card\n✅ Cash on Delivery\n✅ PayPal\n\n🔒 SSL encrypted & secure`,
  seller: `🌿 **Become a Seller:**\n\n1️⃣ Register & verify\n2️⃣ List your products\n3️⃣ Receive orders\n4️⃣ Get paid instantly\n\nAccess **50,000+ buyers** across Africa!`,
  deal: `🔥 **Today's Deals:**\n\n🥬 40% OFF organic vegetables\n🌾 25% OFF bulk grains 10kg+\n🛠 Tools from $9.99\n\n🎁 Code **HAFA10** = 10% off first order`,
  default: `I'm here to help! 😊 Ask me about products, delivery, payments, sellers, or deals.`,
}

interface Message { role: 'bot' | 'user'; text: string; time: string }

export default function AIAssistant() {
  const [open, setOpen]           = useState(false)
  const [lang, setLang]           = useState('en')
  const [langMenu, setLangMenu]   = useState(false)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [typing, setTyping]       = useState(false)
  const [notif, setNotif]         = useState(false)
  const [listening, setListening] = useState(false)
  const [suggestionsShown, setSuggestionsShown] = useState(true)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)
  const L = LANGS[lang] || LANGS.en

  useEffect(() => {
    const t = setTimeout(() => { if (!open) setNotif(true) }, 4000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, typing])

  const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const addMsg = (role: 'bot' | 'user', text: string) =>
    setMessages(prev => [...prev, { role, text, time: now() }])

  const openChat = () => {
    setOpen(true)
    setNotif(false)
    if (messages.length === 0) {
      setTimeout(() => addMsg('bot', L.greeting), 300)
    }
    setTimeout(() => inputRef.current?.focus(), 400)
  }

  const send = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg) return
    addMsg('user', msg)
    setInput('')
    setSuggestionsShown(false)
    setTyping(true)

    const history = messages.slice(-10).map(m => ({
      role: m.role === 'bot' ? 'assistant' : 'user',
      content: m.text,
    }))

    try {
      const res = await api.post('/ai/chat', { message: msg, language: lang, history })
      setTyping(false)
      addMsg('bot', res.data.data.reply)
    } catch {
      setTyping(false)
      const m = msg.toLowerCase()
      let reply = FALLBACK.default
      if (/product|vegetab|fruit|grain|coffee|sell/i.test(m)) reply = FALLBACK.product
      else if (/deliver|ship|fast|time/i.test(m)) reply = FALLBACK.delivery
      else if (/pay|mpesa|card|cash/i.test(m)) reply = FALLBACK.payment
      else if (/seller|farm|vendor/i.test(m)) reply = FALLBACK.seller
      else if (/deal|discount|promo|offer/i.test(m)) reply = FALLBACK.deal
      addMsg('bot', reply)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  const toggleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = false
    setListening(true)
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript
      setInput(t)
      setTimeout(() => send(t), 100)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.start()
  }

  const clearChat = () => {
    setMessages([])
    setSuggestionsShown(true)
    setTimeout(() => addMsg('bot', L.greeting), 200)
  }

  const fmt = (text: string) =>
    text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')

  return (
    <>
      {/* Floating trigger button */}
      <div style={{ position: 'fixed', bottom: '28px', right: '28px', zIndex: 9999 }}>
        <button onClick={open ? () => setOpen(false) : openChat}
          style={{ width: '60px', height: '60px', borderRadius: '50%', background: open ? 'linear-gradient(135deg,#1b5e20,#2E7D32)' : 'linear-gradient(135deg,#1b5e20,#2E7D32,#43a047)', border: 'none', cursor: 'pointer', boxShadow: '0 8px 28px rgba(46,125,50,.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', transition: 'all .3s ease', position: 'relative' }}>
          <span style={{ transition: 'transform .3s ease', transform: open ? 'rotate(90deg)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {open ? '✕' : '🤖'}
          </span>
          {!open && <span style={{ position: 'absolute', inset: '-6px', borderRadius: '50%', border: '2px solid rgba(46,125,50,.35)', animation: 'aiRing 2.2s ease-out infinite', pointerEvents: 'none' }} />}
          {notif && !open && <span style={{ position: 'absolute', top: '-3px', right: '-3px', background: '#FFA726', color: '#fff', width: '18px', height: '18px', borderRadius: '50%', fontSize: '.58rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>1</span>}
        </button>
      </div>

      {/* Chat window */}
      {open && (
        <div style={{ position: 'fixed', bottom: '100px', right: '28px', width: '370px', height: '560px', background: '#fff', borderRadius: '24px', boxShadow: '0 24px 80px rgba(0,0,0,.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 9998, animation: 'aiIn .3s cubic-bezier(.34,1.56,.64,1)', border: '1px solid rgba(0,0,0,.06)' }}>

          {/* Header */}
          <div style={{ background: 'linear-gradient(135deg,#0d3b10,#1b5e20,#2E7D32)', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0 }}>🤖</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '.92rem', lineHeight: 1 }}>Hafa AI</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                <span style={{ width: '6px', height: '6px', background: '#69f0ae', borderRadius: '50%', animation: 'aiDot 2s infinite', display: 'inline-block' }} />
                <span style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.75)' }}>Online · Powered by Groq AI</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* Language */}
              <div style={{ position: 'relative' }}>
                <button onClick={() => setLangMenu(!langMenu)}
                  style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', padding: '5px 9px', borderRadius: '20px', cursor: 'pointer', fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  {LANGS[lang].flag}<span style={{ fontSize: '.55rem' }}>▼</span>
                </button>
                {langMenu && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#fff', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,.15)', overflow: 'hidden', minWidth: '150px', zIndex: 10 }}>
                    {Object.entries(LANGS).map(([k, v]) => (
                      <button key={k} onClick={() => { setLang(k); setLangMenu(false); clearChat() }}
                        style={{ display: 'block', width: '100%', padding: '9px 14px', border: 'none', background: k === lang ? '#f0fdf4' : 'transparent', textAlign: 'left', fontSize: '.83rem', cursor: 'pointer', fontFamily: 'inherit', color: k === lang ? '#2E7D32' : '#374151', fontWeight: k === lang ? 700 : 400 }}>
                        {v.flag} {v.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Clear */}
              <button onClick={clearChat} title="Clear chat"
                style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem' }}>
                🗑
              </button>
              {/* Close */}
              <button onClick={() => setOpen(false)} title="Close"
                style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.85rem', fontWeight: 700 }}>
                ✕
              </button>
            </div>
          </div>

          {/* Messages — scrollable, no overflow */}
          <div ref={messagesRef}
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', background: '#f8fafc' }}>

            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', animation: 'msgIn .25s ease' }}>
                {m.role === 'bot' && (
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#1b5e20,#2E7D32)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.9rem', flexShrink: 0 }}>🤖</div>
                )}
                <div style={{ maxWidth: '78%' }}>
                  <div style={{
                    background: m.role === 'bot' ? '#fff' : 'linear-gradient(135deg,#2E7D32,#43a047)',
                    borderRadius: m.role === 'bot' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                    padding: '10px 14px',
                    boxShadow: m.role === 'bot' ? '0 1px 4px rgba(0,0,0,.08)' : '0 4px 12px rgba(46,125,50,.3)',
                    wordBreak: 'break-word',
                  }}>
                    <div style={{ fontSize: '.84rem', lineHeight: 1.65, color: m.role === 'bot' ? '#374151' : '#fff' }}
                      dangerouslySetInnerHTML={{ __html: fmt(m.text) }} />
                  </div>
                  <div style={{ fontSize: '.62rem', color: '#9ca3af', marginTop: '3px', textAlign: m.role === 'user' ? 'right' : 'left' }}>{m.time}</div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', animation: 'msgIn .25s ease' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#1b5e20,#2E7D32)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.9rem', flexShrink: 0 }}>🤖</div>
                <div style={{ background: '#fff', borderRadius: '4px 16px 16px 16px', padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,.08)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0,1,2].map(i => <span key={i} style={{ width: '7px', height: '7px', background: '#a5d6a7', borderRadius: '50%', animation: `aiDot 1.2s infinite ${i * 0.2}s`, display: 'inline-block' }} />)}
                </div>
              </div>
            )}
          </div>

          {/* Quick suggestions — only shown before first user message */}
          {suggestionsShown && messages.length <= 1 && (
            <div style={{ padding: '8px 14px', display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0, background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
              {L.suggestions.map(s => (
                <button key={s} onClick={() => send(s)}
                  style={{ background: '#fff', color: '#2E7D32', border: '1px solid #a5d6a7', padding: '5px 11px', borderRadius: '20px', fontSize: '.73rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: '.2s', boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid #f1f5f9', flexShrink: 0, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', background: '#f8fafc', borderRadius: '16px', padding: '8px 10px', border: '1.5px solid #e2e8f0', transition: '.2s' }}
              onFocus={() => {}} className="ai-input-wrap">
              <textarea ref={inputRef} value={input}
                onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }}
                onKeyDown={handleKey}
                placeholder={L.placeholder} rows={1}
                style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '.86rem', fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5, maxHeight: '100px', minHeight: '22px', color: '#374151', overflowY: 'auto' }} />
              <button onClick={toggleVoice} title="Voice input"
                style={{ background: listening ? '#fce4ec' : 'none', border: 'none', cursor: 'pointer', padding: '5px', borderRadius: '8px', color: listening ? '#e53935' : '#9ca3af', flexShrink: 0, fontSize: '.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '.2s' }}>
                <i className={`fas fa-microphone${listening ? '-slash' : ''}`} />
              </button>
              <button onClick={() => send()} disabled={!input.trim()}
                style={{ background: input.trim() ? 'linear-gradient(135deg,#2E7D32,#43a047)' : '#e2e8f0', border: 'none', color: input.trim() ? '#fff' : '#9ca3af', width: '34px', height: '34px', borderRadius: '50%', cursor: input.trim() ? 'pointer' : 'default', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '.2s', boxShadow: input.trim() ? '0 4px 12px rgba(46,125,50,.3)' : 'none' }}>
                <i className="fas fa-paper-plane" style={{ fontSize: '.8rem' }} />
              </button>
            </div>
            <div style={{ textAlign: 'center', fontSize: '.62rem', color: '#cbd5e1', marginTop: '6px' }}>
              🌿 Hafa AI · Powered by Groq
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes aiRing  { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.3);opacity:0} }
        @keyframes aiDot   { 0%,60%,100%{transform:translateY(0);opacity:.6} 30%{transform:translateY(-5px);opacity:1} }
        @keyframes aiIn    { from{opacity:0;transform:scale(.92) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes msgIn   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .ai-input-wrap:focus-within { border-color: #2E7D32 !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(46,125,50,.08) !important; }
      `}</style>
    </>
  )
}
