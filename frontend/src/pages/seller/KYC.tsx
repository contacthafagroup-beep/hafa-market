import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ShieldCheck, Upload, CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import toast from 'react-hot-toast'

const STATUS_UI: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  PENDING:  { icon: <Clock size={18} />,        label: 'Under Review',  color: 'text-amber-600 bg-amber-50 border-amber-200' },
  APPROVED: { icon: <CheckCircle size={18} />,  label: 'Verified ✅',   color: 'text-green-700 bg-green-50 border-green-200' },
  REJECTED: { icon: <XCircle size={18} />,      label: 'Rejected',      color: 'text-red-600 bg-red-50 border-red-200' },
}

export default function SellerKYC() {
  const [form, setForm] = useState({
    fullName: '', nationalIdNo: '', nationalIdImage: '',
    businessLicense: '', taxId: '', selfieWithId: '',
  })
  const [uploading, setUploading] = useState<string | null>(null)

  const { data: kycData, refetch } = useQuery({
    queryKey: ['kyc-me'],
    queryFn: () => api.get('/kyc/me').then(r => r.data.data),
  })

  const { mutate: submit, isLoading } = useMutation({
    mutationFn: () => api.post('/kyc', form),
    onSuccess: () => { toast.success('KYC submitted for review!'); refetch() },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Submission failed'),
  })

  const uploadFile = async (field: string, file: File) => {
    setUploading(field)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setForm(f => ({ ...f, [field]: res.data.data.url }))
      toast.success('Image uploaded')
    } catch { toast.error('Upload failed') }
    finally { setUploading(null) }
  }

  const kyc = kycData
  const statusInfo = kyc?.status ? STATUS_UI[kyc.status] : null

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <ShieldCheck size={24} className="text-green-primary" />
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Identity Verification (KYC)</h2>
          <p className="text-sm text-gray-500">Verify your identity to unlock full seller features</p>
        </div>
      </div>

      {/* Status banner */}
      {statusInfo && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border mb-6 ${statusInfo.color}`}>
          {statusInfo.icon}
          <div>
            <p className="font-bold text-sm">Status: {statusInfo.label}</p>
            {kyc.status === 'REJECTED' && kyc.rejectionReason && (
              <p className="text-xs mt-0.5">Reason: {kyc.rejectionReason}</p>
            )}
            {kyc.status === 'APPROVED' && kyc.expiresAt && (
              <p className="text-xs mt-0.5">Valid until: {new Date(kyc.expiresAt).toLocaleDateString()}</p>
            )}
          </div>
        </div>
      )}

      {kyc?.status === 'APPROVED' ? (
        <div className="bg-green-50 rounded-2xl p-8 text-center">
          <CheckCircle size={48} className="text-green-primary mx-auto mb-3" />
          <h3 className="font-extrabold text-gray-900 text-lg">You're Verified!</h3>
          <p className="text-gray-500 text-sm mt-1">Your seller account has a verified badge.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card p-6 space-y-5">
          {kyc?.status === 'PENDING' && (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 rounded-xl p-3 text-sm">
              <AlertTriangle size={16} /> Your documents are being reviewed. This usually takes 1–2 business days.
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Full Legal Name" placeholder="As on your ID"
              value={form.fullName} onChange={(e: any) => setForm(f => ({ ...f, fullName: e.target.value }))} />
            <Input label="National ID Number" placeholder="ID number"
              value={form.nationalIdNo} onChange={(e: any) => setForm(f => ({ ...f, nationalIdNo: e.target.value }))} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Tax ID (optional)" placeholder="TIN number"
              value={form.taxId} onChange={(e: any) => setForm(f => ({ ...f, taxId: e.target.value }))} />
          </div>

          {/* Document uploads */}
          {[
            { field: 'nationalIdImage', label: 'National ID Photo *', required: true },
            { field: 'selfieWithId',    label: 'Selfie Holding ID *', required: true },
            { field: 'businessLicense', label: 'Business License (optional)', required: false },
          ].map(({ field, label, required }) => (
            <div key={field}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
              {(form as any)[field] ? (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <img src={(form as any)[field]} alt={label} className="w-16 h-16 object-cover rounded-lg" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-green-700">Uploaded ✓</p>
                    <button onClick={() => setForm(f => ({ ...f, [field]: '' }))}
                      className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-green-primary hover:bg-green-50 transition-colors">
                  {uploading === field ? (
                    <div className="w-6 h-6 border-2 border-green-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload size={24} className="text-gray-400" />
                  )}
                  <span className="text-sm text-gray-500">Click to upload</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => e.target.files?.[0] && uploadFile(field, e.target.files[0])} />
                </label>
              )}
            </div>
          ))}

          <Button
            fullWidth
            loading={isLoading}
            disabled={!form.fullName || !form.nationalIdNo || !form.nationalIdImage || !form.selfieWithId}
            onClick={() => submit()}
          >
            <ShieldCheck size={18} />
            {kyc?.status === 'REJECTED' ? 'Resubmit KYC' : 'Submit for Verification'}
          </Button>
        </div>
      )}
    </div>
  )
}
