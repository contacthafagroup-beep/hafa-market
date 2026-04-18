import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Plus, Trash2, CheckCircle, RotateCcw, Package, ArrowRight } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatPrice, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

const ORG_TYPES = ['RESTAURANT','HOTEL','CAFE','EVENT','SCHOOL','HOSPITAL','OTHER']
const CITIES    = ['Addis Ababa','Hossana','Hawassa','Bahir Dar','Dire Dawa','Mekelle','Gondar','Jimma','Adama','Other']
const UNITS     = ['kg','g','piece','bunch','liter','bag','box','dozen','quintal']
const FREQS     = ['WEEKLY','BIWEEKLY','MONTHLY']

const PRODUCTS_SUGGESTIONS = [
  'Tomatoes','Onions','Potatoes','Cabbage','Carrots','Peppers','Garlic',
  'Teff','Wheat','Maize','Barley','Lentils','Chickpeas','Beans',
  'Eggs','Milk','Chicken','Beef','Mutton',
  'Coffee (Roasted)','Coffee (Raw)','Honey','Spices',
]

const LANGS = {
  en: {
    title: 'Bulk Order Request',
    subtitle: 'For restaurants, hotels, cafes, events & organizations across Ethiopia',
    step1: 'Your Organization',
    step2: 'What You Need',
    step3: 'Delivery & Schedule',
    step4: 'Confirm & Submit',
    submit: 'Submit Bulk Request',
    success: 'Request Submitted!',
    successMsg: "We'll contact you within 2 hours with a quote.",
  },
  am: {
    title: 'የጅምላ ትዕዛዝ ጥያቄ',
    subtitle: 'ለምግብ ቤቶች፣ ሆቴሎች፣ ካፌዎች፣ ዝግጅቶች እና ድርጅቶች በኢትዮጵያ',
    step1: 'ድርጅትዎ',
    step2: 'የሚፈልጉት',
    step3: 'ማድረሻ እና መርሃ ግብር',
    step4: 'ያረጋግጡ እና ያስገቡ',
    submit: 'ጥያቄ ያስገቡ',
    success: 'ጥያቄ ተቀብሏል!',
    successMsg: 'በ2 ሰዓት ውስጥ ዋጋ ይልካሉ።',
  },
}

interface BulkItem { product: string; quantity: string; unit: string; notes: string }

export default function BulkOrder() {
  const [params] = useSearchParams()
  const { user, isAuthenticated } = useAuth()
  const [lang, setLang] = useState<'en'|'am'>('en')
  const [step, setStep] = useState(1)
  const [submitted, setSubmitted] = useState(false)
  const [reference, setReference] = useState('')

  const L = LANGS[lang]

  // Form state
  const [orgName, setOrgName]     = useState('')
  const [orgType, setOrgType]     = useState(params.get('type') || 'RESTAURANT')
  const [city, setCity]           = useState('Addis Ababa')
  const [contactName, setContact] = useState(user?.name || '')
  const [phone, setPhone]         = useState(user?.phone || '')
  const [email, setEmail]         = useState(user?.email || '')
  const [items, setItems]         = useState<BulkItem[]>([
    { product: '', quantity: '', unit: 'kg', notes: '' }
  ])
  const [deliveryDate, setDeliveryDate] = useState('')
  const [isRecurring, setIsRecurring]   = useState(false)
  const [recurringFreq, setRecurringFreq] = useState('WEEKLY')
  const [notes, setNotes]               = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH_ON_DELIVERY')

  // My previous bulk orders (for reorder)
  const { data: myOrders } = useQuery({
    queryKey: ['my-bulk-orders'],
    queryFn: () => api.get('/bulk-orders/my').then(r => r.data.data),
    enabled: isAuthenticated,
  })

  const { mutate: submit, isLoading } = useMutation({
    mutationFn: () => api.post('/bulk-orders', {
      orgName, orgType, city, contactName, phone, email,
      items: items.filter(i => i.product && i.quantity),
      deliveryDate: deliveryDate || null,
      isRecurring, recurringFreq: isRecurring ? recurringFreq : null,
      notes, language: lang,
      userId: user?.id || null,
      paymentMethod,
    }),
    onSuccess: (res) => {
      setReference(res.data.data.reference)
      setSubmitted(true)
      toast.success(L.success)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to submit'),
  })

  const { mutate: reorder } = useMutation({
    mutationFn: (id: string) => api.post(`/bulk-orders/${id}/reorder`),
    onSuccess: () => toast.success('Reorder submitted!'),
  })

  const addItem = () => setItems(prev => [...prev, { product:'', quantity:'', unit:'kg', notes:'' }])
  const removeItem = (i: number) => setItems(prev => prev.filter((_,idx) => idx !== i))
  const setItem = (i: number, k: keyof BulkItem, v: string) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item))

  const canNext = () => {
    if (step === 1) return orgName && contactName && phone && city
    if (step === 2) return items.some(i => i.product && i.quantity)
    if (step === 3) return true
    return true
  }

  if (submitted) return (
    <div className="max-w-lg mx-auto px-4 py-20 text-center">
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle size={48} className="text-green-primary" />
      </div>
      <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{L.success}</h1>
      <p className="text-gray-500 mb-2">{L.successMsg}</p>
      <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-3 mb-6 inline-block">
        <p className="text-xs text-gray-500">Reference Number</p>
        <p className="font-extrabold text-gray-800 text-xl">#{reference}</p>
      </div>
      <div className="space-y-3">
        <p className="text-sm text-gray-400">Our team will call you at <strong>{phone}</strong> within 2 hours.</p>
        <Link to="/"><Button fullWidth variant="outline">Back to Home</Button></Link>
      </div>
    </div>
  )

  const STEPS = [L.step1, L.step2, L.step3, L.step4]

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-1.5 mb-4">
          <span className="text-xs font-bold text-green-primary uppercase tracking-wide">🏢 B2B Bulk Orders</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{L.title}</h1>
        <p className="text-gray-400 text-sm">{L.subtitle}</p>

        {/* Language toggle */}
        <div className="flex justify-center gap-2 mt-4">
          {(['en','am'] as const).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${lang===l ? 'bg-green-primary text-white border-green-primary' : 'border-gray-200 text-gray-500'}`}>
              {l === 'en' ? '🇬🇧 English' : '🇪🇹 አማርኛ'}
            </button>
          ))}
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
              step > i+1 ? 'bg-green-primary text-white' :
              step === i+1 ? 'bg-green-primary text-white ring-4 ring-green-100' :
              'bg-gray-100 text-gray-400'
            }`}>
              {step > i+1 ? '✓' : i+1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${step === i+1 ? 'text-green-primary' : 'text-gray-400'}`}>{s}</span>
            {i < STEPS.length-1 && <div className={`flex-1 h-1 rounded-full ${step > i+1 ? 'bg-green-primary' : 'bg-gray-100'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-card p-6 mb-6">

        {/* Step 1 — Organization */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-extrabold text-gray-900 text-lg mb-4">{L.step1}</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Organization Type</label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {ORG_TYPES.map(t => (
                  <button key={t} type="button" onClick={() => setOrgType(t)}
                    className={`py-2 px-3 rounded-xl border-2 text-xs font-bold transition-all ${orgType===t ? 'border-green-primary bg-green-50 text-green-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <Input label="Organization / Business Name *" placeholder="e.g. Addis Coffee House"
              value={orgName} onChange={(e: any) => setOrgName(e.target.value)} />

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">City *</label>
              <select value={city} onChange={e => setCity(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
                {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Contact Person *" placeholder="Your full name"
                value={contactName} onChange={(e: any) => setContact(e.target.value)} />
              <Input label="Phone Number *" type="tel" placeholder="+251 911 000 000"
                value={phone} onChange={(e: any) => setPhone(e.target.value)} />
            </div>
            <Input label="Email (optional)" type="email" placeholder="business@email.com"
              value={email} onChange={(e: any) => setEmail(e.target.value)} />
          </div>
        )}

        {/* Step 2 — Items */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-extrabold text-gray-900 text-lg mb-4">{L.step2}</h2>

            {items.map((item, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-700">Item {i+1}</span>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 transition-colors">
                      <Trash2 size={15}/>
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Product *</label>
                  <input list={`products-${i}`} value={item.product}
                    onChange={e => setItem(i, 'product', e.target.value)}
                    placeholder="e.g. Tomatoes, Teff, Coffee..."
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-primary" />
                  <datalist id={`products-${i}`}>
                    {PRODUCTS_SUGGESTIONS.map(p => <option key={p} value={p}/>)}
                  </datalist>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Quantity *</label>
                    <input type="number" value={item.quantity} onChange={e => setItem(i,'quantity',e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Unit</label>
                    <select value={item.unit} onChange={e => setItem(i,'unit',e.target.value)}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-primary bg-white">
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <input value={item.notes} onChange={e => setItem(i,'notes',e.target.value)}
                  placeholder="Special requirements (optional)..."
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-green-primary" />
              </div>
            ))}

            <button onClick={addItem}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-green-200 rounded-xl text-sm font-semibold text-green-primary hover:bg-green-50 transition-colors">
              <Plus size={16}/> Add Another Item
            </button>
          </div>
        )}

        {/* Step 3 — Delivery & Schedule */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="font-extrabold text-gray-900 text-lg mb-4">{L.step3}</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Preferred Delivery Date</label>
              <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary" />
            </div>

            {/* Recurring */}
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <label className="flex items-center gap-3 cursor-pointer mb-3">
                <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 accent-green-primary" />
                <div>
                  <p className="font-bold text-gray-800 text-sm">🔄 Recurring Order</p>
                  <p className="text-xs text-gray-500">Automatically repeat this order on a schedule</p>
                </div>
              </label>
              {isRecurring && (
                <div className="flex gap-2">
                  {FREQS.map(f => (
                    <button key={f} type="button" onClick={() => setRecurringFreq(f)}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold transition-all ${recurringFreq===f ? 'border-green-primary bg-green-primary text-white' : 'border-gray-200 text-gray-600'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Payment */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value:'CASH_ON_DELIVERY', label:'Cash on Delivery', icon:'💵' },
                  { value:'CHAPA',            label:'Chapa / Telebirr', icon:'📱' },
                  { value:'BANK_TRANSFER',    label:'Bank Transfer',    icon:'🏦' },
                  { value:'INVOICE',          label:'Invoice (30 days)',icon:'🧾' },
                ].map(m => (
                  <label key={m.value} className={`flex items-center gap-2 p-3 border-2 rounded-xl cursor-pointer transition-all ${paymentMethod===m.value ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" value={m.value} checked={paymentMethod===m.value}
                      onChange={() => setPaymentMethod(m.value)} className="accent-green-primary" />
                    <span>{m.icon}</span>
                    <span className="text-sm font-medium text-gray-700">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Additional Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="Any special requirements, delivery instructions, quality preferences..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none" />
            </div>
          </div>
        )}

        {/* Step 4 — Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-extrabold text-gray-900 text-lg mb-4">{L.step4}</h2>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Organization</span><span className="font-bold">{orgName} ({orgType})</span></div>
              <div className="flex justify-between"><span className="text-gray-500">City</span><span className="font-medium">{city}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Contact</span><span className="font-medium">{contactName} · {phone}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Items</span><span className="font-medium">{items.filter(i=>i.product).length} products</span></div>
              {deliveryDate && <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span className="font-medium">{deliveryDate}</span></div>}
              {isRecurring && <div className="flex justify-between"><span className="text-gray-500">Recurring</span><span className="font-medium text-green-primary">🔄 {recurringFreq}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Payment</span><span className="font-medium">{paymentMethod.replace(/_/g,' ')}</span></div>
            </div>
            <div className="space-y-2">
              {items.filter(i=>i.product).map((item,i) => (
                <div key={i} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-3">
                  <Package size={16} className="text-green-primary flex-shrink-0"/>
                  <span className="flex-1 text-sm font-medium">{item.product}</span>
                  <span className="text-sm text-gray-500">{item.quantity} {item.unit}</span>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              ⏱ Our team will review your request and contact you within <strong>2 hours</strong> with a quote.
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {step > 1 && (
          <Button variant="outline" onClick={() => setStep(s => s-1)}>← Back</Button>
        )}
        {step < 4 ? (
          <Button fullWidth onClick={() => setStep(s => s+1)} disabled={!canNext()}>
            Continue <ArrowRight size={16}/>
          </Button>
        ) : (
          <Button fullWidth size="lg" loading={isLoading} onClick={() => submit()}>
            {L.submit}
          </Button>
        )}
      </div>

      {/* My previous bulk orders — reorder */}
      {isAuthenticated && myOrders?.length > 0 && (
        <div className="mt-10">
          <h3 className="font-extrabold text-gray-900 mb-4 flex items-center gap-2">
            <RotateCcw size={18} className="text-green-primary"/> Previous Bulk Orders
          </h3>
          <div className="space-y-3">
            {myOrders.slice(0,3).map((o: any) => (
              <div key={o.id} className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-sm">{o.orgName}</p>
                  <p className="text-xs text-gray-400">{(o.items as any[]).length} items · {formatDate(o.createdAt)}</p>
                </div>
                <span className={`badge text-xs ${
                  o.status==='DELIVERED' ? 'bg-green-100 text-green-700' :
                  o.status==='QUOTED'    ? 'bg-blue-100 text-blue-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>{o.status}</span>
                <Button size="sm" variant="outline" onClick={() => reorder(o.id)}>
                  <RotateCcw size={13}/> Reorder
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
