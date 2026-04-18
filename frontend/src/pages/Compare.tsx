import { useState } from 'react'
import { Link } from 'react-router-dom'
import { X, Star, ShoppingCart, CheckCircle, XCircle } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'
import type { Product } from '@/types'

// Global compare store (simple module-level state)
let compareProducts: Product[] = []
let listeners: (() => void)[] = []

export function addToCompare(product: Product) {
  if (compareProducts.find(p => p.id === product.id)) return
  if (compareProducts.length >= 3) {
    compareProducts = [...compareProducts.slice(1), product]
  } else {
    compareProducts = [...compareProducts, product]
  }
  listeners.forEach(l => l())
}

export function removeFromCompare(id: string) {
  compareProducts = compareProducts.filter(p => p.id !== id)
  listeners.forEach(l => l())
}

export function isInCompare(id: string) {
  return compareProducts.some(p => p.id === id)
}

export function useCompare() {
  const [, forceUpdate] = useState(0)
  const subscribe = () => {
    const listener = () => forceUpdate(n => n + 1)
    listeners.push(listener)
    return () => { listeners = listeners.filter(l => l !== listener) }
  }
  useState(subscribe)
  return { products: compareProducts, add: addToCompare, remove: removeFromCompare, isIn: isInCompare }
}

const ATTRS = [
  { key: 'price',        label: 'Price',          render: (p: Product) => `${formatPrice(p.price)}/${p.unit}` },
  { key: 'comparePrice', label: 'Original Price',  render: (p: Product) => p.comparePrice ? formatPrice(p.comparePrice) : '—' },
  { key: 'rating',       label: 'Rating',          render: (p: Product) => `${p.rating.toFixed(1)} ★ (${p.reviewCount})` },
  { key: 'stock',        label: 'Stock',           render: (p: Product) => `${p.stock} ${p.unit}` },
  { key: 'unit',         label: 'Unit',            render: (p: Product) => p.unit },
  { key: 'minOrder',     label: 'Min Order',       render: (p: Product) => `${p.minOrder} ${p.unit}` },
  { key: 'isOrganic',    label: 'Organic',         render: (p: Product) => p.isOrganic ? '✅ Yes' : '❌ No' },
  { key: 'seller',       label: 'Seller',          render: (p: Product) => p.seller?.storeName || '—' },
  { key: 'category',     label: 'Category',        render: (p: Product) => p.category?.name || '—' },
]

export default function Compare() {
  const { products, remove } = useCompare()
  const { add } = useCart()

  if (!products.length) return (
    <div className="max-w-4xl mx-auto px-4 py-20 text-center">
      <div className="text-6xl mb-4">⚖️</div>
      <h2 className="text-2xl font-extrabold text-gray-800 mb-3">No products to compare</h2>
      <p className="text-gray-400 mb-6">Browse products and click "Compare" to add up to 3 products</p>
      <Link to="/products" className="bg-green-primary text-white px-6 py-3 rounded-full font-bold hover:bg-green-dark transition-colors">
        Browse Products
      </Link>
    </div>
  )

  // Find best value for price (lowest)
  const lowestPrice = Math.min(...products.map(p => p.price))
  const highestRating = Math.max(...products.map(p => p.rating))

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Compare Products</h1>
          <p className="text-gray-400 text-sm">Comparing {products.length} product{products.length > 1 ? 's' : ''}</p>
        </div>
        <Link to="/products" className="text-green-primary font-semibold text-sm hover:underline">+ Add more</Link>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-4 px-5 text-sm font-bold text-gray-500 w-32">Feature</th>
                {products.map(p => (
                  <th key={p.id} className="py-4 px-4 text-center min-w-[180px]">
                    <div className="relative">
                      <button onClick={() => remove(p.id)}
                        className="absolute -top-1 -right-1 w-6 h-6 bg-red-100 text-red-500 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors">
                        <X size={12} />
                      </button>
                      <Link to={`/products/${p.slug}`}>
                        <div className="w-20 h-20 rounded-xl overflow-hidden mx-auto mb-2 bg-gray-50">
                          {p.images?.[0]
                            ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-3xl">🛒</div>
                          }
                        </div>
                        <p className="font-bold text-gray-800 text-sm line-clamp-2 hover:text-green-primary transition-colors">{p.name}</p>
                      </Link>
                      {p.price === lowestPrice && (
                        <span className="inline-block mt-1 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          💰 Best Price
                        </span>
                      )}
                      {p.rating === highestRating && highestRating > 0 && (
                        <span className="inline-block mt-1 bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          ⭐ Top Rated
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ATTRS.map((attr, i) => (
                <tr key={attr.key} className={i % 2 === 0 ? 'bg-gray-50/50' : 'bg-white'}>
                  <td className="py-3 px-5 text-sm font-semibold text-gray-600">{attr.label}</td>
                  {products.map(p => (
                    <td key={p.id} className="py-3 px-4 text-center text-sm text-gray-800">
                      {attr.render(p)}
                    </td>
                  ))}
                </tr>
              ))}
              {/* Add to cart row */}
              <tr className="border-t border-gray-100">
                <td className="py-4 px-5 text-sm font-semibold text-gray-600">Action</td>
                {products.map(p => (
                  <td key={p.id} className="py-4 px-4 text-center">
                    <button onClick={() => add(p)}
                      disabled={p.stock === 0}
                      className="flex items-center gap-1.5 mx-auto bg-green-primary text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-green-dark transition-colors disabled:opacity-40">
                      <ShoppingCart size={13} /> Add to Cart
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
