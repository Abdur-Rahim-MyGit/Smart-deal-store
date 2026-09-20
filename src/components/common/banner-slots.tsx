import type { MouseEvent, ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import type { Banner } from "@/lib/types";
import { cn } from "@/lib/utils";

const isExternal = (href: string) => /^https?:\/\//i.test(href);

/** Follows a banner link: in-app paths through the router, full URLs as a normal page load. */
export function followBannerLink(router: ReturnType<typeof useRouter>, href: string) {
  if (isExternal(href)) window.location.assign(href);
  else router.history.push(href);
}

/** Whole-tile link that keeps in-app navigation client-side but still allows open-in-new-tab. */
function BannerLink({
  banner,
  className,
  children,
}: {
  banner: Banner;
  className?: string | undefined;
  children: ReactNode;
}) {
  const router = useRouter();
  const href = banner.linkUrl || "/search";

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (isExternal(href) || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    router.history.push(href);
  }

  return (
    <a href={href} onClick={handleClick} className={cn("group", className)}>
      {children}
    </a>
  );
}

/** Image plus a tone-matched scrim so the copy stays readable on any artwork. */
function BannerArt({ banner, direction }: { banner: Banner; direction: "up" | "right" }) {
  const dark = banner.tone !== "light";
  return (
    <>
      <img
        src={banner.imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
      />
      <span
        aria-hidden
        className={cn(
          "absolute inset-0",
          direction === "up" ? "bg-gradient-to-t" : "bg-gradient-to-r",
          dark ? "from-black/85 via-black/45 to-black/5" : "from-white/95 via-white/70 to-white/10",
        )}
      />
    </>
  );
}

function Eyebrow({ banner }: { banner: Banner }) {
  if (!banner.eyebrow) return null;
  return (
    <span className="inline-block rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground uppercase">
      {banner.eyebrow}
    </span>
  );
}

function Cta({ banner }: { banner: Banner }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold group-hover:gap-2">
      {banner.ctaLabel || "Shop now"} <ArrowRight className="h-3.5 w-3.5 transition-all" />
    </span>
  );
}

const toneText = (banner: Banner) => (banner.tone === "light" ? "text-slate-900" : "text-white");

/** "Promo Grid" banners: smaller promotional tiles on the home page. */
export function PromoGrid({ banners }: { banners: Banner[] }) {
  const tiles = banners.filter((banner) => banner.imageUrl).slice(0, 6);
  if (tiles.length === 0) return null;

  return (
    <section
      aria-label="Promotions"
      className={cn(
        "grid gap-3 sm:gap-4",
        tiles.length === 1 ? "grid-cols-1" : "sm:grid-cols-2",
        tiles.length >= 3 && "lg:grid-cols-3",
      )}
    >
      {tiles.map((banner) => (
        <BannerLink
          key={banner._id}
          banner={banner}
          className={cn(
            "relative flex overflow-hidden rounded-2xl border border-border bg-card shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
            tiles.length === 1 ? "aspect-[16/7] sm:aspect-[16/5]" : "aspect-[16/9]",
          )}
        >
          <BannerArt banner={banner} direction="up" />
          <span className={cn("relative mt-auto w-full space-y-1.5 p-4 sm:p-5", toneText(banner))}>
            <Eyebrow banner={banner} />
            <span className="font-display block text-lg leading-tight font-extrabold sm:text-xl">
              {banner.title}
            </span>
            {banner.subtitle && (
              <span className="line-clamp-2 block text-xs opacity-90">{banner.subtitle}</span>
            )}
            <Cta banner={banner} />
          </span>
        </BannerLink>
      ))}
    </section>
  );
}

/** "Flash Sale Banner": a slim strip shown above the flash deals rail. */
export function FlashSaleStrip({ banner }: { banner: Banner | null | undefined }) {
  if (!banner?.imageUrl) return null;

  return (
    <BannerLink
      banner={banner}
      className="relative mb-5 flex h-24 items-center overflow-hidden rounded-2xl border border-border sm:h-28"
    >
      <BannerArt banner={banner} direction="right" />
      <span
        className={cn(
          "relative flex w-full items-center justify-between gap-4 px-4 sm:px-6",
          toneText(banner),
        )}
      >
        <span className="min-w-0 space-y-1">
          <Eyebrow banner={banner} />
          <span className="font-display block truncate text-base leading-tight font-extrabold sm:text-xl">
            {banner.title}
          </span>
          {banner.subtitle && (
            <span className="hidden truncate text-xs opacity-90 sm:block">{banner.subtitle}</span>
          )}
        </span>
        <span className="shrink-0 rounded-xl bg-primary px-3 py-2 text-primary-foreground">
          <Cta banner={banner} />
        </span>
      </span>
    </BannerLink>
  );
}

/** "Sidebar" banner beside category and search results. Shows the first live one. */
export function SidebarBanner() {
  const { data } = useQuery({
    queryKey: ["banners", "Sidebar"],
    queryFn: ({ signal }) =>
      api<{ banners: Banner[] }>("/public/banners", {
        query: { position: "Sidebar" },
        signal,
      }).then((response) => response.banners),
    staleTime: 5 * 60 * 1000,
  });

  const banner = data?.find((entry) => entry.imageUrl);
  if (!banner) return null;

  return (
    <BannerLink
      banner={banner}
      className="relative flex aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-card shadow-soft"
    >
      <BannerArt banner={banner} direction="up" />
      <span className={cn("relative mt-auto w-full space-y-1.5 p-4", toneText(banner))}>
        <Eyebrow banner={banner} />
        <span className="font-display block text-lg leading-tight font-extrabold">
          {banner.title}
        </span>
        {banner.subtitle && (
          <span className="line-clamp-3 block text-xs opacity-90">{banner.subtitle}</span>
        )}
        <Cta banner={banner} />
      </span>
    </BannerLink>
  );
}
