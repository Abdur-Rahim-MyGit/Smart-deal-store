import { BadgeCheck, Banknote, RotateCcw, Truck } from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { formatPrice } from "@/lib/format";

/** Four reassurance points driven by live store settings. */
export function TrustStrip() {
  const settings = useSettings();
  const home =
    settings.shippingMatrix.find((rule) => rule.emirate === "Dubai") ?? settings.shippingMatrix[0];

  const items = [
    {
      icon: Truck,
      title: home
        ? `Free delivery over ${formatPrice(home.freeThreshold)} in ${home.emirate}`
        : "UAE-wide delivery",
      note: home ? home.eta : "All seven emirates",
    },
    {
      icon: Banknote,
      title: settings.codEnabled ? "Cash on delivery" : "Secure online payment",
      note: settings.codEnabled
        ? `Pay when it arrives · ${formatPrice(settings.codFee)} fee`
        : "Card & wallet accepted",
    },
    {
      icon: RotateCcw,
      title: `${settings.returnWindowDays}-day returns`,
      note: "Free pickup on eligible items",
    },
    {
      icon: BadgeCheck,
      title: "Verified UAE sellers",
      note: "Trade-licensed, quality checked",
    },
  ];

  return (
    <section
      aria-label="Why shop with us"
      className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
    >
      {items.map(({ icon: Icon, title, note }) => (
        <div
          key={title}
          className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft sm:p-4"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] leading-snug font-bold sm:text-sm">{title}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{note}</span>
          </span>
        </div>
      ))}
    </section>
  );
}
