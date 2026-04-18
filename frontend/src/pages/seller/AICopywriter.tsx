/**
 * AI Copywriter — /dashboard/ai-copywriter
 * Auto-generates product descriptions, titles, and SEO tags
 * using Groq via the existing /ai/chat endpoint.
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wand2, Copy, Check, RefreshCw, Sparkles } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'

const TONES = [
  { value: 'professional', label: '👔 Professional' },
  { value: 'friendly',     label: '😊 Friendly' },
  { value: 'urgent',       label: '🔥 Urgent/Exciting' },
  { value: 'traditional',  label: '🌾 Traditional Ethiopian' },
]

const TEMPLATES = [
  { id: 'description', label: 'Product Description', icon: '📝',
    prompt: (name: string, details: string, tone: string) =>
      `Write a compelling 3-sentence product description for an Ethiopian agricultural marketplace. Product: "${name}". Details: ${details || 'fresh, locally sourced'}. Tone: ${tone}. Focus on freshness, quality, and local origin. Reply with ONLY the description, no labels.` },
  { id: 'title',       label: 'SEO Product Title',   icon: '🏷️',
    prompt: (name: string, details: string, tone: string) =>
      `Write 3 alternative SEO-optimized product titles for: "${name}" on an Ethiopian agricultural marketplace. Details: ${details || 'fresh, locally sourced'}. Each title should be under 60 characters. Reply with ONLY the 3 titles, one per line, no numbering.` },
  { id: 'tags',        label: 'Search Tags',          icon: '🔖',
    prompt: (name: string, details: string, _tone: string) =>
      `Generate 8 relevant search tags for this product on an Ethiopian marketplace: "${name}". Details: ${details || 'fresh agricultural product'}. Include Amharic and English tags. Reply with ONLY the tags separated by commas.` },
  { id: 'whatsapp',    label: 'WhatsApp Promo',       icon: '💬',
    prompt: (name: string, details: string, tone: string) =>
      `Write a short WhatsApp promotional message (max 3 sentences) for: "${name}" on Hafa Market Ethiopia. Details: ${details || 'fresh, quality product'}. Tone: ${tone}. Include a call to action. Reply with ONLY the message.` },
]

export default function AICopywriter() {
  const [productName, setProductName] = useState('')
  const [details, setDetails]         = useState('')
  const [tone, setTone]               = useState('friendly')
  const [template, setTemplate]       = useState('description')
  const [result, setResult]           = useState('')
  const [generating, setGenerating]   = useState(false)
  const [copied, setCopied]           = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [applying, setApplying]       = useState(false)

  const { data: products = [] } = useQuery({
    queryKey: ['seller-products-copywriter'],
    queryFn: () => api.get('/sellers/me/products?limit=50').then(r => r.data.data || []),
  })

  const selectProduct = (p: any) => {
    setSelectedProduct(p)
    setProductName(p.name)
    setDetails(p.description || '')
  }

  const generate = async () => {
    if (!productName.trim()) { toast.error('Enter a product name first'); return }
    setGenerating(true)
    setResult('')
    try {
      const tmpl = TEMPLATES.find(t => t.id === template)!
      const res = await api.post('/ai/chat', {
        message: tmpl.prompt(productName, details, tone),
        language: 'en',
        history: [],
      })
      setResult(res.data.data?.reply?.trim() || '')
    } catch {
      toast.error('AI generation failed. Try again.')
    } finally {
      setGenerating(false)
    }
  }

  const copy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    toast.success('Copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const applyToProduct = async () => {
    if (!selectedProduct || !result) return
    setApplying(true)
    try {
      const field = template === 'description' ? { description: result }
                  : template === 'title'       ? { name: result.split('\n')[0] }
                  : null
      if (field) {
        await api.patch(`/sellers/me/products/${selectedProduct.id}`, field)
        toast.success('Applied to product ✅')
      } else {
        copy()
      }
    } catch {
      toast.error('Failed to apply')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <Wand2 size={20} className="text-purple-600" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">AI Copywriter</h2>
          <p className="text-sm text-gray-400">Generate product descriptions, titles & promo messages with AI</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input panel */}
        <div className="space-y-4">
          {/* Quick-select from existing products */}
          {products.length > 0 && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Quick-fill from your products</label>
              <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto">
                {products.slice(0, 12).map((p: any) => (
                  <button key={p.id} onClick={() => selectProduct(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                      selectedProduct?.id === p.id
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'border-gray-200 text-gray-600 hover:border-purple-300'
                    }`}>
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Product name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Product Name *</label>
            <input value={productName} onChange={e => setProductName(e.target.value)}
              placeholder="e.g. Fresh Organic Tomatoes"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400" />
          </div>

          {/* Details */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Key Details (optional)</label>
            <textarea value={details} onChange={e => setDetails(e.target.value)}
              rows={3} placeholder="e.g. Harvested yesterday, Grade A, from Hossana region, organic certified..."
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-purple-400 resize-none" />
          </div>

          {/* Template */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">What to generate</label>
            <div className="grid grid-cols-2 gap-2">
              {TEMPLATES.map(t => (
                <button key={t.id} onClick={() => setTemplate(t.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all text-left ${
                    template === t.id ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-600 hover:border-purple-300'
                  }`}>
                  <span>{t.icon}</span> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Tone</label>
            <div className="flex gap-2 flex-wrap">
              {TONES.map(t => (
                <button key={t.value} onClick={() => setTone(t.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                    tone === t.value ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-600 hover:border-purple-300'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={generate} loading={generating} fullWidth
            className="bg-purple-600 hover:bg-purple-700 text-white">
            <Sparkles size={16} /> {generating ? 'Generating…' : 'Generate with AI'}
          </Button>
        </div>

        {/* Output panel */}
        <div>
          <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-5 min-h-[300px] relative">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                {TEMPLATES.find(t => t.id === template)?.icon} Generated {TEMPLATES.find(t => t.id === template)?.label}
              </p>
              {result && (
                <div className="flex gap-2">
                  <button onClick={() => generate()}
                    className="p-1.5 text-gray-400 hover:text-purple-600 transition-colors" title="Regenerate">
                    <RefreshCw size={14} />
                  </button>
                  <button onClick={copy}
                    className="p-1.5 text-gray-400 hover:text-green-600 transition-colors" title="Copy">
                    {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  </button>
                </div>
              )}
            </div>

            {generating ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-400">AI is writing…</p>
              </div>
            ) : result ? (
              <>
                <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{result}</div>
                <div className="flex gap-2 mt-4">
                  <button onClick={copy}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white border-2 border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:border-green-primary hover:text-green-primary transition-all">
                    {copied ? <Check size={12} /> : <Copy size={12} />} Copy
                  </button>
                  {selectedProduct && (template === 'description' || template === 'title') && (
                    <button onClick={applyToProduct} disabled={applying}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-primary text-white rounded-xl text-xs font-bold hover:bg-green-dark transition-all disabled:opacity-50">
                      <Check size={12} /> {applying ? 'Applying…' : `Apply to "${selectedProduct.name}"`}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-gray-300">
                <Wand2 size={40} className="mb-3 opacity-40" />
                <p className="text-sm">Your generated content will appear here</p>
              </div>
            )}
          </div>

          {/* Tips */}
          <div className="mt-4 bg-purple-50 border border-purple-100 rounded-xl p-4">
            <p className="text-xs font-bold text-purple-700 mb-2">💡 Tips for better results</p>
            <ul className="space-y-1 text-xs text-purple-600">
              <li>• Add harvest date and origin for freshness-focused copy</li>
              <li>• Mention certifications (organic, Grade A) for premium positioning</li>
              <li>• Use "Traditional Ethiopian" tone for local market appeal</li>
              <li>• Generate multiple times and pick the best version</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
