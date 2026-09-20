/** Shared account drawer for the Customers and Sellers tabs (`GET /admin/users/:id`). */
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, FileCheck2, MapPin, Package, ShoppingBag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { InlineError } from "@/components/common/page-loader";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatDateTime, formatPrice, initials } from "@/lib/format";
import type { OrderStatus, PaymentMethod, User } from "@/lib/types";
import { DetailRow, adminRetry, isForbidden, maskAccount } from "@/components/admin/people-shared";
import { openProtectedFile } from "@/lib/protected-file";
import { toast } from "sonner";

/** Seller metrics over the last 90 days (rating is lifetime). */
export interface SellerPerformanceStats {
  sales: number;
  orders: number;
  rating: number | null;
  reviewCount: number;
  cancellationRate: number | null;
  returnRate: number | null;
  avgShipHours: number | null;
}

export interface AdminUserStats {
  orders?: number | undefined;
  spent?: number | undefined;
  lastOrderAt?: string | undefined;
  products?: number | undefined;
  activeProducts?: number | undefined;
  sales?: number | undefined;
  performance?: SellerPerformanceStats | undefined;
}

const formatShipTime = (hours: number | null) =>
  hours === null ? "—" : hours < 48 ? `${hours.toFixed(1)} h` : `${(hours / 24).toFixed(1)} days`;
const percent = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);

/** One-line seller scorecard for tables. */
export function SellerPerformance({ value }: { value?: SellerPerformanceStats | undefined }) {
  if (!value || (!value.orders && value.rating === null))
    return <span className="text-xs text-muted-foreground">No orders yet</span>;
  return (
    <span className="block text-xs leading-snug tabular-nums">
      <span className="font-semibold">
        {value.rating === null ? "No rating" : `${value.rating.toFixed(1)} ★`}
      </span>
      <span className="block text-muted-foreground">
        Ships in {formatShipTime(value.avgShipHours)} · {percent(value.cancellationRate)} cancelled
      </span>
    </span>
  );
}

/** A row from `GET /admin/customers` or `GET /admin/vendors`. */
export interface AdminUserRow extends User {
  stats?: AdminUserStats | undefined;
}

export interface AdminUserOrder {
  _id: string;
  orderId: string;
  status: OrderStatus;
  pricing: { total: number };
  paymentDetails?: { method?: PaymentMethod | undefined } | undefined;
  createdAt: string;
}

export interface VendorBalances {
  clearedEarnings: number;
  onHold: number;
  inProgress: number;
  paidOut: number;
  availableBalance: number;
  holdDays: number;
  minPayout: number;
  products: Record<string, number>;
  performance?: SellerPerformanceStats | undefined;
}

export interface AdminUserDetail {
  user: User;
  orders: AdminUserOrder[];
  stats: { orderCount: number; totalSpent: number };
  vendor: VendorBalances | null;
  security?: { lockedUntil: string | null; activeSessions: number } | undefined;
}

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5">
      <p className="text-[10px] font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 font-display text-base font-extrabold tabular-nums">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Block({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: typeof MapPin;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {title}
      </h3>
      {children}
    </section>
  );
}

export function UserDetailDialog({
  userId,
  mode,
  open,
  onOpenChange,
  actions,
}: {
  userId: string | null;
  mode: "customer" | "vendor";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rendered in a sticky footer so each tab can supply its own moderation controls. */
  actions?: ((detail: AdminUserDetail) => ReactNode) | undefined;
}) {
  const query = useQuery({
    queryKey: ["admin-user", userId],
    queryFn: () => api<AdminUserDetail>(`/admin/users/${userId}`),
    enabled: Boolean(userId) && open,
    retry: adminRetry,
  });

  const detail = query.data;
  const user = detail?.user;
  const vendorDetails = user?.vendorDetails;
  const bank = vendorDetails?.bankAccount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle className="font-display flex items-center gap-3 pr-6">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {initials(user?.name ?? "")}
            </span>
            <span className="min-w-0 truncate">
              {mode === "vendor"
                ? (vendorDetails?.businessName ?? user?.name ?? "Seller")
                : (user?.name ?? "Customer")}
            </span>
            {user && <StatusBadge status={user.status} />}
            {mode === "vendor" && vendorDetails?.status && (
              <StatusBadge status={vendorDetails.status} />
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {user ? `${user.email}${user.phone ? ` · ${user.phone}` : ""}` : "Loading account…"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {query.isLoading && (
            <div className="space-y-3" aria-hidden>
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          )}

          {query.error ? (
            <InlineError
              message={
                isForbidden(query.error)
                  ? "Your admin role doesn't include this section."
                  : errorMessage(query.error)
              }
              onRetry={() => void query.refetch()}
            />
          ) : null}

          {detail && user && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {mode === "customer" ? (
                  <>
                    <Tile label="Orders" value={detail.stats.orderCount} />
                    <Tile
                      label="Total spent"
                      value={formatPrice(detail.stats.totalSpent)}
                      hint="Excludes cancelled & refunded"
                    />
                    <Tile label="Wallet" value={formatPrice(user.walletBalance)} />
                  </>
                ) : (
                  <>
                    <Tile
                      label="Available"
                      value={formatPrice(detail.vendor?.availableBalance ?? 0)}
                      hint={`Clears after ${detail.vendor?.holdDays ?? 0} days`}
                    />
                    <Tile
                      label="On hold"
                      value={formatPrice(detail.vendor?.onHold ?? 0)}
                      hint="Recent deliveries"
                    />
                    <Tile label="Paid out" value={formatPrice(detail.vendor?.paidOut ?? 0)} />
                  </>
                )}
              </div>

              <Block title="Profile">
                <dl className="rounded-xl border border-border px-3 py-1">
                  <DetailRow label="Email" value={user.email} />
                  <DetailRow label="Phone" value={user.phone || "—"} />
                  <DetailRow label="Joined" value={formatDate(user.createdAt)} />
                  <DetailRow
                    label="Last sign-in"
                    value={user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                  />
                  <DetailRow
                    label="Sign-in method"
                    value={user.authProvider === "google" ? "Google" : "Email & password"}
                  />
                  <DetailRow label="Email verified" value={user.isVerified ? "Yes" : "No"} />
                  <DetailRow
                    label="Last active"
                    value={user.lastActiveAt ? formatDate(user.lastActiveAt) : "—"}
                  />
                  <DetailRow
                    label="Signed in on"
                    value={`${detail.security?.activeSessions ?? 0} device(s)`}
                  />
                  {detail.security?.lockedUntil && (
                    <DetailRow
                      label="Sign-in"
                      value={
                        <span className="text-destructive">
                          Locked until {formatDateTime(detail.security.lockedUntil)}
                        </span>
                      }
                    />
                  )}
                  {user.signupSource && <DetailRow label="Came from" value={user.signupSource} />}
                </dl>
              </Block>

              {mode === "vendor" && (
                <>
                  <Block title="Business details" icon={Package}>
                    <dl className="rounded-xl border border-border px-3 py-1">
                      <DetailRow
                        label="Trade licence"
                        value={vendorDetails?.tradeLicenseNumber || "Not provided"}
                      />
                      <DetailRow
                        label="VAT number"
                        value={vendorDetails?.vatNumber || "Not provided"}
                      />
                      <DetailRow
                        label="Corporate address"
                        value={vendorDetails?.corporateAddress || "Not provided"}
                      />
                      <DetailRow
                        label="Commission override"
                        value={
                          vendorDetails?.commissionRateOverride === undefined
                            ? "Category default"
                            : `${vendorDetails.commissionRateOverride}%`
                        }
                      />
                      <DetailRow
                        label="Products"
                        value={`${detail.vendor ? Object.values(detail.vendor.products).reduce((sum, value) => sum + value, 0) : 0} total · ${detail.vendor?.products["Active"] ?? 0} active`}
                      />
                    </dl>
                    {vendorDetails?.storeDescription && (
                      <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                        {vendorDetails.storeDescription}
                      </p>
                    )}
                    {vendorDetails?.rejectionReason && (
                      <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        Reason on file: {vendorDetails.rejectionReason}
                      </p>
                    )}
                  </Block>

                  {detail.vendor?.performance && (
                    <Block title="Performance · last 90 days">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <Tile
                          label="Sales"
                          value={formatPrice(detail.vendor.performance.sales)}
                          hint={`${detail.vendor.performance.orders} orders`}
                        />
                        <Tile
                          label="Rating"
                          value={
                            detail.vendor.performance.rating === null
                              ? "—"
                              : `${detail.vendor.performance.rating.toFixed(1)} ★`
                          }
                          hint={`${detail.vendor.performance.reviewCount} reviews`}
                        />
                        <Tile
                          label="Ships in"
                          value={formatShipTime(detail.vendor.performance.avgShipHours)}
                          hint="Order placed → shipped"
                        />
                        <Tile
                          label="Cancelled"
                          value={percent(detail.vendor.performance.cancellationRate)}
                          hint="Of ordered items"
                        />
                        <Tile
                          label="Returned"
                          value={percent(detail.vendor.performance.returnRate)}
                          hint="Of delivered items"
                        />
                      </div>
                    </Block>
                  )}

                  <Block title="Verification documents" icon={FileCheck2}>
                    <dl className="rounded-xl border border-border px-3 py-1">
                      {(
                        [
                          ["tradeLicense", "Trade licence"],
                          ["vatCertificate", "VAT certificate"],
                        ] as const
                      ).map(([type, label]) => {
                        const doc = vendorDetails?.documents?.[type];
                        const expired = doc?.expiresAt
                          ? new Date(doc.expiresAt).getTime() < Date.now()
                          : false;
                        return (
                          <DetailRow
                            key={type}
                            label={label}
                            value={
                              doc ? (
                                <span className="inline-flex items-center gap-2">
                                  <span className={expired ? "text-destructive" : undefined}>
                                    {doc.expiresAt
                                      ? `${expired ? "Expired" : "Expires"} ${formatDate(doc.expiresAt)}`
                                      : `Uploaded ${formatDate(doc.uploadedAt)}`}
                                  </span>
                                  <button
                                    type="button"
                                    className="underline underline-offset-2"
                                    onClick={() =>
                                      void openProtectedFile(
                                        `/admin/vendors/${user._id}/documents/${type}`,
                                      ).catch((error) => toast.error(errorMessage(error)))
                                    }
                                  >
                                    View
                                  </button>
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Not uploaded</span>
                              )
                            }
                          />
                        );
                      })}
                    </dl>
                  </Block>

                  <Block title="Payout bank account" icon={Banknote}>
                    <dl className="rounded-xl border border-border px-3 py-1">
                      <DetailRow label="Bank" value={bank?.bankName || "Not provided"} />
                      <DetailRow label="Account name" value={bank?.accountName || "Not provided"} />
                      <DetailRow label="Account number" value={maskAccount(bank?.accountNumber)} />
                      <DetailRow
                        label="IBAN"
                        value={<span className="font-mono">{bank?.iban || "—"}</span>}
                      />
                    </dl>
                  </Block>
                </>
              )}

              {mode === "customer" && (
                <Block title={`Saved addresses (${user.addresses.length})`} icon={MapPin}>
                  {user.addresses.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                      No saved addresses yet.
                    </p>
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {user.addresses.map((address, index) => (
                        <li
                          key={address._id ?? index}
                          className="rounded-xl border border-border px-3 py-2 text-xs"
                        >
                          <p className="flex items-center gap-1.5 font-semibold">
                            {address.receiverName}
                            {address.isDefault && (
                              <span className="rounded-full bg-success/12 px-1.5 py-0.5 text-[10px] font-bold text-success">
                                Default
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-muted-foreground">
                            {address.buildingDetails}, {address.street}, {address.area},{" "}
                            {address.emirate}
                          </p>
                          <p className="text-muted-foreground">{address.receiverPhone}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Block>
              )}

              <Block title={`Recent orders (${detail.orders.length})`} icon={ShoppingBag}>
                {detail.orders.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                    No orders placed on this account.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50">
                        <tr className="text-left text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                          <th scope="col" className="px-3 py-2">
                            Order
                          </th>
                          <th scope="col" className="px-3 py-2">
                            Date
                          </th>
                          <th scope="col" className="px-3 py-2">
                            Status
                          </th>
                          <th scope="col" className="px-3 py-2 text-right">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.orders.map((order) => (
                          <tr key={order._id} className="border-t border-border/60">
                            <td className="px-3 py-2 font-semibold">{order.orderId}</td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {formatDate(order.createdAt)}
                            </td>
                            <td className="px-3 py-2">
                              <StatusBadge status={order.status} />
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {formatPrice(order.pricing.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Showing the 20 most recent orders.
                </p>
              </Block>
            </>
          )}
        </div>

        {detail && actions && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
            {actions(detail)}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
