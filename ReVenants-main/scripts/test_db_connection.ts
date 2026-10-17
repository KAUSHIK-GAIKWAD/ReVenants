import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Simple env loader
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

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

console.log("Checking Supabase connection to:", url);

const supabase = createClient(url, key);

async function check() {
  const tables = ["participants", "tasks", "messages", "status_history"];
  for (const table of tables) {
    try {
      const { data, error, count } = await supabase.from(table).select("*", { count: "exact" }).limit(5);
      if (error) {
        console.error(`[-] Table '${table}' ERROR:`, error.message, error.code, error.details);
      } else {
        console.log(`[+] Table '${table}' OK! Rows fetched: ${data?.length}, Total count: ${count}`);
        if (data && data.length > 0) {
          console.log(`    Columns available in '${table}':`, Object.keys(data[0]));
        }
      }
    } catch (e) {
      console.error(`[-] Table '${table}' EXCEPTION:`, e);
    }
  }
}

check().then(() => console.log("Done checking"));
