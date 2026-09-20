import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Loader2, MessageSquare, PenLine, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PaginationBar } from "@/components/common/pagination-bar";
import { InlineError } from "@/components/common/page-loader";
import { RatingInput, RatingStars } from "@/components/common/rating-stars";
import { useStore } from "@/context/store";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { ProductReview, Rating } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReviewsResponse {
  reviews: ProductReview[];
  total: number;
  page: number;
  pages: number;
}

const SORTS = [
  { value: "newest", label: "Most recent" },
  { value: "highest", label: "Highest rated" },
  { value: "lowest", label: "Lowest rated" },
] as const;

const REASONS: Record<string, string> = {
  not_purchased: "Only shoppers who bought this item can review it.",
  not_delivered: "You can review this product once your order is delivered.",
  already_reviewed: "You've already reviewed this product — thank you!",
  not_signed_in: "Sign in to write a review.",
};

const selectClass =
  "h-10 rounded-xl border border-input bg-background px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** Rating breakdown, review list with filters, and the write-a-review flow. */
export function ProductReviews({
  productId,
  rating,
  breakdown,
}: {
  productId: string;
  rating: Rating;
  breakdown: Record<string, number>;
}) {
  const { isAuthenticated } = useStore();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const [sort, setSort] = useState<string>("newest");
  const [star, setStar] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ rating: 5, title: "", comment: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const reviewsQuery = useQuery({
    queryKey: ["product-reviews", productId, sort, star, page],
    queryFn: ({ signal }) =>
      api<ReviewsResponse>(`/products/${productId}/reviews`, {
        query: { sort, rating: star ?? undefined, page },
        signal,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const eligibility = useQuery({
    queryKey: ["review-eligibility", productId],
    queryFn: ({ signal }) =>
      api<{ canReview: boolean; reason?: string }>(`/products/${productId}/review-eligibility`, {
        signal,
      }),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const submit = useMutation({
    mutationFn: (body: { rating: number; title?: string; comment: string }) =>
      api(`/products/${productId}/reviews`, { method: "POST", body }),
    onSuccess: () => {
      toast.success("Thanks for the review!", {
        description: "It will appear once our team has approved it.",
      });
      setOpen(false);
      setForm({ rating: 5, title: "", comment: "" });
      void queryClient.invalidateQueries({ queryKey: ["review-eligibility", productId] });
      void queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const reviews = reviewsQuery.data?.reviews ?? [];
  const total = rating.count;
  const canReview = eligibility.data?.canReview === true;
  const reason = eligibility.data?.reason;

  function applyFilter(nextStar: number | null) {
    setStar(nextStar);
    setPage(1);
  }

  function onSubmit() {
    if (form.rating < 1) {
      setFormError("Choose a star rating");
      return;
    }
    if (form.comment.trim().length < 10) {
      setFormError("Tell us a little more — at least 10 characters");
      return;
    }
    setFormError(null);
    const title = form.title.trim();
    submit.mutate({
      rating: form.rating,
      comment: form.comment.trim(),
      ...(title ? { title } : {}),
    });
  }

  return (
    <section id="reviews" className="scroll-mt-28 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold sm:text-2xl">Ratings & reviews</h2>
        {isAuthenticated ? (
          canReview ? (
            <Button onClick={() => setOpen(true)} className="rounded-xl font-semibold">
              <PenLine className="mr-1.5 h-4 w-4" /> Write a review
            </Button>
          ) : eligibility.isPending ? (
            <span className="text-sm text-muted-foreground">Checking if you can review…</span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {REASONS[reason ?? ""] ?? "Reviews are open to verified buyers."}
            </span>
          )
        ) : (
          <Button asChild variant="outline" className="rounded-xl font-semibold">
            <Link to="/login" search={{ redirect: pathname }}>
              Sign in to review
            </Link>
          </Button>
        )}
      </div>

      <div className="grid gap-5 rounded-2xl border border-border bg-card p-5 shadow-soft sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-8">
        <div className="text-center sm:text-left">
          <p className="font-display text-4xl font-extrabold">{rating.average.toFixed(1)}</p>
          <RatingStars
            value={rating.average}
            size="md"
            className="mt-1.5 justify-center sm:justify-start"
          />
          <p className="mt-1.5 text-sm text-muted-foreground">
            {total} review{total === 1 ? "" : "s"}
          </p>
        </div>

        <div className="space-y-1.5">
          {[5, 4, 3, 2, 1].map((value) => {
            const count = breakdown[String(value)] ?? 0;
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            const active = star === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => applyFilter(active ? null : value)}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-1 text-sm transition-colors hover:bg-accent",
                  active && "bg-accent",
                )}
              >
                <span className="flex w-10 shrink-0 items-center gap-0.5 font-semibold">
                  {value} <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-amber-500"
                    style={{ width: `${percent}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                  {count} · {percent}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => applyFilter(null)}
          aria-pressed={star === null}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
            star === null ? "border-foreground bg-accent" : "border-border hover:bg-accent",
          )}
        >
          All ratings
        </button>
        {[5, 4, 3, 2, 1].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => applyFilter(star === value ? null : value)}
            aria-pressed={star === value}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
              star === value ? "border-foreground bg-accent" : "border-border hover:bg-accent",
            )}
          >
            {value} <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <label htmlFor="review-sort" className="sr-only">
            Sort reviews
          </label>
          <select
            id="review-sort"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
            className={selectClass}
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {reviewsQuery.isError ? (
        <InlineError
          message={errorMessage(reviewsQuery.error)}
          onRetry={() => void reviewsQuery.refetch()}
        />
      ) : reviewsQuery.isPending ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-10 text-center">
          <MessageSquare className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-semibold">
            {star ? `No ${star}-star reviews yet` : "No reviews yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {star
              ? "Try another rating filter."
              : "Be the first to share what you think after buying."}
          </p>
        </div>
      ) : (
        <ul className="space-y-3" aria-live="polite">
          {reviews.map((review) => (
            <li
              key={review._id}
              className="space-y-2 rounded-2xl border border-border bg-card p-5 shadow-soft"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <RatingStars value={review.rating} size="sm" />
                <span className="text-sm font-bold">{review.author}</span>
                {review.isVerifiedPurchase && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-semibold text-success">
                    <BadgeCheck className="h-3.5 w-3.5" /> Verified purchase
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  {formatDate(review.createdAt)}
                </span>
              </div>
              {review.title && <p className="text-sm font-bold">{review.title}</p>}
              <p className="text-sm leading-relaxed text-muted-foreground">{review.comment}</p>
              {review.vendorResponse?.comment && (
                <div className="mt-2 rounded-xl border border-border bg-muted/50 p-3.5">
                  <p className="text-xs font-bold">
                    Seller response
                    {review.vendorResponse.respondedAt
                      ? ` · ${formatDate(review.vendorResponse.respondedAt)}`
                      : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {review.vendorResponse.comment}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <PaginationBar page={page} pages={reviewsQuery.data?.pages ?? 1} onChange={setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Write a review</DialogTitle>
            <DialogDescription>
              Reviews are moderated before they go live, and always come from verified orders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Your rating</Label>
              <RatingInput
                value={form.rating}
                onChange={(value) => setForm((current) => ({ ...current, rating: value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="review-title">Headline (optional)</Label>
              <Input
                id="review-title"
                value={form.title}
                maxLength={100}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="Sums up your experience"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="review-comment">Your review</Label>
              <Textarea
                id="review-comment"
                value={form.comment}
                rows={5}
                maxLength={1500}
                onChange={(event) =>
                  setForm((current) => ({ ...current, comment: event.target.value }))
                }
                placeholder="What did you like or dislike? How did it compare to what you expected?"
                className="rounded-xl"
                aria-describedby="review-comment-help"
              />
              <p id="review-comment-help" className="text-xs text-muted-foreground">
                At least 10 characters.
              </p>
            </div>

            {formError && <p className="text-sm font-semibold text-destructive">{formError}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="rounded-xl font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={onSubmit}
              disabled={submit.isPending}
              className="rounded-xl font-semibold"
            >
              {submit.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Submit review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
