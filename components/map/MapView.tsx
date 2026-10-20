'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline, Polygon, GeoJSON, useMapEvents, useMap, ZoomControl } from 'react-leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import L, { divIcon } from 'leaflet'
import { createClient } from '@/lib/supabase/client'
import {
  cacheParkMapOffline,
  isMapCachedOffline,
  OFFLINE_FALLBACK_TILE_DATA_URL,
} from '@/lib/map/offline-tiles'
import {
  getGisPointIcon,
  getMonitoringStationIcon,
  getHeritageSiteIcon,
  getWildlifeIcon,
  getIncidentBadgeIcon,
  PATROL_ICONS,
  getLayerGlyph,
  getUserLocationIcon,
} from '@/lib/map-icons'

// Override default Leaflet icon settings to use original Leaflet default icons via CDN as fallback
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// ── Data types ────────────────────────────────────────────────
interface Station  { id: string; station_code: string; name: string; lat: number; lng: number; station_type: string }
interface Heritage { id: string; site_code: string; name: string; lat: number; lng: number; current_condition: number; site_type: string }
interface Patrol   { id: string; ranger_id: string; patrol_type: string; start_lat: number; start_lng: number; end_lat: number | null; end_lng: number | null; start_time: string; is_active: boolean; sector: string | null; profiles?: { full_name: string } | null }
interface CSReport { id: string; report_type: string; species_type: string | null; incident_type: string | null; severity: number | null; gps_lat: number; gps_lng: number; validation_status: string; created_at: string; behavior: string | null }

// ── Park GIS layer ───────────────────────────────────────────
interface ParkLayer {
  id: string
  name: string
  description: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geojson: any
  color: string
  opacity: number
  is_visible: boolean
  created_at: string
  file_name: string | null
  feature_count: number | null
}

const COND       = ['', 'Critical', 'Poor', 'Fair', 'Good', 'Excellent']
const COND_COLOR = ['', '#ef4444', '#ea580c', '#f59e0b', '#22c55e', '#0d9488']

// ── Fallback datasets for Nelson's Dockyard National Park ──────
const FALLBACK_STATIONS: Station[] = [
  { id: 'fb-st-1', station_code: 'WQ-EH01', name: 'English Harbour Basin', lat: 17.0065, lng: -61.7645, station_type: 'marine' },
  { id: 'fb-st-2', station_code: 'WQ-FB02', name: "Freeman's Bay Coral Reef", lat: 17.0018, lng: -61.7630, station_type: 'reef' },
  { id: 'fb-st-3', station_code: 'WQ-SH03', name: 'Shirley Heights Atmospheric', lat: 17.0008, lng: -61.7519, station_type: 'terrestrial' },
  { id: 'fb-st-4', station_code: 'WQ-GB04', name: 'Galleon Beach Coastal Sensor', lat: 17.0028, lng: -61.7602, station_type: 'coastal' },
  { id: 'fb-st-5', station_code: 'WQ-CH05', name: 'Clarence House Mangrove Watch', lat: 17.0090, lng: -61.7615, station_type: 'mangrove' },
  { id: 'fb-st-6', station_code: 'WQ-FB06', name: 'Fort Berkeley Marine Outpost', lat: 17.0035, lng: -61.7672, station_type: 'marine' },
  { id: 'fb-st-7', station_code: 'WQ-FH07', name: 'Falmouth Outer Channel Buoy', lat: 17.0125, lng: -61.7760, station_type: 'marine' },
  { id: 'fb-st-8', station_code: 'WQ-MG08', name: 'Middle Ground Sensor Station', lat: 17.0042, lng: -61.7655, station_type: 'terrestrial' },
]

const FALLBACK_HERITAGE: Heritage[] = [
  { id: 'fb-hs-1', site_code: 'ND-01', name: "Nelson's Dockyard Historic Core", lat: 17.0076, lng: -61.7645, current_condition: 5, site_type: 'historic_dockyard' },
  { id: 'fb-hs-2', site_code: 'ND-02', name: 'Clarence House', lat: 17.0089, lng: -61.7612, current_condition: 4, site_type: 'governor_residence' },
  { id: 'fb-hs-3', site_code: 'ND-03', name: 'Fort Berkeley & Gun Battery', lat: 17.0033, lng: -61.7674, current_condition: 3, site_type: 'fortification' },
  { id: 'fb-hs-4', site_code: 'ND-04', name: 'Shirley Heights Lookout', lat: 17.0008, lng: -61.7519, current_condition: 4, site_type: 'military_outpost' },
  { id: 'fb-hs-5', site_code: 'ND-05', name: 'Blockhouse Military Ruins', lat: 17.0032, lng: -61.7485, current_condition: 3, site_type: 'military_ruins' },
  { id: 'fb-hs-6', site_code: 'ND-06', name: "Dow's Hill Interpretation Centre", lat: 17.0145, lng: -61.7580, current_condition: 5, site_type: 'interpretation_centre' },
  { id: 'fb-hs-7', site_code: 'ND-07', name: 'Naval Capstan House', lat: 17.0071, lng: -61.7642, current_condition: 4, site_type: 'naval_heritage' },
  { id: 'fb-hs-8', site_code: 'ND-08', name: 'Sail Loft & Copper Store', lat: 17.0074, lng: -61.7638, current_condition: 5, site_type: 'naval_store' },
  { id: 'fb-hs-9', site_code: 'ND-09', name: "Officers' Quarters & Mess", lat: 17.0069, lng: -61.7649, current_condition: 4, site_type: 'barracks' },
  { id: 'fb-hs-10', site_code: 'ND-10', name: 'Old Naval Hospital Site', lat: 17.0095, lng: -61.7592, current_condition: 2, site_type: 'hospital_ruins' },
]

const FALLBACK_WILDLIFE: CSReport[] = [
  { id: 'fb-wl-1', report_type: 'wildlife_sighting', species_type: 'Hawksbill Sea Turtle', incident_type: null, severity: null, gps_lat: 17.0022, gps_lng: -61.7612, validation_status: 'approved', created_at: new Date(Date.now() - 3600000).toISOString(), behavior: 'Foraging on seagrass bed' },
  { id: 'fb-wl-2', report_type: 'wildlife_sighting', species_type: 'Green Sea Turtle', incident_type: null, severity: null, gps_lat: 17.0030, gps_lng: -61.7625, validation_status: 'approved', created_at: new Date(Date.now() - 7200000).toISOString(), behavior: 'Surfacing for air near Freeman Bay' },
  { id: 'fb-wl-3', report_type: 'wildlife_sighting', species_type: 'Spotted Eagle Ray', incident_type: null, severity: null, gps_lat: 17.0051, gps_lng: -61.7658, validation_status: 'approved', created_at: new Date(Date.now() - 14400000).toISOString(), behavior: 'Gliding along harbour basin entry' },
  { id: 'fb-wl-4', report_type: 'wildlife_sighting', species_type: 'Magnificent Frigatebird', incident_type: null, severity: null, gps_lat: 17.0018, gps_lng: -61.7530, validation_status: 'approved', created_at: new Date(Date.now() - 21600000).toISOString(), behavior: 'Thermals above Shirley Heights cliffs' },
  { id: 'fb-wl-5', report_type: 'wildlife_sighting', species_type: 'Brown Pelican', incident_type: null, severity: null, gps_lat: 17.0040, gps_lng: -61.7668, validation_status: 'approved', created_at: new Date(Date.now() - 28800000).toISOString(), behavior: 'Plunge diving for silversides' },
  { id: 'fb-wl-6', report_type: 'wildlife_sighting', species_type: 'Nurse Shark', incident_type: null, severity: null, gps_lat: 17.0012, gps_lng: -61.7635, validation_status: 'approved', created_at: new Date(Date.now() - 43200000).toISOString(), behavior: 'Resting on sand patch in reef' },
  { id: 'fb-wl-7', report_type: 'wildlife_sighting', species_type: 'Antillean Crested Hummingbird', incident_type: null, severity: null, gps_lat: 17.0080, gps_lng: -61.7610, validation_status: 'approved', created_at: new Date(Date.now() - 50400000).toISOString(), behavior: 'Feeding on hibiscus flowers' },
  { id: 'fb-wl-8', report_type: 'wildlife_sighting', species_type: 'Red-billed Tropicbird', incident_type: null, severity: null, gps_lat: 17.0005, gps_lng: -61.7490, validation_status: 'approved', created_at: new Date(Date.now() - 60000000).toISOString(), behavior: 'Courting flight along southern sea cliffs' },
  { id: 'fb-wl-9', report_type: 'wildlife_sighting', species_type: 'Bottlenose Dolphin', incident_type: null, severity: null, gps_lat: 17.0002, gps_lng: -61.7690, validation_status: 'approved', created_at: new Date(Date.now() - 72000000).toISOString(), behavior: 'Pod of 4 traveling west' },
  { id: 'fb-wl-10', report_type: 'wildlife_sighting', species_type: 'Elkhorn Coral Colony', incident_type: null, severity: null, gps_lat: 17.0018, gps_lng: -61.7620, validation_status: 'approved', created_at: new Date(Date.now() - 86400000).toISOString(), behavior: 'Healthy vibrant growth cluster' },
]

const FALLBACK_INCIDENTS: CSReport[] = [
  { id: 'fb-in-1', report_type: 'environmental_incident', species_type: null, incident_type: 'Fuel Sheen / Oil Leak', severity: 4, gps_lat: 17.0065, gps_lng: -61.7650, validation_status: 'approved', created_at: new Date(Date.now() - 10800000).toISOString(), behavior: null },
  { id: 'fb-in-2', report_type: 'environmental_incident', species_type: null, incident_type: 'Anchor Damage on Coral', severity: 4, gps_lat: 17.0020, gps_lng: -61.7622, validation_status: 'approved', created_at: new Date(Date.now() - 25000000).toISOString(), behavior: null },
  { id: 'fb-in-3', report_type: 'environmental_incident', species_type: null, incident_type: 'Marine Debris / Plastic Waste', severity: 2, gps_lat: 17.0045, gps_lng: -61.7680, validation_status: 'approved', created_at: new Date(Date.now() - 36000000).toISOString(), behavior: null },
  { id: 'fb-in-4', report_type: 'environmental_incident', species_type: null, incident_type: 'Unauthorized Jet Ski in Swim Zone', severity: 3, gps_lat: 17.0055, gps_lng: -61.7635, validation_status: 'approved', created_at: new Date(Date.now() - 48000000).toISOString(), behavior: null },
  { id: 'fb-in-5', report_type: 'environmental_incident', species_type: null, incident_type: 'Coastal Trail Erosion', severity: 2, gps_lat: 17.0025, gps_lng: -61.7595, validation_status: 'approved', created_at: new Date(Date.now() - 70000000).toISOString(), behavior: null },
]

const FALLBACK_PATROLS: Patrol[] = [
  { id: 'fb-pt-1', ranger_id: 'r-1', patrol_type: 'boat', start_lat: 17.0068, start_lng: -61.7640, end_lat: 17.0010, end_lng: -61.7680, start_time: new Date(Date.now() - 1800000).toISOString(), is_active: true, sector: 'English Harbour & Freeman Bay', profiles: { full_name: 'Ranger Marcus' } },
  { id: 'fb-pt-2', ranger_id: 'r-2', patrol_type: 'foot', start_lat: 17.0080, start_lng: -61.7642, end_lat: 17.0012, end_lng: -61.7520, start_time: new Date(Date.now() - 7200000).toISOString(), is_active: false, sector: 'Middle Ground to Shirley Heights', profiles: { full_name: 'Ranger Sarah' } },
]

// ── GIS GeoJSON separation helper (Points vs Polygons/Lines) ──
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractGisFeatures(geojson: any) {
  if (!geojson) return { pointFeatures: [], nonPointGeojson: null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawFeatures: any[] = []
  if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) {
    rawFeatures = geojson.features
  } else if (geojson.type === 'Feature') {
    rawFeatures = [geojson]
  } else if (Array.isArray(geojson)) {
    rawFeatures = geojson
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pointFeatures: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nonPointFeatures: any[] = []

  for (const f of rawFeatures) {
    if (!f || !f.geometry) continue
    const t = f.geometry.type
    if (t === 'Point' || t === 'MultiPoint') {
      pointFeatures.push(f)
    } else {
      nonPointFeatures.push(f)
    }
  }

  const nonPointGeojson = nonPointFeatures.length > 0 ? {
    type: 'FeatureCollection' as const,
    features: nonPointFeatures
  } : null

  return { pointFeatures, nonPointGeojson }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFeaturePointCoords(feature: any): [number, number] | null {
  if (!feature || !feature.geometry) return null
  const { type, coordinates } = feature.geometry
  if (type === 'Point' && Array.isArray(coordinates) && coordinates.length >= 2) {
    const lng = Number(coordinates[0])
    const lat = Number(coordinates[1])
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng]
  }
  if (type === 'MultiPoint' && Array.isArray(coordinates) && Array.isArray(coordinates[0])) {
    const lng = Number(coordinates[0][0])
    const lat = Number(coordinates[0][1])
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng]
  }
  return null
}

// ── Custom cluster icon generator for leaflet.markercluster ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createClusterIcon(cluster: any) {
  const count = cluster.getChildCount()
  let size = 36
  let bg = '#0d9488'
  let ring = 'rgba(13, 148, 136, 0.45)'
  let border = '#2dd4bf'

  if (count >= 50) {
    size = 46
    bg = '#dc2626'
    ring = 'rgba(220, 38, 38, 0.45)'
    border = '#f87171'
  } else if (count >= 20) {
    size = 42
    bg = '#ea580c'
    ring = 'rgba(234, 88, 12, 0.45)'
    border = '#fb923c'
  } else if (count >= 10) {
    size = 38
    bg = '#d97706'
    ring = 'rgba(217, 119, 6, 0.45)'
    border = '#fbbf24'
  }

  return divIcon({
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${bg};
        border: 2px solid #ffffff;
        box-shadow: 0 0 0 3px ${border}, 0 4px 12px ${ring}, 0 2px 6px rgba(0,0,0,0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #ffffff;
        font-family: system-ui, -apple-system, sans-serif;
        font-weight: 800;
        font-size: ${size >= 42 ? 14 : 12}px;
        line-height: 1;
        cursor: pointer;
        user-select: none;
      ">
        <span>${count}</span>
      </div>
    `,
    className: 'custom-map-icon cluster-icon-container',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

// ── Native Leaflet Marker Cluster Component ───────────────────
// Directly manages L.markerClusterGroup without React 19 reconciliation issues
interface NativeClusterLayerProps {
  clusteringEnabled: boolean
  stations: Station[]
  heritage: Heritage[]
  wildlife: CSReport[]
  incidents: CSReport[]
  parkLayers: ParkLayer[]
  show: { stations: boolean; heritage: boolean; patrols: boolean; wildlife: boolean; incidents: boolean }
}

function NativeClusterLayer({
  clusteringEnabled,
  stations,
  heritage,
  wildlife,
  incidents,
  parkLayers,
  show,
}: NativeClusterLayerProps) {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    // Instantiate native L.markerClusterGroup if clustering is enabled and available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mcg: any = (clusteringEnabled && typeof (L as any).markerClusterGroup === 'function')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (L as any).markerClusterGroup({
          chunkedLoading: true,
          iconCreateFunction: createClusterIcon,
          maxClusterRadius: 65,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          animate: true,
        })
      : L.featureGroup()

    // 1. Monitoring Stations
    if (show.stations) {
      stations.forEach(s => {
        if (typeof s.lat !== 'number' || typeof s.lng !== 'number') return
        const m = L.marker([s.lat, s.lng], {
          icon: getMonitoringStationIcon(s.station_type),
          title: `${s.name} (${s.station_code})`,
        })
        m.bindTooltip(
          `<span style="font-weight:600">${s.name}</span> · <span style="text-transform:capitalize">${s.station_type.replace('_', ' ')}</span>`,
          { direction: 'top', offset: [0, -42], opacity: 0.95 }
        )
        m.bindPopup(`
          <div style="font-family:system-ui;min-width:160px;">
            <div style="font-weight:700;font-size:13px;color:#0d9488;margin-bottom:3px;">${s.station_code}</div>
            <div style="font-weight:600;font-size:12px;margin-bottom:5px;">${s.name}</div>
            <div style="font-size:11px;color:#64748b;text-transform:capitalize;">${s.station_type.replace('_', ' ')} Station</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:4px;">${s.lat.toFixed(4)}°N, ${s.lng.toFixed(4)}°W</div>
          </div>
        `)
        mcg.addLayer(m)
      })
    }

    // 2. Heritage Sites
    if (show.heritage) {
      heritage.forEach(h => {
        if (typeof h.lat !== 'number' || typeof h.lng !== 'number') return
        const m = L.marker([h.lat, h.lng], {
          icon: getHeritageSiteIcon(h.current_condition),
          title: `${h.name} (${h.site_code})`,
        })
        m.bindTooltip(
          `<span style="font-weight:600">${h.name}</span> · <span>Condition ${h.current_condition}/5</span>`,
          { direction: 'top', offset: [0, -42], opacity: 0.95 }
        )
        m.bindPopup(`
          <div style="font-family:system-ui;min-width:160px;">
            <div style="font-weight:700;font-size:13px;color:${COND_COLOR[h.current_condition]};margin-bottom:3px;">${h.site_code}</div>
            <div style="font-weight:600;font-size:12px;margin-bottom:5px;">${h.name}</div>
            <div style="font-size:11px;">Condition: <b style="color:${COND_COLOR[h.current_condition]}">${h.current_condition}/5 — ${COND[h.current_condition]}</b></div>
            ${h.site_type ? `<div style="font-size:11px;color:#64748b;margin-top:3px;text-transform:capitalize;">${h.site_type.replace(/_/g, ' ')}</div>` : ''}
            <div style="font-size:10px;color:#94a3b8;margin-top:4px;">${h.lat.toFixed(4)}°N, ${h.lng.toFixed(4)}°W</div>
          </div>
        `)
        mcg.addLayer(m)
      })
    }

    // 3. Wildlife Sightings
    if (show.wildlife) {
      wildlife.forEach(w => {
        if (typeof w.gps_lat !== 'number' || typeof w.gps_lng !== 'number') return
        const m = L.marker([w.gps_lat, w.gps_lng], {
          icon: getWildlifeIcon(w.species_type),
          title: w.species_type ?? 'Wildlife Sighting',
        })
        m.bindTooltip(
          `<span style="font-weight:600">${w.species_type ?? 'Wildlife Sighting'}</span>`,
          { direction: 'top', offset: [0, -40], opacity: 0.95 }
        )
        const dateStr = new Date(w.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        const statusColor = w.validation_status === 'approved' ? '#16a34a' : w.validation_status === 'rejected' ? '#dc2626' : '#d97706'
        m.bindPopup(`
          <div style="font-family:system-ui;min-width:160px;">
            <div style="font-weight:700;font-size:13px;color:#16a34a;margin-bottom:3px;">Wildlife Sighting</div>
            <div style="font-weight:600;font-size:12px;margin-bottom:3px;">${w.species_type ?? 'Unknown species'}</div>
            ${w.behavior ? `<div style="font-size:11px;color:#64748b;">Behaviour: ${w.behavior}</div>` : ''}
            <div style="font-size:11px;margin-top:3px;">Status: <span style="color:${statusColor};font-weight:600;text-transform:capitalize;">${w.validation_status}</span></div>
            <div style="font-size:10px;color:#94a3b8;margin-top:4px;">${dateStr}</div>
          </div>
        `)
        mcg.addLayer(m)
      })
    }

    // 4. Environmental Incidents
    if (show.incidents) {
      incidents.forEach(i => {
        if (typeof i.gps_lat !== 'number' || typeof i.gps_lng !== 'number') return
        const m = L.marker([i.gps_lat, i.gps_lng], {
          icon: getIncidentBadgeIcon(i.incident_type, i.severity),
          title: i.incident_type ?? 'Environmental Incident',
        })
        m.bindTooltip(
          `<span style="font-weight:600">${i.incident_type ?? 'Incident'}</span> · <span>Severity ${i.severity ?? '?'}/5</span>`,
          { direction: 'top', offset: [0, -42], opacity: 0.95 }
        )
        const dateStr = new Date(i.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
        const statusColor = i.validation_status === 'approved' ? '#16a34a' : '#d97706'
        const headerColor = i.severity && i.severity >= 4 ? '#dc2626' : '#f59e0b'
        m.bindPopup(`
          <div style="font-family:system-ui;min-width:160px;">
            <div style="font-weight:700;font-size:13px;color:${headerColor};margin-bottom:3px;">Incident Report</div>
            <div style="font-weight:600;font-size:12px;margin-bottom:3px;">${i.incident_type ?? 'Unknown'}</div>
            <div style="font-size:11px;">Severity: <b style="color:${COND_COLOR[i.severity ?? 1] ?? '#f59e0b'}">${i.severity ?? '?'}/5</b></div>
            <div style="font-size:11px;margin-top:2px;">Status: <span style="color:${statusColor};font-weight:600;text-transform:capitalize;">${i.validation_status}</span></div>
            <div style="font-size:10px;color:#94a3b8;margin-top:4px;">${dateStr}</div>
          </div>
        `)
        mcg.addLayer(m)
      })
    }

    // 5. GIS Shapefile Point Features (visible parkLayers)
    // Extracts dense points (shipwrecks, anchorages, turtle beaches, buoys, water production)
    parkLayers
      .filter(l => l.is_visible && l.geojson)
      .forEach(layer => {
        const { pointFeatures } = extractGisFeatures(layer.geojson)
        pointFeatures.forEach(feat => {
          const coords = getFeaturePointCoords(feat)
          if (!coords) return
          const [lat, lng] = coords
          const props = (feat?.properties ?? undefined) as Record<string, unknown> | undefined
          const icon = getGisPointIcon(layer.name, props, layer.color)
          const title = String(props?.Name || props?.NAME || props?.title || props?.label || layer.name)

          const m = L.marker([lat, lng], { icon, title })
          m.bindTooltip(title, { direction: 'top', offset: [0, -32], opacity: 0.95 })

          const glyph = getLayerGlyph(layer.name)
          let popupContent = `
            <div style="font-family:system-ui;min-width:180px;padding:2px">
              <div style="font-weight:700;font-size:13px;color:${layer.color};margin-bottom:6px;display:flex;align-items:center;gap:6px">
                <span>${glyph}</span>
                <span>${title}</span>
              </div>`
          if (props) {
            const tableRows = Object.entries(props)
              .filter(([k, v]) => v !== null && v !== undefined && v !== '' && !['icon','begin','end','altitudeMo','tessellate','extrude','visibility','drawOrder'].includes(k))
              .slice(0, 8)
              .map(([k, v]) => `<tr><td style="color:#94a3b8;padding:2px 6px 2px 0;font-size:11px;font-weight:600;text-transform:capitalize">${k.replace(/_/g, ' ')}</td><td style="color:#e2e8f0;font-size:11px">${String(v)}</td></tr>`)
              .join('')
            if (tableRows) {
              popupContent += `<table style="border-collapse:collapse;width:100%">${tableRows}</table>`
            }
          }
          popupContent += `<div style="font-size:10px;color:#94a3b8;margin-top:6px;border-top:1px solid #334155;padding-top:4px;">Layer: ${layer.name}</div></div>`
          m.bindPopup(popupContent)

          mcg.addLayer(m)
        })
      })

    map.addLayer(mcg)

    return () => {
      map.removeLayer(mcg)
      if (typeof mcg.clearLayers === 'function') {
        mcg.clearLayers()
      }
    }
  }, [map, clusteringEnabled, stations, heritage, wildlife, incidents, parkLayers, show])

  return null
}

// ── Coordinate display child component ───────────────────────
function CoordTracker({ onCoords }: { onCoords: (lat: number, lng: number) => void }) {
  useMapEvents({ mousemove: e => onCoords(e.latlng.lat, e.latlng.lng) })
  return null
}

// ── English Harbour, Antigua — 17.0058°N, 61.7641°W ──────────
const PARK_CENTER: [number, number] = [17.0058, -61.7641]
const PARK_ZOOM = 13

// ── NDNP Geofence Bounds (Nelson's Dockyard National Park Included Area Only) ──
// Southwest corner: [16.9850, -61.7950] | Northeast corner: [17.0350, -61.7350]
const NDNP_GEOFENCE_BOUNDS: [[number, number], [number, number]] = [
  [16.9850, -61.7950],
  [17.0350, -61.7350],
]

// Statutory Conservation Boundary coordinates for Nelson's Dockyard National Park (120 km²)
const NDNP_STATUTORY_BOUNDARY_COORDS: [number, number][] = [
  [17.0280, -61.7850], // NW: Falmouth northern heights
  [17.0320, -61.7600], // N: Dow's Hill northern buffer
  [17.0250, -61.7400], // NE: Bethesda / Blockhouse eastern ridge
  [17.0000, -61.7380], // E: Standfast Point / Indian Creek headland
  [16.9880, -61.7500], // SE: South Shirley Heights offshore marine limit
  [16.9880, -61.7800], // S: South Falmouth offshore marine limit
  [17.0100, -61.7920], // SW: West Falmouth Harbour boundary
  [17.0280, -61.7850], // Close perimeter
]

// Fort Berkeley Coral Restoration Sanctuary (Restricted Zone)
const RESTRICTED_CORAL_ZONE_COORDS: [number, number][] = [
  [17.0050, -61.7675],
  [17.0085, -61.7690],
  [17.0095, -61.7650],
  [17.0065, -61.7635],
  [17.0050, -61.7675],
]

// Nelson's Dockyard Core Operational Hub (Regulated Zone)
const CORE_DOCKYARD_HUB_COORDS: [number, number][] = [
  [17.0060, -61.7660],
  [17.0115, -61.7650],
  [17.0110, -61.7610],
  [17.0055, -61.7620],
  [17.0060, -61.7660],
]

export interface MapViewProps {
  isCitizenView?: boolean
  initialShowPatrols?: boolean
  initialSidebarOpen?: boolean
  compactPreview?: boolean
  height?: string
  currentUserId?: string
  onReportClick?: () => void
}

function MapFlyController({ target }: { target: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) {
      map.flyTo(target, 16, { duration: 1.2 })
    }
  }, [map, target])
  return null
}

function MapGeofenceController({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap()
  useEffect(() => {
    map.setMaxBounds(bounds)
    map.setMinZoom(12)
    map.setMaxZoom(19)
    // Keep map inside bounds
    if (!map.getBounds().intersects(bounds)) {
      map.fitBounds(bounds)
    }
  }, [map, bounds])
  return null
}

// ── Main MapView component ────────────────────────────────────
export default function MapView(props: MapViewProps = {}) {
  const {
    isCitizenView = false,
    initialShowPatrols = true,
    initialSidebarOpen,
    compactPreview = false,
    height,
  } = props

  const [stations,  setStations]  = useState<Station[]>([])
  const [heritage,  setHeritage]  = useState<Heritage[]>([])
  const [patrols,   setPatrols]   = useState<Patrol[]>([])
  const [wildlife,  setWildlife]  = useState<CSReport[]>([])
  const [incidents, setIncidents] = useState<CSReport[]>([])
  const [loading,   setLoading]   = useState(true)
  const [coords,    setCoords]    = useState<[number,number] | null>(null)
  const [newAlert,  setNewAlert]  = useState<string | null>(null)

  // Layer visibility toggles
  const [show, setShow] = useState({
    stations: true,
    heritage: true,
    patrols: initialShowPatrols,
    wildlife: true,
    incidents: true,
  })
  const [clusteringEnabled, setClusteringEnabled] = useState(true)
  const toggle = (k: keyof typeof show) => setShow(p => ({...p, [k]: !p[k]}))

  // UI state for citizen & responsive view
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    initialSidebarOpen !== undefined ? initialSidebarOpen : !compactPreview
  )
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null)
  const [locating, setLocating] = useState(false)
  const [offlineMapReady, setOfflineMapReady] = useState(false)
  const [offlineCaching, setOfflineCaching] = useState(false)
  const [offlineStatusMsg, setOfflineStatusMsg] = useState<string | null>(null)

  useEffect(() => {
    isMapCachedOffline().then(setOfflineMapReady)
  }, [])

  const handleCacheMap = async () => {
    setOfflineCaching(true)
    setOfflineStatusMsg('Caching park satellite tiles...')
    const res = await cacheParkMapOffline((p) => {
      setOfflineStatusMsg(`Caching tiles: ${p.loaded}/${p.total} (${p.percent}%)`)
    })
    setOfflineCaching(false)
    if (res.success) {
      setOfflineMapReady(true)
      setOfflineStatusMsg(`Cached ${res.totalCached} tiles offline`)
    } else {
      setOfflineStatusMsg('Offline fallback basemap active')
    }
    setTimeout(() => setOfflineStatusMsg(null), 4000)
  }
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null)

  function handleLocateMe() {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      const fallback: [number, number] = [17.0076, -61.7645]
      setUserLocation(fallback)
      setFlyTarget(fallback)
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const c: [number, number] = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(c)
        setFlyTarget(c)
        setLocating(false)
      },
      err => {
        console.warn('Geolocation denied/failed:', err)
        const fallback: [number, number] = [17.0076, -61.7645]
        setUserLocation(fallback)
        setFlyTarget(fallback)
        setLocating(false)
      },
      { timeout: 8000, enableHighAccuracy: true }
    )
  }

  // ── GIS (shapefile) layers ───────────────────────────────────
  const [parkLayers,     setParkLayers]     = useState<ParkLayer[]>([])
  const [userRole,       setUserRole]       = useState<string | null>(null)
  const [uploading,      setUploading]      = useState(false)
  const [uploadStatus,   setUploadStatus]   = useState('')
  const [layerError,     setLayerError]     = useState('')
  const [renamingId,     setRenamingId]     = useState<string | null>(null)
  const [renameVal,      setRenameVal]      = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check role
  useEffect(() => {
    async function checkRole() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        const { data: p } = await sb.from('profiles').select('role').eq('id', user.id).single()
        setUserRole(p?.role ?? null)
      }
    }
    checkRole()
  }, [])

  // Fetch GIS layers
  const fetchLayers = useCallback(async () => {
    const sb = createClient()
    const { data } = await sb.from('park_layers').select('*').order('created_at', { ascending: false })
    setParkLayers((data ?? []) as ParkLayer[])
  }, [])

  useEffect(() => { fetchLayers() }, [fetchLayers])

  // Handle shapefile ZIP upload
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setLayerError('')
    setUploadStatus('Parsing shapefile…')

    try {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        throw new Error('Upload a ZIP file containing .shp, .dbf, and .shx files.')
      }

      // Dynamic import — shpjs is large, only load when needed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const shpjs = (await import('shpjs')).default as any
      const buf   = await file.arrayBuffer()
      const raw   = await shpjs(buf)

      // shpjs may return a single FeatureCollection or an array
      const collection = Array.isArray(raw) ? raw[0] : raw
      const featureCount: number = collection?.features?.length ?? 0

      if (!collection || !collection.type) throw new Error('Could not parse GeoJSON from shapefile.')

      setUploadStatus('Saving layer…')
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      const layerName = file.name.replace(/\.zip$/i, '').replace(/[_-]/g, ' ')

      const { error } = await sb.from('park_layers').insert({
        name:          layerName,
        geojson:       collection,
        color:         '#00bcd4',
        opacity:       0.5,
        is_visible:    true,
        created_by:    user?.id,
        file_name:     file.name,
        feature_count: featureCount,
      })

      if (error) throw new Error(error.message)

      setUploadStatus(`✓ Added “${layerName}” (${featureCount} features)`)
      await fetchLayers()
      setTimeout(() => setUploadStatus(''), 4000)
    } catch (err) {
      setLayerError(err instanceof Error ? err.message : 'Upload failed.')
      setUploadStatus('')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function deleteLayer(id: string) {
    if (!confirm('Delete this layer from the map?')) return
    const sb = createClient()
    await sb.from('park_layers').delete().eq('id', id)
    setParkLayers(p => p.filter(l => l.id !== id))
  }

  async function toggleLayerVisible(id: string, current: boolean) {
    const sb = createClient()
    await sb.from('park_layers').update({ is_visible: !current }).eq('id', id)
    setParkLayers(p => p.map(l => l.id === id ? { ...l, is_visible: !current } : l))
  }

  async function updateLayerColor(id: string, color: string) {
    const sb = createClient()
    await sb.from('park_layers').update({ color }).eq('id', id)
    setParkLayers(p => p.map(l => l.id === id ? { ...l, color } : l))
  }

  async function updateLayerOpacity(id: string, opacity: number) {
    const sb = createClient()
    await sb.from('park_layers').update({ opacity }).eq('id', id)
    setParkLayers(p => p.map(l => l.id === id ? { ...l, opacity } : l))
  }

  async function renameLayer(id: string) {
    const name = renameVal.trim()
    if (!name) return
    const sb = createClient()
    await sb.from('park_layers').update({ name }).eq('id', id)
    setParkLayers(p => p.map(l => l.id === id ? { ...l, name } : l))
    setRenamingId(null)
  }

  // ── Fetch all map data ──────────────────────────────────────
  const fetchData = useCallback(async () => {
    const sb = createClient()
    const [s, h, p, cs] = await Promise.all([
      sb.from('monitoring_stations').select('id,station_code,name,lat,lng,station_type').eq('is_active', true),
      sb.from('heritage_sites').select('id,site_code,name,lat,lng,current_condition,site_type').eq('is_active', true),
      sb.from('patrol_logs').select('id,ranger_id,patrol_type,start_lat,start_lng,end_lat,end_lng,start_time,is_active,sector,profiles(full_name)').order('start_time', { ascending: false }).limit(50),
      sb.from('citizen_science_reports').select('id,report_type,species_type,incident_type,severity,gps_lat,gps_lng,validation_status,created_at,behavior').order('created_at', { ascending: false }).limit(200),
    ])

    const dbStations  = (s.data ?? []) as unknown as Station[]
    const dbHeritage  = (h.data ?? []) as unknown as Heritage[]
    const dbPatrols   = (p.data ?? []) as unknown as Patrol[]
    const csData      = (cs.data ?? []) as unknown as CSReport[]
    const dbWildlife  = csData.filter(r => r.report_type === 'wildlife_sighting')
    const dbIncidents = csData.filter(r => r.report_type === 'environmental_incident')

    // Use DB data if present, otherwise fall back to realistic Nelson's Dockyard datasets
    setStations(dbStations.length > 0 ? dbStations : FALLBACK_STATIONS)
    setHeritage(dbHeritage.length > 0 ? dbHeritage : FALLBACK_HERITAGE)
    setPatrols(dbPatrols.length > 0 ? dbPatrols : FALLBACK_PATROLS)
    setWildlife(dbWildlife.length > 0 ? dbWildlife : FALLBACK_WILDLIFE)
    setIncidents(dbIncidents.length > 0 ? dbIncidents : FALLBACK_INCIDENTS)

    setLoading(false)
  }, [])

  // ── Realtime subscription ───────────────────────────────────
  useEffect(() => {
    fetchData()
    const sb = createClient()
    const channel = sb.channel('map-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'citizen_science_reports' }, payload => {
        const r = payload.new as unknown as CSReport
        if (r.report_type === 'wildlife_sighting') {
          setWildlife(p => [r, ...p])
          setNewAlert(`New wildlife sighting: ${r.species_type ?? 'Unknown species'}`)
        } else {
          setIncidents(p => [r, ...p])
          if ((r.severity ?? 0) >= 4) setNewAlert(`⚠ High-severity incident: ${r.incident_type ?? 'Unknown'} (severity ${r.severity})`)
          else setNewAlert(`New incident report: ${r.incident_type ?? 'Unknown'}`)
        }
        setTimeout(() => setNewAlert(null), 6000)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'patrol_logs' }, payload => {
        setPatrols(p => [payload.new as unknown as Patrol, ...p])
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'park_layers' }, () => { fetchLayers() })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [fetchData, fetchLayers])

  const isAdmin = userRole === 'system_admin'

  if (loading) return (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', color:'var(--text-muted)', fontSize:'0.85rem', gap:'10px' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/></svg>
      Loading map data…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ display:'flex', width:'100%', height: height || '100%', position:'relative', overflow: 'hidden' }}>

      {/* ════════════ Left control panel ════════════ */}
      {isSidebarOpen && (
        <div style={{
          width:'280px',
          maxWidth:'85vw',
          background:'var(--surface)',
          borderRight:'1px solid var(--border)',
          display:'flex',
          flexDirection:'column',
          overflowY:'auto',
          flexShrink:0,
          zIndex:1000,
          boxShadow:'var(--card-shadow)',
        }}>

          {/* Real-time alert */}
          {newAlert && (
            <div style={{ padding:'10px 14px', background:'rgba(239,68,68,0.1)', borderBottom:'1px solid rgba(239,68,68,0.25)', fontSize:'0.72rem', color:'#fca5a5', lineHeight:1.5 }}>
              <div style={{ fontWeight:700, marginBottom:'2px', color:'#ef4444' }}>● Live Update</div>
              {newAlert}
            </div>
          )}

          {/* Header with Title & Close button */}
          <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--header-bg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px' }}>{isCitizenView ? '🛡️' : '🗺️'}</span>
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, color: isCitizenView ? 'var(--teal)' : 'var(--text)', letterSpacing: '-0.01em' }}>
                  {isCitizenView ? 'Citizen GIS Explorer' : 'Park GIS Layers'}
                </div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                  Nelson&apos;s Dockyard National Park
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              title="Collapse Layers Panel"
              style={{
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '12px',
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>

          {/* Citizen Quick Action Button */}
          {isCitizenView && (
            <div style={{ padding: '12px 14px 4px' }}>
              <Link
                href="/report"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '9px 12px',
                  background: 'linear-gradient(135deg, #00bcd4, #0077a8)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(0,188,212,0.25)',
                }}
              >
                <span>＋</span>
                <span>Report Incident or Sighting</span>
              </Link>
            </div>
          )}

          {/* ── Standard map layer toggles ── */}
          <div style={{ padding:'14px' }}>
            <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-muted)', marginBottom:'10px' }}>Map Layers</div>
            {([
              { key:'stations' as const,  label:'Monitoring Stations', color:'#0d9488', count: stations.length, icon:'🔬' },
              { key:'heritage' as const,  label:'Heritage Sites',       color:'#f59e0b', count: heritage.length, icon:'🏛️' },
              { key:'patrols'  as const,  label:'Patrol Routes',        color:'#4fb3e8', count: patrols.length, icon:'🚤' },
              { key:'wildlife' as const,  label:'Wildlife Sightings',   color:'#22c55e', count: wildlife.length, icon:'🐢' },
              { key:'incidents' as const, label:'Incidents',            color:'#ef4444', count: incidents.length, icon:'⚠️' },
            ] as const).map(layer => (
              <button key={layer.key} onClick={() => toggle(layer.key)}
                style={{ width:'100%', display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', borderRadius:'7px', border:'none', background: show[layer.key] ? `${layer.color}14` : 'transparent', cursor:'pointer', marginBottom:'3px', transition:'all 150ms', textAlign:'left' }}>
                <div style={{ width:'14px', height:'14px', borderRadius:'3px', background: show[layer.key] ? layer.color : 'var(--border)', flexShrink:0, transition:'background 150ms' }} />
                <span style={{ fontSize:'0.85rem', lineHeight:1 }}>{layer.icon}</span>
                <div style={{ flex:1, fontSize:'0.78rem', fontWeight:600, color: show[layer.key] ? 'var(--text)' : 'var(--text-muted)' }}>{layer.label}</div>
                <div style={{ fontSize:'0.65rem', fontWeight:700, color: show[layer.key] ? layer.color : 'var(--text-muted)', background: show[layer.key] ? `${layer.color}18` : 'var(--surface2)', border:`1px solid ${show[layer.key] ? `${layer.color}30` : 'var(--border)'}`, borderRadius:'4px', padding:'1px 6px' }}>{layer.count}</div>
              </button>
            ))}

            {/* ── Marker Clustering Toggle ── */}
            <div style={{ marginTop:'8px', paddingTop:'10px', borderTop:'1px solid var(--border)' }}>
              <button
                onClick={() => setClusteringEnabled(p => !p)}
                title={clusteringEnabled ? 'Disable clustering to see all pins unclustered' : 'Enable clustering to group dense pins'}
                style={{
                  width:'100%',
                  display:'flex',
                  alignItems:'center',
                  justifyContent:'space-between',
                  padding:'7px 10px',
                  borderRadius:'7px',
                  border:'1px solid',
                  borderColor: clusteringEnabled ? 'rgba(13, 148, 136, 0.45)' : 'var(--border)',
                  background: clusteringEnabled ? 'rgba(13, 148, 136, 0.12)' : 'var(--surface2)',
                  cursor:'pointer',
                  transition:'all 150ms',
                }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                  <span style={{ fontSize:'0.85rem' }}>🗂️</span>
                  <div style={{ textAlign:'left' }}>
                    <div style={{ fontSize:'0.75rem', fontWeight:700, color: clusteringEnabled ? 'var(--teal)' : 'var(--text-muted)' }}>
                      Cluster Markers
                    </div>
                    <div style={{ fontSize:'0.62rem', color:'var(--text-muted)' }}>
                      {clusteringEnabled ? 'Grouped at low zoom' : 'Showing all pins'}
                    </div>
                  </div>
                </div>
                <div style={{
                  width:'28px',
                  height:'16px',
                  borderRadius:'10px',
                  background: clusteringEnabled ? 'var(--teal)' : 'var(--border)',
                  position:'relative',
                  transition:'background 150ms',
                }}>
                  <div style={{
                    width:'12px',
                    height:'12px',
                    borderRadius:'50%',
                    background:'#ffffff',
                    position:'absolute',
                    top:'2px',
                    left: clusteringEnabled ? '14px' : '2px',
                    transition:'left 150ms ease',
                  }} />
                </div>
              </button>
            </div>
          </div>

        {/* ── GIS / Shapefile layers ── */}
        <div style={{ padding:'14px', borderTop:'1px solid var(--border)', flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
            <div style={{ fontSize:'0.6rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'var(--text-muted)' }}>
              GIS Layers ({parkLayers.length})
            </div>
            {isAdmin && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Upload Shapefile ZIP (.shp, .dbf, .shx)"
                style={{ fontSize:'0.68rem', fontWeight:700, color:'var(--teal)', background:'transparent', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:'3px', padding:'2px 4px' }}
              >
                <span>+</span> Upload
              </button>
            )}
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            style={{ display:'none' }}
            onChange={handleUpload}
          />

          {/* Upload status / error */}
          {uploadStatus && (
            <div style={{ padding:'6px 10px', borderRadius:'5px', background:'rgba(0,188,212,0.1)', border:'1px solid rgba(0,188,212,0.25)', fontSize:'0.68rem', color:'#00bcd4', marginBottom:'8px' }}>
              {uploadStatus}
            </div>
          )}
          {layerError && (
            <div style={{ padding:'6px 10px', borderRadius:'5px', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', fontSize:'0.68rem', color:'#fca5a5', marginBottom:'8px' }}>
              {layerError}
            </div>
          )}

          {parkLayers.length === 0 && (
            <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', lineHeight:1.5, padding:'8px 0' }}>
              No custom shapefiles uploaded yet.
              {isAdmin && <span style={{ display:'block', marginTop:'4px', color:'var(--teal)' }}>Upload a .zip containing .shp, .shx, and .dbf files.</span>}
            </div>
          )}

          {parkLayers.map(layer => (
            <div key={layer.id} style={{ background:'var(--surface2)', borderRadius:'8px', padding:'8px 10px', marginBottom:'6px', border:`1px solid ${layer.is_visible ? layer.color + '40' : 'var(--border)'}` }}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                {/* Visibility checkbox */}
                <input
                  type="checkbox"
                  checked={layer.is_visible}
                  onChange={() => toggleLayerVisible(layer.id, layer.is_visible)}
                  style={{ accentColor: layer.color, cursor:'pointer', width:'13px', height:'13px' }}
                />

                {/* Color dot */}
                <input
                  type="color"
                  value={layer.color}
                  disabled={!isAdmin}
                  onChange={e => updateLayerColor(layer.id, e.target.value)}
                  style={{ width:'16px', height:'16px', border:'none', borderRadius:'50%', cursor: isAdmin ? 'pointer' : 'default', padding:0, background:'none' }}
                  title="Change layer color"
                />

                {/* Layer name */}
                {renamingId === layer.id ? (
                  <form onSubmit={e => { e.preventDefault(); renameLayer(layer.id) }} style={{ flex:1, display:'flex', gap:'4px' }}>
                    <input
                      value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      autoFocus
                      style={{ flex:1, fontSize:'0.72rem', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'4px', color:'var(--text)', padding:'1px 4px' }}
                    />
                    <button type="submit" style={{ fontSize:'0.65rem', background:'var(--teal)', border:'none', borderRadius:'3px', color:'#000', padding:'1px 5px', cursor:'pointer' }}>✓</button>
                    <button type="button" onClick={() => setRenamingId(null)} style={{ fontSize:'0.65rem', background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer' }}>✕</button>
                  </form>
                ) : (
                  <span
                    onDoubleClick={() => { if (isAdmin) { setRenamingId(layer.id); setRenameVal(layer.name) } }}
                    title={isAdmin ? 'Double-click to rename' : layer.name}
                    style={{ flex:1, fontSize:'0.73rem', fontWeight:600, color: layer.is_visible ? 'var(--text)' : 'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor: isAdmin ? 'text' : 'default' }}
                  >
                    {layer.name}
                  </span>
                )}

                {/* Delete button (admin only) */}
                {isAdmin && (
                  <button
                    onClick={() => deleteLayer(layer.id)}
                    title="Delete layer"
                    style={{ background:'transparent', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'0.75rem', padding:'0 2px', lineHeight:1 }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Opacity slider */}
              {layer.is_visible && (
                <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'6px', paddingTop:'6px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize:'0.6rem', color:'var(--text-muted)', minWidth:'40px' }}>Opacity</span>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={layer.opacity}
                    onChange={e => updateLayerOpacity(layer.id, parseFloat(e.target.value))}
                    style={{ flex:1, height:'3px', accentColor: layer.color, cursor:'pointer' }}
                  />
                  <span style={{ fontSize:'0.6rem', color:'var(--text-muted)', minWidth:'24px', textAlign:'right' }}>{Math.round(layer.opacity * 100)}%</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Legend ── */}
        <div style={{ padding:'12px 14px', borderTop:'1px solid var(--border)', fontSize:'0.68rem', color:'var(--text-muted)' }}>
          <div style={{ fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', fontSize:'0.6rem', marginBottom:'6px' }}>Condition Score</div>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {COND.slice(1).map((label, i) => (
              <span key={label} style={{ display:'flex', alignItems:'center', gap:'3px', fontSize:'0.62rem' }}>
                <span style={{ width:'7px', height:'7px', borderRadius:'50%', background: COND_COLOR[i+1], display:'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* ════════════ Leaflet Map ════════════ */}
      <div style={{ flex:1, position:'relative', height: '100%', overflow: 'hidden' }}>
        {/* Floating Button to re-open sidebar when collapsed */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            style={{
              position: 'absolute',
              top: '12px',
              left: '12px',
              zIndex: 1000,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '7px 12px',
              color: 'var(--text)',
              fontSize: '0.74rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--card-shadow)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backdropFilter: 'blur(8px)',
            }}
          >
            <span>☰</span>
            <span>{isCitizenView ? 'Layers & Guides' : 'Map Layers'}</span>
          </button>
        )}

        {/* Floating Top Controls (Basemap Switcher & Locate Me) */}
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
        }}>
          {/* Basemap Indicator: Sat Only */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '5px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: 'var(--card-shadow)',
            backdropFilter: 'blur(8px)',
            fontSize: '0.68rem',
            fontWeight: 700,
            color: 'var(--teal)',
          }}>
            <span>🛰️</span>
            <span>Sat Map</span>
          </div>

          {/* Locate Me GPS Button */}
          <button
            onClick={handleLocateMe}
            disabled={locating}
            title="Locate My GPS Position"
            style={{
              background: userLocation ? 'rgba(0,188,212,0.18)' : 'var(--surface)',
              border: `1px solid ${userLocation ? 'var(--teal)' : 'var(--border)'}`,
              borderRadius: '8px',
              padding: '5px 11px',
              color: userLocation ? 'var(--teal)' : 'var(--text)',
              fontSize: '0.7rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--card-shadow)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span style={{ fontSize: '11px' }}>📍</span>
            <span>{locating ? 'Locating…' : userLocation ? 'GPS Active' : 'Locate Me'}</span>
          </button>
          {/* Offline Map Cache Button */}
          <button
            onClick={handleCacheMap}
            disabled={offlineCaching}
            title="Cache Park Map for Offline Navigation"
            style={{
              background: offlineMapReady ? 'rgba(16,185,129,0.18)' : 'var(--surface)',
              border: `1px solid ${offlineMapReady ? '#10b981' : 'var(--border)'}`,
              borderRadius: '8px',
              padding: '5px 11px',
              color: offlineMapReady ? '#10b981' : 'var(--text)',
              fontSize: '0.7rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: 'var(--card-shadow)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span>{offlineCaching ? '⏳' : offlineMapReady ? '✅' : '📥'}</span>
            <span>{offlineCaching ? 'Caching…' : offlineMapReady ? 'Offline Ready' : 'Cache Offline'}</span>
          </button>

          {/* Geofence Status Badge */}
          <div style={{
            background: 'rgba(0,188,212,0.12)',
            border: '1px solid rgba(0,188,212,0.4)',
            borderRadius: '8px',
            padding: '5px 11px',
            fontSize: '0.7rem',
            color: 'var(--teal)',
            fontWeight: 700,
            boxShadow: 'var(--card-shadow)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
          }}>
            <span>🛡️</span>
            <span>Geofenced: NDNP Included Area</span>
          </div>

          {/* Recenter Button */}
          <button
            onClick={() => setFlyTarget(PARK_CENTER)}
            title="Recenter view inside NDNP Included Area"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '5px 11px',
              color: 'var(--text)',
              fontSize: '0.7rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--card-shadow)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <span>🎯</span>
            <span>Recenter</span>
          </button>

          {/* English Harbour badge */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '5px 10px',
            fontSize: '0.68rem',
            color: 'var(--teal)',
            fontWeight: 700,
            boxShadow: 'var(--card-shadow)',
            backdropFilter: 'blur(8px)',
            letterSpacing: '0.02em',
            display: 'none',
          }} className="sm:block">
            English Harbour
          </div>
        </div>

        <MapContainer
          center={PARK_CENTER}
          zoom={PARK_ZOOM}
          minZoom={12}
          maxZoom={19}
          maxBounds={NDNP_GEOFENCE_BOUNDS}
          maxBoundsViscosity={1.0}
          zoomControl={false}
          style={{ width:'100%', height:'100%', background:'var(--bg)' }}
        >
          <ZoomControl position="bottomright" />
          <CoordTracker onCoords={(lat, lng) => setCoords([lat, lng])} />
          <MapFlyController target={flyTarget} />
          <MapGeofenceController bounds={NDNP_GEOFENCE_BOUNDS} />

          {/* Basemap: Esri World Imagery (High-Resolution Satellite) + Reference Labels */}
          <TileLayer
            attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            opacity={0.92}
            maxZoom={19}
            errorTileUrl={OFFLINE_FALLBACK_TILE_DATA_URL}
          />
          <TileLayer
            attribution=''
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            opacity={0.7}
            maxZoom={19}
          />

          {/* ── Statutory NDNP Park Boundary (Geofence Perimeter Layer) ── */}
          <Polygon
            positions={NDNP_STATUTORY_BOUNDARY_COORDS}
            pathOptions={{
              color: '#00bcd4',
              weight: 2.5,
              dashArray: '8, 6',
              fillColor: '#00bcd4',
              fillOpacity: 0.04,
            }}
          >
            <Tooltip sticky>
              <div style={{ fontWeight: 800, color: '#00bcd4' }}>🛡️ NDNP Statutory Park Boundary</div>
              <div style={{ fontSize: '11px', color: '#cbd5e1' }}>120 km² UNESCO Heritage &amp; Marine Protected Area</div>
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Map navigation geofenced strictly to this perimeter</div>
            </Tooltip>
          </Polygon>

          {/* ── Fort Berkeley Coral Sanctuary (Restricted Marine Zone) ── */}
          <Polygon
            positions={RESTRICTED_CORAL_ZONE_COORDS}
            pathOptions={{
              color: '#ef4444',
              weight: 2,
              dashArray: '5, 5',
              fillColor: '#ef4444',
              fillOpacity: 0.22,
            }}
          >
            <Tooltip sticky>
              <div style={{ fontWeight: 800, color: '#ef4444' }}>⛔ Fort Berkeley Coral Sanctuary</div>
              <div style={{ fontSize: '11px', color: '#cbd5e1' }}>Strict No-Take Zone · No Seafloor Anchoring · Max 3 Knots</div>
            </Tooltip>
          </Polygon>

          {/* ── Core Dockyard Operational Hub (Regulated Zone) ── */}
          <Polygon
            positions={CORE_DOCKYARD_HUB_COORDS}
            pathOptions={{
              color: '#3b82f6',
              weight: 2,
              dashArray: '5, 5',
              fillColor: '#3b82f6',
              fillOpacity: 0.18,
            }}
          >
            <Tooltip sticky>
              <div style={{ fontWeight: 800, color: '#60a5fa' }}>⚓ Core Dockyard Operational Hub</div>
              <div style={{ fontSize: '11px', color: '#cbd5e1' }}>Dead Slow (5 Knots) · Mooring Permit Required · Zero Discharge</div>
            </Tooltip>
          </Polygon>

          {/* User GPS Location Marker */}
          {userLocation && (
            <Marker position={userLocation} icon={getUserLocationIcon()}>
              <Tooltip direction="top" offset={[0, -14]} opacity={0.95} permanent>
                <span style={{ fontWeight: 700, color: '#00bcd4' }}>You are here</span>
              </Tooltip>
              <Popup>
                <div style={{ fontFamily: 'system-ui', minWidth: '160px' }}>
                  <div style={{ fontWeight: 700, color: '#00bcd4', marginBottom: '3px' }}>Your GPS Location</div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                    {userLocation[0].toFixed(5)}°N, {Math.abs(userLocation[1]).toFixed(5)}°W
                  </div>
                  <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px' }}>
                    Inside Nelson&apos;s Dockyard National Park
                  </div>
                </div>
              </Popup>
            </Marker>
          )}

          {/* ── GIS Non-Point Features (Polygons, Zones, Boundary Lines) ── */}
          {parkLayers
            .filter(l => l.is_visible && l.geojson)
            .map(layer => {
              const { nonPointGeojson } = extractGisFeatures(layer.geojson)
              if (!nonPointGeojson) return null
              return (
                <GeoJSON
                  key={`gis-nonpoint-${layer.id}-${layer.name}-${layer.color}-${layer.opacity}`}
                  data={nonPointGeojson}
                  style={{
                    color:       layer.color,
                    fillColor:   layer.color,
                    weight:      2,
                    opacity:     0.9,
                    fillOpacity: layer.opacity,
                  }}
                  onEachFeature={(feature, leafletLayer) => {
                    if (feature.properties) {
                      const glyph = getLayerGlyph(layer.name)
                      const props = Object.entries(feature.properties)
                        .filter(([k, v]) => v !== null && v !== undefined && v !== '' && !['icon','begin','end','altitudeMo','tessellate','extrude','visibility','drawOrder'].includes(k))
                        .slice(0, 10)
                        .map(([k, v]) => `<tr><td style="color:#94a3b8;padding:2px 8px 2px 0;font-size:11px;font-weight:600">${k}</td><td style="color:#e2e8f0;font-size:11px">${v}</td></tr>`)
                        .join('')
                      leafletLayer.bindPopup(
                        `<div style="font-family:system-ui;min-width:180px;padding:2px">
                          <div style="font-weight:700;font-size:13px;color:${layer.color};margin-bottom:6px;display:flex;align-items:center;gap:6px">
                            <span>${glyph}</span>
                            <span>${layer.name}</span>
                          </div>
                          ${props ? `<table style="border-collapse:collapse;width:100%">${props}</table>` : '<div style="font-size:11px;color:#94a3b8">Zone boundary</div>'}
                        </div>`
                      )
                    }
                  }}
                />
              )
            })
          }

          {/* ── Patrol Routes (active ranger operations, unclustered) ── */}
          {show.patrols && patrols.map(p => {
            const hasRoute = p.end_lat && p.end_lng
            const positions: [number,number][] = hasRoute
              ? [[p.start_lat, p.start_lng], [p.end_lat!, p.end_lng!]]
              : [[p.start_lat, p.start_lng]]
            return (
              <div key={p.id}>
                {hasRoute && (
                  <Polyline key={`line-${p.id}`}
                    positions={positions}
                    pathOptions={{ color: p.is_active ? '#4fb3e8' : '#1d4ed8', weight: p.is_active ? 3 : 2, opacity: p.is_active ? 0.9 : 0.5, dashArray: p.is_active ? undefined : '6 4' }}
                  />
                )}
                <Marker key={`start-${p.id}`} position={[p.start_lat, p.start_lng]} icon={p.is_active ? PATROL_ICONS.active : PATROL_ICONS.start} title={p.is_active ? 'Active Patrol' : 'Patrol Route'}>
                  <Tooltip direction="top" offset={[0, -42]} opacity={0.95}>
                    <span style={{ fontWeight: 600 }}>{p.is_active ? '● Active Patrol' : 'Patrol Log'}</span> · <span style={{ textTransform: 'capitalize' }}>{p.patrol_type}</span>
                  </Tooltip>
                  <Popup>
                    <div style={{ fontFamily:'system-ui', minWidth:'160px' }}>
                      <div style={{ fontWeight:700, fontSize:'13px', color: p.is_active ? '#4fb3e8' : '#3b82f6', marginBottom:'3px' }}>{p.is_active ? '● Active Patrol' : 'Patrol Log'}</div>
                      <div style={{ fontSize:'11px' }}>Type: <b style={{ textTransform:'capitalize' }}>{p.patrol_type}</b></div>
                      {p.sector && <div style={{ fontSize:'11px' }}>Sector: {p.sector}</div>}
                      {p.profiles && <div style={{ fontSize:'11px' }}>Ranger: {(p.profiles as { full_name: string }).full_name}</div>}
                      <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'4px' }}>
                        {new Date(p.start_time).toLocaleDateString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </div>
            )
          })}

          {/* ── Native Leaflet Marker Cluster Layer ── */}
          {/* Clusters stations, heritage sites, wildlife, incidents, AND GIS point features */}
          <NativeClusterLayer
            clusteringEnabled={clusteringEnabled}
            stations={stations}
            heritage={heritage}
            wildlife={wildlife}
            incidents={incidents}
            parkLayers={parkLayers}
            show={show}
          />
        </MapContainer>

        {/* ── Coordinate bar ── */}
        {coords && (
          <div style={{ position:'absolute', bottom:'10px', left:'10px', zIndex:1000, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'5px', padding:'4px 10px', fontFamily:'monospace', fontSize:'0.7rem', color:'var(--text)', boxShadow:'var(--card-shadow)', backdropFilter:'blur(4px)', display:'flex', gap:'12px' }}>
            <span>{coords[0].toFixed(5)}°N</span>
            <span>{Math.abs(coords[1]).toFixed(5)}°W</span>
          </div>
        )}

        {/* ── Location badge ── */}
        <div style={{ position:'absolute', top:'10px', right:'10px', zIndex:1000, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'6px', padding:'5px 10px', fontSize:'0.68rem', color:'var(--teal)', fontWeight:700, boxShadow:'var(--card-shadow)', backdropFilter:'blur(4px)', letterSpacing:'0.02em' }}>
          English Harbour · Antigua
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
