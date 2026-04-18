import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Heart, ShoppingCart } from 'lucide-react'
import api from '@/lib/api'
import ProductCard from '@/components/product/ProductCard'
import Spinner from '@/components/ui/Spinner'

export default function SharedWishlist() {
  const { token } = useParams<{ token: string }>()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['shared-wishlist', token],
    queryFn: () => api.get(`/features/wishlists/shared/${token}`).then(r => r.data.data),
    enabled: !!token,
    retry: false,
  })

  if (isLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>

  if (isError || !data) return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <Heart size={48} className="mx-auto text-gray-200 mb-4" />
      <h2 className="font-extrabold text-gray-700 mb-2">Wishlist not found</h2>
      <p className="text-gray-400 text-sm mb-4">This wishlist link may have expired or been removed.</p>
      <Link to="/products" className="text-green-primary font-semibold hover:underline">Browse Products →</Link>
    </div>
  )

  // Backend returns { ...sharedWishlist, products: [...] }
  // products is a flat array of Product objects
  const products: any[] = data.products || []
  const ownerName = data.name || 'Shared Wishlist'

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Heart size={24} className="text-red-500 fill-red-500" />
          <h1 className="text-2xl font-extrabold text-gray-900">{ownerName}</h1>
        </div>
        <p className="text-gray-400 text-sm">{products.length} items</p>
      </div>

      {!products.length ? (
        <div className="text-center py-16 text-gray-400">
          <ShoppingCart size={48} className="mx-auto mb-4 opacity-30" />
          <p>This wishlist is empty</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((product: any) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}
