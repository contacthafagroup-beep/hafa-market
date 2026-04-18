import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useQuery } from '@tanstack/react-query'
import { setUser, setLoading, logout } from '@/store/slices/authSlice'
import { authService } from '@/services/auth.service'
import type { RootState } from '@/store'
import api from '@/lib/api'

export function useAuth() {
  const dispatch = useDispatch()
  const { user, accessToken } = useSelector((s: RootState) => s.auth)

  const { data, isError, isFetching, isSuccess } = useQuery({
    queryKey: ['me'],
    queryFn:  () => authService.getMe().then(r => r.data.user || r.data.data),
    enabled:  !!accessToken,
    retry:    false,
    staleTime: 1000 * 60 * 5,
  })

  useEffect(() => {
    if (isSuccess && data) {
      dispatch(setUser(data))
      // Register FCM token for push notifications (fire-and-forget)
      import('@/lib/firebase').then(({ registerFCMToken }) => {
        registerFCMToken((token) => api.patch('/users/me/fcm-token', { fcmToken: token })).catch(() => {})
      }).catch(() => {})
    }
  }, [isSuccess, data, dispatch])

  useEffect(() => {
    if (isError) {
      localStorage.removeItem('accessToken')
      dispatch(logout())
    }
  }, [isError, dispatch])

  // isLoading: true only when we have a token but no user yet (initial load)
  // Once user is set OR there's no token, loading is done
  const isLoading = !!accessToken && !user && isFetching

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isSeller:  user?.role === 'SELLER',
    isAdmin:   user?.role === 'ADMIN',
    logout:    () => {
      authService.logout().catch(() => {})
      dispatch(logout())
    },
  }
}
