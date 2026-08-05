import { useEffect, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { banners } from "@/data/catalog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Auto-advancing hero banner slider with arrow and dot controls. */
export function HeroSlider() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % banners.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [paused]);

  function step(direction: 1 | -1) {
    setIndex((value) => (value + direction + banners.length) % banners.length);
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-soft"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured offers"
    >
      <div className="relative h-[380px] sm:h-[420px] lg:h-[480px]">
        {banners.map((banner, position) => (
          <div
            key={banner.id}
            className={cn(
              "absolute inset-0 transition-opacity duration-700",
              position === index ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            aria-hidden={position !== index}
          >
            <img
              src={banner.image}
              alt={banner.title}
              width={1600}
              height={912}
              loading={position === 0 ? "eager" : "lazy"}
              className="h-full w-full object-cover"
            />
            <div
              className={cn(
                "absolute inset-0",
                banner.tone === "dark"
                  ? "bg-gradient-to-r from-black/85 via-black/55 to-transparent"
                  : "bg-gradient-to-r from-white/92 via-white/70 to-transparent",
              )}
            />
            <div className="absolute inset-0 flex items-center">
              <div
                className={cn(
                  "max-w-xl space-y-4 px-6 sm:px-10 lg:px-14",
                  banner.tone === "dark" ? "text-white" : "text-[#232F3E]",
                )}
              >
                <span className="inline-block rounded-full bg-primary px-3 py-1 text-xs font-bold tracking-wide text-primary-foreground uppercase">
                  {banner.eyebrow}
                </span>
                {position === 0 ? (
                  <h1 className="font-display text-3xl leading-[1.05] font-extrabold sm:text-4xl lg:text-5xl">
                    {banner.title}
                  </h1>
                ) : (
                  <p className="font-display text-3xl leading-[1.05] font-extrabold sm:text-4xl lg:text-5xl">
                    {banner.title}
                  </p>
                )}
                <p className="max-w-md text-sm opacity-90 sm:text-base">{banner.subtitle}</p>
                <Button size="lg" className="rounded-xl font-bold">
                  {banner.cta}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button
        variant="secondary"
        size="icon"
        onClick={() => step(-1)}
        aria-label="Previous slide"
        className="absolute top-1/2 left-3 hidden -translate-y-1/2 rounded-full shadow-soft sm:inline-flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <Button
        variant="secondary"
        size="icon"
        onClick={() => step(1)}
        aria-label="Next slide"
        className="absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-full shadow-soft sm:inline-flex"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>

      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
        {banners.map((banner, position) => (
          <button
            key={banner.id}
            type="button"
            onClick={() => setIndex(position)}
            aria-label={`Go to slide ${position + 1}`}
            aria-current={position === index}
            className={cn(
              "h-2 rounded-full transition-all duration-300",
              position === index ? "w-8 bg-primary" : "w-2 bg-foreground/30",
            )}
          />
        ))}
      </div>
    </section>
  );
}
