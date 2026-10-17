import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShieldCheck, UserCheck, LogOut, KeyRound, Sparkles, Building2 } from "lucide-react";
import type { RbacRole, Participant } from "@/lib/types";

interface AuthGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRole: RbacRole;
  setActiveRole: (role: RbacRole) => void;
  activeParticipantId: string;
  setActiveParticipantId: (id: string) => void;
  participants: Array<Participant & { linked?: boolean }>;
  currentWorkspace: string;
}

export function AuthGateModal({
  isOpen,
  onClose,
  activeRole,
  setActiveRole,
  activeParticipantId,
  setActiveParticipantId,
  participants,
  currentWorkspace,
}: AuthGateModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authUser, setAuthUser] = useState<any>(null);

  useEffect(() => {
    let unsubscribe = () => {};
    // Check initial supabase session if configured
    try {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setAuthUser(session.user);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setAuthUser(session?.user ?? null);
      });
      unsubscribe = () => subscription.unsubscribe();
    } catch {
      // In local offline mode without Supabase env vars, fall back gracefully
    }
    return () => {
      unsubscribe();
    };
  }, []);

  async function handleEmailAuth(isSignUp: boolean) {
    if (!email || !password) {
      toast.error("Please enter both email and password.");
      return;
    }

    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Account created! Check your email or sign in directly.");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        setAuthUser(data.user);
        toast.success(`Welcome back, ${data.user.email}!`);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err: any) {
      toast.error(err.message || `Failed to sign in with ${provider}`);
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      setAuthUser(null);
      toast.info("Signed out of Supabase Auth.");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const roleColors: Record<RbacRole, { bg: string; text: string; border: string }> = {
    Lead: { bg: "bg-amber-500/10", text: "text-amber-500 dark:text-amber-400", border: "border-amber-500/30" },
    Contributor: { bg: "bg-blue-500/10", text: "text-blue-500 dark:text-blue-400", border: "border-blue-500/30" },
    Observer: { bg: "bg-purple-500/10", text: "text-purple-500 dark:text-purple-400", border: "border-purple-500/30" },
    "AI Coordinator": { bg: "bg-emerald-500/10", text: "text-emerald-500 dark:text-emerald-400", border: "border-emerald-500/30" },
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-white border-slate-200 text-slate-900 p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Enterprise Auth & RBAC Profile Gate
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-xs">
                Tenant: <span className="text-cyan-400 font-mono font-semibold">{currentWorkspace}</span> • Multi-tenant Row-Level Security
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 pt-2">
          {/* Quick Persona / RBAC Role Switcher */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider font-mono">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Live Demo Persona Claim
              </span>
              <span className="text-[11px] text-slate-500">Instant Role Simulation</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["Lead", "Contributor", "Observer", "AI Coordinator"] as RbacRole[]).map((r) => {
                const isSelected = activeRole === r;
                const c = roleColors[r];
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setActiveRole(r);
                      // Auto-map appropriate participant
                      if (r === "Lead") {
                        const kabir = participants.find((p) => p.name.includes("Kabir")) || participants[0];
                        if (kabir) setActiveParticipantId(kabir.id);
                      } else if (r === "Contributor") {
                        const contributor = participants.find((p) => !p.name.includes("Kabir") && p.role !== "Observer") || participants[1];
                        if (contributor) setActiveParticipantId(contributor.id);
                      } else if (r === "Observer") {
                        const obs = participants.find((p) => p.rbac_role === "Observer" || p.name.includes("Alex")) || participants[2];
                        if (obs) setActiveParticipantId(obs.id);
                      }
                      toast.success(`Role switched to ${r}`);
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                      isSelected
                        ? `${c.bg} ${c.text} ${c.border} ring-1 ring-cyan-500/50 shadow-sm shadow-cyan-500/20`
                        : "bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    <span className="font-semibold">{r}</span>
                    <span className="text-[10px] opacity-70 mt-0.5">
                      {r === "Lead"
                        ? "Full Control"
                        : r === "Contributor"
                          ? "Tasks & Updates"
                          : r === "Observer"
                            ? "Audit View Only"
                            : "System Daemon"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Persona Details */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">Claimed Member:</span>
              <select
                aria-label="Select Claimed Team Member"
                value={activeParticipantId}
                onChange={(e) => {
                  setActiveParticipantId(e.target.value);
                  const p = participants.find((x) => x.id === e.target.value);
                  if (p?.rbac_role) setActiveRole(p.rbac_role);
                  toast.success(`Claimed profile: ${p?.name || e.target.value}`);
                }}
                className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-cyan-500 outline-none"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role || "Contributor"}) — {p.rbac_role || "Contributor"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Real Supabase Auth Form */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                Supabase Auth Connection
              </span>
              {authUser ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <UserCheck className="w-3 h-3" />
                  Authenticated: {authUser.email}
                </span>
              ) : (
                <span className="text-[11px] text-slate-500 font-mono">Anonymous / Demo</span>
              )}
            </div>

            {authUser ? (
              <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-slate-700">
                  <p className="font-semibold text-slate-900">Logged in as: {authUser.email}</p>
                  <p className="text-[10px] text-slate-500 font-mono">UID: {authUser.id.slice(0, 16)}...</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="border-rose-300 bg-white hover:bg-rose-50 text-rose-600 text-xs"
                >
                  <LogOut className="w-3.5 h-3.5 mr-1" /> Sign Out
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Predefined Demo Credentials Quick Fill */}
                <div className="flex flex-wrap items-center gap-1.5 pb-1">
                  <span className="text-[10px] text-slate-500 font-mono">Quick Fill Predefined:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("lead@revenants.ai");
                      setPassword("Password123!");
                      toast.info("Filled Lead credentials (lead@revenants.ai)");
                    }}
                    className="px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] hover:bg-amber-500/20 font-medium"
                  >
                    👑 Lead (Kabir)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("contributor@revenants.ai");
                      setPassword("Password123!");
                      toast.info("Filled Contributor credentials (contributor@revenants.ai)");
                    }}
                    className="px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-300 text-[10px] hover:bg-blue-500/20 font-medium"
                  >
                    💻 Contributor (Ananya)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("observer@revenants.ai");
                      setPassword("Password123!");
                      toast.info("Filled Observer credentials (observer@revenants.ai)");
                    }}
                    className="px-2 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-300 text-[10px] hover:bg-purple-500/20 font-medium"
                  >
                    👁️ Observer (Rohan)
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-500">Email Address</Label>
                    <Input
                      type="email"
                      placeholder="engineer@revenants.ai"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    className="bg-white border-slate-300 text-xs text-slate-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-500">Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    className="bg-white border-slate-300 text-xs text-slate-800"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    disabled={authLoading}
                    onClick={() => handleEmailAuth(false)}
                    className="flex-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs shadow-md shadow-cyan-900/40"
                  >
                    Sign In
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={authLoading}
                    onClick={() => handleEmailAuth(true)}
                    className="flex-1 border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs"
                  >
                    Create Account
                  </Button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={authLoading}
                    onClick={() => handleOAuth("google")}
                    className="w-full border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs"
                  >
                    Continue with Google OAuth
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs"
            >
              Done & Return to Workspace
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
