import { useEffect, useRef, useState } from "react";
import { Expand } from "lucide-react";
import { cn } from "@/lib/utils";

/** Main image + thumbnail strip with hover zoom on desktop and swipe on touch. */
export function ProductGallery({
  images,
  title,
  discountPercent = 0,
}: {
  images: string[];
  title: string;
  discountPercent?: number | undefined;
}) {
  const gallery = images.length > 0 ? images : [""];
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const touchStartX = useRef<number | null>(null);
  const leadImage = gallery[0];

  // A variant with its own photo becomes the lead image — show it straight away.
  useEffect(() => {
    setIndex(0);
  }, [leadImage]);

  const active = gallery[Math.min(index, gallery.length - 1)] ?? "";
  const step = (direction: 1 | -1) =>
    setIndex((current) => (current + direction + gallery.length) % gallery.length);

  return (
    <div className="flex flex-col gap-3 sm:flex-row-reverse sm:gap-4">
      <div
        className="relative aspect-square min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-card"
        onMouseMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          setZoom({
            x: ((event.clientX - bounds.left) / bounds.width) * 100,
            y: ((event.clientY - bounds.top) / bounds.height) * 100,
          });
        }}
        onMouseLeave={() => setZoom(null)}
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touchStartX.current;
          const end = event.changedTouches[0]?.clientX;
          touchStartX.current = null;
          if (start === null || end === undefined || gallery.length < 2) return;
          const delta = end - start;
          if (Math.abs(delta) > 45) step(delta < 0 ? 1 : -1);
        }}
      >
        <img
          src={active}
          alt={`${title} — image ${index + 1} of ${gallery.length}`}
          width={900}
          height={900}
          loading="eager"
          fetchPriority="high"
          className="h-full w-full object-cover transition-transform duration-200 ease-out"
          style={
            zoom
              ? { transform: "scale(1.85)", transformOrigin: `${zoom.x}% ${zoom.y}%` }
              : { transform: "scale(1)", transformOrigin: "center" }
          }
        />

        {discountPercent > 0 && (
          <span className="absolute top-4 left-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-soft">
            -{discountPercent}% off
          </span>
        )}

        <span className="pointer-events-none absolute right-4 bottom-4 hidden items-center gap-1.5 rounded-full bg-card/90 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground backdrop-blur sm:inline-flex">
          <Expand className="h-3.5 w-3.5" /> Hover to zoom
        </span>

        {gallery.length > 1 && (
          <span className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 sm:hidden">
            {gallery.map((image, position) => (
              <span
                key={`${image}-${position}`}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  position === index ? "w-5 bg-primary" : "w-1.5 bg-foreground/25",
                )}
              />
            ))}
          </span>
        )}
      </div>

      {gallery.length > 1 && (
        <div
          className="rail-scroll flex gap-2 overflow-x-auto sm:w-20 sm:flex-col sm:overflow-y-auto"
          role="group"
          aria-label={`${title} images`}
        >
          {gallery.map((image, position) => (
            <button
              key={`${image}-${position}`}
              type="button"
              onClick={() => setIndex(position)}
              aria-label={`Show image ${position + 1}`}
              aria-current={position === index}
              className={cn(
                "h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-card transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:h-20 sm:w-20",
                position === index
                  ? "border-foreground"
                  : "border-border hover:border-muted-foreground",
              )}
            >
              <img
                src={image}
                alt=""
                loading="lazy"
                width={160}
                height={160}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
