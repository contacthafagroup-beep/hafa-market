import api from '@/lib/api'
import type { Order, ApiResponse, PaginatedResponse, PaymentMethod } from '@/types'

export const orderService = {
  createOrder: (data: {
    addressId: string
    paymentMethod: PaymentMethod
    items: { productId: string; quantity: number }[]
    promoCode?: string
    notes?: string
  }) => api.post<ApiResponse<Order>>('/orders', data),

  getOrders: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<PaginatedResponse<Order>>('/orders', { params }),

  getOrder: (id: string) =>
    api.get<ApiResponse<Order>>(`/orders/${id}`),

  cancelOrder: (id: string, reason?: string) =>
    api.patch(`/orders/${id}/cancel`, { reason }),

  initiatePayment: (orderId: string, method: PaymentMethod) =>
    api.post('/payments/initiate', { orderId, method }),

  retryPayment: (orderId: string, method?: PaymentMethod) =>
    api.post('/payments/retry', { orderId, method }),

  getPaymentStatus: (orderId: string) =>
    api.get(`/payments/status/${orderId}`),

  chapaVerify: (txRef: string) =>
    api.get(`/payments/chapa/verify/${txRef}`),

  trackOrder: (trackingCode: string) =>
    api.get(`/delivery/track/${trackingCode}`),

  calculateDeliveryFee: (city: string, subtotal: number) =>
    api.post('/delivery/calculate-fee', { city, subtotal }),

  applyPromo: (code: string, subtotal: number) =>
    api.post('/orders/validate-promo', { code, subtotal }),
}
