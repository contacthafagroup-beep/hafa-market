import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { Eye, EyeOff, Mail, Lock, Phone, ArrowLeft } from 'lucide-react'
import { setCredentials } from '@/store/slices/authSlice'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import type { ConfirmationResult } from 'firebase/auth'

type Method = 'email' | 'phone'
type PhoneStep = 'number' | 'otp'

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

export default function Login() {
  const dispatch  = useDispatch()
  const navigate  = useNavigate()
  const [method, setMethod]         = useState<Method>('email')
  const [phoneStep, setPhoneStep]   = useState<PhoneStep>('number')
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [phone, setPhone]           = useState('')
  const [otp, setOtp]               = useState('')
  const [loading, setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const confirmationRef = useRef<ConfirmationResult | null>(null)

  const handleAfterLogin = (user: any, accessToken: string) => {
    localStorage.setItem('accessToken', accessToken)
    dispatch(setCredentials({ user, accessToken }))
    toast.success(`Welcome back, ${user.name}! 👋`)
    if (user.role === 'ADMIN')  { navigate('/admin',     { replace: true }); return }
    if (user.role === 'SELLER') { navigate('/dashboard', { replace: true }); return }
    navigate('/', { replace: true })
  }

  // ── Email login ──────────────────────────────────────────────────────────
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Please enter email and password'); return }
    setLoading(true)
    localStorage.removeItem('accessToken')
    try {
      const res = await api.post('/auth/login', { email, password })
      handleAfterLogin(res.data.user, res.data.accessToken)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid email or password')
    } finally { setLoading(false) }
  }

  // ── Phone: send OTP via Firebase ─────────────────────────────────────────
  const handleSendOtp = async () => {
    const trimmed = phone.trim()
    if (!trimmed) { toast.error('Enter your phone number'); return }
    if (trimmed.length < 9) { toast.error('Enter a valid 9-10 digit phone number'); return }

    // User types local number (e.g. 0911000000 or 911000000)
    // We prepend +251 and strip leading 0
    let local = trimmed.replace(/^0/, '') // remove leading 0
    const normalized = '+251' + local

    setLoading(true)
    try {
      const { sendPhoneOtp } = await import('@/lib/firebase')
      const confirmation = await sendPhoneOtp(normalized, 'recaptcha-container-login')
      confirmationRef.current = confirmation
      setPhone(trimmed) // keep display as typed
      setPhoneStep('otp')
      toast.success('Verification code sent!')
    } catch (err: any) {
      console.error('Firebase phone error:', err)
      if (err.code === 'auth/invalid-phone-number') {
        toast.error('Invalid phone number. Try: 0911000000')
      } else if (err.code === 'auth/too-many-requests') {
        toast.error('Too many attempts. Please wait a few minutes.')
      } else {
        toast.error('Failed to send code. Please try again.')
      }
    } finally { setLoading(false) }
  }

  // ── Phone: verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { toast.error('Enter the 6-digit code'); return }
    if (!confirmationRef.current) { toast.error('Session expired. Please resend code.'); setPhoneStep('number'); return }
    setLoading(true)
    try {
      const { verifyPhoneOtp } = await import('@/lib/firebase')
      const idToken = await verifyPhoneOtp(confirmationRef.current, otp)
      const res = await api.post('/auth/firebase-phone', { idToken })
      handleAfterLogin(res.data.user, res.data.accessToken)
    } catch (err: any) {
      if (err.code === 'auth/invalid-verification-code') {
        toast.error('Wrong code. Please try again.')
      } else if (err.code === 'auth/code-expired') {
        toast.error('Code expired. Please resend.')
        setPhoneStep('number')
      } else {
        toast.error(err?.response?.data?.message || 'Verification failed')
      }
    } finally { setLoading(false) }
  }

  // ── Google login ─────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      const { signInWithGoogle } = await import('@/lib/firebase')
      const googleUser = await signInWithGoogle()
      const res = await api.post('/auth/google', googleUser)
      handleAfterLogin(res.data.user, res.data.accessToken)
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') return
      toast.error(err?.response?.data?.message || 'Google sign-in failed')
    } finally { setGoogleLoading(false) }
  }

  return (
    <div>
      <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Welcome Back</h2>
      <p className="text-gray-400 text-sm mb-6">Sign in to your Hafa Market account</p>

      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container-login" />

      {/* Google */}
      <button onClick={handleGoogle} disabled={googleLoading} style={{
        width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'10px',
        padding:'11px 16px', border:'2px solid #e5e7eb', borderRadius:'12px',
        background:'#fff', cursor:'pointer', fontFamily:'inherit',
        fontSize:'.9rem', fontWeight:600, color:'#374151',
        transition:'border-color .2s', marginBottom:'16px', opacity: googleLoading ? .7 : 1,
      }}
        onMouseEnter={e => (e.currentTarget.style.borderColor='#2E7D32')}
        onMouseLeave={e => (e.currentTarget.style.borderColor='#e5e7eb')}
      >
        {googleLoading
          ? <div style={{ width:'18px', height:'18px', border:'2px solid #e5e7eb', borderTopColor:'#2E7D32', borderRadius:'50%', animation:'spin .7s linear infinite' }} />
          : <GoogleIcon />}
        Continue with Google
      </button>

      {/* Divider */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
        <div style={{ flex:1, height:'1px', background:'#e5e7eb' }} />
        <span style={{ fontSize:'.78rem', color:'#9ca3af', fontWeight:500 }}>or sign in with</span>
        <div style={{ flex:1, height:'1px', background:'#e5e7eb' }} />
      </div>

      {/* Method tabs */}
      <div style={{ display:'flex', background:'#f3f4f6', borderRadius:'12px', padding:'4px', marginBottom:'20px' }}>
        {([['email','📧 Email'],['phone','📱 Phone']] as const).map(([m, label]) => (
          <button key={m} onClick={() => { setMethod(m); setPhoneStep('number'); setOtp('') }}
            style={{
              flex:1, padding:'8px', borderRadius:'9px', border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:'.85rem', fontWeight:600, transition:'all .2s',
              background: method===m ? '#fff' : 'transparent',
              color: method===m ? '#2E7D32' : '#6b7280',
              boxShadow: method===m ? '0 1px 4px rgba(0,0,0,.1)' : 'none',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Email */}
      {method === 'email' && (
        <form onSubmit={handleEmailLogin} className="space-y-4" autoComplete="off">
          <Input label="Email Address" type="email" value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            placeholder="your@email.com" leftIcon={<Mail size={16} />} autoComplete="off" />
          <Input label="Password" type={showPw ? 'text' : 'password'} value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            placeholder="••••••••" leftIcon={<Lock size={16} />}
            rightIcon={<button type="button" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={16}/> : <Eye size={16}/>}</button>} />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" className="accent-green-primary" /> Remember me
            </label>
            <Link to="/forgot-password" className="text-sm text-green-primary font-semibold hover:underline">Forgot password?</Link>
          </div>
          <Button type="submit" fullWidth size="lg" loading={loading}>Login to Account</Button>
        </form>
      )}

      {/* Phone */}
      {method === 'phone' && (
        <div className="space-y-4">
          {phoneStep === 'number' ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                <div style={{ display:'flex', border:'2px solid #e5e7eb', borderRadius:'12px', overflow:'hidden', transition:'border-color .2s' }}
                  onFocusCapture={e => (e.currentTarget.style.borderColor='#2E7D32')}
                  onBlurCapture={e => (e.currentTarget.style.borderColor='#e5e7eb')}
                >
                  {/* Fixed country code */}
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'0 12px', background:'#f3f4f6', borderRight:'2px solid #e5e7eb', flexShrink:0 }}>
                    <span style={{ fontSize:'1.1rem' }}>🇪🇹</span>
                    <span style={{ fontSize:'.9rem', fontWeight:700, color:'#374151' }}>+251</span>
                  </div>
                  <input
                    type="tel" inputMode="numeric"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g,'').slice(0, 9))}
                    onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSendOtp()}
                    placeholder="0911000000"
                    maxLength={10}
                    style={{ flex:1, border:'none', outline:'none', padding:'12px 14px', fontSize:'.95rem', fontFamily:'inherit', background:'transparent' }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">Enter your number starting with 09 or 07</p>
              </div>
              <Button fullWidth size="lg" loading={loading} onClick={handleSendOtp} disabled={phone.length < 9}>
                Send Verification Code
              </Button>
            </>
          ) : (
            <>
              <button onClick={() => { setPhoneStep('number'); setOtp(''); confirmationRef.current = null }}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-green-primary transition-colors">
                <ArrowLeft size={14} /> Change number
              </button>
              <p className="text-sm text-gray-600">
                Code sent to <strong className="text-gray-800">{phone}</strong>
              </p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">6-digit code</label>
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()}
                  placeholder="000000" autoFocus
                  style={{
                    width:'100%', padding:'14px 20px', fontSize:'1.8rem', fontWeight:800,
                    letterSpacing:'14px', textAlign:'center', border:'2px solid #e5e7eb',
                    borderRadius:'14px', outline:'none', background:'#f9fafb',
                    fontFamily:'monospace', boxSizing:'border-box' as const,
                  }}
                  onFocus={e => e.target.style.borderColor='#2E7D32'}
                  onBlur={e => e.target.style.borderColor='#e5e7eb'}
                />
              </div>
              <Button fullWidth size="lg" loading={loading} onClick={handleVerifyOtp} disabled={otp.length !== 6}>
                Verify & Sign In
              </Button>
              <button onClick={() => { setOtp(''); setPhoneStep('number') }}
                className="w-full text-sm text-gray-400 hover:text-green-primary transition-colors py-1">
                Resend code
              </button>
            </>
          )}
        </div>
      )}

      <p className="text-center text-sm text-gray-500 mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-green-primary font-bold hover:underline">Sign Up Free</Link>
      </p>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
