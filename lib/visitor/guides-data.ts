'use client'

export interface UnescoHeritageSite {
  id: string
  title: string
  shortName: string
  era: string
  badge: string
  coords: [number, number] // [lat, lng]
  zoomLevel: number
  description: string
  unescoCriteria: string
  historicalSignificance: string
  regulations: string[]
  visitorTip: string
  imageUrl?: string
  iconName: string
  color: string
}

export interface MarineSpeciesGuide {
  id: string
  name: string
  scientificName: string
  conservationStatus: 'Critically Endangered' | 'Vulnerable' | 'CITES Appendix II / Protected' | 'Threatened'
  statusBadgeColor: string
  habitat: string
  primaryLocation: string
  coords: [number, number] // [lat, lng]
  zoomLevel: number
  description: string
  ecologicalRole: string
  visitorRules: string[]
  icon: string
  color: string
}

export const UNESCO_HERITAGE_SITES: UnescoHeritageSite[] = [
  {
    id: 'dockyard',
    title: 'English Harbour Naval Dockyard',
    shortName: "Nelson's Dockyard",
    era: '1745 – 1889 (Georgian Era)',
    badge: 'UNESCO Core Site #1499',
    coords: [17.0076, -61.7644],
    zoomLevel: 17,
    description:
      'The only continuously operating Georgian naval dockyard in the world. Built in a sheltered natural hurricane haven by enslaved Africans and Royal Navy shipwrights, it features restored 18th-century capstan houses, sail lofts, copper store, and stone officer quarters.',
    unescoCriteria: 'Criterion (iv) and (vi) — Outstanding example of Georgian naval architecture & maritime military engineering in the Caribbean.',
    historicalSignificance:
      'Served as the primary strategic base for Admiral Horatio Nelson and the British Royal Navy fleet during the Napoleonic wars and Caribbean trade route disputes.',
    regulations: [
      'Strict 5-knot maximum speed limit inside all marina channels.',
      'No bilge pumping, chemical cleaning, or blackwater dumping permitted in harbour waters.',
      'All commercial film crews and drone operators must obtain National Park permits.',
      'Climbing onto preserved 18th-century stone capstans or drydock stone pillars is strictly prohibited.',
    ],
    visitorTip:
      "Explore the Naval Officers' House Museum upstairs, check out the historical slipways, and catch the passenger water taxi over to Galleon Beach.",
    iconName: 'Landmark',
    color: '#00bcd4',
  },
  {
    id: 'fort-berkeley',
    title: 'Fort Berkeley Bastion',
    shortName: 'Fort Berkeley',
    era: 'Constructed 1704',
    badge: 'Maritime Citadel Bastion',
    coords: [17.0048, -61.7672],
    zoomLevel: 17,
    description:
      'Perched dramatically on the narrow rocky spit guarding the mouth of English Harbour. Mounted 29 24-pounder cannons and anchored a massive wrought-iron boom chain that stretched across the harbor channel to Charlotte Point to stop privateers.',
    unescoCriteria: 'Key component of the Antigua naval defense perimeter protecting the deep-water harbor entrance.',
    historicalSignificance:
      'Oldest surviving fortification in English Harbour. It contains the original bomb-proof powder magazine built in 1807 with 8-foot thick stone walls.',
    regulations: [
      'Fort Berkeley waters form a strict No-Take Marine Sanctuary: fishing, spearfishing, and conch collection strictly prohibited.',
      'Vessel anchoring on the seafloor is banned — use registered mooring buoys only.',
      'Stay on designated stone paths; southern cliffs drop directly into high-energy surf.',
      'Leave no litter or food scraps that attract invasive mongoose.',
    ],
    visitorTip:
      'Walk the 15-minute coastal trail from Nelson\'s Dockyard. Look down from the bastion ramparts to see coral nursery trees in the turquoise water below.',
    iconName: 'Shield',
    color: '#ef4444',
  },
  {
    id: 'clarence-house',
    title: 'Clarence House',
    shortName: 'Clarence House',
    era: 'Erected 1804',
    badge: 'Royal Governor Residence',
    coords: [17.0092, -61.7628],
    zoomLevel: 17,
    description:
      "Stately Georgian stone residence constructed for Prince William Henry, Duke of Clarence (later King William IV) during his tenure as Royal Navy commander. Set amidst lush hillside gardens overlooking the turquoise waters of Freeman's Bay.",
    unescoCriteria: 'Exemplary British colonial governor architectural residence integrating Caribbean trade-wind ventilation design.',
    historicalSignificance:
      'Hosted royalty and colonial dignitaries for two centuries, including Princess Margaret on her Caribbean honeymoon in 1955. Fully restored following hurricane damage.',
    regulations: [
      'Respect historical botanical gardens; do not pick native orchids, frangipani, or medicinal herbs.',
      'Commercial tours by guided appointment only.',
      'Preserve quiet acoustic buffer for nearby nesting sea birds and mangrove nursery flats.',
    ],
    visitorTip:
      'Take photos from the veranda overlooking the harbor basin. The hillside provides an unbeatable view of mega-yachts navigating the outer channel.',
    iconName: 'Compass',
    color: '#eab308',
  },
  {
    id: 'shirley-heights',
    title: 'Shirley Heights',
    shortName: 'Shirley Heights',
    era: 'Fortified 1781',
    badge: 'Panoramic Lookout Citadel',
    coords: [16.9998, -61.7538],
    zoomLevel: 16,
    description:
      'A sprawling military hilltop citadel positioned 490 feet above sea level. Established by Major-General Thomas Shirley, it features historic barracks, ordnance stores, artillery batteries, and the historic signal station that once communicated with St. John\'s.',
    unescoCriteria: 'Masterwork of 18th-century tropical hilltop military fortification and panoramic optical signaling.',
    historicalSignificance:
      'Commanded unobstructed 360-degree vistas of the Caribbean Sea, English Harbour, Falmouth Harbour, and neighboring islands of Guadeloupe and Montserrat.',
    regulations: [
      'Hiking trail requires sturdy footwear; loose scree and steep drops on cliffside path to Galleon Beach.',
      'Respect historical cemetery and 18th-century brick ordnance ruins — no climbing on structural walls.',
      'Maintain campfire and BBQ prohibition on dry scrubland vegetation.',
    ],
    visitorTip:
      'Visit on Sunday afternoon for the famous steel pan barbecue, or hike up early morning along the coastal trail from Galleon Beach for sunrise over the Pillars of Hercules.',
    iconName: 'Eye',
    color: '#10b981',
  },
]

export const CARIBBEAN_MARINE_SPECIES: MarineSpeciesGuide[] = [
  {
    id: 'hawksbill-turtle',
    name: 'Hawksbill Turtle',
    scientificName: 'Eretmochelys imbricata',
    conservationStatus: 'Critically Endangered',
    statusBadgeColor: '#ef4444',
    habitat: 'Galleon Beach Seagrass & Freeman\'s Bay Coral Reefs',
    primaryLocation: 'Galleon Beach & Freeman Bay Reef Flats',
    coords: [17.0028, -61.7602],
    zoomLevel: 17,
    description:
      'Distinguished by its narrow, pointed beak and overlapping shell scutes with rich tortoiseshell patterns. Hawksbill turtles are vital engineers of Caribbean coral reefs, feeding almost exclusively on aggressive sponges that would otherwise overgrow reef-building corals.',
    ecologicalRole:
      'Spongivore specialist. By removing dense sponges from reef crevices, Hawksbills create space for slow-growing Elkhorn and Brain Corals to establish and flourish.',
    visitorRules: [
      'Maintain a minimum distance of at least 3 meters (10 feet) while snorkeling.',
      'Never touch, chase, ride, or block a sea turtle when it swims to the surface to breathe.',
      'Artificial lights and flash photography are strictly illegal on turtle nesting beaches after sunset.',
      'Dispose of all plastic bags and monofilament lines — turtles mistake plastic for jellyfish.',
    ],
    icon: '🐢',
    color: '#10b981',
  },
  {
    id: 'queen-conch',
    name: 'Queen Conch',
    scientificName: 'Aliger gigas (Strombus gigas)',
    conservationStatus: 'CITES Appendix II / Protected',
    statusBadgeColor: '#f59e0b',
    habitat: 'Shallow Seagrass Flats & Sandy Lagoon Basins (1–15m)',
    primaryLocation: 'Freeman\'s Bay & Middle Ground Sand Flats',
    coords: [17.0042, -61.7640],
    zoomLevel: 17,
    description:
      'A large, slow-moving marine herbivorous mollusk known for its magnificent heavy shell with a flared pink or peach interior lip. Queen Conch are essential cleaners of Caribbean seagrass beds.',
    ecologicalRole:
      'Herbivorous grazer feeding on macroalgae, detritus, and epiphytes growing on turtle grass. Prevents algae smothering and aerates the sandy seabed.',
    visitorRules: [
      'Zero harvesting within Nelson\'s Dockyard Marine Protected Area — penalties include hefty fines and confiscation.',
      'Taking live or dead Queen Conch shells from the park is strictly prohibited under CITES regulations.',
      'Avoid standing or kicking fins on seagrass meadows where juvenile conch congregate.',
      'Report any illegal conch netting or spearfishing immediately to park rangers.',
    ],
    icon: '🐚',
    color: '#f59e0b',
  },
  {
    id: 'nurse-shark',
    name: 'Nurse Shark',
    scientificName: 'Ginglymostoma cirratum',
    conservationStatus: 'Vulnerable',
    statusBadgeColor: '#00bcd4',
    habitat: 'Reef Caves, Rocky Ledges & Seafloor Channels',
    primaryLocation: 'Fort Berkeley Point & Outer Harbour Reefs',
    coords: [17.0018, -61.7665],
    zoomLevel: 17,
    description:
      'A docile, bottom-dwelling shark with broad, rounded fins, two fleshy sensory barbels near its mouth, and small serrated teeth. Unlike many other sharks, Nurse Sharks can pump water over their gills while resting completely motionless on the sand.',
    ecologicalRole:
      'Nocturnal benthic predator feeding on spiny lobsters, crabs, sea urchins, and small fish, maintaining healthy ecological balance across reef communities.',
    visitorRules: [
      'Non-aggressive unless provoked: never attempt to touch, grab the tail, or corner a shark inside caves.',
      'Spearfishing or shark feeding is strictly forbidden across all park waters.',
      'Keep underwater camera strobes at a respectful distance to avoid disorienting resting sharks.',
    ],
    icon: '🦈',
    color: '#00bcd4',
  },
  {
    id: 'elkhorn-coral',
    name: 'Elkhorn Coral',
    scientificName: 'Acropora palmata',
    conservationStatus: 'Critically Endangered',
    statusBadgeColor: '#ef4444',
    habitat: 'High-Energy Outer Reef Crests & Fort Berkeley Nursery',
    primaryLocation: 'Fort Berkeley Coral Restoration Sanctuary',
    coords: [17.0035, -61.7672],
    zoomLevel: 17,
    description:
      'The iconic, fast-growing branching coral whose massive golden-brown antlers once dominated shallow Caribbean reefs. Elkhorn Coral forms extensive living breakwaters that absorb wave energy and protect Antigua\'s southern coastline from tropical storms.',
    ecologicalRole:
      'Keystone architectural reef builder providing essential 3D three-dimensional habitat for over 400 species of fish, lobsters, and juvenile marine life. NDNP biologists actively propagate micro-fragments on underwater PVC nursery trees.',
    visitorRules: [
      'Zero physical contact: even a gentle brush of a fin can break branches or strip fragile living tissue.',
      'Only mineral (non-nano zinc oxide) reef-safe sunscreen is permitted in park waters — oxybenzone and octinoxate are strictly banned.',
      'Vessels must never drop anchor in coral zones — use official mooring buoys only.',
      'Report any white bleaching, disease lesions, or anchor damage via the visitor reporting tool.',
    ],
    icon: '🪸',
    color: '#f43f5e',
  },
]
