import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { SiteLayout, PageContainer } from "@/components/layout/site-layout";
import { PromoGrid } from "@/components/common/banner-slots";
import { InlineError } from "@/components/common/page-loader";
import { BrandStrip } from "@/components/home/brand-strip";
import { CategoryTiles } from "@/components/home/category-tiles";
import { CollectionTiles } from "@/components/home/collection-tiles";
import { FlashDeals } from "@/components/home/flash-deals";
import { HeroCarousel, HeroCarouselSkeleton, heroSlides } from "@/components/home/hero-carousel";
import { NewsletterBand } from "@/components/home/newsletter-band";
import { ReviewsSection } from "@/components/home/reviews-section";
import { SellerCta } from "@/components/home/seller-cta";
import { TrustStrip } from "@/components/home/trust-strip";
import { ProductRail } from "@/components/product/product-rail";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { api, errorMessage } from "@/lib/api";
import type { HomeData } from "@/lib/types";

const title = "Smart Deal — Beauty, Tech & Fashion at Honest Prices in the UAE";
const description =
  "Shop authentic beauty, skincare, perfumes, electronics, fashion and home essentials from verified UAE sellers. Fast delivery across all seven emirates, cash on delivery and 14-day returns.";

export const Route = createFileRoute("/")({
  // Server-renders the storefront for crawlers and first paint. On client-side
  // navigation this returns null and React Query does the fetching instead.
  loader: async () => {
    if (typeof window !== "undefined") return null;
    try {
      return (await api<{ home: HomeData }>("/public/home")).home;
    } catch {
      return null; // The page shows its own retry state
    }
  },
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
    ],
  }),
  component: Home,
});

/** "View all" link that carries the rail's intent into the catalog. */
function ViewAll({ search }: { search: Record<string, unknown> }) {
  return (
    <Link
      to="/search"
      search={search}
      className="inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold whitespace-nowrap hover:underline"
    >
      View all <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

function Home() {
  const serverData = Route.useLoaderData();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["home"],
    queryFn: ({ signal }) =>
      api<{ home: HomeData }>("/public/home", { signal }).then((response) => response.home),
    staleTime: 5 * 60 * 1000,
    ...(serverData ? { initialData: serverData } : {}),
  });

  const { items: recentlyViewed } = useRecentlyViewed();
  const loading = isPending && !isError;

  return (
    <SiteLayout>
      <PageContainer className="space-y-10 py-5 sm:space-y-12 sm:py-6">
        {loading ? (
          <HeroCarouselSkeleton />
        ) : (
          <HeroCarousel slides={heroSlides(data?.banners ?? [])} />
        )}

        {isError && (
          <InlineError
            message={`We couldn't load today's offers. ${errorMessage(error)}`}
            onRetry={() => void refetch()}
          />
        )}

        <TrustStrip />

        <CategoryTiles categories={data?.categories ?? []} loading={loading} />

        <FlashDeals
          products={data?.flashDeals ?? []}
          endsAt={data?.flashEndsAt ?? null}
          banner={data?.flashBanner ?? null}
          loading={loading}
        />

        <ProductRail
          title="Today's deals"
          subtitle="Price cuts our buyers rate as genuinely good"
          products={data?.deals ?? []}
          loading={loading}
          action={<ViewAll search={{ discount: 25, sort: "discount" }} />}
        />

        <CollectionTiles categories={data?.categories ?? []} />

        <ProductRail
          title="Best sellers"
          subtitle="What the UAE bought most this month"
          products={data?.bestSellers ?? []}
          loading={loading}
          action={<ViewAll search={{ sort: "popular" }} />}
        />

        <PromoGrid banners={data?.promoBanners ?? []} />

        <ProductRail
          title="Trending now"
          subtitle="Moving fast across the marketplace"
          products={data?.trending ?? []}
          loading={loading}
          action={<ViewAll search={{ sort: "popular" }} />}
        />

        <ProductRail
          title="Handpicked for you"
          subtitle="Editor-approved picks from verified sellers"
          products={data?.featured ?? []}
          loading={loading}
          action={<ViewAll search={{ sort: "rating" }} />}
        />

        <ProductRail
          title="Top rated"
          subtitle="Rated 4★ and above by verified buyers"
          products={data?.topRated ?? []}
          loading={loading}
          action={<ViewAll search={{ rating: 4, sort: "rating" }} />}
        />

        <ProductRail
          title="New arrivals"
          subtitle="Fresh in from our sellers"
          products={data?.newArrivals ?? []}
          loading={loading}
          action={<ViewAll search={{ sort: "newest" }} />}
        />

        <ProductRail title="Recently viewed" products={recentlyViewed} />

        <BrandStrip brands={data?.brands ?? []} />

        <ReviewsSection reviews={data?.reviews ?? []} />

        <NewsletterBand />

        <SellerCta />
      </PageContainer>
    </SiteLayout>
  );
}
