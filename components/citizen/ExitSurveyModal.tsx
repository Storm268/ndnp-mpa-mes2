'use client'

import { useState } from 'react'
import { completeExitSurvey, type ExitSurveySubmission, getVisitorProfile } from '@/lib/visitor/store'
import { Star, Check, Sparkles, X, Heart, ShieldCheck } from 'lucide-react'

interface ExitSurveyModalProps {
  isOpen: boolean
  onClose: () => void
  onCompleted?: () => void
}

const WILDLIFE_OPTIONS = [
  { id: 'hawksbill', label: 'Hawksbill Sea Turtle', icon: '🐢' },
  { id: 'green_turtle', label: 'Green Sea Turtle', icon: '🐢' },
  { id: 'pelican', label: 'Brown Pelican', icon: '🪶' },
  { id: 'frigatebird', label: 'Magnificent Frigatebird', icon: '🦅' },
  { id: 'nurse_shark', label: 'Nurse Shark', icon: '🦈' },
  { id: 'lobster', label: 'Spiny Lobster', icon: '🦞' },
  { id: 'conch', label: 'Queen Conch', icon: '🐚' },
  { id: 'eagle_ray', label: 'Spotted Eagle Ray', icon: '🌊' },
  { id: 'elkhorn_coral', label: 'Elkhorn / Staghorn Coral', icon: '🪸' },
]

export default function ExitSurveyModal({ isOpen, onClose, onCompleted }: ExitSurveyModalProps) {
  const [step, setStep] = useState(1)
  const [rating, setRating] = useState(5)
  const [selectedWildlife, setSelectedWildlife] = useState<string[]>([])
  const [cleanlinessRating, setCleanlinessRating] = useState(5)
  const [rangerRating, setRangerRating] = useState(5)
  const [comments, setComments] = useState('')
  const [awarded, setAwarded] = useState(false)

  if (!isOpen) return null

  const toggleWildlife = (id: string) => {
    if (selectedWildlife.includes(id)) {
      setSelectedWildlife(selectedWildlife.filter((w) => w !== id))
    } else {
      setSelectedWildlife([...selectedWildlife, id])
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const submission: ExitSurveySubmission = {
      overallRating: rating,
      wildlifeObserved: selectedWildlife,
      cleanlinessRating,
      rangerInteractionRating: rangerRating,
      comments,
      submittedAt: new Date().toISOString(),
    }
    const result = completeExitSurvey(submission)
    setAwarded(true)
    setTimeout(() => {
      onCompleted?.()
      onClose()
    }, 1800)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '18px',
          maxWidth: '500px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(0,188,212,0.12), rgba(0,119,168,0.15))',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #00bcd4, #0077a8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)' }}>
                Visitor Exit Survey
              </div>
              <div style={{ fontSize: '11px', color: 'var(--teal)', fontWeight: 600 }}>
                Park Quality &amp; Conservation Feedback
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '20px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {awarded ? (
          <div style={{ padding: '40px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(16,185,129,0.15)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Sparkles size={32} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>
              Thank You, Ocean Steward!
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Your feedback helps our park rangers protect English Harbour and Shirley Heights.
            </p>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '20px',
                background: 'rgba(16,185,129,0.15)',
                border: '1px solid rgba(16,185,129,0.35)',
                color: '#10b981',
                fontWeight: 800,
                fontSize: '14px',
              }}
            >
              Survey Feedback Recorded
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
            {/* Step 1: Overall Visit Rating */}
            {step === 1 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
                  Step 1 of 3 · Overall Experience
                </div>
                <h4 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>
                  How was your visit to Nelson&apos;s Dockyard?
                </h4>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Rate your overall marine park, trail, and heritage experience today.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '28px' }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '6px',
                        transform: rating >= star ? 'scale(1.15)' : 'scale(1)',
                        transition: 'transform 120ms ease',
                      }}
                    >
                      <Star
                        size={36}
                        fill={rating >= star ? '#f59e0b' : 'transparent'}
                        color={rating >= star ? '#f59e0b' : 'var(--border)'}
                      />
                    </button>
                  ))}
                </div>

                <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 700, color: 'var(--text)', marginBottom: '24px' }}>
                  {rating === 5 && '🌟 Exceptional — UNESCO World Heritage at its finest!'}
                  {rating === 4 && '👍 Great visit — Beautiful trails and pristine waters.'}
                  {rating === 3 && '👌 Good — Enjoyed the scenery and history.'}
                  {rating <= 2 && '⚠️ Needs improvement — We will address your feedback.'}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    style={{
                      background: 'var(--teal)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Next: Wildlife Observed →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Wildlife Observed */}
            {step === 2 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
                  Step 2 of 3 · Citizen Science
                </div>
                <h4 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', marginBottom: '6px' }}>
                  Which marine wildlife did you encounter?
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Tap all species you observed in the bays, trails, or snorkel zones.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '240px', overflowY: 'auto', marginBottom: '20px' }}>
                  {WILDLIFE_OPTIONS.map((w) => {
                    const active = selectedWildlife.includes(w.id)
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => toggleWildlife(w.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '10px',
                          borderRadius: '8px',
                          border: active ? '1px solid var(--teal)' : '1px solid var(--border)',
                          background: active ? 'rgba(0,188,212,0.1)' : 'var(--surface2)',
                          color: active ? 'var(--teal)' : 'var(--text)',
                          fontSize: '12px',
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: '16px' }}>{w.icon}</span>
                        <span style={{ flex: 1 }}>{w.label}</span>
                        {active && <Check size={14} color="var(--teal)" />}
                      </button>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    style={{
                      background: 'var(--surface2)',
                      color: 'var(--text-dim)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    style={{
                      background: 'var(--teal)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 20px',
                      fontSize: '13px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Next: Cleanliness & Notes →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Cleanliness, Rangers & Feedback */}
            {step === 3 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' }}>
                  Step 3 of 3 · Park Conditions
                </div>
                <h4 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text)', marginBottom: '14px' }}>
                  Park Cleanliness & Ranger Presence
                </h4>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '4px' }}>
                    Marine & Trail Cleanliness (1-5):
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={cleanlinessRating}
                    onChange={(e) => setCleanlinessRating(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--teal)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>1 (Litter observed)</span>
                    <span style={{ fontWeight: 700, color: 'var(--teal)' }}>Score: {cleanlinessRating}/5</span>
                    <span>5 (Pristine)</span>
                  </div>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-dim)', marginBottom: '4px' }}>
                    Additional feedback or ranger notes (optional):
                  </label>
                  <textarea
                    rows={3}
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Tell us what you loved, or any areas needing attention…"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface2)',
                      color: 'var(--text)',
                      fontSize: '12px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    style={{
                      background: 'var(--surface2)',
                      color: 'var(--text-dim)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    style={{
                      background: 'linear-gradient(135deg, #00bcd4, #0077a8)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 24px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 12px rgba(0,188,212,0.3)',
                    }}
                  >
                    <Sparkles size={15} />
                    Submit Feedback
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
