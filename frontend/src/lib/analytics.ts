import api from './api'

let sessionId = sessionStorage.getItem('hafa_sid')
if (!sessionId) {
  sessionId = Math.random().toString(36).slice(2)
  sessionStorage.setItem('hafa_sid', sessionId)
}

const device = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'

function track(type: string, extra: Record<string, any> = {}) {
  api.post('/analytics/event', { type, sessionId, device, ...extra }).catch(() => {})
}

// ── External traffic tracking (Upgrade 3: A10 external signal) ──────────────
// Called when user arrives from WhatsApp, Telegram, social media, etc.
function detectAndTrackExternalTraffic(productId?: string) {
  const params = new URLSearchParams(window.location.search)
  const utmSource   = params.get('utm_source')
  const utmMedium   = params.get('utm_medium')
  const utmCampaign = params.get('utm_campaign')
  const referrer    = document.referrer

  const externalSources = ['whatsapp', 'telegram', 'facebook', 'instagram', 'twitter', 'tiktok', 't.me', 'wa.me']
  const isExternal = externalSources.some(s =>
    (utmSource || '').toLowerCase().includes(s) ||
    (referrer || '').toLowerCase().includes(s)
  )

  if ((isExternal || utmSource) && productId) {
    api.post('/search/external', {
      productId,
      source: utmSource || 'social',
      medium: utmMedium || 'social',
      campaign: utmCampaign,
      referrer: referrer || undefined,
    }).catch(() => {})
  }
}

export const analytics = {
  pageView:      (path: string)                          => track('PAGE_VIEW',       { meta: { path } }),
  productView:   (productId: string, sellerId?: string)  => {
    track('PRODUCT_VIEW', { productId, sellerId })
    // Also check if this view came from external traffic
    detectAndTrackExternalTraffic(productId)
  },
  addToCart:     (productId: string, sellerId?: string)  => {
    track('ADD_TO_CART', { productId, sellerId })
    // Real-time Two-Tower update — user vector updates instantly on add-to-cart
    api.post('/ai/recommendations/click', { productId }).catch(() => {})
  },
  checkoutStart: ()                                      => track('CHECKOUT_START'),
  purchase:      (orderId: string, total: number)        => track('PURCHASE',        { meta: { orderId, total } }),
  // Explicit external traffic tracking (for share buttons)
  trackExternalShare: (productId: string, platform: string) => {
    api.post('/search/external', {
      productId,
      source: platform,
      medium: 'social',
    }).catch(() => {})
  },
}
