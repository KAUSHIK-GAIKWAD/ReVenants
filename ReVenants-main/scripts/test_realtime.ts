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

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const anonClient = createClient(url, anonKey);
const adminClient = createClient(url, serviceKey);

async function testRealtime() {
  console.log("Testing Supabase Realtime...");
  let received = false;

  const channel = anonClient
    .channel("test_channel")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "tasks" },
      (payload) => {
        console.log("[+] REALTIME EVENT RECEIVED:", payload.eventType, payload.new?.task_id);
        received = true;
      }
    )
    .subscribe(async (status) => {
      console.log("Subscription status:", status);
      if (status === "SUBSCRIBED") {
        console.log("Triggering test update via service role...");
        const { error } = await adminClient
          .from("tasks")
          .update({ latest_note: `Realtime test at ${new Date().toISOString()}` })
          .eq("task_id", "task-1");

        if (error) {
          console.error("Update error:", error);
        } else {
          console.log("Updated task-1 successfully.");
        }

        setTimeout(() => {
          if (!received) {
            console.log("[-] WARNING: Realtime event was NOT received within 5 seconds.");
            console.log("    This usually means the table is not in publication `supabase_realtime`.");
          } else {
            console.log("[+] SUCCESS: Realtime is working properly!");
          }
          process.exit(0);
        }, 5000);
      }
    });
}

testRealtime();
