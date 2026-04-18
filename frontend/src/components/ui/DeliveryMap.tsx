import { useEffect, useRef } from 'react'

interface Props {
  lat: number
  lng: number
  zoom?: number
  height?: string
  markerLabel?: string
  destinationLat?: number
  destinationLng?: number
}

export default function DeliveryMap({ lat, lng, zoom = 14, height = '300px', markerLabel = 'Delivery Location', destinationLat, destinationLng }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapInst   = useRef<any>(null)
  const markerRef = useRef<any>(null)

  useEffect(() => {
    if (!mapRef.current || mapInst.current) return

    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then(L => {
      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current!).setView([lat, lng], zoom)
      mapInst.current = map

      // OpenStreetMap tiles — completely free
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map)

      // Delivery agent marker (green)
      const agentIcon = L.divIcon({
        html: `<div style="background:#2E7D32;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.2rem;box-shadow:0 4px 12px rgba(46,125,50,.4);border:3px solid #fff">🚚</div>`,
        className: '',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      })

      markerRef.current = L.marker([lat, lng], { icon: agentIcon })
        .addTo(map)
        .bindPopup(`<strong>${markerLabel}</strong>`)

      // Destination marker (orange) if provided
      if (destinationLat && destinationLng) {
        const destIcon = L.divIcon({
          html: `<div style="background:#FFA726;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.1rem;box-shadow:0 4px 12px rgba(255,167,38,.4);border:3px solid #fff">📍</div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })
        L.marker([destinationLat, destinationLng], { icon: destIcon })
          .addTo(map)
          .bindPopup('<strong>Delivery Address</strong>')

        // Draw route line
        L.polyline([[lat, lng], [destinationLat, destinationLng]], {
          color: '#2E7D32', weight: 3, opacity: 0.7, dashArray: '8 6',
        }).addTo(map)

        // Fit bounds to show both markers
        map.fitBounds([[lat, lng], [destinationLat, destinationLng]], { padding: [40, 40] })
      }
    })

    return () => {
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
    }
  }, [])

  // Update marker position when lat/lng changes (live tracking)
  useEffect(() => {
    if (!mapInst.current || !markerRef.current) return
    import('leaflet').then(L => {
      markerRef.current.setLatLng([lat, lng])
      mapInst.current.panTo([lat, lng], { animate: true, duration: 1 })
    })
  }, [lat, lng])

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ height, width: '100%', borderRadius: '16px', overflow: 'hidden', zIndex: 0 }} />
    </>
  )
}
