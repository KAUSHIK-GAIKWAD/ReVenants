import React from "react";
import { Link2, Zap, ArrowRight, UserCheck, AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Task, Participant, RbacRole } from "@/lib/types";

interface CrossDependencyCardProps {
  tasks: Task[];
  participants: Participant[];
  activeRole: RbacRole;
  onSimulateNudge: (taskId: string, nudgeText: string) => void;
}

export function CrossDependencyCard({
  tasks,
  participants,
  activeRole,
  onSimulateNudge,
}: CrossDependencyCardProps) {
  // Find all tasks that have depends_on_task_id
  const dependentTasks = tasks.filter((t) => t.depends_on_task_id);
  const taskMap = new Map(tasks.map((t) => [t.task_id, t]));
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  if (dependentTasks.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md p-5 space-y-4 shadow-xl shadow-slate-950/30">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Zap className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              Cross-Dependency Graph &amp; &quot;The Unblocker&quot; Nudge Engine
            </h3>
            <p className="text-xs text-slate-400">
              Autonomous Kabir Rule detection when Member A is blocked by Member B&apos;s deliverable
            </p>
          </div>
        </div>

        <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-slate-300">
          {dependentTasks.length} Tracked Link{dependentTasks.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {dependentTasks.map((task) => {
          const upstreamTask = task.depends_on_task_id ? taskMap.get(task.depends_on_task_id) : null;
          const downstreamOwner = participantMap.get(task.owner_id);
          const upstreamOwner = upstreamTask ? participantMap.get(upstreamTask.owner_id) : null;

          const isBlocked = task.status === "Blocked";
          const isUpstreamComplete = upstreamTask?.status === "Complete";

          return (
            <div
              key={task.task_id}
              className={`p-4 rounded-xl border transition-all ${
                isBlocked
                  ? "bg-rose-950/20 border-rose-500/40 shadow-sm shadow-rose-950/50"
                  : isUpstreamComplete
                    ? "bg-slate-950/40 border-slate-800/70"
                    : "bg-slate-950/50 border-amber-500/30"
              }`}
            >
              {/* Dependency Connection Row */}
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-200">{task.task_id}</span>
                  <span className="text-slate-400 text-[10px]">
                    ({downstreamOwner?.name || task.owner_name || "Unassigned"})
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-cyan-300">{task.depends_on_task_id}</span>
                  <span className="text-slate-400 text-[10px]">
                    ({upstreamOwner?.name || upstreamTask?.owner_name || "Unassigned"})
                  </span>
                </div>
              </div>

              {/* Task Details */}
              <div className="space-y-1.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-slate-300 font-medium">{task.title}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isBlocked
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "bg-slate-800 text-slate-300"
                    }`}
                  >
                    {task.status}
                  </span>
                </div>

                <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Waiting on: <span className="text-slate-200">{upstreamTask?.title || task.depends_on_task_id}</span></span>
                  <span className="font-mono text-cyan-400 font-semibold">{upstreamTask?.status} ({upstreamTask?.progress}%)</span>
                </div>

                {/* Blocker alert and Unblocker Nudge status */}
                {isBlocked && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-950/40 border border-rose-500/30 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-rose-300 text-[11px] font-medium">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Kabir Rule Alert: &quot;{task.blocker || "Blocked by upstream deliverable"}&quot;</span>
                    </div>

                    {task.unblock_nudge_sent_at ? (
                      <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400 pt-1 border-t border-rose-900/40">
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" />
                          Unblocker Nudge sent to {upstreamOwner?.name || upstreamTask?.owner_name || "teammate"}
                        </span>
                        <span className="text-slate-400">
                          {new Date(task.unblock_nudge_sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-slate-400 font-mono">Coordinator pending nudge dispatch</span>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            onSimulateNudge(
                              task.task_id,
                              `I am totally blocked waiting on ${task.depends_on_task_id} to finish first!`,
                            );
                            toast.success(`Triggered Unblocker Nudge for ${upstreamTask?.owner_name || "teammate"}!`);
                          }}
                          className="h-6 px-2 text-[10px] bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-medium rounded"
                        >
                          <Zap className="w-2.5 h-2.5 mr-1" /> Dispatch Nudge Now
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
