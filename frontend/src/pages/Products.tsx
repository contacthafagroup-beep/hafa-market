import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { SlidersHorizontal, Grid, List, ChevronDown, X, Mic } from 'lucide-react'
import { productService } from '@/services/product.service'
import ProductCard from '@/components/product/ProductCard'
import VoiceSearch from '@/components/ui/VoiceSearch'
import VisualSearch from '@/components/ui/VisualSearch'
import api from '@/lib/api'

const CATEGORIES = [
  { slug: 'vegetables', label: '🥬 Vegetables' },
  { slug: 'fruits',     label: '🍎 Fruits' },
  { slug: 'grains',     label: '🌾 Grains' },
  { slug: 'legumes',    label: '🫘 Legumes' },
  { slug: 'spices',     label: '🌿 Spices' },
  { slug: 'poultry',    label: '🥚 Poultry' },
  { slug: 'meat',       label: '🥩 Meat' },
  { slug: 'coffee',     label: '☕ Coffee' },
  { slug: 'specialty',  label: '🍯 Specialty' },
  { slug: 'processed',  label: '🍲 Processed' },
  { slug: 'household',  label: '🏠 Household' },
]

const SORT_OPTIONS = [
  { value: 'createdAt:desc', label: 'Newest' },
  { value: 'soldCount:desc', label: 'Best Selling' },
  { value: 'rating:desc',    label: 'Top Rated' },
  { value: 'price:asc',      label: 'Price: Low → High' },
  { value: 'price:desc',     label: 'Price: High → Low' },
]

/* ── No results with suggestions ── */
function NoResultsSuggestions({ search, category, onClear }: { search?: string; category?: string; onClear: () => void }) {
  const { data: trending } = useQuery({
    queryKey: ['trending-search'],
    queryFn: () => api.get('/search/trending').then(r => r.data.data?.slice(0, 6)),
    staleTime: 1000 * 60 * 5,
  })
  const { data: popular } = useQuery({
    queryKey: ['popular-products-fallback'],
    queryFn: () => productService.getProducts({ sort: 'soldCount', limit: 4 }).then(r => r.data.data),
    staleTime: 1000 * 60 * 5,
  })

  return (
    <div className="py-12">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">🔍</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">
          No results for {search ? `"${search}"` : category ? `"${category}"` : 'your search'}
        </h3>
        <p className="text-gray-400 mb-4">Try different keywords or browse popular products</p>
        <button onClick={onClear} className="bg-green-primary text-white px-6 py-2 rounded-full text-sm font-bold hover:bg-green-dark transition-colors">
          Clear Filters
        </button>
      </div>

      {trending?.length > 0 && (
        <div className="mb-8">
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">🔥 Trending Searches</p>
          <div className="flex gap-2 flex-wrap">
            {trending.map((t: any) => (
              <Link key={t.query} to={`/products?search=${encodeURIComponent(t.query)}`}
                className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium text-gray-700 hover:border-green-primary hover:text-green-primary transition-colors shadow-sm">
                {t.query}
              </Link>
            ))}
          </div>
        </div>
      )}

      {popular?.length > 0 && (
        <div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">⭐ Popular Products</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {popular.map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Skeleton card ── */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-card animate-pulse">
      <div className="h-44 bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-1/3" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="flex justify-between items-center mt-3">
          <div className="h-5 bg-gray-200 rounded w-1/4" />
          <div className="h-8 w-16 bg-gray-200 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export default function Products() {
  const [params, setParams] = useSearchParams()
  const [view, setView]     = useState<'grid'|'list'>('grid')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [minPrice, setMinPrice] = useState(params.get('minPrice') || '')
  const [maxPrice, setMaxPrice] = useState(params.get('maxPrice') || '')
  const loaderRef = useRef<HTMLDivElement>(null)

  const category = params.get('category') || undefined
  const search   = params.get('search')   || undefined
  const organic  = params.get('organic') === 'true' ? true : undefined
  const [sortVal, setSortVal] = useState(
    params.get('sort') ? `${params.get('sort')}:${params.get('order') || 'desc'}` : 'createdAt:desc'
  )
  const [sort, order] = sortVal.split(':') as [string, 'asc'|'desc']

  // Sync minPrice/maxPrice from URL on mount
  useEffect(() => {
    setMinPrice(params.get('minPrice') || '')
    setMaxPrice(params.get('maxPrice') || '')
  }, [params.get('minPrice'), params.get('maxPrice')])

  /* ── Infinite scroll query ── */
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } = useInfiniteQuery({
    queryKey: ['products-infinite', { category, search, organic, sort, order, minPrice, maxPrice }],
    queryFn: ({ pageParam = 1 }) => productService.getProducts({
      category, search, isOrganic: organic,
      sort: sort as any, order,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      page: pageParam, limit: 20,
      sessionId: sessionStorage.getItem('sessionId') || undefined,
    }).then(r => r.data),
    getNextPageParam: (last) => {
      const { page, pages } = last.pagination || {}
      return page < pages ? page + 1 : undefined
    },
    staleTime: 60000,
  })

  /* ── IntersectionObserver for infinite scroll ── */
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const obs = new IntersectionObserver(handleObserver, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [handleObserver])

  const allProducts = data?.pages.flatMap(p => p.data) ?? []
  const sponsored   = data?.pages[0]?.sponsored ?? []
  const total = data?.pages[0]?.pagination?.total ?? 0
  const aiIntent = data?.pages[0]?.aiIntent

  const setFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next)
  }

  const handleSort = (val: string) => {
    setSortVal(val)
    const [s, o] = val.split(':')
    const next = new URLSearchParams(params)
    next.set('sort', s); next.set('order', o)
    setParams(next)
  }

  const applyPrice = () => {
    const next = new URLSearchParams(params)
    if (minPrice) next.set('minPrice', minPrice); else next.delete('minPrice')
    if (maxPrice) next.set('maxPrice', maxPrice); else next.delete('maxPrice')
    setParams(next)
  }

  const clearFilters = () => {
    setParams(new URLSearchParams())
    setMinPrice(''); setMaxPrice('')
  }

  const hasFilters = !!(category || search || organic || minPrice || maxPrice)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Sidebar */}
        <aside className={`lg:w-64 flex-shrink-0 ${filtersOpen ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-white rounded-2xl shadow-card p-5 sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900">Filters</h3>
              {hasFilters && (
                <button onClick={clearFilters} className="text-xs text-red-500 font-semibold flex items-center gap-1 hover:text-red-700">
                  <X size={12} /> Clear all
                </button>
              )}
            </div>

            {/* Category */}
            <div className="mb-5">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Category</h4>
              <div className="space-y-1">
                <button onClick={() => setFilter('category', null)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-xl transition-colors ${!category ? 'bg-green-50 text-green-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
                  All Categories
                </button>
                {CATEGORIES.map(c => (
                  <button key={c.slug} onClick={() => setFilter('category', c.slug)}
                    className={`w-full text-left text-sm px-3 py-2 rounded-xl transition-colors ${category === c.slug ? 'bg-green-50 text-green-primary font-bold' : 'text-gray-600 hover:bg-gray-50'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
            <div className="mb-5">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Price Range</h4>
              <div className="flex gap-2 mb-2">
                <input type="number" placeholder="Min $" value={minPrice} onChange={e => setMinPrice(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" />
                <input type="number" placeholder="Max $" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" />
              </div>
              <button onClick={applyPrice} className="w-full bg-green-primary text-white rounded-xl py-2 text-sm font-bold hover:bg-green-dark transition-colors">
                Apply
              </button>
            </div>

            {/* Rating filter */}
            <div className="mb-5">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Min Rating</h4>
              <div className="flex gap-1">
                {[4,3,2,1].map(r => (
                  <button key={r} onClick={() => setFilter('minRating', String(r))}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${params.get('minRating') === String(r) ? 'bg-orange-400 text-white border-orange-400' : 'border-gray-200 text-gray-600 hover:border-orange-300'}`}>
                    {r}★+
                  </button>
                ))}
              </div>
            </div>

            {/* Organic */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={organic === true}
                onChange={e => setFilter('organic', e.target.checked ? 'true' : null)}
                className="w-4 h-4 accent-green-primary rounded" />
              <span className="text-sm font-medium text-gray-700">Organic Only 🌿</span>
            </label>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setFiltersOpen(!filtersOpen)}
                className="lg:hidden flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-full text-sm font-medium hover:bg-gray-50">
                <SlidersHorizontal size={16} /> Filters {hasFilters && <span className="bg-green-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">!</span>}
              </button>
              <p className="text-sm text-gray-500">
                <span className="font-bold text-gray-800">{total}</span> products
                {search && <span className="font-semibold"> for "{search}"</span>}
                {category && <span className="font-semibold capitalize"> in {category}</span>}
              </p>
              {/* Voice search on mobile */}
              <VoiceSearch
                onResult={text => setFilter('search', text)}
                className="w-9 h-9 rounded-full md:hidden"
              />
              {/* Visual search — camera icon */}
              <VisualSearch className="w-9 h-9 rounded-full border border-gray-200 hover:border-purple-400" />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <select value={sortVal} onChange={e => handleSort(e.target.value)}
                  className="appearance-none border border-gray-200 rounded-full px-4 py-2 pr-8 text-sm font-medium outline-none focus:border-green-primary cursor-pointer bg-white">
                  {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <div className="flex border border-gray-200 rounded-full overflow-hidden">
                <button onClick={() => setView('grid')} className={`p-2 transition-colors ${view==='grid' ? 'bg-green-primary text-white' : 'hover:bg-gray-50'}`}><Grid size={16} /></button>
                <button onClick={() => setView('list')} className={`p-2 transition-colors ${view==='list' ? 'bg-green-primary text-white' : 'hover:bg-gray-50'}`}><List size={16} /></button>
              </div>
            </div>
          </div>

          {/* Active filters chips */}
          {hasFilters && (
            <div className="flex gap-2 flex-wrap mb-4">
              {category && <span className="bg-green-100 text-green-primary text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 capitalize">{category} <button onClick={() => setFilter('category', null)}>×</button></span>}
              {search && <span className="bg-blue-100 text-blue-600 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">"{search}" <button onClick={() => setFilter('search', null)}>×</button></span>}
              {organic && <span className="bg-green-100 text-green-primary text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">🌿 Organic <button onClick={() => setFilter('organic', null)}>×</button></span>}
              {(minPrice || maxPrice) && <span className="bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">${minPrice||'0'} – ${maxPrice||'∞'} <button onClick={() => { setMinPrice(''); setMaxPrice(''); setFilter('minPrice', null); setFilter('maxPrice', null) }}>×</button></span>}
            </div>
          )}

          {/* Skeleton loading */}
          {isLoading ? (
            <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' : 'flex flex-col gap-3'}>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : !allProducts.length ? (
            <NoResultsSuggestions search={search} category={category} onClear={clearFilters} />
          ) : (
            <>
              {/* AI intent badge */}
              {aiIntent?.intent && (
                <div className="flex items-center gap-2 mb-3 text-xs text-purple-600 bg-purple-50 border border-purple-100 rounded-full px-3 py-1.5 w-fit">
                  <span>🤖</span>
                  <span className="font-semibold capitalize">
                    {aiIntent.intent === 'bulk' ? 'Showing bulk-friendly products' :
                     aiIntent.intent === 'cheap' ? 'Showing best-value products' :
                     aiIntent.intent === 'organic' ? 'Showing organic products' : ''}
                  </span>
                </div>
              )}

              {/* Sponsored products */}
              {sponsored.length > 0 && search && (
                <div className="mb-4">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Sponsored</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {sponsored.map((p: any) => (
                      <div key={`sp-${p.id}`} className="relative" onClick={() => {
                        if (p._adId) api.post('/search/click', { query: search, productId: p.id, position: 0, adId: p._adId, sessionId: sessionStorage.getItem('sessionId') || undefined }).catch(() => {})
                      }}>
                        <div className="absolute top-2 left-2 z-10 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                          Sponsored
                        </div>
                        <ProductCard product={p} />
                      </div>
                    ))}
                  </div>
                  <div className="border-b border-gray-100 mt-4 mb-2" />
                </div>
              )}

              <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4' : 'flex flex-col gap-3'}>
                {allProducts.map((p, idx) => (
                  <div key={p.id} onClick={() => {
                    // Track click for search intelligence feedback loop
                    if (search) {
                      api.post('/search/click', {
                        query: search,
                        productId: p.id,
                        position: idx + 1,
                        sessionId: sessionStorage.getItem('sessionId') || undefined,
                      }).catch(() => {})
                    }
                  }}>
                    <ProductCard product={p} />
                  </div>
                ))}
                {/* Skeleton for next page loading */}
                {isFetchingNextPage && Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={`sk-${i}`} />)}
              </div>

              {/* Infinite scroll trigger */}
              <div ref={loaderRef} className="h-10 flex items-center justify-center mt-6">
                {isFetchingNextPage && <div className="w-6 h-6 border-2 border-green-primary border-t-transparent rounded-full animate-spin" />}
                {!hasNextPage && allProducts.length > 0 && (
                  <p className="text-sm text-gray-400">✅ All {total} products loaded</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
