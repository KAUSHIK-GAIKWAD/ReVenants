export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id: string
          name: string
          slug: string
          description?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      participants: {
        Row: {
          id: string
          name: string
          role: string | null
          workspace_id: string | null
          user_id: string | null
          rbac_role: string
          telegram_id: number | null
          telegram_handle: string | null
          telegram_username: string | null
          link_code: string
          created_at: string
        }
        Insert: {
          id: string
          name: string
          role?: string | null
          workspace_id?: string | null
          user_id?: string | null
          rbac_role?: string
          telegram_id?: number | null
          telegram_handle?: string | null
          telegram_username?: string | null
          link_code?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          role?: string | null
          workspace_id?: string | null
          user_id?: string | null
          rbac_role?: string
          telegram_id?: number | null
          telegram_handle?: string | null
          telegram_username?: string | null
          link_code?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          task_id: string
          title: string
          description: string | null
          workspace_id: string | null
          owner_id: string
          owner_name: string | null
          telegram_handle: string | null
          status: string
          progress_percent: number
          blocker: string | null
          due_date: string
          priority: string
          depends_on_task_id: string | null
          unblock_nudge_sent_at: string | null
          unblock_target_participant_id: string | null
          reminder_count: number
          last_followup_at: string | null
          latest_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          task_id: string
          title: string
          description?: string | null
          workspace_id?: string | null
          owner_id: string
          owner_name?: string | null
          telegram_handle?: string | null
          status?: string
          progress_percent?: number
          blocker?: string | null
          due_date: string
          priority?: string
          depends_on_task_id?: string | null
          unblock_nudge_sent_at?: string | null
          unblock_target_participant_id?: string | null
          reminder_count?: number
          last_followup_at?: string | null
          latest_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          task_id?: string
          title?: string
          description?: string | null
          workspace_id?: string | null
          owner_id?: string
          owner_name?: string | null
          telegram_handle?: string | null
          status?: string
          progress_percent?: number
          blocker?: string | null
          due_date?: string
          priority?: string
          depends_on_task_id?: string | null
          unblock_nudge_sent_at?: string | null
          unblock_target_participant_id?: string | null
          reminder_count?: number
          last_followup_at?: string | null
          latest_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          }
        ]
      }
      messages: {
        Row: {
          id: number
          workspace_id: string | null
          telegram_message_id: number | null
          sender_id: string | null
          participant_id: string | null
          task_id: string | null
          direction: string
          media_type: string
          voice_transcription: string | null
          audio_duration_seconds: number | null
          content: string
          text: string
          classification: string | null
          ai_summary: string | null
          created_at: string
        }
        Insert: {
          id?: number
          workspace_id?: string | null
          telegram_message_id?: number | null
          sender_id?: string | null
          participant_id?: string | null
          task_id?: string | null
          direction: string
          media_type?: string
          voice_transcription?: string | null
          audio_duration_seconds?: number | null
          content?: string
          text?: string
          classification?: string | null
          ai_summary?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          workspace_id?: string | null
          telegram_message_id?: number | null
          sender_id?: string | null
          participant_id?: string | null
          task_id?: string | null
          direction?: string
          media_type?: string
          voice_transcription?: string | null
          audio_duration_seconds?: number | null
          content?: string
          text?: string
          classification?: string | null
          ai_summary?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      status_history: {
        Row: {
          id: number
          task_id: string
          previous_status: string
          new_status: string
          changed_by_message: string
          trigger_source: string
          confidence: number | null
          blocker: string | null
          reason: string | null
          changed_at: string
          created_at: string
        }
        Insert: {
          id?: number
          task_id: string
          previous_status: string
          new_status: string
          changed_by_message: string
          trigger_source?: string
          confidence?: number | null
          blocker?: string | null
          reason?: string | null
          changed_at?: string
          created_at?: string
        }
        Update: {
          id?: number
          task_id?: string
          previous_status?: string
          new_status?: string
          changed_by_message?: string
          trigger_source?: string
          confidence?: number | null
          blocker?: string | null
          reason?: string | null
          changed_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["task_id"]
          }
        ]
      }
      standup_digests: {
        Row: {
          id: string
          workspace_id: string
          summary_markdown: string
          blocker_count: number
          completed_count: number
          in_progress_count: number
          broadcast_telegram: boolean
          created_at: string
          created_by_user_id: string | null
        }
        Insert: {
          id?: string
          workspace_id?: string
          summary_markdown: string
          blocker_count?: number
          completed_count?: number
          in_progress_count?: number
          broadcast_telegram?: boolean
          created_at?: string
          created_by_user_id?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          summary_markdown?: string
          blocker_count?: number
          completed_count?: number
          in_progress_count?: number
          broadcast_telegram?: boolean
          created_at?: string
          created_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "standup_digests_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          }
        ]
      }
      // Backward compatibility alias if needed
      status_events: {
        Row: {
          id: string
          task_id: string | null
          from_status: string | null
          to_status: string
          reason: string | null
          source: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id?: string | null
          from_status?: string | null
          to_status: string
          reason?: string | null
          source?: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string | null
          from_status?: string | null
          to_status?: string
          reason?: string | null
          source?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {
      current_user_workspace_role: {
        Args: {
          ws_id: string
        }
        Returns: string
      }
    }
    Enums: {}
    CompositeTypes: {}
  }
}
