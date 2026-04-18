import { useEffect, useState, useCallback } from 'react'

// Telegram WebApp SDK types
interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: {
      id: number
      first_name: string
      last_name?: string
      username?: string
      photo_url?: string
      language_code?: string
    }
    start_param?: string
  }
  version: string
  platform: string
  colorScheme: 'light' | 'dark'
  themeParams: {
    bg_color?: string
    text_color?: string
    hint_color?: string
    link_color?: string
    button_color?: string
    button_text_color?: string
  }
  isExpanded: boolean
  viewportHeight: number
  viewportStableHeight: number
  MainButton: {
    text: string
    color: string
    textColor: string
    isVisible: boolean
    isActive: boolean
    isProgressVisible: boolean
    show(): void
    hide(): void
    enable(): void
    disable(): void
    showProgress(leaveActive?: boolean): void
    hideProgress(): void
    setText(text: string): void
    onClick(fn: () => void): void
    offClick(fn: () => void): void
  }
  BackButton: {
    isVisible: boolean
    show(): void
    hide(): void
    onClick(fn: () => void): void
    offClick(fn: () => void): void
  }
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void
    notificationOccurred(type: 'error' | 'success' | 'warning'): void
    selectionChanged(): void
  }
  ready(): void
  expand(): void
  close(): void
  sendData(data: string): void
  openLink(url: string, options?: { try_instant_view?: boolean }): void
  openTelegramLink(url: string): void
  showPopup(params: { title?: string; message: string; buttons?: Array<{ id?: string; type?: string; text?: string }> }, callback?: (id: string) => void): void
  showAlert(message: string, callback?: () => void): void
  showConfirm(message: string, callback?: (confirmed: boolean) => void): void
  enableClosingConfirmation(): void
  disableClosingConfirmation(): void
  setHeaderColor(color: string): void
  setBackgroundColor(color: string): void
  isVersionAtLeast(version: string): boolean
}

declare global {
  interface Window {
    Telegram?: { WebApp: TelegramWebApp }
  }
}

export function useTelegram() {
  const tg = window.Telegram?.WebApp
  const isInTelegram = !!tg?.initData

  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (!tg) return
    tg.ready()
    tg.expand()
    // Set Hafa Market green theme
    if (tg.setHeaderColor) tg.setHeaderColor('#2E7D32')
    if (tg.setBackgroundColor) tg.setBackgroundColor('#ffffff')
    setIsReady(true)
  }, [])

  const haptic = useCallback((type: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning' | 'selection') => {
    if (!tg?.HapticFeedback) return
    if (type === 'success' || type === 'error' || type === 'warning') {
      tg.HapticFeedback.notificationOccurred(type)
    } else if (type === 'selection') {
      tg.HapticFeedback.selectionChanged()
    } else {
      tg.HapticFeedback.impactOccurred(type)
    }
  }, [tg])

  const showMainButton = useCallback((text: string, onClick: () => void) => {
    if (!tg?.MainButton) return
    tg.MainButton.setText(text)
    tg.MainButton.show()
    tg.MainButton.onClick(onClick)
  }, [tg])

  const hideMainButton = useCallback(() => {
    if (!tg?.MainButton) return
    tg.MainButton.hide()
  }, [tg])

  const showBackButton = useCallback((onClick: () => void) => {
    if (!tg?.BackButton) return
    tg.BackButton.show()
    tg.BackButton.onClick(onClick)
  }, [tg])

  const hideBackButton = useCallback(() => {
    if (!tg?.BackButton) return
    tg.BackButton.hide()
  }, [tg])

  const shareProduct = useCallback((productName: string, productUrl: string) => {
    if (!tg) return
    const text = `🌿 Check out ${productName} on Hafa Market!\n${productUrl}`
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(productUrl)}&text=${encodeURIComponent(text)}`)
  }, [tg])

  const close = useCallback(() => tg?.close(), [tg])

  return {
    tg,
    isInTelegram,
    isReady,
    user: tg?.initDataUnsafe?.user,
    initData: tg?.initData || '',
    colorScheme: tg?.colorScheme || 'light',
    themeParams: tg?.themeParams || {},
    haptic,
    showMainButton,
    hideMainButton,
    showBackButton,
    hideBackButton,
    shareProduct,
    close,
  }
}
