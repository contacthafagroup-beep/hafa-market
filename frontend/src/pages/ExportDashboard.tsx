/**
 * ExportDashboard — /export/dashboard
 * Seller manages export listings, RFQs, orders
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Package, MessageSquare, TrendingUp, Plus, Eye, CheckCircle, Clock, Ship } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { useAuth } from '@/hooks/useAuth'

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-gray-100 text-gray-600',
  OPEN: 'bg-blue-100 text-blue-700',
  QUOTED: 'bg-amber-100 text-amber-700',
  CONVERTED: 'bg-green-100 text-green-700',
  DEPOSIT_PENDING: 'bg-orange-100 text-orange-700',
  IN_PRODUCTION: 'bg-purple-100 text-purple-700',
  SHIPPED: 'bg-teal-100 text-teal-700',
  DELIVERED: 'bg-green-100 text-green-700',
}

export default function ExportDashboard() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'listings' | 'rfqs' | 'orders'>('listings')

  const { data: listings = [], isLoading: loadingListings } = useQuery({
    queryKey: ['export-my-listings'],
    queryFn: () => api.get('/export/listings/seller/mine').then(r => r.data.data || []),
    enabled: !!user,
  })

  const { data: rfqs = [], isLoading: loadingRFQs } = useQuery({
    queryKey: ['export-rfqs'],
    queryFn: () => api.get('/export/rfq').then(r => r.data.data || []),
    enabled: !!user,
  })

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['export-orders'],
    queryFn: () => api.get('/export/orders').then(r => r.data.data || []),
    enabled: !!user,
  })

  const totalRevenue = orders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0)
  const openRFQs = rfqs.filter((r: any) => r.status === 'OPEN').length

  if (!user) return (
    <div className="text-center py-32">
      <p className="text-gray-500 mb-4">Please log in to access your export dashboard</p>
      <Link to="/login" className="bg-green-primary text-white px-6 py-2 rounded-xl font-bold">Login</Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Export Dashboard</h1>
            <p className="text-gray-500 text-sm mt-0.5">Manage your global export business</p>
          </div>
          <div className="flex gap-3">
            <Link to="/export/verify"
              className="flex items-center gap-2 border-2 border-green-primary text-green-primary px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-50 transition-colors">
              <CheckCircle size={14} /> Get Verified
            </Link>
            <Link to="/export/create"
              className="flex items-center gap-2 bg-green-primary text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-dark transition-colors">
              <Plus size={14} /> New Listing
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { icon: <Package size={20} />, label: 'Active Listings', value: listings.filter((l: any) => l.status === 'ACTIVE').length, color: 'text-green-primary' },
            { icon: <MessageSquare size={20} />, label: 'Open Inquiries', value: openRFQs, color: 'text-blue-500' },
            { icon: <Ship size={20} />, label: 'Total Orders', value: orders.length, color: 'text-purple-500' },
            { icon: <TrendingUp size={20} />, label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, color: 'text-amber-500' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl p-5 shadow-card">
              <div className={`${stat.color} mb-2`}>{stat.icon}</div>
              <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1 mb-6 w-fit">
          {(['listings', 'rfqs', 'orders'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-bold transition-all capitalize ${
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'rfqs' ? 'Inquiries' : t.charAt(0).toUpperCase() + t.slice(1)}
              {t === 'rfqs' && openRFQs > 0 && (
                <span className="ml-1.5 bg-blue-500 text-white text-[10px] font-black w-4 h-4 rounded-full inline-flex items-center justify-center">{openRFQs}</span>
              )}
            </button>
          ))}
        </div>

        {/* Listings tab */}
        {tab === 'listings' && (
          <div>
            {loadingListings ? (
              <div className="flex justify-center py-20"><Spinner size="lg" /></div>
            ) : listings.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl shadow-card">
                <Package size={48} className="mx-auto text-gray-200 mb-4" />
                <h3 className="font-bold text-gray-700 mb-2">No export listings yet</h3>
                <p className="text-gray-400 text-sm mb-6">Create your first listing to start receiving international inquiries</p>
                <Link to="/export/create" className="bg-green-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-green-dark transition-colors">
                  + Create First Listing
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map((listing: any) => (
                  <div key={listing.id} className="bg-white rounded-2xl p-5 shadow-card flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-green-50 flex items-center justify-center text-3xl flex-shrink-0 overflow-hidden">
                      {listing.images?.[0]
                        ? <img src={listing.images[0]} alt="" className="w-full h-full object-cover" />
                        : '📦'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-gray-900 truncate">{listing.title}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[listing.status] || 'bg-gray-100 text-gray-600'}`}>
                          {listing.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">{listing.category} · MOQ: {listing.moqQty} {listing.moqUnit}</p>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Eye size={11} /> {listing.views} views</span>
                        <span className="flex items-center gap-1"><MessageSquare size={11} /> {listing.inquiries} inquiries</span>
                        <span className="font-bold text-green-primary">${listing.pricePerUnit}/{listing.moqUnit}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Link to={`/export/listings/${listing.id}`}
                        className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* RFQs tab */}
        {tab === 'rfqs' && (
          <div>
            {loadingRFQs ? (
              <div className="flex justify-center py-20"><Spinner size="lg" /></div>
            ) : rfqs.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl shadow-card">
                <MessageSquare size={48} className="mx-auto text-gray-200 mb-4" />
                <h3 className="font-bold text-gray-700 mb-2">No inquiries yet</h3>
                <p className="text-gray-400 text-sm">Inquiries from buyers will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rfqs.map((rfq: any) => (
                  <Link key={rfq.id} to={`/export/negotiation/${rfq.id}`}
                    className="bg-white rounded-2xl p-5 shadow-card flex items-center gap-4 hover:shadow-card-hover transition-shadow block">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">
                      🌍
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-gray-900 truncate">{rfq.listingTitle || 'General Inquiry'}</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[rfq.status] || 'bg-gray-100 text-gray-600'}`}>
                          {rfq.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {rfq.buyerName} · {rfq.buyerCountry} · {rfq.quantity} {rfq.unit}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(rfq.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-xs text-green-primary font-bold flex-shrink-0">
                      Reply →
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Orders tab */}
        {tab === 'orders' && (
          <div>
            {loadingOrders ? (
              <div className="flex justify-center py-20"><Spinner size="lg" /></div>
            ) : orders.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl shadow-card">
                <Ship size={48} className="mx-auto text-gray-200 mb-4" />
                <h3 className="font-bold text-gray-700 mb-2">No export orders yet</h3>
                <p className="text-gray-400 text-sm">Orders will appear here after buyers accept your quotes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order: any) => (
                  <div key={order.id} className="bg-white rounded-2xl p-5 shadow-card">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">Order #{order.id.slice(-8).toUpperCase()}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
                          {order.status?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="font-extrabold text-green-primary">${order.totalAmount?.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-500">
                      <div><span className="font-semibold text-gray-700">Qty:</span> {order.quantity} {order.unit}</div>
                      <div><span className="font-semibold text-gray-700">Incoterms:</span> {order.incoterms}</div>
                      <div><span className="font-semibold text-gray-700">Deposit:</span> ${order.depositAmount?.toFixed(2)} {order.depositPaid ? '✅' : '⏳'}</div>
                      <div><span className="font-semibold text-gray-700">Balance:</span> ${order.balanceAmount?.toFixed(2)} {order.balancePaid ? '✅' : '⏳'}</div>
                    </div>
                    {order.trackingNumber && (
                      <p className="text-xs text-gray-400 mt-2">🚢 Tracking: {order.trackingNumber} · {order.shippingLine}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
