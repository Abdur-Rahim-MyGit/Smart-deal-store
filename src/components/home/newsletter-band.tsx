import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Enter your email address" })
    .email({ message: "That doesn't look like a valid email" })
    .max(255, { message: "Email must be under 255 characters" }),
});

type FormValues = z.infer<typeof schema>;

/** Newsletter signup plus app-download band. */
export function NewsletterBand() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  function onSubmit(values: FormValues) {
    toast.success("You're on the list", {
      description: `Deal drops will land in ${values.email} every Thursday.`,
    });
    reset();
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="brand-gradient rounded-3xl p-6 text-ink sm:p-8">
        <h2 className="font-display text-2xl font-extrabold">Get the deals before they sell out</h2>
        <p className="mt-2 max-w-md text-sm font-medium opacity-80">
          One email a week: flash windows, restocks and the price drops actually worth your time.
        </p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 max-w-md" noValidate>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="email"
              placeholder="you@example.com"
              aria-label="Email address"
              aria-invalid={Boolean(errors.email)}
              className="h-11 rounded-xl border-transparent bg-card"
              {...register("email")}
            />
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 rounded-xl bg-ink font-bold text-ink-foreground hover:bg-ink/90"
            >
              Subscribe
            </Button>
          </div>
          {errors.email && (
            <p className="mt-2 text-sm font-semibold text-destructive">{errors.email.message}</p>
          )}
        </form>
      </div>

      <div className="flex flex-col justify-center gap-3 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent">
          <Smartphone className="h-5 w-5 text-accent-foreground" />
        </span>
        <h2 className="font-display text-xl font-extrabold">Shop on the Smart Deal app</h2>
        <p className="text-sm text-muted-foreground">
          Install Smart Deal to your home screen for order tracking, saved carts and deal alerts.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl font-semibold">
            Add to home screen
          </Button>
          <Button variant="ghost" className="rounded-xl font-semibold">
            Learn more
          </Button>
        </div>
      </div>
    </section>
  );
}
