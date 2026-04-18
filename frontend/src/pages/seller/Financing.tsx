import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { TrendingUp, DollarSign, CheckCircle, AlertCircle, ArrowRight } from "lucide-react"
import api from "@/lib/api"
import Spinner from "@/components/ui/Spinner"
import Button from "@/components/ui/Button"
import Input from "@/components/ui/Input"
import { formatPrice } from "@/lib/utils"
import toast from "react-hot-toast"

export default function SellerFinancing() {
  const qc = useQueryClient()
  const [amount, setAmount] = useState("")
  const [purpose, setPurpose] = useState("")
  const [applied, setApplied] = useState(false)

  const { data: eligibility, isLoading } = useQuery({
    queryKey: ["seller-financing-eligibility"],
    queryFn: () => api.get("/features/seller-financing/eligibility").then(r => r.data.data),
  })

  const { mutate: apply, isLoading: applying } = useMutation({
    mutationFn: () => api.post("/features/seller-financing/apply", { amount: parseFloat(amount), purpose }),
    onSuccess: () => { toast.success("Loan application submitted!"); setApplied(true); qc.invalidateQueries({ queryKey: ["seller-financing-eligibility"] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Application failed"),
  })

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <DollarSign size={20} className="text-green-primary" /> Seller Financing
        </h2>
        <p className="text-sm text-gray-400 mt-1">Get working capital to grow your business. Repaid automatically from your sales.</p>
      </div>

      {/* Eligibility card */}
      <div className={`rounded-2xl p-6 ${eligibility?.eligible ? "bg-gradient-to-br from-green-dark to-green-primary text-white" : "bg-gray-50 border border-gray-200"}`}>
        <div className="flex items-center gap-3 mb-4">
          {eligibility?.eligible
            ? <CheckCircle size={24} className="text-green-300" />
            : <AlertCircle size={24} className="text-gray-400" />
          }
          <div>
            <p className={`font-extrabold text-lg ${eligibility?.eligible ? "text-white" : "text-gray-700"}`}>
              {eligibility?.eligible ? "You Qualify! 🎉" : "Not Yet Eligible"}
            </p>
            <p className={`text-sm ${eligibility?.eligible ? "text-white/70" : "text-gray-400"}`}>
              {eligibility?.message}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={`rounded-xl p-3 ${eligibility?.eligible ? "bg-white/15" : "bg-white border border-gray-100"}`}>
            <p className={`text-xs ${eligibility?.eligible ? "text-white/60" : "text-gray-400"}`}>Monthly Revenue</p>
            <p className={`text-xl font-extrabold ${eligibility?.eligible ? "text-white" : "text-gray-900"}`}>
              {formatPrice(eligibility?.monthlyRevenue || 0, "ETB")}
            </p>
          </div>
          <div className={`rounded-xl p-3 ${eligibility?.eligible ? "bg-white/15" : "bg-white border border-gray-100"}`}>
            <p className={`text-xs ${eligibility?.eligible ? "text-white/60" : "text-gray-400"}`}>Max Loan</p>
            <p className={`text-xl font-extrabold ${eligibility?.eligible ? "text-orange-300" : "text-gray-400"}`}>
              {eligibility?.eligible ? formatPrice(eligibility?.maxLoanAmount || 0, "ETB") : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-2xl shadow-card p-5">
        <h3 className="font-bold text-gray-900 mb-4">How It Works</h3>
        <div className="space-y-3">
          {[
            { icon: "📊", title: "Based on your sales", desc: "Loan amount = 2x your monthly revenue" },
            { icon: "💰", title: "0% interest", desc: "We earn from commission, not interest" },
            { icon: "🔄", title: "Auto-repayment", desc: "10% deducted from each order automatically" },
            { icon: "⚡", title: "Fast approval", desc: "Decision within 24 hours" },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-3">
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Application form */}
      {eligibility?.eligible && !applied && (
        <div className="bg-white rounded-2xl shadow-card p-5">
          <h3 className="font-bold text-gray-900 mb-4">Apply for Financing</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                Loan Amount (ETB) — Max: {formatPrice(eligibility.maxLoanAmount, "ETB")}
              </label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder={`Up to ${eligibility.maxLoanAmount}`}
                max={eligibility.maxLoanAmount}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Purpose</label>
              <select value={purpose} onChange={e => setPurpose(e.target.value)}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
                <option value="">Select purpose...</option>
                <option value="Buy more inventory">Buy more inventory</option>
                <option value="Equipment purchase">Equipment purchase</option>
                <option value="Farm expansion">Farm expansion</option>
                <option value="Seasonal stock">Seasonal stock</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <Button fullWidth loading={applying}
              disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > eligibility.maxLoanAmount || !purpose}
              onClick={() => apply()}>
              <ArrowRight size={16} /> Submit Application
            </Button>
          </div>
        </div>
      )}

      {applied && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <CheckCircle size={40} className="mx-auto text-green-primary mb-3" />
          <h3 className="font-extrabold text-gray-900 mb-1">Application Submitted!</h3>
          <p className="text-gray-500 text-sm">Our team will review your application and contact you within 24 hours.</p>
        </div>
      )}
    </div>
  )
}
