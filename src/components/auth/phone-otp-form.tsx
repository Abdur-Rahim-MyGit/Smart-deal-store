import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Loader2, MessageSquareLock, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { isUaePhone, normalizePhone } from "@/components/auth/utils";
import { useStore, MfaRequiredError } from "@/context/store";
import { errorMessage } from "@/lib/api";

const RESEND_SECONDS = 60;

/** Sign in with a UAE mobile number and a 6-digit SMS code. */
export function PhoneOtpForm() {
  const { sendOtp, verifyOtp } = useStore();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function requestCode(nextPhone: string) {
    setSending(true);
    setError(null);
    try {
      const response = await sendOtp(normalizePhone(nextPhone));
      setDevCode(response.devCode ?? null);
      setCountdown(response.cooldownSeconds ?? RESEND_SECONDS);
      setStep("code");
      setCode("");
      verifiedRef.current = false;
      toast.success("Code sent", {
        description: `We texted a 6-digit code to ${normalizePhone(nextPhone)}`,
      });
    } catch (caught) {
      const message = errorMessage(caught);
      setError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  }

  function handlePhoneSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isUaePhone(phone)) {
      setError("Enter a UAE mobile number, e.g. 050 123 4567");
      return;
    }
    void requestCode(phone);
  }

  async function submitCode(value: string) {
    if (verifiedRef.current) return;
    verifiedRef.current = true;
    setVerifying(true);
    setError(null);
    try {
      await verifyOtp(normalizePhone(phone), value);
    } catch (caught) {
      if (caught instanceof MfaRequiredError) return;
      const message = errorMessage(caught);
      setError(message);
      toast.error(message);
      setCode("");
      verifiedRef.current = false;
    } finally {
      setVerifying(false);
    }
  }

  if (step === "phone") {
    return (
      <form onSubmit={handlePhoneSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="otp-phone">Mobile number</Label>
          <div className="relative">
            <Smartphone className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="otp-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="050 123 4567"
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "otp-phone-error" : "otp-phone-hint"}
              className="h-11 rounded-xl pl-9"
            />
          </div>
          {error ? (
            <p id="otp-phone-error" className="text-xs font-medium text-destructive">
              {error}
            </p>
          ) : (
            <p id="otp-phone-hint" className="text-xs text-muted-foreground">
              We&apos;ll text you a 6-digit code. Only numbers already registered with Smart Deal
              can sign in this way.
            </p>
          )}
        </div>

        <Button type="submit" className="h-11 w-full rounded-xl font-semibold" disabled={sending}>
          {sending && <Loader2 className="h-4 w-4 animate-spin" />}
          {sending ? "Sending code…" : "Send code"}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => {
          setStep("phone");
          setError(null);
          setDevCode(null);
        }}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Use a different number
      </button>

      <div className="space-y-1">
        <p className="text-sm font-semibold">Enter the 6-digit code</p>
        <p className="text-xs text-muted-foreground">
          Sent to <span className="font-semibold text-foreground">{normalizePhone(phone)}</span> ·
          valid for 2 minutes
        </p>
      </div>

      <div className="flex justify-center py-1">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(value) => {
            setCode(value);
            setError(null);
            if (value.length === 6) void submitCode(value);
          }}
          disabled={verifying}
          aria-label="One-time code"
        >
          <InputOTPGroup className="gap-2">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <InputOTPSlot
                key={index}
                index={index}
                className="h-12 w-11 rounded-xl border border-input text-base font-semibold first:rounded-l-xl last:rounded-r-xl"
              />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error && (
        <p className="text-center text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}

      {devCode && (
        <div className="flex items-start gap-2 rounded-xl border border-dashed border-border bg-muted/50 px-3 py-2.5">
          <MessageSquareLock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Development helper — no SMS gateway is connected, so your code is{" "}
            <span className="font-mono font-bold tracking-widest text-foreground">{devCode}</span>
          </p>
        </div>
      )}

      <Button
        type="button"
        className="h-11 w-full rounded-xl font-semibold"
        disabled={verifying || code.length !== 6}
        onClick={() => void submitCode(code)}
      >
        {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
        {verifying ? "Verifying…" : "Verify & sign in"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        {countdown > 0 ? (
          <>
            Didn&apos;t get it? Resend in{" "}
            <span className="font-semibold tabular-nums text-foreground">{countdown}s</span>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void requestCode(phone)}
            disabled={sending}
            className="font-semibold text-foreground underline underline-offset-4 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Resend code"}
          </button>
        )}
      </p>
    </div>
  );
}
