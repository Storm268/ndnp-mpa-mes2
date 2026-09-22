// Import Leaflet CSS server-side so it's bundled correctly in Next.js App Router
import 'leaflet/dist/leaflet.css'

export default function MapsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}

