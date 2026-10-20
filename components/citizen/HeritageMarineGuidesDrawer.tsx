'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  UNESCO_HERITAGE_SITES,
  CARIBBEAN_MARINE_SPECIES,
  type UnescoHeritageSite,
  type MarineSpeciesGuide,
} from '@/lib/visitor/guides-data'
import {
  Landmark,
  Shield,
  Compass,
  Eye,
  Camera,
  MapPin,
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
  Info,
  AlertTriangle,
  Sparkles,
  Waves,
  X,
  Navigation,
} from 'lucide-react'

interface HeritageMarineGuidesDrawerProps {
  onSelectSite?: (site: UnescoHeritageSite) => void
  onSelectSpecies?: (species: MarineSpeciesGuide) => void
  selectedId?: string | null
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export default function HeritageMarineGuidesDrawer({
  onSelectSite,
  onSelectSpecies,
  selectedId,
  isCollapsed = false,
  onToggleCollapse,
}: HeritageMarineGuidesDrawerProps) {
  const [activeTab, setActiveTab] = useState<'heritage' | 'species' | 'zones'>('heritage')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  const filteredHeritage = UNESCO_HERITAGE_SITES.filter(
    (h) =>
      h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.badge.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredSpecies = CARIBBEAN_MARINE_SPECIES.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.scientificName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.habitat.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.conservationStatus.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const getHeritageIcon = (iconName: string, color: string) => {
    switch (iconName) {
      case 'Landmark':
        return <Landmark size={20} color={color} />
      case 'Shield':
        return <Shield size={20} color={color} />
      case 'Compass':
        return <Compass size={20} color={color} />
      case 'Eye':
        return <Eye size={20} color={color} />
      default:
        return <Landmark size={20} color={color} />
    }
  }

  return (
    <aside
      aria-label="Heritage and Marine Guides"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        overflow: 'hidden',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #00bcd4, #0077a8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <Compass size={16} />
          </div>
          <div>
            <h2 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>
              Heritage &amp; Marine Guides
            </h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
              Interactive UNESCO &amp; Marine Biodiversity
            </p>
          </div>
        </div>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '6px 8px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
            }}
          >
            {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          padding: '6px 8px 0',
          gap: '4px',
        }}
      >
        <button
          onClick={() => setActiveTab('heritage')}
          style={{
            flex: 1,
            padding: '8px 10px',
            fontSize: '12px',
            fontWeight: 700,
            borderRadius: '8px 8px 0 0',
            background: activeTab === 'heritage' ? 'var(--surface2)' : 'transparent',
            border: '1px solid',
            borderColor: activeTab === 'heritage' ? 'var(--border) var(--border) transparent' : 'transparent',
            color: activeTab === 'heritage' ? 'var(--teal)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Landmark size={14} />
          <span>UNESCO Sites (4)</span>
        </button>

        <button
          onClick={() => setActiveTab('species')}
          style={{
            flex: 1,
            padding: '8px 10px',
            fontSize: '12px',
            fontWeight: 700,
            borderRadius: '8px 8px 0 0',
            background: activeTab === 'species' ? 'var(--surface2)' : 'transparent',
            border: '1px solid',
            borderColor: activeTab === 'species' ? 'var(--border) var(--border) transparent' : 'transparent',
            color: activeTab === 'species' ? '#10b981' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Waves size={14} />
          <span>Marine Species (4)</span>
        </button>
      </div>

      {/* Search Input */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '6px 10px',
          }}
        >
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder={
              activeTab === 'heritage'
                ? 'Search Dockyard, Berkeley, Clarence...'
                : 'Search Turtle, Conch, Shark, Coral...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontSize: '12px',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Card Content List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activeTab === 'heritage' ? (
          <>
            {filteredHeritage.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No heritage sites found matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              filteredHeritage.map((site) => {
                const isSelected = selectedId === site.id
                const isExpanded = expandedCardId === site.id || isSelected

                return (
                  <article
                    key={site.id}
                    id={`guide-card-${site.id}`}
                    style={{
                      background: isSelected ? 'rgba(0,188,212,0.06)' : 'var(--surface2)',
                      border: isSelected ? '1.5px solid var(--teal)' : '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '14px',
                      boxShadow: isSelected ? '0 0 12px rgba(0,188,212,0.2)' : 'var(--card-shadow)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: `${site.color}18`,
                            border: `1px solid ${site.color}40`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {getHeritageIcon(site.iconName, site.color)}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
                            {site.title}
                          </h3>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                            {site.era}
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: site.color,
                          background: `${site.color}15`,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          border: `1px solid ${site.color}30`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {site.badge}
                      </span>
                    </div>

                    {/* Summary Description */}
                    <p style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.5, margin: 0 }}>
                      {site.description}
                    </p>

                    {/* Collapsible Details */}
                    {isExpanded && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          paddingTop: '8px',
                          borderTop: '1px dashed var(--border)',
                          fontSize: '11px',
                        }}
                      >
                        <div style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 700, color: 'var(--teal)', marginBottom: '2px' }}>
                            UNESCO Significance
                          </div>
                          <div style={{ color: 'var(--text-muted)' }}>{site.unescoCriteria}</div>
                        </div>

                        <div style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                            Preservation Regulations &amp; Rules
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {site.regulations.map((rule, idx) => (
                              <li key={idx}>{rule}</li>
                            ))}
                          </ul>
                        </div>

                        <div style={{ fontStyle: 'italic', color: 'var(--text-muted)', background: 'rgba(0,188,212,0.06)', padding: '6px 10px', borderRadius: '6px' }}>
                          💡 <strong>Visitor Tip:</strong> {site.visitorTip}
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '6px',
                        borderTop: '1px solid var(--border)',
                        gap: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        onClick={() => setExpandedCardId(isExpanded ? null : site.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '4px 6px',
                        }}
                      >
                        {isExpanded ? (
                          <>
                            Less Info <ChevronUp size={12} />
                          </>
                        ) : (
                          <>
                            Full Guide <ChevronDown size={12} />
                          </>
                        )}
                      </button>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {onSelectSite && (
                          <button
                            onClick={() => onSelectSite(site)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              color: 'var(--teal)',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Navigation size={12} />
                            <span>Fly to Site</span>
                          </button>
                        )}

                        <Link
                          href={`/report?loc=${encodeURIComponent(site.title)}&lat=${site.coords[0]}&lng=${site.coords[1]}`}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #00bcd4, #0077a8)',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 6px rgba(0,188,212,0.25)',
                          }}
                        >
                          <Camera size={12} />
                          <span>Report Here</span>
                        </Link>
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </>
        ) : (
          <>
            {filteredSpecies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No marine species found matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              filteredSpecies.map((species) => {
                const isSelected = selectedId === species.id
                const isExpanded = expandedCardId === species.id || isSelected

                return (
                  <article
                    key={species.id}
                    id={`species-card-${species.id}`}
                    style={{
                      background: isSelected ? 'rgba(16,185,129,0.06)' : 'var(--surface2)',
                      border: isSelected ? '1.5px solid #10b981' : '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '14px',
                      boxShadow: isSelected ? '0 0 12px rgba(16,185,129,0.2)' : 'var(--card-shadow)',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '10px',
                            background: `${species.color}18`,
                            border: `1px solid ${species.color}40`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '20px',
                            flexShrink: 0,
                          }}
                        >
                          {species.icon}
                        </div>
                        <div>
                          <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', margin: 0, lineHeight: 1.2 }}>
                            {species.name}
                          </h3>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '2px' }}>
                            {species.scientificName}
                          </div>
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          color: species.statusBadgeColor,
                          background: `${species.statusBadgeColor}15`,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          border: `1px solid ${species.statusBadgeColor}30`,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {species.conservationStatus}
                      </span>
                    </div>

                    {/* Habitat Line */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--text-muted)' }}>
                      <MapPin size={12} color={species.color} />
                      <span>{species.habitat}</span>
                    </div>

                    {/* Summary Description */}
                    <p style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.5, margin: 0 }}>
                      {species.description}
                    </p>

                    {/* Collapsible Details */}
                    {isExpanded && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          paddingTop: '8px',
                          borderTop: '1px dashed var(--border)',
                          fontSize: '11px',
                        }}
                      >
                        <div style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 700, color: '#10b981', marginBottom: '2px' }}>
                            Ecological Role
                          </div>
                          <div style={{ color: 'var(--text-muted)' }}>{species.ecologicalRole}</div>
                        </div>

                        <div style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                            Visitor Interaction Guidelines &amp; Laws
                          </div>
                          <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-dim)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            {species.visitorRules.map((rule, idx) => (
                              <li key={idx}>{rule}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Action Bar */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: '6px',
                        borderTop: '1px solid var(--border)',
                        gap: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        onClick={() => setExpandedCardId(isExpanded ? null : species.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '4px 6px',
                        }}
                      >
                        {isExpanded ? (
                          <>
                            Less Info <ChevronUp size={12} />
                          </>
                        ) : (
                          <>
                            Full Guide <ChevronDown size={12} />
                          </>
                        )}
                      </button>

                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {onSelectSpecies && (
                          <button
                            onClick={() => onSelectSpecies(species)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              color: '#10b981',
                              fontSize: '11px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <Navigation size={12} />
                            <span>Show Habitat</span>
                          </button>
                        )}

                        <Link
                          href={`/report?type=wildlife&species=${encodeURIComponent(species.name)}&lat=${species.coords[0]}&lng=${species.coords[1]}`}
                          style={{
                            padding: '5px 10px',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 700,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 6px rgba(16,185,129,0.25)',
                          }}
                        >
                          <Camera size={12} />
                          <span>Log Sighting</span>
                        </Link>
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </>
        )}
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: '10px 14px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-muted)',
        }}
      >
        <span>UNESCO World Heritage Site #1499</span>
        <Link
          href="/report"
          style={{ color: 'var(--teal)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Camera size={12} />
          Report Threat
        </Link>
      </div>
    </aside>
  )
}
