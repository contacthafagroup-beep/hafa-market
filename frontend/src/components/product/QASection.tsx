import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HelpCircle, Send, ChevronDown, ChevronUp } from 'lucide-react'
import api from '@/lib/api'
import { formatDate } from '@/lib/utils'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'

interface Props { productId: string; sellerId: string; isAuthenticated: boolean; isSeller?: boolean }

export default function QASection({ productId, sellerId, isAuthenticated, isSeller }: Props) {
  const qc = useQueryClient()
  const [question, setQuestion] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  const { data: qaList = [], isLoading } = useQuery({
    queryKey: ['product-qa', productId],
    queryFn: () => api.get(`/features/qa/${productId}`).then(r => r.data.data),
    enabled: !!productId,
  })

  const { mutate: askQuestion, isLoading: asking } = useMutation({
    mutationFn: () => api.post(`/features/qa/${productId}`, { question }),
    onSuccess: () => { toast.success('Question submitted!'); setQuestion(''); qc.invalidateQueries({ queryKey: ['product-qa', productId] }) },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed'),
  })

  const { mutate: answerQuestion } = useMutation({
    mutationFn: ({ id, answer }: { id: string; answer: string }) =>
      api.post(`/features/qa/${id}/answer`, { answer }),
    onSuccess: (_, vars) => {
      toast.success('Answer posted!')
      setAnswers(prev => ({ ...prev, [vars.id]: '' }))
      setExpanded(null)
      qc.invalidateQueries({ queryKey: ['product-qa', productId] })
    },
    onError: () => toast.error('Failed to post answer'),
  })

  const visible = showAll ? qaList : qaList.slice(0, 3)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HelpCircle size={18} className="text-green-primary" />
        <h3 className="font-extrabold text-gray-900">Questions & Answers</h3>
        <span className="text-xs text-gray-400">({qaList.length})</span>
      </div>

      {/* Ask a question */}
      {isAuthenticated && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-sm font-bold text-gray-700 mb-2">Have a question about this product?</p>
          <div className="flex gap-2">
            <input value={question} onChange={e => setQuestion(e.target.value)}
              placeholder="e.g. Is this certified organic? Do you deliver to Hawassa?"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-green-primary"
              onKeyDown={e => e.key === 'Enter' && question.trim() && askQuestion()} />
            <Button size="sm" loading={asking} disabled={!question.trim()} onClick={() => askQuestion()}>
              <Send size={14} /> Ask
            </Button>
          </div>
        </div>
      )}

      {/* Q&A list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-6 text-gray-400 text-sm">
          <HelpCircle size={28} className="mx-auto mb-2 opacity-30" />
          No questions yet. Be the first to ask!
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((qa: any) => (
            <div key={qa.id} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-blue-500 font-black text-sm flex-shrink-0">Q</span>
                <p className="text-sm font-semibold text-gray-800 flex-1">{qa.question}</p>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(qa.createdAt)}</span>
              </div>

              {qa.answer ? (
                <div className="flex items-start gap-2 bg-green-50 rounded-xl p-3">
                  <span className="text-green-primary font-black text-sm flex-shrink-0">A</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{qa.answer}</p>
                    <p className="text-xs text-green-primary font-semibold mt-1">✓ Seller · {qa.answeredAt ? formatDate(qa.answeredAt) : ''}</p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-gray-400 italic ml-6">Awaiting seller response...</p>
                  {/* Seller answer input */}
                  {isSeller && (
                    <div className="mt-2 ml-6">
                      {expanded === qa.id ? (
                        <div className="flex gap-2">
                          <input value={answers[qa.id] || ''} onChange={e => setAnswers(prev => ({ ...prev, [qa.id]: e.target.value }))}
                            placeholder="Write your answer..."
                            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-green-primary" />
                          <Button size="sm" onClick={() => answerQuestion({ id: qa.id, answer: answers[qa.id] || '' })}
                            disabled={!answers[qa.id]?.trim()}>
                            <Send size={12} />
                          </Button>
                          <button onClick={() => setExpanded(null)} className="text-xs text-gray-400">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setExpanded(qa.id)}
                          className="text-xs text-green-primary font-semibold hover:underline">
                          Answer this question
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {qaList.length > 3 && (
            <button onClick={() => setShowAll(!showAll)}
              className="w-full flex items-center justify-center gap-1 text-sm text-green-primary font-semibold hover:underline py-2">
              {showAll ? <><ChevronUp size={16} /> Show less</> : <><ChevronDown size={16} /> See all {qaList.length} questions</>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
