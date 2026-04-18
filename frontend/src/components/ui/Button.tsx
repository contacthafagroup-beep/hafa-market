import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import Spinner from './Spinner'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  size?:    'sm' | 'md' | 'lg'
  loading?: boolean
  fullWidth?: boolean
}

const Button = forwardRef<HTMLButtonElement, Props>(({
  variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...props
}, ref) => {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-green-primary text-white hover:bg-green-dark shadow-md hover:shadow-lg hover:-translate-y-0.5',
    outline: 'border-2 border-green-primary text-green-primary hover:bg-green-primary hover:text-white',
    ghost:   'text-gray-600 hover:bg-gray-100',
    danger:  'bg-red-500 text-white hover:bg-red-600',
  }
  const sizes = { sm: 'px-4 py-2 text-xs', md: 'px-6 py-3 text-sm', lg: 'px-8 py-4 text-base' }

  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : children}
    </button>
  )
})
Button.displayName = 'Button'
export default Button
