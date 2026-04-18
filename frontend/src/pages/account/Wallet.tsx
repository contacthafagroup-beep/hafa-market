import { useQuery } from '@tanstack/react-query'
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Star } from 'lucide-react'
import { userService } from '@/services/user.service'
import { useAuth } from '@/hooks/useAuth'
import Spinner from '@/components/ui/Spinner'
import { formatPrice, formatDate } from '@/lib/utils'

export default function Wallet() {
  const { user } = useAuth()
  const { data: wallet, isLoading, refetch } = useQuery({
    queryKey: ['wallet'],
    queryFn:  () => userService.getWallet().then(r => r.data.data),
    refetchInterval: 30000, // refresh every 30s for real-time sync
    refetchOnWindowFocus: true,
  })

  const loyaltyPoints = user?.loyaltyPoints || 0
  const pointsValue   = (loyaltyPoints * 0.1).toFixed(2) // 1 point = ETB 0.10

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-5">
      {/* Wallet balance */}
      <div className="bg-gradient-to-br from-green-dark to-green-primary rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-1 text-white/70 text-sm"><WalletIcon size={16} /> Wallet Balance</div>
        <div className="text-4xl font-black">{formatPrice(wallet?.balance || 0, wallet?.currency || 'ETB')}</div>
        <p className="text-white/60 text-xs mt-1">Available for checkout</p>
      </div>

      {/* Loyalty points */}
      <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1 text-white/80 text-sm"><Star size={14} /> Loyalty Points</div>
            <div className="text-3xl font-black">{loyaltyPoints.toLocaleString()} pts</div>
            <p className="text-white/70 text-xs mt-1">Worth ETB {pointsValue} · Earn 10 points per ETB 1 spent</p>
          </div>
          <div className="text-right">
            <div className="text-4xl">⭐</div>
            <p className="text-xs text-white/70 mt-1">
              {loyaltyPoints >= 500 ? '🥇 Gold' : loyaltyPoints >= 200 ? '🥈 Silver' : '🥉 Bronze'}
            </p>
          </div>
        </div>
        {loyaltyPoints > 0 && (
          <div className="mt-3 bg-white/20 rounded-xl p-3 text-sm">
            💡 You can redeem your points at checkout for discounts
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-extrabold text-gray-900 mb-4">Transaction History</h3>
        {!wallet?.transactions?.length ? (
          <p className="text-gray-400 text-sm text-center py-8">No transactions yet</p>
        ) : (
          <div className="space-y-3">
            {wallet.transactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${tx.type === 'CREDIT' ? 'bg-green-100 text-green-primary' : 'bg-red-100 text-red-500'}`}>
                  {tx.type === 'CREDIT' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{tx.description}</p>
                  <p className="text-xs text-gray-400">{formatDate(tx.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${tx.type === 'CREDIT' ? 'text-green-primary' : 'text-red-500'}`}>
                    {tx.type === 'CREDIT' ? '+' : '-'}{formatPrice(tx.amount)}
                  </p>
                  <p className="text-xs text-gray-400">Bal: {formatPrice(tx.balance)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
