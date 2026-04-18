import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Tag, TrendingDown, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { formatPrice } from '@/lib/utils'
import { useCart } from '@/hooks/useCart'
import toast from 'react-hot-toast'

// Volume pricing tiers — applied automatically at checkout
const VOLUME_TIERS = [
  { min: 10,  max: 49,  discount: 5,  label: '5% off',  badge: '🥉 Bulk' },
  { min: 50,  max: 99,  discount: 10, label: '10% off', badge: '🥈 Wholesale' },
  { min: 100, max: 499, discount: 15, label: '15% off', badge: '🥇 Distributor' },
  { min: 500, max: null,discount: 20, label: '20% off', badge: '💎 Enterprise' },
]

function getTier(qty: number) {
  return VOLUME_TIERS.find(t => qty >= t.min && (t.max === null || qty <= t.max))
}

export default function VolumePricing() {
  const navigate = useNavigate()
  const { add } = useCart()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['volume-products', search],
    queryFn: () => api.get('/products', {
      params: { search: search || undefined, limit: 20, sort: 'soldCount' },
    }).then(r => r.data.data || []),
    staleTime: 30000,
  })

  const setQty = (id: string, qty: number) =>
    setQuantities(prev => ({ ...prev, [id]: Math.max(1, qty) }))

  const getDiscountedPrice = (price: number, qty: number) => {
    const tier = getTier(qty)
    if (!tier) return price
    return price * (1 - tier.discount / 100)
  }

  const addToCart = (product: any) => {
    const qty = quantities[product.id] || 1
    const tier = getTier(qty)
    // Add with discounted price
    const discountedProduct = {
      ...product,
      price: getDiscountedPrice(product.price, qty),
      comparePrice: tier ? product.price : undefined,
    }
    add(discountedProduct, qty)
    toast.success(`${qty} ${product.unit} added${tier ? ` at ${tier.label}!` : '!'}`)
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 mb-4">
          <Tag size={16} className="text-green-primary" />
          <span className="text-xs font-bold text-green-primary uppercase tracking-wide">Volume Discounts</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">📦 Volume Pricing</h1>
        <p className="text-gray-400 max-w-xl mx-auto text-sm">
          The more you buy, the more you save. Automatic discounts applied at checkout.
        </p>
      </div>

      {/* Tier table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden mb-8">
        <div className="p-5 border-b border-gray-100">
          <h3 className="font-extrabold text-gray-900">Discount Tiers</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left py-3 px-5 text-xs font-bold text-gray-400">Tier</th>
                <th className="text-left py-3 px-5 text-xs font-bold text-gray-400">Quantity</th>
                <th className="text-left py-3 px-5 text-xs font-bold text-gray-400">Discount</th>
                <th className="text-left py-3 px-5 text-xs font-bold text-gray-400">Best For</th>
              </tr>
            </thead>
            <tbody>
              {VOLUME_TIERS.map((tier, i) => (
                <tr key={i} className="border-t border-gray-50">
                  <td className="py-3 px-5">
                    <span className="font-bold text-gray-800">{tier.badge}</span>
                  </td>
                  <td className="py-3 px-5 text-gray-600">
                    {tier.min}+ {tier.max ? `(up to ${tier.max})` : '(unlimited)'}
                  </td>
                  <td className="py-3 px-5">
                    <span className="font-extrabold text-green-primary text-base">{tier.label}</span>
                  </td>
                  <td className="py-3 px-5 text-gray-500 text-xs">
                    {i === 0 ? 'Small restaurants, cafes' :
                     i === 1 ? 'Hotels, schools, hospitals' :
                     i === 2 ? 'Distributors, large retailers' :
                     'Supermarkets, export buyers'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product search */}
      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search products for bulk pricing..."
        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary mb-6" />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : (
        <div className="space-y-3">
          {products.map((product: any) => {
            const qty = quantities[product.id] || 1
            const tier = getTier(qty)
            const discountedPrice = getDiscountedPrice(product.price, qty)
            const savings = (product.price - discountedPrice) * qty
            const isOpen = expanded === product.id

            return (
              <div key={product.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0">
                    {product.images?.[0]
                      ? <img src={product.images[0]} className="w-full h-full object-cover" alt="" />
                      : <span className="flex items-center justify-center h-full text-2xl">🛒</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 truncate">{product.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-extrabold text-green-primary">
                        {formatPrice(discountedPrice)}/{product.unit}
                      </span>
                      {tier && (
                        <>
                          <span className="text-xs text-gray-400 line-through">{formatPrice(product.price)}</span>
                          <span className="text-xs font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full">
                            {tier.badge} {tier.label}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Quantity input */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden">
                      <button onClick={() => setQty(product.id, qty - 1)}
                        className="px-3 py-2 hover:bg-gray-50 text-gray-600 font-bold">−</button>
                      <input type="number" value={qty}
                        onChange={e => setQty(product.id, parseInt(e.target.value) || 1)}
                        className="w-16 text-center border-none outline-none text-sm font-bold py-2" />
                      <button onClick={() => setQty(product.id, qty + 1)}
                        className="px-3 py-2 hover:bg-gray-50 text-gray-600 font-bold">+</button>
                    </div>
                    <Button size="sm" onClick={() => addToCart(product)}>
                      <ShoppingCart size={14} />
                    </Button>
                  </div>

                  <button onClick={() => setExpanded(isOpen ? null : product.id)}
                    className="text-gray-400 flex-shrink-0">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {/* Tier breakdown */}
                {isOpen && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Price Breakdown by Quantity</p>
                    <div className="grid grid-cols-4 gap-2">
                      {VOLUME_TIERS.map(t => {
                        const p = product.price * (1 - t.discount / 100)
                        const isActive = tier?.min === t.min
                        return (
                          <div key={t.min} className={`rounded-xl p-3 text-center border-2 transition-all ${isActive ? 'border-green-primary bg-green-50' : 'border-gray-100 bg-white'}`}>
                            <p className="text-[10px] font-bold text-gray-400">{t.min}+ {product.unit}</p>
                            <p className={`font-extrabold text-sm ${isActive ? 'text-green-primary' : 'text-gray-700'}`}>{formatPrice(p)}</p>
                            <p className="text-[10px] text-orange-600 font-bold">{t.label}</p>
                          </div>
                        )
                      })}
                    </div>
                    {savings > 0 && (
                      <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
                        <TrendingDown size={16} className="text-green-primary" />
                        <p className="text-sm font-bold text-green-700">
                          You save {formatPrice(savings)} on {qty} {product.unit} at current quantity!
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* CTA */}
      <div className="mt-8 bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
        <p className="font-bold text-gray-800 mb-1">Need even larger quantities?</p>
        <p className="text-gray-500 text-sm mb-3">Submit a bulk order request for custom pricing and dedicated account management</p>
        <Button onClick={() => navigate('/bulk-order')}>
          📦 Submit Bulk Order Request
        </Button>
      </div>
    </div>
  )
}
