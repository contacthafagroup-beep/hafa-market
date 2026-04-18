import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Volume2, VolumeX, Play, Pause } from 'lucide-react'

interface Props {
  onClose: () => void
}

// Using a free Pexels/Pixabay video that fits the Ethiopian farm/market theme
// Replace VIDEO_URL with your actual video when ready
const VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4'
const VIDEO_POSTER = 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=1920&q=80'

function Overlay({ onClose }: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const [muted,   setMuted]   = useState(true)
  const [paused,  setPaused]  = useState(false)
  const [visible, setVisible] = useState(false)   // controls fade-in
  const [closing, setClosing] = useState(false)   // controls fade-out

  // Fade in on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Auto-close on scroll
  useEffect(() => {
    const handler = () => handleClose()
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const handleClose = () => {
    if (closing) return
    setClosing(true)
    setTimeout(() => onClose(), 500)
  }

  const toggleMute = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !muted
    setMuted(m => !m)
  }

  const togglePlay = () => {
    if (!videoRef.current) return
    if (paused) { videoRef.current.play(); setPaused(false) }
    else        { videoRef.current.pause(); setPaused(true) }
  }

  const opacity  = closing ? 0 : visible ? 1 : 0
  const scale    = closing ? 1.04 : visible ? 1 : 0.96
  const blur     = closing ? '8px' : visible ? '0px' : '8px'

  return (
    <>
      <style>{`
        @keyframes storyFadeUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes storyPulse {
          0%,100% { opacity:.7; }
          50%      { opacity:1; }
        }
        .story-text-en { animation: storyFadeUp .6s ease .4s both; }
        .story-text-am { animation: storyFadeUp .6s ease .6s both; }
        .story-controls { animation: storyFadeUp .5s ease .3s both; }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 999998,
          background: 'rgba(0,0,0,0.92)',
          opacity, transition: 'opacity .5s ease',
        }}
      />

      {/* Video container */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 999999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity,
          transform: `scale(${scale})`,
          filter: `blur(${blur})`,
          transition: 'opacity .5s ease, transform .5s cubic-bezier(.22,1,.36,1), filter .5s ease',
          pointerEvents: closing ? 'none' : 'auto',
        }}
      >
        {/* Video */}
        <video
          ref={videoRef}
          src={VIDEO_URL}
          poster={VIDEO_POSTER}
          autoPlay
          muted
          playsInline
          loop
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
          }}
        />

        {/* Dark gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.2) 50%, rgba(0,0,0,.4) 100%)',
          pointerEvents: 'none',
        }} />

        {/* Close button */}
        <button
          onClick={handleClose}
          style={{
            position: 'absolute', top: '24px', right: '24px',
            width: '44px', height: '44px', borderRadius: '50%',
            background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,.25)',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background .2s, transform .2s',
            zIndex: 10,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.28)'; (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.15)'; (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
        >
          <X size={20} />
        </button>

        {/* Controls — bottom right */}
        <div className="story-controls" style={{
          position: 'absolute', bottom: '32px', right: '28px',
          display: 'flex', gap: '10px', zIndex: 10,
        }}>
          <button onClick={togglePlay} style={{
            width: '42px', height: '42px', borderRadius: '50%',
            background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,.2)',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background .2s',
          }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.28)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.15)'}
          >
            {paused ? <Play size={17} fill="#fff" /> : <Pause size={17} fill="#fff" />}
          </button>
          <button onClick={toggleMute} style={{
            width: '42px', height: '42px', borderRadius: '50%',
            background: 'rgba(255,255,255,.15)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,.2)',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background .2s',
          }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.28)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.15)'}
          >
            {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
        </div>

        {/* Story text — bottom left */}
        <div style={{
          position: 'absolute', bottom: '32px', left: '32px',
          maxWidth: '520px', zIndex: 10,
        }}>
          {/* Hafa Market badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(46,125,50,.7)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(74,222,128,.3)',
            borderRadius: '50px', padding: '5px 14px',
            marginBottom: '12px',
            animation: 'storyFadeUp .5s ease .2s both',
          }}>
            <span style={{ fontSize: '.75rem', fontWeight: 700, color: '#4ade80', letterSpacing: '.5px' }}>
              🌿 HAFA MARKET
            </span>
            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#4ade80', animation: 'storyPulse 2s infinite' }} />
          </div>

          <p className="story-text-en" style={{
            fontSize: 'clamp(1.1rem, 2.5vw, 1.6rem)',
            fontWeight: 800, color: '#fff',
            lineHeight: 1.3, margin: '0 0 8px',
            textShadow: '0 2px 20px rgba(0,0,0,.5)',
          }}>
            "Connecting Ethiopia's farmers<br/>to your table."
          </p>

          <p className="story-text-am" style={{
            fontSize: 'clamp(.85rem, 1.8vw, 1.05rem)',
            fontWeight: 500, color: 'rgba(255,255,255,.7)',
            lineHeight: 1.5, margin: 0,
            textShadow: '0 1px 10px rgba(0,0,0,.5)',
          }}>
            "የኢትዮጵያ ገበሬዎችን ከእርሻ ወደ ገበያ እናገናኛለን"
          </p>
        </div>

        {/* Hafa logo watermark — top left */}
        <div style={{
          position: 'absolute', top: '24px', left: '28px',
          display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'storyFadeUp .5s ease .1s both',
          zIndex: 10,
        }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'rgba(46,125,50,.8)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem',
          }}>🌿</div>
          <div>
            <p style={{ color: '#fff', fontWeight: 800, fontSize: '.9rem', margin: 0, lineHeight: 1 }}>Hafa Market</p>
            <p style={{ color: 'rgba(255,255,255,.5)', fontSize: '.68rem', margin: 0 }}>Our Story</p>
          </div>
        </div>

        {/* ESC hint */}
        <div style={{
          position: 'absolute', top: '28px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,.4)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: '50px', padding: '4px 14px',
          color: 'rgba(255,255,255,.4)', fontSize: '.7rem',
          animation: 'storyFadeUp .5s ease .8s both',
          zIndex: 10,
        }}>
          Press <kbd style={{ background: 'rgba(255,255,255,.15)', padding: '1px 6px', borderRadius: '4px', fontSize: '.68rem' }}>ESC</kbd> or click outside to close
        </div>
      </div>
    </>
  )
}

export default function StoryVideoOverlay({ onClose }: Props) {
  return createPortal(<Overlay onClose={onClose} />, document.body)
}
