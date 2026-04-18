import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ShoppingCart, Heart, Search, Menu, X, ChevronDown, User, LogOut, Package, Wallet, LayoutDashboard, MapPin, Bell, Clock, Globe, Camera } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { useCart } from '@/hooks/useCart'
import { useSelector, useDispatch } from 'react-redux'
import { setMobileMenu } from '@/store/slices/uiSlice'
import type { RootState } from '@/store'
import { useQuery } from '@tanstack/react-query'
import { productService } from '@/services/product.service'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import VisualSearch from '@/components/ui/VisualSearch'


const CATEGORIES = [
  { label: 'Vegetables',            slug: 'vegetables', emoji: '🥬' },
  { label: 'Fruits',                slug: 'fruits',     emoji: '🍎' },
  { label: 'Grains',                slug: 'grains',     emoji: '🌾' },
  { label: 'Legumes',               slug: 'legumes',    emoji: '🫘' },
  { label: 'Spices & Herbs',        slug: 'spices',     emoji: '🌿' },
  { label: 'Poultry & Dairy',       slug: 'poultry',    emoji: '🥚' },
  { label: 'Livestock & Meat',      slug: 'meat',       emoji: '🥩' },
  { label: 'Coffee & Beverages',    slug: 'coffee',     emoji: '☕' },
  { label: 'Specialty Products',    slug: 'specialty',  emoji: '🍯' },
  { label: 'Processed & Ready',     slug: 'processed',  emoji: '🍲' },
  { label: 'Household & Essentials',slug: 'household',  emoji: '🏠' },
  { label: 'Services (አገልግሎት)',   slug: 'services',   emoji: '🚚' },
]

const MEGA_COLS = [
  { sections: [{ title: '🥬 Vegetables', rows: [
    { label:'Tomatoes',slug:'vegetables'},{ label:'Onions',slug:'vegetables'},
    { label:'Cabbage',slug:'vegetables'},{ label:'Carrots',slug:'vegetables'},
    { label:'Potatoes',slug:'vegetables'},{ label:'Peppers',slug:'vegetables'},
    { label:'Spinach & Kale',slug:'vegetables'},{ label:'Garlic',slug:'vegetables'},
  ]}]},
  { sections: [{ title: '🍎 Fruits', rows: [
    { label:'Avocado',slug:'fruits'},{ label:'Banana',slug:'fruits'},
    { label:'Mango',slug:'fruits'},{ label:'Papaya',slug:'fruits'},
    { label:'Pineapple',slug:'fruits'},{ label:'Orange & Lemon',slug:'fruits'},
    { label:'Watermelon',slug:'fruits'},{ label:'Guava & Grapes',slug:'fruits'},
  ]}]},
  { sections: [{ title: '🌾 Grains & Legumes', rows: [
    { label:'Teff',slug:'grains'},{ label:'Wheat',slug:'grains'},
    { label:'Maize',slug:'grains'},{ label:'Barley & Sorghum',slug:'grains'},
    { label:'Beans & Lentils',slug:'legumes'},{ label:'Chickpeas & Peas',slug:'legumes'},
    { label:'Soybeans',slug:'legumes'},{ label:'Spices & Herbs',slug:'spices'},
  ]}]},
  { sections: [
    { title: '🥚 Poultry, Dairy & Meat', rows: [
      { label:'Eggs',slug:'poultry'},{ label:'Milk',slug:'poultry'},
      { label:'Chicken',slug:'poultry'},{ label:'Beef & Mutton',slug:'meat'},
      { label:'Goat Meat',slug:'meat'},
    ]},
    { title: '☕ Coffee & Beverages', rows: [
      { label:'Roasted Coffee',slug:'coffee'},{ label:'Raw Coffee',slug:'coffee'},
    ]},
  ]},
  { sections: [
    { title: '⭐ Specialty Products', rows: [
      { label:'Honey',slug:'specialty'},{ label:'Moringa',slug:'specialty'},{ label:'Aloe Vera',slug:'specialty'},
    ]},
    { title: '🍲 Processed Foods', rows: [
      { label:'ዶሮ ወጥ (Doro Wot)',slug:'processed'},{ label:'Processed Chicken',slug:'processed'},{ label:'Snacks',slug:'processed'},
    ]},
    { title: '🏠 Household & Services', rows: [
      { label:'Cleaning Products',slug:'household'},{ label:'Delivery & Logistics',slug:'services'},
    ]},
  ]},
]

const TRENDING = ['organic tomatoes','ethiopian coffee','teff grain','fresh avocado','pure honey']

const RECENTLY_VIEWED = [
  { name:'Fresh Tomatoes', price:'$1.99', emoji:'🍅', slug:'tomatoes' },
  { name:'Pure Honey',     price:'$8.99', emoji:'🍯', slug:'honey'    },
  { name:'Teff 2kg',       price:'$5.99', emoji:'🌾', slug:'teff'     },
]

/* ── Real-time location detector ── */
function DeliverTo() {
  const [city, setCity] = useState('Detecting...')
  const [country, setCountry] = useState('')

  useEffect(() => {
    // Check localStorage cache first (valid for 1 hour)
    const cached = localStorage.getItem('hafa_location')
    if (cached) {
      try {
        const { city: c, country: co, ts } = JSON.parse(cached)
        if (Date.now() - ts < 3600000) { setCity(c); setCountry(co); return }
      } catch {}
    }

    if (!navigator.geolocation) { setCity('Hossana'); setCountry('ET'); return }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'HafaMarket/1.0' } }
          )
          const data = await res.json()
          const addr = data.address
          const c = addr.city || addr.town || addr.village || addr.county || 'Your Area'
          const co = addr.country_code?.toUpperCase() || ''
          setCity(c); setCountry(co)
          localStorage.setItem('hafa_location', JSON.stringify({ city: c, country: co, ts: Date.now() }))
        } catch {
          setCity('Hossana'); setCountry('ET')
        }
      },
      () => { setCity('Hossana'); setCountry('ET') },
      { timeout: 5000 }
    )
  }, [])

  return (
    <div className="hidden lg:flex" style={{ alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 10px', borderRadius: '12px', transition: '.25s ease' }}>
      <MapPin size={17} style={{ color: '#2E7D32', flexShrink: 0 }} />
      <div style={{ lineHeight: 1 }}>
        <span style={{ display: 'block', fontSize: '.65rem', color: '#9ca3af' }}>Deliver to</span>
        <span style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, color: '#374151' }}>
          {city}{country ? `, ${country}` : ''}
        </span>
      </div>
    </div>
  )
}

export default function Header({ onOpenCmd }: { onOpenCmd?: () => void }) {
  const { t, i18n } = useTranslation()
  const { user, isAuthenticated, logout } = useAuth()
  const { count, open: openCart } = useCart()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const isCheckout = location.pathname === '/checkout'
  const mobileOpen = useSelector((s: RootState) => s.ui.mobileMenuOpen)

  const [search, setSearch]               = useState('')
  const [searchFocus, setSearchFocus]     = useState(false)
  const [voiceActive, setVoiceActive]     = useState(false)
  const [visualSearchOpen, setVisualSearchOpen] = useState(false)
  const [megaOpen, setMegaOpen]           = useState(false)
  const [userMenuOpen, setUserMenuOpen]   = useState(false)
  const [cartHover, setCartHover]         = useState(false)
  const [notifOpen, setNotifOpen]         = useState(false)
  const [scrolled, setScrolled]           = useState(false)
  const [scrollY, setScrollY]             = useState(0)
  const [cartBounce, setCartBounce]       = useState(false)
  const [searchDebounce, setSearchDebounce] = useState('')
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('hafa_recent_searches') || '[]') } catch { return [] }
  })

  /* ── Real user notifications ── */
  const { data: notifData } = useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.get('/notifications?limit=5').then(r => r.data.data),
    enabled: isAuthenticated,
    staleTime: 30000,
    refetchInterval: 60000,
  })
  const NOTIFICATIONS = notifData?.length > 0
    ? notifData.map((n: any) => ({
        icon: n.type === 'ORDER' ? '📦' : n.type === 'PROMO' ? '🎁' : n.type === 'DELIVERY' ? '🚚' : '🔔',
        text: n.body || n.title,
        time: new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        unread: !n.isRead,
      }))
    : [
        { icon: '🔥', text: 'Flash sale! 40% off vegetables today only', time: 'now', unread: true },
        { icon: '🎁', text: 'Use code HAFA10 for 10% off your first order', time: '1h ago', unread: false },
      ]
  const unreadCount = NOTIFICATIONS.filter((n: any) => n.unread).length

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef   = useRef<HTMLDivElement>(null)
  const navRef      = useRef<HTMLElement>(null)
  const notifRef    = useRef<HTMLDivElement>(null)
  const megaRef     = useRef<HTMLDivElement>(null)
  const prevCount   = useRef(count)

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearchDebounce(val), 300)
  }, [])

  const saveRecentSearch = (term: string) => {
    const updated = [term, ...recentSearches.filter(s => s !== term)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('hafa_recent_searches', JSON.stringify(updated))
  }

  const { data: searchResults, isFetching: searchLoading } = useQuery({
    queryKey: ['search-autocomplete', searchDebounce],
    queryFn:  () => api.get('/search/autocomplete', { params: { q: searchDebounce } }).then(r => r.data.data),
    enabled:  searchDebounce.length >= 2,
    staleTime: 30000,
  })

  useEffect(() => {
    const fn = () => { setScrolled(window.scrollY > 10); setScrollY(window.scrollY) }
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    if (count > prevCount.current) { setCartBounce(true); setTimeout(() => setCartBounce(false), 600) }
    prevCount.current = count
  }, [count])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchFocus(false)
      if (navRef.current && !navRef.current.contains(e.target as Node)) setMegaOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => { setMegaOpen(false) }, [location.pathname])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMegaOpen(false); setSearchFocus(false); setNotifOpen(false) }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (search.trim()) { saveRecentSearch(search.trim()); navigate(`/products?search=${encodeURIComponent(search)}`); setSearchFocus(false) }
  }

  /* ── #1 AI search suggestion + Ethiopian intent graph ── */
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [intentData, setIntentData] = useState<any>(null)
  const aiSugRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchDebounce.length < 2) { setAiSuggestion(null); setIntentData(null); return }
    if (aiSugRef.current) clearTimeout(aiSugRef.current)
    aiSugRef.current = setTimeout(async () => {
      try {
        // Check Ethiopian intent graph first (fast, no AI cost)
        const intentRes = await api.get('/search/intent-graph', { params: { q: searchDebounce } })
        const intent = intentRes.data.data
        if (intent?.terms?.length) {
          setIntentData(intent)
          setAiSuggestion(null) // intent graph takes priority
          return
        }
      } catch {}

      // Fall back to Groq AI suggestion for complex queries
      if (searchDebounce.length < 3) return
      try {
        const res = await api.post('/ai/chat', {
          message: `The user typed "${searchDebounce}" in a search box on an Ethiopian agricultural marketplace. In ONE short sentence (max 8 words), suggest a better or related search query. Reply with ONLY the suggestion, no explanation, no quotes.`,
          language: 'en', history: [],
        })
        const suggestion = res.data.data.reply?.trim()
        if (suggestion && suggestion.toLowerCase() !== searchDebounce.toLowerCase()) {
          setAiSuggestion(suggestion)
        }
      } catch { setAiSuggestion(null) }
    }, 600)
    return () => { if (aiSugRef.current) clearTimeout(aiSugRef.current) }
  }, [searchDebounce])

  const handleVoiceSearch = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = false
    setVoiceActive(true)
    rec.onresult = (e: any) => { const t = e.results[0][0].transcript; setSearch(t); handleSearchChange(t); setSearchFocus(true) }
    rec.onend = () => setVoiceActive(false)
    rec.onerror = () => setVoiceActive(false)
    rec.start()
  }

  return (
    <header className={cn('sticky top-0 z-[1000] transition-all duration-300')}
      style={{ background: scrolled ? 'rgba(255,255,255,0.97)' : '#fff', backdropFilter: scrolled ? 'blur(12px)' : 'none', boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,.08)' : 'none' }}>

      {/* Announcement ticker */}
      <div style={{ background: '#1b5e20', color: '#fff', fontSize: '.82rem', overflow: 'hidden', maxHeight: scrollY > 60 ? '0' : '38px', opacity: scrollY > 60 ? 0 : 1, transition: 'max-height .35s ease, opacity .35s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '38px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: '80px', animation: 'tickerScroll 32s linear infinite', whiteSpace: 'nowrap' }}>
            {['🎉 Free delivery on orders over $50 — Use code HAFA10 for 10% off',
              '🔥 Flash Sale: 40% off all organic vegetables today!',
              '🌿 500+ verified farmers | 10,000+ fresh products | 30+ cities',
              '📦 24–48 hour delivery — Track your order in real-time',
            ].map((msg, i) => <span key={i} style={{ paddingLeft: i === 0 ? '100vw' : 0 }}>{msg}</span>)}
          </div>
        </div>
      </div>

      {/* Main header */}
      <div style={{ padding: scrolled ? '7px 0' : '12px 0', borderBottom: '1px solid #f3f4f6', transition: 'padding .3s ease' }}>
        <div className="max-w-[1240px] mx-auto px-6" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: '20px' }}>

          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, textDecoration: 'none' }}>
            <div style={{ width: scrolled ? '34px' : '42px', height: scrolled ? '34px' : '42px', background: 'linear-gradient(135deg,#2E7D32,#388e3c)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: scrolled ? '1rem' : '1.3rem', boxShadow: '0 3px 10px rgba(46,125,50,.3)', flexShrink: 0, transition: 'all .3s ease' }}>🌿</div>
            <div>
              <span style={{ display: 'block', fontSize: scrolled ? '.95rem' : '1.2rem', fontWeight: 800, color: '#111827', lineHeight: 1, transition: 'font-size .3s ease' }}>Hafa <em style={{ color: '#2E7D32', fontStyle: 'normal' }}>Market</em></span>
              <span style={{ display: 'block', fontSize: '.65rem', color: '#9ca3af', fontWeight: 500, letterSpacing: '.5px', maxHeight: scrolled ? '0' : '20px', overflow: 'hidden', transition: 'max-height .3s ease' }}>Farm Fresh Delivered</span>
            </div>
          </Link>

          {/* Search */}
          <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: '640px' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', background: searchFocus ? '#fff' : '#f3f4f6', borderRadius: '50px', overflow: 'hidden', border: `2px solid ${searchFocus ? '#2E7D32' : 'transparent'}`, transition: 'all .25s ease', boxShadow: searchFocus ? '0 0 0 4px rgba(46,125,50,.08)' : 'none' } as React.CSSProperties}>
              <select className="hidden md:block" style={{ background: '#A5D6A7', border: 'none', padding: '11px 14px', fontSize: '.78rem', fontFamily: 'inherit', color: '#1b5e20', fontWeight: 600, cursor: 'pointer', outline: 'none', borderRight: '1px solid rgba(46,125,50,.2)', flexShrink: 0 }}>
                <option value="">All Categories</option>
                {CATEGORIES.map(c => <option key={c.slug} value={c.slug}>{c.label}</option>)}
              </select>
              <input value={search} onChange={e => handleSearchChange(e.target.value)} onFocus={() => setSearchFocus(true)}
                placeholder="Search products, brands, farmers..." aria-label="Search"
                style={{ flex: 1, border: 'none', background: 'transparent', padding: '11px 16px', fontSize: '.9rem', fontFamily: 'inherit', outline: 'none', minWidth: 0 }} />
              {!searchFocus && onOpenCmd && (
                <button type="button" onClick={onOpenCmd} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 8px', flexShrink: 0 }}>
                  <kbd style={{ background: '#e5e7eb', border: '1px solid #d1d5db', borderRadius: '5px', padding: '2px 6px', fontSize: '.68rem', color: '#6b7280', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Ctrl K</kbd>
                </button>
              )}
              {searchLoading && <div style={{ width: '16px', height: '16px', border: '2px solid #e5e7eb', borderTopColor: '#2E7D32', borderRadius: '50%', animation: 'headerSpin .6s linear infinite', marginRight: '4px', flexShrink: 0 }} />}
              <button type="button" onClick={handleVoiceSearch} title="Voice search"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', flexShrink: 0, display: 'flex', alignItems: 'center', color: voiceActive ? '#ef4444' : '#9ca3af' }}>
                <i className={`fas fa-microphone${voiceActive ? '-slash' : ''}`} style={{ fontSize: '.9rem' }} />
              </button>
              {/* Visual Search button */}
              <button type="button" onClick={() => setVisualSearchOpen(true)} title="Visual search — search by photo"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 6px', flexShrink: 0, display: 'flex', alignItems: 'center', color: '#9ca3af' }}
                className="hover:text-purple-500 transition-colors">
                <Camera size={16} />
              </button>
              <button type="submit" style={{ background: '#FFA726', border: 'none', padding: '11px 20px', color: '#fff', cursor: 'pointer', fontSize: '1rem', transition: '.25s ease', flexShrink: 0 }}>
                <Search size={16} />
              </button>
            </form>

            {/* Progressive search dropdown */}
            {searchFocus && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, background: '#fff', borderRadius: '12px', boxShadow: '0 8px 40px rgba(0,0,0,.14)', zIndex: 200, overflow: 'hidden', animation: 'dropIn .2s ease' }}>
                {/* Ethiopian Intent Graph — shown when intent detected */}
                {intentData && search.length >= 2 && (
                  <div style={{ padding: '10px 16px 6px', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#2E7D32', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                      🌿 {intentData.intent === 'holiday' ? '🎉 Holiday Shopping' :
                          intentData.intent === 'fasting' ? '🕊️ Fasting Foods' :
                          intentData.intent === 'recipe'  ? '🍳 Recipe Ingredients' :
                          intentData.intent === 'bulk'    ? '📦 Bulk Order' :
                          intentData.intent === 'event'   ? '🎊 Event Catering' :
                          '🌾 Related Products'}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {intentData.terms?.slice(0, 5).map((term: string) => (
                        <button key={term}
                          onClick={() => { setSearch(term); handleSearchChange(term); setIntentData(null) }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #86efac', borderRadius: '50px', padding: '4px 10px', fontSize: '.78rem', fontWeight: 600, color: '#15803d', cursor: 'pointer', fontFamily: 'inherit' }}>
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* AI suggestion pill */}
                {aiSuggestion && !intentData && search.length >= 3 && (
                  <div style={{ padding: '10px 16px 6px', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>🤖 AI Suggestion</div>
                    <button onClick={() => { setSearch(aiSuggestion); handleSearchChange(aiSuggestion) }}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '1px solid #c4b5fd', borderRadius: '50px', padding: '5px 12px', fontSize: '.82rem', fontWeight: 600, color: '#7c3aed', cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✨ Did you mean: <strong>{aiSuggestion}</strong>
                    </button>
                  </div>
                )}
                {search.length < 2 ? (
                  <>
                    {recentSearches.length > 0 && (
                      <div>
                        <div style={{ padding: '10px 16px 4px', fontSize: '.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>Recent</span>
                          <button onClick={() => { setRecentSearches([]); localStorage.removeItem('hafa_recent_searches') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.7rem', color: '#9ca3af', fontFamily: 'inherit' }}>Clear</button>
                        </div>
                        {recentSearches.map(s => (
                          <div key={s} onClick={() => { setSearch(s); handleSearchChange(s) }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', cursor: 'pointer', fontSize: '.88rem', color: '#374151' }} className="hover:bg-gray-50">
                            <i className="fas fa-history" style={{ color: '#9ca3af', fontSize: '.8rem' }} />{s}
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ padding: '10px 16px 4px', fontSize: '.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px' }}>Trending</div>
                    {TRENDING.map(s => (
                      <div key={s} onClick={() => { setSearch(s); handleSearchChange(s) }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', cursor: 'pointer', fontSize: '.88rem', color: '#374151' }} className="hover:bg-gray-50">
                        <i className="fas fa-fire" style={{ color: '#FFA726', fontSize: '.8rem' }} />{s}
                      </div>
                    ))}
                    <div style={{ padding: '10px 16px 4px', fontSize: '.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px' }}>Categories</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', padding: '8px 16px 12px' }}>
                      {CATEGORIES.slice(0, 6).map(c => (
                        <Link key={c.slug} to={`/products?category=${c.slug}`} onClick={() => setSearchFocus(false)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#f3f4f6', borderRadius: '50px', padding: '4px 12px', fontSize: '.78rem', fontWeight: 600, color: '#374151', textDecoration: 'none' }} className="hover:bg-green-50 hover:text-[#2E7D32]">
                          {c.emoji} {c.label}
                        </Link>
                      ))}
                    </div>
                  </>
                ) : searchLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9ecef 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.2s ease infinite', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ height: '11px', borderRadius: '6px', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9ecef 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.2s ease infinite', marginBottom: '6px', width: `${55 + i * 10}%` }} />
                        <div style={{ height: '9px', borderRadius: '6px', background: 'linear-gradient(90deg,#f3f4f6 25%,#e9ecef 50%,#f3f4f6 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.2s ease infinite', width: '28%' }} />
                      </div>
                    </div>
                  ))
                ) : searchResults && searchResults.length > 0 ? (
                  <>
                    {searchResults.map(p => {
                      const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                      const hi = p.name.replace(new RegExp(`(${esc})`, 'gi'), '<mark style="background:#fff3cd;color:#1b5e20;font-weight:700;border-radius:2px;padding:0 2px">$1</mark>')
                      return (
                        <Link key={p.id} to={`/products/${p.slug}`} onClick={() => { saveRecentSearch(search); setSearchFocus(false) }}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', transition: '.2s', fontSize: '.88rem', textDecoration: 'none' }} className="hover:bg-gray-50">
                          <span style={{ fontSize: '1.4rem', flexShrink: 0 }}>{p.images?.[0] ? <img src={p.images[0]} style={{ width: '32px', height: '32px', borderRadius: '8px', objectFit: 'cover' }} alt="" /> : '🛒'}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: '#374151' }} dangerouslySetInnerHTML={{ __html: hi }} />
                            <div style={{ fontSize: '.75rem', color: '#2E7D32', fontWeight: 700 }}>${p.price.toFixed(2)}</div>
                          </div>
                        </Link>
                      )
                    })}
                    <Link to={`/products?search=${encodeURIComponent(search)}`} onClick={() => setSearchFocus(false)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px 16px', fontSize: '.88rem', color: '#2E7D32', fontWeight: 600, borderTop: '1px solid #f3f4f6', textDecoration: 'none' }} className="hover:bg-green-50">
                      <Search size={13} /> See all results for "{search}" →
                    </Link>
                  </>
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '.88rem' }}>No results for "{search}"</div>
                )}
              </div>
            )}
          </div>

          {/* Header right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>

            {/* Deliver to — real location */}
            <DeliverTo />

            {/* Account */}
            {isAuthenticated ? (
              <div style={{ position: 'relative' }}>
                <button onClick={() => setUserMenuOpen(!userMenuOpen)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 10px', borderRadius: '12px', background: 'none', border: 'none', transition: '.25s ease' }} className="hover:bg-gray-50">
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#2E7D32,#43a047)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '.88rem', boxShadow: '0 2px 8px rgba(46,125,50,.3)' }}>
                    {user?.name?.[0]?.toUpperCase()}
                  </div>
                  <div className="hidden lg:block" style={{ lineHeight: 1, textAlign: 'left' }}>
                    <span style={{ display: 'block', fontSize: '.65rem', color: '#9ca3af' }}>Hello,</span>
                    <span style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, color: '#374151' }}>{user?.name?.split(' ')[0]}</span>
                  </div>
                  <ChevronDown size={13} style={{ color: '#9ca3af', transition: '.25s ease', transform: userMenuOpen ? 'rotate(180deg)' : 'none' }} className="hidden lg:block" />
                </button>
                {userMenuOpen && (
                  <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '224px', background: '#fff', borderRadius: '20px', boxShadow: '0 8px 40px rgba(0,0,0,.14)', border: '1px solid #f3f4f6', overflow: 'hidden', zIndex: 50, animation: 'dropIn .2s ease' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)' }}>
                      <div style={{ fontWeight: 700, color: '#374151', fontSize: '.88rem' }}>{user?.name}</div>
                      <div style={{ fontSize: '.72rem', color: '#9ca3af' }}>{user?.email || user?.phone}</div>
                    </div>
                    <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ fontSize: '.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={10} /> Recently Viewed
                      </div>
                      {(() => {
                        // Read from localStorage — same source as RecentlyViewed component
                        let recent: any[] = []
                        try { recent = JSON.parse(localStorage.getItem('hafa_recently_viewed') || '[]').slice(0, 3) } catch {}
                        if (!recent.length) return <p style={{ fontSize: '.78rem', color: '#9ca3af' }}>No recently viewed products</p>
                        return recent.map((item: any, i: number) => (
                          <Link key={i} to={`/products/${item.slug}`} onClick={() => setUserMenuOpen(false)}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '.8rem', color: '#374151', textDecoration: 'none' }} className="hover:text-[#2E7D32]">
                            {item.images?.[0]
                              ? <img src={item.images[0]} style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'cover' }} alt="" />
                              : <span>🛒</span>
                            }
                            <span style={{ flex: 1 }}>{item.name}</span>
                            <span style={{ color: '#2E7D32', fontWeight: 700, fontSize: '.75rem' }}>ETB {item.price}</span>
                          </Link>
                        ))
                      })()}
                    </div>
                    {[
                      { to: '/account',        icon: <User size={14} />,           label: 'My Account' },
                      { to: '/account/orders', icon: <Package size={14} />,        label: 'My Orders' },
                      { to: '/account/wallet', icon: <Wallet size={14} />,         label: 'Wallet' },
                      ...(user?.role === 'SELLER' || user?.seller ? [{ to: '/dashboard', icon: <LayoutDashboard size={14} />, label: 'Seller Dashboard' }] : []),
                      ...(user?.role === 'ADMIN' ? [{ to: '/dashboard', icon: <LayoutDashboard size={14} />, label: 'Seller Dashboard' }, { to: '/admin', icon: <LayoutDashboard size={14} />, label: 'Admin Panel' }] : []),
                    ].map(item => (
                      <Link key={item.to} to={item.to} onClick={() => setUserMenuOpen(false)}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', fontSize: '.88rem', color: '#374151', transition: '.25s ease' }} className="hover:bg-gray-50">
                        <span style={{ color: '#9ca3af' }}>{item.icon}</span>{item.label}
                      </Link>
                    ))}
                    <button onClick={() => { logout(); setUserMenuOpen(false) }}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', fontSize: '.88rem', color: '#ef4444', width: '100%', background: 'none', border: 'none', cursor: 'pointer', borderTop: '1px solid #f3f4f6', transition: '.25s ease', fontFamily: 'inherit' }} className="hover:bg-red-50">
                      <LogOut size={15} />{t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 10px', borderRadius: '12px', transition: '.25s ease' }}
                onClick={() => navigate('/login')} className="hover:bg-gray-50">
                <User size={20} style={{ color: '#2E7D32' }} />
                <div className="hidden sm:block" style={{ lineHeight: 1 }}>
                  <span style={{ display: 'block', fontSize: '.65rem', color: '#9ca3af' }}>Hello, Sign in</span>
                  <span style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, color: '#374151' }}>Account & Orders</span>
                </div>
              </div>
            )}

            {/* Language switcher */}
            <div style={{ position: 'relative' }} className="hidden lg:block">
              <button onClick={() => setNotifOpen(false)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f9fafb', border: '1px solid #e5e7eb', padding: '6px 10px', borderRadius: '50px', cursor: 'pointer', fontSize: '.75rem', fontWeight: 600, color: '#374151', transition: '.25s ease' }}
                className="hover:bg-gray-100"
                onClick={() => {
                  const langs = ['en','am','sw','fr']
                  const curr = i18n.language || 'en'
                  const next = langs[(langs.indexOf(curr) + 1) % langs.length]
                  i18n.changeLanguage(next)
                }}>
                <Globe size={14} />
                {i18n.language === 'am' ? 'አማ' : i18n.language === 'sw' ? 'SW' : i18n.language === 'fr' ? 'FR' : 'EN'}
              </button>
            </div>

            {/* Notification bell */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button onClick={() => setNotifOpen(o => !o)} aria-label="Notifications"
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', background: '#f9fafb', border: '1px solid #e5e7eb', cursor: 'pointer', transition: '.25s ease' }} className="hover:bg-gray-100">
                <Bell size={17} style={{ color: '#374151', animation: 'bellRing 3s ease 2s infinite' }} />
                <span style={{ position: 'absolute', top: '-3px', right: '-3px', background: '#ef4444', color: '#fff', fontSize: '.58rem', fontWeight: 800, width: '16px', height: '16px', borderRadius: '50%', display: unreadCount > 0 ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>{unreadCount}</span>
              </button>
              {notifOpen && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '300px', background: '#fff', borderRadius: '16px', boxShadow: '0 8px 40px rgba(0,0,0,.14)', border: '1px solid #f3f4f6', overflow: 'hidden', zIndex: 50, animation: 'dropIn .2s ease' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: '.9rem', color: '#374151' }}>Notifications</span>
                    <button onClick={() => {
                      api.patch('/notifications/read-all').catch(() => {})
                      setNotifOpen(false)
                    }} style={{ fontSize: '.75rem', color: '#2E7D32', fontWeight: 600, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit' }}>Mark all read</button>
                  </div>
                  {NOTIFICATIONS.map((n, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #f9fafb', background: n.unread ? '#f0fdf4' : '#fff', cursor: 'pointer' }} className="hover:bg-gray-50">
                      <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{n.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '.82rem', color: '#374151', lineHeight: 1.4 }}>{n.text}</div>
                        <div style={{ fontSize: '.7rem', color: '#9ca3af', marginTop: '3px' }}>{n.time}</div>
                      </div>
                      {n.unread && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#2E7D32', flexShrink: 0, marginTop: '5px' }} />}
                    </div>
                  ))}
                  <Link to="/account/orders" onClick={() => setNotifOpen(false)}
                    style={{ display: 'block', padding: '11px 16px', textAlign: 'center', fontSize: '.85rem', color: '#2E7D32', fontWeight: 600, textDecoration: 'none' }} className="hover:bg-green-50">
                    View all notifications →
                  </Link>
                </div>
              )}
            </div>

            {/* Wishlist */}
            <Link to="/account/wishlist"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', background: '#f9fafb', border: '1px solid #e5e7eb', transition: '.25s ease', textDecoration: 'none', color: '#374151' }}
              className="hover:text-red-500 hover:bg-red-50 hover:border-red-200">
              <Heart size={17} />
            </Link>

            {/* Cart button — click opens sidebar, no hover preview */}
            <div style={{ position: 'relative' }}>
              <button onClick={openCart} aria-label="Open cart"
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px', background: '#f9fafb', border: '1px solid #e5e7eb', padding: '8px 14px', borderRadius: '50px', cursor: 'pointer', fontSize: '.88rem', fontWeight: 600, color: '#374151', transition: '.25s ease' }}
                className="hover:bg-[#2E7D32] hover:text-white hover:border-[#2E7D32]">
                <ShoppingCart size={17} style={{ animation: cartBounce ? 'cartBounce .5s ease' : 'none' }} />
                {count > 0 && (
                  <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#FFA726', color: '#fff', fontSize: '.62rem', fontWeight: 800, width: '18px', height: '18px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: cartBounce ? 'badgePop .5s ease' : 'none' }}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
                <span className="hidden sm:inline" style={{ fontSize: '.82rem' }}>Cart</span>
              </button>
            </div>

            {/* Hamburger */}
            <button onClick={() => dispatch(setMobileMenu(!mobileOpen))} aria-label="Toggle menu"
              style={{ display: 'none', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', background: 'none', border: 'none', cursor: 'pointer' }}
              className="!flex sm:!hidden hover:bg-gray-100">
              {mobileOpen ? <X size={22} color="#374151" /> : <Menu size={22} color="#374151" />}
            </button>
          </div>
        </div>
      </div>

      {/* Nav bar */}
      <nav ref={navRef} style={{ background: '#2E7D32', position: 'relative' }} className="hidden sm:block">
        <div style={{ overflowX: 'auto', scrollbarWidth: 'none' } as React.CSSProperties}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '0 24px', width: 'max-content', minWidth: '100%' }}>
            <div ref={megaRef} style={{ flexShrink: 0 }}>
              <button onClick={() => setMegaOpen(o => !o)}
                style={{ color: '#fff', padding: '12px 18px', fontSize: '.83rem', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: megaOpen ? 'rgba(0,0,0,.25)' : 'rgba(0,0,0,.15)', border: 'none', fontFamily: 'inherit', transition: '.25s ease' }}
                className="hover:!bg-black/25">
                <Menu size={15} /> All Categories <ChevronDown size={13} style={{ transform: megaOpen ? 'rotate(180deg)' : 'none', transition: '.25s ease' }} />
              </button>
            </div>
            {[
              { label: '🥬 Fresh Produce',    to: '/products?category=vegetables' },
              { label: '🌾 Grains & Legumes', to: '/products?category=grains' },
              { label: '🥚 Poultry & Dairy',  to: '/products?category=poultry' },
              { label: '☕ Coffee',            to: '/products?category=coffee' },
              { label: '⭐ Specialty',         to: '/products?category=specialty' },
              { label: "🔥 Today's Deals",    to: '/products?sort=soldCount', deal: true },
              { label: 'LIVE',              to: '/live', highlight: false, isLive: true },
              { label: '🛍️ Shop Feed',         to: '/social', highlight: true },
              { label: '🌾 Forum',             to: '/forum', highlight: false },
              { label: '🌿 Farmer Direct',     to: '/farmer-direct', highlight: false },
              { label: '🎁 Bundles',           to: '/bundles', highlight: false },
              { label: '📊 Mandi Prices',      to: '/mandi-prices', highlight: false },
              { label: '🗓️ Seasonality',       to: '/seasonality', highlight: false },
              { label: '⚡ Quick Order',        to: '/quick-order', highlight: false },
              { label: '📦 Volume Pricing',     to: '/volume-pricing', highlight: false },
              { label: '🌍 Export',             to: '/export', highlight: false },
              { label: 'Top Sellers',          to: '/sellers' },
              { label: 'Farm Blog',            to: '/blog' },
              { label: '✨ New Arrivals',      to: '/products?sort=createdAt', highlight: true },
            ].map(item => (
              item.isLive ? (
                <Link key={item.to} to={item.to}
                  style={{ color: '#fff', padding: '12px 16px', fontSize: '.83rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, transition: '.25s ease', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                  className="hover:text-white hover:bg-white/10">
                  <span style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 0 0 rgba(239,68,68,.6)', animation: 'liveNavPulse 1.5s ease-out infinite', flexShrink: 0 }} />
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                    LIVE
                  </span>
                </Link>
              ) : (
              <Link key={item.to} to={item.to}
                style={{ color: item.deal ? '#FFA726' : 'rgba(255,255,255,.88)', padding: '12px 16px', fontSize: '.83rem', fontWeight: item.deal ? 700 : 500, whiteSpace: 'nowrap', flexShrink: 0, transition: '.25s ease', display: 'flex', alignItems: 'center', gap: '5px', textDecoration: 'none', ...(item.highlight ? { background: '#FFA726', color: '#fff', borderRadius: '4px' } : {}) }}
                className={cn(!item.highlight && 'hover:text-white hover:bg-white/10')}>
                {item.label}
              </Link>
              )
            ))}
          </div>
        </div>

        {/* Mega menu */}
        {megaOpen && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.18)', zIndex: 500, borderTop: '3px solid #2E7D32', maxHeight: 'calc(100vh - 160px)', overflowY: 'auto' }}>
            <div className="max-w-[1240px] mx-auto px-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr) auto', gap: 0, padding: '32px 24px' }}>
              {MEGA_COLS.map((col, ci) => (
                <div key={ci} style={{ padding: '0 20px', borderRight: ci < MEGA_COLS.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  {col.sections.map((sec, si) => (
                    <div key={si} style={{ marginTop: si > 0 ? '16px' : 0 }}>
                      <h4 style={{ fontSize: '.88rem', fontWeight: 700, color: '#374151', marginBottom: '14px', paddingBottom: '8px', borderBottom: '2px solid #A5D6A7' }}>{sec.title}</h4>
                      {sec.rows.map((row, ri) => (
                        <Link key={ri} to={`/products?category=${row.slug}`} onClick={() => setMegaOpen(false)}
                          style={{ display: 'block', fontSize: '.82rem', color: '#6b7280', padding: '5px 0', transition: '.25s ease', textDecoration: 'none' }}
                          className="hover:text-[#2E7D32] hover:pl-1.5">
                          {row.label}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ paddingLeft: '24px' }}>
                <div style={{ background: 'linear-gradient(135deg,#2E7D32,#388e3c)', borderRadius: '12px', padding: '20px', color: '#fff', textAlign: 'center', minWidth: '160px' }}>
                  <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>🎁</span>
                  <strong style={{ display: 'block', fontSize: '.95rem', marginBottom: '6px' }}>Seasonal Deals</strong>
                  <p style={{ fontSize: '.78rem', opacity: .85, marginBottom: '14px' }}>Up to 40% off on selected items</p>
                  <Link to="/products?sort=soldCount" onClick={() => setMegaOpen(false)}
                    style={{ display: 'inline-block', background: '#fff', color: '#374151', padding: '7px 16px', borderRadius: '50px', fontSize: '.8rem', fontWeight: 600, textDecoration: 'none' }} className="hover:bg-gray-100">
                    Shop Now
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Styles */}
      <style>{`
        .nav-scroll::-webkit-scrollbar{display:none}
        @keyframes tickerScroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes headerSpin{to{transform:rotate(360deg)}}
        @keyframes shimmer{0%,100%{background-position:200% 0}50%{background-position:-200% 0}}
        @keyframes dropIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bellRing{0%,90%,100%{transform:rotate(0)}92%,96%{transform:rotate(-12deg)}94%,98%{transform:rotate(12deg)}}
        @keyframes cartBounce{0%,100%{transform:scale(1)}30%{transform:scale(1.35) rotate(-10deg)}60%{transform:scale(.9) rotate(5deg)}}
        @keyframes badgePop{0%,100%{transform:scale(1)}40%{transform:scale(1.5)}}
        @keyframes liveNavPulse{0%{box-shadow:0 0 0 0 rgba(239,68,68,.7)}70%{box-shadow:0 0 0 6px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
      `}</style>

      {/* Visual Search Modal */}
      {visualSearchOpen && (
        <VisualSearch onClose={() => setVisualSearchOpen(false)} />
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{ background: '#fff', borderTop: '1px solid #f3f4f6', boxShadow: '0 4px 20px rgba(0,0,0,.11)' }} className="sm:hidden">
          <div style={{ padding: '16px' }}>
            {!isAuthenticated && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <Link to="/login" onClick={() => dispatch(setMobileMenu(false))} style={{ flex: 1, textAlign: 'center', padding: '10px', border: '2px solid #2E7D32', borderRadius: '50px', color: '#2E7D32', fontWeight: 600, fontSize: '.88rem', textDecoration: 'none' }}>Login</Link>
                <Link to="/register" onClick={() => dispatch(setMobileMenu(false))} style={{ flex: 1, textAlign: 'center', padding: '10px', background: '#2E7D32', borderRadius: '50px', color: '#fff', fontWeight: 600, fontSize: '.88rem', textDecoration: 'none' }}>Sign Up</Link>
              </div>
            )}
            {CATEGORIES.map(cat => (
              <Link key={cat.slug} to={`/products?category=${cat.slug}`} onClick={() => dispatch(setMobileMenu(false))}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', fontSize: '.88rem', fontWeight: 500, color: '#374151', textDecoration: 'none', transition: '.25s ease' }}
                className="hover:bg-gray-50">
                <span style={{ fontSize: '1.2rem' }}>{cat.emoji}</span>{cat.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
