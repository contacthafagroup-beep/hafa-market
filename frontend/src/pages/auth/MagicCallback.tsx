import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { setCredentials } from '@/store/slices/authSlice'
import api from '@/lib/api'

export default function MagicCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()

  useEffect(() => {
    const token = params.get('token')
    if (!token) { navigate('/login'); return }

    localStorage.setItem('accessToken', token)
    api.defaults.headers.common.Authorization = `Bearer ${token}`

    // Fetch user profile
    api.get('/users/me').then(res => {
      const user = res.data.data || res.data.user
      dispatch(setCredentials({ user, accessToken: token }))
      navigate('/')
    }).catch(() => navigate('/login'))
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTopColor: '#2E7D32', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
      <p style={{ color: '#6b7280', fontFamily: 'Poppins, sans-serif' }}>Signing you in...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
