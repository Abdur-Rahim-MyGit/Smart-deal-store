import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { followBannerLink } from "@/components/common/banner-slots";
import { Button } from "@/components/ui/button";
import type { Banner } from "@/lib/types";
import { cn } from "@/lib/utils";
import heroBeauty from "@/assets/hero-beauty.jpg";
import heroElectronics from "@/assets/hero-electronics.jpg";
import heroFashion from "@/assets/hero-fashion.jpg";

export interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  imageUrl: string;
  linkUrl: string;
  tone: "light" | "dark";
}

/** Used when no hero banners are published in the admin console. */
const FALLBACK_SLIDES: HeroSlide[] = [
  {
    id: "fallback-beauty",
    eyebrow: "Beauty Week",
    title: "Glow season starts here",
    subtitle: "Serums, SPF and moisturisers from the labels our customers keep repurchasing.",
    ctaLabel: "Shop skincare",
    imageUrl: heroBeauty,
    linkUrl: "/category/skincare",
    tone: "dark",
  },
  {
    id: "fallback-tech",
    eyebrow: "Tech Drop",
    title: "Audio that earns its shelf space",
    subtitle: "ANC earbuds, fast chargers and wearables — all with official UAE warranty.",
    ctaLabel: "Shop electronics",
    imageUrl: heroElectronics,
    linkUrl: "/category/electronics",
    tone: "light",
  },
  {
    id: "fallback-fashion",
    eyebrow: "New Season",
    title: "Quiet luxury, honestly priced",
    subtitle: "Full-grain leather, European linen and steel mesh without the boutique markup.",
    ctaLabel: "Shop fashion",
    imageUrl: heroFashion,
    linkUrl: "/category/fashion",
    tone: "dark",
  },
];

/** Maps admin banners to slides, falling back to the bundled artwork. */
export function heroSlides(banners: Banner[]): HeroSlide[] {
  const slides = banners
    .filter((banner) => Boolean(banner.imageUrl))
    .map<HeroSlide>((banner) => ({
      id: banner._id,
      eyebrow: banner.eyebrow || "Smart Deal",
      title: banner.title,
      subtitle: banner.subtitle || "",
      ctaLabel: banner.ctaLabel || "Shop now",
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl || "/search",
      tone: banner.tone === "light" ? "light" : "dark",
    }));
  return slides.length > 0 ? slides : FALLBACK_SLIDES;
}

const FRAME = "relative h-[380px] overflow-hidden rounded-3xl sm:h-[420px] lg:h-[480px]";

export function HeroCarouselSkeleton() {
  return <div className={cn(FRAME, "animate-pulse border border-border bg-muted")} aria-hidden />;
}

/** Autoplaying hero banner carousel with arrows, dots and touch swipe. */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = slides.length;

  const step = useCallback(
    (direction: 1 | -1) => setIndex((current) => (current + direction + count) % count),
    [count],
  );

  useEffect(() => {
    if (paused || count < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 6000);
    return () => window.clearInterval(timer);
  }, [paused, count]);

  if (count === 0) return null;

  return (
    <section
      className={cn(FRAME, "border border-border bg-card shadow-soft")}
      aria-roledescription="carousel"
      aria-label="Featured offers"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") step(1);
        if (event.key === "ArrowLeft") step(-1);
      }}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        const end = event.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start === null || end === undefined) return;
        const delta = end - start;
        if (Math.abs(delta) > 45) step(delta < 0 ? 1 : -1);
      }}
    >
      {slides.map((slide, position) => {
        const active = position === index;
        const dark = slide.tone === "dark";
        return (
          <div
            key={slide.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-700 ease-out",
              active ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            aria-hidden={!active}
            role="group"
            aria-roledescription="slide"
            aria-label={`${position + 1} of ${count}`}
          >
            <img
              src={slide.imageUrl}
              alt={slide.title}
              width={1600}
              height={720}
              loading={position === 0 ? "eager" : "lazy"}
              fetchPriority={position === 0 ? "high" : "auto"}
              decoding={position === 0 ? "sync" : "async"}
              className="h-full w-full object-cover"
            />
            <div
              className={cn(
                "absolute inset-0",
                dark
                  ? "bg-gradient-to-r from-black/85 via-black/60 to-black/10"
                  : "bg-gradient-to-r from-white/95 via-white/75 to-white/15",
              )}
            />
            <div className="absolute inset-0 flex items-center">
              <div
                className={cn(
                  "max-w-xl space-y-3 px-6 sm:space-y-4 sm:px-10 lg:px-14",
                  dark ? "text-white" : "text-slate-900",
                )}
              >
                <span className="inline-block rounded-full bg-primary px-3 py-1 text-[11px] font-bold tracking-wide text-primary-foreground uppercase">
                  {slide.eyebrow}
                </span>
                {position === 0 ? (
                  <h1 className="font-display text-3xl leading-[1.05] font-extrabold sm:text-4xl lg:text-5xl">
                    {slide.title}
                  </h1>
                ) : (
                  <p className="font-display text-3xl leading-[1.05] font-extrabold sm:text-4xl lg:text-5xl">
                    {slide.title}
                  </p>
                )}
                {slide.subtitle && (
                  <p className="max-w-md text-sm opacity-90 sm:text-base">{slide.subtitle}</p>
                )}
                <Button
                  size="lg"
                  tabIndex={active ? 0 : -1}
                  onClick={() => followBannerLink(router, slide.linkUrl)}
                  className="rounded-xl font-bold"
                >
                  {slide.ctaLabel}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous slide"
            className="absolute top-1/2 left-3 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-card/90 text-foreground shadow-soft backdrop-blur transition hover:bg-card sm:grid"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next slide"
            className="absolute top-1/2 right-3 hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-card/90 text-foreground shadow-soft backdrop-blur transition hover:bg-card sm:grid"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((slide, position) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`Go to slide ${position + 1}: ${slide.title}`}
                aria-current={position === index}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  position === index ? "w-8 bg-primary" : "w-2 bg-card/70 hover:bg-card",
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
