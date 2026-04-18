import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, Package, CheckCircle, Phone, Navigation, Camera, Upload } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import DeliveryMap from '@/components/ui/DeliveryMap'
import { formatPrice, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const STATUS_STEPS = ['ASSIGNED','PICKED_UP','IN_TRANSIT','DELIVERED']

// ── Proof of Delivery Upload Component ───────────────────────────────────────
function ProofOfDeliveryUpload({ deliveryId, isDelivered }: { deliveryId: string; isDelivered: boolean }) {
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const { data: existing } = useQuery({
    queryKey: ['pod', deliveryId],
    queryFn: () => api.get(`/delivery/proof/${deliveryId}`).then(r => r.data.data),
  })

  const { mutate: submitProof, isLoading } = useMutation({
    mutationFn: () => api.post(`/delivery/agent/${deliveryId}/proof`, { photoUrl }),
    onSuccess: () => { toast.success('Proof of delivery submitted!'); setSubmitted(true) },
    onError: () => toast.error('Failed to submit proof'),
  })

  const uploadPhoto = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setPhotoUrl(res.data.data.url)
    } catch { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  if (existing?.photoUrl || submitted) {
    return (
      <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-3">
        <img src={existing?.photoUrl || photoUrl} alt="Proof" className="w-14 h-14 rounded-lg object-cover" />
        <div>
          <p className="text-sm font-bold text-green-700 flex items-center gap-1"><CheckCircle size={14} /> Proof submitted</p>
          <p className="text-xs text-gray-500">{existing?.capturedAt ? new Date(existing.capturedAt).toLocaleString() : 'Just now'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-3">
      <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1"><Camera size={13} /> Proof of Delivery</p>
      {photoUrl ? (
        <div className="flex items-center gap-3">
          <img src={photoUrl} alt="Proof" className="w-14 h-14 rounded-lg object-cover" />
          <Button size="sm" loading={isLoading} onClick={() => submitProof()}>
            <Upload size={13} /> Submit Proof
          </Button>
          <button onClick={() => setPhotoUrl('')} className="text-xs text-red-500 hover:underline">Remove</button>
        </div>
      ) : (
        <label className="flex items-center gap-2 cursor-pointer text-sm text-blue-600 font-semibold">
          {uploading ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> : <Camera size={16} />}
          {uploading ? 'Uploading...' : 'Take / Upload Photo'}
          <input type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
        </label>
      )}
    </div>
  )
}

export default function DeliveryAgent() {
  const qc = useQueryClient()
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [tracking, setTracking] = useState(false)
  const [myLat, setMyLat] = useState(0)
  const [myLng, setMyLng] = useState(0)

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['agent-assignments'],
    queryFn: () => api.get('/delivery/agent/deliveries').then(r => r.data.data),
    refetchInterval: 30000,
  })

  const { mutate: updateStatus } = useMutation({
    mutationFn: ({ deliveryId, status, lat, lng, estimatedAt }: { deliveryId: string; status: string; lat?: number; lng?: number; estimatedAt?: string }) =>
      api.patch(`/delivery/agent/${deliveryId}/status`, { status, lat: lat || undefined, lng: lng || undefined, estimatedAt }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-assignments'] }); toast.success('Status updated!') },
    onError: () => toast.error('Failed to update status'),
  })

  const [etaInput, setEtaInput] = useState('')

  // Live location tracking
  useEffect(() => {
    if (!tracking || !selectedOrder) return
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        setMyLat(latitude); setMyLng(longitude)
        // Send location to backend
        api.post('/delivery/agent/location', { lat: latitude, lng: longitude }).catch(() => {})
      },
      () => toast.error('Location access denied'),
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [tracking, selectedOrder])

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size="lg" /></div>

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-gray-900">🚚 Delivery Dashboard</h1>
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${tracking ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
          {tracking ? 'Tracking active' : 'Tracking off'}
        </div>
      </div>

      {!assignments?.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="font-bold text-gray-700 mb-2">No active deliveries</h3>
          <p className="text-gray-400 text-sm">New assignments will appear here</p>
        </div>
      ) : (
        assignments.map((d: any) => (
          <div key={d.id} className={`bg-white rounded-2xl shadow-card p-5 border-2 transition-all cursor-pointer ${selectedOrder?.id === d.id ? 'border-green-primary' : 'border-transparent'}`}
            onClick={() => setSelectedOrder(d)}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-extrabold text-gray-900">Order #{d.orderId?.slice(-8).toUpperCase()}</p>
                <p className="text-xs text-gray-400">{formatDate(d.createdAt)}</p>
              </div>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                d.status === 'DELIVERED' ? 'bg-green-100 text-green-primary' :
                d.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-600' :
                'bg-yellow-100 text-yellow-700'
              }`}>{d.status.replace(/_/g,' ')}</span>
            </div>

            {/* Delivery address */}
            {d.order?.address && (
              <div className="flex items-start gap-2 mb-3 bg-gray-50 rounded-xl p-3">
                <MapPin size={16} className="text-green-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-gray-800">{d.order.address.fullName}</p>
                  <p className="text-sm text-gray-600">{d.order.address.street}</p>
                  <p className="text-xs text-gray-400">{d.order.address.city}</p>
                </div>
                <a href={`tel:${d.order.address.phone}`} className="ml-auto p-2 bg-green-primary text-white rounded-full" onClick={e => e.stopPropagation()}>
                  <Phone size={14} />
                </a>
              </div>
            )}

            {/* Order value */}
            <p className="text-sm text-gray-500 mb-3">
              Order value: <span className="font-bold text-green-primary">{formatPrice(d.order?.total || 0)}</span>
              {d.order?.payment?.method === 'CASH_ON_DELIVERY' && (
                <span className="ml-2 bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">💵 Collect Cash</span>
              )}
            </p>

            {/* ETA picker — show when about to pick up */}
            {d.status === 'ASSIGNED' && selectedOrder?.id === d.id && (
              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs text-gray-500 flex-shrink-0">Set ETA:</label>
                <input type="datetime-local" value={etaInput} onChange={e => setEtaInput(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:border-green-primary" />
              </div>
            )}

            {/* Status update buttons */}
            {d.status !== 'DELIVERED' && (
              <div className="flex gap-2 flex-wrap">
                {STATUS_STEPS.filter(s => STATUS_STEPS.indexOf(s) > STATUS_STEPS.indexOf(d.status)).map(nextStatus => (
                  <Button key={nextStatus} size="sm" variant={nextStatus === 'DELIVERED' ? 'primary' : 'outline'}
                    onClick={e => { e.stopPropagation(); updateStatus({ deliveryId: d.id, status: nextStatus, lat: myLat || undefined, lng: myLng || undefined, estimatedAt: nextStatus === 'PICKED_UP' && etaInput ? etaInput : undefined }) }}>
                    {nextStatus === 'DELIVERED' ? <><CheckCircle size={14} /> Mark Delivered</> : nextStatus.replace(/_/g,' ')}
                  </Button>
                ))}
              </div>
            )}

            {/* Proof of Delivery upload — show when IN_TRANSIT or just delivered */}
            {(d.status === 'IN_TRANSIT' || d.status === 'DELIVERED') && selectedOrder?.id === d.id && (
              <ProofOfDeliveryUpload deliveryId={d.id} isDelivered={d.status === 'DELIVERED'} />
            )}

            {/* Live tracking toggle */}
            {selectedOrder?.id === d.id && d.status !== 'DELIVERED' && (
              <div className="mt-3">
                <button onClick={e => { e.stopPropagation(); setTracking(!tracking) }}
                  className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full transition-colors ${tracking ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-primary'}`}>
                  <Navigation size={14} /> {tracking ? 'Stop Sharing Location' : 'Share My Location'}
                </button>
                {tracking && myLat !== 0 && (
                  <div className="mt-3">
                    <DeliveryMap lat={myLat} lng={myLng} height="200px" markerLabel="Your Location"
                      destinationLat={d.order?.address?.latitude} destinationLng={d.order?.address?.longitude} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
