import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userService } from '@/services/user.service'
import { useAuth } from './useAuth'
import toast from 'react-hot-toast'

export function useWishlist() {
  const { isAuthenticated } = useAuth()
  const qc = useQueryClient()
  const [localWishlist, setLocalWishlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('wishlist') || '[]') } catch { return [] }
  })

  const { data } = useQuery({
    queryKey: ['wishlist'],
    queryFn:  () => userService.getWishlist().then(r => r.data.data),
    enabled:  isAuthenticated,
  })

  const serverIds = data?.map((i: { productId: string }) => i.productId) || []
  const wishlistIds = isAuthenticated ? serverIds : localWishlist

  const { mutate: toggle } = useMutation({
    mutationFn: (productId: string) => userService.toggleWishlist(productId),
    onSuccess: (_, productId) => {
      qc.invalidateQueries({ queryKey: ['wishlist'] })
      const inList = wishlistIds.includes(productId)
      toast.success(inList ? 'Removed from wishlist' : '💚 Saved to wishlist!')
    },
  })

  const toggleLocal = (productId: string) => {
    setLocalWishlist(prev => {
      const next = prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]
      localStorage.setItem('wishlist', JSON.stringify(next))
      toast.success(prev.includes(productId) ? 'Removed from wishlist' : '💚 Saved to wishlist!')
      return next
    })
  }

  return {
    wishlistIds,
    isInWishlist: (id: string) => wishlistIds.includes(id),
    toggle: isAuthenticated ? toggle : toggleLocal,
  }
}
