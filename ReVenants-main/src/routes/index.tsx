import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  addParticipant,
  addTask,
  getDashboard,
  sendFollowups,
  setStatus,
  simulateReplyAction,
} from "@/lib/coordinator.functions";
import type { RbacRole } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";

// Modular Coordinator Extensions
import { AuthGateModal } from "@/components/coordinator/AuthGateModal";
import { AccountMenu } from "@/components/coordinator/AccountMenu";
import { LoginScreen } from "@/components/coordinator/LoginScreen";
import { ActivityPulseHeatmap } from "@/components/coordinator/ActivityPulseHeatmap";
import { StandupDigestModal } from "@/components/coordinator/StandupDigestModal";
import { CrossDependencyCard } from "@/components/coordinator/CrossDependencyCard";
import { LiveMeetingIntelligence, type MeetingAnalysisResult } from "@/feature";

// Icons
import {
  ShieldCheck,
  FileText,
  Mic,
  Zap,
  Users,
  Radio,
  Building2,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  MessageSquare,
  Activity,
  Layers,
  ArrowRight,
  ExternalLink,
  Plus,
  Copy,
  ListChecks,
  History,
  Check,
  Bot,
} from "lucide-react";

const dashQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => getDashboard(),
  refetchInterval: 3000,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReVenants — AI Group Project Coordinator" },
      {
        name: "description",
        content:
          "Autonomous AI Group Project Coordinator with conversation-first Telegram tracking, the Kabir Rule for blocker extraction, cross-dependency unblocking, and immutable audit logs.",
      },
      { property: "og:title", content: "ReVenants — AI Group Project Coordinator" },
      {
        property: "og:description",
        content:
          "Telegram conversational check-ins, Kabir Rule blocker extraction, unblocker nudges, and real-time state synchronization.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashQuery),
  component: Index,
});

const STATUS_META: Record<string, { label: string; dot: string; cls: string; borderCls: string }> = {
  Pending: {
    label: "Pending",
    dot: "bg-slate-400",
    cls: "bg-slate-500/10 text-slate-300 border-slate-700/60",
    borderCls: "border-slate-700/60",
  },
  "In Progress": {
    label: "In Progress",
    dot: "bg-blue-400 animate-pulse",
    cls: "bg-blue-500/15 text-blue-300 border-blue-500/30",
    borderCls: "border-blue-500/40",
  },
  Blocked: {
    label: "Blocked",
    dot: "bg-rose-500 animate-ping",
    cls: "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-950/40",
    borderCls: "border-rose-500/50",
  },
  Complete: {
    label: "Complete",
    dot: "bg-emerald-400",
    cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    borderCls: "border-emerald-500/40",
  },
};

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  Urgent: { label: "Urgent", cls: "bg-red-500/20 text-red-300 border-red-500/40" },
  High: { label: "High", cls: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  Medium: { label: "Medium", cls: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" },
  Low: { label: "Low", cls: "bg-slate-500/15 text-slate-400 border-slate-700/60" },
};

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META["Pending"]!;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${m.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      <span>{m.label}</span>
    </span>
  );
}

function PriorityPill({ priority }: { priority?: string | null }) {
  if (!priority) return null;
  const m = PRIORITY_META[priority] ?? PRIORITY_META["Medium"]!;
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 font-mono text-[10px] uppercase font-bold tracking-wider ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

const time = (s: string) =>
  new Date(s).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

type ActiveTab = "deliverables" | "unblocker" | "meeting" | "telegram" | "audit";

function Index() {
  const { data } = useSuspenseQuery(dashQuery);
  const qc = useQueryClient();
  const follow = useServerFn(sendFollowups);
  const status = useServerFn(setStatus);
  const newTask = useServerFn(addTask);
  const newPerson = useServerFn(addParticipant);
  const simulate = useServerFn(simulateReplyAction);

  // Tab State
  const [activeTab, setActiveTab] = useState<ActiveTab>("meeting");
  const [taskFilter, setTaskFilter] = useState<string>("ALL");

  // RBAC & Auth State
  const [activeRole, setActiveRole] = useState<RbacRole>("Lead");
  const [activeParticipantId, setActiveParticipantId] = useState(
    data.participants[0]?.id ?? "p_kabir",
  );
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDigestModalOpen, setIsDigestModalOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<"checking" | "signed_out" | "signed_in">("checking");
  const [authUser, setAuthUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setAuthUser(session?.user ?? null);
      setAuthStatus(session ? "signed_in" : "signed_out");
    }).catch(() => {
      if (mounted) setAuthStatus("signed_out");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setAuthUser(session?.user ?? null);
      setAuthStatus(session ? "signed_in" : "signed_out");
      if (!session) setIsAuthModalOpen(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else toast.success("You have been signed out.");
  }

  const [busy, setBusy] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState(data.participants[0]?.id ?? "");
  const [pname, setPname] = useState("");
  const [prole, setProle] = useState("");

  // Simulation state
  const [simTask, setSimTask] = useState(
    data.tasks.find((t) => t.task_id === "TASK-103")?.task_id ||
      data.tasks[0]?.task_id ||
      "TASK-103",
  );
  const [simReply, setSimReply] = useState("connected, but waiting for test credentials");
  const [simIsVoice, setSimIsVoice] = useState(false);
  const [simResult, setSimResult] = useState<{
    task_id: string;
    previous_status: string;
    new_status: string;
    updated: boolean;
    reply_text: string;
    classification: {
      intent: string;
      confidence: number;
      blocker: string | null;
      reasoning: string;
    };
    unblock_nudge?: {
      sent: boolean;
      targetOwnerName: string;
      targetTaskId: string;
      messageText: string;
    } | null;
  } | null>(null);

  const people = new Map(data.participants.map((p) => [p.id, p]));
  const refresh = () => qc.invalidateQueries({ queryKey: ["dashboard"] });

  async function runFollowup(participantId?: string) {
    if (activeRole === "Observer") {
      toast.error("RBAC restriction: Observer role cannot initiate team check-ins.");
      return;
    }

    setBusy(participantId ?? "all");
    try {
      const r = await follow({ data: { participantId } });
      r.results.forEach((x) => toast(x));
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleSimulate(customReply?: string, isVoiceNote = false, targetTaskId?: string) {
    const textToSimulate = customReply ?? simReply;
    const taskIdToUse =
      targetTaskId ||
      simTask ||
      data.tasks.find((t) => t.task_id === "task_01")?.task_id ||
      data.tasks[0]?.task_id ||
      "task_01";

    if (!taskIdToUse || !textToSimulate.trim()) return;

    setBusy("simulating");
    try {
      const simData: { taskId: string; reply: string; isVoice?: boolean; duration?: number } = {
        taskId: taskIdToUse,
        reply: textToSimulate,
        isVoice: isVoiceNote || simIsVoice,
      };
      if (isVoiceNote) {
        simData.duration = 6;
      }
      const res = await simulate({ data: simData });
      setSimResult(res);

      let msg = `Classified: ${res.classification.intent.toUpperCase()} (${Math.round(res.classification.confidence * 100)}%) -> ${res.new_status}`;
      if (res.unblock_nudge?.sent) {
        msg += ` | ⚡ Unblocker dispatched to ${res.unblock_nudge.targetOwnerName}`;
      }
      toast.success(msg);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setBusy(null);
    }
  }

  async function analyzeMeetingTranscript(taskId: string, transcript: string): Promise<MeetingAnalysisResult> {
    const result = await simulate({ data: { taskId, reply: transcript, isVoice: true, duration: 0 } });
    setSimResult(result);
    refresh();
    return result;
  }

  const counts = Object.keys(STATUS_META).map((k) => ({
    k,
    label: STATUS_META[k]!.label,
    n: data.tasks.filter((t) => t.status === k).length,
  }));

  const blockedCount = data.tasks.filter((t) => t.status === "Blocked").length;

  const done = data.tasks.length
    ? Math.round(data.tasks.reduce((a, t) => a + t.progress, 0) / data.tasks.length)
    : 0;

  const currentActivePerson = people.get(activeParticipantId);

  // Filter tasks based on selected filter pill
  const filteredTasks = data.tasks.filter((t) => {
    if (taskFilter === "ALL") return true;
    return t.status === taskFilter;
  });

  if (authStatus !== "signed_in" || !authUser) {
    return <LoginScreen checking={authStatus === "checking"} />;
  }

  return (
    <div className="light-dashboard min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30 selection:text-white">
      <Toaster position="top-right" richColors />

      {/* Global Modals */}
      <AuthGateModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        activeRole={activeRole}
        setActiveRole={setActiveRole}
        activeParticipantId={activeParticipantId}
        setActiveParticipantId={setActiveParticipantId}
        participants={data.participants as any}
        currentWorkspace="ReVenants Alpha Project"
      />

      <StandupDigestModal
        isOpen={isDigestModalOpen}
        onClose={() => setIsDigestModalOpen(false)}
        digests={data.digests}
        onRefresh={refresh}
      />

      {/* Modern Executive Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-30 shadow-xl shadow-slate-950/20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 sm:px-6 py-3.5">
          {/* Brand & Bot Link */}
          <div className="flex items-center gap-3">
            <img
              src="/revenants-branding.png"
              alt="ReVenants logo"
              className="h-11 w-11 rounded-full object-cover shadow-md shadow-indigo-500/20 ring-2 ring-white/80"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white font-display">
                  ReVenants
                </h1>
                <span className="rounded-full bg-indigo-500/10 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-mono font-semibold text-indigo-300">
                  v3.0 Enterprise
                </span>
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Autonomous AI Coordinator Active" />
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <span>Autonomous AI Coordinator</span>
                <span className="text-slate-600">•</span>
                <a
                  className="font-mono text-cyan-400 hover:text-cyan-300 hover:underline inline-flex items-center gap-1"
                  href={`https://t.me/${data.botUsername}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Bot className="w-3.5 h-3.5" />
                  @{data.botUsername}
                </a>
              </p>
            </div>
          </div>

          {/* Action & RBAC Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Supabase Auth & RBAC Profile Button */}
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="group flex items-center gap-2.5 rounded-xl border border-cyan-500/40 bg-cyan-950/30 hover:bg-cyan-900/40 px-3 py-1.5 text-left transition-all shadow-sm hover:border-cyan-400/60"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-cyan-400">
                  <span>Supabase RBAC</span>
                  <span className="text-cyan-600">|</span>
                  <span className="text-white">{activeRole}</span>
                </div>
                <div className="text-xs font-semibold text-slate-200">
                  {currentActivePerson?.name || "Kabir Patel"}
                </div>
              </div>
            </button>

            {/* AI Standup Digest Trigger */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDigestModalOpen(true)}
              className="border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-200 hover:text-white text-xs font-medium h-9 gap-1.5 rounded-xl shadow-sm"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Standup Digest</span>
            </Button>

            {/* Follow-up on All */}
            <Button
              size="sm"
              onClick={() => runFollowup()}
              disabled={busy !== null || activeRole === "Observer"}
              className="bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white font-semibold text-xs h-9 px-3.5 rounded-xl shadow-md shadow-indigo-500/20 border-0"
            >
              <Send className="w-3.5 h-3.5 mr-1" />
              {busy === "all" ? "Sending Check-ins…" : "Follow Up on Open"}
            </Button>

            <AccountMenu
              user={authUser}
              activeRole={activeRole}
              onManageAccount={() => setIsAuthModalOpen(true)}
              onSignOut={handleSignOut}
            />
          </div>
        </div>

        {/* Tenant & RLS Context Strip */}
        <div className="border-t border-slate-800/60 bg-slate-950/60 px-4 sm:px-6 py-2 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-slate-400 font-mono text-[11px]">
            <span className="flex items-center gap-1 text-cyan-400 font-medium">
              <Building2 className="w-3.5 h-3.5" />
              ReVenants Alpha Project (ws_default)
            </span>
            <span className="text-slate-700">/</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Lock className="w-3 h-3" />
              RLS Isolated
            </span>
            <span className="text-slate-700">/</span>
            <span>
              Role: <strong className="text-slate-200">{activeRole}</strong>
            </span>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-6 space-y-6">
        {/* Executive KPI Strip */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {/* Sprint Progress Gauge */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/30 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Sprint Progress</span>
              <span className="font-mono text-cyan-400 font-semibold">{done}%</span>
            </div>
            <div className="mt-2 text-2xl font-bold font-display text-white">{done}%</div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-700 rounded-full"
                style={{ width: `${done}%` }}
              />
            </div>
            <div className="mt-1.5 text-[10px] text-slate-500 font-mono">
              {data.tasks.filter((t) => t.status === "Complete").length} of {data.tasks.length} deliverables
            </div>
          </div>

          {/* Pending Card */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/30 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Pending</span>
              <span className="h-2 w-2 rounded-full bg-slate-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-display text-slate-200">
              {data.tasks.filter((t) => t.status === "Pending").length}
            </div>
            <div className="mt-2 text-[11px] text-slate-500 font-mono">
              {data.tasks.length
                ? Math.round(
                    (data.tasks.filter((t) => t.status === "Pending").length / data.tasks.length) * 100,
                  )
                : 0}
              % queued
            </div>
          </div>

          {/* In Progress Card */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/30 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-blue-400 font-medium">
              <span>In Progress</span>
              <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            </div>
            <div className="mt-2 text-2xl font-bold font-display text-blue-300">
              {data.tasks.filter((t) => t.status === "In Progress").length}
            </div>
            <div className="mt-2 text-[11px] text-slate-500 font-mono">
              {data.tasks.length
                ? Math.round(
                    (data.tasks.filter((t) => t.status === "In Progress").length / data.tasks.length) * 100,
                  )
                : 0}
              % active velocity
            </div>
          </div>

          {/* Blocked Card (Highlighted with alert when > 0) */}
          <div
            className={`rounded-2xl border p-4 shadow-lg backdrop-blur-sm transition-all ${
              blockedCount > 0
                ? "border-rose-500/40 bg-rose-950/20 shadow-rose-950/30"
                : "border-slate-800/80 bg-slate-900/60 shadow-slate-950/30"
            }`}
          >
            <div className="flex items-center justify-between text-xs font-medium">
              <span className={blockedCount > 0 ? "text-rose-400 font-semibold" : "text-slate-400"}>
                Blocked (Kabir Rule)
              </span>
              {blockedCount > 0 ? (
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-600" />
              )}
            </div>
            <div
              className={`mt-2 text-2xl font-bold font-display ${
                blockedCount > 0 ? "text-rose-400" : "text-slate-400"
              }`}
            >
              {blockedCount}
            </div>
            <div className="mt-2 text-[11px] text-slate-500 font-mono">
              {blockedCount > 0 ? "Needs unblocker action" : "0 dependencies stuck"}
            </div>
          </div>

          {/* Completed Card */}
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/30 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
              <span>Complete</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-display text-emerald-400">
              {data.tasks.filter((t) => t.status === "Complete").length}
            </div>
            <div className="mt-2 text-[11px] text-slate-500 font-mono">
              {data.tasks.length
                ? Math.round(
                    (data.tasks.filter((t) => t.status === "Complete").length / data.tasks.length) * 100,
                  )
                : 0}
              % verified done
            </div>
          </div>
        </section>

        {/* Modern Segmented Navigation Bar */}
        <section className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <nav className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setActiveTab("meeting")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "meeting"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Meeting Intelligence</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("deliverables")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "deliverables"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>Deliverables</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  activeTab === "deliverables" ? "bg-indigo-800/80 text-white" : "bg-slate-800 text-slate-300"
                }`}
              >
                {data.tasks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("unblocker")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "unblocker"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Unblocker &amp; Simulator</span>
              {blockedCount > 0 && (
                <span className="rounded-full bg-rose-500/20 border border-rose-500/40 px-1.5 py-0.2 text-[10px] font-mono text-rose-300 font-bold">
                  {blockedCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("telegram")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "telegram"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Telegram Hub</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  activeTab === "telegram" ? "bg-indigo-800/80 text-white" : "bg-slate-800 text-slate-300"
                }`}
              >
                {data.messages.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("audit")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "audit"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Velocity &amp; Audit</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  activeTab === "audit" ? "bg-indigo-800/80 text-white" : "bg-slate-800 text-slate-300"
                }`}
              >
                {data.events.length}
              </span>
            </button>
          </nav>

          {/* Quick RBAC indicator on right */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {activeRole === "Observer" ? (
              <span className="font-mono text-xs text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20 flex items-center gap-1.5">
                <Lock className="w-3 h-3" /> Read-Only Mode (Observer)
              </span>
            ) : (
              <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
                <Unlock className="w-3 h-3" /> Full Edit Mode ({activeRole})
              </span>
            )}
          </div>
        </section>

        {/* TAB 1: DELIVERABLES & SPRINT COCKPIT */}
        {activeTab === "deliverables" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* Left: Task List & Add Form */}
            <div className="space-y-4">
              {/* Task Filter Pills */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {["ALL", "Pending", "In Progress", "Blocked", "Complete"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setTaskFilter(f)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                        taskFilter === f
                          ? "bg-slate-800 text-white border border-slate-700"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                      }`}
                    >
                      {f === "ALL" ? `All (${data.tasks.length})` : f}
                    </button>
                  ))}
                </div>

                <div className="text-xs text-slate-500 font-mono">
                  Showing {filteredTasks.length} deliverable{filteredTasks.length === 1 ? "" : "s"}
                </div>
              </div>

              {/* Task Cards */}
              <div className="space-y-3">
                {filteredTasks.length === 0 && (
                  <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
                    No deliverables match the &quot;{taskFilter}&quot; filter.
                  </div>
                )}

                {filteredTasks.map((t) => (
                  <div
                    key={t.task_id}
                    className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4 sm:p-5 backdrop-blur-sm hover:border-slate-700/80 transition-all shadow-md shadow-slate-950/20"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      {/* Left: Info */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                            {t.task_id}
                          </span>
                          <span className="font-bold text-base text-white">{t.title}</span>
                          <StatusPill status={t.status} />
                          <PriorityPill priority={t.priority} />
                        </div>

                        {t.description && (
                          <p className="text-xs text-slate-400 leading-relaxed">{t.description}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-slate-400">
                          <span className="flex items-center gap-1 text-slate-300">
                            <span className="text-indigo-400">👤</span>
                            {people.get(t.owner_id ?? "")?.name || t.owner_name || "Unassigned"}
                            {t.telegram_handle && (
                              <span className="text-slate-500">({t.telegram_handle})</span>
                            )}
                          </span>

                          {t.due_date && (
                            <span className="flex items-center gap-1">
                              <span>📅</span> Due {t.due_date}
                            </span>
                          )}

                          {t.depends_on_task_id && (
                            <span className="text-amber-400/90 font-medium flex items-center gap-1">
                              <Zap className="w-3 h-3" />
                              Depends on {t.depends_on_task_id}
                            </span>
                          )}

                          {t.last_followup_at && (
                            <span className="flex items-center gap-1 text-slate-500">
                              <Clock className="w-3 h-3" />
                              {time(t.last_followup_at)}
                            </span>
                          )}
                        </div>

                        {/* Blocker Alert Banner */}
                        {t.blocker && (
                          <div className="mt-2 rounded-xl border border-rose-500/40 bg-rose-950/30 px-3.5 py-2 text-xs text-rose-300 font-medium flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                            <span>
                              <strong>Blocker:</strong> {t.blocker}
                            </span>
                          </div>
                        )}

                        {/* Latest Conversational Note */}
                        {t.latest_note && (
                          <div className="text-xs text-slate-400 italic flex items-center gap-1.5 pl-1">
                            <MessageSquare className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span>&quot;{t.latest_note}&quot;</span>
                          </div>
                        )}

                        {/* Progress Bar */}
                        <div className="pt-1 flex items-center gap-3 max-w-sm">
                          <div className="h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                t.status === "Blocked"
                                  ? "bg-rose-500"
                                  : t.status === "Complete"
                                    ? "bg-emerald-500"
                                    : "bg-indigo-500"
                              }`}
                              style={{ width: `${t.progress}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-semibold text-slate-400 w-8 text-right">
                            {t.progress}%
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                        <select
                          aria-label={`Status for ${t.task_id}`}
                          disabled={activeRole === "Observer"}
                          className="h-8 rounded-lg border border-slate-700 bg-slate-800 px-2 font-mono text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                          value={t.status}
                          onChange={async (e) => {
                            try {
                              await status({
                                data: {
                                  taskId: t.task_id,
                                  status: e.target.value,
                                  actorRole: activeRole,
                                },
                              });
                              refresh();
                              toast.success(`Task ${t.task_id} updated to ${e.target.value}`);
                            } catch (err: any) {
                              toast.error(err.message || "Failed to update status");
                            }
                          }}
                        >
                          {Object.entries(STATUS_META).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v.label}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          className="font-mono text-xs text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                          onClick={() => {
                            setSimTask(t.task_id);
                            setActiveTab("unblocker");
                            toast(`Target set to ${t.task_id}. Opened Unblocker & Simulator.`);
                          }}
                        >
                          <span>Simulate Reply</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Deliverable Form */}
              <form
                className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-sm space-y-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!title.trim() || !owner) return;
                  try {
                    await newTask({
                      data: {
                        title,
                        ownerId: owner,
                        actorRole: activeRole,
                      },
                    });
                    setTitle("");
                    toast.success("New deliverable added to project backlog");
                    refresh();
                  } catch (err: any) {
                    toast.error(err.message || "Failed to add task");
                  }
                }}
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Plus className="w-4 h-4 text-indigo-400" />
                  <span>Create New Deliverable</span>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <input
                    disabled={activeRole === "Observer"}
                    className="h-10 flex-1 min-w-[220px] rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                    placeholder={
                      activeRole === "Observer"
                        ? "Observer role is read-only (switch to Lead or Contributor)"
                        : "Deliverable title (e.g., Integrate payment sandbox)"
                    }
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />

                  <select
                    aria-label="Deliverable Assignee"
                    disabled={activeRole === "Observer"}
                    className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                  >
                    {data.participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <Button
                    type="submit"
                    disabled={activeRole === "Observer"}
                    className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
                  >
                    Add Task
                  </Button>
                </div>
              </form>
            </div>

            {/* Right: Team Members & Fast Check-In Roster */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-semibold text-sm text-white">Team Roster &amp; Telegram</h3>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {data.participants.length} Members
                  </span>
                </div>

                <div className="space-y-2.5">
                  {data.participants.map((p) => {
                    const link = `https://t.me/${data.botUsername}?start=${p.link_code}`;
                    const isCurrentClaim = p.id === activeParticipantId;

                    return (
                      <div
                        key={p.id}
                        className={`rounded-xl border p-3 transition-all ${
                          isCurrentClaim
                            ? "border-cyan-500/50 bg-cyan-950/20"
                            : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="font-semibold text-xs text-white flex items-center gap-1.5">
                              <span>{p.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                {p.rbac_role || "Contributor"}
                              </span>
                              {p.linked ? (
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Connected" />
                              ) : (
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" title="Pending" />
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-slate-400 mt-0.5">
                              {p.role} ·{" "}
                              {p.linked ? (
                                <span className="text-emerald-400">
                                  {p.telegram_username ? `@${p.telegram_username}` : "Linked"}
                                </span>
                              ) : (
                                <span className="text-amber-400">Invite Pending</span>
                              )}
                            </div>
                          </div>

                          {p.linked ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy !== null || activeRole === "Observer"}
                              className="h-7 text-xs border-slate-700 bg-slate-800 hover:bg-slate-700"
                              onClick={() => runFollowup(p.id)}
                            >
                              {busy === p.id ? "…" : "Check-in"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(link);
                                toast.success(`Invite link copied for ${p.name}`);
                              }}
                            >
                              Copy Link
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setActiveTab("telegram")}
                    className="text-xs font-mono text-cyan-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>View Full Telegram Hub &amp; Live Chat</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: UNBLOCKER & SIMULATOR */}
        {activeTab === "unblocker" && (
          <div className="space-y-6">
            {/* Cross-Dependency Blocker Graph Card */}
            <CrossDependencyCard
              tasks={data.tasks as any}
              participants={data.participants as any}
              activeRole={activeRole}
              onSimulateNudge={(taskId, text) => {
                setSimTask(taskId);
                setSimReply(text);
                handleSimulate(text);
              }}
            />

            {/* Interactive Intent Classifier & Kabir Rule Simulator */}
            <div className="rounded-2xl border border-indigo-500/40 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/30 backdrop-blur-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                    <Zap className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      The Kabir Rule &amp; Voice Note Reply Simulator
                    </h2>
                    <p className="text-xs text-slate-400">
                      Simulate natural language member replies to test blocker extraction and autonomous unblocker nudges.
                    </p>
                  </div>
                </div>

                <span className="font-mono text-[11px] text-indigo-300 bg-indigo-950/60 border border-indigo-800/80 px-2.5 py-1 rounded-full">
                  docs/05_REPLY_UNDERSTANDING.md
                </span>
              </div>

              {/* Simulation Controls */}
              <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto]">
                <select
                  aria-label="Select Target Task for Simulation"
                  className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 font-mono text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  value={simTask}
                  onChange={(e) => setSimTask(e.target.value)}
                >
                  {data.tasks.map((t) => (
                    <option key={t.task_id} value={t.task_id}>
                      {t.task_id} ({t.status})
                    </option>
                  ))}
                </select>

                <input
                  className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Type member reply or choose a 1-click preset below..."
                  value={simReply}
                  onChange={(e) => setSimReply(e.target.value)}
                />

                <Button
                  className="h-10 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-md shadow-indigo-600/30"
                  onClick={() => handleSimulate()}
                  disabled={busy !== null}
                >
                  {busy === "simulating" ? "Classifying…" : "Simulate Reply"}
                </Button>
              </div>

              {/* 1-Click Presets */}
              {(() => {
                const task01Id =
                  data.tasks.find((t) => t.task_id === "task_01" || t.task_id === "TASK-103")?.task_id ||
                  data.tasks[0]?.task_id ||
                  "task_01";
                const task02Id =
                  data.tasks.find((t) => t.task_id === "task_02" || t.task_id === "TASK-102")?.task_id ||
                  data.tasks[1]?.task_id ||
                  task01Id;
                const task03Id =
                  data.tasks.find((t) => t.task_id === "task_03" || t.task_id === "TASK-101")?.task_id ||
                  data.tasks[2]?.task_id ||
                  task01Id;

                return (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-mono text-slate-400 font-semibold">1-Click Test Presets:</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-rose-500/40 bg-rose-950/20 px-3 py-1.5 text-rose-300 hover:bg-rose-900/30 transition-all font-medium text-xs flex items-center gap-1.5"
                        onClick={() => {
                          setSimTask(task01Id);
                          setSimReply("connected, but waiting for test credentials");
                          handleSimulate("connected, but waiting for test credentials", false, task01Id);
                        }}
                      >
                        <span>🎯</span> The Kabir Rule (&quot;connected, but waiting for test credentials&quot;)
                      </button>

                      <button
                        type="button"
                        className="rounded-xl border border-purple-500/40 bg-purple-950/20 px-3 py-1.5 text-purple-300 hover:bg-purple-900/30 transition-all font-medium text-xs flex items-center gap-1.5"
                        onClick={() => {
                          setSimTask(task01Id);
                          const voiceReply =
                            "Voice update: Finished the database models, but completely blocked waiting on Maya's auth endpoints.";
                          setSimReply(voiceReply);
                          handleSimulate(voiceReply, true, task01Id);
                        }}
                      >
                        <Mic className="w-3.5 h-3.5 text-purple-400" />
                        <span>🎙️ Voice Note Check-In (Audio to Task)</span>
                      </button>

                      <button
                        type="button"
                        className="rounded-xl border border-amber-500/40 bg-amber-950/20 px-3 py-1.5 text-amber-300 hover:bg-amber-900/30 transition-all font-medium text-xs"
                        onClick={() => {
                          setSimTask(task02Id);
                          setSimReply("almost done");
                          handleSimulate("almost done", false, task02Id);
                        }}
                      >
                        <span>⏳ Ambiguous Safeguard (&quot;almost done&quot;)</span>
                      </button>

                      <button
                        type="button"
                        className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 px-3 py-1.5 text-emerald-300 hover:bg-emerald-900/30 transition-all font-medium text-xs"
                        onClick={() => {
                          setSimTask(task03Id);
                          setSimReply("pushed migrations to main and tested locally, all good!");
                          handleSimulate("pushed migrations to main and tested locally, all good!", false, task03Id);
                        }}
                      >
                        <span>✅ Clear Complete (&quot;pushed migrations to main&quot;)</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Simulation Result Banner */}
              {simResult && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs font-mono space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">Task {simResult.task_id}:</span>
                      <span className="text-slate-400">{simResult.previous_status}</span>
                      <span className="text-slate-600">→</span>
                      <StatusPill status={simResult.new_status} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span>
                        Intent:{" "}
                        <strong className="text-cyan-400 uppercase font-bold">
                          {simResult.classification.intent}
                        </strong>
                      </span>
                      <span>
                        Confidence:{" "}
                        <strong className="text-emerald-400 font-bold">
                          {Math.round(simResult.classification.confidence * 100)}%
                        </strong>
                      </span>
                    </div>
                  </div>

                  {simResult.classification.blocker && (
                    <div className="text-rose-400 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      <span>Extracted Blocker: {simResult.classification.blocker}</span>
                    </div>
                  )}

                  {simResult.unblock_nudge?.sent && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-sans">
                      <span className="font-bold font-mono text-amber-400">⚡ Autonomous Unblocker Action:</span>{" "}
                      Sent conversational nudge to <strong>{simResult.unblock_nudge.targetOwnerName}</strong> for upstream deliverable{" "}
                      <strong>{simResult.unblock_nudge.targetTaskId}</strong>.
                    </div>
                  )}

                  <div className="text-slate-400 pt-1">
                    <strong className="text-slate-300">AI Response to Telegram:</strong> &quot;{simResult.reply_text}&quot;
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: TELEGRAM HUB */}
        {activeTab === "telegram" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* Live Message Stream */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white font-display">Live Telegram Stream</h2>
                  <p className="text-xs text-slate-400">
                    Two-way check-ins, conversational replies, and voice notes synced in real-time.
                  </p>
                </div>
                <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 text-xs font-mono text-cyan-300">
                  {data.messages.length} Events
                </span>
              </div>

              <div className="space-y-3 max-h-[700px] overflow-y-auto pr-1">
                {data.messages.length === 0 && (
                  <div className="p-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 text-center text-sm text-slate-400">
                    No Telegram messages recorded yet. Click &quot;Follow Up on Open&quot; or simulate a reply.
                  </div>
                )}

                {data.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-2xl border p-4 text-xs transition-all ${
                      m.direction === "inbound"
                        ? "border-cyan-500/30 bg-cyan-950/20 ml-4 shadow-sm shadow-cyan-950/30"
                        : "border-slate-800 bg-slate-900/60 mr-4 shadow-sm shadow-slate-950/20"
                    }`}
                  >
                    <div className="mb-2 flex justify-between font-mono text-[11px] text-slate-400">
                      <span className="font-semibold text-white flex items-center gap-1.5">
                        {m.media_type === "voice_note" ? (
                          <span className="text-purple-400 font-bold flex items-center gap-1">
                            <Mic className="w-3.5 h-3.5" /> Voice Note
                          </span>
                        ) : m.direction === "inbound" ? (
                          <span className="text-cyan-300">
                            💬 {people.get(m.participant_id ?? "")?.name || "Member"} → Coordinator
                          </span>
                        ) : (
                          <span className="text-indigo-300">
                            🤖 Coordinator → {people.get(m.participant_id ?? "")?.name || "Member"}
                          </span>
                        )}
                      </span>
                      <span>{time(m.created_at)}</span>
                    </div>

                    <p className="whitespace-pre-wrap text-slate-200 font-sans text-sm leading-relaxed">
                      {m.text}
                    </p>

                    {m.classification && (
                      <div className="mt-2.5 font-mono text-[10px] flex items-center gap-2">
                        <span className="rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 font-bold uppercase">
                          {m.classification}
                        </span>
                        <span className="text-slate-400 truncate">{m.ai_summary}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Team Linking & Add Teammate */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 backdrop-blur-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-semibold text-sm text-white">Member Linking</h3>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400">
                    {data.participants.length} Total
                  </span>
                </div>

                <div className="space-y-3">
                  {data.participants.map((p) => {
                    const link = `https://t.me/${data.botUsername}?start=${p.link_code}`;

                    return (
                      <div
                        key={p.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-xs text-white">{p.name}</div>
                            <div className="font-mono text-[11px] text-slate-400">
                              {p.role} ·{" "}
                              {p.linked ? (
                                <span className="text-emerald-400">@{p.telegram_username || "linked"}</span>
                              ) : (
                                <span className="text-amber-400">Not linked</span>
                              )}
                            </div>
                          </div>

                          {p.linked ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy !== null || activeRole === "Observer"}
                              className="h-7 text-xs border-slate-700 bg-slate-800"
                              onClick={() => runFollowup(p.id)}
                            >
                              Check-in
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(link);
                                toast.success(`Invite link copied for ${p.name}`);
                              }}
                            >
                              <Copy className="w-3 h-3 mr-1" />
                              Copy
                            </Button>
                          )}
                        </div>

                        {!p.linked && (
                          <div className="pt-2 border-t border-slate-800/80 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <a
                                href={`tg://resolve?domain=${data.botUsername}&start=${p.link_code}`}
                                className="font-medium text-cyan-400 hover:underline"
                              >
                                Open Telegram ↗
                              </a>
                              <span className="text-slate-500 font-mono">/start {p.link_code}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Teammate Form (Lead Only) */}
                <form
                  className="pt-2 border-t border-slate-800 flex gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!pname.trim()) return;
                    try {
                      await newPerson({
                        data: {
                          name: pname,
                          role: prole,
                          actorRole: activeRole,
                        },
                      });
                      setPname("");
                      setProle("");
                      toast.success("Teammate added");
                      refresh();
                    } catch (err: any) {
                      toast.error(err.message || "Failed to add teammate");
                    }
                  }}
                >
                  <input
                    disabled={activeRole !== "Lead"}
                    className="h-9 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                    placeholder={activeRole === "Lead" ? "Teammate name" : "Lead only"}
                    value={pname}
                    onChange={(e) => setPname(e.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="h-9 text-xs rounded-xl border-slate-700 bg-slate-800"
                    disabled={activeRole !== "Lead"}
                  >
                    Add
                  </Button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: LIVE MEETING INTELLIGENCE */}
        {activeTab === "meeting" && (
          <LiveMeetingIntelligence
            participants={data.participants.map(({ id, name }) => ({ id, name }))}
            tasks={data.tasks.map(({ task_id, title, status }) => ({ task_id, title, status }))}
            onAnalyze={analyzeMeetingTranscript}
          />
        )}

        {/* TAB 5: VELOCITY & IMMUTABLE AUDIT TRAIL */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            {/* Real-time Activity Pulse & Velocity Heatmap */}
            <ActivityPulseHeatmap
              tasks={data.tasks as any}
              messages={data.messages as any}
              events={data.events as any}
            />

            {/* Tamper-proof Status History Log */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-white font-display">
                    Immutable Status History &amp; Audit Trail
                  </h2>
                  <p className="text-xs text-slate-400">
                    Tamper-proof record of transitions, classifier confidence, and triggering Telegram messages.
                  </p>
                </div>
                <span className="font-mono text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2.5 py-1 rounded-full">
                  {data.events.length} Entries
                </span>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 font-mono text-xs divide-y divide-slate-800/80 max-h-[500px] overflow-y-auto">
                {data.events.length === 0 && (
                  <p className="text-slate-500 py-4 text-center">No status transitions recorded yet.</p>
                )}

                {data.events.map((e) => (
                  <div key={e.id} className="py-3 first:pt-0 last:pb-0 flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">{time(e.created_at)}</span>
                        <span className="font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                          {e.task_id}
                        </span>
                        <span className="font-semibold text-slate-300">
                          {e.from_status} → <span className="text-cyan-400 font-bold">{e.to_status}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {e.confidence != null && (
                          <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                            {Math.round(e.confidence * 100)}% conf
                          </span>
                        )}
                        <span className="text-slate-500">[{e.source}]</span>
                      </div>
                    </div>

                    {e.changed_by_message && (
                      <div className="text-slate-400 pl-3 border-l-2 border-indigo-500/60 mt-1 italic font-sans text-xs">
                        Trigger: &quot;{e.changed_by_message}&quot;
                      </div>
                    )}

                    {e.blocker && (
                      <div className="text-rose-400 font-semibold pl-3 mt-0.5 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Blocker Logged: {e.blocker}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
