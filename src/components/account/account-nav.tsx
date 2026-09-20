import {
  Bell,
  LayoutDashboard,
  LifeBuoy,
  MapPin,
  Package,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccountTab {
  value: string;
  label: string;
  icon: LucideIcon;
}

export const ACCOUNT_TABS: AccountTab[] = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "orders", label: "Orders", icon: Package },
  { value: "addresses", label: "Addresses", icon: MapPin },
  { value: "wallet", label: "Wallet", icon: Wallet },
  { value: "support", label: "Support", icon: LifeBuoy },
  { value: "notifications", label: "Notifications", icon: Bell },
  { value: "settings", label: "Settings", icon: Settings },
];

export const isAccountTab = (value: string | undefined): boolean =>
  ACCOUNT_TABS.some((tab) => tab.value === value);

function Count({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
      {value > 99 ? "99+" : value}
    </span>
  );
}

/** Desktop sidebar navigation. */
export function AccountSidebar({
  active,
  onChange,
  unreadCount = 0,
  className,
}: {
  active: string;
  onChange: (tab: string) => void;
  unreadCount?: number;
  className?: string;
}) {
  return (
    <nav aria-label="Account sections" className={cn("sticky top-28", className)}>
      <ul className="space-y-1 rounded-2xl border border-border bg-card p-2 shadow-soft">
        {ACCOUNT_TABS.map(({ value, label, icon: Icon }) => (
          <li key={value}>
            <button
              type="button"
              onClick={() => onChange(value)}
              aria-current={active === value ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                active === value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {value === "notifications" && <Count value={unreadCount} />}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Horizontally scrollable tab row used below the large breakpoint. */
export function AccountTabRow({
  active,
  onChange,
  unreadCount = 0,
}: {
  active: string;
  onChange: (tab: string) => void;
  unreadCount?: number;
}) {
  return (
    <div className="rail-scroll -mx-4 overflow-x-auto px-4 lg:hidden">
      <div role="tablist" aria-label="Account sections" className="flex w-max gap-2 pb-1">
        {ACCOUNT_TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active === value}
            onClick={() => onChange(value)}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
              active === value
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:bg-accent",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {value === "notifications" && <Count value={unreadCount} />}
          </button>
        ))}
      </div>
    </div>
  );
}
