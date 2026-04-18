import { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { User, Star, Camera, Loader, Lock, Eye, EyeOff, Send } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useDispatch } from 'react-redux'
import { setUser } from '@/store/slices/authSlice'
import { userService } from '@/services/user.service'
import { authService } from '@/services/auth.service'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import DailyCheckIn from '@/components/ui/DailyCheckIn'
import api from '@/lib/api'
import toast from 'react-hot-toast'

// ── Telegram Link Component ───────────────────────────────────────────────────
function TelegramLink() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [chatId, setChatId] = useState('')
  const [linking, setLinking] = useState(false)
  const isLinked = !!(user as any)?.telegramChatId

  const handleLink = async () => {
    if (!chatId.trim()) { toast.error('Enter your Telegram Chat ID'); return }
    setLinking(true)
    try {
      await api.post('/users/link-telegram', { telegramChatId: chatId.trim() })
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success('Telegram linked! You\'ll now get order updates on Telegram.')
      setChatId('')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to link')
    } finally { setLinking(false) }
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-6">
      <div className="flex items-center gap-3 mb-4">
        {/* Telegram icon */}
        <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'#0088cc', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.667l-2.95-.924c-.64-.203-.658-.64.136-.954l11.57-4.461c.537-.194 1.006.131.968.893z"/>
          </svg>
        </div>
        <div>
          <h3 className="font-extrabold text-gray-900">Telegram Notifications</h3>
          <p className="text-xs text-gray-400">Get order updates, deals & track orders on Telegram</p>
        </div>
        {isLinked && (
          <span className="ml-auto badge bg-green-100 text-green-700 text-xs">✓ Linked</span>
        )}
      </div>

      {isLinked ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-700 font-medium mb-2">✅ Your Telegram is linked!</p>
          <p className="text-xs text-gray-500 mb-3">You'll receive order updates, delivery notifications, and exclusive deals on Telegram.</p>
          <a href="https://t.me/HafaMarketBot" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 bg-[#0088cc] text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-[#0077b5] transition-colors">
            <Send size={14}/> Open Hafa Market Bot
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-bold mb-2">How to link:</p>
            <ol className="space-y-1 text-xs">
              <li>1. Open Telegram and search <strong>@HafaMarketBot</strong></li>
              <li>2. Send <code className="bg-blue-100 px-1 rounded">/start</code> to the bot</li>
              <li>3. The bot will show your Chat ID</li>
              <li>4. Paste it below and click Link</li>
            </ol>
          </div>
          <div className="flex gap-3">
            <Input label="Your Telegram Chat ID" placeholder="e.g. 123456789"
              value={chatId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChatId(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleLink()} />
          </div>
          <div className="flex gap-3">
            <Button onClick={handleLink} loading={linking} size="sm">
              <Send size={14}/> Link Telegram
            </Button>
            <a href="https://t.me/HafaMarketBot" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 border-2 border-[#0088cc] text-[#0088cc] rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors">
              Open Bot
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Account() {
  const { user } = useAuth()
  const dispatch = useDispatch()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [avatar, setAvatar] = useState(user?.avatar || '')

  const { register, handleSubmit } = useForm({
    defaultValues: { name: user?.name || '', email: user?.email || '', phone: user?.phone || '' }
  })

  const { mutate, isLoading } = useMutation({
    mutationFn: (data: object) => userService.updateProfile(data),
    onSuccess: (res) => {
      const updated = res.data.data || res.data.user
      if (updated) dispatch(setUser(updated))
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success('Profile updated!')
    },
  })

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/upload/image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const url = res.data.data.url
      setAvatar(url)
      // Save to profile immediately
      await userService.updateProfile({ avatar: url })
      qc.invalidateQueries({ queryKey: ['me'] })
      toast.success('Profile photo updated!')
    } catch {
      toast.error('Upload failed. Try again.')
    } finally {
      setUploading(false)
    }
  }

  const tier = (user?.loyaltyPoints || 0) >= 500 ? { label: '🥇 Gold', color: '#f59e0b' }
             : (user?.loyaltyPoints || 0) >= 200 ? { label: '🥈 Silver', color: '#6b7280' }
             : { label: '🥉 Bronze', color: '#b45309' }

  // Password change state
  const [showPwForm, setShowPwForm] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const setPw = (k: string, v: string) => setPwForm(f => ({ ...f, [k]: v }))

  const { mutate: changePw, isLoading: changingPw } = useMutation({
    mutationFn: () => authService.changePassword({ currentPassword: pwForm.current, newPassword: pwForm.newPw }),
    onSuccess: () => {
      toast.success('Password changed successfully!')
      setShowPwForm(false)
      setPwForm({ current: '', newPw: '', confirm: '' })
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to change password'),
  })

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-shrink-0">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gradient-to-br from-green-primary to-green-mid flex items-center justify-center">
              {avatar
                ? <img src={avatar} alt={user?.name} className="w-full h-full object-cover" />
                : <span className="text-white text-3xl font-black">{user?.name?.[0]?.toUpperCase()}</span>
              }
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-primary text-white rounded-full flex items-center justify-center shadow-md hover:bg-green-dark transition-colors"
              title="Change photo"
            >
              {uploading ? <Loader size={13} className="animate-spin" /> : <Camera size={13} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-gray-900">{user?.name}</h2>
            <p className="text-gray-400 text-sm">{user?.email || user?.phone}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="badge badge-green text-xs capitalize">{user?.role?.toLowerCase()}</span>
              {user?.isVerified && <span className="badge bg-blue-100 text-blue-600 text-xs">✓ Verified</span>}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit(d => mutate(d))} className="grid sm:grid-cols-2 gap-4">
          <Input label="Full Name" {...register('name')} />
          <Input label="Email" type="email" {...register('email')} />
          <Input label="Phone" type="tel" {...register('phone')} />
          <div className="sm:col-span-2 flex items-center gap-3">
            <Button type="submit" loading={isLoading}><User size={16} /> Save Changes</Button>
            <button type="button" onClick={() => setShowPwForm(!showPwForm)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-green-primary transition-colors font-medium">
              <Lock size={14} /> Change Password
            </button>
          </div>
        </form>

        {/* Password change form */}
        {showPwForm && (
          <div className="mt-5 pt-5 border-t border-gray-100 space-y-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><Lock size={16} className="text-green-primary" /> Change Password</h3>
            <Input label="Current Password" type={showPw ? 'text' : 'password'}
              value={pwForm.current} onChange={(e: any) => setPw('current', e.target.value)}
              rightIcon={<button type="button" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff size={15}/> : <Eye size={15}/>}</button>} />
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="New Password" type={showPw ? 'text' : 'password'}
                value={pwForm.newPw} onChange={(e: any) => setPw('newPw', e.target.value)}
                placeholder="Min 8 chars, 1 uppercase" />
              <Input label="Confirm New Password" type={showPw ? 'text' : 'password'}
                value={pwForm.confirm} onChange={(e: any) => setPw('confirm', e.target.value)} />
            </div>
            {pwForm.newPw && pwForm.confirm && pwForm.newPw !== pwForm.confirm && (
              <p className="text-xs text-red-500">Passwords don't match</p>
            )}
            <div className="flex gap-3">
              <Button onClick={() => {
                if (!pwForm.current) { toast.error('Enter current password'); return }
                if (pwForm.newPw.length < 8) { toast.error('New password must be at least 8 characters'); return }
                if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords don\'t match'); return }
                changePw()
              }} loading={changingPw} size="sm">Update Password</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowPwForm(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      {/* Loyalty points */}
      <div className="bg-gradient-to-br from-green-dark to-green-primary rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Star size={24} className="fill-orange-300 text-orange-300" />
            <h3 className="text-lg font-extrabold">Loyalty Points</h3>
          </div>
          <span className="text-sm font-bold px-3 py-1 rounded-full bg-white/20">
            {tier.label}
          </span>
        </div>
        <div className="text-4xl font-black text-orange-300 mb-1">
          {(user?.loyaltyPoints || 0).toLocaleString()}
        </div>
        <p className="text-white/70 text-sm">
          Worth ${((user?.loyaltyPoints || 0) / 100).toFixed(2)} wallet credit · Earn 1 point per $1 spent
        </p>
        {/* Progress to next tier */}
        {(user?.loyaltyPoints || 0) < 500 && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-white/60 mb-1">
              <span>{tier.label}</span>
              <span>{(user?.loyaltyPoints || 0) < 200 ? `${200 - (user?.loyaltyPoints||0)} pts to Silver` : `${500 - (user?.loyaltyPoints||0)} pts to Gold`}</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-orange-300 rounded-full transition-all"
                style={{ width: `${Math.min(((user?.loyaltyPoints||0) / ((user?.loyaltyPoints||0) < 200 ? 200 : 500)) * 100, 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Telegram Link */}
      <TelegramLink />

      {/* Daily Check-in */}
      <DailyCheckIn />
    </div>
  )
}
