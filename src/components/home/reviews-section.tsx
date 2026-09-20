import { Link } from "@tanstack/react-router";
import { Quote } from "lucide-react";
import { RatingStars } from "@/components/common/rating-stars";
import { formatDate } from "@/lib/format";
import type { HomeData } from "@/lib/types";

type HomeReview = HomeData["reviews"][number];

/** Social proof: recent approved reviews from real orders. */
export function ReviewsSection({ reviews }: { reviews: HomeReview[] }) {
  const items = reviews.slice(0, 6);
  if (items.length === 0) return null;

  return (
    <section className="space-y-4" aria-labelledby="customer-reviews">
      <div>
        <h2 id="customer-reviews" className="font-display text-xl font-extrabold sm:text-2xl">
          What UAE shoppers say
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every review comes from a verified Smart Deal order.
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((review) => (
          <figure
            key={review._id}
            className="flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft"
          >
            <div className="flex items-center justify-between gap-3">
              <RatingStars value={review.rating} size="sm" />
              <Quote className="h-5 w-5 text-muted-foreground/40" aria-hidden />
            </div>
            <blockquote className="flex-1 space-y-1.5">
              {review.title && <p className="text-sm font-bold">{review.title}</p>}
              <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                “{review.comment}”
              </p>
            </blockquote>
            <figcaption className="flex items-center gap-3 border-t border-border pt-3">
              <Link
                to="/product/$slug"
                params={{ slug: review.product.slug }}
                className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-border bg-muted"
                aria-label={review.product.title}
              >
                <img
                  src={review.product.thumbnail}
                  alt=""
                  loading="lazy"
                  width={88}
                  height={88}
                  className="h-full w-full object-cover"
                />
              </Link>
              <span className="min-w-0">
                <Link
                  to="/product/$slug"
                  params={{ slug: review.product.slug }}
                  className="block truncate text-[13px] font-semibold hover:underline"
                >
                  {review.product.title}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  {review.author} ·{" "}
                  {formatDate(review.createdAt, { day: "numeric", month: "short" })}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
