import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { LogOut, Store, User as UserIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeDropdown } from "@/components/layout/theme-dropdown";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/context/store";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number | undefined;
  group?: string | undefined;
}

/** Shared chrome for the seller and admin dashboards: top bar, section nav, content area. */
export function DashboardShell({
  eyebrow,
  title,
  nav,
  activeTab,
  onTabChange,
  actions,
  children,
}: {
  eyebrow: string;
  title: string;
  nav: DashboardNavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, logout } = useStore();
  const groups = [...new Set(nav.map((item) => item.group ?? ""))];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-4">
          <Logo showWordmark={false} />
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
              {eyebrow}
            </p>
            <h1 className="truncate font-display text-sm leading-none font-bold">{title}</h1>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {actions}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden rounded-xl font-semibold sm:inline-flex"
            >
              <Link to="/">
                <Store className="mr-1.5 h-4 w-4" /> View store
              </Link>
            </Button>
            <ThemeDropdown showLabel={false} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-xl"
                  aria-label="Account menu"
                >
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                    {initials(user?.name)}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate font-semibold">{user?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                  <Link to="/account">
                    <UserIcon className="mr-2 h-4 w-4" /> My account
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer rounded-lg sm:hidden">
                  <Link to="/">
                    <Store className="mr-2 h-4 w-4" /> View store
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void logout()}
                  className="cursor-pointer rounded-lg text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Section navigation — scrollable row on small screens */}
        <div className="rail-scroll flex gap-1 overflow-x-auto border-t border-border px-2 py-2 lg:hidden">
          {nav.map((item) => (
            <NavButton
              key={item.id}
              item={item}
              active={item.id === activeTab}
              onClick={() => onTabChange(item.id)}
              compact
            />
          ))}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-card p-3 lg:block">
          {groups.map((group) => (
            <div key={group} className="mb-4">
              {group && (
                <p className="px-3 pb-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  {group}
                </p>
              )}
              <div className="space-y-0.5">
                {nav
                  .filter((item) => (item.group ?? "") === group)
                  .map((item) => (
                    <NavButton
                      key={item.id}
                      item={item}
                      active={item.id === activeTab}
                      onClick={() => onTabChange(item.id)}
                    />
                  ))}
              </div>
            </div>
          ))}
        </aside>

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
  compact = false,
}: {
  item: DashboardNavItem;
  active: boolean;
  onClick: () => void;
  compact?: boolean;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-xl text-sm font-semibold transition-colors",
        compact ? "shrink-0 px-3 py-1.5 text-[13px]" : "w-full px-3 py-2",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={cn(compact ? "whitespace-nowrap" : "truncate")}>{item.label}</span>
      {item.badge ? (
        <span
          className={cn(
            "ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold",
            active ? "bg-background/20 text-background" : "bg-primary text-primary-foreground",
          )}
        >
          {item.badge > 99 ? "99+" : item.badge}
        </span>
      ) : null}
    </button>
  );
}

/** Card wrapper for dashboard sections. */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string | undefined;
  bodyClassName?: string | undefined;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card shadow-soft", className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="font-display text-base font-bold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Horizontal scroll container for dashboard tables. */
export function TableScroll({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("-mx-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}
