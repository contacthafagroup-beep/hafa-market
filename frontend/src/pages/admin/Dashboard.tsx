import { useQuery } from '@tanstack/react-query'
import { Users, ShoppingBag, Package, TrendingUp, AlertCircle, MessageCircle, Send } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatPrice, formatDate, getOrderStatusColor } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

interface SupportMsg { id: string; senderId: string; senderName: string; content: string; createdAt: string }
interface SupportRoom { id: string; participants: Array<{ userId: string; user?: { name: string } }>; messages?: SupportMsg[] }

function AdminSupportChat() {
  const [rooms, setRooms]         = useState<SupportRoom[]>([])
  const [activeRoom, setActiveRoom] = useState<SupportRoom | null>(null)
  const [messages, setMessages]   = useState<SupportMsg[]>([])
  const [input, setInput]         = useState('')
  const socketRef = useRef<Socket | null>(null)
  const messagesRef = useRef<HTMLDivElement>(null)

  // Load support rooms
  const { data: roomsData, refetch } = useQuery({
    queryKey: ['admin-support-rooms'],
    queryFn: () => api.get('/admin/support-rooms').then(r => r.data.data).catch(() => []),
    refetchInterval: 10000,
  })

  useEffect(() => { if (roomsData) setRooms(roomsData) }, [roomsData])

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages])

  const openRoom = async (room: SupportRoom) => {
    setActiveRoom(room)
    const hist = await api.get(`/chat/${room.id}/messages`).then(r => r.data.data).catch(() => [])
    setMessages(hist)

    // Connect socket
    if (!socketRef.current?.connected) {
      const token = localStorage.getItem('accessToken') || ''
      const socket = io(import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:5001', {
        auth: { token }, transports: ['websocket'],
      })
      socket.on('connect', () => socket.emit('chat:join', room.id))
      socket.on('chat:message', (msg: SupportMsg) => {
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
      })
      socketRef.current = socket
    } else {
      socketRef.current.emit('chat:join', room.id)
    }
  }

  const send = () => {
    if (!input.trim() || !activeRoom) return
    socketRef.current?.emit('chat:message', { roomId: activeRoom.id, type: 'TEXT', content: input })
    setInput('')
  }

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center gap-3 p-4 border-b border-gray-100">
        <MessageCircle size={20} className="text-purple-600" />
        <h3 className="font-extrabold text-gray-900">Live Support Chat</h3>
        {rooms.length > 0 && <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">{rooms.length} active</span>}
      </div>

      <div className="flex" style={{ height: '400px' }}>
        {/* Room list */}
        <div className="w-48 border-r border-gray-100 overflow-y-auto flex-shrink-0">
          {rooms.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-xs">No active chats</div>
          ) : rooms.map(room => {
            const user = room.participants?.find(p => p.user)?.user
            return (
              <button key={room.id} onClick={() => openRoom(room)}
                className={`w-full text-left p-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${activeRoom?.id === room.id ? 'bg-purple-50 border-l-2 border-l-purple-600' : ''}`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {user?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-gray-800 truncate">{user?.name || 'User'}</div>
                    <div className="text-xs text-gray-400">Support</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {!activeRoom ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              <div className="text-center">
                <MessageCircle size={32} className="mx-auto mb-2 opacity-30" />
                <p>Select a chat to reply</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold">
                  {activeRoom.participants?.find(p => p.user)?.user?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <span className="text-sm font-semibold text-gray-800">
                  {activeRoom.participants?.find(p => p.user)?.user?.name || 'User'}
                </span>
                <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium">
                  <span className="w-2 h-2 bg-green-500 rounded-full inline-block" /> Live
                </span>
              </div>

              {/* Messages */}
              <div ref={messagesRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-purple-50/20">
                {messages.map(m => {
                  const isAdmin = m.senderName?.toLowerCase().includes('admin') || m.senderId === localStorage.getItem('adminId')
                  return (
                    <div key={m.id} className={`flex items-end gap-2 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div className={`max-w-xs px-3 py-2 rounded-2xl text-sm ${isAdmin ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white rounded-br-sm' : 'bg-white shadow-sm text-gray-800 rounded-bl-sm'}`}>
                        {m.content}
                        <div className={`text-xs mt-1 ${isAdmin ? 'text-purple-200' : 'text-gray-400'}`}>{fmtTime(m.createdAt)}</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-100 flex gap-2">
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Reply to user..."
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-purple-500" />
                <button onClick={send} disabled={!input.trim()}
                  className="bg-gradient-to-br from-purple-600 to-purple-700 text-white w-9 h-9 rounded-xl flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0">
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn:  () => api.get('/admin/dashboard').then(r => r.data.data),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  const s = data?.stats
  const stats = [
    { label:'Total Users',    value: s?.totalUsers,    sub:`+${s?.newUsersToday} today`,  icon:<Users size={22}/>,       color:'bg-blue-50 text-blue-600' },
    { label:'Active Sellers', value: s?.totalSellers,  sub:`${s?.pendingSellers} pending`, icon:<ShoppingBag size={22}/>, color:'bg-purple-50 text-purple-600' },
    { label:'Total Orders',   value: s?.totalOrders,   sub:`${s?.todayOrders} today`,      icon:<Package size={22}/>,     color:'bg-orange-50 text-orange-600' },
    { label:'Month Revenue',  value: formatPrice(s?.monthRevenue||0), sub:`${s?.revenueGrowth}% growth`, icon:<TrendingUp size={22}/>, color:'bg-green-50 text-green-primary' },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(st => (
          <div key={st.label} className="bg-white rounded-2xl shadow-card p-5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${st.color}`}>{st.icon}</div>
            <div className="text-2xl font-extrabold text-gray-900">{st.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{st.label}</div>
            <div className="text-xs text-green-primary font-medium mt-1">{st.sub}</div>
          </div>
        ))}
      </div>

      {s?.pendingSellers > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-orange-500 flex-shrink-0" />
          <p className="text-sm text-orange-700 font-medium">{s.pendingSellers} seller(s) pending verification. <a href="/admin/sellers" className="underline font-bold">Review now →</a></p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-extrabold text-gray-900 mb-4">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">{['Order','Customer','Status','Total','Date'].map(h => <th key={h} className="text-left py-2 px-3 text-xs font-bold text-gray-400">{h}</th>)}</tr></thead>
            <tbody>
              {data?.recentOrders?.map((o: { id: string; status: string; total: number; createdAt: string; user?: { name: string } }) => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-3 font-bold">#{o.id.slice(-8).toUpperCase()}</td>
                  <td className="py-3 px-3 text-gray-600">{o.user?.name || '—'}</td>
                  <td className="py-3 px-3"><span className={`badge text-xs ${getOrderStatusColor(o.status)}`}>{o.status.replace(/_/g,' ')}</span></td>
                  <td className="py-3 px-3 font-bold text-green-primary">{formatPrice(o.total)}</td>
                  <td className="py-3 px-3 text-gray-400">{formatDate(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Support Chat */}
      <AdminSupportChat />
    </div>
  )
}
