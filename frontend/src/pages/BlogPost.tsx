import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Calendar, ArrowLeft } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const { data: post, isLoading } = useQuery({
    queryKey: ['blog', slug],
    queryFn:  () => api.get(`/blog/${slug}`).then(r => r.data.data),
    enabled:  !!slug,
  })

  if (isLoading) return <div className="flex justify-center py-32"><Spinner size="lg" /></div>
  if (!post)     return <div className="text-center py-32 text-gray-400">Post not found</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link to="/blog" className="flex items-center gap-2 text-sm text-gray-400 hover:text-green-primary mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Blog
      </Link>
      {post.category && <span className="badge badge-green text-xs mb-3">{post.category}</span>}
      <h1 className="text-3xl font-extrabold text-gray-900 mb-3">{post.title}</h1>
      {post.publishedAt && (
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-8">
          <Calendar size={14} />{formatDate(post.publishedAt)}
        </div>
      )}
      {post.coverImage && <img src={post.coverImage} alt={post.title} className="w-full rounded-2xl mb-8 object-cover max-h-80" />}
      <div className="prose max-w-none text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: post.content }} />
    </div>
  )
}
