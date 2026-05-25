# SPRINT 1 CHECKLIST - Security and Data Integrity

## Sprint Goal

Complete security and data-integrity hardening for the CRM/client boundary.

Sprint 1 includes only:
1. Fireberry -> Supabase split-brain conversion upsert fix,
2. replacing client-side-only auth gating with proper server-side route guards,
3. locking down RLS policies to least privilege.

---

## Exit Criteria (must all be true)

- [ ] Lead conversion writes consistent client state to Supabase every time.
- [ ] Conversion flow is idempotent and safe on retries.
- [ ] Protected routes and privileged server actions enforce server-side authorization.
- [ ] Broad `USING (true)` RLS policies are removed/replaced on sensitive tables.
- [ ] Automated verification scripts/tests pass for auth and RLS paths.
- [ ] Production rollout includes rollback plan and post-deploy validation checklist.

---

## Workstream A - Split-Brain Conversion Upsert (Fireberry -> Supabase)

## A1. Design the canonical conversion contract
- [ ] Define a canonical identifier mapping:
  - Fireberry account ID field in Supabase (`fireberry_account_id`) OR equivalent.
- [ ] Decide canonical ownership for fields during conversion:
  - Fireberry-owned fields,
  - Supabase-owned fields,
  - merged fields with deterministic precedence.
- [ ] Publish a short ADR in PR description: "Lead->Client Conversion Contract".

**Acceptance criteria**
- [ ] Team can state exactly which system is source of truth per converted field.
- [ ] Mapping conflicts are documented.

## A2. Schema prep and constraints
- [ ] Add migration to support canonical linkage (example: unique index on `fireberry_account_id`).
- [ ] Add/update constraints needed for safe upsert.
- [ ] Add optional tracking columns for observability:
  - `converted_from_fireberry_at`,
  - `conversion_source`,
  - `conversion_version`.

**Acceptance criteria**
- [ ] Migration runs cleanly in local/staging.
- [ ] Duplicate conversion attempts do not create duplicate clients.

## A3. Implement conversion upsert in code
- [ ] Update CRM conversion path (`convertToClient`) to:
  1) update Fireberry stage,
  2) upsert Supabase contact atomically by canonical key,
  3) write activity/audit event with correlation ID,
  4) handle failures with explicit user-visible feedback.
- [ ] Ensure idempotency (same input can be retried safely).
- [ ] Ensure status reconciliation if Fireberry succeeded but Supabase failed.

**Acceptance criteria**
- [ ] Manual retry after partial failure converges to correct final state.
- [ ] Converted lead appears in `/clients` and dashboard metrics consistently.

## A4. Conversion test matrix
- [ ] Test successful conversion.
- [ ] Test duplicate conversion click / race condition.
- [ ] Test Fireberry success + Supabase failure.
- [ ] Test Supabase success + Fireberry failure handling path.
- [ ] Test malformed lead data edge cases (missing phone/email/name variants).

**Acceptance criteria**
- [ ] Test evidence attached to PR.
- [ ] No unresolved conversion integrity bugs.

---

## Workstream B - Server-Side Auth Guards (Routes and Server Functions)

## B1. Auth architecture decision
- [ ] Decide server-side auth authority pattern:
  - Supabase session/JWT validation as primary authority.
- [ ] Define route protection policy table:
  - public routes,
  - authenticated routes,
  - admin-only routes.

**Acceptance criteria**
- [ ] Policy table approved and committed in docs or PR description.

## B2. Route guard implementation
- [ ] Add server-enforced guard strategy for protected routes.
- [ ] Ensure sensitive routes cannot render protected data without server auth.
- [ ] Cover currently exposed routes:
  - `/`,
  - `/clients`,
  - `/clients/$id`,
  - `/fireberry`,
  - and all admin operation surfaces.

**Acceptance criteria**
- [ ] Unauthorized direct URL access is denied server-side.
- [ ] No flash of protected content before redirect.

## B3. Server function hardening
- [ ] Apply auth middleware to privileged `createServerFn` handlers.
- [ ] Enforce role checks server-side (`admin`, `consultant`, `viewer` rules).
- [ ] Remove implicit trust in client-originating role assumptions.

**Acceptance criteria**
- [ ] Admin-only functions fail for non-admin sessions.
- [ ] Security tests include positive and negative role cases.

## B4. Session/token cleanup
- [ ] Reconcile custom local-storage admin token usage with server authority.
- [ ] Remove or demote token-presence checks as security controls.
- [ ] Keep client checks only as UX hints, not security boundaries.

**Acceptance criteria**
- [ ] Server authorization is the single security gate for protected resources.

---

## Workstream C - RLS Lockdown (Least Privilege)

## C1. Policy inventory and classification
- [ ] Inventory all tables touched by web clients and server functions.
- [ ] Classify each as:
  - public-read (if truly required),
  - authenticated-read,
  - role-scoped write,
  - service-role only.
- [ ] Flag all `USING (true)` and broad `FOR ALL` policies.

**Acceptance criteria**
- [ ] Inventory doc exists in PR or migration notes.

## C2. Policy rewrite migrations
- [ ] Replace broad open policies on sensitive tables with explicit policies.
- [ ] Separate `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies intentionally.
- [ ] Ensure public share routes only get minimum read access they need.
- [ ] Keep admin write pathways via server role where appropriate.

**Acceptance criteria**
- [ ] Staging verifies app functionality with tightened policies.
- [ ] No sensitive table remains broadly open without written justification.

## C3. RLS validation suite
- [ ] Add SQL verification scripts/tests for:
  - anonymous access,
  - authenticated non-admin access,
  - admin access,
  - service-role access.
- [ ] Validate expected denials are enforced.
- [ ] Validate expected allows still function for legitimate flows.

**Acceptance criteria**
- [ ] RLS test outputs attached to PR.
- [ ] Security reviewer sign-off completed.

---

## Workstream D - Observability, Rollout, and Safety

## D1. Instrumentation
- [ ] Add structured logs for:
  - conversion attempts,
  - conversion failures by step,
  - auth denials,
  - RLS denial-related query failures.
- [ ] Add correlation IDs through conversion flow.

**Acceptance criteria**
- [ ] On-call can trace one conversion from request to final DB state.

## D2. Rollout plan
- [ ] Deploy to staging first with data snapshots.
- [ ] Run full regression for CRM->Clients->Dashboard journey.
- [ ] Prepare production rollout checklist and rollback plan.

**Acceptance criteria**
- [ ] Rollback tested or simulated before production release.

## D3. Post-deploy verification
- [ ] Validate route protection from incognito/unauthorized sessions.
- [ ] Validate conversion consistency with real sample leads.
- [ ] Validate no spike in authorization/data errors for 24h.

**Acceptance criteria**
- [ ] Post-deploy report published in team channel/issues.

---

## Suggested Sprint Breakdown (10 Working Days)

### Days 1-2
- [ ] A1, B1, C1 design/inventory + ADRs

### Days 3-5
- [ ] A2, A3 implementation
- [ ] B2 route guards

### Days 6-7
- [ ] B3, B4 server function/session hardening
- [ ] C2 policy migrations

### Days 8-9
- [ ] A4, C3 test suites and regression
- [ ] D1 instrumentation

### Day 10
- [ ] D2 rollout execution
- [ ] D3 post-deploy verification and closure report

---

## PR Definition of Done for Sprint 1

- [ ] Includes schema migrations (if needed), code changes, and tests.
- [ ] Includes security notes: auth flow changes + RLS policy rationale.
- [ ] Includes data integrity notes: conversion idempotency and reconciliation behavior.
- [ ] Includes operational notes: rollback and post-deploy checks.
- [ ] Reviewed by at least one engineer focused on security/data.
