import api from '@/lib/api'
import type { User, ApiResponse } from '@/types'

export const authService = {
  register: (data: { name: string; email?: string; phone?: string; password: string; role?: string }) =>
    api.post<ApiResponse<{ user: User; accessToken: string }>>('/auth/register', data),

  login: (data: { email?: string; phone?: string; password: string }) =>
    api.post<ApiResponse<{ user: User; accessToken: string }>>('/auth/login', data),

  logout: () => api.post('/auth/logout'),

  getMe: () => api.get<ApiResponse<User>>('/auth/me'),

  refreshToken: () => api.post<ApiResponse<{ accessToken: string }>>('/auth/refresh'),

  sendOtp: (phone: string) => api.post('/auth/send-otp', { phone }),

  verifyOtp: (phone: string, code: string) => api.post('/auth/verify-otp', { phone, code }),

  forgotPassword: (data: { email?: string; phone?: string }) =>
    api.post('/auth/forgot-password', data),

  resetPassword: (data: { email?: string; phone?: string; code: string; newPassword: string }) =>
    api.post('/auth/reset-password', data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.patch('/auth/password', data),

  googleAuth: (data: { googleId: string; email: string; name: string; avatar?: string }) =>
    api.post<ApiResponse<{ user: User; accessToken: string }>>('/auth/google', data),
}
