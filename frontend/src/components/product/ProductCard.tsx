import { Link, useNavigate } from 'react-router-dom'
import { Heart, Star, ShoppingCart, Zap, ShieldCheck } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { useWishlist } from '@/hooks/useWishlist'
import { formatPrice, cn } from '@/lib/utils'
import type { Product } from '@/types'

interface Props {
  product: Product
  className?: string
  showCompare?: boolean
  onCompare?: (product: Product) => void
  isCompared?: boolean
}

export default function ProductCard({ product, className, showCompare, onCompare, isCompared }: Props) {
  const { add } = useCart()
  const { isInWishlist, toggle } = useWishlist()
  const navigate = useNavigate()
  const inWish = isInWishlist(product.id)

  const discount = product.comparePrice
    ? Math.round((1 - product.price / product.comparePrice) * 100)
    : 0

  const isLowStock = product.stock > 0 && product.stock <= 10
  const isVerifiedSeller = (product as any).seller?.kycVerified || (product as any).seller?.isVerified

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    add(product, 1)
    navigate('/checkout')
  }

  return (
    <div className={cn('card group overflow-hidden relative', className)}>
      {/* Compare checkbox */}
      {showCompare && (
        <div className="absolute top-2 left-2 z-20" onClick={e => e.stopPropagation()}>
          <label className="flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 cursor-pointer shadow-sm">
            <input type="checkbox" checked={isCompared} onChange={() => onCompare?.(product)}
              className="w-3 h-3 accent-green-primary" />
            <span className="text-[10px] font-bold text-gray-600">Compare</span>
          </label>
        </div>
      )}

      {/* Image */}
      <div className="relative overflow-hidden bg-gray-50 aspect-square">
        <Link to={`/products/${product.slug}`}>
          {product.images?.[0] ? (
            <img src={product.images[0]} alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl">🛒</div>
          )}
        </Link>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {discount > 0 && <span className="badge badge-orange text-[10px]">-{discount}%</span>}
          {product.isOrganic && <span className="badge badge-green text-[10px]">🌿 Organic</span>}
          {product.stock === 0 && <span className="badge bg-gray-200 text-gray-600 text-[10px]">Out of Stock</span>}
          {/* Freshness badge — show if harvest date is set */}
          {(product as any).harvestDate && (() => {
            const days = Math.floor((Date.now() - new Date((product as any).harvestDate).getTime()) / 86400000)
            if (days <= 1) return <span className="badge bg-emerald-500 text-white text-[10px]">🌱 Just Harvested</span>
            if (days <= 3) return <span className="badge bg-green-100 text-green-700 text-[10px]">🌱 {days}d fresh</span>
            if (days <= 7) return <span className="badge bg-yellow-100 text-yellow-700 text-[10px]">🌿 {days}d old</span>
            return null
          })()}
          {/* Quality grade badge */}
          {(product as any).qualityGrade && (
            <span className="badge bg-blue-100 text-blue-700 text-[10px]">
              {(product as any).qualityGrade === 'GRADE_A' ? '🏅 Grade A' :
               (product as any).qualityGrade === 'EXPORT' ? '🌍 Export' :
               (product as any).qualityGrade === 'ORGANIC_CERTIFIED' ? '🌿 Certified' : ''}
            </span>
          )}
        </div>

        {/* Wishlist */}
        <button onClick={e => { e.preventDefault(); toggle(product.id) }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center transition-all hover:scale-110">
          <Heart size={15} className={inWish ? 'fill-red-500 text-red-500' : 'text-gray-400'} />
        </button>

        {/* Buy Now overlay on hover */}
        {product.stock > 0 && (
          <div className="absolute inset-x-0 bottom-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200">
            <button onClick={handleBuyNow}
              className="w-full bg-green-primary text-white text-xs font-extrabold py-2.5 flex items-center justify-center gap-1.5 hover:bg-green-dark transition-colors">
              <Zap size={13} className="fill-white" /> Buy Now
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        {/* Seller name + verified badge */}
        <div className="flex items-center gap-1 mb-0.5">
          <p className="text-[11px] text-gray-400 truncate">{product.seller?.storeName}</p>
          {isVerifiedSeller && (
            <ShieldCheck size={11} className="text-green-primary flex-shrink-0" title="Verified Seller" />
          )}
        </div>

        <Link to={`/products/${product.slug}`}>
          <h3 className="font-semibold text-gray-800 text-sm line-clamp-2 hover:text-green-primary transition-colors leading-snug">{product.name}</h3>
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-1 mt-1.5">
          <Star size={12} className="fill-orange-400 text-orange-400" />
          <span className="text-xs font-bold text-gray-700">{product.rating.toFixed(1)}</span>
          <span className="text-xs text-gray-400">({product.reviewCount})</span>
        </div>

        {/* Stock urgency */}
        {isLowStock && (
          <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
            🔥 Only {product.stock} {product.unit} left!
          </p>
        )}

        {/* Orders today signal — shown when soldCount is meaningful */}
        {(product as any).soldCount >= 10 && (
          <p className="text-[10px] text-purple-600 font-semibold mt-0.5 flex items-center gap-1">
            🛒 {(product as any).soldCount}+ sold
          </p>
        )}

        {/* Price drop badge */}
        {discount >= 10 && (
          <p className="text-[10px] text-green-600 font-bold mt-0.5 flex items-center gap-1">
            📉 Price dropped {discount}%
          </p>
        )}

        {/* Price + Cart */}
        <div className="flex items-center justify-between mt-2.5">
          <div>
            <span className="text-base font-extrabold text-green-primary">{formatPrice(product.price)}</span>
            <span className="text-xs text-gray-400 ml-1">/{product.unit}</span>
            {product.comparePrice && (
              <div className="text-xs text-gray-400 line-through">{formatPrice(product.comparePrice)}</div>
            )}
          </div>
          <button
            onClick={e => { e.preventDefault(); add(product) }}
            disabled={product.stock === 0}
            className="w-9 h-9 rounded-full bg-green-primary text-white flex items-center justify-center hover:bg-green-dark transition-all hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed shadow-md">
            <ShoppingCart size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
