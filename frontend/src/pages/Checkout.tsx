import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MapPin, CreditCard, CheckCircle, Plus, Star, Shield, Package, UserX } from 'lucide-react'
import { useCart } from '@/hooks/useCart'
import { useAuth } from '@/hooks/useAuth'
import { orderService } from '@/services/order.service'
import { userService } from '@/services/user.service'
import { formatPrice } from '@/lib/utils'
import { analytics } from '@/lib/analytics'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import LocationPicker from '@/components/ui/LocationPicker'
import EthiopianCalendarPicker from '@/components/ui/EthiopianCalendar'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import type { PaymentMethod } from '@/types'

// ── Optimistic checkout progress overlay ──────────────────────────────────────
const CHECKOUT_STEPS = [
  { icon: '📦', label: 'Creating order…',    sublabel: 'Reserving your items' },
  { icon: '💳', label: 'Processing payment…', sublabel: 'Connecting to payment gateway' },
  { icon: '✅', label: 'Confirmed!',           sublabel: 'Your order is on its way' },
]

function CheckoutProgressOverlay({ step }: { step: number }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-sm mx-4 text-center">
        <div className="text-5xl mb-4 animate-bounce">{CHECKOUT_STEPS[step]?.icon}</div>
        <h2 className="text-xl font-extrabold text-gray-900 mb-1">{CHECKOUT_STEPS[step]?.label}</h2>
        <p className="text-sm text-gray-400 mb-6">{CHECKOUT_STEPS[step]?.sublabel}</p>

        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-6">
          {CHECKOUT_STEPS.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-500 ${
                i < step ? 'bg-green-500 text-white scale-110' :
                i === step ? 'bg-green-primary text-white scale-125 shadow-lg shadow-green-200' :
                'bg-gray-100 text-gray-400'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < CHECKOUT_STEPS.length - 1 && (
                <div className="absolute" />
              )}
            </div>
          ))}
        </div>

        {/* Animated progress line */}
        <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
          <div
            className="h-2 bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${((step + 1) / CHECKOUT_STEPS.length) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-3">Please don't close this page</p>
      </div>
    </div>
  )
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'CHAPA',               label: 'Chapa',              icon: '🇪🇹' },
  { value: 'TELEBIRR',            label: 'TeleBirr',           icon: '📱' },
  { value: 'CBE_BIRR',            label: 'CBE Birr',           icon: '🏦' },
  { value: 'MPESA',               label: 'M-Pesa',             icon: '📲' },
  { value: 'CARD',                label: 'Credit/Debit Card',  icon: '💳' },
  { value: 'BANK_TRANSFER',       label: 'Bank Transfer',      icon: '🏛️' },
  { value: 'CASH_ON_DELIVERY',    label: 'Cash on Delivery',   icon: '💵' },
  { value: 'PAYMENT_ON_DELIVERY', label: 'Pay on Delivery',    icon: '🚚' },
]

// BNPL option shown when total > ETB 200
const BNPL_THRESHOLD = 200

export default function Checkout() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()
  const { items, total, clear } = useCart()
  const [selectedAddress, setSelectedAddress] = useState<string>('')
  const [paymentMethod, setPaymentMethod]     = useState<PaymentMethod>('CASH_ON_DELIVERY')
  const [deliverySlot, setDeliverySlot]       = useState('ASAP')
  const [customDeliveryDate, setCustomDeliveryDate] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoDiscount, setPromoDiscount] = useState(0)
  const [promoLoading, setPromoLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [redeemPoints, setRedeemPoints] = useState(false)
  const [useBNPL, setUseBNPL] = useState(false)
  // Feature 6: Pickup station
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery')
  const [selectedPickupStation, setSelectedPickupStation] = useState<string>('')
  // Feature 19: Micro-insurance
  const [addInsurance, setAddInsurance] = useState(false)
  const INSURANCE_FEE = 5

  // Optimistic UI — checkout progress overlay (-1 = hidden)
  const [checkoutStep, setCheckoutStep] = useState(-1)

  // Guest checkout state
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestAddress, setGuestAddress] = useState('')
  const isGuest = !user
  const loyaltyPoints: number = (user as any)?.loyaltyPoints ?? 0
  const maxPointsDiscount = Math.min(loyaltyPoints * 0.1, total * 0.2) // max 20% of order, 0.1 ETB per point
  const pointsDiscount = redeemPoints ? maxPointsDiscount : 0
  // Inline address form
  const [addingAddress, setAddingAddress] = useState(false)
  const [addrName, setAddrName] = useState(user?.name || '')
  const [addrPhone, setAddrPhone] = useState(user?.phone || '')
  const [addrLocation, setAddrLocation] = useState<any>(null)
  const [savingAddr, setSavingAddr] = useState(false)

  const applyPromo = async () => {
    if (!promoCode.trim()) return
    setPromoLoading(true)
    try {
      const res = await api.post('/orders/validate-promo', { code: promoCode.trim(), orderTotal: total })
      const { discount, message } = res.data.data
      setPromoDiscount(discount)
      setPromoApplied(true)
      toast.success(message || `Promo applied! -$${discount.toFixed(2)}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid promo code')
      setPromoDiscount(0)
      setPromoApplied(false)
    } finally { setPromoLoading(false) }
  }

  const { data: addressesData } = useQuery({
    queryKey: ['addresses'],
    queryFn:  () => userService.getAddresses().then(r => r.data.data as any[]),
  } as Parameters<typeof useQuery>[0])
  const addresses: any[] = Array.isArray(addressesData) ? addressesData : []

  // Feature 6: Pickup stations
  const { data: pickupStationsData } = useQuery({
    queryKey: ['pickup-stations'],
    queryFn: () => api.get('/features/pickup-stations').then(r => r.data.data as any[]),
    staleTime: 1000 * 60 * 5,
  })
  const pickupStations: any[] = Array.isArray(pickupStationsData) ? pickupStationsData : []

  // Auto-select first address
  useEffect(() => {
    if (addresses?.length && !selectedAddress) {
      setSelectedAddress(addresses[0].id)
    }
  }, [addresses])

  // Track checkout start once
  useEffect(() => { analytics.checkoutStart() }, [])

  // Dynamic delivery fee + ETA based on selected address city
  const selectedAddr = addresses?.find((a: any) => a.id === selectedAddress)
  const { data: deliveryInfo } = useQuery({
    queryKey: ['delivery-fee', selectedAddr?.city, total],
    queryFn: () => api.post('/delivery/calculate-fee', { city: selectedAddr?.city || 'Hossana', subtotal: total }).then(r => r.data.data),
    enabled: !!selectedAddr,
    staleTime: 60000,
  })
  const deliveryFee = deliveryInfo?.fee ?? (total >= 50 ? 0 : 3.99)
  const deliveryEta = deliveryInfo?.eta ?? '24–48 hours'

  const saveInlineAddress = async () => {
    if (!addrName) { toast.error('Enter your name'); return }
    if (!addrPhone) { toast.error('Enter your phone'); return }
    if (!addrLocation?.landmark) { toast.error('Select a landmark'); return }
    setSavingAddr(true)
    try {
      const res = await userService.addAddress({
        label: 'Home', fullName: addrName, phone: addrPhone,
        street: addrLocation.landmark, city: 'Hossana',
        region: 'Hadiya Zone', country: 'Ethiopia',
        latitude: addrLocation.lat || undefined,
        longitude: addrLocation.lng || undefined,
        isDefault: true,
      } as any)
      const newAddr = res.data.data
      qc.invalidateQueries({ queryKey: ['addresses'] })
      setSelectedAddress(newAddr.id)
      setAddingAddress(false)
      toast.success('Address saved!')
    } catch { toast.error('Failed to save address') }
    finally { setSavingAddr(false) }
  }

  const { mutate: placeOrder, isPending: isLoading } = useMutation({
    mutationFn: () => {
      // Step 0: show overlay immediately (optimistic — masks server latency)
      setCheckoutStep(0)
      return orderService.createOrder({
        addressId: isGuest ? undefined : selectedAddress,
        paymentMethod,
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        notes: notes || undefined,
        promoCode: promoApplied ? promoCode : undefined,
        deliverySlot,
        redeemPoints: redeemPoints && pointsDiscount > 0 ? true : undefined,
        // Guest checkout fields
        ...(isGuest && {
          guestName,
          guestPhone,
          guestEmail: guestEmail || undefined,
          guestAddress,
        }),
      } as any)
    },
    onSuccess: async (res) => {
      const order = res.data.data
      setCheckoutStep(1) // Step 1: payment processing
      try {
        const payRes = await orderService.initiatePayment(order.id, paymentMethod)
        const payData = payRes.data.data
        if (payData.checkoutUrl) {
          // External payment gateway — show step 1 briefly then redirect
          setTimeout(() => { window.location.href = payData.checkoutUrl }, 600)
        } else {
          setCheckoutStep(2) // Step 2: confirmed
          setTimeout(() => {
            clear()
            navigate(`/order/success?orderId=${order.id}`)
          }, 800)
        }
      } catch {
        setCheckoutStep(2)
        setTimeout(() => {
          clear()
          navigate(`/order/success?orderId=${order.id}`)
        }, 800)
      }
    },
    onError: () => {
      setCheckoutStep(-1)
      toast.error('Failed to place order. Please try again.')
    },
  })

  const finalTotal = total + deliveryFee - promoDiscount - pointsDiscount + (addInsurance ? INSURANCE_FEE : 0)
  const bnplInstallment = Math.ceil(finalTotal / 2)

  if (!items.length) { navigate('/cart'); return null }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Guest checkout validation
    if (isGuest) {
      if (!guestName.trim()) { toast.error('Enter your name'); return }
      if (!guestPhone.trim()) { toast.error('Enter your phone number'); return }
      if (!guestAddress.trim()) { toast.error('Enter your delivery address'); return }
      placeOrder()
      return
    }
    if (deliveryType === 'delivery' && !selectedAddress) {
      toast.error('Please select a delivery address')
      return
    }
    if (deliveryType === 'pickup' && !selectedPickupStation) {
      toast.error('Please select a pickup station')
      return
    }
    placeOrder()
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Optimistic checkout progress overlay */}
      {checkoutStep >= 0 && <CheckoutProgressOverlay step={checkoutStep} />}

      <h1 className="text-2xl font-extrabold text-gray-900 mb-8">Checkout</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">

            {/* Guest Checkout Banner */}
            {isGuest && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3">
                <UserX size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-blue-800 text-sm">Checking out as Guest</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    <Link to="/login?redirect=/checkout" className="underline font-semibold">Sign in</Link> or{' '}
                    <Link to="/register?redirect=/checkout" className="underline font-semibold">create an account</Link> to track orders, earn loyalty points, and save addresses.
                  </p>
                </div>
              </div>
            )}

            {/* Guest Contact Form */}
            {isGuest && (
              <div className="bg-white rounded-2xl shadow-card p-6">
                <h2 className="font-extrabold text-gray-900 flex items-center gap-2 mb-4">
                  <UserX size={18} className="text-blue-500" /> Your Details
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input label="Full Name *" placeholder="Your name" value={guestName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestName(e.target.value)} />
                  <Input label="Phone *" type="tel" placeholder="+251 9XX XXX XXX" value={guestPhone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestPhone(e.target.value)} />
                  <Input label="Email (optional)" type="email" placeholder="for order confirmation" value={guestEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestEmail(e.target.value)} />
                  <Input label="Delivery Address *" placeholder="Street, area, city" value={guestAddress}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGuestAddress(e.target.value)} />
                </div>
              </div>
            )}

            {/* Delivery Address */}
            <div className="bg-white rounded-2xl shadow-card p-6">
              <h2 className="font-extrabold text-gray-900 flex items-center gap-2 mb-4"><MapPin size={18} className="text-green-primary" /> Delivery Method</h2>

              {/* Feature 6: Delivery type toggle */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${deliveryType === 'delivery' ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="deliveryType" value="delivery" checked={deliveryType === 'delivery'} onChange={() => setDeliveryType('delivery')} className="accent-green-primary" />
                  <div>
                    <div className="font-bold text-sm text-gray-800">🚚 Home Delivery</div>
                    <div className="text-xs text-gray-400">Delivered to your door</div>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${deliveryType === 'pickup' ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="deliveryType" value="pickup" checked={deliveryType === 'pickup'} onChange={() => setDeliveryType('pickup')} className="accent-green-primary" />
                  <div>
                    <div className="font-bold text-sm text-gray-800">📍 Pickup Station</div>
                    <div className="text-xs text-gray-400">Free — collect near you</div>
                  </div>
                </label>
              </div>

              {deliveryType === 'pickup' ? (
                <div>
                  {!pickupStations.length ? (
                    <p className="text-sm text-gray-400 text-center py-4">No pickup stations available in your area yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {pickupStations.map((station: any) => (
                        <label key={station.id} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${selectedPickupStation === station.id ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="radio" name="pickup" value={station.id} checked={selectedPickupStation === station.id} onChange={() => setSelectedPickupStation(station.id)} className="mt-1 accent-green-primary" />
                          <div>
                            <div className="font-bold text-sm text-gray-800">{station.name}</div>
                            <div className="text-xs text-gray-500 flex items-center gap-1"><MapPin size={10} /> {station.address}</div>
                            {station.openHours && <div className="text-xs text-gray-400">⏰ {station.openHours}</div>}                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : !addingAddress ? (
                <>
                  {addresses?.length ? (
                    <div className="space-y-3">
                      {addresses.map(addr => (
                        <label key={addr.id} className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedAddress === addr.id ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <input type="radio" name="address" value={addr.id} checked={selectedAddress === addr.id} onChange={() => setSelectedAddress(addr.id)} className="mt-1 accent-green-primary" />
                          <div>
                            <div className="font-bold text-gray-800 text-sm">{addr.label} {addr.isDefault && <span className="badge badge-green text-[10px] ml-1">Default</span>}</div>
                            <div className="text-sm text-gray-600">{addr.fullName} · {addr.phone}</div>
                            <div className="text-sm text-gray-400 flex items-center gap-1"><MapPin size={11} /> {addr.street}, {addr.city}</div>
                            {(addr as any).latitude && <div className="text-xs text-green-600 mt-1">📍 GPS location available</div>}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <MapPin size={32} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-gray-500 text-sm">No delivery location saved yet.</p>
                    </div>
                  )}
                  <button type="button" onClick={() => setAddingAddress(true)}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-green-200 rounded-xl text-sm font-semibold text-green-primary hover:bg-green-50 transition-colors">
                    <Plus size={16} /> Add New Location
                  </button>
                </>
              ) : (
                <div className="space-y-4 border-2 border-green-100 rounded-xl p-4 bg-green-50/30">
                  <h3 className="font-bold text-gray-800 text-sm">📍 Add Delivery Location</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Input label="Full Name" placeholder="Your name" value={addrName}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddrName(e.target.value)} />
                    <Input label="Phone" type="tel" placeholder="+251 9XX XXX XXX" value={addrPhone}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddrPhone(e.target.value)} />
                  </div>
                  <LocationPicker onChange={setAddrLocation} />
                  <div className="flex gap-3">
                    <Button type="button" onClick={saveInlineAddress} loading={savingAddr} size="sm">Save Location</Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAddingAddress(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-2xl shadow-card p-6">
              <h2 className="font-extrabold text-gray-900 flex items-center gap-2 mb-4"><CreditCard size={18} className="text-green-primary" /> Payment Method</h2>
              <div className="grid grid-cols-2 gap-3">
                {PAYMENT_METHODS.map(m => (
                  <label key={m.value} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === m.value ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="payment" value={m.value} checked={paymentMethod === m.value} onChange={() => setPaymentMethod(m.value)} className="accent-green-primary" />
                    <span className="text-lg">{m.icon}</span>
                    <span className="text-sm font-semibold text-gray-700">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Delivery Schedule */}
            <div className="bg-white rounded-2xl shadow-card p-6">
              <h2 className="font-extrabold text-gray-900 flex items-center gap-2 mb-4">
                🕐 Delivery Schedule
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: 'As soon as possible', sub: '24–48 hours', value: 'ASAP' },
                  { label: 'Morning (8am–12pm)', sub: 'Tomorrow', value: 'MORNING' },
                  { label: 'Afternoon (12pm–5pm)', sub: 'Tomorrow', value: 'AFTERNOON' },
                  { label: 'Evening (5pm–8pm)', sub: 'Tomorrow', value: 'EVENING' },
                  { label: 'Choose specific date', sub: 'Ethiopian calendar', value: 'CUSTOM' },
                ].map(slot => (
                  <label key={slot.value} className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${deliverySlot === slot.value ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="slot" value={slot.value} checked={deliverySlot === slot.value}
                      onChange={() => setDeliverySlot(slot.value)} className="mt-1 accent-green-primary" />
                    <div>
                      <div className="font-semibold text-sm text-gray-800">{slot.label}</div>
                      <div className="text-xs text-gray-400">{slot.sub}</div>
                    </div>
                  </label>
                ))}
              </div>
              {deliverySlot === 'CUSTOM' && (
                <EthiopianCalendarPicker
                  label="Select delivery date"
                  value={customDeliveryDate}
                  onChange={(greg) => setCustomDeliveryDate(greg)}
                />
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl shadow-card p-6">
              <h2 className="font-extrabold text-gray-900 mb-4">Additional Notes</h2>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Any special instructions for your order..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none" />
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="bg-white rounded-2xl shadow-card p-6 sticky top-24">
              <h3 className="font-extrabold text-gray-900 text-lg mb-4">Order Summary</h3>
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                {items.map(i => (
                  <div key={i.productId} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-400 flex-shrink-0">{i.quantity}×</span>
                    <span className="text-gray-700 flex-1 line-clamp-1">{i.product.name}</span>
                    <span className="font-semibold flex-shrink-0">{formatPrice(i.product.price * i.quantity)}</span>
                  </div>
                ))}
              </div>

              {/* Promo */}
              <div className="flex gap-2 mb-4">
                <input value={promoCode} onChange={e => setPromoCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && applyPromo()}
                  placeholder="Promo or gift card code"
                  className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-green-primary" />
                <Button type="button" variant="outline" size="sm" loading={promoLoading} onClick={applyPromo}>
                  Apply
                </Button>
              </div>
              {promoApplied && promoDiscount > 0 && (
                <div className="flex justify-between text-sm text-green-primary font-bold mb-2">
                  <span>🎉 Promo discount</span><span>-{formatPrice(promoDiscount)}</span>
                </div>
              )}

              {/* Loyalty points redemption */}
              {loyaltyPoints >= 100 && (
                <div className={`flex items-center justify-between p-3 rounded-xl border-2 mb-3 cursor-pointer transition-all ${redeemPoints ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300'}`}
                  onClick={() => setRedeemPoints(!redeemPoints)}>
                  <div className="flex items-center gap-2">
                    <Star size={16} className="text-orange-400 fill-orange-400" />
                    <div>
                      <p className="text-sm font-bold text-gray-800">{loyaltyPoints.toLocaleString()} pts</p>
                      <p className="text-xs text-gray-400">Save {formatPrice(maxPointsDiscount, 'ETB')}</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${redeemPoints ? 'bg-orange-400 border-orange-400' : 'border-gray-300'}`}>
                    {redeemPoints && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
              )}
              {redeemPoints && pointsDiscount > 0 && (
                <div className="flex justify-between text-sm text-orange-600 font-bold mb-2">
                  <span>⭐ Points discount</span><span>-{formatPrice(pointsDiscount, 'ETB')}</span>
                </div>
              )}

              <div className="space-y-2 border-t border-gray-100 pt-4 mb-5">
                <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>{formatPrice(total)}</span></div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Delivery {deliveryEta && <span className="text-xs text-gray-400">({deliveryEta})</span>}</span>
                  <span className={deliveryFee === 0 ? 'text-green-primary font-bold' : ''}>{deliveryFee === 0 ? 'FREE' : formatPrice(deliveryFee)}</span>
                </div>
                {addInsurance && (
                  <div className="flex justify-between text-sm text-blue-600">
                    <span>🛡️ Delivery Insurance</span><span>+{formatPrice(INSURANCE_FEE)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-gray-900 text-lg pt-2 border-t border-gray-100">
                  <span>Total</span><span className="text-green-primary">{formatPrice(finalTotal)}</span>
                </div>
              </div>

              {/* Feature 19: Micro-insurance toggle */}
              <div
                className={`flex items-center justify-between p-3 rounded-xl border-2 mb-3 cursor-pointer transition-all ${addInsurance ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                onClick={() => setAddInsurance(!addInsurance)}
              >
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-blue-500" />
                  <div>
                    <p className="text-sm font-bold text-gray-800">Delivery Insurance</p>
                    <p className="text-xs text-gray-400">ETB 5 — full refund if damaged/lost</p>
                  </div>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${addInsurance ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                  {addInsurance && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>

              {/* BNPL Option */}
              {finalTotal >= BNPL_THRESHOLD && (
                <div className={`flex items-center justify-between p-3 rounded-xl border-2 mb-3 cursor-pointer transition-all ${useBNPL ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}
                  onClick={() => setUseBNPL(!useBNPL)}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💳</span>
                    <div>
                      <p className="text-sm font-bold text-gray-800">Buy Now, Pay Later</p>
                      <p className="text-xs text-gray-400">2 installments of ETB {bnplInstallment}</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${useBNPL ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                    {useBNPL && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
              )}

              <Button type="submit" fullWidth size="lg" loading={isLoading} disabled={isGuest ? (!guestName || !guestPhone || !guestAddress) : (deliveryType === 'delivery' ? !selectedAddress : !selectedPickupStation)}>
                <CheckCircle size={18} /> {useBNPL ? `Pay ETB ${bnplInstallment} Now (BNPL)` : 'Place Order'}
              </Button>
              <p className="text-xs text-gray-400 text-center mt-3">🔒 Secure checkout · SSL encrypted</p>

              {/* Buyer Protection */}
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs font-bold text-green-700 mb-1.5 flex items-center gap-1">
                  <Shield size={12} /> Hafa Market Buyer Protection
                </p>
                <ul className="space-y-1">
                  {[
                    'Full refund if item not received',
                    'Refund if item not as described',
                    'Secure payment processing',
                    '7-day return policy',
                  ].map(item => (
                    <li key={item} className="text-[10px] text-green-700 flex items-center gap-1">
                      <CheckCircle size={9} className="flex-shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
