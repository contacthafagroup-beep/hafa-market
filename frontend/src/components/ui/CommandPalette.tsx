import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ShoppingBag, Tag, Users, LayoutDashboard, FileText, Heart, Package, Home, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { productService } from '@/services/product.service'

const STATIC_ACTIONS = [
  { id: 'home',       label: 'Go to Home',          icon: <Home size={15} />,          action: '/',                  group: 'Pages' },
  { id: 'products',   label: 'Browse All Products',  icon: <ShoppingBag size={15} />,   action: '/products',          group: 'Pages' },
  { id: 'sellers',    label: 'Top Sellers',           icon: <Users size={15} />,         action: '/sellers',           group: 'Pages' },
  { id: 'blog',       label: 'Farm Blog',             icon: <FileText size={15} />,      action: '/blog',              group: 'Pages' },
  { id: 'wishlist',   label: 'My Wishlist',           icon: <Heart size={15} />,         action: '/account/wishlist',  group: 'Account' },
  { id: 'orders',     label: 'My Orders',             icon: <Package size={15} />,       action: '/account/orders',    group: 'Account' },
  { id: 'dashboard',  label: 'Seller Dashboard',      icon: <LayoutDashboard size={15}/>,action: '/dashboard',         group: 'Account' },
  { id: 'veg',        label: 'Shop Vegetables',       icon: <span>🥬</span>,             action: '/products?category=vegetables', group: 'Categories' },
  { id: 'fruits',     label: 'Shop Fruits',           icon: <span>🍎</span>,             action: '/products?category=fruits',     group: 'Categories' },
  { id: 'grains',     label: 'Shop Grains',           icon: <span>🌾</span>,             action: '/products?category=grains',     group: 'Categories' },
  { id: 'coffee',     label: 'Shop Coffee',           icon: <span>☕</span>,             action: '/products?category=coffee',     group: 'Categories' },
  { id: 'deals',      label: "Today's Deals",         icon: <Tag size={15} />,           action: '/products?sort=soldCount',      group: 'Categories' },
]

interface CommandPaletteProps { open: boolean; onClose: () => void }

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef  = useRef<HTMLDivElement>(null)

  const { data: productResults } = useQuery({
    queryKey: ['cmd-search', query],
    queryFn: () => productService.getProducts({ search: query, limit: 5 }).then(r => r.data.data),
    enabled: query.length >= 2,
    staleTime: 30000,
  })

  const filtered = query.length < 1
    ? STATIC_ACTIONS
    : STATIC_ACTIONS.filter(a => a.label.toLowerCase().includes(query.toLowerCase()))

  const productItems = (productResults ?? []).map(p => ({
    id: p.id, label: p.name, icon: <span>🛒</span>,
    action: `/products/${p.slug}`, group: 'Products',
    sub: `$${p.price.toFixed(2)}`,
  }))

  const allItems = [...productItems, ...filtered]

  useEffect(() => { if (open) { setQuery(''); setSelected(0); setTimeout(() => inputRef.current?.focus(), 50) } }, [open])
  useEffect(() => { setSelected(0) }, [query])

  const execute = useCallback((item: typeof allItems[0]) => {
    navigate(item.action)
    onClose()
  }, [navigate, onClose])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, allItems.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
      if (e.key === 'Enter' && allItems[selected]) execute(allItems[selected])
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, allItems, selected, execute, onClose])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`) as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!open) return null

  // Group items
  const groups: Record<string, typeof allItems> = {}
  allItems.forEach(item => {
    const g = (item as { group?: string }).group ?? 'Results'
    if (!groups[g]) groups[g] = []
    groups[g].push(item)
  })

  let globalIdx = 0

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '12vh', background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)', animation: 'cmdFadeIn .15s ease' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>

      <div style={{ width: '100%', maxWidth: '580px', background: '#fff', borderRadius: '16px', boxShadow: '0 25px 80px rgba(0,0,0,.3)', overflow: 'hidden', animation: 'cmdSlideIn .18s ease', margin: '0 16px' }}>

        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <Search size={18} style={{ color: '#9ca3af', flexShrink: 0 }} />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search products, pages, categories..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '1rem', color: '#111827', fontFamily: 'inherit', background: 'transparent' }} />
          {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}><X size={16} /></button>}
          <kbd style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '2px 8px', fontSize: '.72rem', color: '#6b7280', fontFamily: 'inherit', flexShrink: 0 }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: '420px', overflowY: 'auto' }}>
          {allItems.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '.9rem' }}>
              No results for "<strong>{query}</strong>"
            </div>
          ) : (
            Object.entries(groups).map(([group, items]) => (
              <div key={group}>
                <div style={{ padding: '8px 20px 4px', fontSize: '.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px' }}>{group}</div>
                {items.map(item => {
                  const idx = globalIdx++
                  const isSelected = idx === selected
                  return (
                    <div key={item.id} data-idx={idx}
                      onMouseEnter={() => setSelected(idx)}
                      onClick={() => execute(item)}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', cursor: 'pointer', background: isSelected ? '#f0fdf4' : 'transparent', borderLeft: isSelected ? '3px solid #2E7D32' : '3px solid transparent', transition: '.1s' }}>
                      <span style={{ color: isSelected ? '#2E7D32' : '#6b7280', flexShrink: 0, display: 'flex' }}>{item.icon}</span>
                      <span style={{ flex: 1, fontSize: '.88rem', fontWeight: 500, color: isSelected ? '#1b5e20' : '#374151' }}>{item.label}</span>
                      {(item as { sub?: string }).sub && <span style={{ fontSize: '.78rem', color: '#2E7D32', fontWeight: 700 }}>{(item as { sub?: string }).sub}</span>}
                      {isSelected && <kbd style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: '4px', padding: '1px 6px', fontSize: '.68rem', color: '#2E7D32' }}>↵</kbd>}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: '16px', fontSize: '.72rem', color: '#9ca3af' }}>
          <span><kbd style={{ background: '#f3f4f6', borderRadius: '4px', padding: '1px 5px', marginRight: '4px' }}>↑↓</kbd>navigate</span>
          <span><kbd style={{ background: '#f3f4f6', borderRadius: '4px', padding: '1px 5px', marginRight: '4px' }}>↵</kbd>select</span>
          <span><kbd style={{ background: '#f3f4f6', borderRadius: '4px', padding: '1px 5px', marginRight: '4px' }}>ESC</kbd>close</span>
        </div>
      </div>

      <style>{`
        @keyframes cmdFadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes cmdSlideIn { from{opacity:0;transform:translateY(-12px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>
    </div>
  )
}
