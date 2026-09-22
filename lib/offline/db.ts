/**
 * NDNP MPA-MES — Offline IndexedDB Store
 *
 * Stores pending reports and photos when the device has no internet.
 * Uses `idb` (a tiny Promise wrapper around IndexedDB).
 *
 * Schema:
 *   pending_reports  — queued incident / patrol / survey submissions
 *   cached_data      — station lists, heritage sites (pre-fetched for offline forms)
 */
import { openDB, type IDBPDatabase } from 'idb'

export type FormType =
  | 'incident_public'  // app/report
  | 'incident_staff'   // dashboard/forms/incident
  | 'patrol'           // dashboard/forms/patrol
  | 'wildlife'         // dashboard/forms/wildlife
  | 'coral'            // dashboard/forms/coral
  | 'fish'             // dashboard/forms/fish
  | 'heritage'         // dashboard/forms/heritage
  | 'water_quality'    // dashboard/forms/water-quality

export type SyncStatus = 'pending' | 'syncing' | 'failed' | 'synced'

export interface PendingReport {
  id:           string        // client-generated UUID
  created_at:   string        // ISO timestamp (local time of capture)
  updated_at:   string
  form_type:    FormType
  status:       SyncStatus
  retry_count:  number
  error?:       string
  // Supabase table to insert into
  table:        string
  // Row payload — ready to pass to supabase.from(table).insert(payload)
  payload:      Record<string, unknown>
  // Photos stored as data-URIs (base64) when offline upload isn't possible
  photo_blobs?: string[]
}

const DB_NAME    = 'ndnp-offline'
const DB_VERSION = 1

// Singleton DB connection
let _db: IDBPDatabase | null = null

export async function getOfflineDB(): Promise<IDBPDatabase> {
  if (_db) return _db
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade (db) {
      // Pending submissions queue
      if (!db.objectStoreNames.contains('pending_reports')) {
        const s = db.createObjectStore('pending_reports', { keyPath: 'id' })
        s.createIndex('by_status',    'status')
        s.createIndex('by_form_type', 'form_type')
        s.createIndex('by_created',   'created_at')
      }
      // Pre-fetched reference data (stations, heritage sites, etc.)
      if (!db.objectStoreNames.contains('cached_data')) {
        db.createObjectStore('cached_data', { keyPath: 'key' })
      }
    },
  })
  return _db
}

// ── Pending reports ───────────────────────────────────────────────────────────

export async function enqueueReport(
  partial: Pick<PendingReport, 'form_type' | 'table' | 'payload' | 'photo_blobs'>
): Promise<string> {
  const db  = await getOfflineDB()
  const id  = typeof crypto !== 'undefined' ? crypto.randomUUID() : Date.now().toString(36)
  const now = new Date().toISOString()
  const row: PendingReport = {
    id, created_at: now, updated_at: now,
    status: 'pending', retry_count: 0,
    ...partial,
  }
  await db.put('pending_reports', row)
  // Notify SW of pending sync (no-op if Background Sync unsupported)
  registerBackgroundSync()
  return id
}

export async function getPendingReports(): Promise<PendingReport[]> {
  const db  = await getOfflineDB()
  const all = await db.getAll('pending_reports')
  return all.filter(r => r.status === 'pending' || r.status === 'failed')
}

export async function getAllReports(): Promise<PendingReport[]> {
  const db = await getOfflineDB()
  return db.getAll('pending_reports')
}

export async function getPendingCount(): Promise<number> {
  const pending = await getPendingReports()
  return pending.length
}

export async function updateReport(
  id: string,
  changes: Partial<PendingReport>
): Promise<void> {
  const db  = await getOfflineDB()
  const row = await db.get('pending_reports', id)
  if (!row) return
  await db.put('pending_reports', {
    ...row, ...changes, id,
    updated_at:  new Date().toISOString(),
    retry_count: changes.status === 'failed' ? row.retry_count + 1 : row.retry_count,
  })
}

export async function deleteSyncedReports(): Promise<number> {
  const db     = await getOfflineDB()
  const all    = await db.getAll('pending_reports')
  const synced = all.filter(r => r.status === 'synced')
  await Promise.all(synced.map(r => db.delete('pending_reports', r.id)))
  return synced.length
}

// ── Reference data cache ─────────────────────────────────────────────────────

export async function cacheData(key: string, value: unknown): Promise<void> {
  const db = await getOfflineDB()
  await db.put('cached_data', { key, value, cached_at: new Date().toISOString() })
}

export async function getCachedData<T>(key: string): Promise<T | null> {
  const db  = await getOfflineDB()
  const row = await db.get('cached_data', key)
  return (row?.value as T) ?? null
}

// ── Background Sync registration ─────────────────────────────────────────────

function registerBackgroundSync(): void {
  if (typeof navigator === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready.then(reg => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const syncMgr = (reg as any).sync
    if (syncMgr) syncMgr.register('sync-pending-reports').catch(() => {/* ignore */})
  }).catch(() => {/* SW not available */})
}

