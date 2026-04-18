import { Send } from 'lucide-react'
import { useTelegram } from '@/hooks/useTelegram'

interface Props {
  productName: string
  productSlug: string
  className?: string
}

export default function TelegramShareButton({ productName, productSlug, className }: Props) {
  const { isInTelegram, shareProduct } = useTelegram()

  if (!isInTelegram) return null

  const url = `https://hafamarket.com/products/${productSlug}`

  return (
    <button
      onClick={() => shareProduct(productName, url)}
      className={className}
      style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        background: '#0088cc', color: '#fff',
        border: 'none', borderRadius: '50px',
        padding: '8px 16px', fontSize: '.82rem', fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'background .2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#0077b5')}
      onMouseLeave={e => (e.currentTarget.style.background = '#0088cc')}
    >
      <Send size={14} />
      Share on Telegram
    </button>
  )
}
