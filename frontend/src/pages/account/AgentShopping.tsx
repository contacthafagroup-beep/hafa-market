import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Bot, Send, ShoppingCart, Zap, CheckCircle, Package } from 'lucide-react'
import api from '@/lib/api'
import { useCart } from '@/hooks/useCart'
import { useAuth } from '@/hooks/useAuth'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Message {
  role: 'user' | 'agent'
  content: string
  products?: any[]
  actions?: Array<{ label: string; fn: () => void }>
  time: string
}

const PRESETS = [
  { label: '🛒 Weekly Groceries', prompt: 'Order my weekly groceries: 2kg tomatoes, 1kg onions, 500g garlic, 2kg potatoes' },
  { label: '☕ Coffee Restock', prompt: 'Restock coffee: 1kg roasted Ethiopian coffee and 500g raw beans' },
  { label: '🌾 Grain Supply', prompt: 'Order bulk grains: 5kg teff, 3kg wheat, 2kg maize' },
  { label: '🥚 Dairy & Eggs', prompt: 'Get 2 dozen eggs, 2 liters milk, 500g butter' },
  { label: '🍯 Specialty', prompt: 'Find the best honey and moringa powder available' },
]

export default function AgentShopping() {
  const { user } = useAuth()
  const { add } = useCart()
  const [messages, setMessages] = useState<Message[]>([{
    role: 'agent',
    content: `Hi ${user?.name?.split(' ')[0] || 'there'}! 👋 I'm your Hafa AI Shopping Agent.\n\nTell me what you need and I'll find the best products and add them to your cart automatically.\n\nTry: "Order 2kg tomatoes and 1kg onions" or pick a preset below.`,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [history, setHistory] = useState<Array<{ role: string; content: string }>>([])
  const messagesRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages, thinking])

  const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const addMsg = (msg: Omit<Message, 'time'>) =>
    setMessages(prev => [...prev, { ...msg, time: now() }])

  const send = async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || thinking) return
    setInput('')
    addMsg({ role: 'user', content: msg })
    setThinking(true)

    const newHistory = [...history, { role: 'user', content: msg }]

    try {
      // Step 1: Parse shopping list with AI
      const parseRes = await api.post('/ai/chat', {
        message: `You are a shopping assistant for an Ethiopian agricultural marketplace. Parse this shopping request and extract products. Reply ONLY with a JSON array like: [{"name":"tomatoes","quantity":2,"unit":"kg"}]. Request: "${msg}"`,
        language: 'en',
        history: [],
      })

      let list: Array<{ name: string; quantity: number; unit: string }> = []
      try {
        const reply = parseRes.data.data.reply.trim()
        const match = reply.match(/\[[\s\S]*?\]/)
        if (match) list = JSON.parse(match[0])
      } catch {
        list = [{ name: msg, quantity: 1, unit: 'piece' }]
      }

      if (!list.length) {
        addMsg({ role: 'agent', content: "I couldn't parse that. Try: \"Order 2kg tomatoes and 1kg onions\"" })
        setThinking(false)
        return
      }

      addMsg({ role: 'agent', content: `🔍 Searching for ${list.length} item${list.length > 1 ? 's' : ''}...` })

      // Step 2: Search for each product
      const found: any[] = []
      const notFound: string[] = []

      for (const item of list) {
        try {
          const res = await api.get('/search', { params: { q: item.name, limit: 3 } })
          const results = res.data.data?.products || res.data.data || []
          if (results.length > 0) {
            found.push({ ...results[0], _qty: item.quantity, _unit: item.unit })
          } else {
            notFound.push(item.name)
          }
        } catch {}
      }

      // Step 3: Show results
      if (found.length > 0) {
        const total = found.reduce((s, p) => s + p.price * p._qty, 0)
        const agentReply = `✅ Found ${found.length} product${found.length > 1 ? 's' : ''}${notFound.length ? ` (couldn't find: ${notFound.join(', ')})` : ''}.\n\nEstimated total: **${formatPrice(total)}**`

        addMsg({
          role: 'agent',
          content: agentReply,
          products: found,
          actions: [
            {
              label: `🛒 Add All to Cart — ${formatPrice(total)}`,
              fn: () => {
                found.forEach(p => add(p, p._qty))
                addMsg({ role: 'agent', content: `✅ Added ${found.length} products to your cart! Go to checkout when ready.` })
                toast.success(`${found.length} products added to cart!`)
              },
            },
          ],
        })
        setHistory([...newHistory, { role: 'assistant', content: agentReply }])
      } else {
        const reply = `Sorry, I couldn't find any of those products. Try different keywords or browse the catalog.`
        addMsg({ role: 'agent', content: reply })
        setHistory([...newHistory, { role: 'assistant', content: reply }])
      }
    } catch {
      addMsg({ role: 'agent', content: 'Something went wrong. Please try again.' })
    } finally {
      setThinking(false)
    }
  }

  const fmt = (text: string) =>
    text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
          <Bot size={20} className="text-purple-600" /> AI Shopping Agent
        </h2>
        <p className="text-sm text-gray-400">Tell me what you need — I'll find and add products automatically</p>
      </div>

      {/* Presets */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {PRESETS.map(p => (
          <button key={p.label} onClick={() => send(p.prompt)}
            className="flex-shrink-0 px-3 py-2 bg-white border-2 border-gray-200 rounded-full text-xs font-semibold text-gray-600 hover:border-purple-400 hover:text-purple-600 transition-all">
            {p.label}
          </button>
        ))}
      </div>

      {/* Chat window */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        {/* Messages */}
        <div ref={messagesRef} className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}>
              {m.role === 'agent' && (
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot size={16} className="text-white" />
                </div>
              )}
              <div className={`max-w-[80%] ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-purple-600 text-white rounded-tr-sm'
                    : 'bg-white shadow-sm text-gray-700 rounded-tl-sm'
                }`}>
                  <div dangerouslySetInnerHTML={{ __html: fmt(m.content) }} />
                </div>

                {/* Product cards */}
                {m.products && m.products.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 w-full">
                    {m.products.map((p: any) => (
                      <div key={p.id} className="bg-white rounded-xl border border-gray-100 p-2 flex items-center gap-2">
                        <div className="w-10 h-10 rounded-lg bg-gray-50 overflow-hidden flex-shrink-0">
                          {p.images?.[0]
                            ? <img src={p.images[0]} className="w-full h-full object-cover" alt="" />
                            : <span className="flex items-center justify-center h-full">🛒</span>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                          <p className="text-xs text-green-primary font-bold">{formatPrice(p.price)}/{p.unit}</p>
                          <p className="text-[10px] text-gray-400">Qty: {p._qty} {p._unit}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                {m.actions && m.actions.map((action, j) => (
                  <button key={j} onClick={action.fn}
                    className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-bold hover:bg-purple-700 transition-colors w-full justify-center">
                    <ShoppingCart size={15} /> {action.label}
                  </button>
                ))}

                <span className="text-[10px] text-gray-400">{m.time}</span>
              </div>
            </div>
          ))}

          {/* Thinking indicator */}
          {thinking && (
            <div className="flex gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-white" />
              </div>
              <div className="bg-white shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-100 bg-white">
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Tell me what to order... e.g. 2kg tomatoes and 1kg onions"
              className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-purple-400 transition-colors" />
            <button onClick={() => send()} disabled={!input.trim() || thinking}
              className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center hover:bg-purple-700 transition-colors disabled:opacity-40">
              <Send size={16} />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">
            🤖 Powered by Groq AI · Finds best-matched products automatically
          </p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5">
        <h3 className="font-bold text-purple-800 mb-3">🤖 How the Agent Works</h3>
        <div className="grid sm:grid-cols-3 gap-3 text-sm text-purple-700">
          <div className="bg-white rounded-xl p-3 text-center">
            <div className="text-2xl mb-1">💬</div>
            <p className="font-bold text-xs">1. You describe</p>
            <p className="text-xs text-gray-500">Tell the agent what you need in plain language</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center">
            <div className="text-2xl mb-1">🔍</div>
            <p className="font-bold text-xs">2. AI searches</p>
            <p className="text-xs text-gray-500">Groq AI parses your request and finds matching products</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center">
            <div className="text-2xl mb-1">🛒</div>
            <p className="font-bold text-xs">3. One click</p>
            <p className="text-xs text-gray-500">Review and add everything to cart with one button</p>
          </div>
        </div>
      </div>
    </div>
  )
}
