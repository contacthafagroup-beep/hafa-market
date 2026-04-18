import { useDispatch, useSelector } from 'react-redux'
import { useEffect } from 'react'
import toast from 'react-hot-toast'
import { addItem, removeItem, updateQty, clearCart, setCartOpen, selectCartItems, selectCartCount, selectCartTotal, selectCartIsOpen } from '@/store/slices/cartSlice'
import { analytics } from '@/lib/analytics'
import { useAuth } from './useAuth'
import api from '@/lib/api'
import type { Product } from '@/types'

function haptic(type: 'light' | 'medium' | 'success' | 'error') {
  try {
    const tg = (window as any).Telegram?.WebApp?.HapticFeedback
    if (!tg) return
    if (type === 'success' || type === 'error') tg.notificationOccurred(type)
    else tg.impactOccurred(type)
  } catch {}
}

// Sync cart item to backend — SET quantity (not increment, to avoid duplicates)
function syncCartItem(productId: string, quantity: number) {
  const token = localStorage.getItem('accessToken')
  if (!token) return
  api.post('/cart/sync', { productId, quantity }).catch(() => {})
}

function removeCartItem(productId: string) {
  const token = localStorage.getItem('accessToken')
  if (!token) return
  api.delete(`/cart/${productId}`).catch(() => {})
}

export function useCart() {
  const dispatch = useDispatch()
  const { isAuthenticated } = useAuth()
  const items    = useSelector(selectCartItems)
  const count    = useSelector(selectCartCount)
  const total    = useSelector(selectCartTotal)
  const isOpen   = useSelector(selectCartIsOpen)

  return {
    items, count, total, isOpen,
    add: (product: Product, quantity = 1) => {
      dispatch(addItem({ product, quantity }))
      haptic('medium')
      analytics.addToCart(product.id, (product as any).seller?.id)
      if (isAuthenticated) syncCartItem(product.id, quantity)
      toast.success(`${product.name} added to cart!`, { icon: '🛒' })
    },
    remove: (productId: string) => {
      dispatch(removeItem(productId))
      haptic('light')
      if (isAuthenticated) removeCartItem(productId)
    },
    updateQty: (productId: string, quantity: number) => {
      dispatch(updateQty({ productId, quantity }))
      haptic('light')
      if (isAuthenticated) syncCartItem(productId, quantity)
    },
    clear: () => {
      dispatch(clearCart())
      haptic('error')
    },
    // Trigger abandoned cart tracking when user leaves checkout
    trackAbandonment: () => {
      if (isAuthenticated) {
        api.post('/features/cart/abandon').catch(() => {})
      }
    },
    open:   () => dispatch(setCartOpen(true)),
    close:  () => dispatch(setCartOpen(false)),
    toggle: () => dispatch(setCartOpen(!isOpen)),
  }
}
