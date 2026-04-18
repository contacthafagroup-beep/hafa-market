/**
 * UGCPhotos.tsx — User-generated content photos on product pages
 * Buyers post photos of received products → builds trust → increases conversion
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Heart, Plus, X, Upload, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'
import Spinner from '@/components/ui/Spinner'

interface Props {
  productId: string
  productName: string
}

export default function UGCPhotos({ productId, productName }: Props) {
  const { isAuthenticated, user } = useAuth()
  const qc = useQueryClient()
  const [showUpload, setShowUpload] = useState(false)
  const [lightbox, setLightbox] = useState<any>(null)

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['ugc-photos', productId],
    queryFn: () => api.get(`/social/ugc/${productId}`).then(r => r.data.data || []),
    staleTime: 60000,
  })

  const { mutate: likePhoto } = useMutation({
    mutationFn: (photoId: string) => api.post(`/social/ugc/${photoId}/like`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ugc-photos', productId] }),
  })

  if (isLoading) return null
  if (!photos.length && !isAuthenticated) return null

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-extrabold text-gray-900 flex items-center gap-2">
          <Camera size={18} className="text-purple-500" />
          Customer Photos
          {photos.length > 0 && (
            <span className="text-sm font-normal text-gray-400">({photos.length})</span>
          )}
        </h3>
        {isAuthenticated && (
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 text-sm text-purple-600 font-bold hover:text-purple-700 transition-colors">
            <Plus size={14} /> Add Photo
          </button>
        )}
      </div>

      {photos.length === 0 ? (
        <div className="bg-purple-50 border-2 border-dashed border-purple-200 rounded-2xl p-6 text-center">
          <Camera size={32} className="mx-auto text-purple-300 mb-2" />
          <p className="text-sm text-gray-500 mb-1">No customer photos yet</p>
          <p className="text-xs text-gray-400">Be the first to share your purchase!</p>
          {isAuthenticated && (
            <button onClick={() => setShowUpload(true)}
              className="mt-3 text-xs text-purple-600 font-bold hover:underline">
              Upload a photo →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((photo: any) => (
            <div key={photo.id} className="relative group cursor-pointer"
              onClick={() => setLightbox(photo)}>
              <div className="aspect-square rounded-xl overflow-hidden bg-gray-100">
                <img src={photo.photoUrl} alt={`Customer photo`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
              </div>
              {/* Like count */}
              {photo.likes > 0 && (
                <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Heart size={8} className="fill-red-400 text-red-400" /> {photo.likes}
                </div>
              )}
              {/* Verified badge */}
              {photo.orderId && (
                <div className="absolute top-1.5 left-1.5 bg-green-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  ✓ Verified
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}>
          <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.photoUrl} alt="" className="w-full rounded-2xl" />
            <div className="bg-white rounded-2xl p-4 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
                  {lightbox.userName?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">{lightbox.userName}</p>
                  {lightbox.orderId && (
                    <p className="text-[10px] text-green-600 font-semibold flex items-center gap-0.5">
                      <CheckCircle size={9} /> Verified Purchase
                    </p>
                  )}
                </div>
                <button onClick={() => likePhoto(lightbox.id)}
                  className="ml-auto flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 transition-colors">
                  <Heart size={16} /> {lightbox.likes}
                </button>
              </div>
              {lightbox.caption && (
                <p className="text-sm text-gray-700 italic">"{lightbox.caption}"</p>
              )}
            </div>
            <button onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <UGCUploadModal
          productId={productId}
          productName={productName}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false)
            qc.invalidateQueries({ queryKey: ['ugc-photos', productId] })
          }}
        />
      )}
    </div>
  )
}

// ── Upload modal ──────────────────────────────────────────────────────────────
function UGCUploadModal({ productId, productName, onClose, onSuccess }: {
  productId: string; productName: string; onClose: () => void; onSuccess: () => void
}) {
  const [photoUrl, setPhotoUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setPhotoUrl(res.data.data.url)
    } catch { toast.error('Upload failed') }
    finally { setUploading(false) }
  }

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => api.post('/social/ugc', { productId, photoUrl, caption }),
    onSuccess: (res) => {
      setDone(true)
      toast.success(`Photo shared! +${res.data.data?.pointsEarned || 10} loyalty points 🎉`)
      setTimeout(onSuccess, 1500)
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to share'),
  })

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6">
        {done ? (
          <div className="text-center py-4">
            <CheckCircle size={48} className="mx-auto text-green-500 mb-3" />
            <h3 className="text-xl font-extrabold text-gray-900">Photo Shared! 🎉</h3>
            <p className="text-gray-500 text-sm mt-1">+10 loyalty points earned</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-extrabold text-gray-900 flex items-center gap-2">
                <Camera size={18} className="text-purple-500" /> Share Your Photo
              </h3>
              <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
            </div>

            {/* Reward info */}
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-4 flex items-center gap-2">
              <span className="text-xl">📸</span>
              <p className="text-xs text-purple-700">
                Share a photo of <strong>{productName}</strong> and earn <strong>+10 loyalty points</strong>!
              </p>
            </div>

            {/* Photo upload */}
            {!photoUrl ? (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-purple-200 rounded-2xl p-8 cursor-pointer hover:border-purple-400 transition-colors mb-4">
                {uploading ? (
                  <Spinner />
                ) : (
                  <>
                    <Upload size={32} className="text-purple-300 mb-2" />
                    <p className="text-sm font-semibold text-gray-600">Upload your photo</p>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG up to 10MB</p>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            ) : (
              <div className="relative mb-4">
                <img src={photoUrl} alt="" className="w-full rounded-2xl object-cover max-h-48" />
                <button onClick={() => setPhotoUrl('')}
                  className="absolute top-2 right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white">
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Caption */}
            <textarea value={caption} onChange={e => setCaption(e.target.value)}
              rows={2} placeholder="Write a caption (optional)… ጥሩ ምርት ነው!"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400 resize-none mb-4" />

            <button onClick={() => submit()} disabled={!photoUrl || isPending}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
              {isPending ? <Spinner /> : <><Camera size={16} /> Share Photo & Earn Points</>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Post-delivery UGC prompt (shown in OrderDetail after delivery) ─────────────
export function UGCPrompt({ orderId, productId, productName }: {
  orderId: string; productId: string; productName: string
}) {
  const [show, setShow] = useState(true)
  const qc = useQueryClient()

  if (!show) return null

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 flex items-center gap-3">
      <Camera size={20} className="text-purple-500 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold text-purple-800">Share your purchase!</p>
        <p className="text-xs text-purple-600">Post a photo of {productName} and earn +10 points</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <UGCUploadTrigger productId={productId} productName={productName} orderId={orderId}
          onSuccess={() => { setShow(false); qc.invalidateQueries({ queryKey: ['ugc-photos', productId] }) }} />
        <button onClick={() => setShow(false)} className="text-purple-400 hover:text-purple-600">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

function UGCUploadTrigger({ productId, productName, orderId, onSuccess }: any) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="text-xs bg-purple-600 text-white font-bold px-3 py-1.5 rounded-lg hover:bg-purple-700 transition-colors">
        Add Photo
      </button>
      {open && (
        <UGCUploadModal
          productId={productId}
          productName={productName}
          onClose={() => setOpen(false)}
          onSuccess={() => { setOpen(false); onSuccess?.() }}
        />
      )}
    </>
  )
}
