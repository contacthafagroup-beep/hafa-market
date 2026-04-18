import { useQuery } from '@tanstack/react-query'
import { CheckCircle, Circle, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'

interface ChecklistItem {
  id: string
  label: string
  description: string
  done: boolean
  link: string
  points: number
}

export default function OnboardingChecklist({ store }: { store: any }) {
  const { data: products } = useQuery({
    queryKey: ['seller-products-count'],
    queryFn: () => api.get('/sellers/me/products?limit=1').then(r => r.data.data),
    enabled: store?.status === 'VERIFIED',
  })

  const { data: kyc } = useQuery({
    queryKey: ['kyc-me'],
    queryFn: () => api.get('/kyc/me').then(r => r.data.data).catch(() => null),
    enabled: store?.status === 'VERIFIED',
  })

  const { data: analytics } = useQuery({
    queryKey: ['seller-analytics-quick'],
    queryFn: () => api.get('/sellers/me/analytics').then(r => r.data.data),
    enabled: store?.status === 'VERIFIED',
  })

  const items: ChecklistItem[] = [
    {
      id: 'store',
      label: 'Create your store',
      description: 'Set up your store profile',
      done: !!store,
      link: '/dashboard',
      points: 10,
    },
    {
      id: 'logo',
      label: 'Upload store logo',
      description: 'Add a logo to build trust',
      done: !!store?.logo,
      link: '/dashboard',
      points: 10,
    },
    {
      id: 'product',
      label: 'List your first product',
      description: 'Add at least one product',
      done: (products?.length || 0) > 0,
      link: '/dashboard/products',
      points: 20,
    },
    {
      id: 'kyc',
      label: 'Complete KYC verification',
      description: 'Get the verified badge',
      done: kyc?.status === 'APPROVED',
      link: '/dashboard/kyc',
      points: 30,
    },
    {
      id: 'sale',
      label: 'Make your first sale',
      description: 'Receive your first order',
      done: (analytics?.overview?.totalSales || 0) > 0,
      link: '/dashboard/orders',
      points: 30,
    },
  ]

  const completed = items.filter(i => i.done).length
  const totalPoints = items.filter(i => i.done).reduce((s, i) => s + i.points, 0)
  const pct = Math.round((completed / items.length) * 100)

  if (pct === 100) return null // hide when all done

  return (
    <div className="bg-white rounded-2xl shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-extrabold text-gray-900">🚀 Seller Setup</h3>
          <p className="text-xs text-gray-400">{completed}/{items.length} completed · {totalPoints} pts earned</p>
        </div>
        <div className="text-right">
          <span className="text-2xl font-black text-green-primary">{pct}%</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden mb-5">
        <div className="h-full bg-gradient-to-r from-green-primary to-green-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-2">
        {items.map(item => (
          <Link key={item.id} to={item.done ? '#' : item.link}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${item.done ? 'opacity-60 cursor-default' : 'hover:bg-green-50 cursor-pointer'}`}>
            {item.done
              ? <CheckCircle size={20} className="text-green-primary flex-shrink-0" />
              : <Circle size={20} className="text-gray-300 flex-shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${item.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.label}</p>
              <p className="text-xs text-gray-400">{item.description}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs font-bold text-orange-500">+{item.points}pts</span>
              {!item.done && <ChevronRight size={14} className="text-gray-300" />}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
