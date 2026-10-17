import postgres from "postgres";
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

const sql = postgres(process.env.DATABASE_URL, { ssl: "require" });

async function inspectDb() {
  try {
    const pubTables = await sql`
      select pubname, tablename 
      from pg_publication_tables 
      where pubname = 'supabase_realtime';
    `;
    console.log("Tables in supabase_realtime publication:", pubTables);

    const policies = await sql`
      select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
      from pg_policies 
      where schemaname = 'public';
    `;
    console.log("Current policies in public schema:", policies);

  } catch (err) {
    console.error("Postgres direct query error:", err);
  } finally {
    await sql.end();
  }
}

inspectDb();
