import { useQuery, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Package, ShoppingCart, Tag } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatPrice } from '@/lib/utils'
import { useCart } from '@/hooks/useCart'
import toast from 'react-hot-toast'

export default function Bundles() {
  const { add } = useCart()

  const { data: bundles = [], isLoading } = useQuery({
    queryKey: ['bundles'],
    queryFn: () => api.get('/features/bundles').then(r => r.data.data),
    staleTime: 1000 * 60 * 5,
  })

  const addBundleToCart = (bundle: any) => {
    if (!bundle.products?.length) return
    bundle.products.forEach((p: any) => {
      const qty = bundle.quantities?.[p.id] || 1
      add(p, qty)
    })
    toast.success(`🛒 ${bundle.name} added to cart!`)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-full px-4 py-1.5 mb-4">
          <Tag size={16} className="text-orange-500" />
          <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">Save More Together</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">🎁 Product Bundles</h1>
        <p className="text-gray-400 max-w-xl mx-auto">Curated combinations at special prices. Buy together and save.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : !bundles.length ? (
        <div className="text-center py-16 text-gray-400">
          <Package size={48} className="mx-auto mb-4 opacity-30" />
          <p>No bundles available yet. Check back soon!</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {bundles.map((bundle: any) => {
            const originalTotal = bundle.products?.reduce((sum: number, p: any) => {
              const qty = bundle.quantities?.[p.id] || 1
              return sum + p.price * qty
            }, 0) || 0
            const savings = originalTotal - bundle.bundlePrice
            const savingsPct = originalTotal > 0 ? Math.round((savings / originalTotal) * 100) : 0

            return (
              <div key={bundle.id} className="bg-white rounded-2xl shadow-card overflow-hidden hover:shadow-card-hover transition-all">
                {/* Bundle header */}
                <div className="bg-gradient-to-br from-orange-400 to-orange-600 p-5 text-white">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-extrabold text-lg">{bundle.name}</h3>
                    {savingsPct > 0 && (
                      <span className="bg-white text-orange-600 text-xs font-black px-2 py-1 rounded-full">
                        -{savingsPct}%
                      </span>
                    )}
                  </div>
                  {bundle.description && (
                    <p className="text-white/80 text-sm">{bundle.description}</p>
                  )}
                  <div className="flex items-baseline gap-2 mt-3">
                    <span className="text-2xl font-black">{formatPrice(bundle.bundlePrice)}</span>
                    {bundle.comparePrice && (
                      <span className="text-white/60 line-through text-sm">{formatPrice(bundle.comparePrice)}</span>
                    )}
                    {savings > 0 && (
                      <span className="text-white/80 text-xs">Save {formatPrice(savings)}</span>
                    )}
                  </div>
                </div>

                {/* Products in bundle */}
                <div className="p-4">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                    Includes {bundle.products?.length || 0} items
                  </p>
                  <div className="space-y-2 mb-4">
                    {bundle.products?.slice(0, 4).map((p: any) => {
                      const qty = bundle.quantities?.[p.id] || 1
                      return (
                        <div key={p.id} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gray-50 overflow-hidden flex-shrink-0">
                            {p.images?.[0]
                              ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center text-lg">🛒</div>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link to={`/products/${p.slug}`} className="text-sm font-semibold text-gray-800 hover:text-green-primary truncate block">
                              {p.name}
                            </Link>
                            <p className="text-xs text-gray-400">{qty} {p.unit} × {formatPrice(p.price)}</p>
                          </div>
                        </div>
                      )
                    })}
                    {bundle.products?.length > 4 && (
                      <p className="text-xs text-gray-400 pl-13">+{bundle.products.length - 4} more items</p>
                    )}
                  </div>

                  <button
                    onClick={() => addBundleToCart(bundle)}
                    className="w-full flex items-center justify-center gap-2 bg-green-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-green-dark transition-colors"
                  >
                    <ShoppingCart size={16} /> Add Bundle to Cart
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* CTA */}
      <div className="mt-12 bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
        <p className="font-bold text-gray-800 mb-1">Are you a seller?</p>
        <p className="text-gray-500 text-sm mb-3">Create your own product bundles to increase average order value</p>
        <Link to="/dashboard/products" className="text-green-primary font-semibold hover:underline">
          Create a Bundle →
        </Link>
      </div>
    </div>
  )
}
