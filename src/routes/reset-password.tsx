import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, AuthShell } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrength } from "@/components/auth/password-strength";
import { isStrongPassword } from "@/components/auth/utils";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api";
import { searchString } from "@/lib/search-params";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (search: Record<string, unknown>): { token?: string | undefined } => ({
    token: searchString(search["token"]),
  }),
  head: () => ({ meta: [{ title: "Reset password | Smart Deal" }] }),
  component: ResetPasswordPage,
});

interface ResetErrors {
  password?: string | undefined;
  confirm?: string | undefined;
}

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<ResetErrors>({});
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next: ResetErrors = {};
    if (!isStrongPassword(password))
      next.password = "Your password doesn't meet all five rules yet";
    if (confirm !== password) next.confirm = "Passwords don't match";
    setErrors(next);
    if (Object.keys(next).length) return;

    setPending(true);
    try {
      await api("/auth/reset-password", { method: "POST", body: { token, password } });
      setDone(true);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <AuthShell>
        <AuthCard>
          <div className="space-y-5 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/12 text-destructive">
              <TriangleAlert className="h-6 w-6" />
            </span>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-extrabold tracking-tight">
                This reset link is invalid
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                The link is missing its security token. Reset links expire after one hour, so please
                request a fresh one.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Button asChild className="h-11 w-full rounded-xl font-semibold">
                <Link to="/forgot-password">Request a new link</Link>
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

  if (done) {
    return (
      <AuthShell>
        <AuthCard>
          <div className="space-y-5 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/12 text-success">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-extrabold tracking-tight">
                Password updated
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Your new password is ready. For your security we signed out every other device.
              </p>
            </div>
            <Button asChild className="h-11 w-full rounded-xl font-semibold">
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthCard
        title="Set a new password"
        description="Choose a password you haven't used before. You'll be signed out of other devices."
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <PasswordField
            id="reset-password"
            label="New password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              setErrors((current) => ({ ...current, password: undefined }));
            }}
            error={errors.password}
            autoComplete="new-password"
          />
          <PasswordStrength password={password} />

          <PasswordField
            id="reset-confirm"
            label="Confirm new password"
            value={confirm}
            onChange={(value) => {
              setConfirm(value);
              setErrors((current) => ({ ...current, confirm: undefined }));
            }}
            error={errors.confirm}
            autoComplete="new-password"
          />

          <Button type="submit" className="h-11 w-full rounded-xl font-semibold" disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {pending ? "Updating…" : "Update password"}
          </Button>
        </form>
      </AuthCard>
    </AuthShell>
  );
}
