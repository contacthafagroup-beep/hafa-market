import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { MessageSquare, ThumbsUp, Eye, Plus, X, Send } from "lucide-react"
import { Link } from "react-router-dom"
import api from "@/lib/api"
import Spinner from "@/components/ui/Spinner"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { formatDate } from "@/lib/utils"
import toast from "react-hot-toast"
import { useAuth } from "@/hooks/useAuth"

const CATEGORIES = [
  { value: "GENERAL", label: "💬 General", emoji: "💬" },
  { value: "FARMING_TIPS", label: "🌱 Farming Tips", emoji: "🌱" },
  { value: "MARKET_PRICES", label: "💰 Market Prices", emoji: "💰" },
  { value: "WEATHER", label: "🌤 Weather", emoji: "🌤" },
  { value: "PEST_CONTROL", label: "🐛 Pest Control", emoji: "🐛" },
]

export default function Forum() {
  const qc = useQueryClient()
  const { isAuthenticated } = useAuth()
  const [activeCategory, setActiveCategory] = useState("")
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: "", content: "", category: "GENERAL" })

  const { data, isLoading } = useQuery({
    queryKey: ["forum", activeCategory],
    queryFn: () => api.get(`/features/forum${activeCategory ? "?category=" + activeCategory : ""}`).then(r => r.data),
    staleTime: 60000,
  })

  const { mutate: createPost, isLoading: creating } = useMutation({
    mutationFn: () => api.post("/features/forum", form),
    onSuccess: () => { toast.success("Post published!"); setShowForm(false); setForm({ title: "", content: "", category: "GENERAL" }); qc.invalidateQueries({ queryKey: ["forum"] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed"),
  })

  const { mutate: likePost } = useMutation({
    mutationFn: (id: string) => api.post(`/features/forum/${id}/like`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forum"] }),
  })

  const posts = data?.data || []

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">🌾 Farmer Community</h1>
          <p className="text-gray-400 text-sm">Share knowledge, ask questions, discuss market prices</p>
        </div>
        {isAuthenticated && (
          <Button onClick={() => setShowForm(true)}><Plus size={16} /> New Post</Button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6 pb-1">
        <button onClick={() => setActiveCategory("")}
          className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${!activeCategory ? "bg-green-primary text-white border-green-primary" : "bg-white border-gray-200 text-gray-600 hover:border-green-primary"}`}>
          All
        </button>
        {CATEGORIES.map(c => (
          <button key={c.value} onClick={() => setActiveCategory(c.value)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${activeCategory === c.value ? "bg-green-primary text-white border-green-primary" : "bg-white border-gray-200 text-gray-600 hover:border-green-primary"}`}>
            {c.label}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-gray-900">New Post</h3>
            <button onClick={() => setShowForm(false)}><X size={18} className="text-gray-400" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <Input label="Title *" placeholder="e.g. Best time to plant teff in Hadiya Zone?" value={form.title} onChange={(e: any) => setForm(f => ({ ...f, title: e.target.value }))} />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Content *</label>
              <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={4}
                placeholder="Share your knowledge or ask a question..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none" />
            </div>
            <div className="flex gap-3">
              <Button loading={creating} disabled={!form.title || !form.content} onClick={() => createPost()}>
                <Send size={15} /> Publish
              </Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-20"><Spinner /></div> : (
        <div className="space-y-4">
          {!posts.length ? (
            <div className="text-center py-16 text-gray-400">
              <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
              <p>No posts yet. Be the first to share!</p>
            </div>
          ) : posts.map((post: any) => (
            <Link key={post.id} to={`/forum/${post.id}`}
              className="block bg-white rounded-2xl shadow-card p-5 hover:shadow-card-hover transition-all">
              <div className="flex items-start gap-3">
                <div className="text-2xl flex-shrink-0">{CATEGORIES.find(c => c.value === post.category)?.emoji || "💬"}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 hover:text-green-primary transition-colors line-clamp-2">{post.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 mt-1">{post.content}</p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                    <span>{formatDate(post.createdAt)}</span>
                    <span className="flex items-center gap-1"><Eye size={12} /> {post.views}</span>
                    <span className="flex items-center gap-1"><MessageSquare size={12} /> {post._count?.replies || 0}</span>
                    <button onClick={e => { e.preventDefault(); if (isAuthenticated) likePost(post.id); else toast.error('Sign in to like') }}
                      className="flex items-center gap-1 hover:text-green-primary transition-colors">
                      <ThumbsUp size={12} /> {post.likes}
                    </button>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
