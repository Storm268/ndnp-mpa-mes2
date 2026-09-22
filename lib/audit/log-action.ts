// NDNP MPA-MES — Shared Audit Logging
// Inserts immutable records into public.audit_log.
// Any authenticated user can INSERT; only system_admin can SELECT.
// Records are protected by DB-level immutability rules (no UPDATE / DELETE).

import { createClient } from '@/lib/supabase/client'

// Map of human-readable action labels used in the UI
export const ACTION_LABELS: Record<string, string> = {
  create:              'Record Created',
  update:              'Record Updated',
  delete:              'Record Deleted',
  login:               'User Login',
  logout:              'User Logout',
  failed_login:        'Failed Login',
  password_change:     'Password Changed',
  permission_change:   'Role Changed',
  user_created:        'User Created',
  validation_decision: 'CS Validation Decision',
  // Extended actions (stored as create/update + table_name)
  form_submit:         'Form Submission',
  alert_acknowledged:  'Alert Acknowledged',
  alert_resolved:      'Alert Resolved',
  report_downloaded:   'Report Downloaded',
  data_export:         'Data Exported',
}

export const TABLE_LABELS: Record<string, string> = {
  coral_surveys:            'Coral Monitoring (FR-FORM-01)',
  fish_surveys:             'Fish Survey (FR-FORM-02)',
  heritage_assessments:     'Heritage Assessment (FR-FORM-03)',
  patrol_logs:              'Patrol Log (FR-FORM-04)',
  water_quality:            'Water Quality (FR-FORM-05)',
  visitor_surveys:          'Visitor Survey (FR-FORM-06)',
  citizen_science_reports:  'Citizen Science (FR-FORM-07/08)',
  alerts:                   'Alerts',
  reports:                  'Reports',
  profiles:                 'User Profiles',
  audit_log:                'Audit Log',
}

export type AuditActionType =
  | 'create' | 'update' | 'delete'
  | 'login'  | 'logout' | 'failed_login'
  | 'password_change' | 'permission_change'
  | 'user_created' | 'validation_decision'

export interface LogActionOptions {
  /** One of the audit_action enum values */
  action: AuditActionType
  /** The DB table this action relates to (e.g. 'coral_surveys', 'alerts', 'reports') */
  tableName?: string
  /** ID of the affected record */
  recordId?: string
  /** Human-readable description stored in after_value */
  description?: string
  /** Extra metadata stored in after_value */
  metadata?: Record<string, unknown>
}

/**
 * Log a user action to the immutable audit_log table.
 * Fire-and-forget — errors are caught silently so they never block UX.
 */
export async function logAction(opts: LogActionOptions): Promise<void> {
  try {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return

    // Fetch profile for role (non-blocking — use cached minimal query)
    const { data: profile } = await sb
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    await sb.from('audit_log').insert({
      user_id:     user.id,
      user_email:  user.email ?? null,
      user_role:   profile?.role ?? null,
      action_type: opts.action,
      table_name:  opts.tableName ?? null,
      record_id:   opts.recordId  ?? null,
      after_value: {
        description: opts.description ?? null,
        ...opts.metadata,
      },
      user_agent: typeof window !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
    })
  } catch {
    // Audit failures are silent — never block the user action
  }
}

/**
 * Convenience wrappers for common audit events
 */
export const audit = {
  formSubmit: (tableName: string, recordId: string, label: string) =>
    logAction({ action: 'create', tableName, recordId, description: `Form submitted: ${label}` }),

  alertAcknowledged: (alertId: string, alertTitle: string) =>
    logAction({ action: 'update', tableName: 'alerts', recordId: alertId, description: `Alert acknowledged: ${alertTitle}` }),

  alertResolved: (alertId: string, alertTitle: string) =>
    logAction({ action: 'update', tableName: 'alerts', recordId: alertId, description: `Alert resolved: ${alertTitle}`, metadata: { status: 'resolved' } }),

  reportDownloaded: (reportType: string, dateRange: { start: string; end: string }) =>
    logAction({ action: 'create', tableName: 'reports', description: `PDF downloaded: ${reportType}`, metadata: { report_type: reportType, period_start: dateRange.start, period_end: dateRange.end } }),

  csValidation: (reportId: string, decision: 'approved' | 'rejected', notes?: string) =>
    logAction({ action: 'validation_decision', tableName: 'citizen_science_reports', recordId: reportId, description: `CS report ${decision}`, metadata: { decision, notes } }),

  login: (method?: string) =>
    logAction({ action: 'login', tableName: 'profiles', description: `User logged in${method ? ` via ${method}` : ''}` }),

  logout: () =>
    logAction({ action: 'logout', tableName: 'profiles', description: 'User logged out' }),

  roleChange: (targetUserId: string, oldRole: string, newRole: string) =>
    logAction({ action: 'permission_change', tableName: 'profiles', recordId: targetUserId, description: `Role changed: ${oldRole} → ${newRole}`, metadata: { old_role: oldRole, new_role: newRole } }),
}

