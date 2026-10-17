import { createServerFn } from "@tanstack/react-start";
import * as store from "@/lib/store";
import {
  BOT_USERNAME,
  processReply,
  sendFollowupTo,
  generateStandupDigest,
} from "@/lib/coordinator.server";
import { normalizeStatus, type TaskPriority, type RbacRole } from "@/lib/types";

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const [workspaces, participants, tasks, messages, events, digests] = await Promise.all([
    store.getWorkspaces(),
    store.getParticipants(),
    store.getTasks(),
    store.getMessages(60),
    store.getStatusHistory(40),
    store.getStandupDigests("ws_default", 5),
  ]);

  return {
    botUsername: BOT_USERNAME,
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      description: w.description,
    })),
    participants: participants.map((x) => ({
      id: x.id,
      name: x.name,
      role: x.role || "Contributor",
      workspace_id: x.workspace_id || "ws_default",
      user_id: x.user_id || null,
      rbac_role: (x.rbac_role || "Contributor") as RbacRole,
      linked: !!x.telegram_id,
      telegram_username: x.telegram_username,
      telegram_handle: x.telegram_handle,
      link_code: x.link_code || `link_${x.id}`,
      created_at: x.created_at || new Date().toISOString(),
    })),
    tasks: tasks.map((t) => ({
      id: t.task_id,
      task_id: t.task_id,
      title: t.title,
      description: t.description,
      workspace_id: t.workspace_id || "ws_default",
      owner_id: t.owner_id,
      owner_name: t.owner_name,
      telegram_handle: t.telegram_handle,
      status: t.status,
      progress: t.progress,
      blocker: t.blocker,
      due_date: t.due_date,
      priority: t.priority,
      depends_on_task_id: t.depends_on_task_id,
      unblock_nudge_sent_at: t.unblock_nudge_sent_at,
      unblock_target_participant_id: t.unblock_target_participant_id,
      last_followup_at: t.last_followup_at,
      latest_note: t.latest_note,
    })),
    messages: messages.map((m) => ({
      id: m.id,
      participant_id: m.participant_id,
      task_id: m.task_id,
      direction: m.direction,
      media_type: m.media_type || "text",
      voice_transcription: m.voice_transcription || null,
      audio_duration_seconds: m.audio_duration_seconds || null,
      text: m.text,
      classification: m.classification,
      ai_summary: m.ai_summary,
      created_at: m.created_at,
    })),
    events: events.map((e) => ({
      id: e.id,
      task_id: e.task_id,
      from_status: e.previous_status,
      to_status: e.new_status,
      reason: e.reason || e.changed_by_message,
      changed_by_message: e.changed_by_message,
      confidence: e.confidence,
      source: e.trigger_source,
      blocker: e.blocker,
      created_at: e.changed_at,
    })),
    digests: digests.map((d) => ({
      id: d.id,
      workspace_id: d.workspace_id,
      summary_markdown: d.summary_markdown,
      blocker_count: d.blocker_count,
      completed_count: d.completed_count,
      in_progress_count: d.in_progress_count,
      broadcast_telegram: d.broadcast_telegram,
      created_at: d.created_at,
    })),
  };
});

export const sendFollowups = createServerFn({ method: "POST" })
  .inputValidator((d: { participantId?: string | undefined }) => d)
  .handler(async ({ data }) => {
    let ids: string[];
    if (data.participantId) {
      ids = [data.participantId];
    } else {
      const allTasks = await store.getTasks();
      const openTasks = allTasks.filter((t) => t.status !== "Complete");
      ids = [...new Set(openTasks.map((t) => t.owner_id).filter(Boolean))];
    }

    const results: string[] = [];
    for (const id of ids) {
      try {
        const res = await sendFollowupTo(id);
        results.push(res.reason);
      } catch (e) {
        results.push(e instanceof Error ? e.message : String(e));
      }
    }
    return { results };
  });

export const addTask = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      title: string;
      ownerId: string;
      dueDate?: string;
      priority?: string;
      description?: string;
      dependsOnTaskId?: string;
      actorRole?: string;
    }) => {
      if (!d.title?.trim()) throw new Error("Title required");
      return {
        ...d,
        title: d.title.trim().slice(0, 200),
        priority: (d.priority || "Medium") as TaskPriority,
      };
    },
  )
  .handler(async ({ data }) => {
    // Observer cannot create tasks
    if (data.actorRole === "Observer") {
      throw new Error("RBAC restriction: Observer role cannot add new tasks.");
    }

    const taskInput: {
      title: string;
      ownerId: string;
      dueDate?: string;
      priority?: TaskPriority;
      description?: string;
      dependsOnTaskId?: string;
    } = {
      title: data.title,
      ownerId: data.ownerId,
    };
    if (data.dueDate) taskInput.dueDate = data.dueDate;
    if (data.priority) taskInput.priority = data.priority;
    if (data.description) taskInput.description = data.description;
    if (data.dependsOnTaskId) taskInput.dependsOnTaskId = data.dependsOnTaskId;

    await store.addTask(taskInput);
    return { ok: true };
  });

export const addParticipant = createServerFn({ method: "POST" })
  .inputValidator(
    (d: { name: string; role?: string | undefined; rbacRole?: string; actorRole?: string }) => {
      if (!d.name?.trim()) throw new Error("Name required");
      return {
        name: d.name.trim().slice(0, 60),
        role: d.role?.slice(0, 60) ?? null,
        rbacRole: (d.rbacRole || "Contributor") as RbacRole,
        actorRole: d.actorRole,
      };
    },
  )
  .handler(async ({ data }) => {
    if (data.actorRole && data.actorRole !== "Lead") {
      throw new Error("RBAC restriction: Only team Leads can invite or add new participants.");
    }

    await store.addParticipant(data.name, data.role ?? undefined, "ws_default", data.rbacRole);
    return { ok: true };
  });

export const claimParticipantAction = createServerFn({ method: "POST" })
  .inputValidator((d: { participantId: string; userId: string; rbacRole?: string }) => d)
  .handler(async ({ data }) => {
    const updated = await store.claimParticipantProfile(
      data.participantId,
      data.userId,
      data.rbacRole as RbacRole | undefined,
    );
    return { ok: true, participant: updated };
  });

export const setStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { taskId: string; status: string; actorRole?: string }) => d)
  .handler(async ({ data }) => {
    const task = await store.getTaskById(data.taskId);
    if (!task) throw new Error("Task not found");

    if (data.actorRole === "Observer") {
      throw new Error("RBAC restriction: Observers have read-only access.");
    }

    // Overriding a blocker to complete/progress manually requires Lead role
    if (task.status === "Blocked" && data.status !== "Blocked" && data.actorRole && data.actorRole !== "Lead") {
      throw new Error("RBAC restriction: Only the Team Lead can manually resolve or override the Kabir Rule blocker flag.");
    }

    const previousStatus = task.status;
    const targetStatus = normalizeStatus(data.status);

    await store.updateTask(task.task_id, {
      status: targetStatus,
      progress: targetStatus === "Complete" ? 100 : task.progress,
      blocker: targetStatus === "Blocked" ? task.blocker || "Manual blocker flagged" : null,
      latest_note: `Status updated manually to ${targetStatus}`,
    });

    await store.logStatusHistory({
      task_id: task.task_id,
      previous_status: previousStatus,
      new_status: targetStatus,
      changed_by_message: `Manual update via dashboard (${data.actorRole || "Contributor"})`,
      trigger_source: "manual_dashboard",
      confidence: 1.0,
      reason: `User set status to ${targetStatus}`,
    });

    return { ok: true };
  });

export const reassignTaskAction = createServerFn({ method: "POST" })
  .inputValidator((d: { taskId: string; newOwnerId: string; newDueDate?: string; actorRole?: string }) => d)
  .handler(async ({ data }) => {
    if (data.actorRole && data.actorRole !== "Lead") {
      throw new Error("RBAC restriction: Only Team Leads can reassign task owners or alter due dates.");
    }

    const [task, newOwner] = await Promise.all([
      store.getTaskById(data.taskId),
      store.getParticipantById(data.newOwnerId),
    ]);

    if (!task) throw new Error("Task not found");
    if (!newOwner) throw new Error("Owner not found");

    const finalDueDate: string = data.newDueDate || task.due_date;
    await store.updateTask(task.task_id, {
      owner_name: newOwner.name,
      telegram_handle: newOwner.telegram_handle ?? null,
      due_date: finalDueDate,
    });

    await store.logStatusHistory({
      task_id: task.task_id,
      previous_status: task.status,
      new_status: task.status,
      changed_by_message: `Reassigned to ${newOwner.name} by Lead`,
      trigger_source: "manual_dashboard",
      confidence: 1.0,
      reason: `Task reassignment`,
    });

    return { ok: true };
  });

export const simulateReplyAction = createServerFn({ method: "POST" })
  .inputValidator((d: { taskId: string; reply: string; isVoice?: boolean; duration?: number }) => {
    if (!d.taskId?.trim()) throw new Error("Task ID required");
    if (!d.reply?.trim()) throw new Error("Reply text required");
    return {
      taskId: d.taskId.trim(),
      reply: d.reply.trim(),
      isVoice: !!d.isVoice,
      duration: d.duration || 8,
    };
  })
  .handler(async ({ data }) => {
    const result = await processReply(data.taskId, data.reply, "simulation", "Simulation");
    return result;
  });

export const generateStandupDigestAction = createServerFn({ method: "POST" })
  .inputValidator((d: { workspaceId?: string; broadcastTelegram?: boolean }) => d)
  .handler(async ({ data }) => {
    const result = await generateStandupDigest(
      data.workspaceId || "ws_default",
      data.broadcastTelegram || false,
    );
    return result;
  });
