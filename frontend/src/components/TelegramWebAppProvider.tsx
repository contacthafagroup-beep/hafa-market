import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import { setCredentials } from '@/store/slices/authSlice'
import { useTelegram } from '@/hooks/useTelegram'
import api from '@/lib/api'

/**
 * Automatically authenticates the user when running inside Telegram WebApp.
 * Validates initData on the backend and returns a JWT — no login form needed.
 * Renders nothing — just handles auth silently.
 */
export default function TelegramWebAppProvider() {
  const dispatch  = useDispatch()
  const { isInTelegram, initData } = useTelegram()
  const attempted = useRef(false)

  useEffect(() => {
    if (!isInTelegram || !initData || attempted.current) return
    // Only attempt once
    attempted.current = true

    // Already logged in? Skip
    if (localStorage.getItem('accessToken')) return

    api.post('/auth/telegram-webapp', { initData })
      .then(res => {
        const { user, accessToken } = res.data
        if (user && accessToken) {
          localStorage.setItem('accessToken', accessToken)
          dispatch(setCredentials({ user, accessToken }))
        }
      })
      .catch(err => {
        console.warn('Telegram WebApp auto-login failed:', err?.response?.data?.message || err.message)
      })
  }, [isInTelegram, initData])

  return null
}
