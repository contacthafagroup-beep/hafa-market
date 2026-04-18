import { useEffect } from 'react'
import toast from 'react-hot-toast'

const KEY = 'hafa_price_alerts'

interface Alert { productId: string; productName: string; targetPrice: number; currentPrice: number }

export function setPriceAlert(productId: string, productName: string, targetPrice: number, currentPrice: number) {
  try {
    const alerts: Alert[] = JSON.parse(localStorage.getItem(KEY) || '[]')
    const filtered = alerts.filter(a => a.productId !== productId)
    filtered.push({ productId, productName, targetPrice, currentPrice })
    localStorage.setItem(KEY, JSON.stringify(filtered))
    toast.success(`🔔 Alert set! We'll notify you when ${productName} drops below $${targetPrice.toFixed(2)}`)
  } catch {}
}

export function removePriceAlert(productId: string) {
  try {
    const alerts: Alert[] = JSON.parse(localStorage.getItem(KEY) || '[]')
    localStorage.setItem(KEY, JSON.stringify(alerts.filter(a => a.productId !== productId)))
  } catch {}
}

export function getPriceAlerts(): Alert[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function hasAlert(productId: string): number | null {
  const alerts = getPriceAlerts()
  return alerts.find(a => a.productId === productId)?.targetPrice ?? null
}

/** Call this on app load to check if any alerts have triggered */
export function usePriceAlertChecker(products: Array<{ id: string; name: string; price: number }>) {
  useEffect(() => {
    if (!products?.length) return
    const alerts = getPriceAlerts()
    const triggered: Alert[] = []
    const remaining: Alert[] = []

    alerts.forEach(alert => {
      const product = products.find(p => p.id === alert.productId)
      if (product && product.price <= alert.targetPrice) {
        triggered.push({ ...alert, currentPrice: product.price })
      } else {
        remaining.push(alert)
      }
    })

    if (triggered.length > 0) {
      localStorage.setItem(KEY, JSON.stringify(remaining))
      triggered.forEach(a => {
        toast.success(
          `🎉 Price Alert! ${a.productName} is now $${a.currentPrice.toFixed(2)} (your target: $${a.targetPrice.toFixed(2)})`,
          { duration: 8000, icon: '🔔' }
        )
      })
    }
  }, [products])
}
