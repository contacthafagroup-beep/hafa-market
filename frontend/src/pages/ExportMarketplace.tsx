/**
 * ExportMarketplace — /export
 * Global B2B export marketplace for Ethiopian agricultural products
 * Buyers browse listings, send RFQs, negotiate, place orders
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Globe, Search, Filter, Package, Star, CheckCircle, ArrowRight, MessageSquare, TrendingUp } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'

const CATEGORIES = [
  { value: '', label: 'All Products', emoji: '🌍' },
  { value: 'COFFEE', label: 'Coffee', emoji: '☕' },
  { value: 'TEFF', label: 'Teff', emoji: '🌾' },
  { value: 'HONEY', label: 'Honey', emoji: '🍯' },
  { value: 'SPICES', label: 'Spices', emoji: '🌿' },
  { value: 'AVOCADO', label: 'Avocado', emoji: '🥑' },
  { value: 'SESAME', label: 'Sesame', emoji: '🌱' },
  { value: 'PULSES', label: 'Pulses', emoji: '🫘' },
  { value: 'OIL_SEEDS', label: 'Oil Seeds', emoji: '🌻' },
  { value: 'LEATHER', label: 'Leather', emoji: '👜' },
  { value: 'FLOWERS', label: 'Flowers', emoji: '🌸' },
]

const CERT_BADGES: Record<string, { label: string; color: string }> = {
  'Organic':          { label: '🌿 Organic',     color: 'bg-green-100 text-green-700' },
  'FairTrade':        { label: '🤝 Fair Trade',   color: 'bg-blue-100 text-blue-700' },
  'UTZ':              { label: '✅ UTZ',           color: 'bg-teal-100 text-teal-700' },
  'RainforestAlliance':{ label: '🐸 Rainforest',  color: 'bg-emerald-100 text-emerald-700' },
  'USDA Organic':     { label: '🇺🇸 USDA',        color: 'bg-red-100 text-red-700' },
  'EU Organic':       { label: '🇪🇺 EU Organic',  color: 'bg-indigo-100 text-indigo-700' },
}

export default function ExportMarketplace() {
  const { user } = useAuth()
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const isSeller = user?.role === 'ADMIN' || user?.role === 'SELLER'

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['export-listings', category, search],
    queryFn: () => api.get(`/export/listings?${category ? `category=${category}&` : ''}${search ? `search=${search}&` : ''}limit=20`).then(r => r.data.data || []),
    staleTime: 60000,
  })

  const { data: categoryStats = [] } = useQuery({
    queryKey: ['export-categories'],
    queryFn: () => api.get('/export/categories').then(r => r.data.data || []),
    staleTime: 300000,
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-green-dark via-green-primary to-teal-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 border border-white/30 rounded-full px-4 py-1.5 mb-4">
            <Globe size={14} /> <span className="text-sm font-semibold">Global Export Marketplace</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            Ethiopian Products,<br />Global Buyers
          </h1>
          <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
            Connect with verified Ethiopian exporters. Source premium coffee, teff, honey, spices and more. Direct from origin.
          </p>

          {/* Search */}
          <div className="flex gap-3 max-w-xl mx-auto">
            <div className="flex-1 flex items-center gap-2 bg-white rounded-2xl px-4 py-3">
              <Search size={18} className="text-gray-400 flex-shrink-0" />
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setSearch(searchInput)}
                placeholder="Search coffee, teff, honey…"
                className="flex-1 outline-none text-gray-800 text-sm"
              />
            </div>
            <button onClick={() => setSearch(searchInput)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-3 rounded-2xl transition-colors">
              Search
            </button>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-8 mt-10 flex-wrap">
            {[
              { label: 'Verified Exporters', value: '200+' },
              { label: 'Product Categories', value: '11' },
              { label: 'Countries Reached', value: '50+' },
              { label: 'Annual Export Value', value: '$5.1B' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-white/60 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Action buttons */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {isSeller && (
              <Link to="/export/create"
                className="flex items-center gap-2 bg-green-primary text-white px-5 py-2.5 rounded-xl font-bold hover:bg-green-dark transition-colors">
                <Package size={16} /> List Product for Export
              </Link>
            )}
            <Link to="/export/rfq"
              className="flex items-center gap-2 border-2 border-green-primary text-green-primary px-5 py-2.5 rounded-xl font-bold hover:bg-green-50 transition-colors">
              <MessageSquare size={16} /> Post a Buying Request
            </Link>
          </div>
          {isSeller && (
            <Link to="/export/verify"
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-green-primary transition-colors">
              <CheckCircle size={14} /> Get Verified Exporter Status
            </Link>
          )}
        </div>

        {/* Category filter */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-8 pb-1">
          {CATEGORIES.map(cat => (
            <button key={cat.value} onClick={() => setCategory(cat.value)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${
                category === cat.value
                  ? 'bg-green-primary text-white border-green-primary'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-green-primary'
              }`}>
              <span>{cat.emoji}</span> {cat.label}
              {cat.value && categoryStats.find((s: any) => s.category === cat.value) && (
                <span className="text-[10px] opacity-70">
                  ({Number((categoryStats.find((s: any) => s.category === cat.value) as any)?.count || 0)})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Listings grid */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Spinner size="lg" /></div>
        ) : listings.length === 0 ? (
          <div className="text-center py-20">
            <Globe size={48} className="mx-auto text-gray-200 mb-4" />
            <h3 className="font-bold text-gray-700 mb-2">No listings found</h3>
            <p className="text-gray-400 text-sm">
              {isSeller ? 'Be the first to list your products for export!' : 'Check back soon or post a buying request.'}
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {listings.map((listing: any) => (
              <ExportListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}

        {/* How it works */}
        <div className="mt-16 bg-white rounded-3xl p-8 shadow-card">
          <h2 className="text-2xl font-extrabold text-gray-900 text-center mb-8">How Export Works</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: '1', icon: '🔍', title: 'Browse & Inquire', desc: 'Find products, send RFQ with your requirements and target price' },
              { step: '2', icon: '💬', title: 'Negotiate', desc: 'Chat directly with verified exporters, request samples, agree on terms' },
              { step: '3', icon: '📋', title: 'Contract & Pay', desc: '30% deposit to start production, 70% on shipment via escrow' },
              { step: '4', icon: '🚢', title: 'Ship & Track', desc: 'Goods shipped with full documentation. Track from Addis to your door' },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">{s.icon}</div>
                <div className="w-6 h-6 bg-green-primary text-white rounded-full flex items-center justify-center text-xs font-black mx-auto mb-2">{s.step}</div>
                <h3 className="font-bold text-gray-900 mb-1">{s.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ExportListingCard({ listing }: { listing: any }) {
  const certs: string[] = listing.certifications || []
  const tiers: any[] = listing.priceTiers || []
  const isVerified = listing.verificationStatus === 'VERIFIED'

  return (
    <Link to={`/export/listings/${listing.id}`}
      className="bg-white rounded-2xl shadow-card overflow-hidden hover:shadow-card-hover hover:-translate-y-0.5 transition-all group">
      {/* Image */}
      <div className="aspect-video bg-gradient-to-br from-green-100 to-teal-100 relative overflow-hidden">
        {listing.images?.[0] ? (
          <img src={listing.images[0]} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {CATEGORIES.find(c => c.value === listing.category)?.emoji || '📦'}
          </div>
        )}
        {/* Verified badge */}
        {isVerified && (
          <div className="absolute top-2 left-2 bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <CheckCircle size={9} /> Verified
          </div>
        )}
        {/* Category */}
        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
          {listing.category}
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-gray-900 mb-0.5 line-clamp-2 leading-snug">{listing.title}</h3>
        {listing.origin && (
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            📍 {listing.origin}{listing.grade ? ` · ${listing.grade}` : ''}
          </p>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-1 mb-2">
          <span className="text-lg font-extrabold text-green-primary">${listing.pricePerUnit}</span>
          <span className="text-xs text-gray-400">/{listing.moqUnit}</span>
        </div>

        {/* MOQ */}
        <p className="text-xs text-gray-500 mb-3">
          MOQ: <span className="font-bold text-gray-700">{listing.moqQty} {listing.moqUnit}</span>
          {listing.leadTimeDays && <span className="ml-2">· {listing.leadTimeDays}d lead time</span>}
        </p>

        {/* Volume tiers */}
        {tiers.length > 0 && (
          <div className="flex gap-1 mb-3 overflow-x-auto scrollbar-hide">
            {tiers.slice(0, 3).map((tier: any, i: number) => (
              <span key={i} className="flex-shrink-0 text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full">
                {tier.minQty}+: ${tier.price}
              </span>
            ))}
          </div>
        )}

        {/* Certifications */}
        {certs.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-3">
            {certs.slice(0, 2).map(cert => {
              const cfg = CERT_BADGES[cert] || { label: cert, color: 'bg-gray-100 text-gray-600' }
              return (
                <span key={cert} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.color}`}>
                  {cfg.label}
                </span>
              )
            })}
            {certs.length > 2 && <span className="text-[10px] text-gray-400">+{certs.length - 2}</span>}
          </div>
        )}

        {/* Seller + stats */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-[10px] font-bold text-green-primary">
              {listing.sellerName?.[0]}
            </div>
            <span className="text-xs text-gray-600 truncate max-w-[80px]">{listing.sellerName}</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-400">
            <span>{listing.inquiries} inquiries</span>
            <span className="text-green-primary font-bold">{listing.deals} deals</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
