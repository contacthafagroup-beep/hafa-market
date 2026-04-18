import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Gift, Copy, Check, Heart, Star, Coffee, Leaf } from 'lucide-react'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

const GIFT_AMOUNTS = [100, 250, 500, 1000, 2000, 5000]

const GIFT_THEMES = [
  { id: 'general', label: 'General', emoji: '🎁', color: 'from-green-500 to-green-700' },
  { id: 'wedding', label: 'Wedding (ሠርግ)', emoji: '💍', color: 'from-pink-500 to-rose-600' },
  { id: 'holiday', label: 'Holiday (ፋሲካ/ጥምቀት)', emoji: '✨', color: 'from-yellow-500 to-orange-500' },
  { id: 'birthday', label: 'Birthday', emoji: '🎂', color: 'from-purple-500 to-purple-700' },
  { id: 'coffee', label: 'Coffee Lover', emoji: '☕', color: 'from-amber-700 to-amber-900' },
  { id: 'farm', label: 'Farm Fresh', emoji: '🌿', color: 'from-green-600 to-teal-700' },
]

// Gift card codes stored locally (in production would be backend)
const GIFT_CARDS_KEY = 'hafa_gift_cards'

function getGiftCards() {
  try { return JSON.parse(localStorage.getItem(GIFT_CARDS_KEY) || '[]') } catch { return [] }
}

function generateCode() {
  return 'HAFA-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase()
}

export default function GiftCards() {
  const [amount, setAmount] = useState(500)
  const [customAmount, setCustomAmount] = useState('')
  const [theme, setTheme] = useState('general')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [message, setMessage] = useState('')
  const [giftNote, setGiftNote] = useState('')
  const [created, setCreated] = useState<any>(null)
  const [copied, setCopied] = useState(false)
  const [myCards] = useState(getGiftCards)
  const [tab, setTab] = useState<'create' | 'my'>('create')

  const selectedTheme = GIFT_THEMES.find(t => t.id === theme)!
  const finalAmount = customAmount ? parseFloat(customAmount) : amount

  const createGiftCard = () => {
    if (!finalAmount || finalAmount < 50) { toast.error('Minimum gift card amount is ETB 50'); return }
    const code = generateCode()
    const card = {
      id: Date.now().toString(),
      code,
      amount: finalAmount,
      theme,
      recipientName,
      recipientEmail,
      message,
      createdAt: new Date().toISOString(),
      isUsed: false,
    }
    const existing = getGiftCards()
    localStorage.setItem(GIFT_CARDS_KEY, JSON.stringify([...existing, card]))
    setCreated(card)
    toast.success('Gift card created!')
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success('Code copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const shareWhatsApp = (card: any) => {
    const msg = `🎁 You've received a Hafa Market Gift Card!\n\nAmount: ETB ${card.amount}\nCode: ${card.code}\n${card.message ? `\nMessage: "${card.message}"` : ''}\n\nRedeem at: hafamarket.com/redeem`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
          <Gift size={20} className="text-green-primary" /> Gift Cards
        </h2>
        <p className="text-sm text-gray-400">Send the gift of fresh food to someone special</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {[['create', '🎁 Create Gift Card'], ['my', '📋 My Gift Cards']].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val as any)}
            className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${tab === val ? 'bg-green-primary text-white border-green-primary' : 'bg-white border-gray-200 text-gray-600 hover:border-green-primary'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'create' && !created && (
        <div className="space-y-5">
          {/* Preview */}
          <div className={`bg-gradient-to-br ${selectedTheme.color} rounded-2xl p-6 text-white`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/70 text-xs uppercase tracking-widest">Hafa Market</p>
                <p className="text-3xl font-black mt-1">{selectedTheme.emoji} Gift Card</p>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs">Value</p>
                <p className="text-2xl font-extrabold">{formatPrice(finalAmount || 0)}</p>
              </div>
            </div>
            {recipientName && <p className="text-white/80 text-sm">For: <strong>{recipientName}</strong></p>}
            {message && <p className="text-white/70 text-xs mt-1 italic">"{message}"</p>}
            <div className="mt-4 bg-white/20 rounded-xl px-4 py-2 font-mono text-sm tracking-widest">
              HAFA-XXXX-XXXX
            </div>
          </div>

          {/* Amount */}
          <div className="bg-white rounded-2xl shadow-card p-5">
            <p className="text-sm font-bold text-gray-700 mb-3">Select Amount</p>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {GIFT_AMOUNTS.map(a => (
                <button key={a} onClick={() => { setAmount(a); setCustomAmount('') }}
                  className={`py-2.5 rounded-xl border-2 text-sm font-bold transition-all ${amount === a && !customAmount ? 'border-green-primary bg-green-50 text-green-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  ETB {a}
                </button>
              ))}
            </div>
            <input type="number" value={customAmount} onChange={e => setCustomAmount(e.target.value)}
              placeholder="Or enter custom amount (ETB)"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-primary" />
          </div>

          {/* Theme */}
          <div className="bg-white rounded-2xl shadow-card p-5">
            <p className="text-sm font-bold text-gray-700 mb-3">Choose Theme</p>
            <div className="grid grid-cols-3 gap-2">
              {GIFT_THEMES.map(t => (
                <button key={t.id} onClick={() => setTheme(t.id)}
                  className={`py-2.5 px-3 rounded-xl border-2 text-xs font-bold transition-all text-center ${theme === t.id ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-xl mb-0.5">{t.emoji}</div>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient */}
          <div className="bg-white rounded-2xl shadow-card p-5">
            <p className="text-sm font-bold text-gray-700 mb-3">Recipient Details (optional)</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Recipient Name" placeholder="e.g. Abebe Kebede"
                value={recipientName} onChange={(e: any) => setRecipientName(e.target.value)} />
              <Input label="Email (for delivery)" type="email" placeholder="recipient@email.com"
                value={recipientEmail} onChange={(e: any) => setRecipientEmail(e.target.value)} />
            </div>
            <div className="mt-3">
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Personal Message</label>
              <textarea value={message} onChange={e => setMessage(e.target.value)}
                rows={2} placeholder="Write a heartfelt message..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none" />
            </div>
          </div>

          {/* Gift note for orders */}
          <div className="bg-white rounded-2xl shadow-card p-5">
            <p className="text-sm font-bold text-gray-700 mb-1.5">📦 Gift Note for Delivery</p>
            <p className="text-xs text-gray-400 mb-3">This note will be included with the physical delivery</p>
            <textarea value={giftNote} onChange={e => setGiftNote(e.target.value)}
              rows={2} placeholder="e.g. Happy Birthday! Enjoy these fresh products from Hafa Market 🌿"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none" />
          </div>

          <Button fullWidth size="lg" onClick={createGiftCard} disabled={!finalAmount || finalAmount < 50}>
            <Gift size={18} /> Create Gift Card — {formatPrice(finalAmount || 0)}
          </Button>
        </div>
      )}

      {/* Created card */}
      {created && (
        <div className="space-y-4">
          <div className={`bg-gradient-to-br ${GIFT_THEMES.find(t => t.id === created.theme)?.color} rounded-2xl p-6 text-white`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-white/70 text-xs uppercase tracking-widest">Hafa Market</p>
                <p className="text-3xl font-black mt-1">{GIFT_THEMES.find(t => t.id === created.theme)?.emoji} Gift Card</p>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs">Value</p>
                <p className="text-2xl font-extrabold">{formatPrice(created.amount)}</p>
              </div>
            </div>
            {created.recipientName && <p className="text-white/80 text-sm mb-1">For: <strong>{created.recipientName}</strong></p>}
            {created.message && <p className="text-white/70 text-xs italic mb-3">"{created.message}"</p>}
            <div className="bg-white/20 rounded-xl px-4 py-3 font-mono text-lg tracking-widest text-center font-bold">
              {created.code}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="font-bold text-green-800 mb-1">🎉 Gift Card Created!</p>
            <p className="text-sm text-green-700">Share the code with your recipient. They can use it at checkout.</p>
          </div>

          <div className="flex gap-3">
            <Button fullWidth onClick={() => copyCode(created.code)}>
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied!' : 'Copy Code'}
            </Button>
            <Button fullWidth variant="outline" onClick={() => shareWhatsApp(created)}>
              💬 Share via WhatsApp
            </Button>
          </div>

          <button onClick={() => setCreated(null)}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition-colors">
            Create another gift card
          </button>
        </div>
      )}

      {/* My gift cards */}
      {tab === 'my' && (
        <div className="space-y-3">
          {!myCards.length ? (
            <div className="bg-white rounded-2xl shadow-card p-12 text-center text-gray-400">
              <Gift size={40} className="mx-auto mb-3 opacity-30" />
              <p>No gift cards created yet</p>
            </div>
          ) : myCards.map((card: any) => (
            <div key={card.id} className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${GIFT_THEMES.find(t => t.id === card.theme)?.color} flex items-center justify-center text-2xl flex-shrink-0`}>
                {GIFT_THEMES.find(t => t.id === card.theme)?.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{formatPrice(card.amount)}</p>
                {card.recipientName && <p className="text-xs text-gray-500">For: {card.recipientName}</p>}
                <p className="text-xs font-mono text-gray-400">{card.code}</p>
              </div>
              <button onClick={() => copyCode(card.code)} className="text-gray-400 hover:text-green-primary transition-colors">
                <Copy size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
