import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Email capture band wired to POST /public/newsletter. */
export function NewsletterBand() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const subscribe = useMutation({
    mutationFn: (value: string) =>
      api("/public/newsletter", { method: "POST", body: { email: value } }),
    onError: (mutationError) => toast.error(errorMessage(mutationError)),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!EMAIL_PATTERN.test(value)) {
      setError("Enter a valid email address");
      return;
    }
    setError(null);
    subscribe.mutate(value);
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-soft">
      <div className="grid gap-6 p-6 sm:p-10 lg:grid-cols-[1fr_1fr] lg:items-center">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-[11px] font-bold tracking-wide text-accent-foreground uppercase">
            <Mail className="h-3.5 w-3.5" /> Newsletter
          </span>
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Deals worth opening</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            One email a week: the drops, restocks and price cuts our team would actually buy.
            Unsubscribe anytime.
          </p>
        </div>

        {subscribe.isSuccess ? (
          <div
            className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success/10 p-5"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="text-sm font-bold">You're on the list</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                We've saved {email.trim()}. Look out for this week's edit in your inbox.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-2">
            <label htmlFor="newsletter-email" className="block text-sm font-semibold">
              Email address
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="newsletter-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "newsletter-error" : undefined}
                className="h-11 rounded-xl sm:flex-1"
              />
              <Button
                type="submit"
                disabled={subscribe.isPending}
                className="h-11 rounded-xl px-6 font-bold"
              >
                {subscribe.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Subscribe
              </Button>
            </div>
            {error && (
              <p id="newsletter-error" className="text-xs font-semibold text-destructive">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
