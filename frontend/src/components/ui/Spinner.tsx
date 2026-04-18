import { cn } from '@/lib/utils'

interface Props { size?: 'sm' | 'md' | 'lg'; className?: string }

export default function Spinner({ size = 'md', className }: Props) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }
  return (
    <div className={cn('animate-spin rounded-full border-2 border-gray-200 border-t-green-primary', sizes[size], className)} />
  )
}
