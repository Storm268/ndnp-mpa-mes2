'use client'

export interface ExitSurveySubmission {
  overallRating: number
  wildlifeObserved: string[]
  cleanlinessRating: number
  rangerInteractionRating: number
  comments?: string
  submittedAt: string
}

export interface VisitorProfile {
  isRegistered: boolean
  id: string
  name: string
  email: string
  reportsCount: number
  gateScanned: boolean
  gateScannedAt: string
  gatePassId: string
  surveyCompleted: boolean
  surveyData?: ExitSurveySubmission
}

const STORAGE_KEY = 'ndnp_visitor_profile_v2'

const DEFAULT_PROFILE: VisitorProfile = {
  isRegistered: false,
  id: 'guest_' + (typeof crypto !== 'undefined' ? crypto.randomUUID().slice(0, 8) : '2026ndnp'),
  name: 'Park Visitor (Guest)',
  email: 'visitor@ndnp-guest.local',
  reportsCount: 0,
  gateScanned: true,
  gateScannedAt: new Date().toISOString(),
  gatePassId: 'NDNP-2026-GATE01',
  surveyCompleted: false,
}

export function getVisitorProfile(): VisitorProfile {
  if (typeof window === 'undefined') return DEFAULT_PROFILE
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROFILE))
      return DEFAULT_PROFILE
    }
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PROFILE
  }
}

export function saveVisitorProfile(profile: VisitorProfile): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
    window.dispatchEvent(new Event('ndnp_visitor_updated'))
  } catch (e) {
    console.error('Failed to save visitor profile:', e)
  }
}

export function incrementReportCount(): VisitorProfile {
  const profile = getVisitorProfile()
  const updated: VisitorProfile = {
    ...profile,
    reportsCount: (profile.reportsCount || 0) + 1,
  }
  saveVisitorProfile(updated)
  return updated
}

export function completeExitSurvey(submission: ExitSurveySubmission): VisitorProfile {
  const profile = getVisitorProfile()
  const updated: VisitorProfile = {
    ...profile,
    surveyCompleted: true,
    surveyData: submission,
  }
  saveVisitorProfile(updated)
  return updated
}

export function simulateGateScan(): VisitorProfile {
  const profile = getVisitorProfile()
  const randomNum = Math.floor(1000 + Math.random() * 9000)
  const updated: VisitorProfile = {
    ...profile,
    gateScanned: true,
    gateScannedAt: new Date().toISOString(),
    gatePassId: `NDNP-2026-GATE${randomNum}`,
  }
  saveVisitorProfile(updated)
  return updated
}
