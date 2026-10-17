-- ============================================================
-- ReVenants migration v2
-- Adds columns required by the application type system that are
-- missing from the original supabase_schema.sql, plus RLS
-- policies for the service role.
-- Run this in the Supabase SQL Editor AFTER the base schema.
-- ============================================================

-- -------- participants --------
alter table participants add column if not exists role text;
alter table participants add column if not exists link_code text;
alter table participants add column if not exists telegram_username text;

-- -------- tasks --------
alter table tasks add column if not exists owner_name text;
alter table tasks add column if not exists telegram_handle text;
alter table tasks add column if not exists latest_note text;
alter table tasks add column if not exists last_followup_at timestamptz;

-- -------- messages --------
alter table messages add column if not exists participant_id text;
alter table messages add column if not exists text text;           -- app uses "text", schema uses "content"
alter table messages add column if not exists classification text;
alter table messages add column if not exists ai_summary text;
alter table messages add column if not exists created_at timestamptz not null default now();

-- -------- status_history --------
alter table status_history add column if not exists blocker text;
alter table status_history add column if not exists reason text;
alter table status_history add column if not exists created_at timestamptz not null default now();

-- ============================================================
-- RLS policies:
-- Server operations use the service_role key (which bypasses RLS).
-- Browser client uses anon key — grant SELECT only so realtime works
-- while preventing arbitrary client-side writes or table wipes.
-- ============================================================

-- Clean up older unrestricted policies
drop policy if exists "service_role_all_participants" on participants;
drop policy if exists "service_role_all_tasks" on tasks;
drop policy if exists "service_role_all_messages" on messages;
drop policy if exists "service_role_select_status_history" on status_history;
drop policy if exists "service_role_insert_status_history" on status_history;

-- Read policies for clients / subscribers
drop policy if exists "anon_read_participants" on participants;
create policy "anon_read_participants" on participants for select using (true);

drop policy if exists "anon_read_tasks" on tasks;
create policy "anon_read_tasks" on tasks for select using (true);

drop policy if exists "anon_read_messages" on messages;
create policy "anon_read_messages" on messages for select using (true);

drop policy if exists "anon_read_status_history" on status_history;
create policy "anon_read_status_history" on status_history for select using (true);

-- ============================================================
-- Supabase Realtime Publication Setup
-- Enables live websocket postgres_changes for dashboard listeners.
-- ============================================================

alter table tasks replica identity full;
alter table messages replica identity full;
alter table participants replica identity full;
alter table status_history replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tasks') then
    alter publication supabase_realtime add table tasks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table messages;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'participants') then
    alter publication supabase_realtime add table participants;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'status_history') then
    alter publication supabase_realtime add table status_history;
  end if;
end $$;
