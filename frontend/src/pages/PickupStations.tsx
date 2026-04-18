import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Clock, Phone, CheckCircle } from 'lucide-react'
import api from '@/lib/api'
import Spinner from '@/components/ui/Spinner'

export default function PickupStations() {
  const [search, setSearch] = useState('')

  const { data: stations = [], isLoading } = useQuery({
    queryKey: ['pickup-stations'],
    queryFn: () => api.get('/features/pickup-stations').then(r => r.data.data),
    staleTime: 1000 * 60 * 5,
  })

  const filtered = stations.filter((s: any) =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) ||
    s.address?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-gray-900 mb-1">📍 Pickup Stations</h1>
        <p className="text-gray-400 text-sm">Pick up your order from a convenient location near you in Hossana</p>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search by name or area..."
        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary mb-6"
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : !filtered.length ? (
        <div className="text-center py-16 text-gray-400">
          <MapPin size={48} className="mx-auto mb-4 opacity-30" />
          <p>{search ? 'No stations match your search' : 'No pickup stations available yet'}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((station: any) => (
            <div key={station.id} className="bg-white rounded-2xl shadow-card p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <MapPin size={20} className="text-green-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900">{station.name}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                    <MapPin size={12} /> {station.address}
                  </p>
                  {station.openHours && (
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <Clock size={12} /> {station.openHours}
                    </p>
                  )}
                  {station.phone && (
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                      <Phone size={12} /> {station.phone}
                    </p>
                  )}
                  {station.isActive && (
                    <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-green-primary bg-green-50 px-2 py-0.5 rounded-full">
                      <CheckCircle size={10} /> Active
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 bg-green-50 border border-green-200 rounded-2xl p-5">
        <h3 className="font-bold text-green-800 mb-2">How Pickup Works</h3>
        <ol className="space-y-2 text-sm text-green-700">
          <li className="flex items-start gap-2"><span className="font-bold">1.</span> Choose "Pickup Station" at checkout</li>
          <li className="flex items-start gap-2"><span className="font-bold">2.</span> Select your preferred station</li>
          <li className="flex items-start gap-2"><span className="font-bold">3.</span> You'll get an SMS/Telegram when your order is ready</li>
          <li className="flex items-start gap-2"><span className="font-bold">4.</span> Show your order ID at the station to collect</li>
        </ol>
      </div>
    </div>
  )
}
