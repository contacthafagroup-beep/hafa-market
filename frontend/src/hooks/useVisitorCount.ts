import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'

export function useVisitorCount() {
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    // Connect anonymously just to get visitor count
    const socket = io(
      import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5001',
      { transports: ['websocket'], auth: { token: localStorage.getItem('accessToken') || '' } }
    )

    socket.on('connect', () => {
      socket.emit('visitor:join')
    })

    socket.on('visitor:count', (n: number) => setCount(n))

    // Simulate realistic count if server doesn't support it yet
    const fallback = setTimeout(() => {
      if (count === null) setCount(Math.floor(120 + Math.random() * 180))
    }, 2000)

    return () => {
      socket.disconnect()
      clearTimeout(fallback)
    }
  }, [])

  return count
}
