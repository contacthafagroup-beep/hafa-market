import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield, Search } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'
import { formatDate } from '@/lib/utils'

export default function AuditLogs() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search],
    queryFn: () => api.get(`/admin/audit-logs?page=${page}&limit=20${search ? `&search=${search}` : ''}`).then(r => r.data),
    staleTime: 30000,
  })

  const ACTION_COLORS: Record<string, string> = {
    CREATE: 'bg-green-100 text-green-700',
    UPDATE: 'bg-blue-100 text-blue-700',
    DELETE: 'bg-red-100 text-red-700',
    LOGIN:  'bg-purple-100 text-purple-700',
    PAYMENT:'bg-orange-100 text-orange-700',
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <Shield size={20} className="text-green-primary" /> Audit Logs
        </h2>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <Search size={14} className="text-gray-400" />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search logs..." className="border-none outline-none text-sm w-48" />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              {['Time','User','Action','Resource','IP'].map(h => (
                <th key={h} className="text-left py-3 px-4 text-xs font-bold text-gray-400 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.data?.map((log: any) => (
              <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4 text-xs text-gray-400 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                <td className="py-3 px-4">
                  <div className="font-semibold text-gray-800 text-xs">{log.user?.name || 'System'}</div>
                  <div className="text-xs text-gray-400">{log.user?.role}</div>
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    Object.entries(ACTION_COLORS).find(([k]) => log.action?.includes(k))?.[1] || 'bg-gray-100 text-gray-600'
                  }`}>{log.action}</span>
                </td>
                <td className="py-3 px-4 text-xs text-gray-600 max-w-xs truncate">{log.resource} {log.resourceId ? `#${log.resourceId.slice(-8)}` : ''}</td>
                <td className="py-3 px-4 text-xs text-gray-400 font-mono">{log.ipAddress}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.data?.length && (
          <div className="text-center py-12 text-gray-400">No audit logs found</div>
        )}
      </div>

      {/* Pagination */}
      {data?.pagination?.pages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: Math.min(data.pagination.pages, 10) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-full text-sm font-bold transition-colors ${page === p ? 'bg-green-primary text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
