import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  CheckCircle2,
  ExternalLink,
  Flag,
  Loader2,
  Star,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { RatingStars } from "@/components/common/rating-stars";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { PaginationBar } from "@/components/common/pagination-bar";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import {
  CardsSkeleton,
  FilterChips,
  FilterField,
  FilterRow,
  ForbiddenState,
  SearchInput,
  Thumb,
  type ChipOption,
} from "@/components/admin/ops-common";
import {
  isForbidden,
  opsRetry,
  selectClass,
  useAdminSearch,
  useOpsInvalidate,
} from "@/components/admin/ops-utils";
import { cn } from "@/lib/utils";

type ReviewStatus = "Pending Approval" | "Approved" | "Rejected";
const STATUSES: ReviewStatus[] = ["Pending Approval", "Approved", "Rejected"];

interface AdminReview {
  _id: string;
  product: { _id: string; title: string; slug: string; thumbnail?: string | undefined } | null;
  user: { _id: string; name: string; email?: string | undefined } | null;
  rating: number;
  title?: string | undefined;
  comment: string;
  photos?: string[] | undefined;
  isVerifiedPurchase: boolean;
  isFlagged: boolean;
  vendorResponse?: { comment?: string | undefined; respondedAt?: string | undefined } | undefined;
  status: ReviewStatus;
  rejectionReason?: string | undefined;
  createdAt: string;
}

interface ReviewsResponse extends Paginated {
  reviews: AdminReview[];
  statusCounts: Record<string, number>;
}

export function ReviewsTab() {
  const search = useAdminSearch();
  const invalidate = useOpsInvalidate();

  const initialStatus = STATUSES.includes(search.status as ReviewStatus)
    ? (search.status as string)
    : "";

  const [status, setStatus] = useState(initialStatus);
  const [flagged, setFlagged] = useState(false);
  const [rating, setRating] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<AdminReview | null>(null);
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState<AdminReview | null>(null);

  const q = useDebounce(term, 350);

  const query = useQuery({
    queryKey: ["admin-reviews", { status, flagged, rating, q, page }],
    queryFn: () =>
      api<ReviewsResponse>("/admin/reviews", {
        query: { status, flagged: flagged ? "true" : "", rating, q, page, limit: 20 },
      }),
    placeholderData: keepPreviousData,
    retry: opsRetry,
  });

  const moderate = useMutation({
    mutationFn: ({
      id,
      next,
      rejectionReason,
    }: {
      id: string;
      next: ReviewStatus;
      rejectionReason?: string;
    }) =>
      api<{ message: string }>(`/admin/reviews/${id}`, {
        method: "PUT",
        body: { status: next, ...(rejectionReason ? { rejectionReason } : {}) },
      }),
    onSuccess: (response) => {
      toast.success(response.message);
      setRejecting(null);
      setReason("");
      invalidate("admin-reviews", "admin-dashboard");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/admin/reviews/${id}`, { method: "DELETE" }),
    onSuccess: (response) => {
      toast.success(response.message);
      setDeleting(null);
      invalidate("admin-reviews", "admin-dashboard");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const counts = useMemo(() => query.data?.statusCounts ?? {}, [query.data]);
  const total = useMemo(
    () => Object.values(counts).reduce((sum, value) => sum + value, 0),
    [counts],
  );

  const chips: ChipOption[] = [
    { value: "", label: "All", count: total },
    ...STATUSES.filter((entry) => counts[entry]).map((entry) => ({
      value: entry as string,
      label: entry === "Pending Approval" ? "Pending" : (entry as string),
      count: counts[entry],
    })),
  ];

  const filtersDirty = Boolean(status || flagged || rating || term);

  function update<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function resetFilters() {
    setStatus("");
    setFlagged(false);
    setRating("");
    setTerm("");
    setPage(1);
  }

  if (isForbidden(query.error)) return <ForbiddenState section="reviews" />;

  const reviews = query.data?.reviews ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div>
          <h2 className="font-display text-lg font-bold">Reviews</h2>
          <p className="text-xs text-muted-foreground">
            Approving a review publishes it and recalculates the product's star rating. Rejecting it
            notifies the customer with your reason.
          </p>
        </div>

        <FilterChips
          options={chips}
          value={status}
          onChange={update(setStatus)}
          ariaLabel="Filter by review status"
        />

        <FilterRow>
          <SearchInput
            value={term}
            onChange={update(setTerm)}
            placeholder="Search titles and comments"
            label="Search reviews"
          />
          <FilterField label="Rating">
            <select
              aria-label="Star rating"
              className={selectClass}
              value={rating}
              onChange={(event) => update(setRating)(event.target.value)}
            >
              <option value="">Any rating</option>
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} star{value === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </FilterField>
          <button
            type="button"
            onClick={() => update(setFlagged)(!flagged)}
            aria-pressed={flagged}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
              flagged
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Flag className="h-4 w-4" /> Flagged only
          </button>
          {filtersDirty && (
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={resetFilters}>
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          )}
        </FilterRow>
      </div>

      <SectionCard
        title={
          query.data ? `${query.data.total} review${query.data.total === 1 ? "" : "s"}` : "Reviews"
        }
        description={filtersDirty ? "Filtered view" : "Newest first"}
        bodyClassName="p-3 sm:p-4"
      >
        {query.isPending && <CardsSkeleton count={4} />}

        {query.isError && !isForbidden(query.error) && (
          <InlineError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        )}

        {query.data && reviews.length === 0 && (
          <EmptyState
            icon={Star}
            title="No reviews match these filters"
            description="Try another status or clear the search."
            action={
              filtersDirty ? (
                <Button variant="outline" className="rounded-xl" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}

        {reviews.length > 0 && (
          <>
            <ul className="space-y-3">
              {reviews.map((review) => (
                <li
                  key={review._id}
                  className={cn(
                    "rounded-2xl border p-4",
                    review.isFlagged ? "border-destructive/30 bg-destructive/5" : "border-border",
                  )}
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <Thumb src={review.product?.thumbnail} alt="" className="h-12 w-12" />
                    <div className="min-w-0 flex-1">
                      {review.product ? (
                        <Link
                          to="/product/$slug"
                          params={{ slug: review.product.slug }}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                        >
                          <span className="max-w-[320px] truncate">{review.product.title}</span>
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-muted-foreground">
                          Product removed
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        {review.user?.name ?? "Unknown customer"}
                        {review.user?.email ? ` · ${review.user.email}` : ""} ·{" "}
                        {formatDateTime(review.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={review.status} />
                      {review.isVerifiedPurchase && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-semibold text-success">
                          <BadgeCheck className="h-3 w-3" /> Verified purchase
                        </span>
                      )}
                      {review.isFlagged && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/12 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                          <Flag className="h-3 w-3" /> Flagged by the filter
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <RatingStars value={review.rating} size="sm" />
                    <span className="text-xs font-semibold tabular-nums">{review.rating}.0</span>
                    {review.title && (
                      <span className="truncate text-sm font-semibold">— {review.title}</span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line">
                    {review.comment}
                  </p>

                  {review.photos && review.photos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {review.photos.map((photo) => (
                        <Thumb key={photo} src={photo} alt="" className="h-16 w-16" />
                      ))}
                    </div>
                  )}

                  {review.rejectionReason && (
                    <p className="mt-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                      <span className="font-semibold">Rejected: </span>
                      {review.rejectionReason}
                    </p>
                  )}

                  {review.vendorResponse?.comment && (
                    <div className="mt-2 rounded-xl bg-muted/50 p-3">
                      <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                        Seller reply
                      </p>
                      <p className="mt-0.5 text-sm">{review.vendorResponse.comment}</p>
                      {review.vendorResponse.respondedAt && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatDateTime(review.vendorResponse.respondedAt)}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {review.status !== "Approved" && (
                      <Button
                        size="sm"
                        className="rounded-xl font-semibold"
                        disabled={moderate.isPending}
                        onClick={() => moderate.mutate({ id: review._id, next: "Approved" })}
                      >
                        <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
                      </Button>
                    )}
                    {review.status !== "Rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl font-semibold"
                        onClick={() => {
                          setReason("");
                          setRejecting(review);
                        }}
                      >
                        <XCircle className="mr-1.5 h-4 w-4" /> Reject…
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto rounded-xl text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleting(review)}
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <PaginationBar
              page={query.data?.page ?? page}
              pages={query.data?.pages ?? 1}
              onChange={setPage}
              className="mt-4"
            />
          </>
        )}
      </SectionCard>

      {/* Reject */}
      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reject this review</DialogTitle>
            <DialogDescription>
              The review stays off {rejecting?.product?.title ?? "the product page"} and the
              customer is notified with your reason. The product's star rating is recalculated
              without it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="review-reason">Reason (sent to the customer)</Label>
            <Textarea
              id="review-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. The review contains personal contact details."
              className="min-h-[96px] rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground">
              Leave empty to use the default "Doesn't meet our review guidelines".
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => setRejecting(null)}
              disabled={moderate.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl font-semibold"
              disabled={moderate.isPending}
              onClick={() => {
                if (rejecting) {
                  moderate.mutate({
                    id: rejecting._id,
                    next: "Rejected",
                    ...(reason.trim() ? { rejectionReason: reason.trim() } : {}),
                  });
                }
              }}
            >
              {moderate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this review?</AlertDialogTitle>
            <AlertDialogDescription>
              The review is removed permanently and the product's star rating is recalculated
              without it. Rejecting the review instead keeps a record and tells the customer why.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={remove.isPending}>
              Keep review
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive font-semibold text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleting) remove.mutate(deleting._id);
              }}
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete review
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
