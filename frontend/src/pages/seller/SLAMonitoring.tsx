import { useQuery } from '@tanstack/react-query'
import { Clock, CheckCircle, AlertTriangle, TrendingUp, Package, Truck } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'

// SLA targets (in hours)
const SLA_TARGETS = {
  CONFIRMATION: 2,    // Confirm order within 2 hours
  PROCESSING:   24,   // Start processing within 24 hours
  SHIPPING:     48,   // Ship within 48 hours
  DELIVERY:     72,   // Deliver within 72 hours
}

function SLABadge({ hours, target }: { hours: number; target: number }) {
  const pct = Math.min((hours / target) * 100, 100)
  const ok = hours <= target
  const warning = hours <= target * 1.5
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: ok ? '#2E7D32' : warning ? '#f59e0b' : '#ef4444' }} />
      </div>
      <span className={`text-xs font-bold w-16 text-right ${ok ? 'text-green-primary' : warning ? 'text-orange-500' : 'text-red-500'}`}>
        {hours.toFixed(1)}h / {target}h
      </span>
    </div>
  )
}

export default function SLAMonitoring() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['sla-orders'],
    queryFn: () => api.get('/sellers/me/orders?limit=50').then(r => r.data.data || []),
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  // Compute SLA metrics
  const metrics = orders.map((order: any) => {
    const created = new Date(order.createdAt).getTime()
    const now = Date.now()

    // Find status timestamps from history
    const history: any[] = order.statusHistory || []
    const confirmedAt = history.find((h: any) => h.status === 'CONFIRMED')?.createdAt
    const processingAt = history.find((h: any) => h.status === 'PROCESSING')?.createdAt
    const shippedAt = history.find((h: any) => h.status === 'SHIPPED')?.createdAt
    const deliveredAt = history.find((h: any) => h.status === 'DELIVERED')?.createdAt

    const hoursToConfirm = confirmedAt ? (new Date(confirmedAt).getTime() - created) / 3600000 : (now - created) / 3600000
    const hoursToProcess = processingAt ? (new Date(processingAt).getTime() - created) / 3600000 : null
    const hoursToShip = shippedAt ? (new Date(shippedAt).getTime() - created) / 3600000 : null
    const hoursToDeliver = deliveredAt ? (new Date(deliveredAt).getTime() - created) / 3600000 : null

    const breached = (
      (hoursToConfirm > SLA_TARGETS.CONFIRMATION) ||
      (hoursToProcess !== null && hoursToProcess > SLA_TARGETS.PROCESSING) ||
      (hoursToShip !== null && hoursToShip > SLA_TARGETS.SHIPPING) ||
      (hoursToDeliver !== null && hoursToDeliver > SLA_TARGETS.DELIVERY)
    )

    return { order, hoursToConfirm, hoursToProcess, hoursToShip, hoursToDeliver, breached }
  })

  const totalOrders = metrics.length
  const breachedCount = metrics.filter((m: any) => m.breached).length
  const slaRate = totalOrders > 0 ? Math.round(((totalOrders - breachedCount) / totalOrders) * 100) : 100

  const avgConfirm = metrics.length > 0
    ? metrics.reduce((s: number, m: any) => s + m.hoursToConfirm, 0) / metrics.length
    : 0

  const pendingOrders = metrics.filter((m: any) =>
    ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(m.order.status)
  )

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <Clock size={20} className="text-green-primary" /> SLA Monitoring
        </h2>
        <p className="text-sm text-gray-400">Track your fulfillment speed against marketplace targets</p>
      </div>

      {/* SLA Score */}
      <div className={`rounded-2xl p-5 text-white ${slaRate >= 90 ? 'bg-gradient-to-br from-green-dark to-green-primary' : slaRate >= 70 ? 'bg-gradient-to-br from-orange-500 to-orange-600' : 'bg-gradient-to-br from-red-500 to-red-700'}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-white/70 text-sm">SLA Compliance Rate</p>
            <p className="text-5xl font-black">{slaRate}%</p>
          </div>
          <div className="text-right">
            <p className="text-white/70 text-xs">Target: 90%+</p>
            <p className="text-2xl font-extrabold mt-1">
              {slaRate >= 90 ? '🏆 Excellent' : slaRate >= 70 ? '⚠️ Needs Work' : '🚨 Critical'}
            </p>
          </div>
        </div>
        <div className="h-3 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${slaRate}%` }} />
        </div>
        <p className="text-white/70 text-xs mt-2">{breachedCount} of {totalOrders} orders breached SLA</p>
      </div>

      {/* SLA Targets */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-gray-900 mb-4">📋 SLA Targets</h3>
        <div className="space-y-3">
          {[
            { label: '✅ Order Confirmation', target: SLA_TARGETS.CONFIRMATION, icon: <CheckCircle size={16} className="text-green-primary" /> },
            { label: '⚙️ Start Processing', target: SLA_TARGETS.PROCESSING, icon: <Package size={16} className="text-blue-500" /> },
            { label: '📦 Ship Order', target: SLA_TARGETS.SHIPPING, icon: <Truck size={16} className="text-purple-500" /> },
            { label: '🏠 Deliver', target: SLA_TARGETS.DELIVERY, icon: <CheckCircle size={16} className="text-orange-500" /> },
          ].map(({ label, target, icon }) => (
            <div key={label} className="flex items-center gap-3">
              {icon}
              <span className="text-sm font-semibold text-gray-700 w-40 flex-shrink-0">{label}</span>
              <div className="flex-1">
                <div className="h-2 bg-gray-100 rounded-full">
                  <div className="h-full bg-green-primary rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
              <span className="text-xs font-bold text-gray-500 flex-shrink-0">Within {target}h</span>
            </div>
          ))}
        </div>
      </div>

      {/* Performance stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Avg Confirm Time', value: `${avgConfirm.toFixed(1)}h`, target: `${SLA_TARGETS.CONFIRMATION}h target`, ok: avgConfirm <= SLA_TARGETS.CONFIRMATION },
          { label: 'Total Orders', value: totalOrders, target: 'tracked', ok: true },
          { label: 'SLA Breaches', value: breachedCount, target: 'this period', ok: breachedCount === 0 },
          { label: 'Compliance', value: `${slaRate}%`, target: '90% target', ok: slaRate >= 90 },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-card p-4 text-center">
            <p className={`text-2xl font-extrabold ${s.ok ? 'text-green-primary' : 'text-red-500'}`}>{s.value}</p>
            <p className="text-xs font-semibold text-gray-700 mt-0.5">{s.label}</p>
            <p className="text-[10px] text-gray-400">{s.target}</p>
          </div>
        ))}
      </div>

      {/* Pending orders with SLA countdown */}
      {pendingOrders.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-orange-500" /> Active Orders — SLA Status
          </h3>
          <div className="space-y-4">
            {pendingOrders.slice(0, 10).map(({ order, hoursToConfirm, hoursToProcess, hoursToShip }: any) => (
              <div key={order.id} className="border border-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-sm text-gray-800">#{order.id.slice(-8).toUpperCase()}</p>
                    <p className="text-xs text-gray-400">{formatDate(order.createdAt)} · {order.status.replace(/_/g, ' ')}</p>
                  </div>
                  {hoursToConfirm > SLA_TARGETS.CONFIRMATION && (
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full flex items-center gap-1">
                      <AlertTriangle size={11} /> SLA Breached
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Confirmation time</p>
                    <SLABadge hours={hoursToConfirm} target={SLA_TARGETS.CONFIRMATION} />
                  </div>
                  {hoursToProcess !== null && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Processing time</p>
                      <SLABadge hours={hoursToProcess} target={SLA_TARGETS.PROCESSING} />
                    </div>
                  )}
                  {hoursToShip !== null && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Shipping time</p>
                      <SLABadge hours={hoursToShip} target={SLA_TARGETS.SHIPPING} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
        <h3 className="font-bold text-gray-800 mb-3">💡 Improve Your SLA Score</h3>
        <div className="grid sm:grid-cols-2 gap-2 text-sm text-gray-600">
          {[
            '📱 Enable Telegram notifications for instant order alerts',
            '⚡ Confirm orders within 1 hour of receiving them',
            '📦 Pre-pack common items to speed up processing',
            '🚚 Partner with reliable delivery agents in your area',
            '📅 Set realistic delivery slots based on your capacity',
            '🔔 Use the Hafa Market app for real-time order updates',
          ].map(tip => (
            <div key={tip} className="flex items-start gap-2">
              <span className="text-xs">{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
