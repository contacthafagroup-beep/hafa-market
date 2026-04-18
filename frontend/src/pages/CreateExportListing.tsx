/**
 * CreateExportListing — /export/create
 * Seller creates a new export product listing
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Plus, X } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

const CATEGORIES = [
  { value: 'COFFEE', label: 'Coffee', emoji: '☕' },
  { value: 'TEFF', label: 'Teff', emoji: '🌾' },
  { value: 'HONEY', label: 'Honey', emoji: '🍯' },
  { value: 'SPICES', label: 'Spices', emoji: '🌿' },
  { value: 'AVOCADO', label: 'Avocado', emoji: '🥑' },
  { value: 'SESAME', label: 'Sesame', emoji: '🌱' },
  { value: 'PULSES', label: 'Pulses', emoji: '🫘' },
  { value: 'OIL_SEEDS', label: 'Oil Seeds', emoji: '🌻' },
  { value: 'LEATHER', label: 'Leather', emoji: '👜' },
  { value: 'FLOWERS', label: 'Flowers', emoji: '🌸' },
  { value: 'OTHER', label: 'Other', emoji: '📦' },
]

const CERTIFICATIONS = [
  'Organic','FairTrade','UTZ','RainforestAlliance','USDA Organic','EU Organic',
  'ISO 22000','HACCP','GlobalGAP','Demeter','4C'
]

const INCOTERMS = ['FOB','CIF','CFR','EXW','DDP','FCA','CPT']

export default function CreateExportListing() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    title: '',
    titleAm: '',
    description: '',
    category: '',
    origin: '',
    grade: '',
    moqQty: '',
    moqUnit: 'kg',
    pricePerUnit: '',
    currency: 'USD',
    processingMethod: '',
    harvestSeason: '',
    availableQty: '',
    leadTimeDays: '14',
    incoterms: 'FOB',
    sampleAvailable: false,
    samplePrice: '',
    images: [''],
    videoUrl: '',
    certifications: [] as string[],
  })

  const [priceTiers, setPriceTiers] = useState<{ minQty: string; price: string }[]>([])

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/export/listings', data),
    onSuccess: (res) => {
      toast.success('Listing created successfully!')
      navigate(`/export/listings/${res.data.data.id}`)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create listing'),
  })

  const toggleCert = (cert: string) => {
    setForm(f => ({
      ...f,
      certifications: f.certifications.includes(cert)
        ? f.certifications.filter(c => c !== cert)
        : [...f.certifications, cert]
    }))
  }

  const addTier = () => setPriceTiers(t => [...t, { minQty: '', price: '' }])
  const removeTier = (i: number) => setPriceTiers(t => t.filter((_, idx) => idx !== i))
  const updateTier = (i: number, key: 'minQty' | 'price', val: string) => {
    setPriceTiers(t => t.map((tier, idx) => idx === i ? { ...tier, [key]: val } : tier))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.category || !form.pricePerUnit || !form.moqQty) {
      toast.error('Title, category, price and MOQ are required')
      return
    }
    mutation.mutate({
      ...form,
      moqQty: parseFloat(form.moqQty),
      pricePerUnit: parseFloat(form.pricePerUnit),
      availableQty: form.availableQty ? parseFloat(form.availableQty) : undefined,
      leadTimeDays: parseInt(form.leadTimeDays),
      samplePrice: form.samplePrice ? parseFloat(form.samplePrice) : undefined,
      images: form.images.filter(Boolean),
      priceTiers: priceTiers
        .filter(t => t.minQty && t.price)
        .map(t => ({ minQty: parseFloat(t.minQty), price: parseFloat(t.price) })),
    })
  }

  if (!user || (user.role !== 'ADMIN' && user.role !== 'SELLER')) {
    return (
      <div className="text-center py-32">
        <p className="text-gray-500 mb-4">Seller account required</p>
        <Link to="/login" className="bg-green-primary text-white px-6 py-2 rounded-xl font-bold">Login</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link to="/export/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-green-primary mb-6">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        <div className="bg-white rounded-3xl shadow-card overflow-hidden">
          <div className="bg-gradient-to-r from-green-dark to-green-primary p-8 text-white">
            <h1 className="text-2xl font-extrabold mb-1">Create Export Listing</h1>
            <p className="text-white/70 text-sm">List your product for international buyers</p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Basic info */}
            <div>
              <h3 className="font-bold text-gray-800 mb-4">Product Information</h3>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Title (English) *</label>
                    <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary"
                      placeholder="e.g. Ethiopian Yirgacheffe Coffee Grade 1" required />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Title (Amharic)</label>
                    <input value={form.titleAm} onChange={e => setForm(f => ({ ...f, titleAm: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary"
                      placeholder="የምርት ስም" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 mb-2 block">Category *</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <button key={cat.value} type="button" onClick={() => setForm(f => ({ ...f, category: cat.value }))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                          form.category === cat.value
                            ? 'bg-green-primary text-white border-green-primary'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-green-primary'
                        }`}>
                        {cat.emoji} {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Description</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary resize-none"
                    placeholder="Describe your product quality, processing, packaging, certifications..." />
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Origin / Region</label>
                    <input value={form.origin} onChange={e => setForm(f => ({ ...f, origin: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary"
                      placeholder="e.g. Yirgacheffe, SNNPR" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Grade</label>
                    <input value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary"
                      placeholder="e.g. Grade 1, A, Premium" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Processing Method</label>
                    <input value={form.processingMethod} onChange={e => setForm(f => ({ ...f, processingMethod: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary"
                      placeholder="e.g. Washed, Natural" />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Harvest Season</label>
                    <input value={form.harvestSeason} onChange={e => setForm(f => ({ ...f, harvestSeason: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary"
                      placeholder="e.g. Oct–Jan" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 mb-1 block">Available Quantity</label>
                    <input type="number" value={form.availableQty} onChange={e => setForm(f => ({ ...f, availableQty: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary"
                      placeholder="Total available (kg/ton)" />
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Pricing */}
            <div>
              <h3 className="font-bold text-gray-800 mb-4">Pricing & MOQ</h3>
              <div className="grid sm:grid-cols-4 gap-4 mb-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Price per Unit (USD) *</label>
                  <input type="number" step="0.01" value={form.pricePerUnit} onChange={e => setForm(f => ({ ...f, pricePerUnit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary"
                    placeholder="e.g. 4.50" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">MOQ *</label>
                  <input type="number" value={form.moqQty} onChange={e => setForm(f => ({ ...f, moqQty: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary"
                    placeholder="e.g. 500" required />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Unit</label>
                  <select value={form.moqUnit} onChange={e => setForm(f => ({ ...f, moqUnit: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary">
                    {['kg','ton','MT','lb','bag','container'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Lead Time (days)</label>
                  <input type="number" value={form.leadTimeDays} onChange={e => setForm(f => ({ ...f, leadTimeDays: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" />
                </div>
              </div>

              {/* Volume tiers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-gray-600">Volume Pricing Tiers</label>
                  <button type="button" onClick={addTier}
                    className="flex items-center gap-1 text-xs text-green-primary font-bold hover:underline">
                    <Plus size={12} /> Add Tier
                  </button>
                </div>
                {priceTiers.map((tier, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input type="number" value={tier.minQty} onChange={e => updateTier(i, 'minQty', e.target.value)}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary"
                      placeholder={`Min qty (${form.moqUnit})`} />
                    <input type="number" step="0.01" value={tier.price} onChange={e => updateTier(i, 'price', e.target.value)}
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary"
                      placeholder="Price/unit (USD)" />
                    <button type="button" onClick={() => removeTier(i)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Incoterms</label>
                  <select value={form.incoterms} onChange={e => setForm(f => ({ ...f, incoterms: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary">
                    {INCOTERMS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Sample Available</label>
                  <div className="flex items-center gap-3 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.sampleAvailable} onChange={e => setForm(f => ({ ...f, sampleAvailable: e.target.checked }))}
                        className="w-4 h-4 accent-green-600" />
                      <span className="text-sm text-gray-700">Yes, samples available</span>
                    </label>
                    {form.sampleAvailable && (
                      <input type="number" step="0.01" value={form.samplePrice} onChange={e => setForm(f => ({ ...f, samplePrice: e.target.value }))}
                        className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary"
                        placeholder="Sample price (USD)" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Certifications */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Certifications</h3>
              <div className="flex flex-wrap gap-2">
                {CERTIFICATIONS.map(cert => (
                  <button key={cert} type="button" onClick={() => toggleCert(cert)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                      form.certifications.includes(cert)
                        ? 'bg-green-primary text-white border-green-primary'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-green-primary'
                    }`}>
                    {cert}
                  </button>
                ))}
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Images */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Product Images</h3>
              <p className="text-xs text-gray-400 mb-3">Paste image URLs (from Cloudinary, Imgur, etc.)</p>
              {form.images.map((img, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input value={img} onChange={e => {
                    const imgs = [...form.images]
                    imgs[i] = e.target.value
                    setForm(f => ({ ...f, images: imgs }))
                  }}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary"
                    placeholder="https://..." />
                  {i > 0 && (
                    <button type="button" onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }))}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setForm(f => ({ ...f, images: [...f.images, ''] }))}
                className="flex items-center gap-1 text-xs text-green-primary font-bold hover:underline mt-1">
                <Plus size={12} /> Add Image URL
              </button>
            </div>

            <button type="submit" disabled={mutation.isPending}
              className="w-full bg-green-primary hover:bg-green-dark text-white font-extrabold py-4 rounded-2xl transition-colors disabled:opacity-60">
              {mutation.isPending ? 'Creating...' : '🚀 Create Export Listing'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
