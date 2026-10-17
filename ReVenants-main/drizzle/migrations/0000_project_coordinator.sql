CREATE TABLE public.participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  link_code text NOT NULL UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  telegram_chat_id bigint,
  telegram_username text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.participants TO service_role;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  owner_id uuid REFERENCES public.participants(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  blocker text,
  latest_note text,
  due_date date,
  last_followup_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid REFERENCES public.participants(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  direction text NOT NULL,
  text text NOT NULL,
  classification text,
  ai_summary text,
  telegram_update_id bigint UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text,
  source text NOT NULL DEFAULT 'agent',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.status_events TO service_role;
ALTER TABLE public.status_events ENABLE ROW LEVEL SECURITY;

INSERT INTO public.participants (id, name, role) VALUES
 ('11111111-1111-1111-1111-111111111111','Kabir','Backend'),
 ('22222222-2222-2222-2222-222222222222','Ananya','Frontend'),
 ('33333333-3333-3333-3333-333333333333','Rohan','Docs & QA');

INSERT INTO public.tasks (title, owner_id, status, progress, due_date) VALUES
 ('Connect the payment API','11111111-1111-1111-1111-111111111111','pending',0, current_date + 3),
 ('Design the checkout screens','22222222-2222-2222-2222-222222222222','in_progress',40, current_date + 4),
 ('Write the project report draft','33333333-3333-3333-3333-333333333333','pending',0, current_date + 6),
 ('Set up the database schema','11111111-1111-1111-1111-111111111111','in_progress',60, current_date + 2);