import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, Circle, Truck, Home, Package, Phone, Camera } from 'lucide-react'
import { orderService } from '@/services/order.service'
import Spinner from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'
import DeliveryMap from '@/components/ui/DeliveryMap'
import api from '@/lib/api'

const STEPS = [
  { status: 'PENDING',          icon: <Package size={18} />,    label: 'Order Placed' },
  { status: 'CONFIRMED',        icon: <CheckCircle size={18} />, label: 'Confirmed' },
  { status: 'PROCESSING',       icon: <Package size={18} />,    label: 'Processing' },
  { status: 'SHIPPED',          icon: <Truck size={18} />,      label: 'Shipped' },
  { status: 'OUT_FOR_DELIVERY', icon: <Truck size={18} />,      label: 'Out for Delivery' },
  { status: 'DELIVERED',        icon: <Home size={18} />,       label: 'Delivered' },
]

export default function TrackOrder() {
  const { trackingCode } = useParams<{ trackingCode: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['track', trackingCode],
    queryFn:  () => orderService.trackOrder(trackingCode!).then(r => r.data.data),
    enabled:  !!trackingCode,
    refetchInterval: 30000,
  })

  const { data: proof } = useQuery({
    queryKey: ['pod', data?.id],
    queryFn:  () => api.get(`/delivery/proof/${data?.id}`).then(r => r.data.data),
    enabled:  !!data?.id && data?.order?.status === 'DELIVERED',
  })

  if (isLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>
  if (!data)     return <div className="text-center py-32 text-gray-400">Tracking code not found</div>

  const order        = data.order
  const currentStep  = STEPS.findIndex(s => s.status === order?.status)

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Track Your Order</h1>
      <p className="text-gray-400 text-sm mb-8">Tracking: <span className="font-bold text-gray-700">{trackingCode}</span></p>

      {/* Live delivery map */}
      {data?.delivery?.currentLat && data?.delivery?.currentLng && (
        <div className="bg-white rounded-2xl shadow-card p-6 mb-6">
          <h3 className="font-extrabold text-gray-900 mb-3 flex items-center gap-2">
            <Truck size={18} className="text-green-primary" /> Live Delivery Location
          </h3>
          <DeliveryMap
            lat={data.delivery.currentLat}
            lng={data.delivery.currentLng}
            height="250px"
            markerLabel="Delivery Agent"
            destinationLat={order?.address?.latitude}
            destinationLng={order?.address?.longitude}
          />
          {data.delivery.estimatedAt && (
            <p className="text-sm text-green-primary font-semibold mt-3 text-center">
              🕐 Estimated arrival: {formatDate(data.delivery.estimatedAt)}
            </p>
          )}
        </div>
      )}

      {/* Status steps */}
      <div className="bg-white rounded-2xl shadow-card p-6 mb-6">
        <div className="relative">
          <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gray-200" />
          <div className="space-y-6">
            {STEPS.map((step, i) => {
              const done    = i <= currentStep
              const current = i === currentStep
              return (
                <div key={step.status} className="flex items-center gap-4 relative">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center z-10 transition-all ${done ? 'bg-green-primary text-white shadow-md' : 'bg-gray-100 text-gray-400'} ${current ? 'ring-4 ring-green-100' : ''}`}>
                    {done ? <CheckCircle size={20} /> : <Circle size={20} />}
                  </div>
                  <div>
                    <div className={`font-bold text-sm ${done ? 'text-gray-900' : 'text-gray-400'}`}>{step.label}</div>
                    {current && <div className="text-xs text-green-primary font-medium">Current status</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Order details */}
      {order && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <h3 className="font-extrabold text-gray-900 mb-4">Order Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Order ID</span><span className="font-bold">#{order.id?.slice(-8).toUpperCase()}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Placed</span><span className="font-medium">{formatDate(order.createdAt)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Items</span><span className="font-medium">{order.items?.length} items</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold text-green-primary">${order.total?.toFixed(2)}</span></div>
            {order.address && (
              <div className="flex justify-between"><span className="text-gray-500">Deliver to</span><span className="font-medium text-right">{order.address.city}, {order.address.country}</span></div>
            )}
          </div>
          {/* Call driver button */}
          {order.status === 'OUT_FOR_DELIVERY' && (
            <a href={`tel:${data?.delivery?.agent?.user?.phone || order.address?.phone || ''}`}
              className="mt-4 flex items-center justify-center gap-2 bg-green-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-green-dark transition-colors">
              <Phone size={16} /> Call Delivery Agent
            </a>
          )}
        </div>
      )}

      {/* Proof of Delivery */}
      {proof?.photoUrl && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <h3 className="font-extrabold text-gray-900 mb-4 flex items-center gap-2">
            <Camera size={18} className="text-green-primary" /> Proof of Delivery
          </h3>
          <img src={proof.photoUrl} alt="Proof of delivery" className="w-full rounded-xl border border-gray-200 mb-3" />
          <p className="text-xs text-gray-400 text-center">📸 Photo taken at delivery · {formatDate(proof.capturedAt)}</p>
        </div>
      )}

      {/* Status history */}
      {order?.statusHistory?.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <h3 className="font-extrabold text-gray-900 mb-4">Order History</h3>
          <div className="relative">
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-100" />
            <div className="space-y-4">
              {[...order.statusHistory].reverse().map((h: any, i: number) => (
                <div key={h.id || i} className="flex items-start gap-4 relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 flex-shrink-0 ${i === 0 ? 'bg-green-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                    <div className="w-2 h-2 rounded-full bg-current" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-800 capitalize">{h.status.replace(/_/g,' ')}</p>
                    {h.note && <p className="text-xs text-gray-500">{h.note}</p>}
                    <p className="text-xs text-gray-400">{formatDate(h.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
