/**
 * CROSignals — Conversion Rate Optimization urgency bar
 *
 * Renders live social proof + urgency signals on the product detail page.
 * Each signal is only shown when it has meaningful data (no fake urgency).
 */

import { useEffect, useState } from 'react'
import { Users, Flame, TrendingDown, Clock, ShoppingBag } from 'lucide-react'
import type { CROSignals } from '@/hooks/useCROSignals'

interface Props {
  signals: CROSignals
}

// Countdown timer for flash sales
function FlashCountdown({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    const tick = () => {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Ended'); return }
      const h = Math.floor(diff / 3_600_000)
      const m = Math.floor((diff % 3_600_000) / 60_000)
      const s = Math.floor((diff % 60_000) / 1_000)
      setRemaining(`${h > 0 ? `${h}h ` : ''}${m}m ${s}s`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endsAt])

  return <span className="font-mono font-black">{remaining}</span>
}

export default function CROSignals({ signals }: Props) {
  const { viewersNow, ordersToday, recentBuyers, stock, stockTier, unit, priceDrop, flashEndsAt } = signals

  const rows: React.ReactNode[] = []

  // ── Flash sale countdown (highest priority) ────────────────────────────
  if (flashEndsAt) {
    rows.push(
      <div key="flash" className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
        <Clock size={14} className="text-red-500 flex-shrink-0 animate-pulse" />
        <span className="text-xs font-semibold text-red-700">
          ⚡ Flash sale ends in <FlashCountdown endsAt={flashEndsAt} />
        </span>
      </div>
    )
  }

  // ── Stock urgency ──────────────────────────────────────────────────────
  if (stockTier === 'CRITICAL') {
    rows.push(
      <div key="stock-critical" className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
        <Flame size={14} className="text-red-500 flex-shrink-0" />
        <span className="text-xs font-bold text-red-700">
          Only <span className="text-red-600">{stock} {unit}</span> left — selling fast!
        </span>
        {/* Stock bar */}
        <div className="ml-auto w-16 h-1.5 bg-red-100 rounded-full overflow-hidden flex-shrink-0">
          <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, (stock / 3) * 100)}%` }} />
        </div>
      </div>
    )
  } else if (stockTier === 'LOW') {
    rows.push(
      <div key="stock-low" className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2">
        <Flame size={14} className="text-orange-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-orange-700">
          Only <span className="font-bold">{stock} {unit}</span> remaining
        </span>
        <div className="ml-auto w-16 h-1.5 bg-orange-100 rounded-full overflow-hidden flex-shrink-0">
          <div className="h-full bg-orange-400 rounded-full" style={{ width: `${Math.min(100, (stock / 10) * 100)}%` }} />
        </div>
      </div>
    )
  }

  // ── Price drop ─────────────────────────────────────────────────────────
  if (priceDrop >= 5) {
    rows.push(
      <div key="price-drop" className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
        <TrendingDown size={14} className="text-green-600 flex-shrink-0" />
        <span className="text-xs font-semibold text-green-700">
          Price dropped <span className="font-black text-green-600">{priceDrop}%</span> — limited time
        </span>
      </div>
    )
  }

  // ── Live viewers ───────────────────────────────────────────────────────
  if (viewersNow >= 3) {
    rows.push(
      <div key="viewers" className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
        <Users size={14} className="text-blue-500 flex-shrink-0" />
        <span className="text-xs text-blue-700">
          <span className="font-bold">{viewersNow} people</span> are viewing this right now
        </span>
        {/* Animated dots */}
        <span className="ml-auto flex gap-0.5">
          {[0,1,2].map(i => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </span>
      </div>
    )
  }

  // ── Orders today ───────────────────────────────────────────────────────
  if (ordersToday >= 2) {
    rows.push(
      <div key="orders" className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
        <ShoppingBag size={14} className="text-purple-500 flex-shrink-0" />
        <span className="text-xs text-purple-700">
          <span className="font-bold">{ordersToday} orders</span> placed in the last 24 hours
        </span>
      </div>
    )
  }

  // ── Recent buyers social proof ─────────────────────────────────────────
  if (recentBuyers.length >= 2) {
    const names = recentBuyers.length === 1
      ? recentBuyers[0]
      : recentBuyers.slice(0, -1).join(', ') + ' and ' + recentBuyers[recentBuyers.length - 1]
    rows.push(
      <div key="buyers" className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
        {/* Avatar stack */}
        <div className="flex -space-x-1.5 flex-shrink-0">
          {recentBuyers.slice(0, 3).map((name, i) => (
            <div key={i} className="w-5 h-5 rounded-full bg-gradient-to-br from-green-400 to-green-600 border border-white flex items-center justify-center text-[9px] font-bold text-white">
              {name[0]?.toUpperCase()}
            </div>
          ))}
        </div>
        <span className="text-xs text-gray-600">
          <span className="font-semibold">{names}</span> recently bought this
        </span>
      </div>
    )
  }

  if (rows.length === 0) return null

  return (
    <div className="space-y-2 mb-5">
      {rows}
    </div>
  )
}
