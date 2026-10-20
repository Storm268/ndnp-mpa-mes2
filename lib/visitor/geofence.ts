'use client'

export interface ZoneDefinition {
  id: string
  name: string
  status: 'RESTRICTED' | 'REGULATED' | 'OPEN'
  color: string
  strokeColor: string
  coordinates: [number, number][] // [lat, lng]
  rules: string[]
  speedLimitKnots?: number
  alertLevel: 'danger' | 'warning' | 'info'
  alertMessage: string
}

// Restricted Marine Zone (Red) - Fort Berkeley Coral Restoration Area
export const RESTRICTED_MARINE_ZONE: ZoneDefinition = {
  id: 'zone-restricted-coral',
  name: 'Fort Berkeley Coral Restoration Sanctuary',
  status: 'RESTRICTED',
  color: 'rgba(239, 68, 68, 0.28)',
  strokeColor: '#ef4444',
  coordinates: [
    [17.0050, -61.7675],
    [17.0085, -61.7690],
    [17.0095, -61.7650],
    [17.0065, -61.7635],
    [17.0050, -61.7675],
  ],
  rules: [
    'Strict No-Take Zone: No extraction of fish, conch, lobster, or corals.',
    'No Unauthorized Anchoring: Vessel anchoring on seafloor prohibited. Use official yellow mooring buoys only.',
    'Certified Dive Guide Required: All recreational scuba and snorkel groups must be accompanied by an NDNP-registered marine guide.',
    'Max vessel speed: 3 knots (Idle speed only).',
  ],
  speedLimitKnots: 3,
  alertLevel: 'danger',
  alertMessage: '⚠️ RESTRICTED ZONE: You have entered Fort Berkeley Coral Restoration Area! Strict fishing & anchoring prohibition in effect.',
}

// Core Dockyard Zone (Blue) - Operational hub with speed limits and mooring guidelines
export const CORE_DOCKYARD_ZONE: ZoneDefinition = {
  id: 'zone-core-dockyard',
  name: 'Nelson\'s Dockyard Core Operational Hub',
  status: 'REGULATED',
  color: 'rgba(59, 130, 246, 0.22)',
  strokeColor: '#3b82f6',
  coordinates: [
    [17.0060, -61.7660],
    [17.0115, -61.7650],
    [17.0110, -61.7610],
    [17.0055, -61.7620],
    [17.0060, -61.7660],
  ],
  rules: [
    'Speed Limit: Strictly 5 knots ("Dead Slow / No Wake" zone).',
    'Mooring Protocol: Vessel berthing and stern-to anchoring requires Port Authority & NDNP permit.',
    'Discharge Prohibited: Discharge of bilge, blackwater, or greywater is strictly forbidden under UNESCO heritage bylaws.',
  ],
  speedLimitKnots: 5,
  alertLevel: 'warning',
  alertMessage: 'ℹ️ CORE DOCKYARD ZONE: Speed limit 5 knots ("Dead Slow"). Follow Port Authority mooring protocols.',
}

// Heritage & Trail Corridors
export interface TrailCorridor {
  id: string
  name: string
  color: string
  dashArray: string
  coordinates: [number, number][]
  description: string
}

export const PARK_TRAILS: TrailCorridor[] = [
  {
    id: 'trail-fort-berkeley',
    name: 'Fort Berkeley Trail',
    color: '#eab308', // Gold dashed line
    dashArray: '6, 6',
    coordinates: [
      [17.0076, -61.7644],
      [17.0062, -61.7655],
      [17.0048, -61.7672],
    ],
    description: 'Historical walking trail from the naval dockyard walls out to the 1704 stone fortress guarding the harbour mouth.',
  },
  {
    id: 'trail-shirley-heights',
    name: 'Galleon Beach to Shirley Heights Path',
    color: '#10b981', // Green dashed line
    dashArray: '6, 6',
    coordinates: [
      [17.0035, -61.7580],
      [17.0018, -61.7562],
      [16.9998, -61.7538],
    ],
    description: 'Scenic cliffside coastal ascent from Galleon Beach past sea turtle bays up to Shirley Heights Lookout (490 ft elevation).',
  },
]

// Interactive Landmarks
export interface ParkLandmark {
  id: string
  name: string
  category: 'Heritage' | 'Fortress' | 'Beach' | 'Viewpoint'
  coordinates: [number, number] // [lat, lng]
  description: string
  unescoHighlight: string
  recommendedAction: string
}

export const PARK_LANDMARKS: ParkLandmark[] = [
  {
    id: 'landmark-museum',
    name: "Nelson's Dockyard Museum",
    category: 'Heritage',
    coordinates: [17.0076, -61.7644],
    description: "The Naval Officers' House (built 1855) displaying artifacts from Admiral Horatio Nelson's fleet, naval surgery, and shipyard craftsmanship.",
    unescoHighlight: "UNESCO World Heritage Core #1499",
    recommendedAction: "Visit museum, review park GIS maps & pick up trail guide.",
  },
  {
    id: 'landmark-fort-berkeley',
    name: "Fort Berkeley",
    category: 'Fortress',
    coordinates: [17.0048, -61.7672],
    description: "Built in 1704, this stone fortress protected the narrow entrance of English Harbour with 29 cannons and a heavy chain boom stretched across the channel mouth.",
    unescoHighlight: "Historic Maritime Defense Bastion",
    recommendedAction: "View coral restoration nursery from the bastion wall.",
  },
  {
    id: 'landmark-clarence-house',
    name: "Clarence House",
    category: 'Heritage',
    coordinates: [17.0092, -61.7628],
    description: "Built in 1804 for Prince William Henry, Duke of Clarence (later King William IV). Overlooks Freeman's Bay and the naval dockyard basin.",
    unescoHighlight: "Georgian Colonial Architecture",
    recommendedAction: "Admire manicured botanical grounds & heritage architecture.",
  },
  {
    id: 'landmark-galleon-beach',
    name: "Galleon Beach",
    category: 'Beach',
    coordinates: [17.0035, -61.7580],
    description: "Protected bay with vibrant reef flats. A crucial foraging zone for juvenile Hawksbill and Green Sea Turtles and home to the Pillars of Hercules rock formation.",
    unescoHighlight: "Key Marine Biodiversity Snorkel Site",
    recommendedAction: "Snorkel on reef flat; maintain 10ft distance from turtles.",
  },
  {
    id: 'landmark-shirley-heights',
    name: "Shirley Heights",
    category: 'Viewpoint',
    coordinates: [16.9998, -61.7538],
    description: "A restored 18th-century military lookout and gun battery situated 490 feet above sea level, offering breathtaking panoramic vistas of English Harbour and Falmouth Harbour.",
    unescoHighlight: "Historic Signal Station & Look-out",
    recommendedAction: "View entire Marine Protected Area zoning boundaries from above.",
  },
]

/**
 * Standard Ray-Casting Algorithm for Point-in-Polygon
 * @param point [latitude, longitude]
 * @param polygon array of [latitude, longitude] vertices
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [lat, lng] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]

    const intersect = yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }

  return inside
}

/**
 * Check which park zone a coordinate is inside
 */
export function evaluateGeofence(coords: [number, number]): ZoneDefinition | null {
  if (isPointInPolygon(coords, RESTRICTED_MARINE_ZONE.coordinates)) {
    return RESTRICTED_MARINE_ZONE
  }
  if (isPointInPolygon(coords, CORE_DOCKYARD_ZONE.coordinates)) {
    return CORE_DOCKYARD_ZONE
  }
  return null
}

/**
 * Coordinates for quick simulation testing
 */
export const SIMULATION_POINTS = [
  {
    label: 'Inside Restricted Coral Sanctuary',
    coords: [17.0070, -61.7670] as [number, number],
    expectedZone: 'Restricted Marine Zone',
    badge: '⛔ Alert Active',
  },
  {
    label: 'Inside Core Dockyard Marina',
    coords: [17.0080, -61.7635] as [number, number],
    expectedZone: 'Core Dockyard Zone',
    badge: 'ℹ️ Regulated',
  },
  {
    label: 'On Shirley Heights Trail',
    coords: [16.9998, -61.7538] as [number, number],
    expectedZone: 'Heritage Trail Corridor',
    badge: '🌿 Trail Open',
  },
  {
    label: 'Open Ocean (Outside Park)',
    coords: [17.0200, -61.7500] as [number, number],
    expectedZone: 'Outside Regulated Zones',
    badge: '🌐 Clear',
  },
]
