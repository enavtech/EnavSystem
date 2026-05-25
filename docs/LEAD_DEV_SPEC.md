# LEAD DEV SPEC - EnavSystem

## 1) Purpose and Scope

This document is the lead developer handover and operating spec for the EnavSystem TanStack Start application.

It is designed to:
- onboard a new lead engineer quickly,
- establish a shared technical baseline,
- define system ownership boundaries,
- and guide engineering planning with security and data integrity first.

This is a living document and should be updated as architectural decisions are made.

---

## 2) Product and Stack Snapshot

### Product intent
EnavSystem is an internal operations platform for business consulting teams:
- CRM lead handling,
- client management,
- plans/tasks execution,
- meetings/content/team/goals operations,
- and client-facing plan sharing.

### Current stack
- **Framework:** TanStack Start + TanStack Router (file-based routes)
- **UI:** React 19 + shadcn/Radix components
- **Backend/Data:** Supabase (Postgres, Auth, Realtime, Edge Functions)
- **External CRM:** Fireberry (server-side API integration)
- **Hosting:** Cloudflare Workers via `@tanstack/react-start` server entry

### Next.js App Router mapping (for onboarding)
- `src/routes` ~= `app/`
- `src/routes/__root.tsx` ~= `app/layout.tsx`
- `src/routes/p.$slug.tsx` ~= `app/p/[slug]/page.tsx`
- `src/routes/p.$slug.dashboard.tsx` ~= `app/p/[slug]/dashboard/page.tsx`
- TanStack `createServerFn` ~= mixed Server Actions + Route Handler pattern

---

## 3) Repository Orientation

### Core directories/files
- `src/routes/` - all route modules and page-level logic
- `src/routeTree.gen.ts` - auto-generated route tree (do not edit)
- `src/lib/fireberry.ts` - Fireberry HTTP client (server-side only)
- `src/lib/fireberry-api.ts` - Fireberry server functions and field mapping
- `src/lib/admin-api.ts` - auth/admin server functions (role/user management)
- `src/integrations/supabase/` - Supabase clients/types/auth middleware
- `supabase/migrations/` - schema + RLS history
- `supabase/functions/send-reminders/` - scheduled reminder function
- `src/hooks/usePlanRealtime.ts` and `src/hooks/usePlanByToken.ts` - realtime data hooks

---

## 4) Architecture and Routing

### Route map (high-level)
- `/` - executive dashboard (KPIs and operational summary)
- `/login` - sign-in flow
- `/crm` - Fireberry-backed lead management
- `/clients` and `/clients/$id` - Supabase-backed client operations
- `/plans` - plan list/create/import/templates
- `/p/$slug` - plan execution page
- `/p/$slug/dashboard` - plan analytics dashboard
- `/c/$token` - public client view by share token
- `/meetings`, `/content`, `/goals`, `/team`, `/settings` - internal operations modules
- `/fireberry` - Fireberry discovery/debug screen

### Route protection model (current)
Protection is mostly client-side redirects with `isAdmin()` in `useEffect`.

Current gap: some sensitive routes are not guarded consistently (`/`, `/clients`, `/clients/$id`, `/fireberry`).

### Route-level data loading model (current)
- Mostly client-side data fetching in components via `useEffect`.
- Minimal usage of route-level guard/loading hooks.
- App has SSR enabled, but most data still hydrates after mount.

---

## 5) Data Architecture and Current State of Connection

## 5.1 Fireberry integration layers

- `src/lib/fireberry.ts`:
  - low-level Fireberry API wrapper (`fbGet`, `fbPost`, `fbPut`, `fbDelete`, `fbQuery`)
  - uses `FIREBERRY_TOKEN_ID` server-side only
- `src/lib/fireberry-api.ts`:
  - server functions exposed to routes (`fbGetContacts`, `fbUpdateContact`, etc.)
  - mapping adapter `fbToContact`
  - reverse patch mapping `contactPatchToFb`

## 5.2 Supabase usage layers

- Browser client (`src/integrations/supabase/client.ts`) used directly in most routes.
- Service-role server client (`src/integrations/supabase/client.server.ts`) used in admin server functions.
- Existing middleware (`requireSupabaseAuth`) exists but is not consistently enforced across server functions.

## 5.3 End-to-end flow today (critical)

The system is in a split-brain state:
- `/crm` writes and reads lead data primarily from Fireberry.
- `/clients` and `/` dashboard read from Supabase `contacts` and related tables.
- `convertToClient` in CRM updates Fireberry stage, but does not reliably materialize/update the Supabase client record.

Result:
- pipeline status and dashboard/client lists can diverge,
- KPI accuracy is not guaranteed,
- activity linkage may break if IDs are not canonicalized.

---

## 6) Authentication and Authorization

### Current auth flow
1. User logs in through Supabase email/password.
2. Server function issues custom HMAC token.
3. Token is stored in local storage and checked via `isAdmin()`.

### Current role model
- Role source: Supabase Auth `user_metadata.role`
- Observed roles: `admin`, `consultant`, `viewer`
- Enforcement is partial:
  - some role checks in settings/plans
  - many actions/routes rely on UI checks only

### Security concerns
- Client-side route guarding can be bypassed.
- Not all privileged server functions enforce server-side auth middleware + role checks.
- Several RLS policies are broad (`USING (true)`), weakening data isolation.

---

## 7) Work in Progress (WIP) Before Handover

### Active migration thread
Fireberry CRM migration is partially complete:
- CRM route is migrated to Fireberry interactions.
- Other business-critical surfaces still depend on Supabase CRM tables.
- Sync/reconciliation layer is missing.

### Known technical debt
- Large route files with mixed concerns (UI + data + business logic).
- Inconsistent auth/role enforcement across routes and server functions.
- Stage taxonomy drift between CRM and dashboard logic.
- Hidden debug route (`/fireberry`) without production-grade access restrictions.

### Operational status summary
- **Feature development velocity:** medium
- **Security posture:** weak-to-medium (needs hardening)
- **Data integrity posture:** weak in CRM/client boundary
- **Primary risk:** inconsistent source of truth during migration

---

## 8) Engineering Principles Going Forward

These become team-level defaults:

1. **Server authority over client trust**
   - Auth and role checks must execute server-side for protected actions.
2. **Single source of truth per domain**
   - If dual-write is unavoidable, define deterministic reconciliation.
3. **Policy-first security**
   - RLS must be explicit and least-privilege by table and operation.
4. **Traceability**
   - Critical data transitions (lead -> client) require audit events and error telemetry.
5. **Safe migration discipline**
   - No hidden state transitions; all migration steps documented and reversible.

---

## 9) Immediate Priority Roadmap (Lead-Developer View)

### Phase A: Security and Data Integrity (Sprint 1)
- Implement reliable Fireberry -> Supabase conversion upsert.
- Move route authorization to server-enforced guards.
- Lock down RLS from broad open policies to role-based least privilege.

### Phase B: Architecture convergence
- Decide source-of-truth strategy for CRM domain:
  - Fireberry-primary + synchronized warehouse in Supabase, or
  - Supabase-primary + Fireberry mirrored integration
- Remove ambiguous ownership by table/flow.

### Phase C: Modularization and maintainability
- Split oversized route modules into domain services + presentational components.
- Introduce stronger route-level loaders/guard patterns.

---

## 10) Operating Checklist for New Lead

### First 48 hours
- Validate production and staging environment variables.
- Confirm route protection matrix and identify exposed sensitive paths.
- Review active RLS policies for all user-facing tables.
- Trace lead conversion codepath with real test data.

### First week
- Publish architecture decision record (ADR) for CRM source-of-truth.
- Implement and release Sprint 1 checklist items (see `docs/SPRINT_1_CHECKLIST.md`).
- Add high-signal monitoring for auth failures and conversion failures.

### First month
- Complete migration hardening and de-risk split-brain behavior.
- Establish automated tests for protected endpoints and critical workflows.
- Create runbook for incident response: auth compromise, data mismatch, sync lag.

---

## 11) Non-Goals (for now)

- New AI features
- UX redesigns not tied to security/data correctness
- Additional integrations before source-of-truth stabilization

---

## 12) Definition of Done for Platform Stability

The platform is considered stable when all conditions are true:
- Lead conversion is idempotent, monitored, and consistent across Fireberry + Supabase.
- Protected routes and admin mutations are server-authorized.
- RLS policies enforce least privilege and pass security tests.
- KPI dashboards reflect canonical data without known drift.
- Operational playbooks exist for auth and data-integrity incidents.
