import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { GitBranch, Plus, CheckCircle, XCircle, Clock, Users, Settings, Trash2 } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { formatDate, formatPrice } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

// Approval chains stored in localStorage (no backend model needed — uses bulk order notes)
const STORAGE_KEY = 'hafa_approval_rules'

interface ApprovalRule {
  id: string
  name: string
  minAmount: number
  approvers: string[] // email/phone list
  requireAll: boolean
  createdAt: string
}

function getStoredRules(): ApprovalRule[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function saveRules(rules: ApprovalRule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

export default function ApprovalChains() {
  const { user } = useAuth()
  const [rules, setRules] = useState<ApprovalRule[]>(getStoredRules)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', minAmount: '', approvers: '', requireAll: true })

  // Pending approvals — orders above threshold that need sign-off
  const { data: pendingOrders = [] } = useQuery({
    queryKey: ['pending-approval-orders'],
    queryFn: () => api.get('/bulk-orders/my').then(r =>
      (r.data.data || []).filter((o: any) => o.status === 'PENDING')
    ),
  })

  const addRule = () => {
    if (!form.name || !form.minAmount) { toast.error('Name and minimum amount required'); return }
    const newRule: ApprovalRule = {
      id: Date.now().toString(),
      name: form.name,
      minAmount: parseFloat(form.minAmount),
      approvers: form.approvers.split(',').map(s => s.trim()).filter(Boolean),
      requireAll: form.requireAll,
      createdAt: new Date().toISOString(),
    }
    const updated = [...rules, newRule]
    setRules(updated)
    saveRules(updated)
    setShowForm(false)
    setForm({ name: '', minAmount: '', approvers: '', requireAll: true })
    toast.success('Approval rule created!')
  }

  const deleteRule = (id: string) => {
    const updated = rules.filter(r => r.id !== id)
    setRules(updated)
    saveRules(updated)
    toast.success('Rule deleted')
  }

  const getApplicableRule = (amount: number) =>
    rules.filter(r => amount >= r.minAmount).sort((a, b) => b.minAmount - a.minAmount)[0]

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <GitBranch size={22} className="text-purple-600" /> Approval Chains
          </h1>
          <p className="text-gray-400 text-sm mt-1">Require manager sign-off for orders above a threshold</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus size={16} /> Add Rule
        </Button>
      </div>

      {/* How it works */}
      <div className="bg-purple-50 border border-purple-200 rounded-2xl p-5 mb-6">
        <h3 className="font-bold text-purple-800 mb-3">⚙️ How Approval Chains Work</h3>
        <div className="grid sm:grid-cols-3 gap-3 text-sm text-purple-700">
          <div className="bg-white rounded-xl p-3">
            <p className="font-bold mb-1">1. Set Rules</p>
            <p className="text-xs">Define who must approve orders above a certain amount</p>
          </div>
          <div className="bg-white rounded-xl p-3">
            <p className="font-bold mb-1">2. Order Submitted</p>
            <p className="text-xs">When a bulk order exceeds the threshold, approvers are notified</p>
          </div>
          <div className="bg-white rounded-xl p-3">
            <p className="font-bold mb-1">3. Approved & Sent</p>
            <p className="text-xs">Once approved, the order is forwarded to Hafa Market</p>
          </div>
        </div>
      </div>

      {/* Add Rule Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card p-6 mb-6">
          <h3 className="font-extrabold text-gray-900 mb-4">New Approval Rule</h3>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <Input label="Rule Name *" placeholder="e.g. Manager Approval for Large Orders"
              value={form.name} onChange={(e: any) => setForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Minimum Order Amount (ETB) *" type="number" placeholder="e.g. 10000"
              value={form.minAmount} onChange={(e: any) => setForm(f => ({ ...f, minAmount: e.target.value }))} />
            <div className="sm:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1.5">
                Approver Emails/Phones (comma-separated)
              </label>
              <input value={form.approvers} onChange={e => setForm(f => ({ ...f, approvers: e.target.value }))}
                placeholder="manager@company.com, +251911000000"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary" />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.requireAll}
                  onChange={e => setForm(f => ({ ...f, requireAll: e.target.checked }))}
                  className="w-4 h-4 accent-purple-600" />
                <span className="text-sm font-medium text-gray-700">Require ALL approvers to sign off (vs. any one)</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={addRule} disabled={!form.name || !form.minAmount}>
              <GitBranch size={15} /> Create Rule
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Rules list */}
      <div className="space-y-4 mb-8">
        <h3 className="font-bold text-gray-900">Active Rules ({rules.length})</h3>
        {!rules.length ? (
          <div className="bg-white rounded-2xl shadow-card p-8 text-center text-gray-400">
            <Settings size={32} className="mx-auto mb-2 opacity-30" />
            <p>No approval rules yet. Add one to require sign-off for large orders.</p>
          </div>
        ) : (
          rules.map(rule => (
            <div key={rule.id} className="bg-white rounded-2xl shadow-card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <GitBranch size={18} className="text-purple-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{rule.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Orders ≥ <span className="font-bold text-purple-600">{formatPrice(rule.minAmount)}</span> require approval
                </p>
                {rule.approvers.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <Users size={12} className="text-gray-400" />
                    {rule.approvers.map(a => (
                      <span key={a} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{a}</span>
                    ))}
                    <span className="text-xs text-gray-400">({rule.requireAll ? 'All must approve' : 'Any one can approve'})</span>
                  </div>
                )}
              </div>
              <button onClick={() => deleteRule(rule.id)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Pending approvals */}
      {pendingOrders.length > 0 && (
        <div>
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Clock size={16} className="text-orange-500" /> Pending Approval ({pendingOrders.length})
          </h3>
          <div className="space-y-3">
            {pendingOrders.map((order: any) => {
              const amount = order.quotedPrice || order.totalEstimate || 0
              const rule = getApplicableRule(amount)
              return (
                <div key={order.id} className="bg-white rounded-2xl shadow-card p-4 border-l-4 border-orange-400">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-gray-900">#{order.id.slice(-8).toUpperCase()} — {order.orgName}</p>
                      <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
                      {rule && (
                        <p className="text-xs text-purple-600 font-semibold mt-1">
                          ⚠️ Requires approval per rule: "{rule.name}"
                        </p>
                      )}
                    </div>
                    {amount > 0 && <span className="font-extrabold text-green-primary">{formatPrice(amount)}</span>}
                  </div>
                  {rule && rule.approvers.length > 0 && (
                    <div className="mt-3 bg-purple-50 rounded-xl p-3">
                      <p className="text-xs font-bold text-purple-700 mb-1">Waiting for approval from:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {rule.approvers.map(a => (
                          <span key={a} className="text-xs bg-white border border-purple-200 text-purple-700 px-2 py-0.5 rounded-full">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
