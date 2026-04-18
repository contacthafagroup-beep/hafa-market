import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, UserPlus, Trash2, Crown } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function Cooperative() {
  const qc = useQueryClient()
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['cooperative-members'],
    queryFn: () => api.get('/features/cooperative/members').then(r => r.data.data),
  })

  const { mutate: invite, isLoading: inviting } = useMutation({
    mutationFn: () => api.post('/features/cooperative/invite', { phone: phone || undefined, email: email || undefined }),
    onSuccess: () => {
      toast.success('Member added to cooperative!')
      setPhone(''); setEmail('')
      qc.invalidateQueries({ queryKey: ['cooperative-members'] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to add member'),
  })

  const { mutate: remove } = useMutation({
    mutationFn: (userId: string) => api.delete(`/features/cooperative/members/${userId}`),
    onSuccess: () => { toast.success('Member removed'); qc.invalidateQueries({ queryKey: ['cooperative-members'] }) },
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <Users size={20} className="text-green-primary" /> Cooperative Members
        </h2>
        <p className="text-sm text-gray-400 mt-1">
          Share your seller account with other farmers in your cooperative. Each member can manage products under your store.
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-sm text-green-800">
        <p className="font-bold mb-1">🌿 How Cooperative Accounts Work</p>
        <ul className="space-y-1 text-xs">
          <li>• Members can list products under your cooperative store</li>
          <li>• All sales are tracked under the cooperative account</li>
          <li>• Payouts go to the cooperative's bank account</li>
          <li>• Members must have a Hafa Market account first</li>
        </ul>
      </div>

      {/* Invite form */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <UserPlus size={16} className="text-green-primary" /> Invite a Farmer
        </h3>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <Input label="Phone Number" placeholder="+251 9XX XXX XXX"
            value={phone} onChange={(e: any) => setPhone(e.target.value)} />
          <Input label="Email (optional)" type="email" placeholder="farmer@email.com"
            value={email} onChange={(e: any) => setEmail(e.target.value)} />
        </div>
        <Button loading={inviting} disabled={!phone && !email} onClick={() => invite()}>
          <UserPlus size={15} /> Add to Cooperative
        </Button>
      </div>

      {/* Members list */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-gray-900 mb-4">Members ({members.length})</h3>
        {!members.length ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            No members yet. Invite farmers to join your cooperative.
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-primary flex-shrink-0 overflow-hidden">
                  {m.user?.avatar
                    ? <img src={m.user.avatar} alt={m.user.name} className="w-full h-full object-cover" />
                    : m.user?.name?.[0]?.toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm text-gray-800">{m.user?.name}</p>
                    {m.role === 'ADMIN' && (
                      <span className="flex items-center gap-0.5 text-[10px] bg-orange-100 text-orange-700 font-bold px-1.5 py-0.5 rounded-full">
                        <Crown size={9} /> Admin
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{m.user?.phone || m.user?.email} · Joined {formatDate(m.joinedAt)}</p>
                </div>
                {m.role !== 'ADMIN' && (
                  <button onClick={() => remove(m.userId)}
                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
