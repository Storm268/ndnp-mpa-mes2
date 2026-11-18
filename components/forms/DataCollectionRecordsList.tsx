'use client'

import { useState } from 'react'
import {
  Fish,
  Droplets,
  Landmark,
  Shield,
  Users,
  Binoculars,
  AlertTriangle,
  Sparkles,
  Filter,
} from 'lucide-react'

export type DataCollectionRecordType =
  | 'coral'
  | 'fish'
  | 'water_quality'
  | 'heritage'
  | 'patrol'
  | 'visitor'
  | 'wildlife'
  | 'incident'

export interface DataCollectionRecordItem {
  id: string
  type: DataCollectionRecordType
  typeLabel: string
  formCode: string
  color: string
  title: string
  summary: string
  statusBadge?: string
  statusColor?: string
  timestamp: string
}

const TYPE_META: Record<
  DataCollectionRecordType,
  { label: string; color: string; Icon: typeof Sparkles }
> = {
  coral: { label: 'Live Coral', color: '#0d9488', Icon: Sparkles },
  fish: { label: 'Fish Survey', color: '#4fb3e8', Icon: Fish },
  water_quality: { label: 'Water Quality', color: '#0891b2', Icon: Droplets },
  heritage: { label: 'Heritage', color: '#f59e0b', Icon: Landmark },
  patrol: { label: 'Patrol Log', color: '#3b82f6', Icon: Shield },
  visitor: { label: 'Visitor Survey', color: '#8b5cf6', Icon: Users },
  wildlife: { label: 'Wildlife', color: '#22c55e', Icon: Binoculars },
  incident: { label: 'Incident', color: '#ef4444', Icon: AlertTriangle },
}

export function DataCollectionRecordsList({
  records,
}: {
  records: DataCollectionRecordItem[]
}) {
  const [selectedType, setSelectedType] = useState<'all' | DataCollectionRecordType>('all')

  const counts = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + 1
    return acc
  }, {})

  const filtered =
    selectedType === 'all'
      ? records
      : records.filter((r) => r.type === selectedType)

  return (
    <div style={{ marginTop: '36px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '12px',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              marginBottom: '2px',
            }}
          >
            Recent Data Collection Records
          </h2>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            Live records across Live Coral, Fish Surveys, Water Quality, Heritage, Patrols, Visitor Surveys, and Citizen Science
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              marginRight: '4px',
            }}
          >
            <Filter size={12} /> Filter:
          </span>
          <button
            type="button"
            onClick={() => setSelectedType('all')}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: `1px solid ${selectedType === 'all' ? 'var(--teal)' : 'var(--border)'}`,
              background: selectedType === 'all' ? 'rgba(13,148,136,0.14)' : 'var(--surface)',
              color: selectedType === 'all' ? 'var(--teal)' : 'var(--text-dim)',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            All ({records.length})
          </button>
          {(Object.keys(TYPE_META) as DataCollectionRecordType[]).map((t) => {
            const count = counts[t] ?? 0
            const meta = TYPE_META[t]
            const active = selectedType === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedType(t)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: `1px solid ${active ? meta.color : 'var(--border)'}`,
                  background: active ? `${meta.color}1c` : 'var(--surface)',
                  color: active ? meta.color : 'var(--text-dim)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {meta.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      <div
        className="card"
        style={{
          overflow: 'hidden',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
              {['Category', 'Station / Subject', 'Summary', 'Status', 'Recorded'].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: '10px 14px',
                    textAlign: 'left',
                    fontSize: '0.62rem',
                    fontWeight: 700,
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: '24px 14px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.82rem',
                  }}
                >
                  No records recorded in this category yet.
                </td>
              </tr>
            ) : (
              filtered.map((rec) => {
                const meta = TYPE_META[rec.type]
                const Icon = meta.Icon
                const date = rec.timestamp
                  ? new Date(rec.timestamp).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'
                return (
                  <tr key={`${rec.type}-${rec.id}`} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
                        <span
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '6px',
                            background: `${rec.color}18`,
                            border: `1px solid ${rec.color}38`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: rec.color,
                            flexShrink: 0,
                          }}
                        >
                          <Icon size={13} />
                        </span>
                        <div>
                          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: rec.color }}>
                            {rec.typeLabel}
                          </div>
                          <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                            {rec.formCode}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text)' }}>
                      {rec.title}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'var(--text-dim)', maxWidth: '340px' }}>
                      {rec.summary}
                    </td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                      {rec.statusBadge ? (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            color: rec.statusColor || 'var(--teal)',
                            background: `${rec.statusColor || '#0d9488'}18`,
                          }}
                        >
                          {rec.statusBadge}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Recorded</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {date}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
