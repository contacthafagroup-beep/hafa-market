/**
 * useCROSignals — Conversion Rate Optimization signals
 *
 * Fetches live urgency data for a product and subscribes to real-time
 * viewer count updates via Socket.IO.
 *
 * Returns: viewersNow, ordersToday, recentBuyers, stock, stockTier,
 *          priceDrop, flashEndsAt
 */

import { useEffect, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { io as socketIO, Socket } from 'socket.io-client'
import api from '@/lib/api'

export interface CROSignals {
  viewersNow:   number
  ordersToday:  number
  recentBuyers: string[]
  stock:        number
  stockTier:    'OUT' | 'CRITICAL' | 'LOW' | 'MEDIUM' | 'AMPLE'
  unit:         string
  priceDrop:    number
  flashEndsAt:  string | null
}

export function useCROSignals(productId: string | undefined) {
  const [viewersNow, setViewersNow] = useState<number | null>(null)
  const socketRef = useRef<Socket | null>(null)

  // Fetch initial signals (stale 60s — viewer count is updated via socket)
  const { data } = useQuery<CROSignals>({
    queryKey: ['cro', productId],
    queryFn: () => api.get(`/products/${productId}/cro`).then(r => r.data.data),
    enabled: !!productId,
    staleTime: 60_000,
    refetchInterval: 120_000, // refresh ordersToday every 2 min
  })

  // Seed local viewer count from initial fetch
  useEffect(() => {
    if (data?.viewersNow != null) setViewersNow(data.viewersNow)
  }, [data?.viewersNow])

  // Socket.IO — join product room, listen for live viewer updates
  useEffect(() => {
    if (!productId) return

    const token = localStorage.getItem('accessToken')
    const socket = socketIO(
      import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5001',
      { transports: ['websocket'], auth: { token: token || '' }, reconnectionAttempts: 3 }
    )
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('product:join', productId)
    })

    socket.on('cro:viewers', (payload: { productId: string; count: number }) => {
      if (payload.productId === productId) setViewersNow(payload.count)
    })

    // Decrement on page leave — use sendBeacon for reliability on tab close
    const handleUnload = () => {
      const url = `${import.meta.env.VITE_API_URL}/products/${productId}/cro/leave`
      navigator.sendBeacon(url)
      socket.emit('product:leave', productId)
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      socket.emit('product:leave', productId)
      socket.disconnect()
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [productId])

  if (!data) return null

  return {
    ...data,
    // Override viewersNow with the live socket value if available
    viewersNow: viewersNow ?? data.viewersNow,
  }
}
