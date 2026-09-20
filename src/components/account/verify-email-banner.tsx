import { useState } from "react";
import { ExternalLink, Loader2, MailWarning } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import { api, errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Asks a signed-in customer to confirm their email, with resend and "I've verified" actions. */
export function VerifyEmailBanner({
  email,
  reason,
  className,
}: {
  email: string;
  reason: string;
  className?: string | undefined;
}) {
  const { refreshUser } = useStore();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);

  async function resend() {
    setResending(true);
    try {
      const response = await api<{ message: string; devVerifyUrl?: string }>(
        "/auth/verify-email/resend",
        { method: "POST" },
      );
      setVerifyUrl(response.devVerifyUrl ?? null);
      toast.success(response.message || "Verification email sent");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setResending(false);
    }
  }

  // Picks up a verification completed in another tab or on another device.
  async function recheck() {
    setChecking(true);
    try {
      await refreshUser();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className={cn("rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4", className)}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <MailWarning className="h-4 w-4" />
        </span>
        <div className="min-w-[200px] flex-1">
          <p className="text-sm font-bold">Confirm your email address</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            We sent a verification link to{" "}
            <span className="font-semibold text-foreground">{email}</span>. {reason}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-xl font-semibold"
            onClick={() => void recheck()}
            disabled={checking}
          >
            {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            I&apos;ve verified
          </Button>
          <Button
            size="sm"
            className="h-9 rounded-xl font-semibold"
            onClick={() => void resend()}
            disabled={resending}
          >
            {resending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {resending ? "Sending…" : "Resend email"}
          </Button>
        </div>
      </div>
      {verifyUrl && (
        <a
          href={verifyUrl}
          className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-border bg-card px-3 py-2 transition-colors hover:bg-accent"
        >
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
            Development helper —{" "}
            <span className="font-semibold text-foreground">open your verification link</span>
            <span className="mt-0.5 block truncate font-mono">{verifyUrl}</span>
          </span>
        </a>
      )}
    </div>
  );
}
