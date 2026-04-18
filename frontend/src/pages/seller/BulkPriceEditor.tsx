import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, Save, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { formatPrice } from '@/lib/utils'
import toast from 'react-hot-toast'

export default function BulkPriceEditor() {
  const qc = useQueryClient()
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [bulkAdjust, setBulkAdjust] = useState('')
  const [adjustType, setAdjustType] = useState<'percent' | 'fixed'>('percent')
  const [adjustDir, setAdjustDir] = useState<'increase' | 'decrease'>('increase')
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('')

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['seller-products-bulk'],
    queryFn: () => api.get('/sellers/me/products?limit=100').then(r => r.data.data),
  })

  const filtered = products.filter((p: any) =>
    !filter || p.name.toLowerCase().includes(filter.toLowerCase())
  )

  const applyBulkAdjust = () => {
    const val = parseFloat(bulkAdjust)
    if (!val || val <= 0) { toast.error('Enter a valid adjustment value'); return }
    const newEdits: Record<string, string> = { ...edits }
    filtered.forEach((p: any) => {
      const current = parseFloat(edits[p.id] || String(p.price))
      let newPrice: number
      if (adjustType === 'percent') {
        newPrice = adjustDir === 'increase' ? current * (1 + val / 100) : current * (1 - val / 100)
      } else {
        newPrice = adjustDir === 'increase' ? current + val : current - val
      }
      newEdits[p.id] = Math.max(0.01, newPrice).toFixed(2)
    })
    setEdits(newEdits)
    toast.success(`Applied ${adjustDir === 'increase' ? '+' : '-'}${val}${adjustType === 'percent' ? '%' : ' ETB'} to ${filtered.length} products`)
  }

  const saveAll = async () => {
    const changed = Object.entries(edits).filter(([id, price]) => {
      const original = products.find((p: any) => p.id === id)?.price
      return original && parseFloat(price) !== original
    })
    if (!changed.length) { toast.error('No price changes to save'); return }
    setSaving(true)
    try {
      await Promise.all(changed.map(([id, price]) =>
        api.patch(`/sellers/me/products/${id}`, { price: parseFloat(price) })
      ))
      qc.invalidateQueries({ queryKey: ['seller-products-bulk'] })
      qc.invalidateQueries({ queryKey: ['seller-products-manage'] })
      setEdits({})
      toast.success(`✅ Updated ${changed.length} product prices!`)
    } catch { toast.error('Some updates failed') }
    finally { setSaving(false) }
  }

  const changedCount = Object.entries(edits).filter(([id, price]) => {
    const original = products.find((p: any) => p.id === id)?.price
    return original && parseFloat(price) !== original
  }).length

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
            <DollarSign size={20} className="text-green-primary" /> Bulk Price Editor
          </h2>
          <p className="text-sm text-gray-400">Update multiple product prices at once</p>
        </div>
        {changedCount > 0 && (
          <Button loading={saving} onClick={saveAll}>
            <Save size={15} /> Save {changedCount} Changes
          </Button>
        )}
      </div>

      {/* Bulk Adjust Tool */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-gray-900 mb-4">⚡ Quick Adjust All</h3>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-2">
            <button onClick={() => setAdjustDir('increase')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border-2 transition-all ${adjustDir === 'increase' ? 'bg-green-50 text-green-primary border-green-primary' : 'border-gray-200 text-gray-500'}`}>
              <TrendingUp size={14} /> Increase
            </button>
            <button onClick={() => setAdjustDir('decrease')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold border-2 transition-all ${adjustDir === 'decrease' ? 'bg-red-50 text-red-500 border-red-300' : 'border-gray-200 text-gray-500'}`}>
              <TrendingDown size={14} /> Decrease
            </button>
          </div>
          <input type="number" value={bulkAdjust} onChange={e => setBulkAdjust(e.target.value)}
            placeholder="Amount"
            className="w-28 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-green-primary" />
          <div className="flex gap-2">
            <button onClick={() => setAdjustType('percent')}
              className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition-all ${adjustType === 'percent' ? 'bg-blue-50 text-blue-600 border-blue-300' : 'border-gray-200 text-gray-500'}`}>
              %
            </button>
            <button onClick={() => setAdjustType('fixed')}
              className={`px-3 py-2 rounded-xl text-sm font-bold border-2 transition-all ${adjustType === 'fixed' ? 'bg-blue-50 text-blue-600 border-blue-300' : 'border-gray-200 text-gray-500'}`}>
              ETB
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={applyBulkAdjust} disabled={!bulkAdjust}>
            Apply to {filter ? `${filtered.length} filtered` : 'all'} products
          </Button>
          {Object.keys(edits).length > 0 && (
            <button onClick={() => setEdits({})} className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1">
              <RefreshCw size={12} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* Search filter */}
      <input value={filter} onChange={e => setFilter(e.target.value)}
        placeholder="Filter products by name..."
        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary" />

      {/* Products table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400">Product</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400">Current Price</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400">New Price</th>
                <th className="text-left py-3 px-4 text-xs font-bold text-gray-400">Change</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p: any) => {
                const currentPrice = p.price
                const newPrice = edits[p.id] !== undefined ? parseFloat(edits[p.id]) : currentPrice
                const diff = newPrice - currentPrice
                const pct = currentPrice > 0 ? ((diff / currentPrice) * 100).toFixed(1) : '0'
                const changed = edits[p.id] !== undefined && parseFloat(edits[p.id]) !== currentPrice

                return (
                  <tr key={p.id} className={`border-b border-gray-50 ${changed ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                          {p.images?.[0] ? <img src={p.images[0]} className="w-full h-full object-cover" alt="" /> : <span className="flex items-center justify-center h-full text-sm">🛒</span>}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800 truncate max-w-[180px]">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.unit} · {p.stock} in stock</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-gray-600 font-medium">{formatPrice(currentPrice)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-400">ETB</span>
                        <input
                          type="number"
                          value={edits[p.id] ?? String(currentPrice)}
                          onChange={e => setEdits(prev => ({ ...prev, [p.id]: e.target.value }))}
                          className={`w-24 border-2 rounded-lg px-2 py-1 text-sm outline-none transition-colors ${changed ? 'border-orange-400 bg-orange-50' : 'border-gray-200 focus:border-green-primary'}`}
                          step="0.01"
                          min="0"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {changed ? (
                        <span className={`text-xs font-bold ${diff > 0 ? 'text-green-primary' : 'text-red-500'}`}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(2)} ({diff > 0 ? '+' : ''}{pct}%)
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="p-12 text-center text-gray-400">No products found</div>
        )}
      </div>

      {changedCount > 0 && (
        <Button fullWidth size="lg" loading={saving} onClick={saveAll}>
          <Save size={18} /> Save {changedCount} Price Changes
        </Button>
      )}
    </div>
  )
}
