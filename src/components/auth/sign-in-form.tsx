import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Lock, Mail, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordField } from "@/components/auth/password-field";
import { PhoneOtpForm } from "@/components/auth/phone-otp-form";
import { DemoAccounts } from "@/components/auth/demo-accounts";
import { isEmail } from "@/components/auth/utils";
import { useStore, MfaRequiredError } from "@/context/store";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

type Method = "password" | "otp";

interface SignInErrors {
  email?: string | undefined;
  password?: string | undefined;
}

const METHODS: Array<{ value: Method; label: string; icon: typeof Lock }> = [
  { value: "password", label: "Password", icon: Lock },
  { value: "otp", label: "Phone OTP", icon: Smartphone },
];

/** Email + password sign-in, with a phone OTP alternative. */
export function SignInForm({ defaultMethod = "password" }: { defaultMethod?: Method }) {
  const { login } = useStore();
  const [method, setMethod] = useState<Method>(defaultMethod);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<SignInErrors>({});
  const [pending, setPending] = useState(false);

  useEffect(() => setMethod(defaultMethod), [defaultMethod]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next: SignInErrors = {};
    if (!isEmail(email)) next.email = "Enter a valid email address";
    if (!password) next.password = "Enter your password";
    setErrors(next);
    if (Object.keys(next).length) return;

    setPending(true);
    try {
      const user = await login(email.trim().toLowerCase(), password);
      toast.success(`Welcome back, ${user.name.split(" ")[0] ?? user.name}`);
    } catch (caught) {
      if (!(caught instanceof MfaRequiredError)) toast.error(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
        role="tablist"
        aria-label="Sign-in method"
      >
        {METHODS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={method === value}
            onClick={() => setMethod(value)}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors",
              method === value
                ? "bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {method === "otp" ? (
        <PhoneOtpForm />
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="signin-email">Email address</Label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="signin-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErrors((current) => ({ ...current, email: undefined }));
                  }}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "signin-email-error" : undefined}
                  className="h-11 rounded-xl pl-9"
                />
              </div>
              {errors.email && (
                <p id="signin-email-error" className="text-xs font-medium text-destructive">
                  {errors.email}
                </p>
              )}
            </div>

            <PasswordField
              id="signin-password"
              label="Password"
              value={password}
              onChange={(value) => {
                setPassword(value);
                setErrors((current) => ({ ...current, password: undefined }));
              }}
              error={errors.password}
              action={
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  Forgot password?
                </Link>
              }
            />

            <Button
              type="submit"
              className="h-11 w-full rounded-xl font-semibold"
              disabled={pending}
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <DemoAccounts
            onPick={(demoEmail, demoPassword) => {
              setEmail(demoEmail);
              setPassword(demoPassword);
              setErrors({});
              toast.message("Demo account filled in", { description: demoEmail });
            }}
          />
        </>
      )}
    </div>
  );
}
