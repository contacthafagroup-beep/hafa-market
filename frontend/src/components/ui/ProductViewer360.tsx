import { useState, useRef, useEffect, useCallback } from 'react'
import { RotateCcw, ZoomIn, ZoomOut, Maximize2, X } from 'lucide-react'

interface Props {
  images: string[]
  productName: string
}

export default function ProductViewer360({ images, productName }: Props) {
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSpinning, setIsSpinning] = useState(false)
  const [spinDir, setSpinDir] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const spinRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const totalFrames = images.length

  // Auto-spin on mount for 2 seconds to show it's interactive
  useEffect(() => {
    if (totalFrames < 2) return
    const timer = setTimeout(() => {
      let frame = 0
      const interval = setInterval(() => {
        frame++
        setCurrentFrame(f => (f + 1) % totalFrames)
        if (frame >= totalFrames) clearInterval(interval)
      }, 80)
    }, 500)
    return () => clearTimeout(timer)
  }, [totalFrames])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true)
    setStartX(e.clientX)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || totalFrames < 2) return
    const diff = e.clientX - startX
    const sensitivity = 8
    if (Math.abs(diff) > sensitivity) {
      const direction = diff > 0 ? -1 : 1
      setCurrentFrame(f => {
        const next = (f + direction + totalFrames) % totalFrames
        return next
      })
      setStartX(e.clientX)
    }
  }, [isDragging, startX, totalFrames])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true)
    setStartX(e.touches[0].clientX)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || totalFrames < 2) return
    const diff = e.touches[0].clientX - startX
    const sensitivity = 6
    if (Math.abs(diff) > sensitivity) {
      const direction = diff > 0 ? -1 : 1
      setCurrentFrame(f => (f + direction + totalFrames) % totalFrames)
      setStartX(e.touches[0].clientX)
    }
  }, [isDragging, startX, totalFrames])

  const toggleSpin = () => {
    if (isSpinning) {
      if (spinRef.current) clearInterval(spinRef.current)
      setIsSpinning(false)
    } else {
      setIsSpinning(true)
      spinRef.current = setInterval(() => {
        setCurrentFrame(f => (f + spinDir + totalFrames) % totalFrames)
      }, 60)
    }
  }

  useEffect(() => {
    return () => { if (spinRef.current) clearInterval(spinRef.current) }
  }, [])

  if (totalFrames < 2) return null

  const ViewerContent = () => (
    <div className="relative select-none">
      {/* Main image */}
      <div
        ref={containerRef}
        className={`relative overflow-hidden rounded-2xl bg-gray-50 ${isFullscreen ? 'h-[70vh]' : 'aspect-square'} cursor-grab active:cursor-grabbing`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}>
        <img
          src={images[currentFrame]}
          alt={`${productName} — view ${currentFrame + 1}`}
          className="w-full h-full object-cover transition-none"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center', userSelect: 'none' }}
          draggable={false}
        />

        {/* 360 badge */}
        <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-black px-2 py-1 rounded-full flex items-center gap-1">
          <RotateCcw size={11} /> 360°
        </div>

        {/* Frame indicator */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
          {images.map((_, i) => (
            <div key={i}
              className={`h-1 rounded-full transition-all ${i === currentFrame ? 'w-4 bg-white' : 'w-1 bg-white/40'}`} />
          ))}
        </div>

        {/* Drag hint */}
        {!isDragging && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-black/40 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
              ← Drag to rotate →
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-3 px-1">
        <div className="flex items-center gap-2">
          <button onClick={() => setZoom(z => Math.max(1, z - 0.25))} disabled={zoom <= 1}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-40">
            <ZoomOut size={14} />
          </button>
          <span className="text-xs font-bold text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} disabled={zoom >= 3}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-40">
            <ZoomIn size={14} />
          </button>
        </div>

        <button onClick={toggleSpin}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isSpinning ? 'bg-green-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <RotateCcw size={12} className={isSpinning ? 'animate-spin' : ''} />
          {isSpinning ? 'Stop' : 'Auto Spin'}
        </button>

        <button onClick={() => setIsFullscreen(true)}
          className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
          <Maximize2 size={14} />
        </button>
      </div>

      {/* Frame scrubber */}
      <div className="mt-2 px-1">
        <input type="range" min={0} max={totalFrames - 1} value={currentFrame}
          onChange={e => setCurrentFrame(parseInt(e.target.value))}
          className="w-full accent-green-primary h-1.5 rounded-full cursor-pointer" />
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>Frame {currentFrame + 1}/{totalFrames}</span>
          <span>← Drag image or slider →</span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <div className="group">
        <ViewerContent />
      </div>

      {/* Fullscreen modal */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setIsFullscreen(false)}>
          <div className="w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white font-bold">{productName} — 360° View</p>
              <button onClick={() => setIsFullscreen(false)} className="text-white/70 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <ViewerContent />
          </div>
        </div>
      )}
    </>
  )
}
