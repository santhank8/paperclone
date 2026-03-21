import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "@/lib/router";
import { authApi } from "../api/auth";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { AsciiArtAnimation } from "@/components/AsciiArtAnimation";
import { OutpostMark } from "@/components/OutpostMark";

type AuthMode = "sign_in" | "sign_up";

export function AuthPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("sign_in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nextPath = useMemo(() => searchParams.get("next") || "/", [searchParams]);
  const { data: session, isLoading: isSessionLoading } = useQuery({
    queryKey: queryKeys.auth.session,
    queryFn: () => authApi.getSession(),
    retry: false,
  });

  useEffect(() => {
    if (session) {
      navigate(nextPath, { replace: true });
    }
  }, [session, navigate, nextPath]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "sign_in") {
        await authApi.signInEmail({ email: email.trim(), password });
        return;
      }
      await authApi.signUpEmail({
        name: name.trim(),
        email: email.trim(),
        password,
      });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.session });
      await queryClient.invalidateQueries({ queryKey: queryKeys.companies.all });
      navigate(nextPath, { replace: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Authentication failed");
    },
  });

  const canSubmit =
    email.trim().length > 0 &&
    password.trim().length >= 8 &&
    (mode === "sign_in" || name.trim().length > 0);

  if (isSessionLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="flex items-center gap-3">
          <OutpostMark size={20} className="text-primary animate-pulse-amber" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-background">
      {/* Left half — form */}
      <div className="w-full md:w-1/2 flex flex-col overflow-y-auto">
        <div className="w-full max-w-md mx-auto my-auto px-8 py-12">
          <div
            className="flex items-center gap-2.5 mb-10"
            style={{ animationDelay: "0ms" }}
          >
            <OutpostMark size={20} className="text-primary" glow />
            <span className="text-sm font-semibold tracking-wide" style={{ fontFamily: "var(--font-family-display)" }}>
              Outpost
            </span>
          </div>

          <h1
            className="text-2xl font-bold tracking-tight animate-stagger-in"
            style={{ fontFamily: "var(--font-family-display)", animationDelay: "40ms" }}
          >
            {mode === "sign_in" ? "Sign in" : "Create your account"}
          </h1>
          <p
            className="mt-2 text-sm text-muted-foreground animate-stagger-in"
            style={{ animationDelay: "80ms" }}
          >
            {mode === "sign_in"
              ? "Access your Outpost command post."
              : "Set up your operator account."}
          </p>

          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
          >
            {mode === "sign_up" && (
              <div className="animate-stagger-in" style={{ animationDelay: "100ms" }}>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">
                  Name
                </label>
                <input
                  className="w-full border border-border bg-transparent px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/40 focus:border-primary/60 placeholder:text-muted-foreground/40"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  autoFocus
                />
              </div>
            )}
            <div className="animate-stagger-in" style={{ animationDelay: mode === "sign_up" ? "140ms" : "120ms" }}>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">
                Email
              </label>
              <input
                className="w-full border border-border bg-transparent px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/40 focus:border-primary/60 placeholder:text-muted-foreground/40"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                autoFocus={mode === "sign_in"}
              />
            </div>
            <div className="animate-stagger-in" style={{ animationDelay: mode === "sign_up" ? "180ms" : "160ms" }}>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block uppercase tracking-wider">
                Password
              </label>
              <input
                className="w-full border border-border bg-transparent px-3 py-2.5 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/40 focus:border-primary/60 placeholder:text-muted-foreground/40"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "sign_in" ? "current-password" : "new-password"}
              />
            </div>
            {error && (
              <p className="text-xs text-destructive px-1">{error}</p>
            )}
            <div className="animate-stagger-in" style={{ animationDelay: mode === "sign_up" ? "220ms" : "200ms" }}>
              <Button
                type="submit"
                disabled={!canSubmit || mutation.isPending}
                className="w-full font-semibold"
              >
                {mutation.isPending
                  ? "Working…"
                  : mode === "sign_in"
                    ? "Sign In"
                    : "Create Account"}
              </Button>
            </div>
          </form>

          <div
            className="mt-6 text-sm text-muted-foreground animate-stagger-in"
            style={{ animationDelay: "260ms" }}
          >
            {mode === "sign_in" ? "Need an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:text-primary/80 transition-colors"
              onClick={() => {
                setError(null);
                setMode(mode === "sign_in" ? "sign_up" : "sign_in");
              }}
            >
              {mode === "sign_in" ? "Create one" : "Sign in"}
            </button>
          </div>
        </div>
      </div>

      {/* Right half — signal station animation */}
      <div className="hidden md:block w-1/2 overflow-hidden relative">
        <AsciiArtAnimation />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <OutpostMark size={48} className="text-[oklch(0.78_0.155_70)] mx-auto mb-4 opacity-60" glow />
            <p
              className="text-xs uppercase tracking-[0.25em] font-medium opacity-40"
              style={{ fontFamily: "var(--font-family-display)", color: "oklch(0.78 0.155 70)" }}
            >
              Command Post
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
