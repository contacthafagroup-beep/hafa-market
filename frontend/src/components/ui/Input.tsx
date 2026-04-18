import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?:   string
  error?:   string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

const Input = forwardRef<HTMLInputElement, Props>(({ label, error, leftIcon, rightIcon, className, ...props }, ref) => (
  <div className="w-full">
    {label && <label className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>}
    <div className="relative">
      {leftIcon  && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{leftIcon}</span>}
      <input
        ref={ref}
        className={cn(
          'w-full px-4 py-3 border-2 rounded-xl text-sm font-medium outline-none transition-all duration-200',
          'border-gray-200 focus:border-green-primary focus:ring-4 focus:ring-green-50',
          error && 'border-red-400 focus:border-red-400 focus:ring-red-50',
          leftIcon  && 'pl-10',
          rightIcon && 'pr-10',
          className,
        )}
        {...props}
      />
      {rightIcon && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{rightIcon}</span>}
    </div>
    {error && <p className="mt-1 text-xs text-red-500 font-medium">{error}</p>}
  </div>
))
Input.displayName = 'Input'
export default Input
