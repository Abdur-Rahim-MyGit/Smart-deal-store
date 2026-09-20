import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Loader2, Mail, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";
import { isEmail } from "@/components/auth/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password | Smart Deal" }] }),
  component: ForgotPasswordPage,
});

interface ForgotResponse {
  message: string;
  devResetUrl?: string | undefined;
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<ForgotResponse | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isEmail(email)) {
      setError("Enter a valid email address");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await api<ForgotResponse>("/auth/forgot-password", {
        method: "POST",
        body: { email: email.trim().toLowerCase() },
      });
      setSent(response);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <AuthShell>
        <AuthCard>
          <div className="space-y-5 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/12 text-success">
              <MailCheck className="h-6 w-6" />
            </span>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-extrabold tracking-tight">
                Check your inbox
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                If an account exists for{" "}
                <span className="font-semibold text-foreground">{email.trim().toLowerCase()}</span>,
                we&apos;ve sent a password reset link. It expires in one hour.
              </p>
            </div>

            {sent.devResetUrl && (
              <a
                href={sent.devResetUrl}
                className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-muted/50 px-3 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
                  Development helper — no mail server is connected.{" "}
                  <span className="font-semibold text-foreground">Open your reset link</span>
                  <span className="mt-0.5 block truncate font-mono">{sent.devResetUrl}</span>
                </span>
              </a>
            )}

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Didn&apos;t receive anything? Check your spam folder, or try a different email
                address.
              </p>
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl font-semibold"
                onClick={() => {
                  setSent(null);
                  setEmail("");
                }}
              >
                Use a different email
              </Button>
              <Button asChild className="h-11 w-full rounded-xl font-semibold">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard
        title="Forgot your password?"
        description="Enter the email address on your account and we'll send you a link to set a new password."
        footer={
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email">Email address</Label>
            <div className="relative">
              <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="forgot-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError(null);
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "forgot-email-error" : undefined}
                className="h-11 rounded-xl pl-9"
              />
            </div>
            {error && (
              <p id="forgot-email-error" className="text-xs font-medium text-destructive">
                {error}
              </p>
            )}
          </div>

          <Button type="submit" className="h-11 w-full rounded-xl font-semibold" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? "Sending link…" : "Send reset link"}
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
