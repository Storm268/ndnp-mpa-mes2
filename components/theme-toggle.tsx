'use client'

import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import { Sun, Moon, Anchor } from 'lucide-react'

interface ThemeToggleProps {
  className?: string
  style?: React.CSSProperties
  compact?: boolean
  showLabel?: boolean
}

type ThemeMode = 'light' | 'dark' | 'default'

function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.setAttribute('data-theme', mode)
  root.classList.remove('light', 'dark', 'default')
  root.classList.add(mode)
  document.body?.setAttribute('data-theme', mode)
  document.body?.classList.remove('light', 'dark', 'default')
  document.body?.classList.add(mode)
}

export function ThemeToggle({
  className,
  style,
  compact = false,
  showLabel = true,
}: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [current, setCurrent] = useState<ThemeMode>('default')

  useEffect(() => {
    setMounted(true)
    const stored = (localStorage.getItem('theme') as ThemeMode) || (theme as ThemeMode) || 'default'
    setCurrent(stored)
    applyTheme(stored)
  }, [theme])

  const handleSelect = (mode: ThemeMode) => {
    setCurrent(mode)
    applyTheme(mode)
    try {
      localStorage.setItem('theme', mode)
    } catch {
      // ignore
    }
    setTheme(mode)
  }

  const activeMode = mounted ? current : 'default'

  const options: Array<{
    id: ThemeMode
    label: string
    icon: React.ReactNode
    title: string
  }> = [
    {
      id: 'light',
      label: 'Light',
      icon: <Sun size={13} strokeWidth={2.4} />,
      title: 'Light daylight mode — high contrast',
    },
    {
      id: 'dark',
      label: 'Dark',
      icon: <Moon size={13} strokeWidth={2.4} />,
      title: 'Dark midnight OLED mode — night operations',
    },
    {
      id: 'default',
      label: 'Default',
      icon: <Anchor size={13} strokeWidth={2.4} />,
      title: 'Default Caribbean Maritime mode — deep ocean',
    },
  ]

  return (
    <div
      role="group"
      aria-label="Appearance Mode"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px',
        borderRadius: '9px',
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
        gap: '2px',
        userSelect: 'none',
        ...style,
      }}
      className={className}
    >
      {options.map((opt) => {
        const isActive = activeMode === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleSelect(opt.id)}
            title={opt.title}
            aria-pressed={isActive}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: compact ? '0' : '5px',
              padding: compact ? '5px 8px' : '5px 11px',
              borderRadius: '6px',
              border: isActive ? '1px solid var(--border2)' : '1px solid transparent',
              background: isActive ? 'var(--surface)' : 'transparent',
              color: isActive ? 'var(--teal-light)' : 'var(--text-muted)',
              fontSize: '0.74rem',
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 140ms cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isActive ? '0 1px 4px rgba(0, 0, 0, 0.16)' : 'none',
              lineHeight: 1,
              flex: compact ? 'initial' : 1,
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                color: isActive ? 'var(--teal-light)' : 'inherit',
              }}
            >
              {opt.icon}
            </span>
            {showLabel && !compact && <span>{opt.label}</span>}
          </button>
        )
      })}
    </div>
  )
}
