// src/lib/realtime.ts
// Helper utilities for Supabase realtime subscriptions.
// This file sets up listeners on the `tasks` and `messages` tables and forwards
// incoming payloads to a user‑provided callback. It uses the client‑side Supabase
// instance (publishable key) so it works in the browser and respects RLS.

import { supabase } from '@/integrations/supabase/client';
import type { Task, Message } from './types';

/**
 * Subscribe to INSERT/UPDATE/DELETE events on the `tasks` table.
 * The callback receives the full `Task` record after the change.
 */
export function subscribeToTasks(
  onChange: (payload: { eventType: string; task: Task }) => void
) {
  const channel = supabase
    .channel('public:tasks')
    .on(
      'postgres_changes',
      {
        event: '*', // listen to INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'tasks',
      },
      (payload) => {
        // payload.new contains the new row for INSERT/UPDATE,
        // payload.old for DELETE. We normalize to a `task` object.
        const task: Task = (payload.new || payload.old) as any;
        onChange({ eventType: payload.eventType, task });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to INSERT events on the `messages` table.
 * Generally we only need new inbound/outbound messages, so we filter to INSERT.
 */
export function subscribeToMessages(
  onMessage: (payload: { eventType: string; message: Message }) => void
) {
  const channel = supabase
    .channel('public:messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      (payload) => {
        const message: Message = payload.new as any;
        onMessage({ eventType: payload.eventType, message });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
