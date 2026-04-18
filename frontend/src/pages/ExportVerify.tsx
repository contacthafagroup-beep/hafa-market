/**
 * ExportVerify — /export/verify
 * Seller submits verification documents to become a Verified Exporter
 */
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle, Clock, Upload, Shield } from 'lucide-react'
import api from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import toast from 'react-hot-toast'

const CERTIFICATIONS = [
  'Organic','FairTrade','UTZ','RainforestAlliance','USDA Organic','EU Organic',
  'ISO 22000','HACCP','GlobalGAP','Rainforest Alliance','Demeter','4C'
]

export default function ExportVerify() {
  const { user } = useAuth()
  const [form, setForm] = useState({
    businessLicenseUrl: '',
    exportLicenseUrl: '',
    bankStatementUrl: '',
    taxIdNumber: '',
    annualExportVolume: '',
    yearsExporting: '',
    certifications: [] as string[],
  })

  const { data: status } = useQuery({
    queryKey: ['export-verify-status'],
    queryFn: () => api.get('/export/verify/status').then(r => r.data.data),
    enabled: !!user,
  })

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/export/verify', data),
    onSuccess: () => toast.success('Verification submitted! We\'ll review within 48 hours.'),
    onError: () => toast.error('Failed to submit. Please try again.'),
  })

  const toggleCert = (cert: string) => {
    setForm(f => ({
      ...f,
      certifications: f.certifications.includes(cert)
        ? f.certifications.filter(c => c !== cert)
        : [...f.certifications, cert]
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({
      ...form,
      yearsExporting: form.yearsExporting ? parseInt(form.yearsExporting) : undefined,
    })
  }

  if (!user) return (
    <div className="text-center py-32">
      <Link to="/login" className="bg-green-primary text-white px-6 py-2 rounded-xl font-bold">Login to continue</Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link to="/export/dashboard" className="flex items-center gap-2 text-sm text-gray-500 hover:text-green-primary mb-6">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        {/* Current status */}
        {status && (
          <div className={`rounded-2xl p-5 mb-6 flex items-center gap-4 ${
            status.status === 'VERIFIED' ? 'bg-green-50 border-2 border-green-200' :
            status.status === 'PENDING' ? 'bg-amber-50 border-2 border-amber-200' :
            'bg-red-50 border-2 border-red-200'
          }`}>
            {status.status === 'VERIFIED' ? <CheckCircle size={24} className="text-green-500 flex-shrink-0" /> :
             status.status === 'PENDING' ? <Clock size={24} className="text-amber-500 flex-shrink-0" /> :
             <Shield size={24} className="text-red-500 flex-shrink-0" />}
            <div>
              <p className="font-bold text-gray-900">
                {status.status === 'VERIFIED' ? '✅ You are a Verified Exporter!' :
                 status.status === 'PENDING' ? '⏳ Verification Under Review' :
                 '❌ Verification Rejected'}
              </p>
              <p className="text-sm text-gray-500">
                {status.status === 'VERIFIED'
                  ? `Verified on ${new Date(status.verifiedAt).toLocaleDateString()}`
                  : status.status === 'PENDING'
                  ? 'Submitted. Review takes up to 48 hours.'
                  : 'Please resubmit with correct documents.'}
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-card overflow-hidden">
          <div className="bg-gradient-to-r from-green-dark to-green-primary p-8 text-white">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                <Shield size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold">Become a Verified Exporter</h1>
                <p className="text-white/70 text-sm">Build trust with international buyers</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              {['✅ Verified badge on listings','🌍 Priority in search results','💰 Higher conversion rates'].map(b => (
                <div key={b} className="bg-white/10 rounded-xl p-3 text-xs text-white/90 font-medium">{b}</div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* Business info */}
            <div>
              <h3 className="font-bold text-gray-800 mb-4">Business Information</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Tax ID / TIN Number</label>
                  <input value={form.taxIdNumber} onChange={e => setForm(f => ({ ...f, taxIdNumber: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" placeholder="e.g. 0012345678" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Years Exporting</label>
                  <input type="number" value={form.yearsExporting} onChange={e => setForm(f => ({ ...f, yearsExporting: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" placeholder="e.g. 5" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-gray-600 mb-1 block">Annual Export Volume</label>
                  <input value={form.annualExportVolume} onChange={e => setForm(f => ({ ...f, annualExportVolume: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" placeholder="e.g. $500,000 / 200 MT" />
                </div>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Documents */}
            <div>
              <h3 className="font-bold text-gray-800 mb-1">Document URLs</h3>
              <p className="text-xs text-gray-400 mb-4">Upload documents to Google Drive or Dropbox and paste the shareable link</p>
              <div className="space-y-3">
                {[
                  { key: 'businessLicenseUrl', label: 'Business License URL', placeholder: 'https://drive.google.com/...' },
                  { key: 'exportLicenseUrl', label: 'Export License URL', placeholder: 'https://drive.google.com/...' },
                  { key: 'bankStatementUrl', label: 'Bank Statement URL (last 3 months)', placeholder: 'https://drive.google.com/...' },
                ].map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-bold text-gray-600 mb-1 block flex items-center gap-1">
                      <Upload size={11} /> {field.label}
                    </label>
                    <input
                      value={(form as any)[field.key]}
                      onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary"
                      placeholder={field.placeholder}
                    />
                  </div>
                ))}
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Certifications */}
            <div>
              <h3 className="font-bold text-gray-800 mb-3">Certifications (select all that apply)</h3>
              <div className="flex flex-wrap gap-2">
                {CERTIFICATIONS.map(cert => (
                  <button key={cert} type="button" onClick={() => toggleCert(cert)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                      form.certifications.includes(cert)
                        ? 'bg-green-primary text-white border-green-primary'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-green-primary'
                    }`}>
                    {cert}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={mutation.isPending}
              className="w-full bg-green-primary hover:bg-green-dark text-white font-extrabold py-4 rounded-2xl transition-colors disabled:opacity-60">
              {mutation.isPending ? 'Submitting...' : '🛡️ Submit for Verification'}
            </button>
            <p className="text-xs text-gray-400 text-center">
              Our team reviews submissions within 48 hours. You'll be notified by email.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
