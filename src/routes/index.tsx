import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { HeroSlider } from "@/components/home/hero-slider";
import { CategoryCarousel } from "@/components/home/category-carousel";
import { FlashDeals } from "@/components/home/flash-deals";
import { BrandStrip } from "@/components/home/brand-strip";
import { CollectionTiles } from "@/components/home/collection-tiles";
import { ReviewsSection } from "@/components/home/reviews-section";
import { NewsletterBand } from "@/components/home/newsletter-band";
import { ProductRail } from "@/components/product/product-rail";
import { byCategory, byTag } from "@/data/catalog";

const title = "Smart Deal — Beauty, Tech & Fashion at Honest Prices";
const description =
  "Shop authentic beauty, skincare, perfumes, electronics, fashion and home essentials on Smart Deal. Flash deals daily, free delivery over ₹499, 7-day returns.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-12 px-4 pt-5 pb-24 sm:px-6 lg:px-8 lg:pb-10">
        <HeroSlider />
        <CategoryCarousel />
        <FlashDeals />
        <ProductRail
          title="Today's deals"
          subtitle="Fresh price cuts, updated every morning"
          products={byTag("deal", 10)}
        />
        <ProductRail
          title="Trending now"
          subtitle="What shoppers are adding to cart this week"
          products={byTag("trending", 10)}
        />
        <CollectionTiles />
        <ProductRail
          title="Best sellers"
          subtitle="Repeat purchases speak louder than ads"
          products={byTag("bestseller", 10)}
        />
        <BrandStrip />
        <ProductRail
          title="Top rated"
          subtitle="Rated 4.5 and above by verified buyers"
          products={byTag("toprated", 10)}
        />
        <ProductRail
          title="New arrivals"
          subtitle="Just landed in our warehouses"
          products={byTag("new", 10)}
        />
        <ProductRail
          title="Skincare essentials"
          subtitle="Actives, barrier care and daily SPF"
          products={byCategory("skincare", 10)}
        />
        <ReviewsSection />
        <NewsletterBand />
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  );
}
