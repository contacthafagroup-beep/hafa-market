import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCart } from '@/hooks/useCart'
import { useQuery } from '@tanstack/react-query'
import { productService } from '@/services/product.service'
import { useVisitorCount } from '@/hooks/useVisitorCount'
import StoryVideoOverlay from '@/components/ui/StoryVideoOverlay'

const TYPEWRITER_WORDS = ['Fresh', 'Organic', 'Local', 'Affordable', 'Essential']

const FLOAT_CARDS = [
  { emoji: '🥦', name: 'Fresh Broccoli', price: '$2.99/kg', cls: 'fc-a',
    product: { id: '1', name: 'Fresh Broccoli', price: 2.99, unit: 'kg', images: [], slug: 'broccoli', isOrganic: true, isFeatured: false, status: 'ACTIVE' as const, rating: 4.8, reviewCount: 124, soldCount: 200, minOrder: 1, stock: 100, tags: [], seller: { id: '1', storeName: 'Kwame Farms', storeSlug: 'kwame-farms', rating: 4.9 }, category: { id: '1', name: 'Vegetables', slug: 'vegetables', emoji: '🥬' } } },
  { emoji: '🌾', name: 'Wheat Grain', price: '$1.49/kg', cls: 'fc-b',
    product: { id: '2', name: 'Wheat Grain', price: 1.49, unit: 'kg', images: [], slug: 'wheat', isOrganic: false, isFeatured: false, status: 'ACTIVE' as const, rating: 4.5, reviewCount: 67, soldCount: 150, minOrder: 1, stock: 100, tags: [], seller: { id: '1', storeName: 'Ibrahim AgriCo', storeSlug: 'ibrahim-agrico', rating: 4.7 }, category: { id: '2', name: 'Grains', slug: 'grains', emoji: '🌾' } } },
  { emoji: '⭐', name: 'Top Rated',     price: '4.9 / 5.0', cls: 'fc-c', product: null },
  { emoji: '🚚', name: 'Fast Delivery', price: '24–48 hrs',  cls: 'fc-d', product: null },
]

const DEALS = [
  { emoji: '🥬', text: '40% OFF Organic Vegetables',        code: 'VEG40'   },
  { emoji: '🌾', text: '25% OFF Bulk Grains 10kg+',         code: 'GRAIN25' },
  { emoji: '☕', text: 'Ethiopian Coffee from $7.49',        code: 'COFFEE'  },
  { emoji: '🍯', text: 'Pure Honey $8.99 — Was $10.99',     code: 'HONEY'   },
  { emoji: '🥭', text: 'Sweet Mangoes $4.49/kg',            code: 'MANGO'   },
  { emoji: '🎁', text: 'First order 10% OFF — Code HAFA10', code: 'HAFA10'  },
]

const STATS = [
  { target: 10000, label: 'Products',  display: '10K+' },
  { target: 50000, label: 'Customers', display: '50K+' },
  { target: 500,   label: 'Farmers',   display: '500+' },
  { target: 30,    label: 'Cities',    display: '30+'  },
]

export default function HeroSection() {
  const { add } = useCart()
  const navigate = useNavigate()
  const visitorCount = useVisitorCount()
  const particlesRef = useRef<HTMLDivElement>(null)
  const statsRef     = useRef<HTMLDivElement>(null)

  const [twIndex, setTwIndex] = useState(0)
  const [twText,  setTwText]  = useState('')
  const [twDel,   setTwDel]   = useState(false)
  const [parallaxY, setParallaxY] = useState(0)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [counts, setCounts] = useState(STATS.map(() => 0))
  const [countsStarted, setCountsStarted] = useState(false)
  const [heroCategory, setHeroCategory] = useState('')
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50 })
  const [proofIdx, setProofIdx] = useState(0)
  const [showStory, setShowStory] = useState(false)
  const [heroFading, setHeroFading] = useState(false)

  const handleSpotlight = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setSpotlight({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 })
  }, [])

  useEffect(() => {
    const t = setInterval(() => setProofIdx(i => (i + 1) % SOCIAL_PROOF.length), 3000)
    return () => clearInterval(t)
  }, [])

  /* Typewriter */
  useEffect(() => {
    const word = TYPEWRITER_WORDS[twIndex]
    let t: ReturnType<typeof setTimeout>
    if (!twDel && twText.length < word.length)        t = setTimeout(() => setTwText(word.slice(0, twText.length + 1)), 100)
    else if (!twDel && twText.length === word.length)  t = setTimeout(() => setTwDel(true), 1800)
    else if (twDel && twText.length > 0)               t = setTimeout(() => setTwText(twText.slice(0, -1)), 55)
    else { setTwDel(false); setTwIndex(i => (i + 1) % TYPEWRITER_WORDS.length) }
    return () => clearTimeout(t)
  }, [twText, twDel, twIndex])

  /* Particles */
  useEffect(() => {
    const c = particlesRef.current
    if (!c) return
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('div')
      const s = 2 + Math.random() * 4
      p.style.cssText = `position:absolute;width:${s}px;height:${s}px;background:rgba(255,255,255,.3);border-radius:50%;left:${Math.random()*100}%;animation:heroParticleFloat ${8+Math.random()*12}s linear ${Math.random()*10}s infinite`
      c.appendChild(p)
    }
    return () => { c.innerHTML = '' }
  }, [])

  /* Parallax */
  useEffect(() => {
    const fn = () => setParallaxY(window.scrollY * 0.25)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  /* 3D tilt */
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setTilt({ x: ((e.clientY - r.top) / r.height - 0.5) * 14, y: ((e.clientX - r.left) / r.width - 0.5) * -14 })
  }, [])
  const handleMouseLeave = useCallback(() => setTilt({ x: 0, y: 0 }), [])

  /* Animated counters */
  useEffect(() => {
    if (!statsRef.current || countsStarted) return
    const obs = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return
      setCountsStarted(true)
      STATS.forEach((stat, i) => {
        let cur = 0
        const inc = stat.target / 60
        const t = setInterval(() => {
          cur = Math.min(cur + inc, stat.target)
          setCounts(prev => { const n = [...prev]; n[i] = Math.floor(cur); return n })
          if (cur >= stat.target) clearInterval(t)
        }, 30)
      })
      obs.disconnect()
    }, { threshold: 0.5 })
    obs.observe(statsRef.current)
    return () => obs.disconnect()
  }, [countsStarted])

  const fmt = (val: number, stat: typeof STATS[0]) =>
    stat.target >= 10000 ? `${Math.floor(val / 1000)}K+` : `${val}+`

  const { data: productCountData } = useQuery({
    queryKey: ['hero-product-count'],
    queryFn: () => productService.getProducts({ limit: 1 }).then(r => (r.data as any).total ?? 10247),
    staleTime: 60000,
    refetchInterval: 30000,
  })
  const liveCount = productCountData ?? 10247

  // Fetch active live session for the hero badge
  const { data: liveSession } = useQuery({
    queryKey: ['hero-live-session'],
    queryFn: () => import('@/lib/api').then(m => m.default.get('/live').then(r => {
      const sessions = r.data.data || []
      return sessions.find((s: any) => s.status === 'LIVE') || null
    })),
    staleTime: 30000,
    refetchInterval: 30000,
  })

  const HERO_CATS = ['🥬 Vegetables', '🍎 Fruits', '🌾 Grains', '☕ Coffee', '🍯 Specialty']

  const SOCIAL_PROOF = [
    { avatar: '👩🏾', name: 'Amina',   city: 'Nairobi',    product: 'Fresh Tomatoes',        time: '2 min ago'  },
    { avatar: '👨🏿', name: 'Kwame',   city: 'Accra',      product: 'Ethiopian Coffee 500g', time: '5 min ago'  },
    { avatar: '👩🏽', name: 'Fatima',  city: 'Dakar',      product: 'Pure Honey 500g',       time: '8 min ago'  },
    { avatar: '👨🏾', name: 'Ibrahim', city: 'Lagos',      product: 'Teff 2kg',              time: '11 min ago' },
    { avatar: '👩🏿', name: 'Zara',    city: 'Kampala',    product: 'Organic Kale',          time: '14 min ago' },
    { avatar: '👨🏽', name: 'Chidi',   city: 'Abuja',      product: 'Sweet Mangoes 1kg',     time: '17 min ago' },
  ]

  const handleWatchStory = () => {
    setHeroFading(true)
    setTimeout(() => setShowStory(true), 350)
  }

  const handleCloseStory = () => {
    setShowStory(false)
    setTimeout(() => setHeroFading(false), 400)
  }

  const handleShopNow = (e: React.MouseEvent) => {
    e.preventDefault()
    const colors = ['#FFA726','#2E7D32','#fff','#43a047','#fb8c00']
    for (let i = 0; i < 60; i++) {
      const el = document.createElement('div')
      const size = 6 + Math.random() * 8
      const dx = (Math.random() - 0.5) * 300
      const dy = -100 - Math.random() * 200
      el.style.cssText = `position:fixed;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${Math.random()>.5?'50%':'2px'};left:${e.clientX}px;top:${e.clientY}px;pointer-events:none;z-index:9999;transition:transform ${0.8+Math.random()*0.8}s ease,opacity ${0.8+Math.random()*0.8}s ease;opacity:1`
      document.body.appendChild(el)
      requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px,${dy}px) rotate(${Math.random()*720}deg)`
        el.style.opacity = '0'
      })
      setTimeout(() => el.remove(), 1600)
    }
    setTimeout(() => navigate('/products'), 500)
  }

  const posMap: Record<string, React.CSSProperties> = {
    'fc-a': { top: '-20px',   left: '-50px',  animationDelay: '0s'   },
    'fc-b': { bottom: '30px', left: '-60px',  animationDelay: '1.5s' },
    'fc-c': { top: '30px',    right: '-50px', animationDelay: '.8s'  },
    'fc-d': { bottom: '-10px',right: '-40px', animationDelay: '2.2s' },
  }

  return (
    <section onMouseMove={handleSpotlight} style={{ background: 'linear-gradient(135deg,#0d3b10 0%,#1b5e20 30%,#2E7D32 60%,#388e3c 100%)', minHeight: '92vh', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden', padding: '80px 0 0',
      // Cinematic fade when story opens
      opacity: heroFading ? 0 : 1,
      filter: heroFading ? 'blur(6px)' : 'none',
      transform: heroFading ? 'scale(1.02)' : 'scale(1)',
      transition: 'opacity .35s ease, filter .35s ease, transform .35s ease',
    }}>

      {/* Mouse spotlight */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, background: `radial-gradient(circle 400px at ${spotlight.x}% ${spotlight.y}%, rgba(255,255,255,.07) 0%, transparent 70%)`, transition: 'background .1s ease' }} />

      {/* Video background — subtle farm loop */}
      <video autoPlay muted loop playsInline
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.07, zIndex: 0, pointerEvents: 'none' }}>
        <source src="https://www.w3schools.com/html/mov_bbb.mp4" type="video/mp4" />
      </video>

      {/* Blobs with parallax */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', width: '600px', height: '600px', background: '#fff', borderRadius: '50%', filter: 'blur(60px)', opacity: .15, top: `${-200 + parallaxY * 0.3}px`, right: '-150px' }} />
        <div style={{ position: 'absolute', width: '400px', height: '400px', background: '#FFA726', borderRadius: '50%', filter: 'blur(60px)', opacity: .15, bottom: `${-100 - parallaxY * 0.2}px`, left: '-100px' }} />
        <div style={{ position: 'absolute', width: '300px', height: '300px', background: '#fff', borderRadius: '50%', filter: 'blur(60px)', opacity: .15, top: '40%', left: '35%' }} />
        <div ref={particlesRef} style={{ position: 'absolute', inset: 0 }} />
      </div>

      {/* Deal ticker */}
      <div style={{ width: '100%', background: 'rgba(0,0,0,.25)', backdropFilter: 'blur(8px)', borderBottom: '1px solid rgba(255,255,255,.15)', overflow: 'hidden', position: 'relative', zIndex: 2, flexShrink: 0 }}>
        <div style={{ display: 'flex', animation: 'heroTickerScroll 28s linear infinite', whiteSpace: 'nowrap' }}>
          {[...DEALS, ...DEALS].map((d, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 36px', fontSize: '.8rem', color: 'rgba(255,255,255,.95)', fontWeight: 500, borderRight: '1px solid rgba(255,255,255,.1)', flexShrink: 0 }}>
              {d.emoji} {d.text}
              <span style={{ background: '#FFA726', color: '#fff', padding: '2px 10px', borderRadius: '50px', fontSize: '.7rem', fontWeight: 700 }}>{d.code}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="max-w-[1240px] mx-auto px-6 w-full" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', alignItems: 'center', position: 'relative', zIndex: 1, flex: 1, paddingTop: '64px', paddingBottom: '60px' }}>

        {/* Left */}
        <div style={{ color: '#fff' }}>
          {/* 🔴 Live session badge — top left, only when live */}
          {liveSession && (
            <Link to={`/live/${liveSession.id}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#ef4444', color: '#fff', padding: '7px 14px 7px 10px', borderRadius: '50px', textDecoration: 'none', boxShadow: '0 4px 20px rgba(239,68,68,.5)', animation: 'heroLiveBadgePop .5s ease both', fontFamily: 'inherit', marginBottom: '14px' }}>
              <span style={{ width: '9px', height: '9px', background: '#fff', borderRadius: '50%', flexShrink: 0, animation: 'liveNavPulse 1.5s ease-out infinite' }} />
              <span style={{ fontSize: '.78rem', fontWeight: 800, letterSpacing: '.3px' }}>LIVE NOW</span>
              <span style={{ fontSize: '.72rem', opacity: .85, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{liveSession.title}</span>
            </Link>
          )}
          <div className="hero-badge-anim" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,.2)', padding: '8px 18px', borderRadius: '50px', fontSize: '.82rem', fontWeight: 500, marginBottom: '22px' }}>
            <span style={{ width: '8px', height: '8px', background: '#4caf50', borderRadius: '50%', animation: 'heroBadgePulse 2s infinite', display: 'inline-block' }} />
            {visitorCount ? (
              <><span style={{ color: '#FFA726', fontWeight: 700 }}>🟢 {visitorCount.toLocaleString()}</span> people browsing · Trusted by 50,000+ Farmers &amp; Buyers</>
            ) : (
              <>Trusted by 50,000+ Farmers &amp; Buyers Across Africa</>
            )}
          </div>

          <h1 className="hero-h1-anim" style={{ fontSize: 'clamp(1.9rem,3.8vw,3rem)', fontWeight: 900, lineHeight: 1.15, marginBottom: '18px' }}>
            Your One-Stop Marketplace for{' '}
            <span style={{ color: '#FFA726', display: 'inline-block', minWidth: '10ch' }}>
              {twText || '\u00A0'}
              <span style={{ display: 'inline-block', width: '2px', height: '1em', background: '#FFA726', marginLeft: '2px', verticalAlign: 'middle', animation: 'twCursor .7s step-end infinite' }} />
            </span>
            {' '}Agricultural Products
          </h1>

          <p className="hero-p-anim" style={{ fontSize: '1.05rem', opacity: .88, lineHeight: 1.75, marginBottom: '34px', maxWidth: '480px' }}>
            Shop fresh produce, grains, farming tools and essentials — sourced directly from local farmers and delivered fast to your doorstep.
          </p>

          {/* CTA buttons */}
          <div className="hero-cta-anim" style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '28px' }}>
            <Link to="/products" onClick={handleShopNow} className="btn-hero-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#FFA726', color: '#fff', padding: '14px 30px', borderRadius: '50px', fontWeight: 700, fontSize: '.95rem', textDecoration: 'none', boxShadow: '0 6px 20px rgba(255,167,38,.4)', transition: '.25s ease' }}>
              <i className="fas fa-shopping-bag" /> Shop Now
            </Link>
            <Link to="/products" className="btn-hero-outline" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,.12)', color: '#fff', padding: '14px 28px', borderRadius: '50px', fontWeight: 600, fontSize: '.92rem', border: '2px solid rgba(255,255,255,.4)', textDecoration: 'none', backdropFilter: 'blur(8px)', transition: '.25s ease' }}>
              <i className="fas fa-th-large" /> Browse Categories
            </Link>
            <Link to="/register" className="btn-hero-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'transparent', color: 'rgba(255,255,255,.8)', padding: '14px 20px', borderRadius: '50px', fontWeight: 500, fontSize: '.88rem', border: '1px solid rgba(255,255,255,.2)', textDecoration: 'none', transition: '.25s ease' }}>
              <i className="fas fa-store" /> Become a Seller
            </Link>
            {/* Watch Our Story — secondary CTA */}
            <button onClick={handleWatchStory} className="btn-hero-story" style={{
              display: 'inline-flex', alignItems: 'center', gap: '9px',
              background: 'rgba(255,255,255,.08)', backdropFilter: 'blur(10px)',
              color: 'rgba(255,255,255,.9)', padding: '13px 22px',
              borderRadius: '50px', fontWeight: 600, fontSize: '.88rem',
              border: '1px solid rgba(255,255,255,.25)',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all .25s ease',
            }}>
              <span style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'rgba(255,255,255,.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="10" height="12" viewBox="0 0 10 12" fill="white">
                  <path d="M0 0L10 6L0 12V0Z"/>
                </svg>
              </span>
              Watch Our Story
            </button>
          </div>

          {/* Social proof ticker */}
          <div className="hero-search-anim" style={{ marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,.1)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,.2)', borderRadius: '50px', padding: '8px 16px 8px 8px', overflow: 'hidden', maxWidth: '420px' }}>
              {/* Pulsing dot */}
              <span style={{ width: '8px', height: '8px', background: '#4caf50', borderRadius: '50%', animation: 'heroBadgePulse 2s infinite', flexShrink: 0 }} />
              {/* Avatar */}
              <span style={{ fontSize: '1.4rem', flexShrink: 0, animation: 'proofFadeIn .4s ease' }} key={`av-${proofIdx}`}>
                {SOCIAL_PROOF[proofIdx].avatar}
              </span>
              {/* Text — animates on change */}
              <span key={`txt-${proofIdx}`} style={{ fontSize: '.82rem', color: 'rgba(255,255,255,.95)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', animation: 'proofFadeIn .4s ease' }}>
                <strong>{SOCIAL_PROOF[proofIdx].name}</strong> from {SOCIAL_PROOF[proofIdx].city} just ordered{' '}
                <span style={{ color: '#FFA726', fontWeight: 600 }}>{SOCIAL_PROOF[proofIdx].product}</span>
              </span>
              {/* Time badge */}
              <span key={`time-${proofIdx}`} style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.55)', flexShrink: 0, animation: 'proofFadeIn .4s ease' }}>
                {SOCIAL_PROOF[proofIdx].time}
              </span>
            </div>
            {/* Dots indicator */}
            <div style={{ display: 'flex', gap: '5px', marginTop: '10px', paddingLeft: '8px' }}>
              {SOCIAL_PROOF.map((_, i) => (
                <div key={i} onClick={() => setProofIdx(i)} style={{ width: i === proofIdx ? '18px' : '6px', height: '6px', borderRadius: '3px', background: i === proofIdx ? '#FFA726' : 'rgba(255,255,255,.3)', transition: 'all .3s ease', cursor: 'pointer' }} />
              ))}
            </div>
          </div>

          {/* Animated stats */}
          <div ref={statsRef} className="hero-stats-anim" style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {STATS.map((stat, i) => (
              <React.Fragment key={stat.label}>
                {i > 0 && <div style={{ width: '1px', height: '44px', background: 'rgba(255,255,255,.2)' }} />}
                <div style={{ textAlign: 'center' }}>
                  <strong style={{ display: 'block', fontSize: '1.6rem', fontWeight: 900, color: '#FFA726' }}>
                    {countsStarted ? fmt(counts[i], stat) : stat.display}
                  </strong>
                  <span style={{ fontSize: '.75rem', opacity: .75, fontWeight: 500 }}>{stat.label}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Right visual — 3D tilt, only on large screens */}
        <div className="hero-visual-anim" style={{ position: 'relative', justifyContent: 'center' }}
          onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <div style={{ position: 'relative', width: '320px', height: '320px', background: 'rgba(255,255,255,.1)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,.2)', borderRadius: '28px', padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: 'transform .15s ease' }}>
            <div style={{ position: 'relative', width: '200px', height: '200px' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', fontSize: '3.5rem', animation: 'heroSpin 20s linear infinite' }}>🌿</div>
              {(['🥬','🍅','🌽','🥕','🍎','🌾'] as const).map((em, i) => (
                <div key={i} style={{ position: 'absolute', fontSize: '2rem', animation: 'heroOrbit 8s ease-in-out infinite', animationDelay: `${-i * 1.3}s`,
                  top:    i === 0 ? 0 : i === 3 ? 'auto' : i === 1 || i === 5 ? '15%' : i === 2 || i === 4 ? 'auto' : undefined,
                  bottom: i === 3 ? 0 : i === 2 || i === 4 ? '15%' : undefined,
                  left:   i === 0 || i === 3 ? '50%' : i === 4 || i === 5 ? 0 : undefined,
                  right:  i === 1 || i === 2 ? 0 : undefined,
                  transform: i === 0 || i === 3 ? 'translateX(-50%)' : undefined,
                }}>{em}</div>
              ))}
            </div>
          </div>

          {/* Floating cards */}
          {FLOAT_CARDS.map((card, i) => (
            <div key={i} style={{ position: 'absolute', background: '#fff', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 8px 40px rgba(0,0,0,.14)', animation: 'heroFloatY 4s ease-in-out infinite', minWidth: '155px', ...posMap[card.cls] }}>
              <span style={{ fontSize: '1.8rem' }}>{card.emoji}</span>
              <div>
                <b style={{ display: 'block', fontSize: '.8rem', fontWeight: 700, color: '#374151' }}>{card.name}</b>
                <small style={{ fontSize: '.72rem', color: '#2E7D32', fontWeight: 600 }}>{card.price}</small>
              </div>
              {card.product && (
                <button onClick={() => add(card.product as Parameters<typeof add>[0])}
                  style={{ background: '#2E7D32', color: '#fff', border: 'none', width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 700, marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Wave */}
      <div style={{ width: '100%', lineHeight: 0, flexShrink: 0 }}>
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none" style={{ width: '100%', height: '80px', display: 'block' }}>
          <path d="M0,60 C240,100 480,20 720,60 C960,100 1200,20 1440,60 L1440,100 L0,100 Z" fill="#fff" />
        </svg>
      </div>

      {/* Story video overlay — rendered via Portal */}
      {showStory && <StoryVideoOverlay onClose={handleCloseStory} />}

      <style>{`
        @keyframes heroParticleFloat{0%{transform:translateY(100vh) rotate(0deg);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(-100px) rotate(720deg);opacity:0}}
        @keyframes heroBadgePulse{0%,100%{box-shadow:0 0 0 0 rgba(76,175,80,.6)}50%{box-shadow:0 0 0 8px rgba(76,175,80,0)}}
        @keyframes heroSpin{from{transform:translate(-50%,-50%) rotate(0deg)}to{transform:translate(-50%,-50%) rotate(360deg)}}
        @keyframes heroOrbit{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}
        @keyframes heroFloatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes heroTickerScroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes twCursor{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes heroFadeUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes heroFadeLeft{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:translateX(0)}}
        @keyframes proofFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes liveNavPulse{0%{box-shadow:0 0 0 0 rgba(255,255,255,.8)}70%{box-shadow:0 0 0 7px rgba(255,255,255,0)}100%{box-shadow:0 0 0 0 rgba(255,255,255,0)}}
        @keyframes heroLiveBadgePop{from{opacity:0;transform:scale(.7) translateY(-8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        .hero-badge-anim{animation:heroFadeUp .7s ease both}
        .hero-h1-anim{animation:heroFadeUp .7s .15s ease both}
        .hero-p-anim{animation:heroFadeUp .7s .3s ease both}
        .hero-cta-anim{animation:heroFadeUp .7s .45s ease both}
        .hero-search-anim{animation:heroFadeUp .7s .55s ease both}
        .hero-stats-anim{animation:heroFadeUp .7s .65s ease both}
        .hero-visual-anim{animation:heroFadeLeft .8s .3s ease both;display:flex}
        .btn-hero-primary:hover{background:#fb8c00!important;transform:translateY(-3px);box-shadow:0 10px 28px rgba(255,167,38,.5)!important}
        .btn-hero-outline:hover{background:rgba(255,255,255,.22)!important;border-color:#fff!important}
        .btn-hero-ghost:hover{color:#fff!important;border-color:rgba(255,255,255,.5)!important}
        .btn-hero-story:hover{background:rgba(255,255,255,.18)!important;border-color:rgba(255,255,255,.5)!important;transform:translateY(-2px)}
        @media(max-width:1024px){
          .hero-visual-anim{display:none!important}
          .max-w-\\[1240px\\].mx-auto.px-6.w-full{grid-template-columns:1fr!important}
        }
      `}</style>
    </section>
  )
}
