# Fireberry CRM — API Reference Guide

> Full technical reference for integrating with Fireberry's REST API.
> Source: developers.fireberry.com (researched May 2026)

---

## Background

Fireberry is a rebranded Powerlink CRM (Israeli SMB CRM).
- **API base URL:** `https://api.fireberry.com/api`
- **Legacy URL (still works):** `https://api.powerlink.co.il/api`
- **Developer portal:** https://developers.fireberry.com
- **GitHub SDK:** https://github.com/fireberry-crm/sdk

---

## 1. Authentication

**Single header only — no orgID needed:**
```
tokenid: XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
```

**Where to find the token in Fireberry UI:**
- Profile (top-right avatar) → Profile → Account Security → API Access Token
- OR: Settings → Integrations → Web Forms → RestAPI → "My Token"

**Never put the token in the frontend.** Always proxy through server functions (TanStack Start `createServerFn`). Store in `.env` as `FIREBERRY_TOKEN_ID`.

---

## 2. Object Types

Standard objects — use name string OR number in endpoints:

| Object | System Name | Number |
|--------|-------------|--------|
| Accounts / Clients | `account` | 1 |
| Contacts / Leads | `contact` | 2 |
| Tickets / Cases | `cases` | 5 |
| Tasks | `task` | 10 |
| Opportunities / Deals | `opportunity` | — |
| Notes | `note` | — |
| Phone Calls | `calllog` | — |
| Meetings | `meeting` | — |
| Invoices | `81` | 81 |

**Important:** Fireberry has NO separate "lead" object. Leads are Contacts/Accounts with a specific status value. Use `statuscode` field to distinguish lead-stage from converted.

**Custom objects:** Start at number 1000 (e.g., 1001, 1002).

**Discover all objects for your org:**
```
GET /api/metadata/records
```

---

## 3. CRUD Operations

### Create
```
POST https://api.fireberry.com/api/record/{objectType}
Body: JSON with field system-names as keys
```

**Create a contact/lead:**
```json
POST /api/record/contact
{
  "accountname": "ישראל ישראלי",
  "telephone1": "0501234567",
  "emailaddress1": "mail@example.com",
  "originatingleadcode": 3
}
```

**Create a note linked to a record:**
```json
POST /api/record/note
{
  "notetext": "<p>תוכן ההערה</p>",
  "objectid": "PARENT-RECORD-GUID",
  "objecttypecode": 2
}
```

**Create a task linked to a record:**
```json
POST /api/record/task
{
  "subject": "התקשר ללקוח",
  "description": "בדוק אם קיבל את ההצעה",
  "objectid": "PARENT-RECORD-GUID",
  "objecttypecode": 2,
  "scheduledend": "2026-06-01",
  "statuscode": 1
}
```

`objectid` + `objecttypecode` = how you link notes/tasks to a parent (contact, account, etc.)

### Read — single record
```
GET /api/record/{objectType}/{guid}
```

### Read — all records (paginated)
```
GET /api/record/{objectType}?pagesize=50&pagenumber=1
```
Max pagesize: 50. Max pagenumber: 10 (so max 500 via this endpoint).

### Update
```
PUT /api/record/{objectType}/{guid}
Body: JSON with only the fields to change
```

### Delete
```
DELETE /api/record/{objectType}/{guid}
```

---

## 4. Querying — v3 (Recommended)

```
POST https://api.fireberry.com/api/v3/query
```

```json
{
  "objectType": 2,
  "fields": [
    { "name": "accountid" },
    { "name": "accountname" },
    { "name": "telephone1" },
    { "name": "statuscode" },
    { "name": "ownerid_fullname" }
  ],
  "filter": [
    {
      "type": "AND",
      "conditions": [
        { "fieldName": "statuscode", "operator": "eq", "value": 1 },
        { "fieldName": "accountname", "operator": "start-with", "value": "י" }
      ]
    }
  ],
  "orderBy": [
    { "name": "createdon", "order": "desc" }
  ],
  "pageNumber": 1,
  "pageSize": 50
}
```

**v3 Operators:**
| Operator | Use |
|----------|-----|
| `eq`, `ne` | Exact match / not equal |
| `lt`, `gt`, `le`, `ge` | Comparison (numbers/dates) |
| `start-with`, `not-start-with` | Text prefix |
| `is-null`, `is-not-null` | Empty / not empty (no `value` needed) |
| `eq-in`, `not-in` | Value is an array |
| `between` | Value is `[from, to]` array |

**Relative date values:** `today`, `yesterday`, `this-month`, `last-30-days`, `next-90-days`, `last-week`

**Aggregation:**
```json
{ "name": "estimatedvalue", "alias": "total", "aggrFunc": "SUM" }
```
Supported: `SUM`, `COUNT`, `MIN`, `MAX`

**Lookup traversal** (get related field in one query):
```json
{ "name": "ownerid_fullname" }
{ "name": "accountid_telephone1" }
```
Lookup fields return raw ID + display name (with `Name` suffix).

**v3 Response:**
```json
{
  "data": [...],
  "success": true,
  "message": "",
  "pageNumber": 1,
  "pageSize": 50,
  "isLastPage": true
}
```

Max `pageSize`: 500. Check `isLastPage` for pagination.

---

## 5. Pipeline Stages

Stages = picklist values on the `statuscode` field (or custom pipeline fields).

**Get all stage values for an object:**
```
GET /api/metadata/records/{objectType}/fields/{fieldName}/values
```

**Update a record's stage:**
```json
PUT /api/record/opportunity/{guid}
{
  "statuscode": 3
}
```

Stage numeric values are org-specific. Find them via:
- Settings → Object Studio → field editor
- API Explorer (Settings → Integrations → RestAPI)
- Metadata endpoint above

---

## 6. Webhooks

Fireberry webhooks are **outbound only** — Fireberry POSTs to YOUR server when events happen. Configure via Automations UI (not via API).

**Setup:**
1. Automations → New Automation
2. Set trigger: "Record is created" / "Field changes to X"
3. Add Action: Webhook
4. Configure URL, Method (POST), Headers, Body template

**Body template uses curly brackets:**
```json
{
  "recordId": "{accountid}",
  "name": "{accountname}",
  "phone": "{telephone1}",
  "stage": "{statuscode}"
}
```

**Security:** Put a secret token in a custom header (e.g., `X-Webhook-Secret: YOUR-SECRET`) and validate it in your server function.

**No webhook registration via REST API** — UI only.

---

## 7. Custom Fields

- System names must start with `pcf_` (e.g., `pcf_lead_source`, `pcf_score`)
- Find field names: Edit Layout → three-dot menu → "System Name"

**Reading:**
```json
{
  "objectType": 2,
  "fields": [
    { "name": "accountname" },
    { "name": "pcf_lead_source" },
    { "name": "pcf_score" }
  ]
}
```

**Writing:**
```json
PUT /api/record/contact/{guid}
{
  "pcf_lead_source": "אתר אינטרנט",
  "pcf_score": 85
}
```

---

## 8. Related Records

Get all records linked to a parent:
```
GET /api/record/{objectTypeNumber}/{parentGuid}/{relatedObjectTypeNumber}?pagesize=50&pagenumber=1
```

Example — get all notes for a contact (contact = 2):
```
GET /api/record/2/{contact-guid}/note-object-number
```

Find object numbers via: `GET /api/metadata/records`

---

## 9. Key Field Names

**Contact / Account (Lead):**
- `accountid` — GUID (primary key)
- `accountname` — Name
- `telephone1` — Phone
- `emailaddress1` — Email
- `statuscode` — Stage/status (picklist integer)
- `ownerid` — Assigned user GUID
- `createdon` — Created timestamp (UTC)
- `modifiedon` — Last modified (UTC)
- `originatingleadcode` — Lead source (picklist)

**Opportunity:**
- `opportunityid`, `name`, `estimatedvalue`, `statuscode`, `accountid`

**Task:**
- `taskid`, `subject`, `description`, `objectid`, `objecttypecode`
- `ownerid`, `prioritycode`, `scheduledend`, `statuscode`, `reminderdate`

**Note:**
- `noteid`, `notetext` (HTML), `objectid`, `objecttypecode`, `parentnoteid`

---

## 10. Rate Limits

| Type | Limit |
|------|-------|
| GET requests | 100/minute per org |
| POST/PUT/DELETE | 100/minute per org (separate pool) |
| Max body size | 10 MB |
| Concurrent GETs | 100 |
| Concurrent writes | 30 |

Returns HTTP `429` when exceeded.

---

## 11. Integrations — What the API CAN and CANNOT Do

| Integration | Via API? | Notes |
|-------------|----------|-------|
| Contacts / Accounts | ✅ Full CRUD | Core API |
| Tasks / Notes | ✅ Full CRUD | Link via `objectid` |
| Pipeline stages | ✅ Read & update | Via `statuscode` field |
| Custom fields | ✅ Read & write | Must use `pcf_` prefix |
| **WhatsApp messages** | ❌ NOT accessible | UI-only; no REST endpoint |
| **Zoom recordings** | ❌ NOT accessible | UI-level integration only |
| **Email records** | ⚠️ Possibly | Check Object Studio for `email` object type in your org |
| Webhooks | ⚠️ Outbound only | Configure via Automations UI |

---

## 12. Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request (missing/malformed param) |
| 401 | Invalid or missing `tokenid` |
| 402 | Feature not on your plan |
| 403 | No permission for this record |
| 404 | Record not found |
| 408 | Query timeout (simplify filter) |
| 429 | Rate limit exceeded |
| 500 | Fireberry server error |

---

## 13. Our Integration Architecture

```
React UI (browser)
    ↓ (TanStack server function)
Server Function (Node/Cloudflare Worker)
    ↓ adds tokenid header from env var
Fireberry REST API
    ↓ returns JSON
Server Function parses + returns to UI
```

**Env var:** `FIREBERRY_TOKEN_ID=your-token-here` in `.env`

**Supabase stays for:** shoot_days, shoot_videos, content_items, internal_tasks, activities timeline, app_settings

**Fireberry handles:** contacts, leads, opportunities, tasks, notes, WhatsApp (UI-side)

---

## 14. Useful Metadata Endpoints

```
GET /api/metadata/records                                    → all object types
GET /api/metadata/records/{objectType}/fields                → all fields on object
GET /api/metadata/records/{objectType}/fields/{fieldId}      → single field details
GET /api/metadata/records/{objectType}/fields/{fieldId}/values → picklist options
```

---

## 15. Official Documentation Links

- Getting Started: https://developers.fireberry.com/reference/getting-started-with-rest-api
- Authentication: https://developers.fireberry.com/docs/authentication
- Objects: https://developers.fireberry.com/docs/objects
- Queries v3: https://developers.fireberry.com/docs/queries-v3
- Custom Fields: https://developers.fireberry.com/docs/custom-fields-1
- Rate Limits: https://developers.fireberry.com/docs/rate-limit
- Webhooks: https://www.fireberry.com/articles/webhook-automations
- SDK GitHub: https://github.com/fireberry-crm/sdk
- MCP Server: https://developers.fireberry.com/docs/mcp
- API Explorer: Settings → Integrations → RestAPI → API Explorer (in-app)
