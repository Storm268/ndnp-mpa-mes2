# Implementation Plan: Remove Visitor Pages & Set Default Citizen Dashboard Route

This plan outlines the steps to remove all visitor-related pages and components, preserve the interactive trail and marine map for the Citizen Portal, update all routes and navigation links, and establish `/dashboard/citizen` as the default landing route.

## User Requirements
1. **Delete Visitor Page Files & Components:** Remove the `/visitor` pages (`/visitor`, `/visitor/map`, `/visitor/report`, `/visitor/profile`) and `components/visitor`.
2. **Preserve Interactive Marine Map:** Keep the interactive trail and marine map functional within the Citizen Portal by relocating necessary components to `components/citizen/`.
3. **Update Router & Middleware:** Remove routes pointing to `/visitor` and add middleware/redirects mapping `/visitor` and all sub-routes to `/dashboard/citizen`.
4. **Set Default Landing Route:** Set `/dashboard/citizen` as the default landing page so users land directly on `/dashboard/citizen`.

---

## Proposed Changes

### 1. Preserve Interactive Map & Guides for Citizen Portal
- Relocate and adapt the following components into `components/citizen/`:
  - `InteractiveMapLoader.tsx`
  - `InteractiveMarineTrailMap.tsx`
  - `GeofenceAlertBanner.tsx`
  - `HeritageMarineGuidesDrawer.tsx`
  - `ExitSurveyModal.tsx`
- Update internal links inside `InteractiveMarineTrailMap.tsx` and `CitizenPortalView.tsx` from `/visitor/report` to `/report` (or the citizen sighting reporting tab).
- Update imports in `components/citizen/CitizenPortalView.tsx` to reference the citizen components.

### 2. Delete Visitor Pages & Visitor-Specific Components
- Remove `app/visitor/` (including `page.tsx`, `map/page.tsx`, `report/page.tsx`, and `profile/page.tsx`).
- Remove `components/visitor/` (including `VisitorNav.tsx`).

### 3. Configure Default Landing Route & Redirects
- Update `app/page.tsx`:
  - Directly redirect incoming traffic from `/` to `/dashboard/citizen` (or maintain staff session routing if logged in as staff).
- Add Next.js redirect configuration in `next.config.ts` or `middleware.ts`:
  - Map `/visitor` and `/visitor/:path*` directly to `/dashboard/citizen`.
- Update `components/nav/sidebar.tsx`:
  - Replace any `/visitor/map` and `/visitor/report` links with `/dashboard/citizen` and `/report`.
- Update Service Worker (`public/sw.js`) and offline cache list (`lib/map/offline-tiles.ts`):
  - Evict `/visitor/*` URLs from pre-cache shell lists and ensure `/dashboard/citizen` is cached.

### 4. Verification & Testing
- Run `lint_applet` to ensure zero broken imports or references.
- Run `compile_applet` to confirm a successful build.
- Test HTTP route responses using `curl`:
  - `curl -I http://localhost:3000/` (verify redirect to `/dashboard/citizen`)
  - `curl -I http://localhost:3000/visitor` (verify redirect to `/dashboard/citizen`)
  - `curl -I http://localhost:3000/visitor/map` (verify redirect to `/dashboard/citizen`)
  - `curl -I http://localhost:3000/dashboard/citizen` (verify HTTP 200)
