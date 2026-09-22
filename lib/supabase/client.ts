import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export type UserRole =
  | 'system_admin'
  | 'park_manager'
  | 'scientist'
  | 'ranger'
  | 'read_only'
  | 'visitor'
  | 'citizen'

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  email: string | null
  phone: string | null
  nationality: string | null
  is_active: boolean
}

export const ROLE_LABELS: Record<UserRole, string> = {
  system_admin: 'System Admin',
  park_manager: 'Park Manager',
  scientist: 'Scientist / Heritage Officer',
  ranger: 'Ranger',
  read_only: 'Read-Only Stakeholder',
  visitor: 'Visitor',
  citizen: 'Citizen / Resident',
}

export const ROLE_HOME: Record<UserRole, string> = {
  system_admin: '/dashboard/operational',
  park_manager: '/dashboard/operational',
  scientist: '/dashboard/ecological',
  ranger: '/dashboard/patrol',
  read_only: '/dashboard/operational',
  visitor: '/dashboard/operational',
  citizen: '/dashboard/citizen',
}

// Staff roles that access the full dashboard
export const STAFF_ROLES: UserRole[] = [
  'system_admin', 'park_manager', 'scientist', 'ranger', 'read_only', 'visitor'
]

export const MANAGER_ROLES: UserRole[] = ['system_admin', 'park_manager']

