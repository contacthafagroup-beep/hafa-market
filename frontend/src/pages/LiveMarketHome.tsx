/**
 * LiveMarketHome — /live
 * Lists all active and scheduled live marketplace sessions.
 * Seller can create a new session from here.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { Video, Users, Clock, Plus, X, Package, Bell, Star, MapPin } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

export default function LiveMarketHome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isSeller = user?.role === 'ADMIN' || user?.role === 'SELLER'

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', scheduledAt: '' })

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['live-sessions-home'],
    queryFn: () => api.get('/live').then(r => r.data.data || []),
    refetchInterval: 15000,
  })

  const { mutate: create, isPending: creating } = useMutation({
    mutationFn: () => api.post('/live', form),
    onSuccess: (res) => {
      const session = res.data.data
      toast.success('Session created!')
      setShowCreate(false)
      setForm({ title: '', description: '', scheduledAt: '' })
      qc.invalidateQueries({ queryKey: ['live-sessions-home'] })
      // Go directly to the live marketplace
      navigate(`/live/${session.id}`)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  })

  const { mutate: startSession } = useMutation({
    mutationFn: (id: string) => api.patch(`/live/${id}/start`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['live-sessions-home'] })
      navigate(`/live/${id}`)
    },
  })

  const live = sessions.filter((s: any) => s.status === 'LIVE')
  const scheduled = sessions.filter((s: any) => s.status === 'SCHEDULED')

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center animate-pulse">
              <Video size={20} className="text-white" />
            </div>
            Live Marketplace
          </h1>
          <p className="text-gray-400 mt-1">Shop live — watch sellers, buy instantly, get delivered</p>
        </div>
        {isSeller && (
          <Button onClick={() => setShowCreate(true)}
            className="bg-red-500 hover:bg-red-600 text-white border-red-500">
            <Video size={16} /> Go Live
          </Button>
        )}
      </div>

      {/* Create session form */}
      {showCreate && (
        <div className="bg-white rounded-2xl shadow-card p-6 mb-8 border-2 border-red-100">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-extrabold text-gray-900 text-lg flex items-center gap-2">
              <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <Video size={12} className="text-white" />
              </div>
              Start Live Marketplace
            </h3>
            <button onClick={() => setShowCreate(false)}><X size={18} className="text-gray-400" /></button>
          </div>

          <div className="space-y-4">
            <Input label="Session Title *" placeholder="e.g. Fresh Teff Harvest — Buy Direct from Farm"
              value={form.title} onChange={(e: any) => setForm(f => ({ ...f, title: e.target.value }))} />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2} placeholder="What products will you sell? Any special deals?"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-400 resize-none" />
            </div>
            <Input label="Schedule for later (optional)" type="datetime-local" value={form.scheduledAt}
              onChange={(e: any) => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
          </div>

          {/* How it works */}
          <div className="mt-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-xl p-4">
            <p className="text-xs font-bold text-red-700 mb-3">🛒 How Live Marketplace Works</p>
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { icon: '📹', text: 'Stream from your browser camera' },
                { icon: '📦', text: 'List products with live prices' },
                { icon: '🛒', text: 'Buyers add to cart or buy instantly' },
                { icon: '🚚', text: 'Orders placed & delivered normally' },
              ].map(s => (
                <div key={s.icon} className="bg-white rounded-xl p-3">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <p className="text-[10px] text-gray-600 leading-tight">{s.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <Button loading={creating} onClick={() => create()} disabled={!form.title}>
              {form.scheduledAt ? 'Schedule Session' : '🔴 Go Live Now'}
            </Button>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <>
          {/* LIVE NOW */}
          {live.length > 0 && (
            <div className="mb-10">
              <div className="flex items-center gap-2 mb-5">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <p className="text-sm font-black text-red-500 uppercase tracking-widest">Live Now</p>
                <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">{live.length}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {live.map((s: any) => (
                  <Link key={s.id} to={`/live/${s.id}`}
                    className="bg-white rounded-2xl shadow-card overflow-hidden border-2 border-red-200 hover:border-red-400 hover:shadow-card-hover transition-all group">
                    {/* Thumbnail */}
                    <div className="bg-gradient-to-br from-red-600 to-red-900 h-44 flex items-center justify-center relative overflow-hidden">
                      <Video size={48} className="text-white/20" />
                      <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
                      </div>
                      <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <Users size={11} /> {s.viewerCount}
                      </div>
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <div className="w-14 h-14 bg-white/0 group-hover:bg-white/20 rounded-full flex items-center justify-center transition-all">
                          <Video size={24} className="text-white/0 group-hover:text-white transition-all" />
                        </div>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900 mb-1 line-clamp-2">{s.title}</h3>
                      {s.description && <p className="text-xs text-gray-400 mb-3 line-clamp-1">{s.description}</p>}
                      {s.seller && (
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-xs font-bold text-green-primary">
                            {s.seller.storeName?.[0]}
                          </div>
                          <span className="text-xs text-gray-600 font-semibold">{s.seller.storeName}</span>
                          {s.seller.city && <span className="text-xs text-gray-400 flex items-center gap-0.5"><MapPin size={9} />{s.seller.city}</span>}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Package size={11} /> {s.productIds?.length || 0} products
                        </span>
                        <span className="text-xs font-bold text-red-500 group-hover:text-red-600 transition-colors">
                          Join Live →
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Scheduled */}
          {scheduled.length > 0 && (
            <div className="mb-8">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">⏰ Upcoming Sessions</p>
              <div className="space-y-3">
                {scheduled.map((s: any) => (
                  <div key={s.id} className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <Clock size={20} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900">{s.title}</p>
                      {s.scheduledAt && <p className="text-xs text-gray-400">{formatDate(s.scheduledAt)}</p>}
                      {s.seller && <p className="text-xs text-gray-500">{s.seller.storeName}</p>}
                    </div>
                    {isSeller && (
                      <Button size="sm" className="bg-red-500 hover:bg-red-600 text-white border-red-500 flex-shrink-0"
                        onClick={() => startSession(s.id)}>
                        🔴 Start
                      </Button>
                    )}
                    {!isSeller && (
                      <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-green-primary transition-colors flex-shrink-0">
                        <Bell size={13} /> Remind me
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!live.length && !scheduled.length && (
            <div className="text-center py-20">
              <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <Video size={40} className="text-red-300" />
              </div>
              <h3 className="font-extrabold text-gray-700 text-xl mb-2">No live sessions right now</h3>
              <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
                Sellers go live to showcase fresh products. You can watch, chat, and buy directly.
              </p>
              {isSeller ? (
                <Button onClick={() => setShowCreate(true)}
                  className="bg-red-500 hover:bg-red-600 text-white border-red-500">
                  <Video size={16} /> Start Your Live Marketplace
                </Button>
              ) : (
                <p className="text-sm text-gray-400">Check back soon or follow sellers to get notified</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
