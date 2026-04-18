/**
 * VisualSearch — camera/upload icon that opens a modal,
 * lets user take a photo or upload an image, sends it to
 * POST /ai/analyze-image, and shows matching products.
 */

import { useState, useRef } from 'react'
import { Camera, Upload, X, Search, Loader2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Props {
  className?: string
  onClose?: () => void  // when used as a controlled modal from Header
}

export default function VisualSearch({ className = '', onClose }: Props) {
  // If onClose is provided, the parent controls open state — start open
  const [open, setOpen]           = useState(!!onClose)
  const [preview, setPreview]     = useState<string | null>(null)
  const [dragOver, setDragOver]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const { mutate: search, isPending, data, reset } = useMutation({
    mutationFn: async (base64: string) => {
      const res = await api.post('/ai/analyze-image', { imageBase64: base64 })
      return res.data.data
    },
    onError: () => toast.error('Visual search failed. Try again.'),
  })

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image'); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string
      setPreview(dataUrl)
      const base64 = dataUrl.split(',')[1]
      search(base64)
    }
    reader.readAsDataURL(file)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const close = () => {
    setOpen(false)
    setPreview(null)
    reset()
    onClose?.()
  }

  const identified = data?.identified
  const products   = data?.products || []

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center justify-center text-gray-400 hover:text-green-primary transition-colors ${className}`}
        title="Search by image"
      >
        <Camera size={20} />
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Camera size={20} className="text-green-primary" />
                <h2 className="font-extrabold text-gray-900">Visual Search</h2>
              </div>
              <button onClick={close} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Upload area */}
              {!preview ? (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                    dragOver ? 'border-green-primary bg-green-50' : 'border-gray-200 hover:border-green-primary'
                  }`}
                >
                  <Camera size={40} className="mx-auto text-gray-300 mb-3" />
                  <p className="font-semibold text-gray-700 mb-1">Take a photo or upload an image</p>
                  <p className="text-xs text-gray-400 mb-4">We'll identify the product and find matches</p>
                  <div className="flex gap-3 justify-center">
                    {/* Camera capture (mobile) */}
                    <button
                      onClick={() => cameraRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-primary text-white rounded-xl text-sm font-bold hover:bg-green-dark transition-colors"
                    >
                      <Camera size={15} /> Take Photo
                    </button>
                    {/* File upload */}
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:border-green-primary transition-colors"
                    >
                      <Upload size={15} /> Upload
                    </button>
                  </div>
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
                  <input ref={fileRef}   type="file" accept="image/*" className="hidden" onChange={handleFile} />
                  <p className="text-xs text-gray-300 mt-3">or drag & drop an image here</p>
                </div>
              ) : (
                <div className="relative">
                  <img src={preview} alt="Search" className="w-full rounded-2xl object-cover max-h-48" />
                  <button
                    onClick={() => { setPreview(null); reset() }}
                    className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow flex items-center justify-center text-gray-500 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Loading */}
              {isPending && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 size={28} className="text-green-primary animate-spin" />
                  <p className="text-sm text-gray-500">Identifying product…</p>
                </div>
              )}

              {/* Identified product */}
              {identified && !isPending && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                  <p className="text-xs font-bold text-green-700 mb-1 flex items-center gap-1">
                    <Search size={11} /> Identified
                  </p>
                  <p className="font-extrabold text-gray-900">{identified.name}</p>
                  {identified.nameAm && <p className="text-sm text-gray-500">{identified.nameAm}</p>}
                  {identified.category && (
                    <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full mt-1 inline-block capitalize">
                      {identified.category}
                    </span>
                  )}
                  {identified.confidence && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ml-1 ${
                      identified.confidence === 'high'   ? 'bg-green-100 text-green-700' :
                      identified.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                                           'bg-gray-100 text-gray-500'
                    }`}>
                      {identified.confidence} confidence
                    </span>
                  )}
                </div>
              )}

              {/* Matching products */}
              {products.length > 0 && !isPending && (
                <div>
                  <p className="text-sm font-bold text-gray-700 mb-3">
                    {products.length} matching product{products.length !== 1 ? 's' : ''} found
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {products.map((p: any) => (
                      <Link
                        key={p.id}
                        to={`/products/${p.slug}`}
                        onClick={close}
                        className="bg-gray-50 rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="aspect-square bg-gray-100 overflow-hidden">
                          {p.images?.[0]
                            ? <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-3xl">🛒</div>
                          }
                        </div>
                        <div className="p-2.5">
                          <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug">{p.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{p.seller?.storeName}</p>
                          <p className="text-sm font-extrabold text-green-primary mt-1">{formatPrice(p.price)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                  {/* Search all */}
                  {data?.searchQuery && (
                    <Link
                      to={`/products?search=${encodeURIComponent(data.searchQuery)}`}
                      onClick={close}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-green-200 rounded-xl text-sm font-semibold text-green-primary hover:bg-green-50 transition-colors"
                    >
                      <Search size={14} /> See all results for "{data.searchQuery}"
                    </Link>
                  )}
                </div>
              )}

              {/* No results */}
              {data && products.length === 0 && !isPending && (
                <div className="text-center py-6 text-gray-400">
                  <p className="text-sm">No matching products found.</p>
                  {data.searchQuery && (
                    <Link
                      to={`/products?search=${encodeURIComponent(data.searchQuery)}`}
                      onClick={close}
                      className="text-green-primary text-sm font-semibold hover:underline mt-2 inline-block"
                    >
                      Search for "{data.searchQuery}" →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
