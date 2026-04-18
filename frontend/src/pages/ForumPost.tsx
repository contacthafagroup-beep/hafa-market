import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ThumbsUp, Eye, MessageSquare, Send } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

const CATEGORIES: Record<string, string> = {
  GENERAL: '💬',
  FARMING_TIPS: '🌱',
  MARKET_PRICES: '💰',
  WEATHER: '🌤',
  PEST_CONTROL: '🐛',
}

export default function ForumPost() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const { isAuthenticated, user } = useAuth()
  const [replyText, setReplyText] = useState('')

  const { data: post, isLoading } = useQuery({
    queryKey: ['forum-post', id],
    queryFn: () => api.get(`/features/forum/${id}`).then(r => r.data.data),
    enabled: !!id,
  })

  const { mutate: likePost } = useMutation({
    mutationFn: () => api.post(`/features/forum/${id}/like`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['forum-post', id] }),
  })

  const { mutate: submitReply, isPending: replying } = useMutation({
    mutationFn: () => api.post(`/features/forum/${id}/reply`, { content: replyText }),
    onSuccess: () => {
      toast.success('Reply posted!')
      setReplyText('')
      qc.invalidateQueries({ queryKey: ['forum-post', id] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to post reply'),
  })

  if (isLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>
  if (!post) return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center text-gray-400">
      <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
      <p>Post not found</p>
      <Link to="/forum" className="text-green-primary font-semibold mt-4 inline-block">← Back to Forum</Link>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link to="/forum" className="flex items-center gap-2 text-sm text-gray-500 hover:text-green-primary mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Forum
      </Link>

      {/* Post */}
      <div className="bg-white rounded-2xl shadow-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">{CATEGORIES[post.category] || '💬'}</span>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">{post.category?.replace(/_/g, ' ')}</span>
        </div>
        <h1 className="text-xl font-extrabold text-gray-900 mb-3">{post.title}</h1>
        <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap mb-5">{post.content}</p>

        <div className="flex items-center gap-4 text-xs text-gray-400 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-green-100 text-green-primary font-bold text-xs flex items-center justify-center">
              {post.author?.name?.[0] || '?'}
            </div>
            <span className="font-semibold text-gray-600">{post.author?.name || 'Anonymous'}</span>
          </div>
          <span>{formatDate(post.createdAt)}</span>
          <span className="flex items-center gap-1"><Eye size={12} /> {post.views || 0}</span>
          <button
            onClick={() => isAuthenticated ? likePost() : toast.error('Sign in to like posts')}
            className="flex items-center gap-1 hover:text-green-primary transition-colors ml-auto"
          >
            <ThumbsUp size={12} /> {post.likes || 0} Likes
          </button>
        </div>
      </div>

      {/* Replies */}
      <div className="mb-6">
        <h2 className="font-extrabold text-gray-900 mb-4 flex items-center gap-2">
          <MessageSquare size={18} className="text-green-primary" />
          Replies ({post.replies?.length || 0})
        </h2>

        {post.replies?.length ? (
          <div className="space-y-4">
            {post.replies.map((reply: any) => (
              <div key={reply.id} className="bg-white rounded-2xl shadow-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-green-100 text-green-primary font-bold text-xs flex items-center justify-center">
                    {reply.author?.name?.[0] || '?'}
                  </div>
                  <span className="font-semibold text-sm text-gray-800">{reply.author?.name || 'Anonymous'}</span>
                  <span className="text-xs text-gray-400 ml-auto">{formatDate(reply.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{reply.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 text-sm">
            No replies yet. Be the first to respond!
          </div>
        )}
      </div>

      {/* Reply form */}
      {isAuthenticated ? (
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="font-bold text-gray-900 mb-3">Add a Reply</h3>
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            rows={4}
            placeholder="Share your thoughts or answer..."
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary resize-none mb-3"
          />
          <Button
            loading={replying}
            disabled={!replyText.trim()}
            onClick={() => submitReply()}
          >
            <Send size={15} /> Post Reply
          </Button>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-2xl p-5 text-center">
          <p className="text-gray-500 text-sm mb-3">Sign in to join the discussion</p>
          <Link to="/login" className="text-green-primary font-semibold hover:underline">Sign In →</Link>
        </div>
      )}
    </div>
  )
}
