// ===== USER =====
export interface User {
  id: string
  name: string
  email?: string
  phone?: string
  avatar?: string
  role: 'BUYER' | 'SELLER' | 'ADMIN' | 'DELIVERY_AGENT'
  isVerified: boolean
  language: string
  loyaltyPoints: number
  seller?: { id: string; storeName: string; storeSlug: string; status: string }
  createdAt: string
}

// ===== CATEGORY =====
export interface Category {
  id: string
  name: string
  nameAm?: string
  nameOm?: string
  slug: string
  emoji?: string
  image?: string
  parentId?: string
  children?: Category[]
  sortOrder: number
}

// ===== PRODUCT =====
export interface Product {
  id: string
  name: string
  nameAm?: string
  slug: string
  description?: string
  price: number
  comparePrice?: number
  unit: string
  minOrder: number
  stock: number
  images: string[]
  tags: string[]
  isOrganic: boolean
  isFeatured: boolean
  status: 'ACTIVE' | 'INACTIVE' | 'OUT_OF_STOCK' | 'PENDING_REVIEW'
  rating: number
  reviewCount: number
  soldCount: number
  seller: { id: string; storeName: string; storeSlug: string; rating: number; city?: string }
  category: { id: string; name: string; slug: string; emoji?: string }
  variants?: ProductVariant[]
}

export interface ProductVariant {
  id: string
  name: string
  value: string
  priceAdjust: number
  stock: number
  sku?: string
}

// ===== CART =====
export interface CartItem {
  id: string
  productId: string
  quantity: number
  product: Product
}

// ===== ORDER =====
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'REFUNDED'
export type PaymentMethod = 'MPESA' | 'CARD' | 'FLUTTERWAVE' | 'CHAPA' | 'CASH_ON_DELIVERY' | 'PAYMENT_ON_DELIVERY' | 'PAYPAL' | 'TELEBIRR' | 'CBE_BIRR' | 'BANK_TRANSFER' | 'CHAPA_BANK'
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED'

export interface Order {
  id: string
  status: OrderStatus
  subtotal: number
  deliveryFee: number
  discount: number
  total: number
  promoCode?: string
  notes?: string
  createdAt: string
  deliveredAt?: string
  items: OrderItem[]
  payment?: Payment
  delivery?: Delivery
  address?: Address
  statusHistory?: StatusHistory[]
}

export interface OrderItem {
  id: string
  productName: string
  productImg?: string
  quantity: number
  unitPrice: number
  totalPrice: number
  unit: string
  productId: string
}

export interface Payment {
  id: string
  status: PaymentStatus
  method: PaymentMethod
  amount: number
  currency: string
  paidAt?: string
  transactionId?: string
  chapaRef?: string
  mpesaCode?: string
  failureReason?: string
  canRetry?: boolean
  expiresAt?: string
}

export interface Delivery {
  id: string
  status: string
  trackingCode?: string
  currentLat?: number
  currentLng?: number
  estimatedAt?: string
}

export interface StatusHistory {
  id: string
  status: OrderStatus
  note?: string
  createdAt: string
}

// ===== ADDRESS =====
export interface Address {
  id: string
  label: string
  fullName: string
  phone: string
  street: string
  city: string
  region: string
  country: string
  postalCode?: string
  latitude?: number
  longitude?: number
  isDefault: boolean
}

// ===== SELLER =====
export interface Seller {
  id: string
  storeName: string
  storeSlug: string
  description?: string
  logo?: string
  coverImage?: string
  city?: string
  country: string
  status: 'PENDING' | 'VERIFIED' | 'SUSPENDED'
  rating: number
  totalSales: number
  totalRevenue: number
  user?: { name: string; avatar?: string }
  products?: Product[]
}

// ===== REVIEW =====
export interface Review {
  id: string
  rating: number
  comment?: string
  images: string[]
  isVerified: boolean
  createdAt: string
  user: { id: string; name: string; avatar?: string }
}

// ===== NOTIFICATION =====
export interface Notification {
  id: string
  type: string
  title: string
  body: string
  isRead: boolean
  data?: Record<string, unknown>
  createdAt: string
}

// ===== WALLET =====
export interface Wallet {
  id: string
  balance: number
  currency: string
  transactions: WalletTransaction[]
}

export interface WalletTransaction {
  id: string
  type: 'CREDIT' | 'DEBIT'
  amount: number
  balance: number
  description: string
  createdAt: string
}

// ===== REFUND =====
export interface Refund {
  id: string
  orderId: string
  amount: number
  reason: string
  status: 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED'
  method: string
  walletCredited: boolean
  notes?: string
  createdAt: string
}

// ===== API RESPONSE =====
export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: { page: number; limit: number; total: number; pages: number }
}

// ===== FILTERS =====
export interface ProductFilters {
  category?: string
  search?: string
  minPrice?: number
  maxPrice?: number
  sort?: 'createdAt' | 'price' | 'rating' | 'soldCount'
  order?: 'asc' | 'desc'
  isOrganic?: boolean
  page?: number
  limit?: number
}
