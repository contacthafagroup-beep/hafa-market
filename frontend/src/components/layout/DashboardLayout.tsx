import { Outlet, Link, useLocation } from 'react-router-dom'
import { User, Package, Heart, Wallet, RotateCcw, MapPin, LayoutDashboard, ShoppingBag, BarChart2, Users, ShieldCheck, CreditCard, Shield, Tag, BookOpen, MessageCircle, Building2, AlertTriangle, Gift, Search, Megaphone, Zap, Truck, RefreshCw, Bell, Trophy, Layers, DollarSign, Image, Store, Calendar, QrCode, TrendingUp, UserX, Bot, WifiOff, Clock, Brain, Video, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

interface Props { type: 'account' | 'seller' | 'admin' }

const NAV = {
  account: [
    { to: '/account',           icon: <User size={18} />,          label: 'Profile' },
    { to: '/account/orders',    icon: <Package size={18} />,       label: 'My Orders' },
    { to: '/account/wishlist',  icon: <Heart size={18} />,         label: 'Wishlist' },
    { to: '/account/wallet',    icon: <Wallet size={18} />,        label: 'Wallet' },
    { to: '/account/refunds',   icon: <RotateCcw size={18} />,     label: 'Refunds' },
    { to: '/account/disputes',  icon: <AlertTriangle size={18} />, label: 'Disputes' },
    { to: '/account/referrals', icon: <Gift size={18} />,          label: 'Refer & Earn' },
    { to: '/account/subscriptions', icon: <RefreshCw size={18} />, label: 'Subscriptions' },
    { to: '/account/seasonal-alerts', icon: <Bell size={18} />,    label: 'Seasonal Alerts' },
    { to: '/account/affiliate',       icon: <Gift size={18} />,     label: 'Affiliate Program' },
    { to: '/account/bnpl',            icon: <CreditCard size={18} />, label: 'BNPL Plans' },
    { to: '/account/agent',           icon: <Bot size={18} />,        label: 'AI Agent' },
    { to: '/account/offline-orders',  icon: <WifiOff size={18} />,    label: 'Offline Orders' },
    { to: '/account/gift-cards',      icon: <Gift size={18} />,       label: 'Gift Cards' },
    { to: '/account/addresses', icon: <MapPin size={18} />,        label: 'Addresses' },
  ],
  seller: [
    { to: '/dashboard',             icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/dashboard/products',    icon: <ShoppingBag size={18} />,     label: 'My Products' },
    { to: '/dashboard/orders',      icon: <Package size={18} />,         label: 'Orders' },
    { to: '/dashboard/analytics',   icon: <BarChart2 size={18} />,       label: 'Analytics' },
    { to: '/dashboard/store-editor',icon: <Store size={18} />,           label: 'Store Editor' },
    { to: '/dashboard/bulk-prices', icon: <DollarSign size={18} />,      label: 'Bulk Prices' },
    { to: '/dashboard/promo-codes', icon: <Tag size={18} />,             label: 'Promo Codes' },
    { to: '/dashboard/returns',     icon: <RotateCcw size={18} />,       label: 'Returns' },
    { to: '/dashboard/fefo',        icon: <Calendar size={18} />,        label: 'FEFO Inventory' },
    { to: '/dashboard/ndr',         icon: <AlertTriangle size={18} />,   label: 'NDR Management' },
    { to: '/dashboard/traceability',icon: <QrCode size={18} />,          label: 'Traceability QR' },
    { to: '/dashboard/demand-forecast', icon: <TrendingUp size={18} />,  label: 'Demand Forecast' },
    { to: '/dashboard/sla',            icon: <Clock size={18} />,        label: 'SLA Monitoring' },
    { to: '/dashboard/crm',            icon: <Users size={18} />,        label: 'Buyer CRM' },
    { to: '/dashboard/pricing',        icon: <TrendingUp size={18} />,   label: 'Pricing Intel' },
    { to: '/dashboard/ai-copywriter',  icon: <Zap size={18} />,          label: 'AI Copywriter' },
    { to: '/dashboard/live-analytics', icon: <Video size={18} />,         label: 'Live Analytics' },
    { to: '/social/create',            icon: <Plus size={18} />,           label: 'Create Post' },
    { to: '/dashboard/ads',         icon: <Megaphone size={18} />,       label: 'Ads' },
    { to: '/dashboard/kyc',         icon: <ShieldCheck size={18} />,     label: 'KYC Verification' },
    { to: '/dashboard/cooperative', icon: <Users size={18} />,           label: 'Cooperative' },
    { to: '/dashboard/collections', icon: <Layers size={18} />,          label: 'Collections' },
    { to: '/dashboard/financing',   icon: <DollarSign size={18} />,      label: 'Financing' },
  ],
  admin: [
    { to: '/admin',                    icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
    { to: '/admin/users',              icon: <Users size={18} />,           label: 'Users' },
    { to: '/admin/products',           icon: <ShoppingBag size={18} />,     label: 'Products' },
    { to: '/admin/orders',             icon: <Package size={18} />,         label: 'Orders' },
    { to: '/admin/sellers',            icon: <ShieldCheck size={18} />,     label: 'Sellers' },
    { to: '/admin/refunds',            icon: <RotateCcw size={18} />,       label: 'Refunds' },
    { to: '/admin/bank-transfers',     icon: <CreditCard size={18} />,      label: 'Bank Transfers' },
    { to: '/admin/promo-codes',        icon: <Tag size={18} />,             label: 'Promo Codes' },
    { to: '/admin/blog',               icon: <BookOpen size={18} />,        label: 'Blog' },
    { to: '/admin/analytics',          icon: <BarChart2 size={18} />,       label: 'Analytics' },
    { to: '/admin/search-analytics',   icon: <Search size={18} />,          label: 'Search Intel' },
    { to: '/admin/live-chat',          icon: <MessageCircle size={18} />,   label: 'Live Chat' },
    { to: '/admin/bulk-orders',        icon: <Building2 size={18} />,       label: 'Bulk Orders' },
    { to: '/admin/flash-sales',        icon: <Zap size={18} />,             label: 'Flash Sales' },
    { to: '/admin/deliveries',         icon: <Truck size={18} />,           label: 'Deliveries' },
    { to: '/admin/payouts',            icon: <CreditCard size={18} />,      label: 'Payouts' },
    { to: '/admin/kyc',                icon: <ShieldCheck size={18} />,     label: 'KYC Queue' },
    { to: '/admin/audit-logs',         icon: <Shield size={18} />,          label: 'Audit Logs' },
    { to: '/admin/cache',              icon: <RefreshCw size={18} />,       label: 'Cache' },
    { to: '/admin/banners',            icon: <Image size={18} />,           label: 'Banners' },
    { to: '/admin/sentiment',          icon: <MessageCircle size={18} />,   label: 'Sentiment AI' },
    { to: '/admin/reviews',            icon: <Shield size={18} />,          label: 'Review Trust' },
    { to: '/admin/churn',              icon: <UserX size={18} />,           label: 'Churn Predictor' },
    { to: '/admin/intent-graph',       icon: <Brain size={18} />,           label: 'Intent Graph' },
  ],
}

const TITLES = { account: 'My Account', seller: 'Seller Dashboard', admin: 'Admin Panel' }

export default function DashboardLayout({ type }: Props) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const nav = NAV[type]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0 hidden md:block">
            <div className="bg-white rounded-2xl shadow-card overflow-hidden">
              <div className="bg-gradient-to-br from-green-dark to-green-primary p-5 text-white">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold mb-3">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
                <div className="font-bold">{user?.name}</div>
                <div className="text-xs text-white/70">{user?.email || user?.phone}</div>
              </div>
              <nav className="p-3">
                {nav.map(item => (
                  <Link key={item.to} to={item.to}
                    className={cn('flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 mb-1',
                      pathname === item.to ? 'bg-green-50 text-green-primary font-bold' : 'text-gray-600 hover:bg-gray-50')}>
                    <span className={pathname === item.to ? 'text-green-primary' : 'text-gray-400'}>{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 min-w-0">
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold text-gray-900">{TITLES[type]}</h1>
            </div>
            {/* Mobile nav */}
            <div className="md:hidden flex gap-2 overflow-x-auto scrollbar-hide mb-6 pb-1">
              {nav.map(item => (
                <Link key={item.to} to={item.to}
                  className={cn('flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
                    pathname === item.to ? 'bg-green-primary text-white' : 'bg-white text-gray-600 border border-gray-200')}>
                  {item.icon}{item.label}
                </Link>
              ))}
            </div>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
