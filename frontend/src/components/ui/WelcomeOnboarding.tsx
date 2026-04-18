import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

const SCREENS = [
  {
    id: 'welcome',
    gradient: 'linear-gradient(135deg,#0a2e0f 0%,#1a5c24 50%,#2d8a3e 100%)',
    accent: '#4ade80',
    glow: 'rgba(74,222,128,0.35)',
    icon: '🌿',
    particles: ['🥬','🍎','🌾','🍯','☕','🥩'],
    tag: 'Welcome', tagAm: 'እንኳን ደህና መጡ',
    title: "Africa's Freshest\nMarketplace",
    titleAm: 'የአፍሪካ ትኩስ ገበያ',
    sub: "Farm-to-door in Hosa'ina & across Ethiopia",
    subAm: 'ከሆሳና እስከ ኢትዮጵያ — ከእርሻ ወደ ደጅዎ',
    features: [
      { icon:'🌱', text:'500+ Verified Farmers' },
      { icon:'📦', text:'10,000+ Fresh Products' },
      { icon:'⚡', text:'24–48hr Delivery' },
    ],
  },
  {
    id: 'shop',
    gradient: 'linear-gradient(135deg,#0c1a3a 0%,#1a3a6b 50%,#2563eb 100%)',
    accent: '#60a5fa',
    glow: 'rgba(96,165,250,0.35)',
    icon: '🛒',
    particles: ['🥦','🍋','🌽','🫘','🧅','🍅'],
    tag: 'Shop Smart', tagAm: 'ብልህ ግዢ',
    title: 'Everything Fresh,\nOne Tap Away',
    titleAm: 'ሁሉም ትኩስ፣ በአንድ ጠቅታ',
    sub: 'AI-powered search finds exactly what you need',
    subAm: 'AI ፍለጋ የሚፈልጉትን ያገኛል',
    features: [
      { icon:'🤖', text:'AI Shopping Assistant' },
      { icon:'🔍', text:'Smart Search & Filters' },
      { icon:'❤️', text:'Personalized For You' },
    ],
  },
  {
    id: 'pay',
    gradient: 'linear-gradient(135deg,#1a0a2e 0%,#3b1a6b 50%,#7c3aed 100%)',
    accent: '#a78bfa',
    glow: 'rgba(167,139,250,0.35)',
    icon: '💳',
    particles: ['📱','💰','🏦','✅','🔒','💎'],
    tag: 'Pay Easy', tagAm: 'ቀላል ክፍያ',
    title: 'Pay Your Way,\nAlways Secure',
    titleAm: 'በፈለጉት ይክፈሉ፣ ሁልጊዜ ደህንነቱ የተጠበቀ',
    sub: 'Telebirr, CBE Birr, Chapa & Cash on Delivery',
    subAm: 'Telebirr፣ CBE Birr፣ Chapa እና በደጅ ክፍያ',
    features: [
      { icon:'📲', text:'Telebirr & CBE Birr' },
      { icon:'🛡️', text:'SSL Encrypted Checkout' },
      { icon:'💵', text:'Cash on Delivery' },
    ],
  },
  {
    id: 'deliver',
    gradient: 'linear-gradient(135deg,#1a0f00 0%,#6b3a00 50%,#d97706 100%)',
    accent: '#fbbf24',
    glow: 'rgba(251,191,36,0.35)',
    icon: '🚀',
    particles: ['🚚','📍','⏱️','🗺️','✨','🎯'],
    tag: 'Fast Delivery', tagAm: 'ፈጣን መላኪያ',
    title: 'Track Every Step\nIn Real-Time',
    titleAm: 'እያንዳንዱ ደረጃ በቀጥታ ይከታተሉ',
    sub: 'GPS-powered delivery to your exact location',
    subAm: 'GPS ወደ ትክክለኛ አድራሻዎ ያደርሳል',
    features: [
      { icon:'📡', text:'Live GPS Tracking' },
      { icon:'🏠', text:'Landmark-Based Delivery' },
      { icon:'📞', text:'Direct Driver Contact' },
    ],
  },
]

interface Props { userName: string; onDone: () => void }

function Content({ userName, onDone }: Props) {
  const navigate = useNavigate()
  const [cur, setCur] = useState(0)
  const [anim, setAnim] = useState(false)
  const [dir, setDir] = useState<'n'|'p'>('n')
  const [visible, setVisible] = useState(false)
  const [prog, setProg] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const s = SCREENS[cur]
  const firstName = userName?.split(' ')[0] || 'there'
  const isLast = cur === SCREENS.length - 1

  useEffect(() => { setTimeout(() => setVisible(true), 30) }, [])

  useEffect(() => {
    setProg(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setProg(p => { if (p >= 100) { clearInterval(timerRef.current!); return 100 } return p + 0.4 })
    }, 32)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [cur])

  useEffect(() => { if (prog >= 100) advance() }, [prog])

  const advance = () => {
    if (anim) return
    if (isLast) { done(); return }
    setDir('n'); setAnim(true)
    setTimeout(() => { setCur(c => c + 1); setAnim(false) }, 320)
  }

  const back = () => {
    if (anim || cur === 0) return
    setDir('p'); setAnim(true)
    setTimeout(() => { setCur(c => c - 1); setAnim(false) }, 320)
  }

  const done = () => {
    setVisible(false)
    setTimeout(() => { localStorage.setItem('hafa_onboarded','1'); onDone() }, 350)
  }

  return (
    <>
      <style>{`
        @keyframes ob-float {
          0%   { opacity:0; transform:translateY(30px) rotate(-8deg) scale(.7); }
          25%  { opacity:.55; }
          75%  { opacity:.35; }
          100% { opacity:0; transform:translateY(-80px) rotate(8deg) scale(1.1); }
        }
        @keyframes ob-in-n {
          from { opacity:0; transform:translateX(50px) scale(.96); }
          to   { opacity:1; transform:translateX(0) scale(1); }
        }
        @keyframes ob-in-p {
          from { opacity:0; transform:translateX(-50px) scale(.96); }
          to   { opacity:1; transform:translateX(0) scale(1); }
        }
        @keyframes ob-up { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ob-pop { from { opacity:0; transform:scale(.5); } to { opacity:1; transform:scale(1); } }
        @keyframes ob-pulse { 0%,100%{opacity:.6} 50%{opacity:1} }
        @keyframes ob-enter { from{opacity:0;transform:scale(1.05)} to{opacity:1;transform:scale(1)} }
        .ob-slide-n { animation: ob-in-n .32s cubic-bezier(.22,1,.36,1) both; }
        .ob-slide-p { animation: ob-in-p .32s cubic-bezier(.22,1,.36,1) both; }
        .ob-cta:hover { transform:translateY(-3px) scale(1.02)!important; }
        .ob-cta:active { transform:scale(.97)!important; }
      `}</style>

      {/* Root */}
      <div style={{
        position:'fixed', inset:0, zIndex:999999,
        background: s.gradient,
        transition:'background .55s ease, opacity .35s ease',
        opacity: visible ? 1 : 0,
        animation: visible ? 'ob-enter .45s ease both' : 'none',
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        overflow:'hidden',
      }}>

        {/* Glow blob */}
        <div style={{
          position:'absolute', width:'600px', height:'600px', borderRadius:'50%',
          background:`radial-gradient(circle, ${s.glow} 0%, transparent 65%)`,
          top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          pointerEvents:'none', animation:'ob-pulse 3.5s ease-in-out infinite',
        }} />

        {/* Particles */}
        {s.particles.map((e, i) => (
          <div key={i} style={{
            position:'absolute',
            left:`${8 + (i*16)%84}%`,
            top:`${12 + (i*19)%68}%`,
            fontSize:`${14 + (i%3)*6}px`,
            opacity:0,
            animation:`ob-float ${5+i*.7}s ease-in-out ${i*1.1}s infinite`,
            pointerEvents:'none', userSelect:'none',
          }}>{e}</div>
        ))}

        {/* Top bar */}
        <div style={{
          position:'absolute', top:0, left:0, right:0,
          padding:'env(safe-area-inset-top, 16px) 20px 12px',
          paddingTop:'max(env(safe-area-inset-top, 0px), 16px)',
          display:'flex', alignItems:'center', gap:'10px', zIndex:10,
        }}>
          {SCREENS.map((_,i) => (
            <div key={i} style={{
              flex:1, height:'3px', borderRadius:'3px',
              background:'rgba(255,255,255,.18)', overflow:'hidden',
            }}>
              <div style={{
                height:'100%', borderRadius:'3px', background:'#fff',
                width: i < cur ? '100%' : i === cur ? `${prog}%` : '0%',
                transition: i < cur ? 'none' : 'width .08s linear',
              }} />
            </div>
          ))}
          <button onClick={done} style={{
            background:'rgba(255,255,255,.14)', backdropFilter:'blur(8px)',
            border:'1px solid rgba(255,255,255,.22)', borderRadius:'50px',
            padding:'5px 14px', color:'#fff', fontSize:'.73rem', fontWeight:700,
            cursor:'pointer', fontFamily:'inherit', flexShrink:0, letterSpacing:'.3px',
          }}>Skip</button>
        </div>

        {/* Card */}
        <div
          key={cur}
          className={anim ? (dir==='n' ? 'ob-slide-n' : 'ob-slide-p') : ''}
          style={{
            width:'100%', maxWidth:'420px',
            padding:'0 24px',
            position:'relative', zIndex:5,
            display:'flex', flexDirection:'column', alignItems:'center',
          }}
        >
          {/* Icon */}
          <div style={{
            width:'96px', height:'96px', borderRadius:'50%',
            background:'rgba(255,255,255,.12)', backdropFilter:'blur(20px)',
            border:'2px solid rgba(255,255,255,.25)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:'2.8rem', marginBottom:'22px',
            boxShadow:`0 8px 40px ${s.glow}`,
            animation:'ob-pop .4s cubic-bezier(.34,1.56,.64,1) .05s both',
          }}>{s.icon}</div>

          {/* Tags */}
          <div style={{
            display:'flex', gap:'8px', marginBottom:'14px',
            animation:'ob-up .35s ease .1s both',
          }}>
            <span style={{
              background:`${s.accent}22`, border:`1px solid ${s.accent}55`,
              color:s.accent, fontSize:'.7rem', fontWeight:700,
              padding:'4px 13px', borderRadius:'50px',
              letterSpacing:'.8px', textTransform:'uppercase',
            }}>{s.tag}</span>
            <span style={{
              background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.18)',
              color:'rgba(255,255,255,.65)', fontSize:'.7rem', fontWeight:600,
              padding:'4px 13px', borderRadius:'50px',
            }}>{s.tagAm}</span>
          </div>

          {/* Title */}
          <div style={{ textAlign:'center', marginBottom:'10px', animation:'ob-up .35s ease .15s both' }}>
            <h1 style={{
              fontSize:'clamp(1.55rem,5vw,1.95rem)', fontWeight:900,
              color:'#fff', margin:0, lineHeight:1.18,
              whiteSpace:'pre-line', textShadow:'0 2px 24px rgba(0,0,0,.35)',
            }}>
              {cur===0 ? `Hi ${firstName}! ` : ''}{s.title}
            </h1>
            <p style={{ fontSize:'.82rem', color:'rgba(255,255,255,.42)', margin:'5px 0 0', fontWeight:500 }}>
              {s.titleAm}
            </p>
          </div>

          {/* Subtitle */}
          <div style={{ textAlign:'center', marginBottom:'22px', animation:'ob-up .35s ease .2s both' }}>
            <p style={{ fontSize:'.88rem', color:'rgba(255,255,255,.78)', margin:0, lineHeight:1.55 }}>
              {s.sub}
            </p>
            <p style={{ fontSize:'.76rem', color:'rgba(255,255,255,.38)', margin:'4px 0 0' }}>
              {s.subAm}
            </p>
          </div>

          {/* Feature pills */}
          <div style={{
            display:'flex', gap:'7px', justifyContent:'center',
            flexWrap:'wrap', marginBottom:'28px',
          }}>
            {s.features.map((f,i) => (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:'5px',
                background:'rgba(255,255,255,.1)', backdropFilter:'blur(10px)',
                border:'1px solid rgba(255,255,255,.14)',
                borderRadius:'50px', padding:'6px 13px',
                fontSize:'.76rem', fontWeight:600, color:'#fff',
                animation:`ob-up .35s ease ${.25+i*.07}s both`,
              }}>
                <span>{f.icon}</span><span>{f.text}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ width:'100%', animation:'ob-up .35s ease .38s both' }}>
            <button className="ob-cta" onClick={advance} style={{
              width:'100%', padding:'15px',
              background:`linear-gradient(135deg, ${s.accent}, ${s.accent}bb)`,
              border:'none', borderRadius:'15px',
              color:'#000', fontSize:'.97rem', fontWeight:800,
              cursor:'pointer', fontFamily:'inherit',
              boxShadow:`0 8px 28px ${s.glow}`,
              transition:'transform .2s ease, box-shadow .2s ease',
              display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
              marginBottom:'10px',
            }}>
              {isLast
                ? <><span>🚀</span><span>Get Started</span><span style={{opacity:.55,fontSize:'.82rem'}}>/ ጀምር</span></>
                : <><span>Continue</span><span style={{opacity:.55,fontSize:'.82rem'}}>/ ቀጣይ</span><span>→</span></>
              }
            </button>
            {cur > 0 && (
              <button onClick={back} style={{
                width:'100%', padding:'8px', background:'transparent', border:'none',
                color:'rgba(255,255,255,.35)', fontSize:'.8rem',
                cursor:'pointer', fontFamily:'inherit', transition:'color .2s',
              }}
                onMouseEnter={e=>(e.currentTarget.style.color='rgba(255,255,255,.75)')}
                onMouseLeave={e=>(e.currentTarget.style.color='rgba(255,255,255,.35)')}
              >← Back</button>
            )}
          </div>
        </div>

        {/* Bottom */}
        <div style={{
          position:'absolute', bottom:0, left:0, right:0,
          paddingBottom:'max(env(safe-area-inset-bottom,0px),20px)',
          display:'flex', flexDirection:'column', alignItems:'center', gap:'12px',
          zIndex:5,
        }}>
          {/* Dot nav */}
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            {SCREENS.map((_,i) => (
              <button key={i} onClick={() => { if(!anim){ setDir(i>cur?'n':'p'); setAnim(true); setTimeout(()=>{setCur(i);setAnim(false)},320) } }} style={{
                width: i===cur ? '22px' : '7px',
                height:'7px', borderRadius:'50px',
                background: i===cur ? s.accent : 'rgba(255,255,255,.3)',
                border:'none', cursor:'pointer', padding:0,
                transition:'all .3s ease',
              }} />
            ))}
          </div>
          {/* Branding */}
          <p style={{
            fontSize:'.68rem', color:'rgba(255,255,255,.3)',
            margin:0, letterSpacing:'.5px', textAlign:'center',
          }}>
            📍 Hafa Market · Smart Shopping, Simplified · 🇪🇹
          </p>
        </div>

        {/* Ethiopian flag strip at very bottom */}
        <div style={{
          position:'absolute', bottom:0, left:0, right:0,
          height:'3px', display:'flex',
        }}>
          <div style={{flex:1,background:'#078930'}}/>
          <div style={{flex:1,background:'#FCD116'}}/>
          <div style={{flex:1,background:'#DA121A'}}/>
        </div>
      </div>
    </>
  )
}

export default function WelcomeOnboarding({ userName, onDone }: Props) {
  return createPortal(<Content userName={userName} onDone={onDone} />, document.body)
}
