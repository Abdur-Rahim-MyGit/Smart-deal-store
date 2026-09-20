import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Loader2, MailWarning, TriangleAlert } from "lucide-react";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import { api, errorMessage } from "@/lib/api";
import { searchString } from "@/lib/search-params";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (search: Record<string, unknown>): { token?: string | undefined } => ({
    token: searchString(search["token"]),
  }),
  head: () => ({ meta: [{ title: "Verify email | Smart Deal" }] }),
  component: VerifyEmailPage,
});

type State = "verifying" | "success" | "used" | "invalid";

function VerifyEmailPage() {
  const { token } = Route.useSearch();
  const { isAuthenticated, refreshUser } = useStore();
  const [state, setState] = useState<State>(token ? "verifying" : "invalid");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    (async () => {
      try {
        await api("/auth/verify-email", { method: "POST", body: { token } });
        setState("success");
        // Keep the signed-in session in step with the verified flag.
        if (isAuthenticated) await refreshUser().catch(() => undefined);
      } catch (caught) {
        const text = errorMessage(caught);
        setMessage(text);
        setState(/already used/i.test(text) ? "used" : "invalid");
      }
    })();
  }, [token, isAuthenticated, refreshUser]);

  if (state === "verifying") {
    return (
      <AuthShell>
        <AuthCard>
          <div className="space-y-4 py-6 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-foreground/60" />
            <p className="text-sm text-muted-foreground">Verifying your email address…</p>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  if (state === "success") {
    return (
      <AuthShell>
        <AuthCard>
          <div className="space-y-5 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/12 text-success">
              <BadgeCheck className="h-6 w-6" />
            </span>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-extrabold tracking-tight">
                Email verified
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Thank you — your email address is confirmed. You&apos;ll now get order updates and
                delivery notifications.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild className="h-11 w-full rounded-xl font-semibold">
                <Link to="/account" search={{ tab: "overview" }}>
                  Go to my account
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 w-full rounded-xl font-semibold">
                <Link to="/">Start shopping</Link>
              </Button>
            </div>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  const used = state === "used";

  return (
    <AuthShell>
      <AuthCard>
        <div className="space-y-5 text-center">
          <span
            className={
              used
                ? "mx-auto grid h-14 w-14 place-items-center rounded-full bg-sky-500/12 text-sky-600 dark:text-sky-400"
                : "mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/12 text-destructive"
            }
          >
            {used ? <MailWarning className="h-6 w-6" /> : <TriangleAlert className="h-6 w-6" />}
          </span>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-extrabold tracking-tight">
              {used ? "This link was already used" : "We couldn't verify this link"}
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {message ||
                (token
                  ? "This verification link is invalid or has expired."
                  : "This verification link is missing its security token.")}{" "}
              {used
                ? "Your email may already be verified — sign in to check."
                : "You can send yourself a fresh link from your account settings."}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button asChild className="h-11 w-full rounded-xl font-semibold">
              <Link to="/account" search={{ tab: "overview" }}>
                Go to my account
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 w-full rounded-xl font-semibold">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        </div>
      </AuthCard>
    </AuthShell>
  );
}
