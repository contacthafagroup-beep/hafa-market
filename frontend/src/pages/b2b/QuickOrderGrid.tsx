import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Zap, Search, Plus, Minus, ShoppingCart, Trash2, Download } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { formatPrice } from '@/lib/utils'
import { useCart } from '@/hooks/useCart'
import toast from 'react-hot-toast'

interface GridRow { productId: string; name: string; price: number; unit: string; qty: number; image?: string }

export default function QuickOrderGrid() {
  const navigate = useNavigate()
  const { add } = useCart()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<GridRow[]>([])
  const [csvText, setCsvText] = useState('')
  const [showCSV, setShowCSV] = useState(false)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['quick-order-products', search],
    queryFn: () => api.get('/products', { params: { search: search || undefined, limit: 20, sort: 'soldCount' } })
      .then(r => r.data.data || []),
    staleTime: 30000,
  })

  const addToGrid = (product: any) => {
    if (rows.find(r => r.productId === product.id)) {
      toast.error('Already in grid')
      return
    }
    setRows(prev => [...prev, {
      productId: product.id,
      name: product.name,
      price: product.price,
      unit: product.unit,
      qty: product.minOrder || 1,
      image: product.images?.[0],
    }])
  }

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setRows(prev => prev.filter(r => r.productId !== productId))
      return
    }
    setRows(prev => prev.map(r => r.productId === productId ? { ...r, qty } : r))
  }

  const total = rows.reduce((sum, r) => sum + r.price * r.qty, 0)

  const addAllToCart = () => {
    if (!rows.length) { toast.error('Add products to the grid first'); return }
    rows.forEach(r => {
      add({ id: r.productId, name: r.name, price: r.price, unit: r.unit, images: r.image ? [r.image] : [] } as any, r.qty)
    })
    toast.success(`${rows.length} products added to cart!`)
    navigate('/checkout')
  }

  const parseCSV = () => {
    const lines = csvText.trim().split('\n').filter(Boolean)
    const newRows: GridRow[] = []
    lines.forEach(line => {
      const [name, qty] = line.split(',').map(s => s.trim())
      if (!name || !qty) return
      const product = products.find((p: any) =>
        p.name.toLowerCase().includes(name.toLowerCase())
      )
      if (product) {
        newRows.push({
          productId: product.id,
          name: product.name,
          price: product.price,
          unit: product.unit,
          qty: parseFloat(qty) || 1,
          image: product.images?.[0],
        })
      }
    })
    if (newRows.length) {
      setRows(prev => {
        const existing = new Set(prev.map(r => r.productId))
        return [...prev, ...newRows.filter(r => !existing.has(r.productId))]
      })
      toast.success(`Added ${newRows.length} products from CSV`)
      setShowCSV(false)
      setCsvText('')
    } else {
      toast.error('No matching products found. Check product names.')
    }
  }

  const downloadTemplate = () => {
    const csv = 'Product Name,Quantity\nTomatoes,50\nOnions,30\nTeff,100\nCoffee,20'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'quick-order-template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Zap size={22} className="text-orange-500" /> Quick Order Grid
          </h1>
          <p className="text-gray-400 text-sm mt-1">Add multiple products and quantities at once — perfect for bulk buyers</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCSV(!showCSV)}
            className="flex items-center gap-1.5 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-orange-400 transition-all">
            📋 Import CSV
          </button>
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:border-green-primary transition-all">
            <Download size={14} /> Template
          </button>
        </div>
      </div>

      {/* CSV Import */}
      {showCSV && (
        <div className="bg-white rounded-2xl shadow-card p-5 mb-6">
          <p className="text-sm font-bold text-gray-700 mb-2">Paste CSV (Product Name, Quantity)</p>
          <textarea value={csvText} onChange={e => setCsvText(e.target.value)}
            rows={5} placeholder="Tomatoes, 50&#10;Onions, 30&#10;Teff, 100"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-mono outline-none focus:border-green-primary resize-none mb-3" />
          <div className="flex gap-3">
            <Button size="sm" onClick={parseCSV} disabled={!csvText.trim()}>Import</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCSV(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Product search */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-card p-4 sticky top-24">
            <p className="text-sm font-bold text-gray-700 mb-3">Search & Add Products</p>
            <div className="relative mb-3">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-green-primary" />
            </div>
            {isLoading ? (
              <div className="flex justify-center py-6"><Spinner /></div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {products.map((p: any) => {
                  const inGrid = rows.some(r => r.productId === p.id)
                  return (
                    <button key={p.id} onClick={() => addToGrid(p)} disabled={inGrid}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${inGrid ? 'bg-green-50 opacity-60 cursor-default' : 'hover:bg-gray-50'}`}>
                      <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                        {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" alt="" /> : <span className="flex items-center justify-center h-full">🛒</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                        <p className="text-xs text-green-primary font-bold">{formatPrice(p.price)}/{p.unit}</p>
                      </div>
                      {inGrid ? <span className="text-[10px] text-green-600 font-bold">✓ Added</span> : <Plus size={14} className="text-gray-400 flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Order grid */}
        <div className="lg:col-span-2">
          {!rows.length ? (
            <div className="bg-white rounded-2xl shadow-card p-12 text-center text-gray-400">
              <ShoppingCart size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold mb-1">Your order grid is empty</p>
              <p className="text-sm">Search and add products from the left panel, or import a CSV file.</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl shadow-card overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left py-3 px-4 text-xs font-bold text-gray-400">Product</th>
                      <th className="text-center py-3 px-4 text-xs font-bold text-gray-400">Qty</th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-gray-400">Unit Price</th>
                      <th className="text-right py-3 px-4 text-xs font-bold text-gray-400">Total</th>
                      <th className="py-3 px-4 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.productId} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                              {row.image ? <img src={row.image} className="w-full h-full object-cover" alt="" /> : <span className="flex items-center justify-center h-full text-sm">🛒</span>}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-800 truncate max-w-[160px]">{row.name}</p>
                              <p className="text-xs text-gray-400">/{row.unit}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => updateQty(row.productId, row.qty - 1)}
                              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                              <Minus size={12} />
                            </button>
                            <input type="number" value={row.qty}
                              onChange={e => updateQty(row.productId, parseFloat(e.target.value) || 0)}
                              className="w-16 text-center border-2 border-gray-200 rounded-lg py-1 text-sm font-bold outline-none focus:border-green-primary" />
                            <button onClick={() => updateQty(row.productId, row.qty + 1)}
                              className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                              <Plus size={12} />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-600">{formatPrice(row.price)}</td>
                        <td className="py-3 px-4 text-right font-bold text-gray-900">{formatPrice(row.price * row.qty)}</td>
                        <td className="py-3 px-4">
                          <button onClick={() => updateQty(row.productId, 0)} className="text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td colSpan={3} className="py-4 px-4 text-right font-extrabold text-gray-900">Order Total</td>
                      <td className="py-4 px-4 text-right font-extrabold text-green-primary text-lg">{formatPrice(total)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="flex gap-3">
                <Button fullWidth size="lg" onClick={addAllToCart}>
                  <ShoppingCart size={18} /> Add All to Cart & Checkout
                </Button>
                <button onClick={() => setRows([])}
                  className="px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-bold text-gray-500 hover:border-red-300 hover:text-red-500 transition-all">
                  Clear
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
