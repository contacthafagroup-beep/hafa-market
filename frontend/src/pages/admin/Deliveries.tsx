import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Truck, MapPin, Phone, UserCheck, Search, Package } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatDate, formatPrice, getOrderStatusColor } from '@/lib/utils'
import toast from 'react-hot-toast'

const DELIVERY_STATUS_COLORS: Record<string,string> = {
  PENDING:    'bg-yellow-100 text-yellow-700',
  ASSIGNED:   'bg-blue-100 text-blue-700',
  PICKED_UP:  'bg-purple-100 text-purple-700',
  IN_TRANSIT: 'bg-orange-100 text-orange-700',
  DELIVERED:  'bg-green-100 text-green-700',
  FAILED:     'bg-red-100 text-red-700',
}

export default function AdminDeliveries() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [assigningId, setAssigningId] = useState<string|null>(null)

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-deliveries', statusFilter],
    queryFn: () => api.get('/admin/orders', {
      params: { limit: 50, ...(statusFilter !== 'ALL' && { status: statusFilter }) },
    }).then(r => r.data.data),
    refetchInterval: 30000,
  })

  const { data: agents } = useQuery({
    queryKey: ['available-agents'],
    queryFn: () => api.get('/delivery/agents/available').then(r => r.data.data),
  })

  const { mutate: assignAgent } = useMutation({
    mutationFn: ({ deliveryId, agentId }: { deliveryId: string; agentId: string }) =>
      api.post('/delivery/assign', { deliveryId, agentId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-deliveries'] })
      qc.invalidateQueries({ queryKey: ['available-agents'] })
      setAssigningId(null)
      toast.success('Agent assigned!')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to assign'),
  })

  const filtered = (orders || []).filter((o: any) =>
    !search ||
    o.id.toLowerCase().includes(search.toLowerCase()) ||
    o.user?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const pendingDelivery = filtered.filter((o: any) =>
    ['CONFIRMED','PROCESSING','SHIPPED'].includes(o.status) && !o.delivery?.agentId
  )

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Delivery Management</h2>
          <p className="text-sm text-gray-400">{pendingDelivery.length} orders need agent assignment</p>
        </div>
      </div>

      {/* Pending assignment alert */}
      {pendingDelivery.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
          <Truck size={20} className="text-amber-500 flex-shrink-0"/>
          <p className="text-sm text-amber-800 font-medium">
            <strong>{pendingDelivery.length}</strong> orders waiting for delivery agent assignment
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by order ID or customer..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-green-primary"/>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['ALL','CONFIRMED','PROCESSING','SHIPPED','OUT_FOR_DELIVERY','DELIVERED'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${statusFilter===s ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-500 border-gray-200'}`}>
              {s === 'ALL' ? 'All' : s.replace(/_/g,' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Orders */}
      {!filtered.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center text-gray-400">No orders found</div>
      ) : filtered.map((order: any) => (
        <div key={order.id} className="bg-white rounded-2xl shadow-card p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-extrabold text-gray-900">#{order.id.slice(-8).toUpperCase()}</span>
                <span className={`badge text-xs ${getOrderStatusColor(order.status)}`}>{order.status.replace(/_/g,' ')}</span>
                {order.delivery?.status && (
                  <span className={`badge text-xs ${DELIVERY_STATUS_COLORS[order.delivery.status] || 'bg-gray-100 text-gray-500'}`}>
                    🚚 {order.delivery.status.replace(/_/g,' ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">{order.user?.name} · {formatDate(order.createdAt)} · {formatPrice(order.total)}</p>
              {order.address && (
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin size={10}/> {order.address.street}, {order.address.city}
                </p>
              )}
            </div>

            {/* Agent info or assign button */}
            <div className="flex-shrink-0">
              {order.delivery?.agentId ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                  <UserCheck size={14} className="text-green-primary"/>
                  <div>
                    <p className="text-xs font-bold text-green-primary">Agent Assigned</p>
                    {order.delivery?.agent?.user?.name && (
                      <p className="text-xs text-gray-500">{order.delivery.agent.user.name}</p>
                    )}
                  </div>
                  {order.delivery?.agent?.user?.phone && (
                    <a href={`tel:${order.delivery.agent.user.phone}`} className="ml-1 text-green-primary hover:text-green-dark">
                      <Phone size={14}/>
                    </a>
                  )}
                </div>
              ) : ['CONFIRMED','PROCESSING','SHIPPED'].includes(order.status) ? (
                assigningId === order.id ? (
                  <div className="bg-white border border-gray-200 rounded-xl p-3 min-w-[200px]">
                    <p className="text-xs font-bold text-gray-700 mb-2">Select Agent:</p>
                    {!agents?.length ? (
                      <p className="text-xs text-gray-400">No agents available</p>
                    ) : (
                      <div className="space-y-1.5">
                        {agents.map((agent: any) => (
                          <button key={agent.id}
                            onClick={() => assignAgent({ deliveryId: order.delivery?.id || order.id, agentId: agent.id })}
                            className="w-full flex items-center gap-2 p-2 hover:bg-green-50 rounded-lg transition-colors text-left">
                            <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-primary text-xs font-bold flex-shrink-0">
                              {agent.user?.name?.[0]?.toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-gray-800 truncate">{agent.user?.name}</p>
                              <p className="text-[10px] text-gray-400">{agent.totalDeliveries} deliveries</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => setAssigningId(null)} className="mt-2 text-xs text-gray-400 hover:text-gray-600 w-full text-center">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setAssigningId(order.id)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors">
                    <UserCheck size={14}/> Assign Agent
                  </button>
                )
              ) : null}
            </div>
          </div>

          {/* Tracking code */}
          {order.delivery?.trackingCode && (
            <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-2">
              <span className="text-xs text-gray-400">Tracking:</span>
              <span className="text-xs font-mono font-bold text-gray-700">{order.delivery.trackingCode}</span>
              {order.delivery.currentLat && (
                <span className="text-xs text-green-primary font-medium ml-auto">📍 Live location active</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
