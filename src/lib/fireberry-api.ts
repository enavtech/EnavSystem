// Fireberry server functions — safe to import in routes.
// Each function runs server-side only; the token never reaches the browser.

import { createServerFn } from "@tanstack/react-start";
import {
  fbQuery,
  fbGetRecord,
  fbCreateRecord,
  fbUpdateRecord,
  fbDeleteRecord,
  type FbQueryOptions,
  type FbQueryCondition,
  type FbJson,
} from "@/lib/fireberry";

// ─── Object type codes ───────────────────────────────────────────────────────

export const ACCOUNT_TYPE = 1;  // accounts / leads / clients
export const TASK_TYPE    = 10; // tasks

// ─── Hebrew labels for all known Fireberry fields ────────────────────────────

export const FB_FIELD_LABELS: Record<string, string> = {
  accountname:          "שם חשבון",
  firstname:            "שם פרטי",
  lastname:             "שם משפחה",
  telephone1:           "טלפון",
  telephone2:           "טלפון שני",
  telephone3:           "טלפון שלישי",
  emailaddress1:        "אימייל",
  emailaddress2:        "אימייל שני",
  emailaddress3:        "אימייל שלישי",
  statuscode:           "קוד סטטוס",
  status:               "סטטוס",
  ownerid_fullname:     "אחראי",
  createdon:            "תאריך יצירה",
  modifiedon:           "תאריך עדכון",
  originatingleadcode:  "מקור ליד",
  billingcity:          "עיר",
  billingstreet:        "רחוב",
  billingstate:         "מדינה",
  billingzipcode:       "מיקוד",
  billingcountry:       "ארץ",
  websiteurl:           "אתר אינטרנט",
  numberofemployees:    "מספר עובדים",
  industrycode:         "תחום פעילות",
  businesstypecode:     "סוג עסק",
  revenue:              "הכנסות",
  idnumber:             "ת.ז. / ח.פ.",
  needs:                "צרכים",
  description:          "תיאור",
  lostreason:           "סיבת סגירה",
  fax1:                 "פקס",
  accountdebt:          "חוב חשבון",
  accountageindays:     "גיל חשבון",
  accountnumber:        "מספר חשבון",
  accounttypecode:      "סוג חשבון",
  categorycode:         "קטגוריה",
  secondcategorycode:   "קטגוריה שנייה",
  accountratingcode:    "דירוג",
  paymenttermscode:     "תנאי תשלום",
  actionstatuscode:     "סטטוס פעולה",
  statecode:            "מצב רשומה",
  birthdaydate:         "יום הולדת",
  nextactiondate:       "תאריך פעולה הבאה",
  nextactivitydate:     "תאריך פעילות הבאה",
  lastactiondate:       "תאריך פעולה אחרונה",
  lastconversation:     "שיחה אחרונה",
  pcfsystemfield100:    "מסמכי שותף",
  pcfsystemfield101:    "שותף פנימי",
  pcfsystemfield102:    "שכר חשבון",
  pcfsystemfield103:    "סוג עסקה",
  pcfsystemfield104:    "עמלות חודשיות",
  pcfsystemfield105:    "תאריך סיום עסקה",
  pcfsystemfield106:    "מספר בורסה",
  pcfsystemfield107:    "אופן התאגדות",
  pcfsystemfield108:    "מחזור ראשוני",
  pcfsystemfield109:    "דירוג לקוח 1-10",
  pcfsystemfield110:    "פעילויות לעסק",
  pcfsystemfield111:    "סטטוס כרטיס",
  pcfsystemfield112:    "דמי מחזור",
  pcfsystemfield113:    "מצב סוציו-כלכלי",
  pcfsystemfield114:    "מצב כלכלי",
  pcfsystemfield115:    "נקודות לטיפול",
  pcfsystemfield116:    "הגדלת הכנסה",
  pcfsystemfield117:    "הערות הרחבות",
  pcfsystemfield118:    "אמינות עצמית",
  pcfsystemfield119:    "מין",
  pcfsystemfield120:    "סוגי פעילות",
  pcfsystemfield121:    "קוד ענין קטגוריה",
  pcfsystemfield122:    "קוד ענין",
  pcfsystemfield123:    "קשרי מסחר",
  pcfsystemfield124:    "בעיה לפתור",
  pcfsystemfield125:    "שייך לעסק",
  pcfsystemfield126:    "מקור פנייה",
  pcfsystemfield127:    "פרטי מחזור נוספים",
  pcfsystemfield128:    "דמי ניהול חודשיים",
  pcfsystemfield129:    "אחוז המרה",
  pcfsystemfield130:    "מחזור",
  pcfsystemfield131:    "תזרים",
  pcfsystemfield132:    "רווח תפעולי",
  pcfsystemfield133:    "רמת נקש",
  pcfsystemfield134:    "עסקה ממוצעת",
  pcfsystemfield135:    "קיבולת %",
  pcfsystemfield136:    "יעד מחזור",
  pcfsystemfield137:    "יעד תזרים",
  pcfsystemfield138:    "מרחק מהיעד מחזור",
  pcfsystemfield139:    "מרחק מיעד תזרים",
  pcfsystemfield140:    "אחוז המרה למקור",
  pcfsystemfield141:    "שיחה מספקת",
  pcfsystemfield142:    "פרטים על הלקוח",
  pcfsystemfield143:    "לוגו חנות",
  pcfsystemfield144:    "לוגו חנות 2",
  pcfsystemfield145:    "עמלות מהליד",
  pcfsystemfield146:    "לוגו לקוח",
  pcfsystemfield147:    "היסטוריה בחברות שיווקיות",
  pcfsystemfield148:    "חודשי מחזור",
  pcfsystemfield149:    "תקציב פרסום חודשי",
  pcfsystemfield150:    "מספר תפעולים",
  pcfsystemfield151:    "תקציב",
  pcfsystemfield152:    "תשלומים אחרונים",
  pcfsystemfield153:    "נקודות חשובות",
  pcfsystemfield154:    "הפתרון המוצע",
  pcfsystemfield155:    "סכום עסקה",
  pcfsystemfield156:    "הוצאות תפעול",
  pcfsystemfield157:    "רמת נקש (מחושב)",
  pcfsystemfield158:    "חסם סיבה",
  pcfsystemfield161:    "חדש",
  pcfsystemfield162:    "גודל עסק",
  pcfsystemfield163:    "לידים",
  pcfsystemfield164:    "שיווק דיגיטלי",
  pcfsystemfield165:    "סיכויי סגירה",
  pcfsystemfield166:    "מערכות CRM",
  pcfsystemfield167:    "סוג שירותים",
  systemfield10:        "התכתבויות",
};

// ─── Fireberry account shape (all queried fields) ───────────────────────────

export interface FbContact {
  _id: string;
  accountid: string;
  accountname: string;
  telephone1: string | null;
  emailaddress1: string | null;
  statuscode: number | null;
  status: string | null;           // display name of statuscode, returned automatically
  ownerid: string | null;
  ownerid_fullname: string | null;
  createdon: string | null;
  modifiedon: string | null;
  originatingleadcode: number | null;
  originatinglead: string | null;   // display name of originatingleadcode
  ownername: string | null;         // display name of ownerid
  // Address
  billingcity: string | null;
  // Business
  websiteurl: string | null;
  numberofemployees: number | null;
  industrycode: number | null;
  businesstypecode: number | null;
  revenue: number | null;
  // Legal
  idnumber: string | null;
  // CRM fields
  needs: string | null;              // צרכים → business_goals
  description: string | null;        // תיאור → notes
  lostreason: number | null;         // סיבת סגירה → lost_reason
  // Custom fields (pcf)
  pcfsystemfield108: string | null;  // מחזור ראשוני → initial_revenue (text range like "30k-60k")
  pcfsystemfield117: string | null;  // הערות הרחבות → extended_notes
  pcfsystemfield128: number | null;  // דמי ניהול חודשיים → monthly_fee
  pcfsystemfield149: number | null;  // תקציב פרסום חודשי → monthly_ad_budget
  pcfsystemfield167: number | null;  // סוג שירותים → service_type
  // Business metrics
  pcfsystemfield107: string | null;  // אופן התאגדות
  pcfsystemfield129: number | null;  // אחוז המרה
  pcfsystemfield130: number | null;  // מחזור
  pcfsystemfield131: number | null;  // תזרים
  pcfsystemfield132: number | null;  // רווח תפעולי
  pcfsystemfield134: number | null;  // עסקה ממוצעת
  pcfsystemfield135: number | null;  // קיבולת %
  pcfsystemfield136: number | null;  // יעד מחזור
  pcfsystemfield137: number | null;  // יעד תזרים
  pcfsystemfield138: number | null;  // מרחק מהיעד מחזור (COMPUTED)
  pcfsystemfield139: number | null;  // מרחק מיעד תזרים (COMPUTED)
  pcfsystemfield140: number | null;  // אחוז המרה למקור
  pcfsystemfield156: number | null;  // הוצאות תפעול
  pcfsystemfield163: number | null;  // לידים
}

// ─── All fields to request in v3 queries ────────────────────────────────────

const ACCOUNT_FIELDS: FbQueryOptions["fields"] = [
  { name: "accountid" },
  { name: "accountname" },
  { name: "telephone1" },
  { name: "emailaddress1" },
  { name: "statuscode" },
  { name: "status" },
  { name: "ownerid_fullname" },
  { name: "ownername" },
  { name: "createdon" },
  { name: "modifiedon" },
  { name: "originatingleadcode" },
  { name: "originatinglead" },
  { name: "billingcity" },
  { name: "websiteurl" },
  { name: "numberofemployees" },
  { name: "industrycode" },
  { name: "businesstypecode" },
  { name: "revenue" },
  { name: "idnumber" },
  { name: "needs" },
  { name: "description" },
  { name: "lostreason" },
  { name: "pcfsystemfield108" },
  { name: "pcfsystemfield117" },
  { name: "pcfsystemfield128" },
  { name: "pcfsystemfield149" },
  { name: "pcfsystemfield167" },
  // Business metrics
  { name: "pcfsystemfield107" },
  { name: "pcfsystemfield129" },
  { name: "pcfsystemfield130" },
  { name: "pcfsystemfield131" },
  { name: "pcfsystemfield132" },
  { name: "pcfsystemfield134" },
  { name: "pcfsystemfield135" },
  { name: "pcfsystemfield136" },
  { name: "pcfsystemfield137" },
  { name: "pcfsystemfield138" },
  { name: "pcfsystemfield139" },
  { name: "pcfsystemfield140" },
  { name: "pcfsystemfield156" },
  { name: "pcfsystemfield163" },
];

// ─── Adapter: FbContact → app Contact shape ──────────────────────────────────

export function fbToContact(fb: FbContact) {
  return {
    id: fb.accountid,
    name: fb.accountname,
    phone: fb.telephone1,
    email: fb.emailaddress1,
    business_name: null as string | null,
    source: fb.originatinglead ?? String(fb.originatingleadcode ?? ""),
    stage: fb.status ?? "",
    assigned_to: fb.ownerid_fullname ?? fb.ownername,
    plan_id: null as string | null,
    notes: fb.description,
    created_at: fb.createdon ?? new Date().toISOString(),
    updated_at: fb.modifiedon ?? new Date().toISOString(),
    // Business details
    industry: fb.industrycode ? String(fb.industrycode) : null,
    business_type: fb.businesstypecode ? String(fb.businesstypecode) : null,
    service_type: fb.pcfsystemfield167 ? String(fb.pcfsystemfield167) : null,
    city: fb.billingcity,
    website: fb.websiteurl,
    employees_count: fb.numberofemployees,
    initial_revenue: fb.pcfsystemfield108,
    monthly_fee: fb.pcfsystemfield128 ? String(fb.pcfsystemfield128) : null,
    monthly_ad_budget: fb.pcfsystemfield149 ? String(fb.pcfsystemfield149) : null,
    business_goals: fb.needs,
    // Legal
    id_number: fb.idnumber,
    tax_id: null as string | null,
    // Social (not in Fireberry — keep null)
    instagram_handle: null as string | null,
    facebook_url: null as string | null,
    tiktok_handle: null as string | null,
    // Client
    client_status: null as string | null,
    client_since: null as string | null,
    // Meta Lead Ads (not in Fireberry — keep null)
    meta_lead_id: null as string | null,
    form_name: null as string | null,
    ad_name: null as string | null,
    campaign_name: null as string | null,
    // Lead date
    lead_date: fb.createdon,
    // New fields from Fireberry
    lost_reason: fb.lostreason ? String(fb.lostreason) : null,
    extended_notes: fb.pcfsystemfield117,
    // Business metrics
    incorporation_type: fb.pcfsystemfield107,
    conversion_rate: fb.pcfsystemfield129,
    turnover: fb.pcfsystemfield130,
    cashflow: fb.pcfsystemfield131,
    operating_profit: fb.pcfsystemfield132,
    avg_deal: fb.pcfsystemfield134,
    capacity_pct: fb.pcfsystemfield135,
    turnover_target: fb.pcfsystemfield136,
    cashflow_target: fb.pcfsystemfield137,
    turnover_gap: fb.pcfsystemfield138,
    cashflow_gap: fb.pcfsystemfield139,
    source_conversion_rate: fb.pcfsystemfield140,
    operating_expenses: fb.pcfsystemfield156,
    leads_fb: fb.pcfsystemfield163,
  };
}

export type FbMappedContact = ReturnType<typeof fbToContact>;

// ─── Reverse map: Contact patch → Fireberry field names ──────────────────────

const NUMERIC_FB_FIELDS = new Set([
  "numberofemployees",
  "pcfsystemfield128", "pcfsystemfield129", "pcfsystemfield130", "pcfsystemfield131",
  "pcfsystemfield132", "pcfsystemfield134", "pcfsystemfield135", "pcfsystemfield136",
  "pcfsystemfield137", "pcfsystemfield140", "pcfsystemfield149", "pcfsystemfield156",
  "pcfsystemfield163",
]);

export function contactPatchToFb(patch: Record<string, unknown>): Record<string, unknown> {
  const fieldMap: Record<string, string> = {
    name:                  "accountname",
    phone:                 "telephone1",
    email:                 "emailaddress1",
    city:                  "billingcity",
    website:               "websiteurl",
    employees_count:       "numberofemployees",
    id_number:             "idnumber",
    business_goals:        "needs",
    notes:                 "description",
    initial_revenue:       "pcfsystemfield108",
    extended_notes:        "pcfsystemfield117",
    monthly_fee:           "pcfsystemfield128",
    monthly_ad_budget:     "pcfsystemfield149",
    service_type:          "pcfsystemfield167",
    // Metrics (turnover_gap / cashflow_gap are computed — not editable)
    incorporation_type:    "pcfsystemfield107",
    conversion_rate:       "pcfsystemfield129",
    turnover:              "pcfsystemfield130",
    cashflow:              "pcfsystemfield131",
    operating_profit:      "pcfsystemfield132",
    avg_deal:              "pcfsystemfield134",
    capacity_pct:          "pcfsystemfield135",
    turnover_target:       "pcfsystemfield136",
    cashflow_target:       "pcfsystemfield137",
    source_conversion_rate:"pcfsystemfield140",
    operating_expenses:    "pcfsystemfield156",
    leads_fb:              "pcfsystemfield163",
  };
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const fbKey = fieldMap[key];
    if (!fbKey) continue;
    if (NUMERIC_FB_FIELDS.has(fbKey) && value !== null && value !== "" && value !== undefined) {
      const n = Number(value);
      result[fbKey] = isNaN(n) ? value : n;
    } else {
      result[fbKey] = value;
    }
  }
  return result;
}

// ─── Get stage codes (all unique statuscode values from Fireberry) ────────────

export const fbGetStageCodes = createServerFn({ method: "GET" }).handler(async (): Promise<{
  stages: { code: number; name: string }[];
}> => {
  const res = await fbQuery<FbContact>({
    objectType: ACCOUNT_TYPE,
    fields: [{ name: "statuscode" }, { name: "status" }],
    pageNumber: 1,
    pageSize: 500,
  });
  const map = new Map<number, string>();
  for (const r of res.data) {
    if (r.statuscode !== null && r.status) map.set(r.statuscode, r.status);
  }
  return {
    stages: [...map.entries()].sort((a, b) => a[0] - b[0]).map(([code, name]) => ({ code, name })),
  };
});

// ─── Discovery ───────────────────────────────────────────────────────────────

export const fbDiscover = createServerFn({ method: "GET" }).handler(async (): Promise<{
  stages: { code: number; name: string; count: number }[];
  fullRecord: FbJson | null;
  error: string | null;
}> => {
  try {
    const res = await fbQuery<FbContact>({
      objectType: ACCOUNT_TYPE,
      fields: [{ name: "accountid" }, { name: "statuscode" }, { name: "status" }],
      pageNumber: 1,
      pageSize: 500,
    });
    const stageMap = new Map<number, { name: string; count: number }>();
    for (const r of res.data) {
      const code = r.statuscode ?? -1;
      const name = r.status ?? String(code);
      const prev = stageMap.get(code) ?? { name, count: 0 };
      stageMap.set(code, { name, count: prev.count + 1 });
    }
    const stages = [...stageMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([code, { name, count }]) => ({ code, name, count }));
    const firstId = res.data[0]?.accountid;
    const fullRecord = firstId
      ? await fbGetRecord<Record<string, unknown>>(ACCOUNT_TYPE, firstId).then(r => r as FbJson).catch(() => null)
      : null;
    return { stages, fullRecord, error: null };
  } catch (e) {
    return { stages: [], fullRecord: null, error: e instanceof Error ? e.message : String(e) };
  }
});

// ─── Query leads (excludes "לקוח" stages) ────────────────────────────────────

export const fbGetContacts = createServerFn({ method: "POST" })
  .inputValidator((d: {
    pageNumber?: number;
    pageSize?: number;
    search?: string;
    statusCodes?: number[];
    excludeClients?: boolean;
  }) => d)
  .handler(async ({ data }) => {
    const opts: FbQueryOptions = {
      objectType: ACCOUNT_TYPE,
      fields: ACCOUNT_FIELDS,
      orderBy: [{ name: "createdon", order: "desc" }],
      pageNumber: data.pageNumber ?? 1,
      pageSize: data.pageSize ?? 100,
    };

    const conditions: FbQueryCondition[] = [];
    if (data.search) {
      conditions.push({ fieldName: "accountname", operator: "start-with", value: data.search });
    }
    if (data.statusCodes?.length) {
      conditions.push({ fieldName: "statuscode", operator: "eq-in", value: data.statusCodes });
    }
    if (data.excludeClients) {
      conditions.push({ fieldName: "status", operator: "not-start-with", value: "לקוח" });
    }
    if (conditions.length) {
      opts.filter = [{ type: "AND", conditions }];
    }

    return fbQuery<FbContact>(opts);
  });

// ─── Get single account ───────────────────────────────────────────────────────

export const fbGetContact = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    return fbGetRecord<FbContact>(ACCOUNT_TYPE, data.id);
  });

// ─── Create account ───────────────────────────────────────────────────────────

export const fbCreateContact = createServerFn({ method: "POST" })
  .inputValidator((d: {
    name: string;
    phone?: string | null;
    email?: string | null;
    statuscode?: number;
  }) => d)
  .handler(async ({ data }) => {
    return fbCreateRecord<FbContact>(ACCOUNT_TYPE, {
      accountname: data.name,
      telephone1: data.phone ?? null,
      emailaddress1: data.email ?? null,
      ...(data.statuscode !== undefined ? { statuscode: data.statuscode } : {}),
    });
  });

// ─── Update account ───────────────────────────────────────────────────────────

export const fbUpdateContact = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; patch: Record<string, unknown> }) => d)
  .handler(async ({ data }) => {
    await fbUpdateRecord(ACCOUNT_TYPE, data.id, data.patch);
    return { success: true };
  });

// ─── Delete account ───────────────────────────────────────────────────────────

export const fbDeleteContact = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    await fbDeleteRecord(ACCOUNT_TYPE, data.id);
    return { success: true };
  });

// ─── Notes ────────────────────────────────────────────────────────────────────

export const fbGetNotes = createServerFn({ method: "POST" })
  .inputValidator((d: { contactId: string }) => d)
  .handler(async ({ data }) => {
    return fbQuery<{
      _id: string;
      noteid: string;
      notetext: string;
      createdon: string;
      ownerid_fullname: string | null;
    }>({
      objectType: "note",
      fields: [
        { name: "noteid" }, { name: "notetext" },
        { name: "createdon" }, { name: "ownerid_fullname" },
      ],
      filter: [{
        type: "AND",
        conditions: [
          { fieldName: "objectid", operator: "eq", value: data.contactId },
          { fieldName: "objecttypecode", operator: "eq", value: ACCOUNT_TYPE },
        ],
      }],
      orderBy: [{ name: "createdon", order: "desc" }],
      pageSize: 100,
    });
  });

export const fbAddNote = createServerFn({ method: "POST" })
  .inputValidator((d: { contactId: string; text: string }) => d)
  .handler(async ({ data }) => {
    await fbCreateRecord<{ _id: string }>("note", {
      notetext: `<p>${data.text}</p>`,
      objectid: data.contactId,
      objecttypecode: ACCOUNT_TYPE,
    });
    return { success: true };
  });

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const fbGetTasks = createServerFn({ method: "POST" })
  .inputValidator((d: { contactId: string }) => d)
  .handler(async ({ data }) => {
    return fbQuery<{
      _id: string;
      taskid: string;
      subject: string;
      description: string | null;
      scheduledend: string | null;
      statuscode: number | null;
      status: string | null;
      ownerid_fullname: string | null;
    }>({
      objectType: TASK_TYPE,
      fields: [
        { name: "taskid" }, { name: "subject" }, { name: "description" },
        { name: "scheduledend" }, { name: "statuscode" }, { name: "status" },
        { name: "ownerid_fullname" },
      ],
      filter: [{
        type: "AND",
        conditions: [
          { fieldName: "objectid", operator: "eq", value: data.contactId },
          { fieldName: "objecttypecode", operator: "eq", value: ACCOUNT_TYPE },
        ],
      }],
      orderBy: [{ name: "scheduledend", order: "asc" }],
      pageSize: 100,
    });
  });

// ─── Fetch full record (all fields) for detail panel ─────────────────────────

export const fbGetContactFull = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    return fbGetRecord<Record<string, FbJson>>(ACCOUNT_TYPE, data.id);
  });

// ─── Raw API response — for discovery/debugging only ─────────────────────────

export const fbGetRecordRaw = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { fbGet } = await import("./fireberry");
    return fbGet<FbJson>(`/record/${ACCOUNT_TYPE}/${data.id}`);
  });
