import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MessageCircle, Send, Circle, X } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { io, Socket } from 'socket.io-client'

interface Msg { id: string; senderId: string; content: string; createdAt: string; sender?: { name: string; role: string } }
interface Room { id: string; participants: Array<{ userId: string; user?: { name: string; email: string } }>; messages?: Msg[]; updatedAt: string }

export default function AdminLiveChat() {
  const [rooms, setRooms]           = useState<Room[]>([])
  const [active, setActive]         = useState<Room | null>(null)
  const [messages, setMessages]     = useState<Msg[]>([])
  const [input, setInput]           = useState('')
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const socketRef = useRef<Socket | null>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const adminId = localStorage.getItem('adminId') || ''

  const { data: roomsData, refetch } = useQuery({
    queryKey: ['admin-support-rooms'],
    queryFn: () => api.get('/admin/support-rooms').then(r => r.data.data).catch(() => []),
    refetchInterval: 8000,
  })

  useEffect(() => { if (roomsData) setRooms(roomsData) }, [roomsData])
  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages])

  // Connect socket once
  useEffect(() => {
    const token = localStorage.getItem('accessToken') || ''
    const socket = io(import.meta.env.VITE_API_URL?.replace('/api/v1','') || 'http://localhost:5001', {
      auth: { token }, transports: ['websocket'],
    })
    socket.on('chat:message', (msg: Msg) => {
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
      refetch()
    })
    socketRef.current = socket
    return () => { socket.disconnect() }
  }, [])

  const openRoom = async (room: Room) => {
    setActive(room)
    const hist = await api.get(`/chat/${room.id}/messages`).then(r => r.data.data).catch(() => [])
    setMessages(hist)
    socketRef.current?.emit('chat:join', room.id)
  }

  const send = () => {
    if (!input.trim() || !active) return
    socketRef.current?.emit('chat:message', { roomId: active.id, type:'TEXT', content: input })
    setInput('')
  }

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })

  const getUser = (room: Room) => room.participants?.find(p => p.user)?.user

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-extrabold text-gray-900">Live Support Chat</h2>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden" style={{ height: '600px', display:'flex' }}>
        {/* Room list */}
        <div style={{ width:'260px', borderRight:'1px solid #f3f4f6', display:'flex', flexDirection:'column', flexShrink:0 }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6', background:'#f9fafb' }}>
            <p style={{ fontSize:'.8rem', fontWeight:700, color:'#374151' }}>
              Active Chats <span style={{ background:'#dcfce7', color:'#15803d', fontSize:'.7rem', padding:'1px 6px', borderRadius:'50px', marginLeft:'4px' }}>{rooms.length}</span>
            </p>
          </div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {rooms.length === 0 ? (
              <div style={{ padding:'24px', textAlign:'center', color:'#9ca3af', fontSize:'.8rem' }}>
                <MessageCircle size={28} style={{ margin:'0 auto 8px', opacity:.3 }} />
                No active chats
              </div>
            ) : rooms.map(room => {
              const user = getUser(room)
              const isActive = active?.id === room.id
              return (
                <button key={room.id} onClick={() => openRoom(room)} style={{
                  width:'100%', textAlign:'left', padding:'12px 16px',
                  borderBottom:'1px solid #f9fafb', cursor:'pointer',
                  background: isActive ? '#f0fdf4' : 'transparent',
                  borderLeft: isActive ? '3px solid #2E7D32' : '3px solid transparent',
                  transition:'background .15s',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'linear-gradient(135deg,#2E7D32,#43a047)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'.8rem', fontWeight:700, flexShrink:0 }}>
                      {user?.name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontSize:'.82rem', fontWeight:600, color:'#374151', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.name || 'User'}</p>
                      <p style={{ fontSize:'.7rem', color:'#9ca3af', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user?.email || 'Support'}</p>
                    </div>
                    <Circle size={8} style={{ color:'#22c55e', fill:'#22c55e', flexShrink:0, marginLeft:'auto' }} />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Chat area */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
          {!active ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'12px', color:'#9ca3af' }}>
              <MessageCircle size={40} style={{ opacity:.2 }} />
              <p style={{ fontSize:'.88rem' }}>Select a chat to start replying</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6', background:'#f9fafb', display:'flex', alignItems:'center', gap:'10px' }}>
                <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'linear-gradient(135deg,#2E7D32,#43a047)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:'.8rem', fontWeight:700 }}>
                  {getUser(active)?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p style={{ fontSize:'.88rem', fontWeight:700, color:'#374151', margin:0 }}>{getUser(active)?.name || 'User'}</p>
                  <p style={{ fontSize:'.72rem', color:'#22c55e', margin:0, fontWeight:600 }}>● Online</p>
                </div>
                <button onClick={() => setActive(null)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#9ca3af', padding:'4px' }}>
                  <X size={16}/>
                </button>
              </div>

              {/* Messages */}
              <div ref={messagesRef} style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:'8px', background:'#fafafa' }}>
                {messages.map(m => {
                  const isAdmin = m.sender?.role === 'ADMIN' || m.senderId === adminId
                  return (
                    <div key={m.id} style={{ display:'flex', justifyContent: isAdmin ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth:'70%', padding:'8px 12px', borderRadius: isAdmin ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        background: isAdmin ? 'linear-gradient(135deg,#2E7D32,#43a047)' : '#fff',
                        color: isAdmin ? '#fff' : '#374151',
                        boxShadow: isAdmin ? 'none' : '0 1px 4px rgba(0,0,0,.08)',
                        fontSize:'.85rem', lineHeight:1.5,
                      }}>
                        {!isAdmin && <p style={{ fontSize:'.7rem', fontWeight:700, color:'#2E7D32', margin:'0 0 2px' }}>{m.sender?.name}</p>}
                        <p style={{ margin:0 }}>{m.content}</p>
                        <p style={{ fontSize:'.65rem', opacity:.6, margin:'3px 0 0', textAlign:'right' }}>{fmtTime(m.createdAt)}</p>
                      </div>
                    </div>
                  )
                })}
                {messages.length === 0 && (
                  <div style={{ textAlign:'center', color:'#9ca3af', fontSize:'.82rem', marginTop:'40px' }}>No messages yet. Say hello!</div>
                )}
              </div>

              {/* Input */}
              <div style={{ padding:'12px 16px', borderTop:'1px solid #f3f4f6', display:'flex', gap:'8px', background:'#fff' }}>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                  placeholder="Type a reply..."
                  style={{ flex:1, border:'1px solid #e5e7eb', borderRadius:'12px', padding:'10px 14px', fontSize:'.88rem', outline:'none', fontFamily:'inherit' }}
                  onFocus={e => e.target.style.borderColor='#2E7D32'}
                  onBlur={e => e.target.style.borderColor='#e5e7eb'}
                />
                <button onClick={send} disabled={!input.trim()} style={{
                  width:'40px', height:'40px', borderRadius:'12px', border:'none', cursor:'pointer',
                  background: input.trim() ? 'linear-gradient(135deg,#2E7D32,#43a047)' : '#e5e7eb',
                  color: input.trim() ? '#fff' : '#9ca3af',
                  display:'flex', alignItems:'center', justifyContent:'center', transition:'all .2s', flexShrink:0,
                }}>
                  <Send size={16}/>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
