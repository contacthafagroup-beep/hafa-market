import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Eye, EyeOff, X } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface PostForm { title: string; titleAm: string; excerpt: string; content: string; category: string; coverImage: string; isPublished: boolean }
const EMPTY: PostForm = { title:'', titleAm:'', excerpt:'', content:'', category:'', coverImage:'', isPublished:false }
const CATEGORIES = ['Farming Tips','Market Trends','Technology','Coffee','Business','Certification','Health','Livestock']

export default function AdminBlog() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [form, setForm] = useState<PostForm>(EMPTY)
  const set = (k: keyof PostForm, v: any) => setForm(f => ({ ...f, [k]: v }))

  const { data, isLoading } = useQuery({
    queryKey: ['admin-blog'],
    queryFn: () => api.get('/blog?limit=50').then(r => r.data.data),
  })

  const { mutate: save, isLoading: saving } = useMutation({
    mutationFn: () => editId
      ? api.patch(`/blog/${editId}`, form)
      : api.post('/blog', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-blog'] })
      setShowForm(false); setEditId(null); setForm(EMPTY)
      toast.success(editId ? 'Post updated!' : 'Post published!')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to save'),
  })

  const { mutate: remove } = useMutation({
    mutationFn: (id: string) => api.delete(`/blog/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-blog'] }); toast.success('Post deleted') },
  })

  const { mutate: togglePublish } = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      api.patch(`/blog/${id}`, { isPublished }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-blog'] }),
  })

  const startEdit = (post: any) => {
    setEditId(post.id)
    setForm({ title: post.title, titleAm: post.titleAm||'', excerpt: post.excerpt||'',
              content: post.content||'', category: post.category||'', coverImage: post.coverImage||'',
              isPublished: post.isPublished })
    setShowForm(true)
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Blog Posts</h2>
          <p className="text-sm text-gray-400">{data?.length || 0} posts</p>
        </div>
        <Button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY) }}>
          <Plus size={16} /> New Post
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-gray-900">{editId ? 'Edit Post' : 'New Blog Post'}</h3>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY) }}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X size={18}/></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Title (English) *" value={form.title} onChange={(e: any) => set('title', e.target.value)} />
            <Input label="Title (Amharic)" value={form.titleAm} onChange={(e: any) => set('titleAm', e.target.value)} />
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
                <option value="">Select category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Input label="Cover Image URL" value={form.coverImage} onChange={(e: any) => set('coverImage', e.target.value)} placeholder="https://..." />
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Excerpt</label>
              <textarea value={form.excerpt} onChange={e => set('excerpt', e.target.value)} rows={2}
                placeholder="Short description shown in blog listing..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Content (HTML supported)</label>
              <textarea value={form.content} onChange={e => set('content', e.target.value)} rows={10}
                placeholder="Write your blog post content here..."
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none font-mono" />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isPublished} onChange={e => set('isPublished', e.target.checked)} className="w-4 h-4 accent-green-primary" />
                <span className="text-sm font-medium text-gray-700">Publish immediately</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <Button onClick={() => save()} loading={saving} disabled={!form.title || !form.content}>
              {editId ? 'Update Post' : 'Publish Post'}
            </Button>
            <Button variant="ghost" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY) }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Posts list */}
      {!data?.length && !showForm ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center text-gray-400">No blog posts yet</div>
      ) : (
        <div className="space-y-3">
          {data?.map((post: any) => (
            <div key={post.id} className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-4">
              {post.coverImage && (
                <img src={post.coverImage} alt="" className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-bold text-gray-900 truncate">{post.title}</span>
                  <span className={`badge text-xs flex-shrink-0 ${post.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {post.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
                {post.category && <span className="text-xs text-gray-400">{post.category} · </span>}
                <span className="text-xs text-gray-400">{formatDate(post.publishedAt || post.createdAt)}</span>
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => togglePublish({ id: post.id, isPublished: !post.isPublished })}
                  title={post.isPublished ? 'Unpublish' : 'Publish'}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                  {post.isPublished ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
                <button onClick={() => startEdit(post)}
                  className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors">
                  <Edit2 size={15}/>
                </button>
                <button onClick={() => { if (confirm('Delete this post?')) remove(post.id) }}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors">
                  <Trash2 size={15}/>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
