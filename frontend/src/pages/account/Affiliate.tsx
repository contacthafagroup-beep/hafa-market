import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Star, Gift, Copy, TrendingUp, DollarSign } from "lucide-react"
import api from "@/lib/api"
import Spinner from "@/components/ui/Spinner"
import Button from "@/components/ui/Button"
import { formatPrice } from "@/lib/utils"
import toast from "react-hot-toast"

export default function AffiliatePage() {
  const qc = useQueryClient()

  const { data: affiliate, isLoading } = useQuery({
    queryKey: ["my-affiliate"],
    queryFn: () => api.get("/features/affiliate/my").then(r => r.data.data),
  })

  const { mutate: join, isLoading: joining } = useMutation({
    mutationFn: () => api.post("/features/affiliate/join"),
    onSuccess: () => { toast.success("Welcome to the affiliate program!"); qc.invalidateQueries({ queryKey: ["my-affiliate"] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || "Failed"),
  })

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copied!") }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  if (!affiliate) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="text-6xl mb-4">🤝</div>
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Affiliate Program</h1>
      <p className="text-gray-500 mb-6">Earn 3% commission on every sale you refer. Share products, earn money.</p>
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-left mb-6 space-y-2">
        {["Share your unique link", "Friend buys a product", "You earn 3% commission", "Paid to your wallet weekly"].map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-sm"><span className="w-6 h-6 bg-green-primary text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i+1}</span>{s}</div>
        ))}
      </div>
      <Button fullWidth size="lg" loading={joining} onClick={() => join()}>
        <Gift size={18} /> Join Affiliate Program
      </Button>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-extrabold text-gray-900">Affiliate Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Earned", value: formatPrice(affiliate.totalEarned, "ETB"), icon: <DollarSign size={20} />, color: "bg-green-50 text-green-primary" },
          { label: "Total Clicks", value: affiliate.totalClicks, icon: <TrendingUp size={20} />, color: "bg-blue-50 text-blue-600" },
          { label: "Commission", value: `${(affiliate.commission * 100).toFixed(0)}%`, icon: <Star size={20} />, color: "bg-orange-50 text-orange-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-card p-4 text-center">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 ${s.color}`}>{s.icon}</div>
            <p className="text-xl font-extrabold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-card p-5">
        <p className="text-sm font-bold text-gray-700 mb-3">Your Affiliate Link</p>
        <div className="flex gap-2">
          <input readOnly value={affiliate.link} className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 outline-none" />
          <Button size="sm" onClick={() => copy(affiliate.link)}><Copy size={14} /> Copy</Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">Share this link on social media, WhatsApp, or Telegram to earn commissions</p>
      </div>

      <div className="bg-white rounded-2xl shadow-card p-5">
        <p className="text-sm font-bold text-gray-700 mb-3">Your Code: <span className="text-green-primary font-black text-lg">{affiliate.code}</span></p>
        <p className="text-xs text-gray-400">Anyone who uses this code gets 5% off their first order, and you earn 3% commission</p>
      </div>
    </div>
  )
}
