import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Numbered checkout step card (delivery address, delivery option, payment). */
export function StepSection({
  step,
  title,
  description,
  action,
  children,
  className,
}: {
  step: number;
  title: string;
  description?: string | undefined;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = `checkout-step-${step}`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn("rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground"
          >
            {step}
          </span>
          <div className="min-w-0">
            <h2 id={headingId} className="font-display text-lg font-extrabold">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="mt-5">{children}</div>
    </section>
  );
}
