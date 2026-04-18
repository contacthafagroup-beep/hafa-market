import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { usePersonalization } from '@/hooks/usePersonalization'
import { ArrowRight, Truck, Shield, RotateCcw, Leaf, Headphones } from 'lucide-react'
import { productService } from '@/services/product.service'
import ProductCard from '@/components/product/ProductCard'
import Spinner from '@/components/ui/Spinner'
import HeroSection from '@/components/home/HeroSection'
import CategoriesSection from '@/components/home/CategoriesSection'
import DealsSection from '@/components/home/DealsSection'
import SellersSection from '@/components/home/SellersSection'
import WhyUsSection from '@/components/home/WhyUsSection'
import HowItWorksSection from '@/components/home/HowItWorksSection'
import StatsSection from '@/components/home/StatsSection'
import AppPreviewSection from '@/components/home/AppPreviewSection'
import TestimonialsSection from '@/components/home/TestimonialsSection'
import NewsletterSection from '@/components/home/NewsletterSection'
import BulkOrderSection from '@/components/home/BulkOrderSection'
import RecommendationSection from '@/components/ui/RecommendationSection'
import RecentlyViewed from '@/components/ui/RecentlyViewed'
import Button from '@/components/ui/Button'
import SocialFeed from '@/components/social/SocialFeed'
import ShopFeedSlider from '@/components/home/ShopFeedSlider'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'

const BG_COLORS = [
  'from-[#1b5e20] to-[#2E7D32]',
  'from-[#bf360c] to-[#e64a19]',
  'from-[#1565c0] to-[#1976d2]',
  'from-[#4a148c] to-[#7b1fa2]',
  'from-[#e65100] to-[#f57c00]',
]

function BlogSection() {
  const { data: posts, isLoading } = useQuery({
    queryKey: ['blog-preview'],
    queryFn: () => api.get('/blog?limit=3&published=true').then(r => r.data.data),
    staleTime: 1000 * 60 * 5,
  })

  const FALLBACK = [
    { slug:'farming-tips', category:'Farming Tips', title:'10 Tips for Growing Organic Vegetables at Home', excerpt:'Learn how to start your own organic vegetable garden with minimal space and investment...', publishedAt: new Date('2026-01-15').toISOString() },
    { slug:'grain-prices', category:'Market Trends', title:'Grain Prices in 2026: What Farmers Need to Know', excerpt:'A comprehensive look at grain market trends and how to maximize your profits...', publishedAt: new Date('2026-01-10').toISOString() },
    { slug:'smart-irrigation', category:'Technology', title:'Smart Irrigation Systems for Small-Scale Farmers', excerpt:'How modern irrigation technology is helping African farmers save water and increase yields...', publishedAt: new Date('2026-01-05').toISOString() },
  ]

  const items = (posts?.length ? posts : FALLBACK).slice(0, 3)

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-xs font-bold text-green-primary uppercase tracking-widest mb-1">Farm Knowledge</p>
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">From the <span className="text-green-primary">Farm Blog</span></h2>
          </div>
          <Link to="/blog" className="text-green-primary font-semibold text-sm flex items-center gap-1 hover:gap-2 transition-all">All Articles <ArrowRight size={16} /></Link>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {items.map((post: any, i: number) => (
            <Link key={post.slug || post.title} to={`/blog/${post.slug}`}
              className="bg-white rounded-2xl shadow-card overflow-hidden group hover:-translate-y-1 hover:shadow-card-hover transition-all duration-200">
              <div className={`h-44 bg-gradient-to-br ${post.coverImage ? '' : BG_COLORS[i % BG_COLORS.length]} flex items-center justify-center text-6xl relative overflow-hidden`}>
                {post.coverImage
                  ? <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
                  : <span>📰</span>
                }
                <span className="absolute top-3 left-3 bg-white/90 text-gray-700 text-xs font-bold px-3 py-1 rounded-full">
                  {post.category || 'Blog'}
                </span>
              </div>
              <div className="p-5">
                <div className="flex gap-3 text-xs text-gray-400 mb-2">
                  <span>📅 {formatDate(post.publishedAt || post.createdAt)}</span>
                </div>
                <h3 className="font-bold text-gray-800 group-hover:text-green-primary transition-colors line-clamp-2 mb-2">{post.title}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-3">{post.excerpt}</p>
                <span className="text-green-primary text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">Read More <ArrowRight size={14} /></span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

const ALL_CATEGORIES = [
  { label:'Vegetables',          slug:'vegetables', emoji:'🥬', sub:'Tomatoes, Onions, Kale...',      c1:'#e8f5e9', c2:'#c8e6c9' },
  { label:'Fruits',              slug:'fruits',     emoji:'🍎', sub:'Mango, Avocado, Banana...',      c1:'#fff3e0', c2:'#ffe0b2' },
  { label:'Grains & Legumes',    slug:'grains',     emoji:'🌾', sub:'Teff, Wheat, Beans, Lentils...', c1:'#fafafa',  c2:'#f0f0f0' },
  { label:'Spices & Herbs',      slug:'spices',     emoji:'🌿', sub:'Turmeric, Ginger, Cardamom...',  c1:'#fff8e1', c2:'#ffecb3' },
  { label:'Poultry & Dairy',     slug:'poultry',    emoji:'🥚', sub:'Eggs, Milk, Chicken...',         c1:'#fce4ec', c2:'#f8bbd0' },
  { label:'Livestock & Meat',    slug:'meat',       emoji:'🥩', sub:'Beef, Mutton, Goat Meat...',     c1:'#fbe9e7', c2:'#ffccbc' },
  { label:'Coffee & Beverages',  slug:'coffee',     emoji:'☕', sub:'Roasted, Raw Coffee...',         c1:'#efebe9', c2:'#d7ccc8' },
  { label:'Specialty Products',  slug:'specialty',  emoji:'🍯', sub:'Honey, Moringa, Aloe Vera...',   c1:'#f3e5f5', c2:'#e1bee7' },
  { label:'Processed Foods',     slug:'processed',  emoji:'🍲', sub:'ዶሮ ወጥ, Snacks...',             c1:'#e8eaf6', c2:'#c5cae9' },
  { label:'Household & Essentials',slug:'household',emoji:'🏠', sub:'Detergents, Cleaning...',        c1:'#e0f7fa', c2:'#b2ebf2' },
  { label:'Services (አገልግሎት)', slug:'services',   emoji:'🚚', sub:'Delivery, Logistics...',         c1:'#e3f2fd', c2:'#bbdefb' },
  { label:'All Products',        slug:'',           emoji:'🌍', sub:'Browse everything',              c1:'#2E7D32', c2:'#1b5e20', special: true },
]

const TRUST = [
  { icon:<Truck size={20}/>,      title:'Fast Delivery',   desc:'24–48 hours to your door' },
  { icon:<Shield size={20}/>,     title:'Secure Payment',  desc:'100% protected' },
  { icon:<RotateCcw size={20}/>,  title:'Easy Returns',    desc:'7-day return policy' },
  { icon:<Leaf size={20}/>,       title:'100% Organic',    desc:'Certified products' },
  { icon:<Headphones size={20}/>, title:'24/7 Support',    desc:'Always here for you' },
]

export default function Home() {
  const [selectedCategory, setSelectedCategory] = useState('')
  const { topCategories } = usePersonalization()

  // Use personalized category if user hasn't manually selected one
  const activeCategory = selectedCategory || topCategories[0] || ''

  const { data: featured, isLoading } = useQuery({
    queryKey: ['featured', activeCategory],
    queryFn:  () => productService.getProducts({ category: activeCategory || undefined, limit: 10, sort: 'soldCount' }).then(r => r.data.data),
  })

  return (
    <div>
      {/* 1. Hero */}
      <HeroSection />

      {/* 2. Trust Bar */}
      <div className="bg-gray-50 border-b border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-around flex-wrap gap-4">
          {TRUST.map(t => (
            <div key={t.title} className="flex items-center gap-2.5">
              <span className="text-green-primary">{t.icon}</span>
              <div>
                <div className="text-sm font-bold text-gray-800">{t.title}</div>
                <div className="text-xs text-gray-400">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Categories */}
      <CategoriesSection
        selectedCategory={selectedCategory}
        onCategorySelect={slug => setSelectedCategory(prev => prev === slug ? '' : slug)}
      />

      {/* 4. Deals Banners */}
      <DealsSection />

      {/* 5. Featured Products with filter tabs */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-6">
            <div>
              <p className="text-xs font-bold text-green-primary uppercase tracking-widest mb-1">
                {topCategories.length > 0 ? '✨ Personalized for You' : 'Handpicked for You'}
              </p>
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">
                {selectedCategory ? <><span className="text-green-primary capitalize">{selectedCategory}</span> Products</> : activeCategory ? <><span className="text-green-primary capitalize">{activeCategory}</span> Products</> : <>Featured <span className="text-green-primary">Products</span></>}
              </h2>
            </div>
            <Link to="/products" className="text-green-primary font-semibold text-sm flex items-center gap-1 hover:gap-2 transition-all">View All <ArrowRight size={16} /></Link>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6 pb-1">
            {['All','🥬 Vegetables','🍎 Fruits','🌾 Grains','🌿 Spices','🥚 Poultry','☕ Coffee','🍯 Specialty'].map(tab => (
              <Link key={tab} to={tab === 'All' ? '/products' : `/products?category=${tab.split(' ')[1]?.toLowerCase()}`}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all ${tab === 'All' ? 'bg-green-primary text-white border-green-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-green-primary hover:text-green-primary'}`}>
                {tab}
              </Link>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><Spinner size="lg" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {featured?.slice(0, 10).map((p, i) => (
                  <div key={p.id} className="relative">
                    {/* Trending badge on top 3 */}
                    {i < 3 && (p as any).soldCount >= 5 && (
                      <div className="absolute -top-2 -left-1 z-10 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-md animate-pulse">
                        🔥 Hot
                      </div>
                    )}
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
              <div className="text-center mt-8">
                <Link to="/products">
                  <Button variant="outline" size="lg">Load More Products</Button>
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 6. Bulk Orders */}
      <BulkOrderSection />

      {/* 6.5 AI Recommendations */}
      <RecommendationSection
        context="homepage"
        title="Recommended For You"
        titleAm="ለእርስዎ የሚመከሩ"
      />

      {/* 6.6 Recently Viewed */}
      <RecentlyViewed />

      {/* 6.65 Shop Feed Horizontal Slider */}
      <ShopFeedSlider />

      {/* 6.7 Social Community Feed */}
      <SocialFeed />

      {/* 6.8 Farmer Direct teaser */}
      <section className="py-10 bg-gradient-to-br from-green-50 to-green-100">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-bold text-green-primary uppercase tracking-widest mb-1">🌾 No Middlemen</p>
            <h2 className="text-2xl font-extrabold text-gray-900">Buy Direct from Farmers</h2>
            <p className="text-gray-500 text-sm mt-1">Fresh from the farm, fair prices, verified sellers</p>
          </div>
          <Link to="/farmer-direct">
            <Button size="lg">Explore Farmer Direct <ArrowRight size={16} /></Button>
          </Link>
        </div>
      </section>

      {/* 6.9 Export Marketplace Section */}
      <section className="py-20 relative overflow-hidden bg-green-primary">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-[500px] h-[500px] rounded-full opacity-5 bg-white -top-40 -right-40" />
          <div className="absolute w-[300px] h-[300px] rounded-full opacity-5 bg-white -bottom-20 -left-20" />
          <div className="absolute top-8 right-8 text-[120px] opacity-5 select-none">🌍</div>
        </div>

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          {/* Top label */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-5">
              <span className="text-green-300 text-sm font-bold">🌍 Global B2B Export Marketplace</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
              Ethiopian Products,<br />
              <span className="text-green-300">Global Buyers</span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Connect directly with verified Ethiopian exporters. Source premium coffee, teff, honey, spices and more — straight from origin.
            </p>
          </div>

          {/* Product categories grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-10">
            {[
              { emoji: '☕', label: 'Coffee' },
              { emoji: '🌾', label: 'Teff' },
              { emoji: '🍯', label: 'Honey' },
              { emoji: '🌿', label: 'Spices' },
              { emoji: '🥑', label: 'Avocado' },
              { emoji: '👜', label: 'Leather' },
            ].map(item => (
              <Link key={item.label} to={`/export?category=${item.label.toUpperCase()}`}
                className="bg-white/10 hover:bg-white/20 border border-white/15 rounded-2xl p-4 text-center transition-all hover:-translate-y-0.5 group">
                <div className="text-3xl mb-2">{item.emoji}</div>
                <p className="text-white/80 text-xs font-semibold group-hover:text-white">{item.label}</p>
              </Link>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {[
              { value: '200+', label: 'Verified Exporters' },
              { value: '50+', label: 'Countries Reached' },
              { value: '$5.1B', label: 'Annual Export Value' },
              { value: '11', label: 'Product Categories' },
            ].map(s => (
              <div key={s.label} className="bg-white/8 border border-white/10 rounded-2xl p-5 text-center">
                <p className="text-3xl font-black text-white mb-1">{s.value}</p>
                <p className="text-white/50 text-xs">{s.label}</p>
              </div>
            ))}
          </div>

          {/* How it works — 4 steps */}
          <div className="grid sm:grid-cols-4 gap-4 mb-10">
            {[
              { step: '1', icon: '🔍', title: 'Browse Listings', desc: 'Find verified Ethiopian exporters by product, grade and certification' },
              { step: '2', icon: '📨', title: 'Send Inquiry', desc: 'Submit an RFQ with your quantity, target price and delivery port' },
              { step: '3', icon: '💬', title: 'Negotiate', desc: 'Chat directly, receive quotes, request samples and agree on terms' },
              { step: '4', icon: '🚢', title: 'Ship & Track', desc: '30% deposit, 70% on shipment — full documentation included' },
            ].map(s => (
              <div key={s.step} className="bg-white/8 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-xs font-black text-white">{s.step}</div>
                  <span className="text-2xl">{s.icon}</span>
                </div>
                <h4 className="font-bold text-white mb-1 text-sm">{s.title}</h4>
                <p className="text-white/50 text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/export"
              className="w-full sm:w-auto text-center bg-white text-green-dark font-extrabold px-10 py-4 rounded-2xl hover:bg-gray-100 transition-colors text-base shadow-xl">
              🌍 Browse Export Listings
            </Link>
            <Link to="/export/rfq"
              className="w-full sm:w-auto text-center bg-white/10 border-2 border-white/30 text-white font-bold px-10 py-4 rounded-2xl hover:bg-white/20 transition-colors text-base">
              📨 Post a Buying Request
            </Link>
            <Link to="/export/dashboard"
              className="w-full sm:w-auto text-center text-white/60 hover:text-white font-semibold px-6 py-4 text-sm transition-colors underline underline-offset-4">
              Seller Export Dashboard →
            </Link>
          </div>
        </div>
      </section>

      {/* 7. Top Sellers */}
      <SellersSection />

      {/* 7. Why Choose Us */}
      <WhyUsSection />

      {/* 8. How It Works */}
      <HowItWorksSection />

      {/* 9. Stats Counter */}
      <StatsSection />

      {/* 10. App Preview */}
      <AppPreviewSection />

      {/* 11. Blog */}
      <BlogSection />

      {/* 12. Testimonials */}
      <TestimonialsSection />

      {/* 13. Newsletter */}
      <NewsletterSection />

      {/* 14. CTA with App Store links */}
      <section className="py-20 bg-gradient-to-br from-[#0d2b0f] via-[#1b5e20] to-[#2E7D32] text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-96 h-96 rounded-full bg-white/5 -top-32 -right-16" />
          <div className="absolute w-64 h-64 rounded-full bg-white/5 -bottom-16 -left-12" />
        </div>
        <div className="max-w-2xl mx-auto px-4 relative z-10">
          <div className="inline-block bg-white/15 border border-white/20 px-4 py-1.5 rounded-full text-sm font-medium text-white mb-5">🌿 Join 50,000+ Happy Customers</div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Start Shopping Fresh Today</h2>
          <p className="text-white/75 mb-8">Get access to thousands of fresh agricultural products at the best prices, delivered fast.</p>
          <div className="flex gap-3 justify-center flex-wrap mb-8">
            <Link to="/products"><Button size="lg" className="bg-orange-primary hover:bg-orange-dark shadow-xl">🛒 Shop Now</Button></Link>
            <Link to="/register"><Button size="lg" className="bg-white text-green-primary hover:bg-gray-100 shadow-xl">👤 Create Free Account</Button></Link>
            <Link to="/register?role=SELLER"><Button size="lg" className="bg-white/10 text-white border border-white/30 hover:bg-white/20">🌿 Sell on Hafa</Button></Link>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <span className="text-white/60 text-sm">Also available on:</span>
            {[['fab fa-google-play','Google Play'],['fab fa-apple','App Store']].map(([icon,name]) => (
              <a key={name} href="#" className="flex items-center gap-2 bg-white/10 border border-white/20 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-white/20 transition-colors">
                <i className={icon} />{name}
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
