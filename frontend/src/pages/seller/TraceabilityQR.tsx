import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QrCode, Download, Eye, Leaf, MapPin, Calendar, Shield } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'

// Generate a QR code URL using a free QR API
function getQRUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}&bgcolor=ffffff&color=1b5e20&margin=10`
}

export default function TraceabilityQR() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['seller-products-qr'],
    queryFn: () => api.get('/sellers/me/products?limit=50').then(r => r.data.data),
  })

  const { data: storeData } = useQuery({
    queryKey: ['my-store'],
    queryFn: () => api.get('/sellers/me/store').then(r => r.data.data).catch(() => null),
  })

  const generateTraceData = (product: any) => {
    const traceUrl = `${window.location.origin}/products/${product.slug}?trace=1`
    return {
      url: traceUrl,
      data: {
        product: product.name,
        farmer: storeData?.storeName || 'Hafa Market Seller',
        location: storeData?.city || 'Hossana, Ethiopia',
        harvestDate: product.harvestDate || product.season || 'Not specified',
        organic: product.isOrganic,
        certifiedBy: 'Hafa Market',
        verifiedAt: new Date().toISOString(),
      }
    }
  }

  const downloadQR = (product: any) => {
    const { url } = generateTraceData(product)
    const qrUrl = getQRUrl(url)
    const a = document.createElement('a')
    a.href = qrUrl
    a.download = `qr-${product.slug}.png`
    a.target = '_blank'
    a.click()
  }

  const printLabel = (product: any) => {
    const { url, data } = generateTraceData(product)
    const qrUrl = getQRUrl(url)
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Traceability Label — ${product.name}</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 20px; }
          .label { width: 300px; border: 2px solid #2E7D32; border-radius: 12px; padding: 16px; margin: 0 auto; }
          .header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
          .logo { font-size: 1.1rem; font-weight: 900; color: #2E7D32; }
          .product { font-size: 1.2rem; font-weight: 900; color: #1f2937; margin-bottom: 8px; }
          .info { font-size: .75rem; color: #6b7280; margin: 3px 0; }
          .info strong { color: #1f2937; }
          .qr { text-align: center; margin: 12px 0; }
          .qr img { width: 120px; height: 120px; }
          .footer { font-size: .65rem; color: #9ca3af; text-align: center; margin-top: 8px; }
          .organic { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; padding: 2px 8px; border-radius: 50px; font-size: .7rem; font-weight: 700; display: inline-block; margin-bottom: 8px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="label">
          <div class="header">
            <span style="font-size:1.5rem">🌿</span>
            <div class="logo">Hafa Market</div>
          </div>
          <div class="product">${product.name}</div>
          ${product.isOrganic ? '<div class="organic">🌿 Certified Organic</div>' : ''}
          <div class="info">🌾 <strong>Farmer:</strong> ${data.farmer}</div>
          <div class="info">📍 <strong>Origin:</strong> ${data.location}</div>
          <div class="info">📅 <strong>Harvest:</strong> ${data.harvestDate !== 'Not specified' ? formatDate(data.harvestDate) : 'Not specified'}</div>
          <div class="info">✅ <strong>Verified by:</strong> ${data.certifiedBy}</div>
          <div class="qr">
            <img src="${qrUrl}" alt="QR Code" />
            <div style="font-size:.65rem;color:#9ca3af;margin-top:4px">Scan to verify origin</div>
          </div>
          <div class="footer">
            Farm-to-table traceability powered by Hafa Market<br/>
            hafamarket.com
          </div>
        </div>
        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>
    `)
    win.document.close()
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <QrCode size={20} className="text-green-primary" /> Traceability QR Codes
        </h2>
        <p className="text-sm text-gray-400">Generate farm-to-table QR codes for your products. Buyers scan to verify origin.</p>
      </div>

      {/* How it works */}
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
        <h3 className="font-bold text-gray-800 mb-3">🔍 How Traceability Works</h3>
        <div className="grid sm:grid-cols-4 gap-3 text-center text-sm">
          {[
            { icon: '🌾', step: '1', text: 'You set harvest date & location' },
            { icon: '📱', step: '2', text: 'QR code generated for your product' },
            { icon: '🏷️', step: '3', text: 'Print & attach to packaging' },
            { icon: '✅', step: '4', text: 'Buyer scans to verify origin' },
          ].map(s => (
            <div key={s.step} className="bg-white rounded-xl p-3">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-xs font-bold text-gray-500 mb-1">Step {s.step}</div>
              <div className="text-xs text-gray-600">{s.text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Products grid */}
      {!products.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center text-gray-400">
          <QrCode size={40} className="mx-auto mb-3 opacity-30" />
          <p>No products yet. Add products to generate QR codes.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product: any) => {
            const { url, data } = generateTraceData(product)
            const qrUrl = getQRUrl(url)
            const hasHarvestDate = !!(product.harvestDate || product.season)

            return (
              <div key={product.id} className="bg-white rounded-2xl shadow-card p-4">
                {/* Product info */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0">
                    {product.images?.[0]
                      ? <img src={product.images[0]} className="w-full h-full object-cover" alt="" />
                      : <span className="flex items-center justify-center h-full text-xl">🛒</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 truncate">{product.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {product.isOrganic && (
                        <span className="text-[10px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Leaf size={9} /> Organic
                        </span>
                      )}
                      {hasHarvestDate ? (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Calendar size={9} /> Date set
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded-full">
                          ⚠️ No date
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex justify-center mb-4">
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                    <img src={qrUrl} alt="QR Code" className="w-28 h-28" />
                  </div>
                </div>

                {/* Trace info */}
                <div className="space-y-1 mb-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5"><MapPin size={11} /> {data.location}</div>
                  {hasHarvestDate && <div className="flex items-center gap-1.5"><Calendar size={11} /> Harvested: {formatDate(data.harvestDate)}</div>}
                  <div className="flex items-center gap-1.5"><Shield size={11} /> Verified by Hafa Market</div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => printLabel(product)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-primary text-white rounded-xl text-xs font-bold hover:bg-green-dark transition-colors">
                    <Download size={13} /> Print Label
                  </button>
                  <button onClick={() => downloadQR(product)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-green-primary transition-colors">
                    <QrCode size={13} /> QR
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
