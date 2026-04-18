import { Link } from 'react-router-dom'
import { Star, Package } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

const FALLBACK = [
  { storeName:'Abebe Fresh Farm', storeSlug:'abebe-fresh-farm', city:'Hossana', rating:4.9, totalSales:120, description:'Organic vegetables' },
  { storeName:'Tigist Honey Farm', storeSlug:'tigist-honey-farm', city:'Hossana', rating:4.8, totalSales:85, description:'Pure honey & spices' },
  { storeName:'Dawit Grain Store', storeSlug:'dawit-grain-store', city:'Hossana', rating:4.7, totalSales:200, description:'Teff, wheat & grains' },
  { storeName:'Sara Coffee Co.', storeSlug:'sara-coffee-co', city:'Hossana', rating:4.9, totalSales:65, description:'Ethiopian coffee' },
]

const BG_COLORS = ['from-green-50 to-green-100','from-orange-50 to-orange-100','from-blue-50 to-blue-100','from-purple-50 to-purple-100']

export default function SellersSection() {
  const { data } = useQuery({
    queryKey: ['top-sellers'],
    queryFn: () => api.get('/sellers?limit=4&status=VERIFIED').then(r => r.data.data).catch(() => null),
    staleTime: 1000 * 60 * 5,
  })

  const sellers = (data?.length ? data : FALLBACK).slice(0, 4)

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-bold text-green-primary uppercase tracking-widest mb-1">Meet Our Farmers</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">Top <span className="text-green-primary">Sellers</span></h2>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {sellers.map((s: any, i: number) => (
            <Link key={s.storeSlug || s.id || i} to={`/sellers/${s.storeSlug}`}
              className="bg-white rounded-2xl shadow-card overflow-hidden hover:-translate-y-1 hover:shadow-card-hover transition-all duration-200 group">
              <div className={`h-20 bg-gradient-to-br ${BG_COLORS[i % BG_COLORS.length]}`} />
              <div className="px-5 pb-5 -mt-8 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-primary to-green-mid flex items-center justify-center text-white text-2xl font-black mx-auto mb-2 shadow-md">
                  {s.logo
                    ? <img src={s.logo} className="w-full h-full object-cover rounded-full" alt="" />
                    : s.storeName?.[0]?.toUpperCase()}
                </div>
                <h3 className="font-extrabold text-gray-800 text-sm">{s.storeName}</h3>
                <p className="text-xs text-gray-400 mb-2">{s.city || 'Hossana'}, Ethiopia</p>
                <div className="flex justify-center gap-3 text-xs text-gray-500 mb-3">
                  <span className="flex items-center gap-1"><Star size={11} className="fill-orange-400 text-orange-400" />{(s.rating || 0).toFixed(1)}</span>
                  <span className="flex items-center gap-1"><Package size={11} />{s.totalSales || 0} sales</span>
                </div>
                {s.description && <p className="text-xs text-gray-400 mb-3 line-clamp-1">{s.description}</p>}
                <span className="inline-block border-2 border-green-primary text-green-primary text-xs font-bold px-4 py-1.5 rounded-full group-hover:bg-green-primary group-hover:text-white transition-colors">
                  Visit Store
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
