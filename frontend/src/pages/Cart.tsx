import { Link } from 'react-router-dom'
import { Trash2, Plus, Minus, ShoppingBag, Store } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils'
import Button from '@/components/ui/Button'
import RecommendationSection from '@/components/ui/RecommendationSection'
import OneClickCheckout from '@/components/ui/OneClickCheckout'

export default function Cart() {
  const { items, total, remove, updateQty, clear } = useCart()

  if (!items.length) return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <div className="text-7xl mb-6">🛒</div>
      <h2 className="text-2xl font-extrabold text-gray-800 mb-3">Your cart is empty</h2>
      <p className="text-gray-400 mb-8">Add some fresh products to get started!</p>
      <Link to="/products"><Button size="lg"><ShoppingBag size={18} /> Browse Products</Button></Link>
    </div>
  )

  const deliveryFee = total >= 50 ? 0 : 3.99

  // Group items by seller for multi-seller display
  const bySeller = items.reduce((acc: Record<string, typeof items>, item) => {
    const sellerId = item.product.seller?.id || 'unknown'
    if (!acc[sellerId]) acc[sellerId] = []
    acc[sellerId].push(item)
    return acc
  }, {})

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-extrabold text-gray-900">My Cart <span className="text-green-primary">({items.length})</span></h1>
        <button onClick={clear} className="text-sm text-red-400 hover:text-red-600 font-medium transition-colors">Clear all</button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Items grouped by seller */}
        <div className="lg:col-span-2 space-y-6">
          {Object.entries(bySeller).map(([sellerId, sellerItems]) => {
            const seller = sellerItems[0].product.seller
            return (
              <div key={sellerId} className="bg-white rounded-2xl shadow-card overflow-hidden">
                {/* Seller header */}
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <Store size={15} className="text-green-primary" />
                  <Link to={`/sellers/${seller?.storeSlug}`} className="text-sm font-bold text-gray-800 hover:text-green-primary transition-colors">
                    {seller?.storeName || 'Seller'}
                  </Link>
                  <span className="text-xs text-gray-400 ml-auto">{sellerItems.length} item{sellerItems.length > 1 ? 's' : ''}</span>
                </div>
                {/* Items */}
                <div className="divide-y divide-gray-50">
                  {sellerItems.map(item => (
                    <div key={item.productId} className="p-4 flex gap-4">
                      <Link to={`/products/${item.product.slug}`} className="w-20 h-20 rounded-xl bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.product.images?.[0]
                          ? <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                          : <span className="text-4xl">🛒</span>}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/products/${item.product.slug}`} className="font-semibold text-gray-800 hover:text-green-primary transition-colors line-clamp-2">{item.product.name}</Link>
                        <p className="text-green-primary font-bold mt-1">{formatPrice(item.product.price)}/{item.product.unit}</p>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center border border-gray-200 rounded-full overflow-hidden">
                            <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="px-3 py-1.5 hover:bg-gray-50"><Minus size={14} /></button>
                            <span className="px-3 font-bold text-sm">{item.quantity}</span>
                            <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="px-3 py-1.5 hover:bg-gray-50"><Plus size={14} /></button>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-gray-900">{formatPrice(item.product.price * item.quantity)}</span>
                            <button onClick={() => remove(item.productId)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-card p-6 sticky top-24">
            <h3 className="font-extrabold text-gray-900 text-lg mb-5">Order Summary</h3>
            <div className="space-y-3 mb-5">
              <div className="flex justify-between text-sm text-gray-600"><span>Subtotal ({items.length} items)</span><span className="font-semibold">{formatPrice(total)}</span></div>
              <div className="flex justify-between text-sm text-gray-600"><span>Delivery</span><span className={deliveryFee === 0 ? 'text-green-primary font-bold' : 'font-semibold'}>{deliveryFee === 0 ? 'FREE' : formatPrice(deliveryFee)}</span></div>
              {deliveryFee > 0 && <p className="text-xs text-gray-400">Add {formatPrice(50 - total)} more for free delivery</p>}
              {Object.keys(bySeller).length > 1 && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-2 text-xs text-blue-700">
                  📦 {Object.keys(bySeller).length} sellers · items may arrive separately
                </div>
              )}
              <div className="border-t border-gray-100 pt-3 flex justify-between font-extrabold text-gray-900 text-lg">
                <span>Total</span><span className="text-green-primary">{formatPrice(total + deliveryFee)}</span>
              </div>
            </div>
            <Link to="/checkout"><Button fullWidth size="lg">Proceed to Checkout →</Button></Link>
            <OneClickCheckout className="mt-2" />
            <Link to="/products" className="block text-center text-sm text-gray-400 hover:text-gray-600 mt-3 transition-colors">Continue Shopping</Link>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <RecommendationSection
        context="cart"
        title="Complete Your Order"
        titleAm="ትዕዛዝዎን ያሟሉ"
        limit={5}
      />
    </div>
  )
}
