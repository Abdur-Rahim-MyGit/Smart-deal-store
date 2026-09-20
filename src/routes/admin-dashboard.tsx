import type { ComponentType } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Box,
  ClipboardList,
  Eye,
  FileText,
  FolderTree,
  Image,
  LifeBuoy,
  Mail,
  Megaphone,
  RotateCcw,
  ScrollText,
  Settings,
  ShieldCheck,
  Star,
  Store,
  Tags,
  Ticket,
  Users,
  UserCog,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageLoader } from "@/components/common/page-loader";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { ApiError, api } from "@/lib/api";
import { searchString } from "@/lib/search-params";
import type { AdminPermission, User } from "@/lib/types";
import { OverviewTab } from "@/components/admin/overview-tab";
import { OrdersTab } from "@/components/admin/orders-tab";
import { ReturnsTab } from "@/components/admin/returns-tab";
import { ProductsTab } from "@/components/admin/products-tab";
import { CategoriesTab } from "@/components/admin/categories-tab";
import { BrandsTab } from "@/components/admin/brands-tab";
import { ReviewsTab } from "@/components/admin/reviews-tab";
import { CustomersTab } from "@/components/admin/customers-tab";
import { VendorsTab } from "@/components/admin/vendors-tab";
import { StaffTab } from "@/components/admin/staff-tab";
import { CouponsTab } from "@/components/admin/coupons-tab";
import { BannersTab } from "@/components/admin/banners-tab";
import { PagesTab } from "@/components/admin/pages-tab";
import { SubscribersTab } from "@/components/admin/subscribers-tab";
import { PayoutsTab } from "@/components/admin/payouts-tab";
import { TicketsTab } from "@/components/admin/tickets-tab";
import { MessagesTab } from "@/components/admin/messages-tab";
import { SettingsTab } from "@/components/admin/settings-tab";
import { AuditTab } from "@/components/admin/audit-tab";
import { SecurityTab } from "@/components/admin/security-tab";
import { NotificationsTab } from "@/components/admin/notifications-tab";

export interface AdminSearch {
  tab?: string | undefined;
  status?: string | undefined;
}

export const Route = createFileRoute("/admin-dashboard")({
  validateSearch: (search: Record<string, unknown>): AdminSearch => ({
    tab: searchString(search["tab"]),
    status: searchString(search["status"]),
  }),
  head: () => ({ meta: [{ title: "Admin console | Smart Deal" }] }),
  component: AdminDashboardPage,
});

/** Counts shown as badges next to the console sections. */
export interface AdminDashboardStats {
  /** Money figures are left out for staff without the orders or finance permission. */
  gmv?: number | undefined;
  revenueOrders?: number | undefined;
  totalOrders?: number | undefined;
  averageOrderValue?: number | undefined;
  vatCollected?: number | undefined;
  shippingCollected?: number | undefined;
  discountsGiven?: number | undefined;
  commissionEarned?: number | undefined;
  refundsIssued?: number | undefined;
  refundCount?: number | undefined;
  customers: number;
  newCustomers: number;
  activeVendors: number;
  pendingVendors: number;
  products: Record<string, number>;
  pendingProducts: number;
  pendingReviews: number;
  openTickets: number;
  pendingPayouts: number;
  newMessages: number;
  returnRequests: number;
  awaitingFulfilment: number;
}

interface AdminTabDefinition {
  id: string;
  label: string;
  icon: LucideIcon;
  group: string;
  /** Required admin permission; "super" means super admins only. */
  permission?: AdminPermission | "super";
  /** Visible with any one of these permissions (the tab checks each section itself). */
  anyPermission?: AdminPermission[];
  badge?: (stats: AdminDashboardStats) => number | undefined;
  component: ComponentType;
}

const TABS: AdminTabDefinition[] = [
  {
    id: "overview",
    label: "Dashboard",
    icon: BarChart3,
    group: "Overview",
    component: OverviewTab,
  },

  {
    id: "orders",
    label: "Orders",
    icon: ClipboardList,
    group: "Operations",
    permission: "orders",
    badge: (s) => s.awaitingFulfilment,
    component: OrdersTab,
  },
  {
    id: "returns",
    label: "Returns",
    icon: RotateCcw,
    group: "Operations",
    permission: "orders",
    badge: (s) => s.returnRequests,
    component: ReturnsTab,
  },
  {
    id: "products",
    label: "Products",
    icon: Box,
    group: "Operations",
    permission: "products",
    badge: (s) => s.pendingProducts,
    component: ProductsTab,
  },
  {
    id: "categories",
    label: "Categories",
    icon: FolderTree,
    group: "Operations",
    permission: "products",
    component: CategoriesTab,
  },
  {
    id: "brands",
    label: "Brands",
    icon: Tags,
    group: "Operations",
    permission: "products",
    component: BrandsTab,
  },
  {
    id: "reviews",
    label: "Reviews",
    icon: Star,
    group: "Operations",
    permission: "reviews",
    badge: (s) => s.pendingReviews,
    component: ReviewsTab,
  },

  {
    id: "customers",
    label: "Customers",
    icon: Users,
    group: "People",
    permission: "customers",
    component: CustomersTab,
  },
  {
    id: "vendors",
    label: "Sellers",
    icon: Store,
    group: "People",
    permission: "vendors",
    badge: (s) => s.pendingVendors,
    component: VendorsTab,
  },
  {
    id: "staff",
    label: "Staff & roles",
    icon: UserCog,
    group: "People",
    permission: "super",
    component: StaffTab,
  },

  {
    id: "coupons",
    label: "Coupons",
    icon: Ticket,
    group: "Marketing",
    permission: "marketing",
    component: CouponsTab,
  },
  {
    id: "banners",
    label: "Banners",
    icon: Image,
    group: "Marketing",
    permission: "marketing",
    component: BannersTab,
  },
  {
    id: "pages",
    label: "Content pages",
    icon: FileText,
    group: "Marketing",
    permission: "marketing",
    component: PagesTab,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Megaphone,
    group: "Marketing",
    anyPermission: ["marketing", "settings"],
    component: NotificationsTab,
  },
  {
    id: "subscribers",
    label: "Subscribers",
    icon: Mail,
    group: "Marketing",
    permission: "marketing",
    component: SubscribersTab,
  },

  {
    id: "payouts",
    label: "Seller payouts",
    icon: Wallet,
    group: "Finance",
    permission: "finance",
    badge: (s) => s.pendingPayouts,
    component: PayoutsTab,
  },

  {
    id: "tickets",
    label: "Support tickets",
    icon: LifeBuoy,
    group: "Support",
    permission: "support",
    badge: (s) => s.openTickets,
    component: TicketsTab,
  },
  {
    id: "messages",
    label: "Contact inbox",
    icon: Mail,
    group: "Support",
    permission: "support",
    badge: (s) => s.newMessages,
    component: MessagesTab,
  },

  {
    id: "settings",
    label: "Store settings",
    icon: Settings,
    group: "System",
    permission: "settings",
    component: SettingsTab,
  },
  {
    id: "audit",
    label: "Audit log",
    icon: ScrollText,
    group: "System",
    permission: "settings",
    component: AuditTab,
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    group: "System",
    component: SecurityTab,
  },
];

/** The store requires two-step sign-in and this admin hasn't set it up yet. */
const needsMfaSetup = (error: unknown) =>
  error instanceof ApiError &&
  error.status === 403 &&
  (error.details as { code?: string } | undefined)?.code === "MFA_SETUP_REQUIRED";

function canAccess(user: User, permission?: AdminPermission | "super"): boolean {
  if (!permission) return true;
  if (user.isSuperAdmin) return true;
  if (permission === "super") return false;
  return (
    (user.permissions ?? []).includes(permission) ||
    (user.viewPermissions ?? []).includes(permission)
  );
}

/** Staff with view-only access to a section see it read-only (the API refuses changes). */
function isReadOnly(user: User, permission?: AdminPermission | "super"): boolean {
  if (!permission || permission === "super" || user.isSuperAdmin) return false;
  return !(user.permissions ?? []).includes(permission);
}

function AdminDashboardPage() {
  const { ready, allowed, user } = useRequireAuth(["Admin"]);
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/admin-dashboard" });

  const { data, error } = useQuery({
    queryKey: ["admin-dashboard", 30],
    queryFn: () => api<{ stats: AdminDashboardStats }>("/admin/dashboard", { query: { days: 30 } }),
    enabled: allowed,
    staleTime: 60_000,
    retry: (count, failure) =>
      !(failure instanceof ApiError && failure.status === 403) && count < 2,
  });

  if (!ready || !allowed || !user) return <PageLoader label="Checking your access…" />;

  if (needsMfaSetup(error)) {
    return (
      <DashboardShell
        eyebrow="Smart Deal"
        title="Admin console"
        activeTab="security"
        onTabChange={() => undefined}
        nav={[{ id: "security", label: "Security", icon: ShieldCheck, group: "System" }]}
      >
        <SecurityTab forced />
      </DashboardShell>
    );
  }

  const visible = TABS.filter((entry) =>
    entry.anyPermission
      ? entry.anyPermission.some((permission) => canAccess(user, permission))
      : canAccess(user, entry.permission),
  );
  const active = visible.find((entry) => entry.id === tab) ?? visible[0];
  if (!active) return <PageLoader label="No console sections are available for your role." />;
  const ActiveTab = active.component;

  return (
    <DashboardShell
      eyebrow="Smart Deal"
      title="Admin console"
      activeTab={active.id}
      onTabChange={(id) =>
        void navigate({ search: (previous) => ({ ...previous, tab: id, status: undefined }) })
      }
      nav={visible.map((entry) => ({
        id: entry.id,
        label: entry.label,
        icon: entry.icon,
        group: entry.group,
        badge: data?.stats ? entry.badge?.(data.stats) : undefined,
      }))}
    >
      {isReadOnly(user, active.permission) && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5 shrink-0" />
          You have view-only access to {active.label.toLowerCase()}. Changes need edit access from a
          super admin.
        </p>
      )}
      <ActiveTab />
    </DashboardShell>
  );
}
