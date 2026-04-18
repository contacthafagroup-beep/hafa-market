import { useSearchParams, Link } from 'react-router-dom'
import { CheckCircle, Package, ArrowRight, MapPin } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { orderService } from '@/services/order.service'
import { useEffect, useRef } from 'react'
import { analytics } from '@/lib/analytics'
import Button from '@/components/ui/Button'
import { formatPrice } from '@/lib/utils'

export default function OrderSuccess() {
  const [params] = useSearchParams()
  const orderId  = params.get('orderId')
  const txRef    = params.get('trx_ref') || params.get('tx_ref')
  const confettiRef = useRef(false)

  // Confetti on mount
  useEffect(() => {
    if (confettiRef.current) return
    confettiRef.current = true
    const colors = ['#2E7D32','#FFA726','#fff','#43a047','#fb8c00','#69f0ae']
    for (let i = 0; i < 80; i++) {
      const el = document.createElement('div')
      const size = 6 + Math.random() * 10
      const dx = (Math.random() - 0.5) * window.innerWidth * 0.8
      const dy = -200 - Math.random() * 400
      el.style.cssText = `position:fixed;width:${size}px;height:${size}px;background:${colors[Math.floor(Math.random()*colors.length)]};border-radius:${Math.random()>.5?'50%':'2px'};left:50%;top:50%;pointer-events:none;z-index:9999;transition:transform 1.5s ease,opacity 1.5s ease;opacity:1`
      document.body.appendChild(el)
      requestAnimationFrame(() => {
        el.style.transform = `translate(${dx}px,${dy}px) rotate(${Math.random()*720}deg)`
        el.style.opacity = '0'
      })
      setTimeout(() => el.remove(), 1600)
    }
  }, [])

  // Verify Chapa payment if txRef present
  useEffect(() => {
    if (txRef) orderService.chapaVerify(txRef).catch(() => {})
  }, [txRef])

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn:  () => orderService.getOrder(orderId!).then(r => r.data.data),
    enabled:  !!orderId,
  })

  // Track purchase — must come after order is defined
  useEffect(() => {
    if (order?.id) analytics.purchase(order.id, order.total)
  }, [order?.id])

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      {/* Success animation */}
      <div className="w-28 h-28 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg" style={{ animation: 'successPop .5s cubic-bezier(.34,1.56,.64,1)' }}>
        <CheckCircle size={56} className="text-green-primary" />
      </div>

      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Order Placed! 🎉</h1>
      <p className="text-gray-500 mb-1">Thank you for shopping with Hafa Market.</p>
      <p className="text-sm text-gray-400 mb-6">
        We'll deliver your order within <strong className="text-green-primary">24–48 hours</strong>
      </p>

      {orderId && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-3 mb-6 inline-block">
          <p className="text-xs text-gray-500">Order ID</p>
          <p className="font-extrabold text-gray-800 text-lg">#{orderId.slice(-8).toUpperCase()}</p>
        </div>
      )}

      {order && (
        <div className="bg-white rounded-2xl shadow-card p-5 mb-6 text-left space-y-3">
          <div className="flex justify-between text-sm border-b border-gray-100 pb-3">
            <span className="text-gray-500">Status</span>
            <span className="font-bold text-green-primary capitalize bg-green-50 px-3 py-0.5 rounded-full text-xs">{order.status}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Items</span>
            <span className="font-bold">{order.items?.length} items</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-bold">{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Delivery</span>
            <span className={`font-bold ${order.deliveryFee === 0 ? 'text-green-primary' : ''}`}>
              {order.deliveryFee === 0 ? '🎉 FREE' : formatPrice(order.deliveryFee)}
            </span>
          </div>
          <div className="flex justify-between text-sm border-t border-gray-100 pt-3">
            <span className="font-bold text-gray-900">Total</span>
            <span className="font-extrabold text-green-primary text-lg">{formatPrice(order.total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Payment</span>
            <span className="font-bold">{order.payment?.method?.replace(/_/g,' ')}</span>
          </div>
          {order.address && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1"><MapPin size={12} /> Deliver to</span>
              <span className="font-medium text-right">{order.address.street}, {order.address.city}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {orderId && order?.delivery?.trackingCode && (
          <Link to={`/track/${order.delivery.trackingCode}`}>
            <Button fullWidth size="lg"><Package size={18} /> Track Your Order</Button>
          </Link>
        )}
        <Link to="/account/orders"><Button fullWidth variant="outline">View All Orders</Button></Link>
        <Link to="/products" className="text-sm text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center gap-1">
          Continue Shopping <ArrowRight size={14} />
        </Link>
      </div>

      <style>{`@keyframes successPop{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}`}</style>
    </div>
  )
}
