import { useState, type FormEvent } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/context/store";
import { errorMessage } from "@/lib/api";

/** Second sign-in step for accounts with two-step sign-in: authenticator or recovery code. */
export function MfaChallenge() {
  const { completeMfa, cancelMfa } = useStore();
  const [useRecovery, setUseRecovery] = useState(false);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code.trim();
    if (useRecovery ? value.replace(/[^a-z0-9]/gi, "").length !== 8 : !/^\d{6}$/.test(value)) {
      toast.error(
        useRecovery ? "Recovery codes look like ABCD-2345" : "Enter the 6-digit code from your app",
      );
      return;
    }
    setSubmitting(true);
    try {
      const user = await completeMfa(value);
      toast.success(`Welcome back, ${user.name.split(" ")[0] ?? user.name}`);
    } catch (caught) {
      toast.error(errorMessage(caught));
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      <div className="space-y-2 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/12 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Two-step sign-in</h1>
        <p className="text-sm text-muted-foreground">
          {useRecovery
            ? "Enter one of the recovery codes you saved when you set up two-step sign-in."
            : "Open your authenticator app and enter the 6-digit code for Smart Deal."}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="mfa-code">{useRecovery ? "Recovery code" : "Authentication code"}</Label>
        <Input
          id="mfa-code"
          autoFocus
          autoComplete="one-time-code"
          inputMode={useRecovery ? "text" : "numeric"}
          maxLength={useRecovery ? 9 : 6}
          placeholder={useRecovery ? "ABCD-2345" : "123456"}
          value={code}
          onChange={(event) =>
            setCode(
              useRecovery
                ? event.target.value.toUpperCase()
                : event.target.value.replace(/\D/g, ""),
            )
          }
          className="h-12 rounded-xl text-center font-mono text-lg tracking-[0.3em]"
        />
      </div>

      <Button type="submit" className="h-11 w-full rounded-xl font-semibold" disabled={submitting}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Verify and sign in
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <button
          type="button"
          className="inline-flex items-center gap-1 font-semibold underline underline-offset-4"
          onClick={() => {
            setUseRecovery((current) => !current);
            setCode("");
          }}
        >
          <KeyRound className="h-3.5 w-3.5" />
          {useRecovery ? "Use my authenticator app" : "Use a recovery code"}
        </button>
        <button
          type="button"
          className="text-muted-foreground underline underline-offset-4"
          onClick={cancelMfa}
        >
          Back to sign in
        </button>
      </div>
    </form>
  );
}
