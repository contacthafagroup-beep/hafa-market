import { X, ShoppingCart, Trash2, Plus, Minus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useCart } from '@/hooks/useCart'
import { useAuth } from '@/hooks/useAuth'
import { formatPrice } from '@/lib/utils'
import Button from '@/components/ui/Button'
import { useEffect } from 'react'
import api from '@/lib/api'
import { useDispatch } from 'react-redux'
import { syncFromServer } from '@/store/slices/cartSlice'

function CartContent() {
  const { items, total, isOpen, close, remove, updateQty } = useCart()
  const { user, isAuthenticated } = useAuth()
  const dispatch = useDispatch()

  /* ── Sync cart with server when user logs in ── */
  useEffect(() => {
    if (!isAuthenticated || !user) return
    api.get('/cart').then(res => {
      const serverItems = res.data.data
      if (serverItems?.length > 0) {
        dispatch(syncFromServer(serverItems.map((i: any) => ({
          id: i.id,
          productId: i.productId,
          product: i.product,
          quantity: i.quantity,
        }))))
      }
    }).catch(() => {})
  }, [isAuthenticated, user?.id])

  /* Prevent body scroll when open */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        onClick={close}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 99998,
        }}
      />

      {/* Sidebar */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        maxWidth: '420px',
        background: '#fff',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 40px rgba(0,0,0,0.18)',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          borderBottom: '1px solid #f3f4f6',
          flexShrink: 0,
          background: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingCart size={20} color="#2E7D32" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#111827', margin: 0 }}>My Cart</h2>
            {items.length > 0 && (
              <span style={{
                background: '#dcfce7',
                color: '#2E7D32',
                fontSize: '.75rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '50px',
              }}>
                {items.length}
              </span>
            )}
          </div>
          <button
            onClick={close}
            style={{
              padding: '8px',
              borderRadius: '50%',
              border: 'none',
              background: '#f3f4f6',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background .2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#e5e7eb')}
            onMouseLeave={e => (e.currentTarget.style.background = '#f3f4f6')}
          >
            <X size={18} color="#374151" />
          </button>
        </div>

        {/* Items — scrollable */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '16px 24px',
          minHeight: 0,
        }}>
          {items.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              textAlign: 'center',
              gap: '16px',
            }}>
              <div style={{ fontSize: '4rem' }}>🛒</div>
              <div>
                <p style={{ fontWeight: 700, color: '#1f2937', fontSize: '1.1rem', margin: 0 }}>Your cart is empty</p>
                <p style={{ color: '#9ca3af', fontSize: '.875rem', marginTop: '4px' }}>Add some fresh products!</p>
              </div>
              <Link to="/products" onClick={close}>
                <Button variant="outline" size="sm">Browse Products</Button>
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {items.map(item => (
                <div key={item.productId} style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px',
                  background: '#f9fafb',
                  borderRadius: '16px',
                  border: '1px solid #f3f4f6',
                }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '12px',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.8rem',
                    flexShrink: 0,
                    boxShadow: '0 1px 4px rgba(0,0,0,.08)',
                    overflow: 'hidden',
                  }}>
                    {item.product.images?.[0]
                      ? <img src={item.product.images[0]} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : '🛒'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 600, color: '#1f2937', fontSize: '.875rem', margin: '0 0 2px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' } as React.CSSProperties}>
                      {item.product.name}
                    </p>
                    <p style={{ color: '#2E7D32', fontWeight: 700, fontSize: '.875rem', margin: '0 0 8px' }}>
                      {formatPrice(item.product.price)}/{item.product.unit}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        onClick={() => updateQty(item.productId, item.quantity - 1)}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                      >
                        <Minus size={12} />
                      </button>
                      <span style={{ fontSize: '.875rem', fontWeight: 700, width: '24px', textAlign: 'center' }}>{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.productId, item.quantity + 1)}
                        style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
                      >
                        <Plus size={12} />
                      </button>
                      <span style={{ marginLeft: 'auto', fontWeight: 700, color: '#1f2937', fontSize: '.875rem', flexShrink: 0 }}>
                        {formatPrice(item.product.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => remove(item.productId)}
                    style={{ padding: '4px', color: '#d1d5db', background: 'none', border: 'none', cursor: 'pointer', alignSelf: 'flex-start', flexShrink: 0, borderRadius: '6px', transition: 'color .2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#d1d5db')}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid #f3f4f6',
            flexShrink: 0,
            background: '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ color: '#6b7280', fontSize: '.875rem' }}>Subtotal</span>
              <span style={{ fontWeight: 700, color: '#1f2937' }}>{formatPrice(total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ color: '#6b7280', fontSize: '.875rem' }}>Delivery</span>
              <span style={{ fontWeight: 700, fontSize: '.875rem', color: total >= 50 ? '#2E7D32' : '#1f2937' }}>
                {total >= 50 ? '🎉 FREE' : formatPrice(3.99)}
              </span>
            </div>
            {total < 50 && (
              <div style={{ background: '#f0fdf4', borderRadius: '12px', padding: '10px 12px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.75rem', color: '#15803d', marginBottom: '6px' }}>
                  <span>Add {formatPrice(50 - total)} more for free delivery</span>
                  <span>{Math.round((total / 50) * 100)}%</span>
                </div>
                <div style={{ height: '6px', background: '#dcfce7', borderRadius: '50px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: '#2E7D32', borderRadius: '50px', width: `${Math.min((total / 50) * 100, 100)}%`, transition: 'width .3s ease' }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #f3f4f6', marginBottom: '12px' }}>
              <span style={{ fontWeight: 700, color: '#111827' }}>Total</span>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2E7D32' }}>
                {formatPrice(total >= 50 ? total : total + 3.99)}
              </span>
            </div>
            <Link to="/checkout" onClick={close} style={{ display: 'block', textDecoration: 'none' }}>
              <Button fullWidth size="lg">Proceed to Checkout →</Button>
            </Link>
            <button
              onClick={close}
              style={{ width: '100%', fontSize: '.875rem', color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0 0', fontFamily: 'inherit', transition: 'color .2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#6b7280')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  )
}

export default function CartSidebar() {
  return createPortal(<CartContent />, document.body)
}
