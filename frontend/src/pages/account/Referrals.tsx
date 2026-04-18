import { useQuery } from '@tanstack/react-query'
import { Gift, Copy, Share2 } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

export default function Referrals() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-referral'],
    queryFn: () => api.get('/referrals/my-code').then(r => r.data.data),
  })

  const copy = () => {
    navigator.clipboard.writeText(data?.referralLink || '')
    toast.success('Link copied!')
  }

  const share = () => {
    if (navigator.share) {
      navigator.share({ title: 'Join Hafa Market', text: 'Shop fresh products on Hafa Market!', url: data?.referralLink })
    } else copy()
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="bg-gradient-to-br from-green-dark to-green-primary rounded-2xl p-6 text-white">
        <div className="flex items-center gap-3 mb-4">
          <Gift size={28} className="text-orange-300"/>
          <div>
            <h2 className="text-xl font-extrabold">Refer & Earn</h2>
            <p className="text-white/70 text-sm">Get ETB 50 for every friend you invite</p>
          </div>
        </div>
        <div className="bg-white/10 rounded-xl p-4 mb-4">
          <p className="text-white/60 text-xs mb-1">Your referral code</p>
          <p className="text-3xl font-black text-orange-300 tracking-widest">{data?.code}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={copy} className="flex-1 flex items-center justify-center gap-2 bg-white/15 border border-white/25 rounded-xl py-2.5 text-sm font-bold hover:bg-white/25 transition-colors">
            <Copy size={14}/> Copy Link
          </button>
          <button onClick={share} className="flex-1 flex items-center justify-center gap-2 bg-orange-400 rounded-xl py-2.5 text-sm font-bold hover:bg-orange-500 transition-colors">
            <Share2 size={14}/> Share
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-card p-5 text-center">
          <p className="text-3xl font-extrabold text-green-primary">{data?.referrals || 0}</p>
          <p className="text-sm text-gray-400 mt-1">Friends Invited</p>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5 text-center">
          <p className="text-3xl font-extrabold text-orange-500">ETB {data?.earned || 0}</p>
          <p className="text-sm text-gray-400 mt-1">Total Earned</p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-extrabold text-gray-900 mb-4">How it works</h3>
        <div className="space-y-3">
          {[
            { step:'1', text:'Share your referral link with friends', icon:'🔗' },
            { step:'2', text:'Friend signs up using your link', icon:'👤' },
            { step:'3', text:'Friend places their first order', icon:'🛒' },
            { step:'4', text:'Both of you get ETB 50 wallet credit!', icon:'🎉' },
          ].map(s => (
            <div key={s.step} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-50 text-green-primary font-bold text-sm flex items-center justify-center flex-shrink-0">{s.step}</div>
              <span className="text-sm text-gray-700">{s.icon} {s.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
