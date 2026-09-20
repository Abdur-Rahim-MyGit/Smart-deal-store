import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ShoppingBag } from "lucide-react";
import { OrderCard, OrderCardSkeleton } from "@/components/account/order-card";
import { ORDER_FILTERS, type MyOrdersResponse, type OrderFilter } from "@/components/account/types";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { PaginationBar } from "@/components/common/pagination-bar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 6;

const EMPTY_COPY: Record<OrderFilter, { title: string; description: string }> = {
  all: {
    title: "No orders yet",
    description: "Your orders will appear here with live tracking the moment you check out.",
  },
  active: {
    title: "Nothing on its way",
    description: "You have no orders being prepared or shipped right now.",
  },
  delivered: {
    title: "No delivered orders",
    description: "Once an order arrives it moves here so you can review or return it.",
  },
  cancelled: {
    title: "Nothing cancelled or returned",
    description: "Cancelled orders and returns will be listed here.",
  },
};

export function OrdersSection() {
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["my-orders", filter, page],
    queryFn: () =>
      api<MyOrdersResponse>("/orders/my", {
        query: { page, limit: PAGE_SIZE, ...(filter === "all" ? {} : { status: filter }) },
      }),
    placeholderData: keepPreviousData,
  });

  const orders = data?.orders ?? [];
  const empty = EMPTY_COPY[filter];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">My orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track deliveries, download invoices, return or re-buy items.
        </p>
      </div>

      <div className="rail-scroll -mx-4 overflow-x-auto px-4">
        <div role="tablist" aria-label="Filter orders" className="flex w-max gap-2 pb-1">
          {ORDER_FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={filter === option.value}
              onClick={() => {
                setFilter(option.value);
                setPage(1);
              }}
              className={cn(
                "rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                filter === option.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <OrderCardSkeleton key={index} />
          ))}
        </div>
      ) : isError ? (
        <InlineError message="We couldn't load your orders." onRetry={() => void refetch()} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={empty.title}
          description={empty.description}
          action={
            <Button asChild className="rounded-xl font-semibold">
              <Link to="/">Start shopping</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div
            className={cn(
              "grid gap-3 sm:grid-cols-2",
              isFetching && "opacity-60 transition-opacity",
            )}
          >
            {orders.map((order) => (
              <OrderCard key={order._id} order={order} />
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Showing {orders.length} of {data?.total ?? orders.length} order
            {(data?.total ?? 0) === 1 ? "" : "s"}
          </p>

          <PaginationBar page={data?.page ?? page} pages={data?.pages ?? 1} onChange={setPage} />
        </>
      )}
    </div>
  );
}
