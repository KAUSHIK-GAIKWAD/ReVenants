import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function syncAndFix() {
  // Update participants with appropriate roles & link codes if missing
  const participantUpdates = [
    { id: 'p_kabir', role: 'Backend & API', link_code: 'link_kabir', telegram_username: 'kabir_dev' },
    { id: 'p_ananya', role: 'Frontend & UI/UX', link_code: 'link_ananya', telegram_username: 'ananya_design' },
    { id: 'p_rohan', role: 'Documentation & QA', link_code: 'link_rohan', telegram_username: 'rohan_docs' },
  ];

  for (const u of participantUpdates) {
    const { error } = await supabase.from('participants').update({
      role: u.role,
      link_code: u.link_code,
      telegram_username: u.telegram_username,
    }).eq('id', u.id);
    console.log(`Updated participant ${u.id}:`, error || "SUCCESS");
  }

  // Update tasks owner_name & telegram_handle
  const taskUpdates = [
    { task_id: 'task_api_integration', owner_name: 'Kabir', telegram_handle: '@kabir_dev' },
    { task_id: 'task_checkout_ui', owner_name: 'Ananya', telegram_handle: '@ananya_design' },
    { task_id: 'task_report_draft', owner_name: 'Rohan', telegram_handle: '@rohan_docs' },
  ];

  for (const tu of taskUpdates) {
    const { error } = await supabase.from('tasks').update({
      owner_name: tu.owner_name,
      telegram_handle: tu.telegram_handle,
    }).eq('task_id', tu.task_id);
    console.log(`Updated task ${tu.task_id}:`, error || "SUCCESS");
  }
}

syncAndFix().then(() => console.log("Done syncing participants & tasks"));
