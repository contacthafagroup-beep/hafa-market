import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

export function useOffline() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => {
      setIsOffline(true)
      toast.error('📡 You\'re offline. Showing cached content.', { id: 'offline', duration: Infinity })
    }
    const goOnline = () => {
      setIsOffline(false)
      toast.success('✅ Back online!', { id: 'offline', duration: 3000 })
    }

    window.addEventListener('offline', goOffline)
    window.addEventListener('online',  goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online',  goOnline)
    }
  }, [])

  return isOffline
}
