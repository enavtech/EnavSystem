# Fireberry Skill

Reference guide for integrating with Fireberry CRM API.

## When to use this skill

Load `FIREBERRY_API.md` whenever:
- Building API calls to Fireberry from the app
- Deciding how to map Fireberry data to UI components
- Writing server functions that proxy Fireberry requests
- Configuring webhooks or automations in Fireberry
- Troubleshooting API errors

## Quick checklist before writing any Fireberry code

1. Token goes in `.env` as `FIREBERRY_TOKEN_ID` — never in the frontend
2. All calls go through TanStack `createServerFn` — never direct from browser
3. Use v3 query endpoint (`/api/v3/query`) for filtering — not the legacy one
4. `pageSize` max is 500 in v3, max 50 in GET endpoints
5. Link notes/tasks to parents via `objectid` + `objecttypecode`
6. Custom fields always start with `pcf_`
7. WhatsApp/Zoom are NOT accessible via API

## Files

- `FIREBERRY_API.md` — Full API reference (auth, CRUD, query, webhooks, field names, limits)
