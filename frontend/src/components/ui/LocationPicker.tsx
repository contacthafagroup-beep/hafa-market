import { useState, useEffect, useRef } from 'react'
import { MapPin, Navigation, Loader } from 'lucide-react'
import { reverseGeocode } from '@/lib/geocode'

interface Location {
  lat: number
  lng: number
  address: string
  landmark: string
}

interface Props {
  value?: Location
  onChange: (loc: Location) => void
}

const HOSSANA_LANDMARKS = [
  'Near Hossana University Main Gate',
  'Near Hossana Commercial Bank',
  'Near Hossana Stadium',
  'Near Hossana Market (Gebeya)',
  'Near Hossana Health Center',
  'Near Hossana Bus Station',
  'Near Hossana Town Hall',
  'Near Nigist Eleni Hospital',
  'Near Hossana Preparatory School',
  'Near Wachemo University',
  'Other (describe below)',
]

export default function LocationPicker({ value, onChange }: Props) {
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [detected, setDetected]     = useState(false)
  const [landmark, setLandmark]     = useState(value?.landmark || '')
  const [customDesc, setCustomDesc] = useState('')
  const [lat, setLat]               = useState(value?.lat || 0)
  const [lng, setLng]               = useState(value?.lng || 0)
  const [address, setAddress]       = useState(value?.address || '')
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInst = useRef<any>(null)
  const markerRef = useRef<any>(null)

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }
    setLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords
        setLat(latitude)
        setLng(longitude)
        // Reverse geocode to get address
        const addr = await reverseGeocode(latitude, longitude)
        const resolvedAddr = addr || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
        setAddress(resolvedAddr)
        setDetected(true)
        setLoading(false)
        updateMap(latitude, longitude)
        onChange({ lat: latitude, lng: longitude, address: resolvedAddr, landmark })
      },
      err => {
        setLoading(false)
        if (err.code === 1) setError('Location access denied. Please allow location access or use a landmark.')
        else setError('Could not detect location. Please use a landmark instead.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const updateMap = (latitude: number, longitude: number) => {
    if (!mapRef.current) return
    import('leaflet').then(L => {
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (!mapInst.current) {
        const map = L.map(mapRef.current!).setView([latitude, longitude], 16)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
        }).addTo(map)

        const icon = L.divIcon({
          html: `<div style="background:#2E7D32;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;box-shadow:0 4px 12px rgba(46,125,50,.5);border:3px solid #fff">📍</div>`,
          className: '', iconSize: [36, 36], iconAnchor: [18, 36],
        })

        markerRef.current = L.marker([latitude, longitude], { icon, draggable: true }).addTo(map)
        markerRef.current.on('dragend', async (e: any) => {
          const { lat: newLat, lng: newLng } = e.target.getLatLng()
          setLat(newLat); setLng(newLng)
          const newAddr = await reverseGeocode(newLat, newLng)
          const resolved = newAddr || `${newLat.toFixed(5)}, ${newLng.toFixed(5)}`
          setAddress(resolved)
          onChange({ lat: newLat, lng: newLng, address: resolved, landmark })
        })
        mapInst.current = map
      } else {
        mapInst.current.setView([latitude, longitude], 16)
        markerRef.current?.setLatLng([latitude, longitude])
      }
    })
  }

  // Auto-detect on mount
  useEffect(() => {
    detectLocation()
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null } }
  }, [])

  const handleLandmarkChange = (val: string) => {
    setLandmark(val)
    const finalLandmark = val === 'Other (describe below)' ? customDesc : val
    onChange({ lat, lng, address, landmark: finalLandmark })
  }

  const handleCustomDesc = (val: string) => {
    setCustomDesc(val)
    onChange({ lat, lng, address, landmark: val })
  }

  return (
    <div className="space-y-4">
      {/* GPS Detection */}
      <div className={`rounded-2xl border-2 p-4 ${detected ? 'border-green-primary bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Navigation size={18} className={detected ? 'text-green-primary' : 'text-gray-400'} />
            <span className="font-bold text-sm text-gray-800">
              {detected ? '📍 Location Detected' : 'Detect My Location'}
            </span>
          </div>
          <button type="button" onClick={detectLocation} disabled={loading}
            className="flex items-center gap-2 bg-green-primary text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-green-dark transition-colors disabled:opacity-50">
            {loading ? <><Loader size={12} className="animate-spin" /> Detecting...</> : <><Navigation size={12} /> {detected ? 'Re-detect' : 'Use My Location'}</>}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600 mb-3">
            ⚠️ {error}
          </div>
        )}

        {detected && address && (
          <div className="bg-white rounded-xl p-3 border border-green-200">
            <p className="text-xs text-gray-500 mb-1">Detected address:</p>
            <p className="text-sm font-medium text-gray-800 line-clamp-2">{address}</p>
            <p className="text-xs text-green-600 mt-1">📌 You can drag the pin on the map to adjust</p>
          </div>
        )}
      </div>

      {/* Map */}
      {detected && (
        <div className="rounded-2xl overflow-hidden border border-gray-200">
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <div ref={mapRef} style={{ height: '220px', width: '100%' }} />
          <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 flex items-center gap-1">
            <MapPin size={11} /> Drag the pin to adjust your exact location
          </div>
        </div>
      )}

      {/* Landmark */}
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-2">
          📍 Nearest Landmark <span className="text-red-500">*</span>
        </label>
        <select value={landmark} onChange={e => handleLandmarkChange(e.target.value)}
          className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary bg-white">
          <option value="">Select a landmark...</option>
          {HOSSANA_LANDMARKS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {landmark === 'Other (describe below)' && (
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Describe your location</label>
          <input value={customDesc} onChange={e => handleCustomDesc(e.target.value)}
            placeholder="e.g. 200m past the main market, blue gate on the left"
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-green-primary" />
        </div>
      )}

      {/* Kebele / Woreda / Zone */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">Kebele</label>
          <input placeholder="e.g. 01"
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">Woreda</label>
          <input placeholder="e.g. Hossana"
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">Zone</label>
          <input placeholder="e.g. Hadiya"
            className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-primary" />
        </div>
      </div>

      {!detected && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-bold mb-1">📍 No GPS location detected</p>
          <p className="text-xs">Please select a landmark above so our delivery team can find you. You can also allow location access for more accurate delivery.</p>
        </div>
      )}
    </div>
  )
}
