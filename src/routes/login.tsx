import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowRight, Clock3, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AuthCard, AuthDivider, AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";
import { RegisterForm } from "@/components/auth/register-form";
import { GoogleSignInButton } from "@/components/auth/google-button";
import { MfaChallenge } from "@/components/auth/mfa-challenge";
import { resolveRedirect } from "@/components/auth/utils";
import { PageLoader } from "@/components/common/page-loader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/context/store";
import { useSettings } from "@/hooks/use-settings";
import { searchString } from "@/lib/search-params";
import type { User } from "@/lib/types";

export interface LoginSearch {
  redirect?: string | undefined;
  mode?: "register" | "otp" | undefined;
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => {
    const mode = searchString(search["mode"]);
    return {
      redirect: searchString(search["redirect"]),
      mode: mode === "register" || mode === "otp" ? mode : undefined,
    };
  },
  head: () => ({ meta: [{ title: "Sign in | Smart Deal" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect, mode } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const { hydrated, user, mfaPending } = useStore();
  const settings = useSettings();

  // A new seller stays on this page to read the "under review" note instead of
  // being thrown straight into an empty dashboard.
  const [sellerPending, setSellerPending] = useState<User | null>(null);

  useEffect(() => {
    if (!hydrated || !user || sellerPending) return;
    router.history.replace(resolveRedirect(redirect, user.role));
  }, [hydrated, user, sellerPending, redirect, router]);

  function handleRegistered(created: User) {
    if (created.role === "Vendor") {
      setSellerPending(created);
      return;
    }
    toast.success(`Welcome to Smart Deal, ${created.name.split(" ")[0] ?? created.name}!`, {
      description: "Check your inbox to verify your email address.",
    });
  }

  if (sellerPending) {
    return (
      <AuthShell>
        <AuthCard>
          <div className="space-y-5 text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Clock3 className="h-6 w-6" />
            </span>
            <div className="space-y-2">
              <h1 className="font-display text-2xl font-extrabold tracking-tight">
                Your application is under review
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Thanks, {sellerPending.name.split(" ")[0] ?? sellerPending.name}. Our team is
                checking{" "}
                <span className="font-semibold text-foreground">
                  {sellerPending.vendorDetails?.businessName ?? "your business"}
                </span>{" "}
                and your trade licence. Most applications are approved within 1–2 business days, and
                we&apos;ll email you as soon as your storefront can go live.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-muted/40 p-3 text-left">
              <p className="text-xs leading-relaxed text-muted-foreground">
                In the meantime you can sign in to your seller dashboard to prepare product drafts —
                they&apos;ll be published once your account is approved.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                className="h-11 w-full rounded-xl font-semibold"
                onClick={() => router.history.replace("/vendor-dashboard")}
              >
                Go to seller dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-11 w-full rounded-xl font-semibold"
                onClick={() => router.history.replace("/")}
              >
                Browse the marketplace
              </Button>
            </div>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  if (hydrated && user) {
    return (
      <AuthShell>
        <PageLoader label="Taking you to your account…" />
      </AuthShell>
    );
  }

  if (mfaPending) {
    return (
      <AuthShell>
        <AuthCard>
          <MfaChallenge />
        </AuthCard>
      </AuthShell>
    );
  }

  const tab = mode === "register" ? "register" : "signin";

  const changeTab = (value: string) => {
    void navigate({
      to: "/login",
      search: {
        ...(redirect ? { redirect } : {}),
        ...(value === "register" ? { mode: "register" as const } : {}),
      },
      replace: true,
    });
  };

  return (
    <AuthShell split>
      <AuthCard>
        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl p-1">
            <TabsTrigger value="signin" className="h-9 rounded-lg text-sm font-semibold">
              Sign in
            </TabsTrigger>
            <TabsTrigger value="register" className="h-9 rounded-lg text-sm font-semibold">
              Create account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <h1 className="font-display text-2xl font-extrabold tracking-tight">Welcome back</h1>
              <p className="text-sm text-muted-foreground">
                Sign in to track orders, manage addresses and spend your wallet.
              </p>
            </div>
            <SignInForm defaultMethod={mode === "otp" ? "otp" : "password"} />
          </TabsContent>

          <TabsContent value="register" className="mt-6 space-y-5">
            <div className="space-y-1.5">
              <h1 className="font-display text-2xl font-extrabold tracking-tight">
                Create your account
              </h1>
              <p className="text-sm text-muted-foreground">
                Shop across thousands of verified sellers — or apply to sell on Smart Deal.
              </p>
            </div>
            <RegisterForm onRegistered={handleRegistered} />
          </TabsContent>
        </Tabs>

        {settings.googleClientId && (
          <div className="mt-6 space-y-4">
            <AuthDivider label="or continue with" />
            <GoogleSignInButton clientId={settings.googleClientId} />
          </div>
        )}

        <p className="mt-6 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Your details are encrypted in transit and never shared with sellers. We only use your
          mobile number for order updates and sign-in codes.
        </p>
      </AuthCard>
    </AuthShell>
  );
}
