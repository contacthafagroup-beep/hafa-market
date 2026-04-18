import { useQuery } from '@tanstack/react-query'
import { CreditCard, Calendar, CheckCircle, Clock } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatPrice, formatDate } from '@/lib/utils'
import { Link } from 'react-router-dom'

export default function BNPLPlans() {
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['my-bnpl-plans'],
    queryFn: () => api.get('/features/bnpl/my').then(r => r.data.data),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-gray-900">Buy Now, Pay Later</h2>
        <p className="text-sm text-gray-400">Your active installment plans</p>
      </div>

      {!plans.length ? (
        <div className="bg-white rounded-2xl shadow-card p-12 text-center">
          <CreditCard size={40} className="mx-auto text-gray-200 mb-4" />
          <h3 className="font-bold text-gray-700 mb-2">No BNPL plans</h3>
          <p className="text-gray-400 text-sm mb-4">Use BNPL at checkout to split payments into installments</p>
          <Link to="/products" className="text-green-primary font-semibold hover:underline">Shop Now →</Link>
        </div>
      ) : plans.map((plan: any) => {
        const paid = plan.payments?.filter((p: any) => p.status === 'PAID').length || 0
        const total = plan.payments?.length || plan.installments || 2
        const progress = Math.round((paid / total) * 100)

        return (
          <div key={plan.id} className="bg-white rounded-2xl shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-gray-900">Order #{plan.orderId?.slice(-8).toUpperCase()}</p>
                <p className="text-xs text-gray-400">{formatDate(plan.createdAt)}</p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                plan.status === 'COMPLETED' ? 'bg-green-100 text-green-primary' :
                plan.status === 'DEFAULTED' ? 'bg-red-100 text-red-600' :
                'bg-blue-100 text-blue-600'
              }`}>{plan.status || 'ACTIVE'}</span>
            </div>

            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-gray-500">Total: <span className="font-bold text-gray-900">{formatPrice(plan.totalAmount)}</span></span>
              <span className="text-gray-500">{paid}/{total} paid</span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-100 rounded-full mb-4">
              <div className="h-full bg-green-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>

            {/* Installments */}
            <div className="space-y-2">
              {plan.payments?.map((payment: any, i: number) => (
                <div key={payment.id || i} className="flex items-center gap-3 text-sm">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    payment.status === 'PAID' ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {payment.status === 'PAID'
                      ? <CheckCircle size={14} className="text-green-primary" />
                      : <Clock size={14} className="text-gray-400" />
                    }
                  </div>
                  <span className="flex-1 text-gray-700">Installment {i + 1}</span>
                  <span className="font-semibold">{formatPrice(payment.amount)}</span>
                  <span className="text-gray-400 flex items-center gap-1">
                    <Calendar size={11} /> {formatDate(payment.dueAt)}
                  </span>
                </div>
              ))}
            </div>

            {plan.nextDueAt && plan.status !== 'COMPLETED' && (
              <div className="mt-3 bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700 font-semibold">
                ⏰ Next payment due: {formatDate(plan.nextDueAt)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
