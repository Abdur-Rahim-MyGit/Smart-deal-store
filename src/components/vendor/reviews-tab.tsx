import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, ExternalLink, Loader2, MessageSquareReply, Star } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { PaginationBar } from "@/components/common/pagination-bar";
import { RatingStars } from "@/components/common/rating-stars";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { CardListSkeleton, FilterChip, ResultCount, Thumb } from "@/components/vendor/common";
import { LockedNotice, useVendorGate } from "@/components/vendor/vendor-status";
import type { VendorReview, VendorReviewsResponse } from "@/components/vendor/types";

/** Customer reviews on this seller's products, with public replies. */
export function ReviewsTab() {
  const gate = useVendorGate();
  const queryClient = useQueryClient();

  const [unanswered, setUnanswered] = useState(false);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["vendor-reviews", { unanswered, page }],
    queryFn: () =>
      api<VendorReviewsResponse>("/vendors/reviews", {
        query: { unanswered: unanswered ? "true" : undefined, page },
      }),
    placeholderData: keepPreviousData,
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, comment }: { id: string; comment: string }) =>
      api<{ message: string }>(`/vendors/reviews/${id}/reply`, {
        method: "PUT",
        body: { comment },
      }),
    onSuccess: (response, variables) => {
      toast.success(response.message || "Reply posted");
      setOpenId(null);
      setDrafts((current) => {
        const next = { ...current };
        delete next[variables.id];
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ["vendor-reviews"] });
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError)),
  });

  const reviews = data?.reviews ?? [];

  function startReply(review: VendorReview) {
    setOpenId(review._id);
    setDrafts((current) => ({
      ...current,
      [review._id]: current[review._id] ?? review.vendorResponse?.comment ?? "",
    }));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Reviews</h2>
          <p className="text-sm text-muted-foreground">
            Replies appear publicly under the review on your product page.
          </p>
        </div>
        <ResultCount shown={reviews.length} total={data?.total ?? 0} noun="reviews" />
      </div>

      {!gate.isActive && (
        <LockedNotice reason={`Replying is disabled. ${gate.lockReason ?? ""}`.trim()} />
      )}

      <div className="rail-scroll flex gap-2 overflow-x-auto pb-1">
        <FilterChip
          label="All reviews"
          active={!unanswered}
          onClick={() => {
            setUnanswered(false);
            setPage(1);
          }}
        />
        <FilterChip
          label="Unanswered only"
          active={unanswered}
          onClick={() => {
            setUnanswered(true);
            setPage(1);
          }}
        />
      </div>

      {isPending ? (
        <CardListSkeleton rows={3} />
      ) : isError ? (
        <InlineError
          message={errorMessage(error, "We couldn't load your reviews.")}
          onRetry={() => void refetch()}
        />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title={unanswered ? "Every review has a reply" : "No reviews yet"}
          description={
            unanswered
              ? "You're all caught up. Switch to All reviews to read what shoppers are saying."
              : "Approved reviews on your products show up here. Replying publicly builds trust with future shoppers."
          }
          action={
            unanswered ? (
              <Button
                variant="outline"
                className="rounded-xl font-semibold"
                onClick={() => setUnanswered(false)}
              >
                Show all reviews
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={isFetching ? "space-y-4 opacity-60 transition-opacity" : "space-y-4"}>
          {reviews.map((review) => {
            const reply = review.vendorResponse?.comment ?? "";
            const editing = openId === review._id;
            const draft = drafts[review._id] ?? "";
            const busy = replyMutation.isPending && replyMutation.variables?.id === review._id;

            return (
              <article
                key={review._id}
                className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-5"
              >
                <div className="flex flex-wrap items-start gap-3">
                  <Thumb src={review.product?.thumbnail} alt="" className="h-12 w-12" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{review.product?.title ?? "Product removed"}</p>
                      {review.product?.slug && (
                        <a
                          href={`/product/${review.product.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground"
                        >
                          View <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <RatingStars value={review.rating} size="xs" />
                      <span className="font-semibold text-foreground">{review.rating}.0</span>
                      <span>·</span>
                      <span>{review.author}</span>
                      <span>·</span>
                      <span>{formatDate(review.createdAt)}</span>
                      {review.isVerifiedPurchase && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 font-semibold text-success">
                          <BadgeCheck className="h-3 w-3" /> Verified purchase
                        </span>
                      )}
                    </div>
                  </div>
                  {!reply && !editing && (
                    <Button
                      size="sm"
                      className="rounded-xl font-semibold"
                      disabled={!gate.isActive}
                      onClick={() => startReply(review)}
                    >
                      <MessageSquareReply className="mr-1.5 h-4 w-4" /> Reply
                    </Button>
                  )}
                </div>

                <div className="mt-3">
                  {review.title && <p className="font-semibold">{review.title}</p>}
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                    {review.comment}
                  </p>
                </div>

                {reply && !editing && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                        Your reply
                        {review.vendorResponse?.respondedAt
                          ? ` · ${formatDate(review.vendorResponse.respondedAt)}`
                          : ""}
                      </p>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 rounded-lg font-semibold"
                        disabled={!gate.isActive}
                        onClick={() => startReply(review)}
                      >
                        Edit reply
                      </Button>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed">{reply}</p>
                  </div>
                )}

                {editing && (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={draft}
                      onChange={(event) =>
                        setDrafts((current) => ({ ...current, [review._id]: event.target.value }))
                      }
                      placeholder="Thank the shopper, answer their question, or explain how you'll fix it…"
                      className="min-h-[96px] rounded-xl"
                      maxLength={1000}
                      aria-label={`Reply to ${review.author}`}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        {draft.length}/1000 · visible to every shopper
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => setOpenId(null)}
                          disabled={busy}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-xl font-semibold"
                          disabled={busy || draft.trim().length < 2 || !gate.isActive}
                          onClick={() =>
                            replyMutation.mutate({ id: review._id, comment: draft.trim() })
                          }
                        >
                          {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                          {reply ? "Update reply" : "Post reply"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <PaginationBar page={data?.page ?? 1} pages={data?.pages ?? 1} onChange={setPage} />
    </div>
  );
}
