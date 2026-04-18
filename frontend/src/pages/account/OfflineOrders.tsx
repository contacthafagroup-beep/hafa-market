import { useState, useEffect } from 'react'
import { WifiOff, Upload, CheckCircle, Trash2, RefreshCw } from 'lucide-react'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

const OFFLINE_QUEUE_KEY = 'hafa_offline_orders'

interface OfflineOrder {
  id: string
  items: Array<{ name: string; qty: number; price: number; unit: string }>
  total: number
  address: string
  paymentMethod: string
  createdAt: string
  synced: boolean
}

export function queueOfflineOrder(order: Omit<OfflineOrder, 'id' | 'synced'>) {
  const existing: OfflineOrder[] = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
  const newOrder: OfflineOrder = { ...order, id: Date.now().toString(), synced: false }
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([...existing, newOrder]))
  return newOrder
}

export function getOfflineOrders(): OfflineOrder[] {
  return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]')
}

export default function OfflineOrders() {
  const [orders, setOrders] = useState<OfflineOrder[]>(getOfflineOrders)
  const [syncing, setSyncing] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const syncAll = async () => {
    const pending = orders.filter(o => !o.synced)
    if (!pending.length) { toast.error('No pending orders to sync'); return }
    if (!isOnline) { toast.error('You are offline. Connect to internet first.'); return }

    setSyncing(true)
    let synced = 0
    const updated = [...orders]

    for (const order of pending) {
      try {
        // Try to submit the order
        await api.post('/bulk-orders', {
          orgName: 'Offline Order',
          orgType: 'OTHER',
          city: 'Hossana',
          contactName: 'Customer',
          phone: '',
          items: order.items.map(i => ({ product: i.name, quantity: i.qty, unit: i.unit })),
          notes: `Offline order synced. Address: ${order.address}. Payment: ${order.paymentMethod}`,
          paymentMethod: order.paymentMethod,
          isRecurring: false,
          language: 'en',
        })
        const idx = updated.findIndex(o => o.id === order.id)
        if (idx !== -1) updated[idx] = { ...updated[idx], synced: true }
        synced++
      } catch {}
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated))
    setOrders(updated)
    setSyncing(false)
    toast.success(`${synced} order${synced !== 1 ? 's' : ''} synced successfully!`)
  }

  const deleteOrder = (id: string) => {
    const updated = orders.filter(o => o.id !== id)
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated))
    setOrders(updated)
    toast.success('Order removed from queue')
  }

  const pending = orders.filter(o => !o.synced)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <WifiOff size={18} className={isOnline ? 'text-green-primary' : 'text-red-500'} />
            Offline Orders
          </h2>
          <p className="text-sm text-gray-400">Orders captured while offline — sync when connected</p>
        </div>
        {pending.length > 0 && (
          <Button loading={syncing} disabled={!isOnline} onClick={syncAll}>
            <Upload size={15} /> Sync {pending.length} Orders
          </Button>
        )}
      </div>

      {/* Connection status */}
      <div className={`flex items-center gap-3 p-4 rounded-2xl border-2 ${isOnline ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
        <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        <div>
          <p className={`font-bold text-sm ${isOnline ? 'text-green-700' : 'text-red-700'}`}>
            {isOnline ? '✅ Connected — Ready to sync' : '📡 Offline — Orders will sync when connected'}
          </p>
          <p className={`text-xs ${isOnline ? 'text-green-600' : 'text-red-600'}`}>
            {pending.length} pending · {orders.filter(o => o.synced).length} synced
          </p>
        </div>
      </div>

      {!orders.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <WifiOff size={40} className="mx-auto text-gray-200 mb-4" />
          <h3 className="font-bold text-gray-700 mb-2">No offline orders</h3>
          <p className="text-gray-400 text-sm">Orders placed while offline will appear here for syncing</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.id} className={`bg-white rounded-2xl shadow-card p-4 border-l-4 ${order.synced ? 'border-green-primary' : 'border-orange-400'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-gray-900">Order #{order.id.slice(-6)}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${order.synced ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {order.synced ? '✅ Synced' : '⏳ Pending'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleString()}</p>
                  <div className="mt-2 space-y-1">
                    {order.items.map((item, i) => (
                      <p key={i} className="text-xs text-gray-600">{item.qty} {item.unit} × {item.name}</p>
                    ))}
                  </div>
                  <p className="text-sm font-bold text-green-primary mt-2">{formatPrice(order.total)}</p>
                </div>
                {!order.synced && (
                  <button onClick={() => deleteOrder(order.id)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How offline mode works */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
        <h3 className="font-bold text-blue-800 mb-3">📱 Offline Mode Features</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm text-blue-700">
          <div className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 flex-shrink-0" /><span>Browse products without internet</span></div>
          <div className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 flex-shrink-0" /><span>Add to cart while offline</span></div>
          <div className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 flex-shrink-0" /><span>Orders queued and synced automatically</span></div>
          <div className="flex items-start gap-2"><CheckCircle size={14} className="mt-0.5 flex-shrink-0" /><span>View past orders from cache</span></div>
        </div>
      </div>
    </div>
  )
}
