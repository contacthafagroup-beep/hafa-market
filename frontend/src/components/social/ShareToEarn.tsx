/**
 * ShareToEarn.tsx — Referral share button with WhatsApp/Telegram integration
 * Used on ProductDetail page and product cards
 * Generates a unique referral link, tracks clicks and conversions
 */
import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Share2, MessageCircle, Send, Copy, Check, TrendingUp, X } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

interface Props {
  productId: string
  productName: string
  productPrice: number
  productUnit: string
  compact?: boolean  // compact = just the share button, no panel
}

export default function ShareToEarn({ productId, productName, productPrice, productUnit, compact = false }: Props) {
  const { isAuthenticated, user } = useAuth()
  const [showPanel, setShowPanel] = useState(false)
  const [copied, setCopied] = useState(false)

  const { data: shareData, refetch } = useQuery({
    queryKey: ['share-link', productId],
    queryFn: () => api.post(`/social/share/${productId}`).then(r => r.data.data),
    enabled: false, // only fetch when user opens panel
  })

  const { mutate: generateLink, isPending } = useMutation({
    mutationFn: () => api.post(`/social/share/${productId}`).then(r => r.data.data),
    onSuccess: (data) => {
      // Track click
      api.post(`/social/share/click/${data.code}`).catch(() => {})
    },
  })

  const handleOpen = () => {
    if (!isAuthenticated) {
      toast.error('Sign in to share and earn rewards')
      return
    }
    setShowPanel(true)
    generateLink()
  }

  const copyLink = () => {
    if (!shareData?.shareUrl) return
    navigator.clipboard.writeText(shareData.shareUrl)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const openWhatsApp = () => {
    if (shareData?.whatsappUrl) window.open(shareData.whatsappUrl, '_blank')
  }

  const openTelegram = () => {
    if (shareData?.telegramUrl) window.open(shareData.telegramUrl, '_blank')
  }

  if (compact) {
    return (
      <>
        <button onClick={handleOpen}
          className="w-10 h-10 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-green-primary transition-colors"
          title="Share & Earn ETB 10">
          <Share2 size={16} className="text-gray-400" />
        </button>

        {showPanel && (
          <SharePanel
            shareData={shareData}
            isPending={isPending}
            onCopy={copyLink}
            onWhatsApp={openWhatsApp}
            onTelegram={openTelegram}
            onClose={() => setShowPanel(false)}
            copied={copied}
            productName={productName}
          />
        )}
      </>
    )
  }

  return (
    <div>
      <button onClick={handleOpen}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-green-200 text-green-primary rounded-xl font-bold text-sm hover:bg-green-50 transition-colors">
        <Share2 size={16} /> Share & Earn ETB 10
      </button>

      {showPanel && (
        <SharePanel
          shareData={shareData}
          isPending={isPending}
          onCopy={copyLink}
          onWhatsApp={openWhatsApp}
          onTelegram={openTelegram}
          onClose={() => setShowPanel(false)}
          copied={copied}
          productName={productName}
        />
      )}
    </div>
  )
}

function SharePanel({ shareData, isPending, onCopy, onWhatsApp, onTelegram, onClose, copied, productName }: any) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-gray-900 text-lg">Share & Earn 💰</h3>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        {/* Reward info */}
        <div className="bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-2xl p-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="text-3xl">🎁</div>
            <div>
              <p className="font-bold text-gray-900">You earn ETB 10</p>
              <p className="text-xs text-gray-500">when a friend buys using your link</p>
              <p className="text-xs text-green-600 font-semibold mt-0.5">Friend gets 5% off their first order</p>
            </div>
          </div>
        </div>

        {isPending ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : shareData ? (
          <>
            {/* Share URL */}
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-3 mb-4">
              <p className="flex-1 text-xs text-gray-600 truncate font-mono">{shareData.shareUrl}</p>
              <button onClick={onCopy}
                className="flex-shrink-0 w-8 h-8 bg-green-primary rounded-lg flex items-center justify-center hover:bg-green-dark transition-colors">
                {copied ? <Check size={14} className="text-white" /> : <Copy size={14} className="text-white" />}
              </button>
            </div>

            {/* Share buttons */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={onWhatsApp}
                className="flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-xl font-bold text-sm hover:bg-[#20b858] transition-colors">
                <MessageCircle size={16} /> WhatsApp
              </button>
              <button onClick={onTelegram}
                className="flex items-center justify-center gap-2 py-3 bg-[#0088cc] text-white rounded-xl font-bold text-sm hover:bg-[#0077b5] transition-colors">
                <Send size={16} /> Telegram
              </button>
            </div>

            {/* Stats link */}
            <Link to="/account/affiliate" onClick={onClose}
              className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-green-primary transition-colors">
              <TrendingUp size={12} /> View your earnings & stats
            </Link>
          </>
        ) : null}
      </div>
    </div>
  )
}

// ── Standalone share stats widget (for account page) ─────────────────────────
export function ShareStats() {
  const { data: stats } = useQuery({
    queryKey: ['share-stats'],
    queryFn: () => api.get('/social/share/stats').then(r => r.data.data),
    staleTime: 60000,
  })

  if (!stats) return null

  return (
    <div className="bg-gradient-to-br from-green-50 to-teal-50 border border-green-200 rounded-2xl p-5">
      <h3 className="font-extrabold text-gray-900 mb-4 flex items-center gap-2">
        <Share2 size={18} className="text-green-primary" /> Your Share Stats
      </h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Links Shared', value: stats.totalLinks || 0, icon: '🔗' },
          { label: 'Friends Clicked', value: stats.totalClicks || 0, icon: '👆' },
          { label: 'Conversions', value: stats.totalConversions || 0, icon: '🛒' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-3 text-center">
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="text-xl font-extrabold text-gray-900">{s.value}</div>
            <div className="text-[10px] text-gray-400">{s.label}</div>
          </div>
        ))}
      </div>
      {stats.totalEarnings > 0 && (
        <div className="bg-green-500 text-white rounded-xl p-3 text-center">
          <p className="text-xs text-white/80">Total Earned</p>
          <p className="text-2xl font-extrabold">ETB {stats.totalEarnings.toFixed(0)}</p>
        </div>
      )}
    </div>
  )
}
