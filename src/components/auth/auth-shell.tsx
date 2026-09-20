import type { ReactNode } from "react";
import { BadgeCheck, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { PageContainer, SiteLayout } from "@/components/layout/site-layout";
import { cn } from "@/lib/utils";

const HIGHLIGHTS = [
  {
    icon: Truck,
    title: "Free delivery over AED 150",
    body: "Dispatched within 24 hours across all seven emirates.",
  },
  {
    icon: RotateCcw,
    title: "14-day easy returns",
    body: "Changed your mind? Refunds land straight in your wallet.",
  },
  {
    icon: ShieldCheck,
    title: "Protected payments",
    body: "Cash on delivery, cards and wallet — all secured.",
  },
  {
    icon: BadgeCheck,
    title: "Licence-checked sellers",
    body: "Every seller is verified before a single product goes live.",
  },
];

/** Marketing panel shown beside the sign-in card on large screens. */
export function AuthBrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden rounded-2xl border border-border bg-card p-8 shadow-soft lg:flex lg:flex-col xl:p-10">
      <div className="brand-gradient pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full opacity-40 blur-3xl" />

      <div className="relative flex flex-1 flex-col">
        <Logo />

        <h2 className="mt-8 font-display text-3xl font-extrabold tracking-tight text-balance xl:text-4xl">
          The UAE marketplace for beauty, tech &amp; everyday essentials.
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          One account for tracking orders, saved addresses, wallet refunds and support — across
          thousands of verified sellers.
        </p>

        <ul className="mt-8 space-y-4">
          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span className="leading-snug">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-muted-foreground">{body}</span>
              </span>
            </li>
          ))}
        </ul>

        <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-border pt-6">
          {[
            { value: "7", label: "Emirates served" },
            { value: "1,200+", label: "Verified sellers" },
            { value: "4.8★", label: "Average rating" },
          ].map((stat) => (
            <div key={stat.label}>
              <dt className="font-display text-xl font-bold">{stat.value}</dt>
              <dd className="text-[11px] text-muted-foreground">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}

/** Page frame for every auth screen: centred card, or split with the brand panel. */
export function AuthShell({ children, split = false }: { children: ReactNode; split?: boolean }) {
  return (
    <SiteLayout>
      <PageContainer className="py-8 sm:py-12 lg:py-16">
        {split ? (
          <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_minmax(0,460px)] lg:gap-12">
            <AuthBrandPanel />
            <div className="w-full">{children}</div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-md">{children}</div>
        )}
      </PageContainer>
    </SiteLayout>
  );
}

export function AuthCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-7", className)}
    >
      {(title || description) && (
        <div className="mb-6 space-y-1.5">
          {title && (
            <h1 className="font-display text-2xl font-extrabold tracking-tight">{title}</h1>
          )}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
      {footer && <div className="mt-6 border-t border-border pt-5">{footer}</div>}
    </div>
  );
}

/** "or" rule used between the form and the Google button. */
export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
