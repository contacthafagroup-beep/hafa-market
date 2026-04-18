import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, Plus, Trash2, Star } from 'lucide-react'
import { userService } from '@/services/user.service'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import LocationPicker from '@/components/ui/LocationPicker'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import type { Address } from '@/types'

interface LocationData { lat: number; lng: number; address: string; landmark: string }

export default function Addresses() {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [label, setLabel]   = useState('Home')
  const [name, setName]     = useState('')
  const [phone, setPhone]   = useState('')
  const [location, setLocation] = useState<LocationData | null>(null)

  const { data: addresses, isLoading } = useQuery({
    queryKey: ['addresses'],
    queryFn:  () => userService.getAddresses().then(r => r.data.data),
  })

  const { mutate: add, isLoading: saving } = useMutation({
    mutationFn: (data: Omit<Address,'id'>) => userService.addAddress(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['addresses'] })
      setAdding(false)
      setLocation(null)
      setName(''); setPhone(''); setLabel('Home')
      toast.success('Address saved!')
    },
  })

  const { mutate: del } = useMutation({
    mutationFn: (id: string) => userService.deleteAddress(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['addresses'] }); toast.success('Address removed') },
  })

  const { mutate: setDefault } = useMutation({
    mutationFn: (id: string) => userService.setDefaultAddress(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  })

  const handleSave = () => {
    if (!name) { toast.error('Please enter your name'); return }
    if (!phone) { toast.error('Please enter your phone number'); return }
    if (!location?.landmark) { toast.error('Please select a landmark'); return }

    add({
      label,
      fullName: name,
      phone,
      street: location.landmark,
      city: 'Hossana',
      region: 'Hadiya Zone',
      country: 'Ethiopia',
      latitude: location.lat || undefined,
      longitude: location.lng || undefined,
      isDefault: !addresses?.length,
    } as any)
  }

  if (isLoading) return <div className="flex justify-center py-20"><Spinner /></div>

  return (
    <div className="space-y-4">
      {addresses?.map(addr => (
        <div key={addr.id} className="bg-white rounded-2xl shadow-card p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-green-primary flex-shrink-0">
            <MapPin size={18} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-gray-900 text-sm">{addr.label}</span>
              {addr.isDefault && <span className="bg-green-100 text-green-primary text-xs font-bold px-2 py-0.5 rounded-full">Default</span>}
            </div>
            <p className="text-sm text-gray-700">{addr.fullName} · {addr.phone}</p>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <MapPin size={12} /> {addr.street}
            </p>
            {(addr as any).latitude && (
              <p className="text-xs text-green-600 mt-1">📍 GPS location saved</p>
            )}
          </div>
          <div className="flex gap-2">
            {!addr.isDefault && (
              <button onClick={() => setDefault(addr.id)} className="p-2 text-gray-300 hover:text-orange-400 transition-colors" title="Set default">
                <Star size={16} />
              </button>
            )}
            <button onClick={() => del(addr.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}

      {adding ? (
        <div className="bg-white rounded-2xl shadow-card p-6 space-y-4">
          <h3 className="font-bold text-gray-900 text-lg">📍 Add Delivery Location</h3>

          <div className="grid sm:grid-cols-3 gap-3">
            {['Home','Work','Other'].map(l => (
              <button key={l} type="button" onClick={() => setLabel(l)}
                className={`py-2 rounded-xl border-2 text-sm font-semibold transition-all ${label === l ? 'border-green-primary bg-green-50 text-green-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {l === 'Home' ? '🏠' : l === 'Work' ? '🏢' : '📍'} {l}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Full Name" placeholder="Your name" value={name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)} />
            <Input label="Phone Number" type="tel" placeholder="+251 911 000 000" value={phone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value)} />
          </div>

          <LocationPicker onChange={setLocation} />

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} loading={saving}>Save Location</Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="w-full bg-white rounded-2xl shadow-card p-5 flex items-center gap-3 text-green-primary font-semibold hover:bg-green-50 transition-colors border-2 border-dashed border-green-200">
          <Plus size={20} /> Add New Delivery Location
        </button>
      )}
    </div>
  )
}
