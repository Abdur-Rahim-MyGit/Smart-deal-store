import { Quote, Star } from "lucide-react";
import { testimonials } from "@/data/catalog";

/** Customer review rail with verified purchase attribution. */
export function ReviewsSection() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-extrabold sm:text-2xl">What shoppers say</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          4.7 average across 42,000+ verified orders.
        </p>
      </div>
      <ul className="rail-scroll -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
        {testimonials.slice(0, 6).map((review) => (
          <li
            key={review.id}
            className="w-[80%] shrink-0 snap-start rounded-2xl border border-border bg-card p-5 shadow-soft sm:w-auto"
          >
            <Quote className="h-5 w-5 text-primary" />
            <p className="mt-3 text-sm leading-relaxed">{review.text}</p>
            <div className="mt-4 flex items-center gap-1 text-primary">
              {Array.from({ length: review.rating }).map((_, index) => (
                <Star key={index} className="h-3.5 w-3.5 fill-current" />
              ))}
            </div>
            <p className="mt-3 text-sm font-bold">{review.name}</p>
            <p className="text-xs text-muted-foreground">
              {review.city} · bought {review.product}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
