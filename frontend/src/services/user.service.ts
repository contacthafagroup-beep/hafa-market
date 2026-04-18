import api from '@/lib/api'
import type { Address, ApiResponse, Notification, Wallet } from '@/types'

export const userService = {
  getProfile:    () => api.get('/users/profile'),
  updateProfile: (data: object) => api.patch('/users/profile', data),

  getAddresses:     () => api.get<ApiResponse<Address[]>>('/users/addresses'),
  addAddress:       (data: Omit<Address, 'id'>) => api.post<ApiResponse<Address>>('/users/addresses', data),
  updateAddress:    (id: string, data: Partial<Address>) => api.patch(`/users/addresses/${id}`, data),
  deleteAddress:    (id: string) => api.delete(`/users/addresses/${id}`),
  setDefaultAddress:(id: string) => api.patch(`/users/addresses/${id}/default`),

  getWishlist:      () => api.get('/users/wishlist'),
  toggleWishlist:   (productId: string) => api.post('/users/wishlist/toggle', { productId }),

  getLoyaltyPoints: () => api.get('/users/loyalty'),

  getNotifications: (page = 1) => api.get<ApiResponse<Notification[]>>('/users/notifications', { params: { page } }),
  markAllRead:      () => api.patch('/users/notifications/read-all'),

  getWallet:        () => api.get<ApiResponse<Wallet>>('/refunds/wallet'),
  payWithWallet:    (orderId: string) => api.post('/refunds/wallet/pay', { orderId }),

  requestRefund:    (data: { orderId: string; reason: string; amount?: number }) =>
    api.post('/refunds/request', data),
  getMyRefunds:     () => api.get('/refunds/my'),
}
