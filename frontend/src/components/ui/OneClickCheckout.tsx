import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Zap, CheckCircle, Lock } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { useAuth } from '@/hooks/useAuth'
import { orderService } from '@/services/order.service'
import { formatPrice } from '@/lib/utils'
import api from '@/lib/api'
import toast from 'react-hot-toast'

const SAVED_PAYMENT_KEY = 'hafa_saved_payment'
const SAVED_ADDRESS_KEY = 'hafa_saved_address'

interface SavedPayment {
  method: string
  label: string
  icon: string
}

interface SavedAddress {
  id: string
  label: string
  street: string
  city: string
}

interface Props {
  product?: any
  quantity?: number
  className?: string
}

export default function OneClickCheckout({ product, quantity = 1, className = '' }: Props) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { items, total, clear } = useCart()
  const [showSetup, setShowSetup] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState('CASH_ON_DELIVERY')

  // Load saved preferences
  const savedPayment: SavedPayment | null = (() => {
    try { return JSON.parse(localStorage.getItem(SAVED_PAYMENT_KEY) || 'null') } catch { return null }
  })()

  const savedAddress: SavedAddress | null = (() => {
    try { return JSON.parse(localStorage.getItem(SAVED_ADDRESS_KEY) || 'null') } catch { return null }
  })()

  const savePreferences = (method: string, methodLabel: string, methodIcon: string) => {
    localStorage.setItem(SAVED_PAYMENT_KEY, JSON.stringify({ method, label: methodLabel, icon: methodIcon }))
    setShowSetup(false)
    toast.success('Payment preference saved! One-click checkout enabled.')
  }

  const { mutate: placeOrder, isPending } = useMutation({
    mutationFn: async () => {
      const method = savedPayment?.method || 'CASH_ON_DELIVERY'

      // If single product, add to cart first
      if (product) {
        await api.post('/cart', { productId: product.id, quantity })
      }

      // Get default address
      const addrRes = await api.get('/users/addresses')
      const addresses = addrRes.data.data || []
      const defaultAddr = addresses.find((a: any) => a.isDefault) || addresses[0]

      if (!defaultAddr) {
        throw new Error('No saved address. Please add a delivery address first.')
      }

      const orderItems = product
        ? [{ productId: product.id, quantity }]
        : items.map(i => ({ productId: i.productId, quantity: i.quantity }))

      return orderService.createOrder({
        addressId: defaultAddr.id,
        paymentMethod: method as any,
        items: orderItems,
        notes: 'One-click order',
      } as any)
    },
    onSuccess: async (res) => {
      const order = res.data.data
      try {
        const payRes = await orderService.initiatePayment(order.id, (savedPayment?.method || 'CASH_ON_DELIVERY') as any)
        const payData = payRes.data.data
        if (payData.checkoutUrl) {
          window.location.href = payData.checkoutUrl
        } else {
          if (!product) clear()
          navigate(`/order/success?orderId=${order.id}`)
        }
      } catch {
        if (!product) clear()
        navigate(`/order/success?orderId=${order.id}`)
      }
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || e?.message || 'Order failed'
      if (msg.includes('address')) {
        toast.error('Please add a delivery address first')
        navigate('/account/addresses')
      } else {
        toast.error(msg)
      }
    },
  })

  if (!user) return null

  const PAYMENT_OPTIONS = [
    { method: 'CASH_ON_DELIVERY', label: 'Cash on Delivery', icon: '💵' },
    { method: 'TELEBIRR', label: 'TeleBirr', icon: '📱' },
    { method: 'CBE_BIRR', label: 'CBE Birr', icon: '🏦' },
    { method: 'CHAPA', label: 'Chapa', icon: '🇪🇹' },
  ]

  // Setup modal
  if (showSetup) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowSetup(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
          <h3 className="font-extrabold text-gray-900 mb-1">⚡ Enable One-Click Checkout</h3>
          <p className="text-sm text-gray-400 mb-5">Choose your default payment method</p>
          <div className="space-y-2 mb-5">
            {PAYMENT_OPTIONS.map(opt => (
              <label key={opt.method}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedMethod === opt.method ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" value={opt.method} checked={selectedMethod === opt.method}
                  onChange={() => setSelectedMethod(opt.method)} className="accent-green-primary" />
                <span className="text-lg">{opt.icon}</span>
                <span className="font-semibold text-sm text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <Lock size={12} /> Your preference is saved locally on this device
          </div>
          <button
            onClick={() => {
              const opt = PAYMENT_OPTIONS.find(o => o.method === selectedMethod)!
              savePreferences(opt.method, opt.label, opt.icon)
            }}
            className="w-full bg-green-primary text-white py-3 rounded-xl font-bold text-sm hover:bg-green-dark transition-colors">
            Save & Enable One-Click
          </button>
        </div>
      </div>
    )
  }

  const orderTotal = product ? product.price * quantity : total

  return (
    <div className={className}>
      {savedPayment ? (
        <button
          onClick={() => placeOrder()}
          disabled={isPending || (!product && !items.length)}
          className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-3 px-6 rounded-xl font-extrabold text-sm transition-all disabled:opacity-50 shadow-lg hover:shadow-xl active:scale-95"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
          {isPending ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Zap size={16} className="fill-white" />
          )}
          {isPending ? 'Placing Order...' : (
            <>
              ⚡ Buy Now — {formatPrice(orderTotal)}
              <span className="text-white/70 text-xs font-normal ml-1">via {savedPayment.icon} {savedPayment.label}</span>
            </>
          )}
        </button>
      ) : (
        <button
          onClick={() => setShowSetup(true)}
          className="w-full flex items-center justify-center gap-2 border-2 border-orange-400 text-orange-600 py-3 px-6 rounded-xl font-bold text-sm hover:bg-orange-50 transition-all">
          <Zap size={16} />
          Enable One-Click Checkout
        </button>
      )}
      {savedPayment && (
        <button onClick={() => setShowSetup(true)}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-1.5 transition-colors">
          Change payment method
        </button>
      )}
    </div>
  )
}
