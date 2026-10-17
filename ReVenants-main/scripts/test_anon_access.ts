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

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log("Checking ANON client access...");
const anonClient = createClient(url, anonKey);

async function checkAnon() {
  const tables = ["participants", "tasks", "messages", "status_history"];
  for (const table of tables) {
    const { data, error } = await anonClient.from(table).select("*").limit(2);
    if (error) {
      console.log(`[-] Anon read '${table}': ERROR:`, error.message, error.code);
    } else {
      console.log(`[+] Anon read '${table}': SUCCESS! ${data?.length} rows returned.`);
    }
  }
}

checkAnon().then(() => console.log("Done anon check"));
