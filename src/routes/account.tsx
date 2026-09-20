import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { ACCOUNT_TABS, AccountSidebar, AccountTabRow } from "@/components/account/account-nav";
import { AddressesSection } from "@/components/account/addresses-section";
import { NotificationsSection } from "@/components/account/notifications-section";
import { OrdersSection } from "@/components/account/orders-section";
import { OverviewSection } from "@/components/account/overview-section";
import { SettingsSection } from "@/components/account/settings-section";
import { SupportSection } from "@/components/account/support-section";
import { WalletSection } from "@/components/account/wallet-section";
import { PageLoader } from "@/components/common/page-loader";
import { Breadcrumbs, PageContainer, SiteLayout } from "@/components/layout/site-layout";
import { Button } from "@/components/ui/button";
import { useStore } from "@/context/store";
import { useNotifications } from "@/hooks/use-notifications";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { initials } from "@/lib/format";
import { searchString } from "@/lib/search-params";

export const Route = createFileRoute("/account")({
  validateSearch: (search: Record<string, unknown>): { tab?: string | undefined } => ({
    tab: searchString(search["tab"]),
  }),
  head: () => ({ meta: [{ title: "My account | Smart Deal" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { ready, allowed, user } = useRequireAuth();
  const { logout } = useStore();
  const { unreadCount } = useNotifications();

  const active = tab && ACCOUNT_TABS.some((entry) => entry.value === tab) ? tab : "overview";

  const changeTab = (next: string) => {
    void navigate({ to: "/account", search: (prev) => ({ ...prev, tab: next }) });
  };

  if (!ready) {
    return (
      <SiteLayout>
        <PageLoader />
      </SiteLayout>
    );
  }

  if (!allowed || !user) {
    return (
      <SiteLayout>
        <PageLoader label="Taking you to sign in…" />
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <PageContainer className="py-6 lg:py-10">
        <Breadcrumbs>
          {[
            <Link key="home" to="/">
              Home
            </Link>,
            "My account",
          ]}
        </Breadcrumbs>

        <div className="mt-5 grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)] lg:gap-8">
          <div className="hidden lg:block">
            <div className="sticky top-28 space-y-3">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">
                    {initials(user.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 h-9 w-full rounded-xl font-semibold"
                  onClick={() => void logout()}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </Button>
              </div>

              <AccountSidebar
                active={active}
                onChange={changeTab}
                unreadCount={unreadCount}
                className="static"
              />
            </div>
          </div>

          <div className="min-w-0 space-y-5">
            <AccountTabRow active={active} onChange={changeTab} unreadCount={unreadCount} />

            {active === "overview" && <OverviewSection user={user} onTabChange={changeTab} />}
            {active === "orders" && <OrdersSection />}
            {active === "addresses" && <AddressesSection user={user} />}
            {active === "wallet" && <WalletSection user={user} />}
            {active === "support" && <SupportSection user={user} />}
            {active === "notifications" && <NotificationsSection />}
            {active === "settings" && <SettingsSection user={user} />}
          </div>
        </div>
      </PageContainer>
    </SiteLayout>
  );
}
