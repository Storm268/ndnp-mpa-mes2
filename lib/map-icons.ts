import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import L, { divIcon } from 'leaflet'
import {
  Compass,
  Anchor,
  Droplets,
  Sprout,
  Skull,
  Ban,
  Sparkles,
  Fish,
  FishOff,
  Eye,
  Wind,
  ShieldCheck,
  Trees,
  Ship,
  Waves,
  Gauge,
  MapPin,
  FlaskConical,
  Activity,
  Radio,
  Landmark,
  Shield,
  Bird,
  AlertTriangle,
  AlertOctagon,
  Droplet,
  Footprints,
  type LucideIcon,
} from 'lucide-react'

/**
 * Creates a Leaflet divIcon map marker pin using standard Lucide React icons.
 * Features an authentic teardrop map pin with a sharp needle tip anchor and high-contrast icon badge.
 *
 * @param IconComponent - The standard Lucide React icon component.
 * @param pinColor - Background hex color for the map pin.
 * @param iconColor - Color of the icon inside the pin (default white).
 * @param width - Pin width in pixels (default 34).
 * @param height - Pin height in pixels (default 42).
 */
export function createLucidePinIcon(
  IconComponent: LucideIcon,
  pinColor: string = '#0284c7',
  iconColor: string = '#ffffff',
  width: number = 34,
  height: number = 42
): L.DivIcon {
  const iconPixelSize = Math.round(width * 0.52)
  const svgHtml = renderToStaticMarkup(
    React.createElement(IconComponent, {
      size: iconPixelSize,
      color: iconColor,
      strokeWidth: 2.2,
    })
  )

  const pinHtml = `
    <div style="
      width: ${width}px;
      height: ${height}px;
      position: relative;
      filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.55));
      cursor: pointer;
      user-select: none;
    ">
      <svg width="${width}" height="${height}" viewBox="0 0 34 42" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;">
        <path d="M17 1.5C8.72 1.5 2 8.22 2 16.5C2 25.5 17 40.5 17 40.5C17 40.5 32 25.5 32 16.5C32 8.22 25.28 1.5 17 1.5Z" fill="${pinColor}" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/>
        <circle cx="17" cy="16.5" r="11" fill="rgba(0, 0, 0, 0.22)"/>
      </svg>
      <div style="
        position: absolute;
        top: 7.5px;
        left: 8px;
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      ">
        ${svgHtml}
      </div>
    </div>
  `

  return divIcon({
    html: pinHtml,
    className: 'custom-map-icon',
    iconSize: [width, height],
    iconAnchor: [width / 2, height - 1.5],
    popupAnchor: [0, -height],
  })
}

// ── Layer Icon Mapping for GIS / Shapefile layers ──────────────
export function getGisPointIcon(
  layerName: string,
  _properties?: Record<string, unknown>,
  layerColor?: string
): L.DivIcon {
  const name = (layerName || '').toLowerCase().trim()
  const color = layerColor || '#0284c7'

  // Navigation channels and marker buoys
  if (name.includes('nav') || name.includes('channel')) {
    return createLucidePinIcon(Compass, color)
  }

  // Sea turtle nesting beaches
  if (name.includes('turtle') || name.includes('nest')) {
    return createLucidePinIcon(Footprints, color)
  }

  // Water production / desalination
  if (name.includes('water') || name.includes('desal')) {
    return createLucidePinIcon(Droplets, color)
  }

  // Coral restoration zones / nurseries
  if (name.includes('restor') || name.includes('nursery')) {
    return createLucidePinIcon(Sprout, color)
  }

  // Shipwrecks / Lyon Wreck
  if (name.includes('wreck') || name.includes('lyon') || name.includes('sunken')) {
    return createLucidePinIcon(Skull, color)
  }

  // Anchorages, moorings, commissioners bay
  if (name.includes('anchor') || name.includes('moor')) {
    return createLucidePinIcon(Anchor, color)
  }

  // No propeller zones
  if (name.includes('prop') || name.includes('no prop') || name.includes('restricted')) {
    return createLucidePinIcon(Ban, color)
  }

  // Coral banks / reef areas
  if (name.includes('coral') || name.includes('reef')) {
    return createLucidePinIcon(Sparkles, color)
  }

  // Fisheries, fish zones, fishing complex
  if (name.includes('fish')) {
    return createLucidePinIcon(Fish, color)
  }

  // Scuba dive priority areas
  if (name.includes('dive')) {
    return createLucidePinIcon(Eye, color)
  }

  // Hurricane holes
  if (name.includes('hurricane') || name.includes('storm')) {
    return createLucidePinIcon(Wind, color)
  }

  // Conservation zones
  if (name.includes('conserv') || name.includes('protect')) {
    return createLucidePinIcon(ShieldCheck, color)
  }

  // Mangroves & wetlands
  if (name.includes('mangrove') || name.includes('wetland')) {
    return createLucidePinIcon(Trees, color)
  }

  // Marinas, slipways, jetties
  if (name.includes('marina') || name.includes('jetty') || name.includes('boatyard') || name.includes('slipway')) {
    return createLucidePinIcon(Ship, color)
  }

  // Swimming zones
  if (name.includes('swim')) {
    return createLucidePinIcon(Waves, color)
  }

  // Speed limits
  if (name.includes('speed')) {
    return createLucidePinIcon(Gauge, color)
  }

  // Default fallback for any other point layer from files
  return createLucidePinIcon(MapPin, color)
}

// ── Monitoring Station Icons ──────────────────────────────────
export function getMonitoringStationIcon(type?: string | null): L.DivIcon {
  const t = (type || '').toLowerCase()

  if (t === 'coral') {
    return createLucidePinIcon(Activity, '#0d9488', '#ffffff', 34, 42)
  }
  if (t === 'water_quality') {
    return createLucidePinIcon(FlaskConical, '#0284c7', '#ffffff', 34, 42)
  }
  if (t === 'fish') {
    return createLucidePinIcon(Fish, '#ea580c', '#ffffff', 34, 42)
  }
  // multi_sensor or default
  return createLucidePinIcon(Radio, '#6366f1', '#ffffff', 34, 42)
}

// ── Heritage Site Icons (Color-coded by Condition 1–5) ─────────
const HERITAGE_COLORS: Record<number, string> = {
  1: '#dc2626', // Critical / Ruined
  2: '#ea580c', // Poor
  3: '#d97706', // Fair
  4: '#16a34a', // Good
  5: '#0d9488', // Pristine
}

export function getHeritageSiteIcon(condition?: number | null): L.DivIcon {
  const cond = condition ?? 3
  const color = HERITAGE_COLORS[cond] || '#d97706'
  return createLucidePinIcon(Landmark, color, '#ffffff', 34, 42)
}

// ── Patrol Icons (Active vs Completed) ─────────────────────────
export function getPatrolIcon(isActive: boolean): L.DivIcon {
  if (isActive) {
    return createLucidePinIcon(Shield, '#0284c7', '#ffffff', 36, 44)
  }
  return createLucidePinIcon(Compass, '#2563eb', '#ffffff', 32, 40)
}

export const PATROL_ICONS = {
  get active() { return getPatrolIcon(true) },
  get start() { return getPatrolIcon(false) },
}

// ── Wildlife Sighting Icons ───────────────────────────────────
export function getWildlifeIcon(speciesType?: string | null): L.DivIcon {
  const st = (speciesType || '').toLowerCase()

  if (st.includes('turtle')) {
    return createLucidePinIcon(Footprints, '#16a34a', '#ffffff', 32, 40)
  }
  if (st.includes('mammal') || st.includes('dolphin') || st.includes('whale')) {
    return createLucidePinIcon(Waves, '#0284c7', '#ffffff', 32, 40)
  }
  if (st.includes('shark')) {
    return createLucidePinIcon(FishOff, '#0369a1', '#ffffff', 32, 40)
  }
  if (st.includes('bird')) {
    return createLucidePinIcon(Bird, '#ca8a04', '#ffffff', 32, 40)
  }
  if (st.includes('fish')) {
    return createLucidePinIcon(Fish, '#16a34a', '#ffffff', 32, 40)
  }

  return createLucidePinIcon(Sparkles, '#10b981', '#ffffff', 32, 40)
}

// ── Incident Severity / Type Badges ───────────────────────────
const INCIDENT_COLORS: Record<number, string> = {
  1: '#84cc16', // minor
  2: '#eab308', // moderate
  3: '#f97316', // serious
  4: '#ef4444', // high
  5: '#b91c1c', // critical
}

export function getIncidentBadgeIcon(
  incidentType?: string | null,
  severity?: number | null
): L.DivIcon {
  const t = (incidentType || '').toLowerCase()
  const sev = Math.min(5, Math.max(1, severity ?? 3))
  const color = INCIDENT_COLORS[sev] || '#ef4444'

  if (t.includes('poach') || t.includes('illegal') || t.includes('fish')) {
    return createLucidePinIcon(Ban, color, '#ffffff', 34, 42)
  }
  if (t.includes('spill') || t.includes('oil') || t.includes('chem') || t.includes('pollut')) {
    return createLucidePinIcon(Droplet, color, '#ffffff', 34, 42)
  }
  if (t.includes('ground') || t.includes('collis') || t.includes('wreck') || t.includes('vessel')) {
    return createLucidePinIcon(AlertOctagon, color, '#ffffff', 34, 42)
  }
  if (t.includes('anchor') || t.includes('reef') || t.includes('coral')) {
    return createLucidePinIcon(Anchor, color, '#ffffff', 34, 42)
  }

  return createLucidePinIcon(AlertTriangle, color, '#ffffff', 34, 42)
}

// ── Unicode Glyph for Layer Titles ────────────────────────────
export function getLayerGlyph(name: string): string {
  const n = (name || '').toLowerCase()
  if (n.includes('turtle')) return '🐢'
  if (n.includes('channel') || n.includes('nav')) return '🧭'
  if (n.includes('water')) return '💧'
  if (n.includes('restor')) return '🌱'
  if (n.includes('anchor') || n.includes('moor')) return '⚓'
  if (n.includes('wreck') || n.includes('lyon')) return '🚢'
  if (n.includes('prop')) return '🚫'
  if (n.includes('coral') || n.includes('reef')) return '🪸'
  if (n.includes('fish')) return '🐟'
  if (n.includes('dive')) return '🤿'
  if (n.includes('hurricane')) return '🌀'
  if (n.includes('mangrove') || n.includes('wetland')) return '🌿'
  if (n.includes('marina') || n.includes('jetty')) return '🛥️'
  if (n.includes('swim')) return '🏊'
  if (n.includes('speed')) return '⏱️'
  return '📍'
}

// ── Realtime User Geolocation Radar Icon ──────────────────────
export function getUserLocationIcon(): L.DivIcon {
  return divIcon({
    html: `
      <div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:24px;height:24px;border-radius:50%;background:rgba(0,188,212,0.45);animation:radarPulse 1.8s ease-out infinite;"></div>
        <div style="width:13px;height:13px;border-radius:50%;background:#00bcd4;border:2.5px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.6);"></div>
      </div>
    `,
    className: 'custom-map-icon user-location-pulse',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}
