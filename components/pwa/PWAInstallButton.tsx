'use client'

import React, { useState } from 'react'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { Download, Smartphone, X, Check, Laptop, Sparkles } from 'lucide-react'

interface PWAInstallButtonProps {
  variant?: 'header' | 'banner' | 'hero' | 'sidebar'
  className?: string
  showAlways?: boolean
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  showAlways = true,
}) => {
  const [mounted, setMounted] = useState(false)
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall()
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [justInstalled, setJustInstalled] = useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  // Hide if already running inside installed standalone PWA
  if (isInstalled && !justInstalled) {
    return null
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const success = await install()
      if (success) {
        setJustInstalled(true)
        setTimeout(() => setJustInstalled(false), 4000)
      }
    } else {
      // Show guided instructions for iOS Safari or Desktop Chrome/Edge
      setShowGuideModal(true)
    }
  }

  if (justInstalled) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: variant === 'hero' ? '10px 20px' : '6px 12px',
          borderRadius: '8px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#10b981',
          fontSize: '12px',
          fontWeight: 700,
        }}
      >
        <Check size={14} /> Installed Successfully
      </span>
    )
  }

  // Render button based on variant
  const renderButton = () => {
    if (variant === 'hero') {
      return (
        <button
          onClick={handleInstallClick}
          title="Install NDNP App for Offline Field Use"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(0, 188, 212, 0.2), rgba(0, 119, 168, 0.25))',
            border: '1px solid rgba(0, 188, 212, 0.6)',
            color: '#00bcd4',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0, 188, 212, 0.2)',
            transition: 'all 0.15s ease',
          }}
        >
          <Download size={16} />
          <span>Install App (Offline Ready)</span>
        </button>
      )
    }

    if (variant === 'sidebar') {
      return (
        <button
          onClick={handleInstallClick}
          title="Install PWA on device"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: '7px',
            border: '1px solid rgba(0, 188, 212, 0.3)',
            background: 'rgba(0, 188, 212, 0.08)',
            color: 'var(--teal, #00bcd4)',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 150ms',
            marginBottom: '8px',
          }}
        >
          <Download size={14} />
          <span>Install Offline App</span>
        </button>
      )
    }

    // Default: 'header' variant
    return (
      <button
        onClick={handleInstallClick}
        title="Install NDNP App for Offline Field Use"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '7px 12px',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, rgba(0, 188, 212, 0.15), rgba(0, 119, 168, 0.15))',
          border: '1px solid rgba(0, 188, 212, 0.4)',
          color: 'var(--teal, #00bcd4)',
          fontSize: '12px',
          fontWeight: 700,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        <Download size={14} />
        <span>Install App</span>
      </button>
    )
  }

  return (
    <>
      {renderButton()}

      {/* Guided Install Instructions Modal */}
      {showGuideModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            padding: '16px',
          }}
          onClick={() => setShowGuideModal(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '420px',
              borderRadius: '16px',
              background: '#061928',
              border: '1px solid rgba(0, 188, 212, 0.35)',
              padding: '24px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.7)',
              color: '#ffffff',
              fontFamily: 'inherit',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="#00bcd4" />
                <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>Install NDNP MPA App</h3>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '16px' }}>
              Install this app onto your home screen or desktop to enable full <strong>offline navigation</strong>, cached marine satellite maps, and offline incident reporting when out at sea.
            </p>

            {isIOS ? (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px' }}>
                  <Smartphone size={16} /> iPhone &amp; iPad Instructions:
                </div>
                <ol style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.7, paddingLeft: '18px', margin: 0 }}>
                  <li>Tap the <strong>Share</strong> button (box with upward arrow) in the Safari toolbar.</li>
                  <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                  <li>Tap <strong>Add</strong> in the top-right corner to complete.</li>
                </ol>
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#38bdf8', marginBottom: '8px' }}>
                  <Laptop size={16} /> Chrome / Edge / Android Instructions:
                </div>
                <ol style={{ fontSize: '12.5px', color: '#cbd5e1', lineHeight: 1.7, paddingLeft: '18px', margin: 0 }}>
                  <li>Look for the <strong>Install App icon</strong> (computer monitor with download arrow) in the browser address bar.</li>
                  <li>Or click the browser menu (<strong>⋮</strong> or <strong>…</strong>) in the top right.</li>
                  <li>Select <strong>Install NDNP MPA-MES</strong> or <strong>Add to Home screen</strong>.</li>
                </ol>
              </div>
            )}

            <button
              onClick={() => setShowGuideModal(false)}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #00bcd4, #0077a8)',
                border: 'none',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default PWAInstallButton
