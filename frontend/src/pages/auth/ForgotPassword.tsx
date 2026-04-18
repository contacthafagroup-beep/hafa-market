import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, ArrowLeft, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import toast from 'react-hot-toast'
import api from '@/lib/api'

type Step = 'email' | 'otp' | 'password' | 'done'

export default function ForgotPassword() {
  const navigate  = useNavigate()
  const [step, setStep]       = useState<Step>('email')
  const [email, setEmail]     = useState('')
  const [code, setCode]       = useState('')   // single string, no array
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  const sendOtp = async () => {
    if (!email) { toast.error('Please enter your email'); return }
    setLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setCode('')
      setStep('otp')
      toast.success('Reset code sent! Check your email.')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to send reset code')
    } finally { setLoading(false) }
  }

  // ── Step 2: Verify OTP (client-side only — just check length) ─────────────
  const verifyOtp = () => {
    const trimmed = code.trim()
    if (trimmed.length !== 6 || !/^\d{6}$/.test(trimmed)) {
      toast.error('Enter the 6-digit code from your email')
      return
    }
    setStep('password')
  }

  // ── Step 3: Reset Password ────────────────────────────────────────────────
  const resetPassword = async () => {
    if (password.length < 8)        { toast.error('Password must be at least 8 characters'); return }
    if (!/[A-Z]/.test(password))    { toast.error('Password must contain at least one uppercase letter'); return }
    if (!/[0-9]/.test(password))    { toast.error('Password must contain at least one number'); return }
    if (password !== confirm)       { toast.error('Passwords do not match'); return }

    const trimmedCode = code.trim()
    console.log('[Reset] Sending:', { email, code: trimmedCode })

    setLoading(true)
    try {
      await api.post('/auth/reset-password', {
        email,
        code: trimmedCode,
        newPassword: password,
      })
      setStep('done')
      toast.success('Password reset successfully!')
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Reset failed'
      toast.error(msg)
      if (msg.toLowerCase().includes('invalid')) {
        setStep('otp')
        setCode('')
      }
    } finally { setLoading(false) }
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done') return (
    <div className="text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={40} className="text-green-primary" />
      </div>
      <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Password Reset!</h2>
      <p className="text-gray-400 text-sm mb-6">Your password has been updated. You can now log in.</p>
      <Button fullWidth size="lg" onClick={() => navigate('/login')}>Go to Login</Button>
    </div>
  )

  return (
    <div>
      <Link to="/login" className="flex items-center gap-1 text-sm text-gray-400 hover:text-green-primary mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Login
      </Link>

      {/* Progress */}
      <div className="flex items-center gap-2 mb-6">
        {(['email', 'otp', 'password'] as Step[]).map((s, i) => {
          const steps = ['email', 'otp', 'password']
          const current = steps.indexOf(step)
          const done = current > i
          const active = current === i
          return (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
                done ? 'bg-green-primary text-white' :
                active ? 'bg-green-primary text-white ring-4 ring-green-100' :
                'bg-gray-100 text-gray-400'
              }`}>
                {done ? '✓' : i + 1}
              </div>
              {i < 2 && <div className={`flex-1 h-1 rounded-full ${done ? 'bg-green-primary' : 'bg-gray-100'}`} />}
            </div>
          )
        })}
      </div>

      {/* Step 1 — Email */}
      {step === 'email' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Forgot Password?</h2>
            <p className="text-gray-400 text-sm">Enter your email and we'll send a 6-digit reset code.</p>
          </div>
          <Input label="Email Address" type="email" placeholder="your@email.com"
            leftIcon={<Mail size={16} />} value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && sendOtp()} />
          <Button fullWidth size="lg" loading={loading} onClick={sendOtp} disabled={!email}>
            Send Reset Code
          </Button>
        </div>
      )}

      {/* Step 2 — OTP */}
      {step === 'otp' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Enter Reset Code</h2>
            <p className="text-gray-400 text-sm">
              We sent a 6-digit code to <strong className="text-gray-700">{email}</strong>
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '.875rem', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
              6-digit code
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={e => e.key === 'Enter' && verifyOtp()}
              placeholder="000000"
              autoFocus
              style={{
                width: '100%',
                padding: '16px 20px',
                fontSize: '2rem',
                fontWeight: 800,
                letterSpacing: '16px',
                textAlign: 'center',
                border: '2px solid #e5e7eb',
                borderRadius: '16px',
                outline: 'none',
                background: '#f9fafb',
                color: '#111827',
                boxSizing: 'border-box' as const,
                fontFamily: 'monospace',
              }}
              onFocus={e => e.target.style.borderColor = '#2E7D32'}
              onBlur={e => e.target.style.borderColor = '#e5e7eb'}
            />
            <p style={{ fontSize: '.75rem', color: '#9ca3af', textAlign: 'center', marginTop: '8px' }}>
              Check spam folder if not in inbox · Valid for 30 minutes
            </p>
          </div>

          <Button fullWidth size="lg" onClick={verifyOtp} disabled={code.length !== 6}>
            Verify Code
          </Button>

          <p className="text-center text-sm text-gray-400">
            Didn't receive it?{' '}
            <button onClick={() => { setCode(''); sendOtp() }}
              className="text-green-primary font-semibold hover:underline bg-transparent border-none cursor-pointer p-0">
              Resend code
            </button>
          </p>
        </div>
      )}

      {/* Step 3 — New Password */}
      {step === 'password' && (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Set New Password</h2>
            <p className="text-gray-400 text-sm">Code: <strong className="text-green-primary font-mono">{code}</strong> · Choose a strong password.</p>
          </div>

          <Input label="New Password" type={showPw ? 'text' : 'password'}
            placeholder="Min 8 chars, 1 uppercase, 1 number"
            leftIcon={<Lock size={16} />} value={password}
            onChange={e => setPassword(e.target.value)}
            rightIcon={
              <button type="button" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            } />

          <Input label="Confirm Password" type={showPw ? 'text' : 'password'}
            placeholder="Repeat your new password"
            leftIcon={<Lock size={16} />} value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && resetPassword()} />

          {/* Strength hints */}
          <div className="space-y-1">
            {[
              { ok: password.length >= 8,                    text: 'At least 8 characters' },
              { ok: /[A-Z]/.test(password),                  text: 'One uppercase letter' },
              { ok: /[0-9]/.test(password),                  text: 'One number' },
              { ok: password === confirm && confirm.length > 0, text: 'Passwords match' },
            ].map(r => (
              <div key={r.text} className="flex items-center gap-2 text-xs">
                <span className={r.ok ? 'text-green-primary' : 'text-gray-300'}>{r.ok ? '✓' : '○'}</span>
                <span className={r.ok ? 'text-green-700' : 'text-gray-400'}>{r.text}</span>
              </div>
            ))}
          </div>

          <Button fullWidth size="lg" loading={loading} onClick={resetPassword}
            disabled={password.length < 8 || password !== confirm}>
            Reset Password
          </Button>
        </div>
      )}
    </div>
  )
}
