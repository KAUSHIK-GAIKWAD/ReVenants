-- ============================================================
-- ReVenants Migration v3: Enterprise Auth, Multi-Tenant Workspaces,
-- Role-Based Access Control (RBAC), and Feature Engine
-- Strictly Non-Destructive and Idempotent.
-- Backward-compatible with existing rows (p_kabir, p_ananya, p_rohan, task_01, etc.)
-- ============================================================

-- 1. Create Workspaces Table (Multi-Tenant Isolation)
create table if not exists workspaces (
  id text primary key,
  name text not null,
  slug text unique not null,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

-- Backfill default workspace for existing demo & production projects
insert into workspaces (id, name, slug, description)
values ('ws_default', 'ReVenants Alpha Project', 'revenants-alpha', 'Primary engineering workspace for AI group coordination')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description;

-- 2. Enhance Participants Table with Auth & RBAC
alter table participants add column if not exists workspace_id text references workspaces(id) on delete cascade default 'ws_default';
alter table participants add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table participants add column if not exists rbac_role text not null default 'Contributor';

-- Ensure backward compatibility constraint for RBAC roles
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'check_participant_rbac_role'
  ) then
    alter table participants add constraint check_participant_rbac_role 
      check (rbac_role in ('Lead', 'Contributor', 'Observer', 'AI Coordinator'));
  end if;
end $$;

-- Backfill existing participants to ws_default and set baseline roles
update participants set workspace_id = 'ws_default' where workspace_id is null;
update participants set rbac_role = 'Lead' 
  where (id in ('p_kabir', 'kabir_p') or name ilike '%Kabir%') and (rbac_role is null or rbac_role = 'Contributor');

-- 3. Enhance Tasks Table with Cross-Dependency Nudges & Workspace Isolation
alter table tasks add column if not exists workspace_id text references workspaces(id) on delete cascade default 'ws_default';
alter table tasks add column if not exists unblock_nudge_sent_at timestamptz;
alter table tasks add column if not exists unblock_target_participant_id text references participants(id) on delete set null;

update tasks set workspace_id = 'ws_default' where workspace_id is null;

-- 4. Enhance Messages Table for Voice Notes and Media Transcription
alter table messages add column if not exists workspace_id text references workspaces(id) on delete cascade default 'ws_default';
alter table messages add column if not exists media_type text not null default 'text';
alter table messages add column if not exists voice_transcription text;
alter table messages add column if not exists audio_duration_seconds integer;

update messages set workspace_id = 'ws_default' where workspace_id is null;

-- 5. Create Standup Digests Table (Executive Daily Summaries)
create table if not exists standup_digests (
  id text primary key default ('digest_' || substr(md5(random()::text), 1, 8)),
  workspace_id text not null references workspaces(id) on delete cascade default 'ws_default',
  summary_markdown text not null,
  blocker_count integer not null default 0,
  completed_count integer not null default 0,
  in_progress_count integer not null default 0,
  broadcast_telegram boolean not null default false,
  created_at timestamptz not null default now(),
  created_by_user_id uuid references auth.users(id) on delete set null
);

-- 6. Clean Up Any Overly Permissive Legacy Policies from v2
drop policy if exists "anon_read_participants" on participants;
drop policy if exists "anon_read_tasks" on tasks;
drop policy if exists "anon_read_messages" on messages;
drop policy if exists "anon_read_status_history" on status_history;

-- 7. Security Definer Helper Functions (PREVENTS 42P17 INFINITE RECURSION)
create or replace function public.is_workspace_member(ws_id text, uid uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.participants
    where workspace_id = ws_id
      and user_id = uid
  );
$$;

create or replace function public.current_user_workspace_role(ws_id text, uid uuid default auth.uid())
returns text
language sql
security definer
set search_path = public
stable
as $$
  select rbac_role from public.participants
  where workspace_id = ws_id
    and user_id = uid
  limit 1;
$$;

-- 8. Row-Level Security (RLS) Configuration
-- Note: Service-role key automatically bypasses RLS for Coordinator daemons & Telegram webhook.
alter table workspaces enable row level security;
alter table participants enable row level security;
alter table tasks enable row level security;
alter table messages enable row level security;
alter table status_history enable row level security;
alter table standup_digests enable row level security;

-- Workspace RLS
drop policy if exists "workspaces_read_policy" on workspaces;
create policy "workspaces_read_policy" on workspaces for select
  using (
    id = 'ws_default' or 
    (auth.uid() is not null and (
      created_by = auth.uid() or 
      public.is_workspace_member(id)
    ))
  );

drop policy if exists "workspaces_modify_policy" on workspaces;
create policy "workspaces_modify_policy" on workspaces for all
  using (auth.uid() is not null and created_by = auth.uid());

-- Participants RLS
drop policy if exists "participants_read_policy" on participants;
create policy "participants_read_policy" on participants for select
  using (
    workspace_id = 'ws_default' or
    (auth.uid() is not null and (
      user_id = auth.uid() or
      public.is_workspace_member(workspace_id)
    ))
  );

drop policy if exists "participants_claim_policy" on participants;
create policy "participants_claim_policy" on participants for update
  using (
    auth.uid() is not null and (
      user_id is null or user_id = auth.uid() or
      public.current_user_workspace_role(workspace_id) = 'Lead'
    )
  );

-- Tasks RLS
drop policy if exists "tasks_read_policy" on tasks;
create policy "tasks_read_policy" on tasks for select
  using (
    workspace_id = 'ws_default' or
    (auth.uid() is not null and public.is_workspace_member(workspace_id))
  );

drop policy if exists "tasks_insert_policy" on tasks;
create policy "tasks_insert_policy" on tasks for insert
  with check (
    workspace_id = 'ws_default' or
    (auth.uid() is not null and public.is_workspace_member(workspace_id))
  );

drop policy if exists "tasks_update_policy" on tasks;
create policy "tasks_update_policy" on tasks for update
  using (
    workspace_id = 'ws_default' or
    (auth.uid() is not null and (
      public.is_workspace_member(workspace_id) and (
        owner_id = (select p.id from participants p where p.user_id = auth.uid() and p.workspace_id = tasks.workspace_id limit 1)
        or public.current_user_workspace_role(workspace_id) = 'Lead'
      )
    ))
  );

-- Messages RLS
drop policy if exists "messages_read_policy" on messages;
create policy "messages_read_policy" on messages for select
  using (
    workspace_id = 'ws_default' or
    (auth.uid() is not null and public.is_workspace_member(workspace_id))
  );

-- Status History RLS
drop policy if exists "status_history_read_policy" on status_history;
create policy "status_history_read_policy" on status_history for select
  using (
    exists (
      select 1 from tasks t
      where t.task_id = status_history.task_id
        and (t.workspace_id = 'ws_default' or (
          auth.uid() is not null and public.is_workspace_member(t.workspace_id)
        ))
    )
  );

-- Standup Digests RLS
drop policy if exists "digests_read_policy" on standup_digests;
create policy "digests_read_policy" on standup_digests for select
  using (
    workspace_id = 'ws_default' or
    (auth.uid() is not null and public.is_workspace_member(workspace_id))
  );

drop policy if exists "digests_insert_policy" on standup_digests;
create policy "digests_insert_policy" on standup_digests for insert
  with check (
    workspace_id = 'ws_default' or
    (auth.uid() is not null and public.is_workspace_member(workspace_id))
  );

-- 9. Add New Tables to Supabase Realtime Publication
alter table workspaces replica identity full;
alter table standup_digests replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'workspaces') then
    alter publication supabase_realtime add table workspaces;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'standup_digests') then
    alter publication supabase_realtime add table standup_digests;
  end if;
end $$;
