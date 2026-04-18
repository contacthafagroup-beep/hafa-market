import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Search, GitCompare, X, ShoppingCart } from 'lucide-react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { productService } from '@/services/product.service'
import { useCart } from '@/hooks/useCart'


const DEFAULT_CATS = [
  { label:'Vegetables',            slug:'vegetables', emoji:'🥬', sub:'Tomatoes, Onions, Kale...',      c1:'#e8f5e9', c2:'#c8e6c9' },
  { label:'Fruits',                slug:'fruits',     emoji:'🍎', sub:'Mango, Avocado, Banana...',      c1:'#fff3e0', c2:'#ffe0b2' },
  { label:'Grains & Legumes',      slug:'grains',     emoji:'🌾', sub:'Teff, Wheat, Beans, Lentils...', c1:'#fafafa',  c2:'#f0f0f0' },
  { label:'Spices & Herbs',        slug:'spices',     emoji:'🌿', sub:'Turmeric, Ginger, Cardamom...',  c1:'#fff8e1', c2:'#ffecb3' },
  { label:'Poultry & Dairy',       slug:'poultry',    emoji:'🥚', sub:'Eggs, Milk, Chicken...',         c1:'#fce4ec', c2:'#f8bbd0' },
  { label:'Livestock & Meat',      slug:'meat',       emoji:'🥩', sub:'Beef, Mutton, Goat Meat...',     c1:'#fbe9e7', c2:'#ffccbc' },
  { label:'Coffee & Beverages',    slug:'coffee',     emoji:'☕', sub:'Roasted, Raw Coffee...',         c1:'#efebe9', c2:'#d7ccc8' },
  { label:'Specialty Products',    slug:'specialty',  emoji:'🍯', sub:'Honey, Moringa, Aloe Vera...',   c1:'#f3e5f5', c2:'#e1bee7' },
  { label:'Processed Foods',       slug:'processed',  emoji:'🍲', sub:'ዶሮ ወጥ, Snacks...',             c1:'#e8eaf6', c2:'#c5cae9' },
  { label:'Household & Essentials',slug:'household',  emoji:'🏠', sub:'Detergents, Cleaning...',        c1:'#e0f7fa', c2:'#b2ebf2' },
  { label:'Services (አገልግሎት)',   slug:'services',   emoji:'🚚', sub:'Delivery, Logistics...',         c1:'#e3f2fd', c2:'#bbdefb' },
  { label:'All Products',          slug:'',           emoji:'🌍', sub:'Browse everything',              c1:'#2E7D32', c2:'#1b5e20', special: true },
]

type Cat = typeof DEFAULT_CATS[0]

interface Props {
  onCategorySelect?: (slug: string) => void
  selectedCategory?: string
}

export default function CategoriesSection({ onCategorySelect, selectedCategory }: Props) {
  const { add } = useCart()
  /* ── #6 Personalized order from localStorage ── */
  const [cats, setCats] = useState<Cat[]>(() => {
    try {
      const order: string[] = JSON.parse(localStorage.getItem('hafa_cat_order') || '[]')
      if (!order.length) return DEFAULT_CATS
      return [...DEFAULT_CATS].sort((a, b) => {
        const ai = order.indexOf(a.slug), bi = order.indexOf(b.slug)
        if (ai === -1 && bi === -1) return 0
        if (ai === -1) return 1
        if (bi === -1) return -1
        return ai - bi
      })
    } catch { return DEFAULT_CATS }
  })

  const trackClick = (slug: string) => {
    try {
      const clicks: Record<string, number> = JSON.parse(localStorage.getItem('hafa_cat_clicks') || '{}')
      clicks[slug] = (clicks[slug] || 0) + 1
      localStorage.setItem('hafa_cat_clicks', JSON.stringify(clicks))
      const sorted = [...DEFAULT_CATS].sort((a, b) => (clicks[b.slug] || 0) - (clicks[a.slug] || 0))
      localStorage.setItem('hafa_cat_order', JSON.stringify(sorted.map(c => c.slug)))
    } catch {}
  }

  const [filter, setFilter]           = useState('')
  const [visible, setVisible]         = useState<boolean[]>(cats.map(() => false))
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null)
  const [hoverPos, setHoverPos]       = useState<{ x: number; y: number } | null>(null)
  const [flippedSlug, setFlippedSlug] = useState<string | null>(null)
  const [compareList, setCompareList] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)
  const [dragIdx, setDragIdx]         = useState<number | null>(null)
  const [focusIdx, setFocusIdx]       = useState<number>(-1)
  const [viewMode, setViewMode]       = useState<'grid' | 'list'>('grid')
  const [spotlightSlug, setSpotlightSlug] = useState<string | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const gridRef    = useRef<HTMLDivElement>(null)

  /* ── #2 Recently browsed ── */
  const recentlyBrowsed = (() => {
    try {
      const clicks: Record<string, number> = JSON.parse(localStorage.getItem('hafa_cat_clicks') || '{}')
      return Object.entries(clicks).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s)
    } catch { return [] as string[] }
  })()

  /* ── #1 AI recommendation — top unvisited category ── */
  const aiRecommended = (() => {
    try {
      const clicks: Record<string, number> = JSON.parse(localStorage.getItem('hafa_cat_clicks') || '{}')
      const unvisited = DEFAULT_CATS.filter(c => c.slug && !clicks[c.slug])
      if (unvisited.length === 0) return null
      // Recommend based on what similar users browse (simulated via trending)
      return unvisited[0].slug
    } catch { return null }
  })()

  /* ── Single batch fetch — derive counts, trending, new, prices from one request ── */
  const { data: batchData, isLoading: batchLoading } = useQuery({
    queryKey: ['cats-batch'],
    queryFn: () => productService.getProducts({ limit: 100, sort: 'soldCount' }).then(r => {
      const countMap: Record<string, number> = {}
      const priceMap: Record<string, number> = {}
      const soldMap: Record<string, number> = {}
      r.data.data.forEach((p: any) => {
        const s = p.category?.slug
        if (!s) return
        countMap[s] = (countMap[s] || 0) + 1
        soldMap[s]  = (soldMap[s]  || 0) + (p.soldCount || 0)
        if (!priceMap[s] || p.price < priceMap[s]) priceMap[s] = p.price
      })
      const trending = Object.entries(soldMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s]) => s)
      return { countMap, priceMap, trending }
    }),
    staleTime: 600000,
    gcTime: 600000,
  })

  const { data: newData } = useQuery({
    queryKey: ['cats-new'],
    queryFn: () => productService.getProducts({ limit: 20, sort: 'createdAt' }).then(r => {
      const slugs = new Set(r.data.data.map((p: any) => p.category?.slug).filter(Boolean))
      return [...slugs] as string[]
    }),
    staleTime: 600000,
    gcTime: 600000,
  })

  const countMap  = batchData?.countMap  ?? {}
  const priceMap  = batchData?.priceMap  ?? {}
  const trendingSlugs = batchData?.trending ?? []
  const newSlugs  = newData ?? []
  const countsLoading = batchLoading

  /* ── #4 Price change indicator (compare to last visit) ── */
  const priceChangeMap = (() => {
    try {
      const prev: Record<string, number> = JSON.parse(localStorage.getItem('hafa_cat_prices') || '{}')
      const changes: Record<string, 'up' | 'down' | 'same'> = {}
      Object.entries(priceMap).forEach(([slug, price]) => {
        if (price == null) return
        if (!prev[slug]) { changes[slug] = 'same' }
        else if (price > prev[slug]) changes[slug] = 'up'
        else if (price < prev[slug]) changes[slug] = 'down'
        else changes[slug] = 'same'
      })
      // Save current prices for next visit
      if (Object.keys(priceMap).length > 0) {
        localStorage.setItem('hafa_cat_prices', JSON.stringify(priceMap))
      }
      return changes
    } catch { return {} as Record<string, 'up' | 'down' | 'same'> }
  })()

  /* ── #5 Popularity bar — relative to max count ── */
  const maxCount = Math.max(...Object.values(countMap), 1)

  /* ── #6 Stock urgency — categories where avg stock is low ── */
  const lowStockSlugs = (() => {
    if (!batchData) return [] as string[]
    // Simulated: categories with fewer products are "low stock"
    return Object.entries(countMap).filter(([, c]) => c > 0 && c < 5).map(([s]) => s)
  })()

  /* ── #9 Spotlight data ── */
  const { data: spotlightData } = useQuery({
    queryKey: ['cat-spotlight', spotlightSlug],
    queryFn: () => productService.getProducts({ category: spotlightSlug!, limit: 6, sort: 'soldCount' }).then(r => r.data.data),
    enabled: !!spotlightSlug,
    staleTime: 60000,
  })

  /* ── Hover preview ── */
  const { data: previewProducts } = useQuery({
    queryKey: ['cat-preview', hoveredSlug],
    queryFn: () => productService.getProducts({ category: hoveredSlug!, limit: 3, sort: 'soldCount' }).then(r => r.data.data),
    enabled: !!hoveredSlug && !flippedSlug,
    staleTime: 60000,
  })

  /* ── Compare data — reuse batch data ── */
  const compareData = compareList.map(slug => ({
    slug,
    total: countMap[slug] ?? 0,
    min:   priceMap[slug] ?? null,
  }))

  /* ── Scroll reveal ── */
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        cats.forEach((_, i) => setTimeout(() => setVisible(prev => { const n = [...prev]; n[i] = true; return n }), i * 55))
        obs.disconnect()
      }
    }, { threshold: 0.1 })
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  const [quickAddSlug, setQuickAddSlug] = useState<string | null>(null)

  const { data: quickAddProducts } = useQuery({
    queryKey: ['cat-quickadd', quickAddSlug],
    queryFn: () => productService.getProducts({ category: quickAddSlug!, limit: 6, sort: 'soldCount' }).then(r => r.data.data),
    enabled: !!quickAddSlug,
    staleTime: 60000,
  })
  const toggleCompare = (slug: string) => {
    if (!slug) return
    setCompareList(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : prev.length < 3 ? [...prev, slug] : prev)
  }

  const filtered = cats.filter(c =>
    !filter || c.label.toLowerCase().includes(filter.toLowerCase()) || c.sub.toLowerCase().includes(filter.toLowerCase())
  )

  /* ── #9 Keyboard navigation ── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!gridRef.current?.contains(document.activeElement) && focusIdx === -1) return
      const cols = window.innerWidth >= 1100 ? 6 : window.innerWidth >= 640 ? 4 : 2
      if (e.key === 'ArrowRight') { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, filtered.length - 1)) }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'ArrowDown')  { e.preventDefault(); setFocusIdx(i => Math.min(i + cols, filtered.length - 1)) }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setFocusIdx(i => Math.max(i - cols, 0)) }
      if (e.key === 'Enter' && focusIdx >= 0) { const cat = filtered[focusIdx]; if (cat) { trackClick(cat.slug); onCategorySelect?.(cat.slug) } }
      if (e.key === 'Escape') setFocusIdx(-1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusIdx, filtered])

  /* ── #2 Drag to reorder ── */
  const handleDragStart = (i: number) => setDragIdx(i)
  const handleDragOver  = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === i) return
    const next = [...cats]
    const [moved] = next.splice(dragIdx, 1)
    next.splice(i, 0, moved)
    setCats(next)
    setDragIdx(i)
    localStorage.setItem('hafa_cat_order', JSON.stringify(next.map(c => c.slug)))
  }
  const handleDragEnd = () => setDragIdx(null)

  return (
    <section ref={sectionRef} style={{ padding: '88px 0', background: '#f9fafb' }} id="categories">
      <div className="max-w-[1240px] mx-auto px-6">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '.78rem', fontWeight: 700, color: '#2E7D32', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '6px' }}>Shop by Category</p>
            <h2 style={{ fontSize: 'clamp(1.6rem,3vw,2.2rem)', fontWeight: 800, color: '#374151', lineHeight: 1.2 }}>
              Explore Our <span style={{ color: '#2E7D32' }}>Product Range</span>
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '2px solid #e5e7eb', borderRadius: '50px', padding: '7px 14px', transition: '.25s ease' }} className="focus-within:!border-[#2E7D32]">
              <Search size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter categories..."
                style={{ border: 'none', outline: 'none', fontSize: '.82rem', fontFamily: 'inherit', background: 'transparent', width: '130px', color: '#374151' }} />
              {filter && <button onClick={() => setFilter('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '.9rem', padding: 0 }}>×</button>}
            </div>
            {/* Compare button */}
            {compareList.length >= 2 && (
              <button onClick={() => setShowCompare(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#2E7D32', color: '#fff', border: 'none', borderRadius: '50px', padding: '8px 16px', fontSize: '.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', animation: 'catPulse 1.5s ease infinite' }}>
                <GitCompare size={14} /> Compare ({compareList.length})
              </button>
            )}
            <Link to="/products" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#2E7D32', fontWeight: 600, fontSize: '.88rem', textDecoration: 'none', whiteSpace: 'nowrap' }} className="hover:gap-3 transition-all">
              View All <ArrowRight size={15} />
            </Link>
            {/* #9 View mode toggle */}
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '50px', padding: '3px' }}>
              {(['grid', 'list'] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  style={{ background: viewMode === mode ? '#fff' : 'transparent', border: 'none', borderRadius: '50px', padding: '5px 12px', fontSize: '.75rem', fontWeight: 600, cursor: 'pointer', color: viewMode === mode ? '#2E7D32' : '#9ca3af', transition: '.2s', fontFamily: 'inherit', boxShadow: viewMode === mode ? '0 1px 4px rgba(0,0,0,.1)' : 'none' }}>
                  {mode === 'grid' ? '⊞' : '☰'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* #1 AI recommendation banner */}
        {aiRecommended && (() => {
          const rec = DEFAULT_CATS.find(c => c.slug === aiRecommended)
          if (!rec) return null
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '1px solid #c4b5fd', borderRadius: '14px', padding: '12px 16px', marginBottom: '20px' }}>
              <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>{rec.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#7c3aed', marginBottom: '2px' }}>🤖 Recommended for you</div>
                <div style={{ fontSize: '.85rem', fontWeight: 600, color: '#374151' }}>Try <strong>{rec.label}</strong> — you haven't explored it yet</div>
              </div>
              <button onClick={() => { trackClick(rec.slug); onCategorySelect?.(rec.slug) }}
                style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '50px', padding: '7px 16px', fontSize: '.78rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                Explore →
              </button>
            </div>
          )
        })()}

        {/* Grid */}
        <div ref={gridRef}
          style={{ display: viewMode === 'grid' ? 'grid' : 'flex', gridTemplateColumns: 'repeat(6,1fr)', gap: '18px', flexDirection: viewMode === 'list' ? 'column' : undefined }}
          className="cats-grid-resp">
          {filtered.map((cat, i) => {
            const isSelected  = selectedCategory === cat.slug
            const isFlipped   = flippedSlug === cat.slug
            const isTrending  = trendingSlugs.includes(cat.slug)
            const isNew       = newSlugs.includes(cat.slug) && !isTrending
            const isComparing = compareList.includes(cat.slug)
            const count       = countMap[cat.slug]
            const minPrice    = priceMap[cat.slug]
            const isFocused   = focusIdx === i
            const isRecent    = recentlyBrowsed.includes(cat.slug)
            const isAIRec     = aiRecommended === cat.slug
            const priceChange = priceChangeMap[cat.slug]
            const popularity  = count ? Math.round((count / maxCount) * 100) : 0
            const isLowStock  = lowStockSlugs.includes(cat.slug)

            return (
              <div key={cat.slug || 'all'}
                draggable={!!cat.slug}
                onDragStart={() => handleDragStart(i)}
                onDragOver={e => handleDragOver(e, i)}
                onDragEnd={handleDragEnd}
                tabIndex={cat.slug ? 0 : -1}
                onFocus={() => setFocusIdx(i)}
                onBlur={() => setFocusIdx(-1)}
                aria-label={cat.label}
                style={{
                  opacity: visible[i] ? 1 : 0,
                  transform: visible[i] ? 'translateY(0)' : 'translateY(28px)',
                  transition: `opacity .5s ease ${i * 0.05}s, transform .5s ease ${i * 0.05}s`,
                  perspective: viewMode === 'grid' ? '800px' : undefined,
                  cursor: cat.slug ? 'grab' : 'pointer',
                  ...(viewMode === 'list' ? { width: '100%' } : {}),
                }}>

                {/* Flip container — grid mode only */}
                {viewMode === 'list' ? (
                  /* ── LIST VIEW CARD ── */
                  <div onClick={() => { if (cat.slug) { trackClick(cat.slug); onCategorySelect?.(cat.slug) } }}
                    style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#fff', borderRadius: '16px', padding: '14px 18px', boxShadow: isSelected ? '0 4px 20px rgba(46,125,50,.2)' : '0 1px 3px rgba(0,0,0,.07)', border: isSelected ? '2px solid #2E7D32' : '2px solid transparent', cursor: 'pointer', transition: 'all .2s ease' }}
                    className="cat-card-item">
                    <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: `linear-gradient(135deg,${cat.c1},${cat.c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0 }}>{cat.emoji}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                        <h3 style={{ fontSize: '.9rem', fontWeight: 700, color: '#374151' }}>{cat.label}</h3>
                        {isAIRec    && <span style={{ background: '#7c3aed', color: '#fff', fontSize: '.55rem', fontWeight: 800, padding: '1px 5px', borderRadius: '50px' }}>🤖</span>}
                        {isTrending && <span style={{ background: '#ef4444', color: '#fff', fontSize: '.55rem', fontWeight: 800, padding: '1px 5px', borderRadius: '50px' }}>🔥</span>}
                        {isRecent   && <span style={{ background: '#374151', color: '#fff', fontSize: '.55rem', fontWeight: 800, padding: '1px 5px', borderRadius: '50px' }}>👁</span>}
                        {isLowStock && <span style={{ background: '#f59e0b', color: '#fff', fontSize: '.55rem', fontWeight: 800, padding: '1px 5px', borderRadius: '50px' }}>⚠️</span>}
                      </div>
                      <p style={{ fontSize: '.75rem', color: '#9ca3af', marginBottom: '4px' }}>{cat.sub}</p>
                      {popularity > 0 && (
                        <div style={{ height: '3px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden', maxWidth: '120px' }}>
                          <div style={{ height: '100%', width: `${popularity}%`, background: '#2E7D32', borderRadius: '2px' }} />
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {count > 0 && <div style={{ fontSize: '.78rem', fontWeight: 700, color: '#2E7D32' }}>{count}+ items</div>}
                      {minPrice != null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                          <span style={{ fontSize: '.75rem', color: '#6b7280' }}>From ${minPrice.toFixed(2)}</span>
                          {priceChange === 'down' && <span style={{ color: '#16a34a', fontSize: '.65rem' }}>▼</span>}
                          {priceChange === 'up'   && <span style={{ color: '#ef4444', fontSize: '.65rem' }}>▲</span>}
                        </div>
                      )}
                    </div>
                    <ArrowRight size={16} style={{ color: '#2E7D32', flexShrink: 0 }} />
                  </div>
                ) : (
                /* ── GRID FLIP CARD ── */
                <div style={{ position: 'relative', width: '100%', height: '220px', transformStyle: 'preserve-3d', transition: 'transform .55s cubic-bezier(.4,0,.2,1)', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>

                  {/* ── FRONT FACE ── */}
                  <div
                    onClick={() => { if (cat.slug) { setFlippedSlug(null); trackClick(cat.slug); onCategorySelect?.(cat.slug) } }}
                    onMouseEnter={e => {
                      if (!cat.slug) return
                      setHoveredSlug(cat.slug)
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setHoverPos({ x: r.left + r.width / 2, y: r.top })
                    }}
                    onMouseLeave={() => { setHoveredSlug(null); setHoverPos(null) }}
                    style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: '#fff', borderRadius: '20px', overflow: 'hidden', boxShadow: isSelected ? '0 8px 32px rgba(46,125,50,.25)' : isFocused ? '0 0 0 3px #2E7D32' : '0 1px 3px rgba(0,0,0,.07)', border: isSelected ? '2px solid #2E7D32' : isComparing ? '2px solid #FFA726' : '2px solid transparent', display: 'flex', flexDirection: 'column', transition: 'all .25s ease' }}
                    className="cat-card-item">

                    {/* Badges — top LEFT only, max 2 visible */}
                    <div style={{ position: 'absolute', top: '8px', left: '8px', display: 'flex', flexDirection: 'column', gap: '3px', zIndex: 3, maxWidth: '55%' }}>
                      {isAIRec    && <span style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff', fontSize: '.55rem', fontWeight: 800, padding: '2px 6px', borderRadius: '50px', letterSpacing: '.3px', whiteSpace: 'nowrap', display: 'inline-block', width: 'fit-content' }}>🤖 For You</span>}
                      {isTrending && <span style={{ background: '#ef4444', color: '#fff', fontSize: '.55rem', fontWeight: 800, padding: '2px 6px', borderRadius: '50px', whiteSpace: 'nowrap', display: 'inline-block', width: 'fit-content' }}>🔥 Hot</span>}
                      {!isTrending && isNew && <span style={{ background: '#1565c0', color: '#fff', fontSize: '.55rem', fontWeight: 800, padding: '2px 6px', borderRadius: '50px', whiteSpace: 'nowrap', display: 'inline-block', width: 'fit-content' }}>✨ New</span>}
                      {isRecent   && <span style={{ background: '#374151', color: '#fff', fontSize: '.55rem', fontWeight: 800, padding: '2px 6px', borderRadius: '50px', whiteSpace: 'nowrap', display: 'inline-block', width: 'fit-content' }}>👁 Recent</span>}
                      {isLowStock && <span style={{ background: '#f59e0b', color: '#fff', fontSize: '.55rem', fontWeight: 800, padding: '2px 6px', borderRadius: '50px', whiteSpace: 'nowrap', display: 'inline-block', width: 'fit-content' }}>⚠️ Low Stock</span>}
                    </div>

                    {/* Compare + Selected — top RIGHT only */}
                    <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', zIndex: 3 }}>
                      {isSelected && <div style={{ background: '#2E7D32', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.65rem', fontWeight: 800 }}>✓</div>}
                      {cat.slug && (
                        <div onClick={e => { e.stopPropagation(); toggleCompare(cat.slug) }}
                          title={isComparing ? 'Remove from compare' : 'Add to compare'}
                          style={{ background: isComparing ? '#FFA726' : 'rgba(255,255,255,.9)', border: `1.5px solid ${isComparing ? '#FFA726' : '#e5e7eb'}`, borderRadius: '50px', padding: '2px 7px', cursor: 'pointer', transition: '.2s', fontSize: '.6rem', fontWeight: 700, color: isComparing ? '#fff' : '#9ca3af', boxShadow: '0 1px 4px rgba(0,0,0,.1)', whiteSpace: 'nowrap' }}>
                          {isComparing ? '✓ Added' : '+ Compare'}
                        </div>
                      )}
                    </div>

                    {/* Flip button */}
                    {cat.slug && (
                      <button onClick={e => { e.stopPropagation(); setFlippedSlug(isFlipped ? null : cat.slug) }}
                        style={{ position: 'absolute', bottom: '48px', right: '8px', background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(4px)', border: 'none', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', fontSize: '.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, transition: '.2s', fontFamily: 'inherit' }}
                        title="Flip card">↻</button>
                    )}

                    {/* Quick-add button */}
                    {cat.slug && (
                      <button onClick={e => { e.stopPropagation(); setQuickAddSlug(quickAddSlug === cat.slug ? null : cat.slug) }}
                        style={{ position: 'absolute', bottom: '20px', right: '8px', background: '#2E7D32', border: 'none', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, transition: '.2s' }}
                        title="Quick add">
                        <ShoppingCart size={11} />
                      </button>
                    )}

                    {/* Image area */}
                    <div style={{ background: `linear-gradient(135deg,${cat.c1},${cat.c2})`, height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.8rem', transition: '.25s ease', overflow: 'hidden', position: 'relative', flexShrink: 0 }} className="cat-img-area">
                      {/* #8 Animated emoji on hover */}
                      <span style={{ filter: cat.special ? 'brightness(10)' : 'none', transition: '.3s ease', display: 'inline-block' }} className="cat-emoji">{cat.emoji}</span>
                      {/* Count badge */}
                      {cat.slug && (
                        <div style={{ position: 'absolute', bottom: '6px', right: '8px' }}>
                          {countMap[cat.slug] === undefined ? (
                            <div style={{ width: '48px', height: '16px', borderRadius: '50px', background: 'linear-gradient(90deg,rgba(255,255,255,.3) 25%,rgba(255,255,255,.5) 50%,rgba(255,255,255,.3) 75%)', backgroundSize: '200% 100%', animation: 'shimmerCat 1.2s ease infinite' }} />
                          ) : countMap[cat.slug] > 0 ? (
                            <span style={{ background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(4px)', color: '#fff', fontSize: '.62rem', fontWeight: 700, padding: '2px 7px', borderRadius: '50px' }}>{countMap[cat.slug]}+ items</span>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: '10px 14px', flex: 1 }}>
                      <h3 style={{ fontSize: '.88rem', fontWeight: 700, color: cat.special ? '#fff' : '#374151', marginBottom: '2px' }}>{cat.label}</h3>
                      <p style={{ fontSize: '.72rem', color: cat.special ? '#a5d6a7' : '#9ca3af', marginBottom: '4px' }}>{cat.sub}</p>
                      {/* #4 Price change + price range */}
                      {cat.slug && minPrice != null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontSize: '.7rem', color: '#2E7D32', fontWeight: 700 }}>From ${minPrice.toFixed(2)}</span>
                          {priceChange === 'down' && <span style={{ fontSize: '.62rem', color: '#16a34a', fontWeight: 800 }}>▼</span>}
                          {priceChange === 'up'   && <span style={{ fontSize: '.62rem', color: '#ef4444', fontWeight: 800 }}>▲</span>}
                        </div>
                      )}
                      {/* #5 Popularity bar */}
                      {cat.slug && popularity > 0 && (
                        <div style={{ marginTop: '6px' }}>
                          <div style={{ height: '3px', background: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${popularity}%`, background: `linear-gradient(90deg,${cat.c1 === '#fafafa' ? '#9ca3af' : cat.c2},${cat.c1 === '#fafafa' ? '#6b7280' : cat.c1})`, borderRadius: '2px', transition: 'width 1s ease' }} />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Arrow + Spotlight button */}
                    <div style={{ padding: '0 14px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ color: cat.special ? '#fff' : '#2E7D32', fontSize: '.8rem', opacity: 0, transition: '.25s ease' }} className="cat-arrow-item">
                        <i className="fas fa-arrow-right" />
                      </div>
                      {/* #7 Spotlight button */}
                      {cat.slug && (
                        <button onClick={e => { e.stopPropagation(); setSpotlightSlug(cat.slug) }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.7rem', color: '#9ca3af', padding: '2px 6px', borderRadius: '50px', transition: '.2s', fontFamily: 'inherit', opacity: 0 }}
                          className="cat-spotlight-btn" title="View spotlight">
                          ⚡ Spotlight
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── BACK FACE ── */}
                  <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', background: `linear-gradient(135deg,${cat.c1},${cat.c2})`, borderRadius: '20px', padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 20px rgba(0,0,0,.12)' }}>
                    <div>
                      <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{cat.emoji}</div>
                      <h3 style={{ fontSize: '.9rem', fontWeight: 800, color: '#374151', marginBottom: '4px' }}>{cat.label}</h3>
                      {count && <p style={{ fontSize: '.75rem', color: '#6b7280', marginBottom: '4px' }}>{count}+ products</p>}
                      {minPrice != null && <p style={{ fontSize: '.75rem', color: '#2E7D32', fontWeight: 700, marginBottom: '8px' }}>From ${minPrice.toFixed(2)}</p>}
                      {isTrending && <span style={{ background: '#ef4444', color: '#fff', fontSize: '.62rem', fontWeight: 800, padding: '2px 8px', borderRadius: '50px' }}>🔥 Trending Now</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <Link to={`/products?category=${cat.slug}`}
                        style={{ display: 'block', textAlign: 'center', background: '#2E7D32', color: '#fff', padding: '8px', borderRadius: '50px', fontSize: '.8rem', fontWeight: 700, textDecoration: 'none' }}>
                        Shop Now →
                      </Link>
                      <button onClick={e => { e.stopPropagation(); setFlippedSlug(null) }}
                        style={{ background: 'rgba(0,0,0,.1)', border: 'none', borderRadius: '50px', padding: '6px', fontSize: '.75rem', cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
                        ← Back
                      </button>
                    </div>
                  </div>
                </div>
                )} {/* end grid/list ternary */}
              </div>
            )
          })}

          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🔍</div>
              <p style={{ fontWeight: 600 }}>No categories match "{filter}"</p>
            </div>
          )}
        </div>

        {/* ── Hover preview popup — fixed position to escape overflow:hidden ── */}
        {hoveredSlug && hoverPos && !flippedSlug && (() => {
          const cat = cats.find(c => c.slug === hoveredSlug)
          if (!cat) return null
          return (
            <div style={{ position: 'fixed', top: hoverPos.y - 10, left: hoverPos.x, transform: 'translate(-50%, -100%)', width: '220px', background: '#fff', borderRadius: '14px', boxShadow: '0 12px 40px rgba(0,0,0,.18)', border: '1px solid #f3f4f6', zIndex: 9999, padding: '12px', animation: 'catPopIn .2s ease', pointerEvents: 'none' }}>
              <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Top in {cat.label}</div>
              {previewProducts?.length ? previewProducts.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid #f9fafb' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                    {p.images?.[0] ? <img src={p.images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} alt="" /> : cat.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '.78rem', fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    <div style={{ fontSize: '.72rem', color: '#2E7D32', fontWeight: 700 }}>${p.price.toFixed(2)}</div>
                  </div>
                </div>
              )) : Array.from({ length: 3 }).map((_, si) => (
                <div key={si} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9ecef 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmerCat 1.2s ease infinite', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: '10px', borderRadius: '4px', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9ecef 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmerCat 1.2s ease infinite', marginBottom: '5px', width: '70%' }} />
                    <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9ecef 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmerCat 1.2s ease infinite', width: '35%' }} />
                  </div>
                </div>
              ))}
              <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '.78rem', color: '#2E7D32', fontWeight: 700, padding: '6px', borderRadius: '8px', background: '#f0fdf4' }}>
                View all {cat.label} →
              </div>
              <div style={{ position: 'absolute', bottom: '-6px', left: '50%', width: '12px', height: '12px', background: '#fff', border: '1px solid #f3f4f6', borderTop: 'none', borderLeft: 'none', transform: 'translateX(-50%) rotate(45deg)' }} />
            </div>
          )
        })()}

        {/* ── Quick-add product picker modal ── */}
        {quickAddSlug && (() => {
          const cat = cats.find(c => c.slug === quickAddSlug)
          if (!cat) return null
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
              onClick={() => setQuickAddSlug(null)}>
              <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', maxWidth: '480px', width: '100%', boxShadow: '0 25px 80px rgba(0,0,0,.25)', animation: 'catPopIn .2s ease' }}
                onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.8rem' }}>{cat.emoji}</span>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#374151' }}>{cat.label}</h3>
                      <p style={{ fontSize: '.75rem', color: '#9ca3af' }}>Pick products to add to cart</p>
                    </div>
                  </div>
                  <button onClick={() => setQuickAddSlug(null)} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={16} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                  {quickAddProducts?.length ? quickAddProducts.map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', border: '1px solid #f3f4f6', transition: '.2s' }} className="hover:bg-gray-50">
                      <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                        {p.images?.[0] ? <img src={p.images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} alt="" /> : cat.emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '.88rem', fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: '.78rem', color: '#9ca3af' }}>by {p.seller.storeName}</div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '.9rem', fontWeight: 800, color: '#2E7D32' }}>${p.price.toFixed(2)}</div>
                        <button onClick={() => { add(p); setQuickAddSlug(null) }}
                          style={{ background: '#2E7D32', color: '#fff', border: 'none', borderRadius: '50px', padding: '4px 12px', fontSize: '.75rem', fontWeight: 700, cursor: 'pointer', marginTop: '4px', fontFamily: 'inherit' }}>
                          + Add
                        </button>
                      </div>
                    </div>
                  )) : Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', border: '1px solid #f3f4f6' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9ecef 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmerCat 1.2s ease infinite', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ height: '12px', borderRadius: '4px', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9ecef 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmerCat 1.2s ease infinite', marginBottom: '6px', width: '60%' }} />
                        <div style={{ height: '10px', borderRadius: '4px', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9ecef 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmerCat 1.2s ease infinite', width: '40%' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <Link to={`/products?category=${quickAddSlug}`} onClick={() => setQuickAddSlug(null)}
                  style={{ display: 'block', textAlign: 'center', marginTop: '16px', padding: '10px', background: '#f0fdf4', borderRadius: '50px', fontSize: '.85rem', color: '#2E7D32', fontWeight: 700, textDecoration: 'none' }}>
                  View all {cat.label} →
                </Link>
              </div>
            </div>
          )
        })()}


        {/* ── #7 Category Spotlight modal ── */}
        {spotlightSlug && (() => {
          const cat = cats.find(c => c.slug === spotlightSlug)
          if (!cat) return null
          return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9998, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
              onClick={() => setSpotlightSlug(null)}>
              <div style={{ width: '100%', maxWidth: '900px', background: '#fff', borderRadius: '24px 24px 0 0', padding: '32px', boxShadow: '0 -20px 60px rgba(0,0,0,.2)', animation: 'spotlightIn .35s ease', maxHeight: '80vh', overflowY: 'auto' }}
                onClick={e => e.stopPropagation()}>
                {/* Hero */}
                <div style={{ background: `linear-gradient(135deg,${cat.c1},${cat.c2})`, borderRadius: '16px', padding: '32px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ fontSize: '5rem', lineHeight: 1 }}>{cat.emoji}</div>
                  <div>
                    <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#374151', marginBottom: '6px' }}>{cat.label}</h2>
                    <p style={{ fontSize: '.9rem', color: '#6b7280', marginBottom: '12px' }}>{cat.sub}</p>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      {countMap[cat.slug] > 0 && <span style={{ background: 'rgba(255,255,255,.8)', borderRadius: '50px', padding: '4px 12px', fontSize: '.78rem', fontWeight: 700, color: '#2E7D32' }}>{countMap[cat.slug]}+ products</span>}
                      {priceMap[cat.slug] != null && <span style={{ background: 'rgba(255,255,255,.8)', borderRadius: '50px', padding: '4px 12px', fontSize: '.78rem', fontWeight: 700, color: '#FFA726' }}>From ${priceMap[cat.slug]!.toFixed(2)}</span>}
                      {trendingSlugs.includes(cat.slug) && <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50px', padding: '4px 12px', fontSize: '.78rem', fontWeight: 700 }}>🔥 Trending</span>}
                    </div>
                  </div>
                  <button onClick={() => setSpotlightSlug(null)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(255,255,255,.8)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={15} /></button>
                </div>
                {/* Top products */}
                <h3 style={{ fontSize: '.9rem', fontWeight: 800, color: '#374151', marginBottom: '14px' }}>Top Products in {cat.label}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '20px' }}>
                  {spotlightData?.length ? spotlightData.map(p => (
                    <Link key={p.id} to={`/products/${p.slug}`} onClick={() => setSpotlightSlug(null)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#f9fafb', borderRadius: '12px', textDecoration: 'none', transition: '.2s', border: '1px solid #f3f4f6' }} className="hover:bg-green-50 hover:border-green-200">
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>
                        {p.images?.[0] ? <img src={p.images[0]} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} alt="" /> : cat.emoji}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '.8rem', fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: '.75rem', color: '#2E7D32', fontWeight: 700 }}>${p.price.toFixed(2)}</div>
                      </div>
                    </Link>
                  )) : Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#f9fafb', borderRadius: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9ecef 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmerCat 1.2s ease infinite', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ height: '10px', borderRadius: '4px', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9ecef 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmerCat 1.2s ease infinite', marginBottom: '5px', width: '70%' }} />
                        <div style={{ height: '8px', borderRadius: '4px', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9ecef 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmerCat 1.2s ease infinite', width: '35%' }} />
                      </div>
                    </div>
                  ))}
                </div>
                <Link to={`/products?category=${cat.slug}`} onClick={() => setSpotlightSlug(null)}
                  style={{ display: 'block', textAlign: 'center', background: '#2E7D32', color: '#fff', padding: '14px', borderRadius: '50px', fontSize: '.9rem', fontWeight: 700, textDecoration: 'none' }}>
                  Shop All {cat.label} →
                </Link>
              </div>
              {/* Dark backdrop */}
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: -1 }} />
            </div>
          )
        })()}

        {/* ── #11 Compare modal ── */}
        {showCompare && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
            onClick={() => setShowCompare(false)}>
            <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', maxWidth: '760px', width: '100%', boxShadow: '0 25px 80px rgba(0,0,0,.3)', animation: 'compareIn .25s ease', maxHeight: '90vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#374151' }}>Category Comparison</h3>
                  <p style={{ fontSize: '.78rem', color: '#9ca3af', marginTop: '2px' }}>Side-by-side overview of selected categories</p>
                </div>
                <button onClick={() => setShowCompare(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><X size={16} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${compareList.length}, 1fr)`, gap: '16px' }}>
                {compareList.map(slug => {
                  const cat      = cats.find(c => c.slug === slug)!
                  const total    = countMap[slug] ?? 0
                  const minPrice = priceMap[slug]
                  const isTrend  = trendingSlugs.includes(slug)
                  const isNewCat = newSlugs.includes(slug)
                  return (
                    <div key={slug} style={{ textAlign: 'center', padding: '20px 16px', background: '#f9fafb', borderRadius: '16px', border: isTrend ? '2px solid #ef4444' : '2px solid #e5e7eb', position: 'relative' }}>
                      {isTrend && <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#ef4444', color: '#fff', fontSize: '.62rem', fontWeight: 800, padding: '2px 10px', borderRadius: '50px', whiteSpace: 'nowrap' }}>🔥 Trending</span>}
                      {isNewCat && !isTrend && <span style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#1565c0', color: '#fff', fontSize: '.62rem', fontWeight: 800, padding: '2px 10px', borderRadius: '50px', whiteSpace: 'nowrap' }}>✨ New</span>}
                      <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: `linear-gradient(135deg,${cat.c1},${cat.c2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 10px' }}>{cat.emoji}</div>
                      <h4 style={{ fontWeight: 800, color: '#374151', marginBottom: '16px', fontSize: '.9rem' }}>{cat.label}</h4>
                      {[
                        { label: 'Products',      value: total    ? `${total}+`                        : '—', color: '#2E7D32' },
                        { label: 'Starting from', value: minPrice != null ? `$${minPrice.toFixed(2)}` : '—', color: '#FFA726' },
                        { label: 'Status',        value: isTrend  ? '🔥 Trending' : isNewCat ? '✨ New' : '✅ Regular', color: isTrend ? '#ef4444' : isNewCat ? '#1565c0' : '#6b7280' },
                        { label: 'Avg Rating',    value: '4.7 ★', color: '#f59e0b' },
                      ].map(row => (
                        <div key={row.label} style={{ background: '#fff', borderRadius: '10px', padding: '10px', marginBottom: '8px', textAlign: 'left' }}>
                          <div style={{ fontSize: '.68rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '3px' }}>{row.label}</div>
                          <div style={{ fontSize: '.88rem', fontWeight: 800, color: row.color }}>{row.value}</div>
                        </div>
                      ))}
                      <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
                        <Link to={`/products?category=${slug}`} onClick={() => setShowCompare(false)}
                          style={{ flex: 1, display: 'block', textAlign: 'center', background: '#2E7D32', color: '#fff', padding: '8px', borderRadius: '50px', fontSize: '.78rem', fontWeight: 700, textDecoration: 'none' }}>
                          Shop →
                        </Link>
                        <button onClick={() => setCompareList(prev => prev.filter(s => s !== slug))}
                          style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <button onClick={() => { setCompareList([]); setShowCompare(false) }}
                style={{ display: 'block', width: '100%', marginTop: '20px', background: '#f3f4f6', border: 'none', borderRadius: '50px', padding: '10px', fontSize: '.85rem', fontWeight: 600, cursor: 'pointer', color: '#6b7280', fontFamily: 'inherit' }}>
                Clear comparison
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .cat-card-item:hover { transform: translateY(-6px); box-shadow: 0 8px 40px rgba(0,0,0,.14) !important; border-color: #A5D6A7 !important; }
        .cat-card-item:hover .cat-img-area { transform: scale(1.05); }
        .cat-card-item:hover .cat-emoji { transform: scale(1.2) rotate(-5deg) !important; }
        .cat-card-item:hover .cat-arrow-item { opacity: 1 !important; }
        @keyframes shimmerCat  { 0%,100%{background-position:200% 0} 50%{background-position:-200% 0} }
        @keyframes catPopIn    { from{opacity:0;transform:translateX(-50%) translateY(6px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes compareIn   { from{opacity:0;transform:scale(.95) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes spotlightIn { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
        .cat-card-item:hover .cat-spotlight-btn { opacity: 1 !important; }
        @keyframes catPulse    { 0%,100%{box-shadow:0 0 0 0 rgba(46,125,50,.4)} 50%{box-shadow:0 0 0 6px rgba(46,125,50,0)} }
        @media(max-width:1100px) { .cats-grid-resp { grid-template-columns: repeat(4,1fr) !important; } }
        @media(max-width:640px)  { .cats-grid-resp { grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>
    </section>
  )
}
