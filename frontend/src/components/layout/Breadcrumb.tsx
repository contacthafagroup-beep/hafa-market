import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

/* Map raw path segments to readable labels */
const LABELS: Record<string, string> = {
  products:  'Products',
  sellers:   'Sellers',
  blog:      'Blog',
  cart:      'Cart',
  checkout:  'Checkout',
  account:   'Account',
  orders:    'Orders',
  wishlist:  'Wishlist',
  wallet:    'Wallet',
  refunds:   'Refunds',
  addresses: 'Addresses',
  dashboard: 'Seller Dashboard',
  admin:     'Admin',
  users:     'Users',
  analytics: 'Analytics',
  login:     'Login',
  register:  'Register',
}

/* Pages where breadcrumb should NOT show */
const HIDDEN_ON = ['/', '/login', '/register', '/forgot-password']

export default function Breadcrumb() {
  const { pathname } = useLocation()

  if (HIDDEN_ON.includes(pathname)) return null

  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return null

  const crumbs = segments.map((seg, i) => ({
    label: LABELS[seg] ?? seg.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    path:  '/' + segments.slice(0, i + 1).join('/'),
  }))

  return (
    <nav aria-label="Breadcrumb" style={{ background: '#f9fafb', borderBottom: '1px solid #f3f4f6', padding: '8px 0' }}>
      <div className="max-w-[1240px] mx-auto px-6">
        <ol style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', listStyle: 'none', margin: 0, padding: 0 }}>
          {/* Home */}
          <li style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Link to="/" aria-label="Home"
              style={{ display: 'flex', alignItems: 'center', color: '#6b7280', transition: '.2s', textDecoration: 'none', fontSize: '.8rem' }}
              className="hover:text-[#2E7D32]">
              <Home size={13} />
            </Link>
          </li>

          {crumbs.map((crumb, i) => {
            const isLast = i === crumbs.length - 1
            return (
              <li key={crumb.path} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ChevronRight size={12} style={{ color: '#d1d5db', flexShrink: 0 }} />
                {isLast ? (
                  <span style={{ fontSize: '.8rem', fontWeight: 600, color: '#2E7D32' }} aria-current="page">
                    {crumb.label}
                  </span>
                ) : (
                  <Link to={crumb.path}
                    style={{ fontSize: '.8rem', color: '#6b7280', textDecoration: 'none', transition: '.2s' }}
                    className="hover:text-[#2E7D32]">
                    {crumb.label}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
