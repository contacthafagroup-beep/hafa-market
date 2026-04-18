import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Eye, EyeOff, Package, Upload, Store, Moon, Wand2 } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import toast from 'react-hot-toast'
import { formatPrice } from '@/lib/utils'

interface ProductForm {
  name: string; nameAm: string; description: string
  price: string; comparePrice: string; unit: string
  minOrder: string; stock: string; categoryId: string
  isOrganic: boolean; images: string[]
  videoUrl: string; harvestDate: string
  qualityGrade: string; moistureLevel: string
}

const EMPTY_FORM: ProductForm = {
  name: '', nameAm: '', description: '', price: '', comparePrice: '',
  unit: 'kg', minOrder: '1', stock: '0', categoryId: '', isOrganic: false, images: [],
  videoUrl: '', harvestDate: '', qualityGrade: '', moistureLevel: '',
}

export default function SellerProducts() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm]         = useState<ProductForm>(EMPTY_FORM)
  const [imageUrl, setImageUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [priceSuggestion, setPriceSuggestion] = useState<number | null>(null)
  const [loadingSuggestion, setLoadingSuggestion] = useState(false)
  const [vacationMode, setVacationMode] = useState(false)
  const [aiWriting, setAiWriting] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['seller-products-manage'],
    queryFn: () => api.get('/sellers/me/products?limit=50').then(r => r.data.data),
    retry: false,
  })

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then(r => r.data.data),
    staleTime: 1000 * 60 * 10,
  })

  // No store yet — redirect to dashboard to complete onboarding
  if ((error as any)?.response?.status === 404) {
    return (
      <div className="text-center py-16">
        <Store size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="font-bold text-gray-700 mb-2">Set up your store first</h3>
        <p className="text-gray-400 text-sm mb-4">Complete your seller profile before listing products.</p>
        <a href="/dashboard" className="bg-green-primary text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-green-dark transition-colors inline-block">
          Go to Dashboard →
        </a>
      </div>
    )
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () => editId
      ? api.patch(`/sellers/me/products/${editId}`, form)
      : api.post('/sellers/me/products', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller-products-manage'] })
      toast.success(editId ? 'Product updated!' : 'Product submitted for review!')
      setShowForm(false); setEditId(null); setForm(EMPTY_FORM)
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to save product'),
  })

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => api.delete(`/sellers/me/products/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['seller-products-manage'] }); toast.success('Product removed') },
  })

  const set = (k: keyof ProductForm, v: any) => setForm(f => ({ ...f, [k]: v }))

  const addImage = () => {
    if (!imageUrl.trim()) return
    set('images', [...form.images, imageUrl.trim()])
    setImageUrl('')
  }

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      set('images', [...form.images, res.data.data.url])
      toast.success('Image uploaded!')
    } catch { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  const startEdit = (p: any) => {
    setEditId(p.id)
    setForm({
      name: p.name || '', nameAm: p.nameAm || '', description: p.description || '',
      price: String(p.price), comparePrice: p.comparePrice ? String(p.comparePrice) : '',
      unit: p.unit || 'kg', minOrder: String(p.minOrder || 1), stock: String(p.stock || 0),
      categoryId: p.category?.id || p.categoryId || '', isOrganic: p.isOrganic || false,
      images: p.images || [],
      videoUrl: p.videoUrl || '', harvestDate: p.harvestDate ? p.harvestDate.split('T')[0] : '',
      qualityGrade: p.qualityGrade || '', moistureLevel: p.moistureLevel || '',
    })
    setShowForm(true)
    setPriceSuggestion(null)
  }

  const fetchPriceSuggestion = async () => {
    if (!editId) {
      toast.error('Save the product first to get a price suggestion')
      return
    }
    setLoadingSuggestion(true)
    try {
      const res = await api.get(`/features/pricing-suggestion/${editId}`)
      setPriceSuggestion(res.data.data?.suggestedPrice || null)
    } catch { setPriceSuggestion(null) }
    finally { setLoadingSuggestion(false) }
  }

  const uploadVideo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingVideo(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await api.post('/upload/video', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      set('videoUrl', res.data.data.url)
      toast.success('Video uploaded!')
    } catch { toast.error('Video upload failed') }
    finally { setUploadingVideo(false) }
  }

  const generateDescription = async () => {
    if (!form.name) { toast.error('Enter product name first'); return }
    setAiWriting(true)
    try {
      const res = await api.post('/ai/chat', {
        message: `Write a compelling 2-sentence product description for an Ethiopian agricultural marketplace for: "${form.name}". Focus on freshness, quality, and local origin. Be concise and persuasive. Reply with ONLY the description.`,
        language: 'en', history: [],
      })
      const desc = res.data.data.reply?.trim()
      if (desc) { set('description', desc); toast.success('✨ AI description generated!') }
    } catch { toast.error('AI generation failed') }
    finally { setAiWriting(false) }
  }

  const toggleVacationMode = async () => {
    try {
      // Toggle all active products to INACTIVE or back
      const newMode = !vacationMode
      await api.patch('/sellers/me/store', { vacationMode: newMode })
      setVacationMode(newMode)
      toast.success(newMode ? '🌙 Vacation mode ON — listings paused' : '✅ Back online — listings active')
      qc.invalidateQueries({ queryKey: ['seller-products-manage'] })
    } catch { toast.error('Failed to toggle vacation mode') }
  }

  const statusColor = (s: string) => ({
    ACTIVE: 'bg-green-100 text-green-primary',
    PENDING_REVIEW: 'bg-yellow-100 text-yellow-700',
    INACTIVE: 'bg-gray-100 text-gray-500',
    OUT_OF_STOCK: 'bg-red-100 text-red-600',
  }[s] || 'bg-gray-100 text-gray-500')

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      {/* Low stock alerts */}
      {data?.filter((p: any) => p.stock > 0 && p.stock <= 5).length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
            ⚠️ Low Stock Alert
          </h3>
          <div className="space-y-1">
            {data.filter((p: any) => p.stock > 0 && p.stock <= 5).map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-amber-700">{p.name}</span>
                <span className="font-bold text-amber-800">Only {p.stock} {p.unit} left</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data?.filter((p: any) => p.stock === 0 || p.status === 'OUT_OF_STOCK').length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <h3 className="font-bold text-red-700 mb-2">🚫 Out of Stock</h3>
          <div className="space-y-1">
            {data.filter((p: any) => p.stock === 0 || p.status === 'OUT_OF_STOCK').map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-red-600">{p.name}</span>
                <button onClick={() => startEdit(p)} className="text-xs text-blue-600 font-bold hover:underline">Update stock</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vacation Mode Banner */}
      {vacationMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
          <Moon size={20} className="text-blue-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-blue-800 text-sm">🌙 Vacation Mode is ON</p>
            <p className="text-xs text-blue-600">Your listings are paused. Buyers can't order until you return.</p>
          </div>
          <Button size="sm" onClick={toggleVacationMode}>Return from Vacation</Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">My Products</h2>
          <p className="text-sm text-gray-400">{data?.length || 0} products listed</p>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleVacationMode}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${vacationMode ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'}`}>
            <Moon size={14} /> {vacationMode ? 'On Vacation' : 'Vacation Mode'}
          </button>
          <Button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM) }}>
            <Plus size={16} /> Add Product
          </Button>
        </div>
      </div>

      {/* Product Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <h3 className="font-extrabold text-gray-900 mb-5 text-lg">
            {editId ? '✏️ Edit Product' : '➕ New Product'}
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Product Name *" value={form.name} onChange={(e: any) => set('name', e.target.value)} placeholder="e.g. Fresh Tomatoes" />
            <Input label="Amharic Name (optional)" value={form.nameAm} onChange={(e: any) => set('nameAm', e.target.value)} placeholder="e.g. ቲማቲም" />
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Description</label>
              <textarea value={form.description} onChange={e => set('description', e.target.value)}
                rows={3} placeholder="Describe your product..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none" />
              <button type="button" onClick={generateDescription} disabled={aiWriting || !form.name}
                className="mt-1.5 flex items-center gap-1.5 text-xs text-purple-600 font-semibold hover:text-purple-800 transition-colors disabled:opacity-40">
                <Wand2 size={13} /> {aiWriting ? 'Writing...' : '✨ Generate with AI'}
              </button>
            </div>
            <Input label="Price ($) *" type="number" value={form.price} onChange={(e: any) => set('price', e.target.value)} placeholder="0.00" />
            <Input label="Compare Price ($)" type="number" value={form.comparePrice} onChange={(e: any) => set('comparePrice', e.target.value)} placeholder="Original price (optional)" />
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Unit *</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
                {['kg','g','piece','bunch','liter','bag','box','dozen'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Category *</label>
              <select value={form.categoryId} onChange={e => set('categoryId', e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
                <option value="">Select category</option>
                {(categories || []).map((c: any) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
              </select>
            </div>
            <Input label="Stock Quantity" type="number" value={form.stock} onChange={(e: any) => set('stock', e.target.value)} />
            <Input label="Min Order Quantity" type="number" value={form.minOrder} onChange={(e: any) => set('minOrder', e.target.value)} />
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isOrganic} onChange={e => set('isOrganic', e.target.checked)} className="w-4 h-4 accent-green-primary" />
                <span className="text-sm font-medium text-gray-700">🌿 This is an organic product</span>
              </label>
            </div>

            {/* Feature 17: Harvest Date */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">🌱 Harvest Date (optional)</label>
              <input type="date" value={form.harvestDate} onChange={e => set('harvestDate', e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary" />
              <p className="text-xs text-gray-400 mt-1">Shows "Harvested X days ago" to buyers</p>
            </div>

            {/* Quality Grade & Moisture — Agricultural specific */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">🏅 Quality Grade</label>
              <select value={form.qualityGrade} onChange={e => set('qualityGrade', e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
                <option value="">Not specified</option>
                <option value="GRADE_A">Grade A — Premium</option>
                <option value="GRADE_B">Grade B — Standard</option>
                <option value="GRADE_C">Grade C — Economy</option>
                <option value="EXPORT">Export Quality</option>
                <option value="ORGANIC_CERTIFIED">Organic Certified</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">💧 Moisture Level</label>
              <select value={form.moistureLevel} onChange={e => set('moistureLevel', e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
                <option value="">Not specified</option>
                <option value="VERY_DRY">Very Dry (&lt;10%)</option>
                <option value="DRY">Dry (10–14%)</option>
                <option value="OPTIMAL">Optimal (14–18%)</option>
                <option value="MOIST">Moist (18–22%)</option>
                <option value="WET">Wet (&gt;22%)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">Helps buyers assess freshness and storage needs</p>
            </div>

            {/* Feature 13: Dynamic Pricing Suggestion */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">💡 Price Suggestion</label>
              <button type="button" onClick={fetchPriceSuggestion} disabled={loadingSuggestion || !form.name}
                className="w-full border-2 border-dashed border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-600 font-semibold hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-50">
                {loadingSuggestion ? '⏳ Analyzing market...' : '🔍 Get Market Price Suggestion'}
              </button>
              {priceSuggestion && (
                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-blue-700">Suggested price based on market data</p>
                    <p className="text-lg font-extrabold text-blue-800">ETB {priceSuggestion.toFixed(2)}</p>
                  </div>
                  <button type="button" onClick={() => set('price', String(priceSuggestion))}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors">
                    Use This
                  </button>
                </div>
              )}
            </div>

            {/* Images */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">Product Images</label>
              <div className="flex gap-2 mb-3">
                <input value={imageUrl} onChange={e => setImageUrl(e.target.value)}
                  placeholder="Paste image URL..."
                  className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-green-primary" />
                <Button type="button" variant="outline" size="sm" onClick={addImage}>Add URL</Button>
              </div>
              <label className="flex items-center gap-2 cursor-pointer bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-3 hover:border-green-primary transition-colors">
                <Upload size={16} className="text-gray-400" />
                <span className="text-sm text-gray-500">{uploading ? 'Uploading...' : 'Upload image from device'}</span>
                <input type="file" accept="image/*" onChange={uploadImage} className="hidden" disabled={uploading} />
              </label>
              {form.images.length > 0 && (
                <div className="flex gap-2 mt-3 flex-wrap">
                  {form.images.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={img} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-200" />
                      <button onClick={() => set('images', form.images.filter((_, j) => j !== i))}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Feature 7: Product Video */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">🎥 Product Video (optional)</label>
              {form.videoUrl ? (
                <div className="relative">
                  <video src={form.videoUrl} controls className="w-full rounded-xl max-h-48 bg-black" />
                  <button onClick={() => set('videoUrl', '')}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">×</button>
                </div>
              ) : (
                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-3 hover:border-green-primary transition-colors">
                  <Upload size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-500">{uploadingVideo ? 'Uploading video...' : 'Upload product video (max 30s)'}</span>
                  <input type="file" accept="video/*" onChange={uploadVideo} className="hidden" disabled={uploadingVideo} />
                </label>
              )}
              <p className="text-xs text-gray-400 mt-1">Videos increase conversion by 3x. Show your product in action!</p>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button onClick={() => save()} loading={saving}>
              {editId ? 'Update Product' : 'Submit for Review'}
            </Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM) }}>Cancel</Button>
          </div>
          {!editId && <p className="text-xs text-gray-400 mt-2">New products are reviewed by our team before going live (usually within 24 hours).</p>}
        </div>
      )}

      {/* Products list */}
      {!data?.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="font-bold text-gray-700 mb-2">No products yet</h3>
          <p className="text-sm text-gray-400 mb-4">Start listing your products to reach thousands of buyers</p>
          <Button onClick={() => setShowForm(true)}><Plus size={16} /> Add Your First Product</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((p: any) => (
            <div key={p.id} className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
                {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" alt="" /> : '🛒'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-bold text-gray-800 text-sm truncate">{p.name}</p>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>
                    {p.status.replace(/_/g,' ')}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{p.category?.name} · Stock: {p.stock} {p.unit}</p>
                <p className="text-sm font-bold text-green-primary">{formatPrice(p.price)}/{p.unit}</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => startEdit(p)} className="p-2 text-gray-400 hover:text-blue-500 transition-colors" title="Edit">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => remove(p.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Remove">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
