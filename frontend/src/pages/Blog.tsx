import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Calendar, Clock, BookOpen } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'

const PLACEHOLDER_POSTS = [
  {
    id: '1', slug: '#', title: '10 Tips for Growing Organic Vegetables at Home',
    excerpt: 'Learn how to start your own organic vegetable garden with minimal space and investment.',
    category: 'Farming Tips', publishedAt: '2026-01-15',
    gradient: 'from-[#1b5e20] to-[#2E7D32]', emoji: '🌱',
  },
  {
    id: '2', slug: '#', title: 'Grain Prices in 2026: What Farmers Need to Know',
    excerpt: 'A comprehensive look at grain market trends and how to maximize your profits this season.',
    category: 'Market Trends', publishedAt: '2026-01-10',
    gradient: 'from-[#bf360c] to-[#e64a19]', emoji: '🌾',
  },
  {
    id: '3', slug: '#', title: 'Smart Irrigation Systems for Small-Scale Farmers',
    excerpt: 'How modern irrigation technology is helping Ethiopian farmers save water and increase yields.',
    category: 'Technology', publishedAt: '2026-01-05',
    gradient: 'from-[#1565c0] to-[#1976d2]', emoji: '💧',
  },
  {
    id: '4', slug: '#', title: 'The Rise of Ethiopian Coffee on the Global Market',
    excerpt: 'Ethiopian coffee is gaining worldwide recognition. Here\'s how local farmers can benefit.',
    category: 'Coffee', publishedAt: '2025-12-28',
    gradient: 'from-[#4e342e] to-[#6d4c41]', emoji: '☕',
  },
  {
    id: '5', slug: '#', title: 'How to Price Your Farm Products for Maximum Profit',
    excerpt: 'Pricing strategies that help farmers earn more while staying competitive in local markets.',
    category: 'Business', publishedAt: '2025-12-20',
    gradient: 'from-[#1a237e] to-[#283593]', emoji: '💰',
  },
  {
    id: '6', slug: '#', title: 'Organic Certification: A Step-by-Step Guide for Ethiopian Farmers',
    excerpt: 'Everything you need to know about getting your farm certified organic and accessing premium markets.',
    category: 'Certification', publishedAt: '2025-12-15',
    gradient: 'from-[#1b5e20] to-[#388e3c]', emoji: '🏆',
  },
]

export default function Blog() {
  const { data, isLoading } = useQuery({
    queryKey: ['blog'],
    queryFn: () => api.get('/blog').then(r => r.data.data).catch(() => []),
  })

  const posts = data?.length ? data : PLACEHOLDER_POSTS

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <p className="text-xs font-bold text-green-primary uppercase tracking-widest mb-2">Farm Knowledge</p>
        <h1 className="text-3xl font-extrabold text-gray-900">From the <span className="text-green-primary">Farm Blog</span></h1>
        <p className="text-gray-400 mt-2 text-sm">Tips, trends and insights for farmers and buyers</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post: any) => (
            <Link key={post.id} to={post.slug && post.slug !== '#' ? `/blog/${post.slug}` : '/blog'}
              className="bg-white rounded-2xl shadow-card overflow-hidden group hover:-translate-y-1 hover:shadow-card-hover transition-all duration-200"
              onClick={e => { if (!post.slug || post.slug === '#') e.preventDefault() }}
              <div className={`h-48 bg-gradient-to-br ${post.gradient || 'from-green-dark to-green-primary'} flex items-center justify-center relative overflow-hidden`}>
                {post.coverImage
                  ? <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
                  : <span className="text-6xl">{post.emoji || '🌱'}</span>
                }
                {post.category && (
                  <span className="absolute top-3 left-3 bg-white/90 text-gray-700 text-xs font-bold px-3 py-1 rounded-full">
                    {post.category}
                  </span>
                )}
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
                  {post.publishedAt && (
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />{formatDate(post.publishedAt)}
                    </span>
                  )}
                  <span className="flex items-center gap-1"><Clock size={11} />5 min read</span>
                </div>
                <h3 className="font-bold text-gray-800 group-hover:text-green-primary transition-colors line-clamp-2 mb-2">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{post.excerpt}</p>
                )}
                <span className="text-green-primary text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                  Read More <span>→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!data?.length && !isLoading && (
        <div className="mt-10 bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <BookOpen size={32} className="mx-auto text-green-primary mb-3" />
          <h3 className="font-bold text-gray-800 mb-1">No articles yet</h3>
          <p className="text-gray-500 text-sm">Check back soon for farming tips, market trends, and more.</p>
        </div>
      )}
    </div>
  )
}
