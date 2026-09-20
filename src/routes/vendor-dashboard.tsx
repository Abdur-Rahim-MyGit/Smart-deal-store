import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, ClipboardList, Package, Star, Store, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageLoader } from "@/components/common/page-loader";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { api } from "@/lib/api";
import { searchString } from "@/lib/search-params";
import { OverviewTab } from "@/components/vendor/overview-tab";
import { ProductsTab } from "@/components/vendor/products-tab";
import { OrdersTab } from "@/components/vendor/orders-tab";
import { PayoutsTab } from "@/components/vendor/payouts-tab";
import { ReviewsTab } from "@/components/vendor/reviews-tab";
import { StoreTab } from "@/components/vendor/store-tab";
import type { VendorDashboardResponse, VendorTabId } from "@/components/vendor/types";

export const Route = createFileRoute("/vendor-dashboard")({
  validateSearch: (search: Record<string, unknown>): { tab?: string | undefined } => ({
    tab: searchString(search["tab"]),
  }),
  head: () => ({ meta: [{ title: "Seller dashboard | Smart Deal" }] }),
  component: VendorDashboardPage,
});

interface VendorTabDefinition {
  id: VendorTabId;
  label: string;
  icon: LucideIcon;
  group: string;
  badge?: (data: VendorDashboardResponse) => number | undefined;
}

const TABS: VendorTabDefinition[] = [
  { id: "overview", label: "Dashboard", icon: BarChart3, group: "Overview" },
  {
    id: "products",
    label: "Products",
    icon: Package,
    group: "Selling",
    badge: (data) => data.stats.products["Pending Approval"],
  },
  {
    id: "orders",
    label: "Orders",
    icon: ClipboardList,
    group: "Selling",
    badge: (data) => data.stats.pendingFulfilment,
  },
  { id: "payouts", label: "Payouts", icon: Wallet, group: "Finance" },
  { id: "reviews", label: "Reviews", icon: Star, group: "Customers" },
  { id: "store", label: "Store settings", icon: Store, group: "Account" },
];

function VendorDashboardPage() {
  const { ready, allowed } = useRequireAuth(["Vendor"]);
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/vendor-dashboard" });
  const [lowStockPreset, setLowStockPreset] = useState(false);

  const { data } = useQuery({
    queryKey: ["vendor-dashboard"],
    queryFn: () => api<VendorDashboardResponse>("/vendors/dashboard"),
    enabled: allowed,
    staleTime: 60_000,
  });

  if (!ready || !allowed) return <PageLoader label="Checking your seller access…" />;

  const activeId: VendorTabId = TABS.some((entry) => entry.id === tab)
    ? (tab as VendorTabId)
    : "overview";

  const go = (next: VendorTabId, options?: { lowStock?: boolean | undefined }) => {
    setLowStockPreset(Boolean(options?.lowStock));
    void navigate({ search: (previous) => ({ ...previous, tab: next }) });
  };

  return (
    <DashboardShell
      eyebrow="Smart Deal"
      title="Seller centre"
      activeTab={activeId}
      onTabChange={(id) => go(id as VendorTabId)}
      nav={TABS.map((entry) => ({
        id: entry.id,
        label: entry.label,
        icon: entry.icon,
        group: entry.group,
        badge: data ? entry.badge?.(data) : undefined,
      }))}
    >
      {activeId === "products" ? (
        <ProductsTab onNavigate={go} initialLowStock={lowStockPreset} />
      ) : activeId === "orders" ? (
        <OrdersTab />
      ) : activeId === "payouts" ? (
        <PayoutsTab onNavigate={go} />
      ) : activeId === "reviews" ? (
        <ReviewsTab />
      ) : activeId === "store" ? (
        <StoreTab />
      ) : (
        <OverviewTab onNavigate={go} />
      )}
    </DashboardShell>
  );
}
