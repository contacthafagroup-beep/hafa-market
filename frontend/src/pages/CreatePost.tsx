/**
 * CreatePost.tsx — /social/create
 * Seller creates a social commerce post: upload video/image, tag products, publish
 */
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Video, Image, Upload, X, Plus, CheckCircle, Tag } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'

export default function CreatePost() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const mediaRef = useRef<HTMLInputElement>(null)

  const [mediaUrl, setMediaUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO'>('IMAGE')
  const [caption, setCaption] = useState('')
  const [captionAm, setCaptionAm] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [step, setStep] = useState<'media' | 'products' | 'caption' | 'done'>('media')

  const { data: myProducts = [] } = useQuery({
    queryKey: ['seller-products-post'],
    queryFn: () => api.get('/sellers/me/products?limit=100&status=ACTIVE').then(r => r.data.data || []),
  })

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isVideo = file.type.startsWith('video/')
    setMediaType(isVideo ? 'VIDEO' : 'IMAGE')
    setUploading(true)

    try {
      const fd = new FormData()
      fd.append('file', file)
      const endpoint = isVideo ? '/upload/video' : '/upload/image'
      const res = await api.post(endpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      const url = res.data.data.url
      setMediaUrl(url)
      // For images, thumbnail = same URL. For video, use poster frame
      setThumbnailUrl(isVideo ? url.replace(/\.[^.]+$/, '.jpg') : url)
      toast.success(`${isVideo ? 'Video' : 'Image'} uploaded!`)
      setStep('products')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const toggleProduct = (product: any) => {
    const exists = selectedProducts.find(p => p.id === product.id)
    if (exists) {
      setSelectedProducts(prev => prev.filter(p => p.id !== product.id))
    } else if (selectedProducts.length < 5) {
      setSelectedProducts(prev => [...prev, product])
    } else {
      toast.error('Maximum 5 products per post')
    }
  }

  const { mutate: publish, isPending } = useMutation({
    mutationFn: () => api.post('/posts', {
      mediaUrl,
      thumbnailUrl,
      type: mediaType,
      caption: caption || undefined,
      captionAm: captionAm || undefined,
      products: selectedProducts.map((p, i) => ({
        productId: p.id,
        sortOrder: i,
        tagX: null,
        tagY: null,
      })),
    }),
    onSuccess: () => {
      setStep('done')
      toast.success('Post published! 🎉')
      setTimeout(() => navigate('/social'), 2000)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to publish'),
  })

  if (step === 'done') {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={40} className="text-green-primary" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Post Published! 🎉</h2>
        <p className="text-gray-500">Your post is now live in the feed</p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600">←</button>
        <h1 className="text-xl font-extrabold text-gray-900">Create Post</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {[
          { key: 'media', label: 'Media' },
          { key: 'products', label: 'Products' },
          { key: 'caption', label: 'Caption' },
        ].map((s, i) => {
          const steps = ['media', 'products', 'caption']
          const currentIdx = steps.indexOf(step)
          const stepIdx = steps.indexOf(s.key)
          const isDone = stepIdx < currentIdx
          const isCurrent = stepIdx === currentIdx
          return (
            <div key={s.key} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                isDone ? 'bg-green-primary text-white' :
                isCurrent ? 'bg-green-primary text-white ring-4 ring-green-100' :
                'bg-gray-100 text-gray-400'
              }`}>
                {isDone ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-semibold ${isCurrent ? 'text-green-primary' : 'text-gray-400'}`}>
                {s.label}
              </span>
              {i < 2 && <div className={`flex-1 h-0.5 ${isDone ? 'bg-green-primary' : 'bg-gray-100'}`} />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Upload media */}
      {step === 'media' && (
        <div className="space-y-4">
          <h2 className="font-extrabold text-gray-900 text-lg">Upload Photo or Video</h2>
          <p className="text-gray-500 text-sm">Show your products in action. Videos up to 60 seconds work best.</p>

          {!mediaUrl ? (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-3xl p-12 cursor-pointer hover:border-green-primary transition-colors">
              {uploading ? (
                <div className="text-center">
                  <Spinner size="lg" />
                  <p className="text-gray-500 mt-3">Uploading…</p>
                </div>
              ) : (
                <>
                  <div className="flex gap-4 mb-4">
                    <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center">
                      <Image size={24} className="text-green-primary" />
                    </div>
                    <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
                      <Video size={24} className="text-red-500" />
                    </div>
                  </div>
                  <p className="font-bold text-gray-700 mb-1">Tap to upload</p>
                  <p className="text-xs text-gray-400">Photo (JPG, PNG) or Video (MP4, max 60s)</p>
                </>
              )}
              <input ref={mediaRef} type="file" accept="image/*,video/*" className="hidden"
                onChange={handleMediaUpload} disabled={uploading} />
            </label>
          ) : (
            <div className="relative rounded-3xl overflow-hidden bg-gray-900 aspect-[4/5]">
              {mediaType === 'VIDEO'
                ? <video src={mediaUrl} controls className="w-full h-full object-cover" />
                : <img src={mediaUrl} className="w-full h-full object-cover" alt="" />
              }
              <button onClick={() => { setMediaUrl(''); setThumbnailUrl('') }}
                className="absolute top-3 right-3 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80">
                <X size={16} />
              </button>
            </div>
          )}

          {mediaUrl && (
            <Button fullWidth onClick={() => setStep('products')}>
              Continue → Tag Products
            </Button>
          )}
        </div>
      )}

      {/* Step 2: Tag products */}
      {step === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-gray-900 text-lg">Tag Products</h2>
            <span className="text-xs text-gray-400">{selectedProducts.length}/5 selected</span>
          </div>
          <p className="text-gray-500 text-sm">Select the products shown in your post. Buyers can buy directly from the post.</p>

          {/* Selected products */}
          {selectedProducts.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {selectedProducts.map(p => (
                <div key={p.id} className="flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full">
                  <Tag size={10} /> {p.name}
                  <button onClick={() => toggleProduct(p)} className="ml-1 hover:text-red-500">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Product list */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {myProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">No active products found.</p>
                <a href="/dashboard/products" className="text-green-primary font-bold hover:underline text-sm">
                  Add products first →
                </a>
              </div>
            ) : myProducts.map((p: any) => {
              const isSelected = selectedProducts.some(sp => sp.id === p.id)
              return (
                <button key={p.id} onClick={() => toggleProduct(p)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all text-left ${
                    isSelected ? 'border-green-primary bg-green-50' : 'border-gray-100 hover:border-gray-200'
                  }`}>
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                    {p.images?.[0]
                      ? <img src={p.images[0]} className="w-full h-full object-cover" alt="" />
                      : <span className="flex items-center justify-center h-full text-xl">🛒</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{p.name}</p>
                    <p className="text-green-primary text-sm font-bold">ETB {p.price}/{p.unit}</p>
                    <p className="text-gray-400 text-[10px]">Stock: {p.stock}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-green-primary border-green-primary' : 'border-gray-300'
                  }`}>
                    {isSelected && <CheckCircle size={14} className="text-white" />}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('media')}>← Back</Button>
            <Button fullWidth onClick={() => setStep('caption')} disabled={selectedProducts.length === 0}>
              Continue → Add Caption
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Caption */}
      {step === 'caption' && (
        <div className="space-y-4">
          <h2 className="font-extrabold text-gray-900 text-lg">Add Caption</h2>

          {/* Preview */}
          <div className="rounded-2xl overflow-hidden bg-gray-900 aspect-video">
            {mediaType === 'VIDEO'
              ? <video src={mediaUrl} className="w-full h-full object-cover" muted />
              : <img src={mediaUrl} className="w-full h-full object-cover" alt="" />
            }
          </div>

          {/* Tagged products preview */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {selectedProducts.map(p => (
              <div key={p.id} className="flex-shrink-0 flex items-center gap-2 bg-gray-50 rounded-xl p-2 border border-gray-100">
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100">
                  {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" alt="" /> : <span className="flex items-center justify-center h-full text-sm">🛒</span>}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-800 truncate max-w-[80px]">{p.name}</p>
                  <p className="text-[10px] text-green-primary font-bold">ETB {p.price}</p>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Caption (English)</label>
            <textarea value={caption} onChange={e => setCaption(e.target.value)}
              rows={3} placeholder="Describe your products, quality, freshness…"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Caption (Amharic — optional)</label>
            <textarea value={captionAm} onChange={e => setCaptionAm(e.target.value)}
              rows={2} placeholder="ምርቱን ይግለጹ…"
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none" />
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('products')}>← Back</Button>
            <Button fullWidth loading={isPending} onClick={() => publish()}>
              🚀 Publish Post
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
