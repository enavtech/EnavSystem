import { createClient } from '@supabase/supabase-js'

const OLD_URL = 'https://aedrkkbzcvrketwiszxd.supabase.co'
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlZHJra2J6Y3Zya2V0d2lzenhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTUwNTIsImV4cCI6MjA5MjIzMTA1Mn0.pfHLu711JT8rjwstVHugN-ck47287pJdTUyh9SjCMCc'

const NEW_URL = 'https://ebojvvgednisnilbuwrv.supabase.co'
const NEW_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVib2p2dmdlZG5pc25pbGJ1d3J2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzUzOTA2OCwiZXhwIjoyMDkzMTE1MDY4fQ.fyNgQZzzCZbaHsJe54MT5VsjHkKZ5Ru2H6JTfxMOeWc'

const oldDb = createClient(OLD_URL, OLD_KEY)
const newDb = createClient(NEW_URL, NEW_SERVICE_KEY)

async function migrateTable(name, options = {}) {
  console.log(`\n→ מעביר ${name}...`)

  const { data, error } = await oldDb.from(name).select('*')
  if (error) { console.error(`  שגיאה בקריאה: ${error.message}`); return }
  if (!data || data.length === 0) { console.log(`  ריק, מדלג`); return }

  if (options.clearFirst) {
    await newDb.from(name).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }

  const { error: insertError } = await newDb.from(name).upsert(data, { onConflict: 'id' })
  if (insertError) {
    console.error(`  שגיאה בכתיבה: ${insertError.message}`)
  } else {
    console.log(`  ✓ הועברו ${data.length} שורות`)
  }
}

async function main() {
  console.log('=== התחלת הגירה ===')

  // סדר חשוב — לפי foreign keys
  await migrateTable('app_settings')
  await migrateTable('team_members')
  await migrateTable('plans')
  await migrateTable('tasks')
  await migrateTable('task_steps')
  await migrateTable('comments')
  await migrateTable('internal_tasks')
  await migrateTable('activity_log')
  await migrateTable('kanban_statuses', { clearFirst: true })

  console.log('\n=== הגירה הושלמה ===')
}

main().catch(console.error)
