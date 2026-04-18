import api from '@/lib/api'
import type { Product, ApiResponse, PaginatedResponse, ProductFilters, Review } from '@/types'

export const productService = {
  getProducts: (filters: ProductFilters = {}) =>
    api.get<PaginatedResponse<Product>>('/products', { params: filters }),

  getFeatured: () =>
    api.get<ApiResponse<Product[]>>('/products/featured'),

  getProduct: (slug: string) =>
    api.get<ApiResponse<Product>>(`/products/${slug}`),

  createProduct: (data: Partial<Product>) =>
    api.post<ApiResponse<Product>>('/products', data),

  updateProduct: (id: string, data: Partial<Product>) =>
    api.patch<ApiResponse<Product>>(`/products/${id}`, data),

  deleteProduct: (id: string) =>
    api.delete(`/products/${id}`),

  getVariants: (id: string) =>
    api.get(`/products/${id}/variants`),

  addVariant: (id: string, data: object) =>
    api.post(`/products/${id}/variants`, data),

  getReviews: (productId: string, page = 1) =>
    api.get<PaginatedResponse<Review>>(`/reviews/product/${productId}`, { params: { page } }),

  createReview: (data: { productId: string; rating: number; comment?: string; images?: string[] }) =>
    api.post<ApiResponse<Review>>('/reviews', data),

  getSimilar: (id: string) =>
    api.get<ApiResponse<Product[]>>(`/ai/similar/${id}`),
}
