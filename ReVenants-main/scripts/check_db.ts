import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://jryhkraavtorrfjvdunv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyeWhrcmFhdnRvcnJmanZkdW52Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjE2MTA0MywiZXhwIjoyMTA3NzM3MDQzfQ.7EghF_0Yxx7polf8WFQrSYImr-mEHHKplF-4dQq7gQs'
);

async function run() {
  const tables = ['participants', 'tasks', 'messages', 'status_history'];
  for (const t of tables) {
    const { data, count, error } = await sb.from(t).select('*', { count: 'exact' }).limit(3);
    console.log('-------------------------------------------');
    console.log('TABLE:', t);
    if (error) {
      console.log('ERROR:', error.message);
    } else {
      console.log('ROW COUNT:', count);
      if (data && data.length > 0) {
        console.log('COLUMNS:', Object.keys(data[0]).join(', '));
        console.log('LATEST RECORD:', JSON.stringify(data[0], null, 2));
      } else {
        console.log('TABLE IS CURRENTLY EMPTY');
      }
    }
  }
}

run();
