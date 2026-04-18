import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '@/lib/api'

function Countdown({ endsAt }: { endsAt: string }) {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt).getTime() - Date.now()
      if (diff <= 0) { setTimeLeft('Ended'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`)
    }
    calc()
    const t = setInterval(calc, 1000)
    return () => clearInterval(t)
  }, [endsAt])

  return (
    <span className="font-mono font-black text-orange-300 text-lg tracking-widest">{timeLeft}</span>
  )
}

export default function FlashSaleBar() {
  const { data: sales = [] } = useQuery({
    queryKey: ['active-flash-sales'],
    queryFn: () => api.get('/features/flash-sales/active').then(r => r.data.data),
    refetchInterval: 60000,
    staleTime: 30000,
  })

  if (!sales.length) return null

  const sale = sales[0]
  const disc = sale.discount || {}

  return (
    <div className="bg-gradient-to-r from-[#b71c1c] via-[#c62828] to-[#d32f2f] text-white py-3 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 rounded-full p-1.5">
            <Zap size={18} className="text-orange-300 fill-orange-300" />
          </div>
          <div>
            <span className="font-extrabold text-sm">⚡ FLASH SALE: {sale.name}</span>
            <span className="ml-2 bg-orange-400 text-white text-xs font-black px-2 py-0.5 rounded-full">
              {disc.type === 'PERCENTAGE' ? `-${disc.value}%` : `-ETB ${disc.value}`} OFF
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-white/60 text-[10px] uppercase tracking-widest mb-0.5">Ends in</p>
            <Countdown endsAt={sale.endsAt} />
          </div>
          <Link to="/products?sort=soldCount"
            className="bg-white text-red-700 font-extrabold text-xs px-4 py-2 rounded-full hover:bg-orange-100 transition-colors whitespace-nowrap">
            Shop Now →
          </Link>
        </div>
      </div>
    </div>
  )
}
