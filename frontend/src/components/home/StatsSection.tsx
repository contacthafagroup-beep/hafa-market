import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

function Counter({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true
        const duration = 2000
        const step = target / (duration / 16)
        let current = 0
        const timer = setInterval(() => {
          current += step
          if (current >= target) { setCount(target); clearInterval(timer) }
          else setCount(Math.floor(current))
        }, 16)
      }
    }, { threshold: 0.5 })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [target])

  return (
    <div ref={ref} className="text-3xl font-black text-orange-300">
      {count >= 1000 ? `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K` : count.toLocaleString()}{suffix}
    </div>
  )
}

export default function StatsSection() {
  const { data } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => api.get('/admin/dashboard').then(r => r.data.data?.stats).catch(() => null),
    staleTime: 1000 * 60 * 10,
    retry: false,
  })

  const stats = [
    { icon: '🌍', target: data?.totalUsers || 50000,    label: 'Happy Customers', suffix: '+' },
    { icon: '👨‍🌾', target: data?.totalSellers || 500,   label: 'Verified Farmers', suffix: '+' },
    { icon: '📦', target: data?.totalProducts || 10000, label: 'Products Listed',  suffix: '+' },
    { icon: '🏙️', target: 30,                           label: 'Cities Covered',   suffix: '+' },
    { icon: '⭐', target: 98,                           label: '% Satisfaction',   suffix: '%' },
  ]

  return (
    <section className="py-16 bg-gradient-to-br from-[#1b5e20] via-[#2E7D32] to-[#43a047]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-around flex-wrap gap-8">
          {stats.map(s => (
            <div key={s.label} className="text-center text-white">
              <div className="text-3xl mb-2">{s.icon}</div>
              <Counter target={s.target} suffix={s.suffix} />
              <div className="text-white/70 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
