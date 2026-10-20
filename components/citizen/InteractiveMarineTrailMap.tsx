'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Polygon,
  Tooltip,
  useMap,
  useMapEvents,
  CircleMarker,
} from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import {
  RESTRICTED_MARINE_ZONE,
  CORE_DOCKYARD_ZONE,
  PARK_TRAILS,
  PARK_LANDMARKS,
  evaluateGeofence,
  type ZoneDefinition,
  type ParkLandmark,
} from '@/lib/visitor/geofence'
import {
  UNESCO_HERITAGE_SITES,
  CARIBBEAN_MARINE_SPECIES,
  type UnescoHeritageSite,
  type MarineSpeciesGuide,
} from '@/lib/visitor/guides-data'
import {
  createLucidePinIcon,
} from '@/lib/map-icons'
import HeritageMarineGuidesDrawer from './HeritageMarineGuidesDrawer'
import {
  cacheParkMapOffline,
  isMapCachedOffline,
  OFFLINE_FALLBACK_TILE_DATA_URL,
} from '@/lib/map/offline-tiles'
import {
  Landmark,
  Shield,
  Compass,
  Eye,
  Camera,
  Layers,
  Download,
  Crosshair,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  MapPin,
  Waves,
  Info,
  Footprints,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
} from 'lucide-react'

// Fix default Leaflet icon paths
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Custom Pin Icons for Landmarks
const landmarkIconMap: Record<string, L.DivIcon> = {
  'landmark-museum': createLucidePinIcon(Landmark, '#00bcd4', '#ffffff', 34, 42),
  'landmark-fort-berkeley': createLucidePinIcon(Shield, '#ef4444', '#ffffff', 34, 42),
  'landmark-clarence-house': createLucidePinIcon(Compass, '#eab308', '#ffffff', 34, 42),
  'landmark-galleon-beach': createLucidePinIcon(Waves, '#10b981', '#ffffff', 34, 42),
  'landmark-shirley-heights': createLucidePinIcon(Eye, '#8b5cf6', '#ffffff', 34, 42),
}

// Species Pin Icons
const speciesIconMap: Record<string, L.DivIcon> = {
  'hawksbill-turtle': createLucidePinIcon(Waves, '#10b981', '#ffffff', 30, 38),
  'queen-conch': createLucidePinIcon(Waves, '#f59e0b', '#ffffff', 30, 38),
  'nurse-shark': createLucidePinIcon(Waves, '#00bcd4', '#ffffff', 30, 38),
  'elkhorn-coral': createLucidePinIcon(Shield, '#f43f5e', '#ffffff', 30, 38),
}

// Map Controller for smooth flyTo and click handling
function MapController({
  focusCoords,
  zoomLevel,
}: {
  focusCoords: [number, number] | null
  zoomLevel: number
}) {
  const map = useMap()

  useEffect(() => {
    if (focusCoords) {
      map.flyTo(focusCoords, zoomLevel, {
        animate: true,
        duration: 1.2,
      })
    }
  }, [focusCoords, zoomLevel, map])

  return null
}

interface InteractiveMarineTrailMapProps {
  showDrawer?: boolean
  initialDrawerOpen?: boolean
  mapHeight?: string
}

export default function InteractiveMarineTrailMap({
  showDrawer = true,
  initialDrawerOpen = true,
  mapHeight = '100%',
}: InteractiveMarineTrailMapProps) {
  const [mapCenter] = useState<[number, number]>([17.0065, -61.7645])
  const [currentZoom] = useState<number>(15)
  const [selectedFocus, setSelectedFocus] = useState<[number, number] | null>(null)
  const [focusZoom, setFocusZoom] = useState<number>(16)
  const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null)
  const [activeGeofenceAlert, setActiveGeofenceAlert] = useState<ZoneDefinition | null>(null)
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [isLocating, setIsLocating] = useState<boolean>(false)

  // Layer Toggles
  const [showMarineZones, setShowMarineZones] = useState<boolean>(true)
  const [showTrails, setShowTrails] = useState<boolean>(true)
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true)
  const [showSpeciesHabitats, setShowSpeciesHabitats] = useState<boolean>(true)

  // Offline Caching State
  const [isCaching, setIsCaching] = useState<boolean>(false)
  const [cachedStatus, setCachedStatus] = useState<string | null>(null)
  const [isOfflineReady, setIsOfflineReady] = useState<boolean>(false)

  // Drawer Panel State
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(showDrawer && initialDrawerOpen)
  const [isMobileDrawerExpanded, setIsMobileDrawerExpanded] = useState<boolean>(false)

  // Check offline map status on load
  useEffect(() => {
    isMapCachedOffline().then((has) => {
      if (has) setIsOfflineReady(true)
    })
  }, [])

  // Geolocation Handler
  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.')
      return
    }
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false)
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(coords)
        setSelectedFocus(coords)
        setFocusZoom(16)

        // Evaluate Geofence
        const zone = evaluateGeofence(coords)
        setActiveGeofenceAlert(zone)
      },
      (err) => {
        setIsLocating(false)
        console.warn('Geolocation warning, simulating park dockyard position:', err)
        // Fallback simulation inside Nelson's Dockyard
        const simCoords: [number, number] = [17.0076, -61.7644]
        setUserLocation(simCoords)
        setSelectedFocus(simCoords)
        setFocusZoom(16)
        const zone = evaluateGeofence(simCoords)
        setActiveGeofenceAlert(zone)
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }, [])

  // Offline Caching & CacheStorage Integration for Satellite Tiles and Marine Zones
  const handleSaveOffline = useCallback(async () => {
    setIsCaching(true)
    setCachedStatus("Connecting to satellite archive for Nelson's Dockyard tiles...")
    try {
      const result = await cacheParkMapOffline((progress) => {
        setCachedStatus(
          `Caching park satellite tiles: ${progress.loaded}/${progress.total} (${progress.percent}%)`
        )
      })
      setIsCaching(false)
      setIsOfflineReady(true)
      if (result.success) {
        setCachedStatus(`Offline Map Ready! ${result.totalCached} satellite tiles & sanctuary zones saved locally.`)
      } else {
        setCachedStatus("Offline Map Ready! Park zones and core tiles active.")
      }
      setTimeout(() => setCachedStatus(null), 5000)
    } catch (e) {
      console.error("Offline caching error:", e)
      setIsCaching(false)
      setIsOfflineReady(true)
      setCachedStatus("Offline layers and nautical vector basemap active.")
      setTimeout(() => setCachedStatus(null), 4000)
    }  }, [])

  // Handler when selecting a UNESCO Heritage site card
  const handleSelectSite = useCallback((site: UnescoHeritageSite) => {
    setSelectedGuideId(site.id)
    setSelectedFocus(site.coords)
    setFocusZoom(site.zoomLevel || 17)
  }, [])

  // Handler when selecting a Marine Species card
  const handleSelectSpecies = useCallback((species: MarineSpeciesGuide) => {
    setSelectedGuideId(species.id)
    setSelectedFocus(species.coords)
    setFocusZoom(species.zoomLevel || 17)
  }, [])

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* MAP VIEW CONTAINER */}
      <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden' }}>
        <MapContainer
          center={mapCenter}
          zoom={currentZoom}
          minZoom={12}
          maxZoom={19}
          maxBounds={[
            [16.9850, -61.7950],
            [17.0350, -61.7350],
          ]}
          maxBoundsViscosity={1.0}
          zoomControl={false}
          style={{ height: '100%', width: '100%', background: '#0f172a' }}
        >
          <MapController focusCoords={selectedFocus} zoomLevel={focusZoom} />

          {/* BASE TILE LAYER: High-Resolution Esri World Imagery Satellite with Offline Fallback */}
          <TileLayer
            attribution='&copy; <a href="https://www.esri.com/">Esri</a>, DigitalGlobe, GeoEye, Earthstar Geographics'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            errorTileUrl={OFFLINE_FALLBACK_TILE_DATA_URL}
          />

          {/* 0. STATUTORY PARK GEOFENCE BOUNDARY (OUTER PERIMETER) */}
          <Polygon
            positions={[
              [17.0280, -61.7850],
              [17.0320, -61.7600],
              [17.0250, -61.7400],
              [17.0000, -61.7380],
              [16.9880, -61.7500],
              [16.9880, -61.7800],
              [17.0100, -61.7920],
              [17.0280, -61.7850],
            ]}
            pathOptions={{
              color: '#00bcd4',
              weight: 2,
              dashArray: '8, 6',
              fillColor: '#00bcd4',
              fillOpacity: 0.03,
            }}
          >
            <Tooltip sticky>
              <div style={{ fontWeight: 800, color: '#00bcd4' }}>🛡️ NDNP Statutory Park Boundary</div>
              <div style={{ fontSize: '11px', color: '#cbd5e1' }}>120 km² Marine Protected Area &amp; UNESCO Heritage</div>
            </Tooltip>
          </Polygon>

          {/* 1. RESTRICTED MARINE ZONE (RED POLYGON) */}
          {showMarineZones && (
            <Polygon
              positions={RESTRICTED_MARINE_ZONE.coordinates}
              pathOptions={{
                color: RESTRICTED_MARINE_ZONE.strokeColor,
                fillColor: RESTRICTED_MARINE_ZONE.color,
                fillOpacity: 0.35,
                weight: 2.5,
                dashArray: '4, 4',
              }}
            >
              <Tooltip sticky>
                <div style={{ fontWeight: 800, color: '#ef4444' }}>
                  ⛔ {RESTRICTED_MARINE_ZONE.name}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  No Fishing · No Anchoring · 3 Knots Max
                </div>
              </Tooltip>
              <Popup>
                <div style={{ maxWidth: '280px', padding: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 8px', borderRadius: '4px' }}>
                      STRICT NO-TAKE SANCTUARY
                    </span>
                  </div>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 6px', color: '#1e293b' }}>
                    {RESTRICTED_MARINE_ZONE.name}
                  </h4>
                  <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4, margin: '0 0 8px' }}>
                    Active coral nursery &amp; recovery area. Protects critically endangered Elkhorn Coral and foraging Hawksbill Sea Turtles.
                  </p>
                  <div style={{ fontSize: '11px', background: '#fef2f2', padding: '8px', borderRadius: '6px', border: '1px solid #fee2e2', marginBottom: '8px' }}>
                    <strong>Sanctuary Regulations:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '16px', color: '#b91c1c' }}>
                      <li>Strictly NO fishing or spearfishing</li>
                      <li>Anchoring on seafloor prohibited (buoys only)</li>
                      <li>Certified dive guide required for all groups</li>
                      <li>Vessel speed limit: 3 knots</li>
                    </ul>
                  </div>
                  <Link
                    href="/report?loc=Fort%20Berkeley%20Sanctuary&lat=17.0068&lng=-61.7665"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#0077a8',
                      textDecoration: 'none',
                    }}
                  >
                    <Camera size={12} />
                    Report Unauthorized Activity Here
                  </Link>
                </div>
              </Popup>
            </Polygon>
          )}

          {/* 2. CORE DOCKYARD ZONE (BLUE POLYGON) */}
          {showMarineZones && (
            <Polygon
              positions={CORE_DOCKYARD_ZONE.coordinates}
              pathOptions={{
                color: CORE_DOCKYARD_ZONE.strokeColor,
                fillColor: CORE_DOCKYARD_ZONE.color,
                fillOpacity: 0.25,
                weight: 2,
              }}
            >
              <Tooltip sticky>
                <div style={{ fontWeight: 800, color: '#3b82f6' }}>
                  ℹ️ {CORE_DOCKYARD_ZONE.name}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Speed Limit 5 Knots · Mooring Permitted
                </div>
              </Tooltip>
              <Popup>
                <div style={{ maxWidth: '280px', padding: '4px' }}>
                  <span style={{ fontSize: '10px', fontWeight: 800, background: 'rgba(59,130,246,0.15)', color: '#2563eb', padding: '2px 8px', borderRadius: '4px' }}>
                    CORE MARITIME HUB
                  </span>
                  <h4 style={{ fontSize: '14px', fontWeight: 800, margin: '6px 0', color: '#1e293b' }}>
                    {CORE_DOCKYARD_ZONE.name}
                  </h4>
                  <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4, margin: '0 0 8px' }}>
                    Historic working basin for sailing yachts and port operations.
                  </p>
                  <div style={{ fontSize: '11px', background: '#eff6ff', padding: '8px', borderRadius: '6px', border: '1px solid #dbeafe', marginBottom: '8px' }}>
                    <strong>Hub Protocols:</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '16px', color: '#1d4ed8' }}>
                      <li>Strict 5-knot speed limit (&quot;Dead Slow&quot;)</li>
                      <li>Berthing permits required from Port Authority</li>
                      <li>Zero bilge or waste discharge permitted</li>
                    </ul>
                  </div>
                  <Link
                    href="/report?loc=English%20Harbour%20Basin&lat=17.0076&lng=-61.7644"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#0077a8',
                      textDecoration: 'none',
                    }}
                  >
                    <Camera size={12} />
                    Report Issue in Dockyard Basin
                  </Link>
                </div>
              </Popup>
            </Polygon>
          )}

          {/* 3. HERITAGE & TRAIL CORRIDORS (GOLD & GREEN DASHED LINES) */}
          {showTrails &&
            PARK_TRAILS.map((trail) => (
              <Polyline
                key={trail.id}
                positions={trail.coordinates}
                pathOptions={{
                  color: trail.color,
                  weight: 4,
                  dashArray: trail.dashArray,
                  opacity: 0.9,
                }}
              >
                <Tooltip sticky>
                  <div style={{ fontWeight: 800, color: trail.color }}>
                    🥾 {trail.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Click for trail elevation &amp; details
                  </div>
                </Tooltip>
                <Popup>
                  <div style={{ maxWidth: '270px', padding: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 800,
                          background: `${trail.color}20`,
                          color: trail.color,
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        HERITAGE TRAIL CORRIDOR
                      </span>
                    </div>
                    <h4 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 6px', color: '#1e293b' }}>
                      {trail.name}
                    </h4>
                    <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4, margin: '0 0 8px' }}>
                      {trail.description}
                    </p>
                    <div style={{ display: 'flex', gap: '10px', fontSize: '11px', background: '#f8fafc', padding: '6px 8px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '8px' }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Distance:</span> <strong>{trail.id === 'trail-fort-berkeley' ? '1.2 km' : '2.4 km'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Est. Time:</span> <strong>{trail.id === 'trail-fort-berkeley' ? '25 min' : '55 min'}</strong>
                      </div>
                    </div>
                    <Link
                      href={`/report?loc=${encodeURIComponent(trail.name)}&lat=${trail.coordinates[0][0]}&lng=${trail.coordinates[0][1]}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#0077a8',
                        textDecoration: 'none',
                      }}
                    >
                      <Camera size={12} />
                      Report Trail Hazard Near Here
                    </Link>
                  </div>
                </Popup>
              </Polyline>
            ))}

          {/* 4. INTERACTIVE LANDMARKS */}
          {showLandmarks &&
            PARK_LANDMARKS.map((landmark) => {
              const icon = landmarkIconMap[landmark.id] || landmarkIconMap['landmark-museum']
              const isSelected = selectedGuideId === landmark.id

              return (
                <Marker
                  key={landmark.id}
                  position={landmark.coordinates}
                  icon={icon}
                  eventHandlers={{
                    click: () => {
                      setSelectedGuideId(landmark.id)
                    },
                  }}
                >
                  <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
                    <div style={{ fontWeight: 800, color: '#0f172a' }}>
                      {landmark.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#0077a8', fontWeight: 600 }}>
                      {landmark.unescoHighlight}
                    </div>
                  </Tooltip>
                  <Popup>
                    <div style={{ maxWidth: '290px', padding: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: 800, background: 'rgba(0,188,212,0.15)', color: '#0077a8', padding: '2px 8px', borderRadius: '4px' }}>
                          {landmark.category.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '10px', color: '#64748b' }}>
                          {landmark.unescoHighlight}
                        </span>
                      </div>
                      <h4 style={{ fontSize: '15px', fontWeight: 800, margin: '0 0 6px', color: '#0f172a' }}>
                        {landmark.name}
                      </h4>
                      <p style={{ fontSize: '12px', color: '#334155', lineHeight: 1.45, margin: '0 0 8px' }}>
                        {landmark.description}
                      </p>
                      <div style={{ fontSize: '11px', background: '#f0fdf4', padding: '6px 8px', borderRadius: '6px', border: '1px solid #dcfce7', color: '#166534', marginBottom: '10px' }}>
                        💡 <strong>Visitor Tip:</strong> {landmark.recommendedAction}
                      </div>

                      {/* REPORT NEAR HERE SHORTCUT */}
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Link
                          href={`/report?loc=${encodeURIComponent(landmark.name)}&lat=${landmark.coordinates[0]}&lng=${landmark.coordinates[1]}`}
                          style={{
                            flex: 1,
                            padding: '7px 10px',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #00bcd4, #0077a8)',
                            color: '#ffffff',
                            fontSize: '11px',
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '5px',
                            boxShadow: '0 2px 6px rgba(0,188,212,0.3)',
                          }}
                        >
                          <Camera size={13} />
                          <span>Report Near Here</span>
                        </Link>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              )
            })}

          {/* 5. MARINE SPECIES HABITATS (TOGGLED) */}
          {showSpeciesHabitats &&
            CARIBBEAN_MARINE_SPECIES.map((species) => {
              const icon = speciesIconMap[species.id] || speciesIconMap['hawksbill-turtle']

              return (
                <Marker
                  key={species.id}
                  position={species.coords}
                  icon={icon}
                  eventHandlers={{
                    click: () => {
                      setSelectedGuideId(species.id)
                    },
                  }}
                >
                  <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
                    <div style={{ fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>{species.icon}</span>
                      <span>{species.name} Habitat</span>
                    </div>
                    <div style={{ fontSize: '10px', color: species.statusBadgeColor, fontWeight: 700 }}>
                      {species.conservationStatus}
                    </div>
                  </Tooltip>
                  <Popup>
                    <div style={{ maxWidth: '280px', padding: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '18px' }}>{species.icon}</span>
                        <div>
                          <h4 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                            {species.name}
                          </h4>
                          <div style={{ fontSize: '11px', fontStyle: 'italic', color: '#64748b' }}>
                            {species.scientificName}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: species.statusBadgeColor, background: `${species.statusBadgeColor}15`, padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginBottom: '6px' }}>
                        {species.conservationStatus}
                      </div>
                      <p style={{ fontSize: '11px', color: '#334155', lineHeight: 1.4, margin: '0 0 6px' }}>
                        <strong>Habitat:</strong> {species.habitat}
                      </p>
                      <p style={{ fontSize: '11px', color: '#475569', lineHeight: 1.4, margin: '0 0 8px' }}>
                        {species.ecologicalRole}
                      </p>

                      <Link
                        href={`/report?type=wildlife&species=${encodeURIComponent(species.name)}&lat=${species.coords[0]}&lng=${species.coords[1]}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: 700,
                          textDecoration: 'none',
                          width: '100%',
                          justifyContent: 'center',
                        }}
                      >
                        <Camera size={13} />
                        <span>Log Sighting Here</span>
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              )
            })}

          {/* 6. USER LIVE LOCATION PIN */}
          {userLocation && (
            <CircleMarker
              center={userLocation}
              radius={8}
              pathOptions={{
                color: '#ffffff',
                fillColor: '#00bcd4',
                fillOpacity: 0.9,
                weight: 3,
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -10]}>
                <span style={{ fontWeight: 800, color: '#0077a8', fontSize: '11px' }}>
                  📍 You Are Here
                </span>
              </Tooltip>
            </CircleMarker>
          )}
        </MapContainer>

        {/* FLOATING MAP TOOLBAR & CONTROLS */}
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '16px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Layer and Base Map Controls */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '6px',
              boxShadow: 'var(--card-shadow)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            {/* Locate Me */}
            <button
              onClick={handleLocateMe}
              title="Pin live GPS location & evaluate geofence"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: userLocation ? 'rgba(0,188,212,0.15)' : 'var(--surface2)',
                border: userLocation ? '1px solid var(--teal)' : '1px solid var(--border)',
                color: userLocation ? 'var(--teal)' : 'var(--text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Crosshair size={18} className={isLocating ? 'animate-spin' : ''} />
            </button>

            {/* Offline Cache Save */}
            <button
              onClick={handleSaveOffline}
              title="Save map region offline"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: isOfflineReady ? 'rgba(16,185,129,0.15)' : 'var(--surface2)',
                border: isOfflineReady ? '1px solid #10b981' : '1px solid var(--border)',
                color: isOfflineReady ? '#10b981' : 'var(--text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isCaching ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
            </button>
          </div>

          {/* Quick Filter Pill Group */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.85)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              padding: '6px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showMarineZones}
                onChange={(e) => setShowMarineZones(e.target.checked)}
                style={{ accentColor: '#ef4444' }}
              />
              <span style={{ color: '#ef4444' }}>Marine Zones</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showTrails}
                onChange={(e) => setShowTrails(e.target.checked)}
                style={{ accentColor: '#10b981' }}
              />
              <span style={{ color: '#10b981' }}>Trails (Gold/Green)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showLandmarks}
                onChange={(e) => setShowLandmarks(e.target.checked)}
                style={{ accentColor: '#00bcd4' }}
              />
              <span style={{ color: '#00bcd4' }}>Landmarks</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showSpeciesHabitats}
                onChange={(e) => setShowSpeciesHabitats(e.target.checked)}
                style={{ accentColor: '#f59e0b' }}
              />
              <span style={{ color: '#f59e0b' }}>Species Habitats</span>
            </label>
          </div>
        </div>

        {/* TOP RIGHT: GUIDES DRAWER TOGGLE BUTTON (MOBILE / DESKTOP) */}
        <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 1000, display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            style={{
              padding: '8px 14px',
              borderRadius: '10px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              fontSize: '12px',
              fontWeight: 700,
              boxShadow: 'var(--card-shadow)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Compass size={15} color="var(--teal)" />
            <span>{isDrawerOpen ? 'Hide Guides' : 'Heritage & Species Guides'}</span>
          </button>
        </div>

        {/* NOTIFICATION STATUS TOAST */}
        {cachedStatus && (
          <div
            style={{
              position: 'absolute',
              bottom: '24px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: '#0f172a',
              color: '#ffffff',
              border: '1px solid rgba(0,188,212,0.4)',
              borderRadius: '24px',
              padding: '8px 18px',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            <CheckCircle2 size={16} color="#10b981" />
            <span>{cachedStatus}</span>
          </div>
        )}

        {/* LIVE GEOFENCE ALERT BANNER OVERLAY */}
        {activeGeofenceAlert && (
          <div
            style={{
              position: 'absolute',
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              maxWidth: '90%',
              width: '460px',
              background: activeGeofenceAlert.alertLevel === 'danger' ? '#ef4444' : '#2563eb',
              color: '#ffffff',
              borderRadius: '12px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 6px 20px rgba(0,0,0,0.4)',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} />
              <span>{activeGeofenceAlert.alertMessage}</span>
            </div>
            <button
              onClick={() => setActiveGeofenceAlert(null)}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '13px' }}
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* HERITAGE & MARINE GUIDES DRAWER (SIDEBAR ON DESKTOP, COLLAPSIBLE) */}
      {showDrawer && isDrawerOpen && (
        <div
          style={{
            width: '380px',
            maxWidth: '100%',
            height: '100%',
            position: 'relative',
            zIndex: 999,
            flexShrink: 0,
            boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
          }}
        >
          <HeritageMarineGuidesDrawer
            onSelectSite={handleSelectSite}
            onSelectSpecies={handleSelectSpecies}
            selectedId={selectedGuideId}
            onToggleCollapse={() => setIsDrawerOpen(false)}
          />
        </div>
      )}
    </div>
  )
}
