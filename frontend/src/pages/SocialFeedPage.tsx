/**
 * SocialFeedPage — /social
 * TikTok-style infinite scroll feed of seller posts with tagged products.
 * No likes, no follows — pure commerce: scroll, see product, buy.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Video, Image, ShoppingBag, MessageCircle, ChevronDown } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import PostCard from '@/components/social/PostCard'
import { useAuth } from '@/hooks/useAuth'

export default function SocialFeedPage() {
  const { user } = useAuth()
  const loaderRef = useRef<HTMLDivElement>(null)
  const isSeller = user?.role === 'ADMIN' || user?.role === 'SELLER'

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['social-feed'],
    queryFn: ({ pageParam }) =>
      api.get(`/posts/feed?limit=10${pageParam ? `&cursor=${pageParam}` : ''}`).then(r => r.data),
    getNextPageParam: (last) => last.hasMore ? last.nextCursor : undefined,
    staleTime: 30000,
  })

  // Infinite scroll observer
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const el = loaderRef.current
    if (!el) return
    const obs = new IntersectionObserver(handleObserver, { threshold: 0.1 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [handleObserver])

  const allPosts = data?.pages.flatMap(p => p.data) ?? []

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <ShoppingBag size={24} className="text-green-primary" />
            Shop Feed
          </h1>
          <p className="text-gray-400 text-sm mt-0.5">Discover products from local farmers</p>
        </div>
        {isSeller && (
          <Link to="/social/create"
            className="flex items-center gap-2 bg-green-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-dark transition-colors">
            <Video size={15} /> Post
          </Link>
        )}
      </div>

      {/* Feed */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner size="lg" /></div>
      ) : allPosts.length === 0 ? (
        <div className="text-center py-20">
          <ShoppingBag size={48} className="mx-auto text-gray-200 mb-4" />
          <h3 className="font-bold text-gray-700 mb-2">No posts yet</h3>
          <p className="text-gray-400 text-sm mb-4">Sellers will post products here</p>
          {isSeller && (
            <Link to="/social/create"
              className="inline-flex items-center gap-2 bg-green-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-green-dark transition-colors">
              <Video size={16} /> Create Your First Post
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {allPosts.map((post: any) => (
            <PostCard key={post.id} post={post} />
          ))}

          {/* Infinite scroll trigger */}
          <div ref={loaderRef} className="flex justify-center py-4">
            {isFetchingNextPage && <Spinner />}
            {!hasNextPage && allPosts.length > 0 && (
              <p className="text-sm text-gray-400">You've seen all posts</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
