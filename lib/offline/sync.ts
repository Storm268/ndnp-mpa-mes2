/**
 * NDNP MPA-MES — Offline Sync Engine
 *
 * Uploads queued reports (and their photos) to Supabase when connectivity returns.
 * Called by useOffline() on the 'online' event and by the Service Worker
 * on a Background Sync event.
 */
import { createClient } from '@/lib/supabase/client'
import {
  getPendingReports,
  updateReport,
  deleteSyncedReports,
  type PendingReport,
} from './db'

export interface SyncResult {
  succeeded: number
  failed:    number
  skipped:   number
}

// Max retries before giving up on a report
const MAX_RETRIES = 5

/**
 * Sync all pending reports to Supabase.
 * @param onProgress  called with (done, total) after each report
 */
export async function syncAllPending(
  onProgress?: (done: number, total: number) => void
): Promise<SyncResult> {
  const pending = await getPendingReports()
  const total   = pending.length
  if (total === 0) return { succeeded: 0, failed: 0, skipped: 0 }

  let succeeded = 0, failed = 0, skipped = 0

  for (let i = 0; i < pending.length; i++) {
    const report = pending[i]
    onProgress?.(i, total)

    // Skip reports that have exceeded max retries
    if (report.retry_count >= MAX_RETRIES) {
      skipped++
      continue
    }

    try {
      await syncReport(report)
      succeeded++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed'
      await updateReport(report.id, { status: 'failed', error: msg })
      failed++
    }
  }

  onProgress?.(total, total)

  // Clean up successfully synced records (keep recent failed ones for retry)
  await deleteSyncedReports()

  return { succeeded, failed, skipped }
}

async function syncReport(report: PendingReport): Promise<void> {
  await updateReport(report.id, { status: 'syncing' })
  const supabase = createClient()

  // ─ Step 1: Upload offline photos (stored as data-URIs) ──────────────────────
  let photoUrls: string[] = []
  if (report.photo_blobs && report.photo_blobs.length > 0) {
    photoUrls = await uploadPhotoBlobs(report.photo_blobs, report.id)
  }

  // ─ Step 2: Build final row with any existing online URLs ─────────────────
  const existingUrls = (report.payload.photo_urls as string[] | null) ?? []
  const allPhotoUrls = [...existingUrls, ...photoUrls]

  const finalPayload = {
    ...report.payload,
    photo_urls:      allPhotoUrls.length > 0 ? allPhotoUrls : null,
    is_offline_sync: true,
  }

  // ─ Step 3: Insert into Supabase ────────────────────────────────────
  const { error } = await supabase.from(report.table).insert(finalPayload)
  if (error) throw new Error(error.message)

  await updateReport(report.id, { status: 'synced', error: undefined })
}

async function uploadPhotoBlobs(
  dataUris: string[],
  reportId: string
): Promise<string[]> {
  const supabase = createClient()
  const urls: string[] = []

  for (let i = 0; i < dataUris.length; i++) {
    try {
      const dataUri = dataUris[i]
      const res     = await fetch(dataUri)
      const blob    = await res.blob()
      const path    = `offline/${reportId}-${i}.jpg`

      const { data, error } = await supabase.storage
        .from('report-photos')
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })

      if (!error && data) {
        const { data: urlData } = supabase.storage
          .from('report-photos')
          .getPublicUrl(data.path)
        urls.push(urlData.publicUrl)
      }
    } catch {
      // If one photo fails, continue with the rest
    }
  }

  return urls
}

/**
 * Pre-fetch reference data (station lists, etc.) into IndexedDB
 * so forms work offline.
 */
export async function prefetchReferenceData(): Promise<void> {
  if (!navigator.onLine) return
  try {
    const { cacheData } = await import('./db')
    const supabase = createClient()

    const [stations, heritage, zones] = await Promise.all([
      supabase.from('monitoring_stations').select('id,station_code,name,station_type,lat,lng').eq('is_active', true),
      supabase.from('heritage_sites').select('id,site_code,name,site_type,lat,lng').eq('is_active', true),
      supabase.from('park_zones').select('id,zone_name,zone_type,description'),
    ])

    if (stations.data) await cacheData('monitoring_stations', stations.data)
    if (heritage.data)  await cacheData('heritage_sites',     heritage.data)
    if (zones.data)     await cacheData('park_zones',         zones.data)
  } catch {
    // Prefetch is best-effort — don't block if it fails
  }
}

