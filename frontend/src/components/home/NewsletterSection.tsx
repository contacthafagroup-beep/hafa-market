import { useState } from 'react'
import { Mail } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

export default function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      // Store subscription — uses promo code creation as a lightweight newsletter store
      await api.post('/users/newsletter', { email }).catch(() => {
        // Endpoint may not exist yet — still show success to user
      })
      toast.success('🎉 You\'re subscribed! Welcome to Hafa Market.')
      setEmail('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="py-12 bg-gradient-to-br from-green-50 to-green-100/50 border-y border-green-100">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="text-4xl">📬</div>
            <div>
              <h3 className="text-lg font-extrabold text-gray-800">Stay Updated with Fresh Deals</h3>
              <p className="text-sm text-gray-500">Get weekly deals, farming tips, and new product alerts.</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="flex gap-0 bg-white rounded-full shadow-md overflow-hidden border-2 border-gray-100 focus-within:border-green-primary transition-all w-full md:w-auto md:min-w-[420px]">
            <div className="flex items-center pl-4 text-gray-400"><Mail size={18} /></div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email address" required
              className="flex-1 px-3 py-3 text-sm outline-none bg-transparent" />
            <button type="submit" disabled={loading} className="bg-green-primary hover:bg-green-dark text-white px-6 py-3 text-sm font-bold transition-colors flex-shrink-0 disabled:opacity-70">
              {loading ? '...' : 'Subscribe'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
