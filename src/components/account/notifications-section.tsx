import { useRouter } from "@tanstack/react-router";
import {
  BellOff,
  CheckCheck,
  CircleDollarSign,
  Package,
  PackageSearch,
  ShieldCheck,
  Star,
  Store,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/hooks/use-notifications";
import { timeAgo } from "@/lib/format";
import type { AppNotification } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS: Record<AppNotification["type"], LucideIcon> = {
  order: Package,
  product: Store,
  payout: CircleDollarSign,
  support: ShieldCheck,
  account: ShieldCheck,
  promo: Tag,
  stock: PackageSearch,
  review: Star,
};

export function NotificationsSection() {
  const router = useRouter();
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();

  function open(notification: AppNotification) {
    if (!notification.isRead) markRead(notification._id);
    if (notification.link) router.history.push(notification.link);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0
              ? `You have ${unreadCount} unread update${unreadCount === 1 ? "" : "s"}.`
              : "Order updates, refunds and support replies land here."}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            className="h-10 rounded-xl font-semibold"
            onClick={() => markAllRead()}
          >
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title="You're all caught up"
          description="We'll let you know as soon as an order moves, a refund lands or support replies."
        />
      ) : (
        <ul className="space-y-2">
          {notifications.map((notification) => {
            const Icon = ICONS[notification.type] ?? Package;
            return (
              <li key={notification._id}>
                <button
                  type="button"
                  onClick={() => open(notification)}
                  className={cn(
                    "flex w-full gap-3 rounded-2xl border p-4 text-left transition-colors",
                    notification.isRead
                      ? "border-border bg-card hover:bg-accent/50"
                      : "border-foreground/15 bg-accent/50 hover:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                      notification.isRead
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary text-primary-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm",
                          notification.isRead ? "font-semibold" : "font-bold",
                        )}
                      >
                        {notification.title}
                      </span>
                      {!notification.isRead && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {notification.message}
                    </span>
                    <span className="mt-1 block text-[11px] text-muted-foreground">
                      {timeAgo(notification.createdAt)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
