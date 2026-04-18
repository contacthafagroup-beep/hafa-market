import { Link, useLocation } from 'react-router-dom'
import { Home, Search, ShoppingCart, Package, User } from 'lucide-react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/',               icon: Home,         label: 'Home' },
  { to: '/products',       icon: Search,       label: 'Search' },
  { to: '/cart',           icon: ShoppingCart, label: 'Cart',   badge: true },
  { to: '/account/orders', icon: Package,      label: 'Orders' },
  { to: '/account',        icon: User,         label: 'Account' },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const cartCount = useSelector((s: RootState) => s.cart?.items?.reduce((sum: number, i: any) => sum + i.quantity, 0) || 0)

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-[999] bg-white border-t border-gray-100 safe-area-pb"
      style={{ boxShadow: '0 -4px 20px rgba(0,0,0,.06)' }}>
      <div className="flex items-center justify-around h-16 px-2">
        {TABS.map(({ to, icon: Icon, label, badge }) => {
          const active = pathname === to || (to !== '/' && pathname.startsWith(to))
          return (
            <Link key={to} to={to}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-all',
                active ? 'text-green-primary' : 'text-gray-400'
              )}>
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                {badge && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px] font-semibold leading-none', active ? 'text-green-primary' : 'text-gray-400')}>
                {label}
              </span>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-green-primary rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
