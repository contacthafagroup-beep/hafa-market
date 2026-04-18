import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router-dom"
import { Leaf, MapPin, Star, Package } from "lucide-react"
import api from "@/lib/api"
import Spinner from "@/components/ui/Spinner"
import ProductCard from "@/components/product/ProductCard"

export default function FarmerDirect() {
  const { data: farmers = [], isLoading } = useQuery({
    queryKey: ["farmer-direct"],
    queryFn: () => api.get("/features/farmer-direct").then(r => r.data.data),
    staleTime: 1000 * 60 * 5,
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 mb-4">
          <Leaf size={16} className="text-green-primary" />
          <span className="text-xs font-bold text-green-primary uppercase tracking-wide">No Middlemen</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">🌾 Farmer Direct</h1>
        <p className="text-gray-400 max-w-xl mx-auto">Buy directly from verified Ethiopian farmers. Fresh from the farm, fair prices, no reseller markup.</p>
      </div>

      {isLoading ? <div className="flex justify-center py-20"><Spinner size="lg" /></div> : (
        <div className="space-y-10">
          {!farmers.length ? (
            <div className="text-center py-16 text-gray-400">No farmer direct listings yet</div>
          ) : farmers.map((farmer: any) => (
            <div key={farmer.id} className="bg-white rounded-2xl shadow-card overflow-hidden">
              <div className="bg-gradient-to-br from-green-dark to-green-primary p-5 text-white flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black flex-shrink-0 overflow-hidden">
                  {farmer.logo ? <img src={farmer.logo} alt={farmer.storeName} className="w-full h-full object-cover" /> : farmer.storeName?.[0]}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-lg">{farmer.storeName}</h3>
                    <span className="bg-green-400/30 border border-green-300/40 text-white text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Leaf size={10} /> Farmer Direct
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-white/70 text-sm mt-1">
                    {farmer.city && <span className="flex items-center gap-1"><MapPin size={12} />{farmer.city}</span>}
                    <span className="flex items-center gap-1"><Star size={12} className="fill-orange-300 text-orange-300" />{(farmer.rating||0).toFixed(1)}</span>
                    <span className="flex items-center gap-1"><Package size={12} />{farmer.productCount} products</span>
                  </div>
                  {farmer.description && <p className="text-white/60 text-xs mt-1 line-clamp-1">{farmer.description}</p>}
                </div>
                <Link to={`/sellers/${farmer.storeSlug}`}
                  className="bg-white/15 border border-white/25 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-white/25 transition-colors flex-shrink-0">
                  Visit Farm →
                </Link>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {farmer.products.map((p: any) => <ProductCard key={p.id} product={p} />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
