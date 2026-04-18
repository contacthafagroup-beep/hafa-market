import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={cn(
        'fixed bottom-7 right-7 z-40 w-12 h-12 bg-green-primary text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:bg-green-dark hover:-translate-y-1',
        visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none translate-y-4'
      )}>
      <ArrowUp size={20} />
    </button>
  )
}
