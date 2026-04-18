import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UserCheck, UserX, Search, X, Mail, Phone, Package, Star } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatDate, formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

function UserModal({ user, onClose }: { user: any; onClose: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}
      onClick={onClose}>
      <div style={{ background:'#fff', borderRadius:'20px', width:'100%', maxWidth:'480px', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,.2)' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ background:'linear-gradient(135deg,#1b5e20,#2E7D32)', padding:'20px 24px', display:'flex', alignItems:'center', gap:'12px' }}>
          <div style={{ width:'48px', height:'48px', borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:'1.2rem' }}>
            {user.name?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex:1 }}>
            <p style={{ color:'#fff', fontWeight:800, fontSize:'1rem', margin:0 }}>{user.name}</p>
            <p style={{ color:'rgba(255,255,255,.7)', fontSize:'.78rem', margin:0 }}>{user.role}</p>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,.15)', border:'none', borderRadius:'50%', width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#fff' }}>
            <X size={16}/>
          </button>
        </div>
        {/* Body */}
        <div style={{ padding:'20px 24px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'16px' }}>
            {[
              { label:'Email', value: user.email || '—', icon: <Mail size={13}/> },
              { label:'Phone', value: user.phone || '—', icon: <Phone size={13}/> },
              { label:'Orders', value: user._count?.orders || 0, icon: <Package size={13}/> },
              { label:'Loyalty Points', value: user.loyaltyPoints || 0, icon: <Star size={13}/> },
              { label:'Joined', value: formatDate(user.createdAt), icon: null },
              { label:'Status', value: user.isActive ? '✅ Active' : '❌ Inactive', icon: null },
            ].map(item => (
              <div key={item.label} style={{ background:'#f9fafb', borderRadius:'12px', padding:'10px 12px' }}>
                <p style={{ fontSize:'.68rem', color:'#9ca3af', fontWeight:600, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'3px', display:'flex', alignItems:'center', gap:'4px' }}>
                  {item.icon}{item.label}
                </p>
                <p style={{ fontSize:'.88rem', fontWeight:700, color:'#374151', margin:0 }}>{String(item.value)}</p>
              </div>
            ))}
          </div>
          {user.isVerified && (
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'10px', padding:'8px 12px', fontSize:'.8rem', color:'#15803d', fontWeight:600 }}>
              ✓ Email/Phone Verified
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminUsers() {
  const qc = useQueryClient()
  const [search, setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [selected, setSelected] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, roleFilter],
    queryFn: () => api.get('/admin/users', {
      params: {
        ...(search && { search }),
        ...(roleFilter !== 'ALL' && { role: roleFilter }),
        limit: 50,
      },
    }).then(r => r.data.data),
  })

  const { mutate: toggle } = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/users/${id}/toggle`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User status updated') },
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  const users = data || []
  const counts = {
    ALL:    users.length,
    BUYER:  users.filter((u: any) => u.role === 'BUYER').length,
    SELLER: users.filter((u: any) => u.role === 'SELLER').length,
    ADMIN:  users.filter((u: any) => u.role === 'ADMIN').length,
  }

  return (
    <>
      {selected && <UserModal user={selected} onClose={() => setSelected(null)} />}

      <div className="space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-card p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email or phone..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-primary" />
          </div>
          <div className="flex gap-2">
            {(['ALL','BUYER','SELLER','ADMIN'] as const).map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${
                  roleFilter === r ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-500 border-gray-200'
                }`}>
                {r} <span className="opacity-60">({counts[r]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {['User','Contact','Role','Orders','Status','Joined','Actions'].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs font-bold text-gray-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u: any) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelected(u)}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-primary to-green-mid flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-semibold text-gray-800">{u.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-500 text-xs">{u.email || u.phone}</td>
                    <td className="py-3 px-4">
                      <span className={`badge text-xs capitalize ${
                        u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' :
                        u.role === 'SELLER' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{u.role.toLowerCase()}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-600 font-medium">{u._count?.orders || 0}</td>
                    <td className="py-3 px-4">
                      <span className={`badge text-xs ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                      <button onClick={() => toggle(u.id)}
                        title={u.isActive ? 'Deactivate' : 'Activate'}
                        className={`p-1.5 rounded-lg transition-colors ${u.isActive ? 'text-red-400 hover:bg-red-50' : 'text-green-primary hover:bg-green-50'}`}>
                        {u.isActive ? <UserX size={15}/> : <UserCheck size={15}/>}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!users.length && (
            <div className="p-12 text-center text-gray-400">No users found</div>
          )}
        </div>
      </div>
    </>
  )
}
