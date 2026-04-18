/**
 * ExportListingDetail — /export/listings/:id
 * Full listing page with RFQ form inline
 */
import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, Globe, Package, Clock, Ship, MessageSquare, ChevronDown, ChevronUp, Star } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

const CERT_BADGES: Record<string, { label: string; color: string }> = {
  'Organic':           { label: '🌿 Organic',     color: 'bg-green-100 text-green-700' },
  'FairTrade':         { label: '🤝 Fair Trade',   color: 'bg-blue-100 text-blue-700' },
  'UTZ':               { label: '✅ UTZ',           color: 'bg-teal-100 text-teal-700' },
  'RainforestAlliance':{ label: '🐸 Rainforest',   color: 'bg-emerald-100 text-emerald-700' },
  'USDA Organic':      { label: '🇺🇸 USDA',        color: 'bg-red-100 text-red-700' },
  'EU Organic':        { label: '🇪🇺 EU Organic',  color: 'bg-indigo-100 text-indigo-700' },
}

const COUNTRIES = [
  'United States','United Kingdom','Germany','France','Netherlands','Italy','Spain',
  'China','Japan','South Korea','UAE','Saudi Arabia','India','Canada','Australia',
  'Belgium','Switzerland','Sweden','Norway','Denmark','Singapore','Malaysia','Other'
]

const PAYMENT_TERMS = ['TT','LC','DP','DA','CAD','Open Account','Escrow']
const INCOTERMS = ['FOB','CIF','CFR','EXW','DDP','FCA','CPT']

export default function ExportListingDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [imgIdx, setImgIdx] = useState(0)
  const [rfqOpen, setRfqOpen] = useState(false)
  const [tiersOpen, setTiersOpen] = useState(false)

  const [form, setForm] = useState({
    buyerName: user?.name || '',
    buyerEmail: user?.email || '',
    buyerCountry: '',
    buyerCompany: '',
    message: '',
    quantity: '',
    unit: 'kg',
    targetPrice: '',
    deliveryPort: '',
    paymentTerms: 'TT',
  })

  const { data: listing, isLoading } = useQuery({
    queryKey: ['export-listing', id],
    queryFn: () => api.get(`/export/listings/${id}`).then(r => r.data.data),
    enabled: !!id,
  })

  const rfqMutation = useMutation({
    mutationFn: (data: any) => api.post('/export/rfq', data),
    onSuccess: (res) => {
      toast.success('Inquiry sent! The seller will respond within 24 hours.')
      navigate(`/export/negotiation/${res.data.data.rfqId}`)
    },
    onError: () => toast.error('Failed to send inquiry. Please try again.'),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.buyerName || !form.buyerEmail || !form.buyerCountry || !form.message || !form.quantity) {
      toast.error('Please fill all required fields')
      return
    }
    rfqMutation.mutate({
      listingId: id,
      sellerId: listing?.sellerId,
      ...form,
      quantity: parseFloat(form.quantity),
      targetPrice: form.targetPrice ? parseFloat(form.targetPrice) : undefined,
    })
  }

  if (isLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>
  if (!listing) return <div className="text-center py-32 text-gray-400">Listing not found</div>

  const certs: string[] = listing.certifications || []
  const tiers: any[] = listing.priceTiers || []
  const images: string[] = listing.images || []
  const isVerified = listing.verificationStatus === 'VERIFIED'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to="/export" className="hover:text-green-primary flex items-center gap-1">
            <ArrowLeft size={14} /> Export Marketplace
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">{listing.title}</span>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left: Images + Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Images */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-card">
              <div className="aspect-video bg-gradient-to-br from-green-100 to-teal-100 relative">
                {images[imgIdx] ? (
                  <img src={images[imgIdx]} alt={listing.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-8xl">
                    {listing.category === 'COFFEE' ? '☕' : listing.category === 'HONEY' ? '🍯' : listing.category === 'TEFF' ? '🌾' : '📦'}
                  </div>
                )}
                {isVerified && (
                  <div className="absolute top-4 left-4 bg-green-500 text-white text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle size={12} /> Verified Exporter
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {images.map((img, i) => (
                    <button key={i} onClick={() => setImgIdx(i)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${i === imgIdx ? 'border-green-primary' : 'border-transparent'}`}>
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title + Info */}
            <div className="bg-white rounded-2xl p-6 shadow-card">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className="text-xs font-bold text-green-primary bg-green-50 px-2 py-0.5 rounded-full mb-2 inline-block">{listing.category}</span>
                  <h1 className="text-2xl font-extrabold text-gray-900">{listing.title}</h1>
                  {listing.titleAm && <p className="text-gray-500 text-sm mt-0.5">{listing.titleAm}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-3xl font-black text-green-primary">${listing.pricePerUnit}</p>
                  <p className="text-xs text-gray-400">per {listing.moqUnit}</p>
                </div>
              </div>

              {listing.origin && (
                <p className="text-sm text-gray-500 mb-3 flex items-center gap-1.5">
                  <Globe size={14} className="text-green-primary" />
                  Origin: <span className="font-semibold text-gray-700">{listing.origin}</span>
                  {listing.grade && <span className="ml-2 bg-amber-50 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">Grade: {listing.grade}</span>}
                </p>
              )}

              {/* Key specs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {[
                  { icon: <Package size={16} />, label: 'MOQ', value: `${listing.moqQty} ${listing.moqUnit}` },
                  { icon: <Clock size={16} />, label: 'Lead Time', value: `${listing.leadTimeDays} days` },
                  { icon: <Ship size={16} />, label: 'Incoterms', value: listing.incoterms },
                  { icon: <Globe size={16} />, label: 'Available', value: listing.availableQty ? `${listing.availableQty} ${listing.moqUnit}` : 'On request' },
                ].map(spec => (
                  <div key={spec.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className="flex justify-center text-green-primary mb-1">{spec.icon}</div>
                    <p className="text-[10px] text-gray-400 font-medium">{spec.label}</p>
                    <p className="text-sm font-bold text-gray-800">{spec.value}</p>
                  </div>
                ))}
              </div>

              {/* Volume pricing tiers */}
              {tiers.length > 0 && (
                <div className="mb-5">
                  <button onClick={() => setTiersOpen(o => !o)}
                    className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                    📊 Volume Pricing {tiersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {tiersOpen && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-green-50">
                            <th className="text-left p-2 text-xs font-bold text-green-primary">Min Qty</th>
                            <th className="text-left p-2 text-xs font-bold text-green-primary">Price/Unit</th>
                            <th className="text-left p-2 text-xs font-bold text-green-primary">Savings</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tiers.map((tier: any, i: number) => (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="p-2 font-semibold">{tier.minQty}+ {listing.moqUnit}</td>
                              <td className="p-2 font-bold text-green-primary">${tier.price}</td>
                              <td className="p-2 text-xs text-green-600">
                                {listing.pricePerUnit > tier.price
                                  ? `-${(((listing.pricePerUnit - tier.price) / listing.pricePerUnit) * 100).toFixed(0)}%`
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Certifications */}
              {certs.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-5">
                  {certs.map(cert => {
                    const cfg = CERT_BADGES[cert] || { label: cert, color: 'bg-gray-100 text-gray-600' }
                    return <span key={cert} className={`text-xs font-bold px-3 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                  })}
                </div>
              )}

              {/* Description */}
              {listing.description && (
                <div>
                  <h3 className="font-bold text-gray-800 mb-2">Product Description</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{listing.description}</p>
                </div>
              )}

              {listing.processingMethod && (
                <p className="text-sm text-gray-500 mt-3">Processing: <span className="font-semibold text-gray-700">{listing.processingMethod}</span></p>
              )}
              {listing.harvestSeason && (
                <p className="text-sm text-gray-500">Harvest Season: <span className="font-semibold text-gray-700">{listing.harvestSeason}</span></p>
              )}
            </div>

            {/* Seller info */}
            <div className="bg-white rounded-2xl p-6 shadow-card">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Star size={16} className="text-amber-400" /> About the Exporter
              </h3>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-green-100 flex items-center justify-center text-2xl font-black text-green-primary">
                  {listing.sellerName?.[0]}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900">{listing.sellerName}</p>
                    {isVerified && <CheckCircle size={14} className="text-green-500" />}
                  </div>
                  <p className="text-sm text-gray-500">{listing.sellerCity || 'Ethiopia'}</p>
                  {listing.sellerRating && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs font-bold text-gray-700">{Number(listing.sellerRating).toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
              {listing.sellerDescription && (
                <p className="text-sm text-gray-500 mt-3 leading-relaxed">{listing.sellerDescription}</p>
              )}
              {listing.yearsExporting && (
                <p className="text-xs text-gray-400 mt-2">🏆 {listing.yearsExporting} years exporting · {listing.annualExportVolume || 'Volume on request'}</p>
              )}
            </div>
          </div>

          {/* Right: RFQ Form */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white rounded-2xl shadow-card overflow-hidden">
                <div className="bg-gradient-to-r from-green-dark to-green-primary p-5 text-white">
                  <h2 className="font-extrabold text-lg mb-1">Send Inquiry</h2>
                  <p className="text-white/70 text-sm">Get a quote within 24 hours</p>
                </div>

                {listing.sampleAvailable && (
                  <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 font-medium">
                    🧪 Sample available{listing.samplePrice ? ` — $${listing.samplePrice}` : ' — contact for price'}
                  </div>
                )}

                <button onClick={() => setRfqOpen(o => !o)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left font-bold text-gray-800 hover:bg-gray-50 transition-colors">
                  <span className="flex items-center gap-2"><MessageSquare size={16} className="text-green-primary" /> Fill Inquiry Form</span>
                  {rfqOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {rfqOpen && (
                  <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3">
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">Your Name *</label>
                      <input value={form.buyerName} onChange={e => setForm(f => ({ ...f, buyerName: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" placeholder="Full name" required />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">Email *</label>
                      <input type="email" value={form.buyerEmail} onChange={e => setForm(f => ({ ...f, buyerEmail: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" placeholder="your@email.com" required />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">Country *</label>
                      <select value={form.buyerCountry} onChange={e => setForm(f => ({ ...f, buyerCountry: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" required>
                        <option value="">Select country</option>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">Company</label>
                      <input value={form.buyerCompany} onChange={e => setForm(f => ({ ...f, buyerCompany: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" placeholder="Company name (optional)" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">Quantity *</label>
                        <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" placeholder={`Min ${listing.moqQty}`} required />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">Unit</label>
                        <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary">
                          {['kg','ton','MT','lb','bag','container'].map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">Target Price (USD/{form.unit})</label>
                      <input type="number" step="0.01" value={form.targetPrice} onChange={e => setForm(f => ({ ...f, targetPrice: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" placeholder="Your target price" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">Delivery Port</label>
                      <input value={form.deliveryPort} onChange={e => setForm(f => ({ ...f, deliveryPort: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" placeholder="e.g. Rotterdam, Hamburg" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">Payment Terms</label>
                      <select value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary">
                        {PAYMENT_TERMS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-600 mb-1 block">Message *</label>
                      <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                        rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary resize-none"
                        placeholder="Describe your requirements, certifications needed, packaging preferences..." required />
                    </div>
                    <button type="submit" disabled={rfqMutation.isPending}
                      className="w-full bg-green-primary hover:bg-green-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60">
                      {rfqMutation.isPending ? 'Sending...' : '📨 Send Inquiry'}
                    </button>
                    <p className="text-[10px] text-gray-400 text-center">Your inquiry is sent directly to the exporter. No spam.</p>
                  </form>
                )}

                {!rfqOpen && (
                  <div className="px-5 pb-5 space-y-2">
                    <button onClick={() => setRfqOpen(true)}
                      className="w-full bg-green-primary hover:bg-green-dark text-white font-bold py-3 rounded-xl transition-colors">
                      📨 Send Inquiry
                    </button>
                    <Link to="/export/rfq"
                      className="block w-full text-center border-2 border-green-primary text-green-primary font-bold py-2.5 rounded-xl hover:bg-green-50 transition-colors text-sm">
                      Post a Buying Request
                    </Link>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="mt-4 bg-white rounded-2xl p-4 shadow-card">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-black text-gray-800">{listing.views || 0}</p>
                    <p className="text-[10px] text-gray-400">Views</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-green-primary">{listing.inquiries || 0}</p>
                    <p className="text-[10px] text-gray-400">Inquiries</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-amber-500">{listing.deals || 0}</p>
                    <p className="text-[10px] text-gray-400">Deals</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
