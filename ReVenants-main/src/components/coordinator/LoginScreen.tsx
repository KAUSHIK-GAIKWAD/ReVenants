import { useState } from "react";
import { ArrowRight, Loader2, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginScreen({ checking = false }: { checking?: boolean }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password || (isRegistering && !fullName.trim())) {
      setError(
        isRegistering
          ? "Enter your name, email address, and password to register."
          : "Enter your email address and password to continue.",
      );
      return;
    }
    if (isRegistering && password.length < 6) {
      setError("Use a password with at least 6 characters.");
      return;
    }
    if (isRegistering && password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (isRegistering) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          toast.success("Your ReVenants account is ready.");
        } else {
          setMessage(
            "Registration successful. Check your email to confirm your account, then sign in.",
          );
          setIsRegistering(false);
          setPassword("");
          setConfirmPassword("");
          toast.success("Account created successfully.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        toast.success("Welcome back to ReVenants.");
      }
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Unable to sign in.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-6 text-slate-900">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
          Restoring your secure session…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#e0e7ff,_transparent_36%),linear-gradient(135deg,_#f8fafc,_#eef4ff)] px-5 py-10 text-slate-900 sm:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:block">
          <div className="mb-8 flex items-center gap-4">
            <img
              src="/revenants-branding.png"
              alt="ReVenants logo"
              className="h-16 w-16 rounded-full object-cover shadow-lg shadow-indigo-500/20 ring-4 ring-white"
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-600">
                ReVenants
              </p>
              <p className="mt-1 text-sm text-slate-500">AI Group Project Coordinator</p>
            </div>
          </div>
          <h1 className="max-w-xl text-5xl font-bold leading-tight tracking-tight text-slate-900">
            Keep every commitment visible, owned, and moving.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
            Sign in to access Meeting Intelligence, project deliverables, Telegram coordination, and
            the live audit workspace.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-xs font-medium text-slate-600">
            <span className="rounded-full border border-indigo-200 bg-white/80 px-3 py-2">
              Secure Supabase Auth
            </span>
            <span className="rounded-full border border-cyan-200 bg-white/80 px-3 py-2">
              Meeting Intelligence first
            </span>
            <span className="rounded-full border border-emerald-200 bg-white/80 px-3 py-2">
              RLS-aware workspace
            </span>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/10 sm:p-8">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <img
              src="/revenants-branding.png"
              alt="ReVenants logo"
              className="h-12 w-12 rounded-full object-cover shadow-md ring-2 ring-indigo-100"
            />
            <div>
              <p className="font-bold tracking-tight text-slate-900">ReVenants</p>
              <p className="text-xs text-slate-500">AI Group Project Coordinator</p>
            </div>
          </div>

          <div className="mb-7">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {isRegistering ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {isRegistering
                ? "Register with Supabase Auth to create your protected project account."
                : "Sign in to continue to your protected project workspace."}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {isRegistering && (
              <div className="space-y-1.5">
                <Label htmlFor="register-name" className="text-xs font-semibold text-slate-700">
                  Full name
                </Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="register-name"
                    type="text"
                    autoComplete="name"
                    placeholder="Your name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="h-11 border-slate-300 bg-white pl-9 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-xs font-semibold text-slate-700">
                Email address
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 border-slate-300 bg-white pl-9 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-xs font-semibold text-slate-700">
                Password
              </Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="login-password"
                  type="password"
                  autoComplete={isRegistering ? "new-password" : "current-password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 border-slate-300 bg-white pl-9 text-slate-900 placeholder:text-slate-400"
                />
              </div>
            </div>

            {isRegistering && (
              <div className="space-y-1.5">
                <Label
                  htmlFor="register-confirm-password"
                  className="text-xs font-semibold text-slate-700"
                >
                  Confirm password
                </Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="register-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="h-11 border-slate-300 bg-white pl-9 text-slate-900 placeholder:text-slate-400"
                  />
                </div>
              </div>
            )}

            {error && (
              <p
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700"
                role="alert"
              >
                {error}
              </p>
            )}
            {message && (
              <p
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700"
                role="status"
              >
                {message}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-gradient-to-r from-indigo-600 to-cyan-500 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:from-indigo-700 hover:to-cyan-600"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {loading
                ? isRegistering
                  ? "Creating account…"
                  : "Signing in…"
                : isRegistering
                  ? "Create account"
                  : "Sign in securely"}
            </Button>
          </form>

          <p className="mt-5 text-center text-xs text-slate-500">
            {isRegistering ? "Already have an account?" : "New to ReVenants?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsRegistering((value) => !value);
                setError(null);
                setMessage(null);
              }}
              className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              {isRegistering ? "Sign in" : "Create an account"}
            </button>
          </p>

          <p className="mt-6 text-center text-[11px] leading-5 text-slate-400">
            Your session is handled by the existing Supabase authentication configuration. The
            project dashboard remains protected until sign-in completes.
          </p>
        </section>
      </div>
    </main>
  );
}
