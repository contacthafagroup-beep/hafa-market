const { z } = require('zod');

const password = z.string().min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

exports.registerSchema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters').max(100),
  email:    z.string().email('Invalid email address').optional(),
  phone:    z.string().regex(/^\+?[0-9]{9,15}$/, 'Invalid phone number').optional(),
  password: password.optional(),
  role:     z.enum(['BUYER', 'SELLER']).optional(),
}).refine(d => d.email || d.phone, { message: 'Email or phone number is required.' });

exports.loginSchema = z.object({
  email:    z.string().email().optional(),
  phone:    z.string().optional(),
  password: z.string().min(1, 'Password is required'),
}).refine(d => d.email || d.phone, { message: 'Email or phone is required.' });

exports.otpSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{9,15}$/, 'Invalid phone number'),
  type:  z.string().optional(),
});

exports.verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+?[0-9]{9,15}$/),
  code:  z.string().length(6, 'OTP must be 6 digits').regex(/^\d+$/),
});

exports.changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword:     password,
});
