import { Link } from "@tanstack/react-router";
import { ArrowRight, LineChart, Store, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

const POINTS = [
  { icon: Store, label: "List in minutes", note: "Guided catalogue tools" },
  { icon: Wallet, label: "Weekly payouts", note: "Straight to your UAE bank" },
  { icon: LineChart, label: "Live analytics", note: "Sales, stock and reviews" },
];

/** Invitation for UAE businesses to sell on the marketplace. */
export function SellerCta() {
  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-ink text-ink-foreground shadow-soft">
      <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="space-y-4">
          <span className="inline-block rounded-full bg-primary px-3 py-1 text-[11px] font-bold tracking-wide text-primary-foreground uppercase">
            Sell on Smart Deal
          </span>
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
            Reach shoppers in all seven emirates
          </h2>
          <p className="max-w-lg text-sm opacity-80 sm:text-base">
            Join the trade-licensed sellers growing with Smart Deal. We handle discovery, payments
            and customer support — you focus on great products.
          </p>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Button asChild size="lg" className="rounded-xl font-bold">
              <Link to="/pages/$slug" params={{ slug: "sell-on-smart-deal" }}>
                Start selling <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-xl border-white/25 bg-transparent font-bold text-ink-foreground hover:bg-white/10 hover:text-ink-foreground"
            >
              <Link to="/login" search={{ mode: "register" }}>
                Create a seller account
              </Link>
            </Button>
          </div>
        </div>

        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {POINTS.map(({ icon: Icon, label, note }) => (
            <li key={label} className="flex items-start gap-3 rounded-2xl bg-white/10 p-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-sm font-bold">{label}</span>
                <span className="block text-xs opacity-75">{note}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
