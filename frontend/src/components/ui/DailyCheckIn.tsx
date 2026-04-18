import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { CheckCircle, Flame, Star } from "lucide-react"
import api from "@/lib/api"
import Button from "@/components/ui/Button"
import toast from "react-hot-toast"
import { useAuth } from "@/hooks/useAuth"

export default function DailyCheckIn() {
  const qc = useQueryClient()
  const { user } = useAuth()

  const { data: status } = useQuery({
    queryKey: ["checkin-status"],
    queryFn: () => api.get("/features/checkin/status").then(r => r.data.data),
    staleTime: 60000,
  })

  const { mutate: checkIn, isLoading } = useMutation({
    mutationFn: () => api.post("/features/checkin"),
    onSuccess: (res) => {
      toast.success(res.data.message || "Checked in!")
      qc.invalidateQueries({ queryKey: ["checkin-status"] })
    },
    onError: () => toast.error("Check-in failed"),
  })

  const streak = status?.streak || 0
  const canCheckIn = status?.canCheckIn !== false
  const nextPoints = status?.nextPoints || 5

  return (
    <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl p-5 text-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame size={22} className="text-yellow-300" />
          <h3 className="font-extrabold text-lg">Daily Check-in</h3>
        </div>
        {streak > 0 && (
          <span className="bg-white/20 text-white text-sm font-black px-3 py-1 rounded-full">
            🔥 {streak} day streak
          </span>
        )}
      </div>
      <p className="text-white/80 text-sm mb-4">
        {canCheckIn
          ? `Check in today to earn ${nextPoints} loyalty points!`
          : `Come back tomorrow for your ${streak + 1}-day streak bonus!`
        }
      </p>
      <div className="flex gap-1 mb-4">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className={`flex-1 h-2 rounded-full ${i < streak % 7 ? "bg-yellow-300" : "bg-white/30"}`} />
        ))}
      </div>
      <Button
        fullWidth
        loading={isLoading}
        disabled={!canCheckIn}
        onClick={() => checkIn()}
        className={canCheckIn ? "bg-white text-orange-600 hover:bg-orange-50" : "bg-white/20 text-white/60 cursor-not-allowed"}
      >
        {canCheckIn ? <><CheckCircle size={16} /> Check In (+{nextPoints} pts)</> : "✓ Already checked in today"}
      </Button>
    </div>
  )
}
