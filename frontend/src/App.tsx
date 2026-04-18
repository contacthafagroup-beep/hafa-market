import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Suspense, lazy, useState, useEffect } from 'react'
import Layout from '@/components/layout/Layout'
import AuthLayout from '@/components/layout/AuthLayout'
import DashboardLayout from '@/components/layout/DashboardLayout'
import LoadingScreen from '@/components/ui/LoadingScreen'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import SellerRoute from '@/components/auth/SellerRoute'
import AdminRoute from '@/components/auth/AdminRoute'
import WelcomeOnboarding from '@/components/ui/WelcomeOnboarding'
import TelegramWebAppProvider from '@/components/TelegramWebAppProvider'
import { analytics } from '@/lib/analytics'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'

// Lazy-loaded pages
const Home          = lazy(() => import('@/pages/Home'))
const Products      = lazy(() => import('@/pages/Products'))
const ProductDetail = lazy(() => import('@/pages/ProductDetail'))
const Cart          = lazy(() => import('@/pages/Cart'))
const Checkout      = lazy(() => import('@/pages/Checkout'))
const OrderSuccess  = lazy(() => import('@/pages/OrderSuccess'))
const TrackOrder    = lazy(() => import('@/pages/TrackOrder'))
const Login         = lazy(() => import('@/pages/auth/Login'))
const Register      = lazy(() => import('@/pages/auth/Register'))
const ForgotPassword= lazy(() => import('@/pages/auth/ForgotPassword'))
const DeliveryAgent  = lazy(() => import('@/pages/DeliveryAgent'))
const MagicCallback = lazy(() => import('@/pages/auth/MagicCallback'))
const Account       = lazy(() => import('@/pages/account/Account'))
const Orders        = lazy(() => import('@/pages/account/Orders'))
const OrderDetail   = lazy(() => import('@/pages/account/OrderDetail'))
const Wishlist      = lazy(() => import('@/pages/account/Wishlist'))
const Wallet        = lazy(() => import('@/pages/account/Wallet'))
const Refunds       = lazy(() => import('@/pages/account/Refunds'))
const Addresses     = lazy(() => import('@/pages/account/Addresses'))
const Disputes      = lazy(() => import('@/pages/account/Disputes'))
const Referrals     = lazy(() => import('@/pages/account/Referrals'))
const Subscriptions = lazy(() => import('@/pages/account/Subscriptions'))
const SeasonalAlerts = lazy(() => import('@/pages/account/SeasonalAlerts'))
const Affiliate     = lazy(() => import('@/pages/account/Affiliate'))
const BNPLPlans     = lazy(() => import('@/pages/account/BNPLPlans'))
const SellerStore   = lazy(() => import('@/pages/SellerStore'))
const SellerDashboard = lazy(() => import('@/pages/seller/Dashboard'))
const SellerProducts  = lazy(() => import('@/pages/seller/Products'))
const SellerOrders    = lazy(() => import('@/pages/seller/Orders'))
const SellerAnalytics = lazy(() => import('@/pages/seller/Analytics'))
const AdminDashboard  = lazy(() => import('@/pages/admin/Dashboard'))
const AdminUsers      = lazy(() => import('@/pages/admin/Users'))
const AdminProducts   = lazy(() => import('@/pages/admin/Products'))
const AdminOrders     = lazy(() => import('@/pages/admin/Orders'))
const AdminSellers    = lazy(() => import('@/pages/admin/Sellers'))
const AdminRefunds    = lazy(() => import('@/pages/admin/Refunds'))
const AdminBankTransfers = lazy(() => import('@/pages/admin/BankTransfers'))
const AdminAuditLogs     = lazy(() => import('@/pages/admin/AuditLogs'))
const AdminPromoCodes    = lazy(() => import('@/pages/admin/PromoCodes'))
const AdminBlog          = lazy(() => import('@/pages/admin/Blog'))
const AdminAnalytics     = lazy(() => import('@/pages/admin/Analytics'))
const AdminLiveChat      = lazy(() => import('@/pages/admin/LiveChat'))
const AdminSearchAnalytics = lazy(() => import('@/pages/admin/SearchAnalytics'))
const AdminBulkOrders    = lazy(() => import('@/pages/admin/BulkOrders'))
const AdminFlashSales    = lazy(() => import('@/pages/admin/FlashSales'))
const AdminDeliveries    = lazy(() => import('@/pages/admin/Deliveries'))
const AdminPayouts       = lazy(() => import('@/pages/admin/Payouts'))
const SellerAds          = lazy(() => import('@/pages/seller/Ads'))
const SellerKYC          = lazy(() => import('@/pages/seller/KYC'))
const SellerCooperative  = lazy(() => import('@/pages/seller/Cooperative'))
const SellerCollections  = lazy(() => import('@/pages/seller/Collections'))
const SellerFinancing    = lazy(() => import('@/pages/seller/Financing'))
const SellerStoreEditor  = lazy(() => import('@/pages/seller/StoreEditor'))
const SellerBulkPrice    = lazy(() => import('@/pages/seller/BulkPriceEditor'))
const SellerPromoCodes   = lazy(() => import('@/pages/seller/PromoCodes'))
const SellerReturns      = lazy(() => import('@/pages/seller/Returns'))
const SellerFEFO         = lazy(() => import('@/pages/seller/FEFOInventory'))
const SellerNDR          = lazy(() => import('@/pages/seller/NDRManagement'))
const SellerTraceQR      = lazy(() => import('@/pages/seller/TraceabilityQR'))
const SellerDemandForecast = lazy(() => import('@/pages/seller/DemandForecast'))
const MandiPrices        = lazy(() => import('@/pages/MandiPrices'))
const SeasonalityForecast = lazy(() => import('@/pages/SeasonalityForecast'))
const AdminSentiment     = lazy(() => import('@/pages/admin/SentimentAnalysis'))
const AdminReviews       = lazy(() => import('@/pages/admin/ReviewModeration'))
const AdminChurn         = lazy(() => import('@/pages/admin/ChurnPredictor'))
const AdminIntentGraph   = lazy(() => import('@/pages/admin/IntentGraph'))
// B2B Pages
const RFQWorkspace       = lazy(() => import('@/pages/b2b/RFQWorkspace'))
const QuickOrderGrid     = lazy(() => import('@/pages/b2b/QuickOrderGrid'))
const PurchaseOrders     = lazy(() => import('@/pages/b2b/PurchaseOrders'))
const ApprovalChains     = lazy(() => import('@/pages/b2b/ApprovalChains'))
const Net30Credit        = lazy(() => import('@/pages/b2b/Net30Credit'))
const VolumePricing      = lazy(() => import('@/pages/b2b/VolumePricing'))
const CreditTerms        = lazy(() => import('@/pages/b2b/CreditTerms'))
// Phase 6
const OfflineOrders      = lazy(() => import('@/pages/account/OfflineOrders'))
const AgentShopping      = lazy(() => import('@/pages/account/AgentShopping'))
const GiftCards          = lazy(() => import('@/pages/account/GiftCards'))
// Missing features
const SellerSLA          = lazy(() => import('@/pages/seller/SLAMonitoring'))
const SellerCRM          = lazy(() => import('@/pages/seller/BuyerCRM'))
const SellerPricing      = lazy(() => import('@/pages/seller/PricingIntelligence'))
const SellerCopywriter   = lazy(() => import('@/pages/seller/AICopywriter'))
const SellerLiveAnalytics = lazy(() => import('@/pages/seller/LiveAnalytics'))
const AdminKYC           = lazy(() => import('@/pages/admin/KYC'))
const AdminCache         = lazy(() => import('@/pages/admin/Cache'))
const AdminBanners       = lazy(() => import('@/pages/admin/Banners'))
const BulkOrder          = lazy(() => import('@/pages/BulkOrder'))
const Compare            = lazy(() => import('@/pages/Compare'))
const Leaderboard        = lazy(() => import('@/pages/Leaderboard'))
const LiveCommerce       = lazy(() => import('@/pages/LiveCommerce'))
const LiveMarketHome     = lazy(() => import('@/pages/LiveMarketHome'))
const LiveMarket         = lazy(() => import('@/pages/LiveMarket'))
const SocialFeedPage     = lazy(() => import('@/pages/SocialFeedPage'))
const CreatePost         = lazy(() => import('@/pages/CreatePost'))
const FarmerDirect       = lazy(() => import('@/pages/FarmerDirect'))
const Forum              = lazy(() => import('@/pages/Forum'))
const ForumPost          = lazy(() => import('@/pages/ForumPost'))
const PickupStations     = lazy(() => import('@/pages/PickupStations'))
const SharedWishlist     = lazy(() => import('@/pages/SharedWishlist'))
const Bundles            = lazy(() => import('@/pages/Bundles'))
const Blog                = lazy(() => import('@/pages/Blog'))
const BlogPost            = lazy(() => import('@/pages/BlogPost'))
const ExportMarketplace   = lazy(() => import('@/pages/ExportMarketplace'))
const ExportListingDetail = lazy(() => import('@/pages/ExportListingDetail'))
const ExportRFQForm       = lazy(() => import('@/pages/ExportRFQForm'))
const ExportNegotiation   = lazy(() => import('@/pages/ExportNegotiation'))
const ExportDashboard     = lazy(() => import('@/pages/ExportDashboard'))
const ExportVerify        = lazy(() => import('@/pages/ExportVerify'))
const CreateExportListing = lazy(() => import('@/pages/CreateExportListing'))
const NotFound            = lazy(() => import('@/pages/NotFound'))

export default function App() {
  const user = useSelector((s: RootState) => s.auth.user)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const location = useLocation()

  useEffect(() => {
    analytics.pageView(location.pathname)
  }, [location.pathname])

  // Feature 11: Affiliate tracking — capture ?ref= param
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const refCode = params.get('ref')
    if (refCode) {
      // Backend GET /features/affiliate/track/:code increments click count
      // Use a silent fetch (GET) to avoid redirect
      fetch(`${import.meta.env.VITE_API_URL}/features/affiliate/track/${refCode}`, {
        method: 'GET', redirect: 'manual',
      }).catch(() => {})
      // Store for attribution
      sessionStorage.setItem('hafa_ref', refCode)

      // Also track as share link click (social commerce)
      fetch(`${import.meta.env.VITE_API_URL}/social/share/click/${refCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {})
    }
  }, [location.search])

  useEffect(() => {
    if (!user || user.role === 'ADMIN') return
    // Only show for brand-new registrations — flag set by Register page
    const isNew = localStorage.getItem('hafa_new_user')
    if (isNew) {
      localStorage.removeItem('hafa_new_user') // consume it — won't show again
      setShowOnboarding(true)
    }
  }, [user?.id, user?.role])

  return (
    <>
      <TelegramWebAppProvider />
      {showOnboarding && user && (
        <WelcomeOnboarding
          userName={user.name}
          onDone={() => setShowOnboarding(false)}
        />
      )}
      <Suspense fallback={<LoadingScreen />}>
      <Routes>
        {/* Public routes with main layout */}
        <Route element={<Layout />}>
          <Route path="/"                  element={<Home />} />
          <Route path="/products"          element={<Products />} />
          <Route path="/products/:slug"    element={<ProductDetail />} />
          <Route path="/sellers/:slug"     element={<SellerStore />} />
          <Route path="/compare"           element={<Compare />} />
          <Route path="/leaderboard"       element={<Leaderboard />} />
          <Route path="/live"              element={<LiveMarketHome />} />
          <Route path="/live/:id"          element={<LiveMarket />} />
          <Route path="/social"            element={<SocialFeedPage />} />
          <Route path="/social/create"     element={<SellerRoute><CreatePost /></SellerRoute>} />
          <Route path="/farmer-direct"     element={<FarmerDirect />} />
          <Route path="/forum"             element={<Forum />} />
          <Route path="/forum/:id"         element={<ForumPost />} />
          <Route path="/pickup-stations"   element={<PickupStations />} />
          <Route path="/wishlist/:token"   element={<SharedWishlist />} />
          <Route path="/bundles"           element={<Bundles />} />
          <Route path="/mandi-prices"      element={<MandiPrices />} />
          <Route path="/seasonality"       element={<SeasonalityForecast />} />
          <Route path="/rfq"               element={<ProtectedRoute><RFQWorkspace /></ProtectedRoute>} />
          <Route path="/quick-order"       element={<QuickOrderGrid />} />
          <Route path="/purchase-orders"   element={<ProtectedRoute><PurchaseOrders /></ProtectedRoute>} />
          <Route path="/approval-chains"   element={<ProtectedRoute><ApprovalChains /></ProtectedRoute>} />
          <Route path="/net30"             element={<ProtectedRoute><Net30Credit /></ProtectedRoute>} />
          <Route path="/credit-terms"      element={<ProtectedRoute><CreditTerms /></ProtectedRoute>} />
          <Route path="/volume-pricing"    element={<VolumePricing />} />
          <Route path="/track/:trackingCode" element={<TrackOrder />} />
          <Route path="/blog"              element={<Blog />} />
          <Route path="/blog/:slug"        element={<BlogPost />} />
          <Route path="/order/success"     element={<OrderSuccess />} />
          <Route path="/bulk-order"        element={<BulkOrder />} />
          <Route path="/delivery"          element={<ProtectedRoute><DeliveryAgent /></ProtectedRoute>} />
          {/* Export Marketplace */}
          <Route path="/export"                        element={<ExportMarketplace />} />
          <Route path="/export/listings/:id"           element={<ExportListingDetail />} />
          <Route path="/export/rfq"                    element={<ExportRFQForm />} />
          <Route path="/export/negotiation/:rfqId"     element={<ProtectedRoute><ExportNegotiation /></ProtectedRoute>} />
          <Route path="/export/dashboard"              element={<ProtectedRoute><ExportDashboard /></ProtectedRoute>} />
          <Route path="/export/verify"                 element={<ProtectedRoute><ExportVerify /></ProtectedRoute>} />
          <Route path="/export/create"                 element={<SellerRoute><CreateExportListing /></SellerRoute>} />
        </Route>

        {/* Cart & Checkout */}
        <Route element={<Layout />}>
          <Route path="/cart"              element={<Cart />} />
          <Route path="/checkout"          element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        </Route>

        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login"             element={<Login />} />
          <Route path="/register"          element={<Register />} />
          <Route path="/forgot-password"   element={<ForgotPassword />} />
          <Route path="/auth/magic/callback" element={<MagicCallback />} />
        </Route>

        {/* Account routes */}
        <Route path="/account" element={<ProtectedRoute><DashboardLayout type="account" /></ProtectedRoute>}>
          <Route index                     element={<Account />} />
          <Route path="orders"             element={<Orders />} />
          <Route path="orders/:id"         element={<OrderDetail />} />
          <Route path="wishlist"           element={<Wishlist />} />
          <Route path="wallet"             element={<Wallet />} />
          <Route path="refunds"            element={<Refunds />} />
          <Route path="addresses"          element={<Addresses />} />
          <Route path="disputes"           element={<Disputes />} />
          <Route path="referrals"          element={<Referrals />} />
          <Route path="subscriptions"      element={<Subscriptions />} />
          <Route path="seasonal-alerts"    element={<SeasonalAlerts />} />
          <Route path="affiliate"          element={<Affiliate />} />
          <Route path="bnpl"               element={<BNPLPlans />} />
          <Route path="offline-orders"     element={<OfflineOrders />} />
          <Route path="agent"              element={<AgentShopping />} />
          <Route path="gift-cards"         element={<GiftCards />} />
        </Route>

        {/* Seller dashboard */}
        <Route path="/dashboard" element={<SellerRoute><DashboardLayout type="seller" /></SellerRoute>}>
          <Route index                     element={<SellerDashboard />} />
          <Route path="products"           element={<SellerProducts />} />
          <Route path="orders"             element={<SellerOrders />} />
          <Route path="analytics"          element={<SellerAnalytics />} />
          <Route path="ads"                element={<SellerAds />} />
          <Route path="kyc"                element={<SellerKYC />} />
          <Route path="cooperative"        element={<SellerCooperative />} />
          <Route path="collections"        element={<SellerCollections />} />
          <Route path="financing"          element={<SellerFinancing />} />
          <Route path="store-editor"       element={<SellerStoreEditor />} />
          <Route path="bulk-prices"        element={<SellerBulkPrice />} />
          <Route path="promo-codes"        element={<SellerPromoCodes />} />
          <Route path="returns"            element={<SellerReturns />} />
          <Route path="fefo"               element={<SellerFEFO />} />
          <Route path="ndr"                element={<SellerNDR />} />
          <Route path="traceability"       element={<SellerTraceQR />} />
          <Route path="demand-forecast"    element={<SellerDemandForecast />} />
          <Route path="sla"                element={<SellerSLA />} />
          <Route path="crm"                element={<SellerCRM />} />
          <Route path="pricing"            element={<SellerPricing />} />
          <Route path="ai-copywriter"      element={<SellerCopywriter />} />
          <Route path="live-analytics"     element={<SellerLiveAnalytics />} />
        </Route>

        {/* Admin panel */}
        <Route path="/admin" element={<AdminRoute><DashboardLayout type="admin" /></AdminRoute>}>
          <Route index                     element={<AdminDashboard />} />
          <Route path="users"              element={<AdminUsers />} />
          <Route path="products"           element={<AdminProducts />} />
          <Route path="orders"             element={<AdminOrders />} />
          <Route path="sellers"            element={<AdminSellers />} />
          <Route path="refunds"            element={<AdminRefunds />} />
          <Route path="bank-transfers"     element={<AdminBankTransfers />} />
          <Route path="audit-logs"         element={<AdminAuditLogs />} />
          <Route path="promo-codes"        element={<AdminPromoCodes />} />
          <Route path="blog"               element={<AdminBlog />} />
          <Route path="analytics"          element={<AdminAnalytics />} />
          <Route path="search-analytics"   element={<AdminSearchAnalytics />} />
          <Route path="live-chat"          element={<AdminLiveChat />} />
          <Route path="bulk-orders"        element={<AdminBulkOrders />} />
          <Route path="flash-sales"        element={<AdminFlashSales />} />
          <Route path="deliveries"         element={<AdminDeliveries />} />
          <Route path="payouts"            element={<AdminPayouts />} />
          <Route path="kyc"                element={<AdminKYC />} />
          <Route path="cache"              element={<AdminCache />} />
          <Route path="banners"            element={<AdminBanners />} />
          <Route path="sentiment"          element={<AdminSentiment />} />
          <Route path="reviews"            element={<AdminReviews />} />
          <Route path="churn"              element={<AdminChurn />} />
          <Route path="intent-graph"       element={<AdminIntentGraph />} />
        </Route>

        <Route path="/404"               element={<NotFound />} />
        <Route path="*"                  element={<Navigate to="/404" replace />} />
      </Routes>
    </Suspense>
    </>
  )
}
