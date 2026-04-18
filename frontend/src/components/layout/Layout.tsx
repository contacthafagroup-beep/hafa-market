import { Outlet, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Header from './Header'
import Footer from './Footer'
import Breadcrumb from './Breadcrumb'
import BottomNav from './BottomNav'
import FlashSaleBar from '@/components/ui/FlashSaleBar'
import CartSidebar from '@/components/cart/CartSidebar'
import BackToTop from '@/components/ui/BackToTop'
import CommandPalette from '@/components/ui/CommandPalette'
import AIAssistant from '@/components/ui/AIAssistant'
import SupportLauncher from '@/components/ui/SupportLauncher'
import { useOffline } from '@/hooks/useOffline'
import { Link } from 'react-router-dom'
import { ShoppingCart, X } from 'lucide-react'

export default function Layout() {
  const [cmdOpen, setCmdOpen] = useState(false)
  const [showRecovered, setShowRecovered] = useState(false)
  const isOffline = useOffline()
  const location = useLocation()

  // Feature 1: Abandoned cart recovery banner
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('recovered') === '1') {
      setShowRecovered(true)
    }
  }, [location.search])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Listen for SW sync messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'SYNC_OFFLINE_ORDERS') {
        // Trigger sync from OfflineOrders page if user is there
        window.dispatchEvent(new CustomEvent('hafa:sync-offline'))
      }
    }
    navigator.serviceWorker?.addEventListener('message', handler)
    return () => navigator.serviceWorker?.removeEventListener('message', handler)
  }, [])
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'default') return
    const asked = localStorage.getItem('hafa_notif_asked')
    if (asked) return
    const timer = setTimeout(async () => {
      localStorage.setItem('hafa_notif_asked', '1')
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        new Notification('🌿 Hafa Market', {
          body: 'You\'ll now get order updates and deals!',
          icon: '/favicon.svg',
        })
      }
    }, 60000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      {isOffline && (
        <div style={{ background: '#374151', color: '#fff', textAlign: 'center', padding: '8px', fontSize: '.82rem', fontWeight: 600, position: 'sticky', top: 0, zIndex: 9999 }}>
          📡 You're offline — showing cached content
        </div>
      )}
      {/* Feature 1: Recovered cart banner */}
      {showRecovered && (
        <div className="bg-orange-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 sticky top-0 z-[9998]">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart size={16} />
            <span>You left items in your cart! Complete your order before they sell out.</span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link to="/cart" className="bg-white text-orange-600 text-xs font-bold px-3 py-1 rounded-full hover:bg-orange-50 transition-colors">
              View Cart →
            </Link>
            <button onClick={() => setShowRecovered(false)} className="text-white/80 hover:text-white">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      <Header onOpenCmd={() => setCmdOpen(true)} />
      <FlashSaleBar />
      <Breadcrumb />
      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>
      <Footer className="hidden md:block" />
      <BottomNav />
      <CartSidebar />
      <BackToTop />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <AIAssistant />
      <SupportLauncher />
    </div>
  )
}
