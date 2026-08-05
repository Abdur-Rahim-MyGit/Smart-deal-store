import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  ChevronDown,
  Heart,
  MapPin,
  Menu,
  Search,
  ShoppingCart,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { categories, searchProducts, trendingSearches } from "@/data/catalog";
import { formatPrice } from "@/lib/format";
import { useStore } from "@/context/store";
import { cn } from "@/lib/utils";

/** Sticky storefront header: search, mega nav, cart, wishlist, account. */
export function Header() {
  const { cartCount, wishlist } = useStore();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);

  const results = searchProducts(query);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
      <div className="brand-gradient hidden justify-center px-4 py-1.5 text-center text-xs font-semibold text-ink lg:flex">
        Free delivery over {formatPrice(499)} · 7-day returns · Beauty Week live now
      </div>

      <div className="mx-auto grid max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6 lg:gap-6 lg:px-8">
        <div className="flex items-center gap-2">
          <MobileNav />
          <Logo />
        </div>

        <div ref={wrapper} className="relative min-w-0">
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border bg-background px-3 transition-all duration-200",
              focused ? "border-ring shadow-glow" : "border-border",
            )}
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setFocused(true)}
              placeholder="Search serums, earbuds, perfumes…"
              aria-label="Search products"
              className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {focused && (
            <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-lift">
              {results.length > 0 ? (
                <ul className="max-h-[380px] overflow-y-auto py-1">
                  {results.map((product) => (
                    <li key={product.id}>
                      <Link
                        to="/product/$slug"
                        params={{ slug: product.slug }}
                        onClick={() => setFocused(false)}
                        className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-accent"
                      >
                        <img
                          src={product.image}
                          alt=""
                          loading="lazy"
                          width={44}
                          height={44}
                          className="h-11 w-11 rounded-lg object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{product.name}</span>
                          <span className="block text-xs text-muted-foreground">{product.brand}</span>
                        </span>
                        <span className="shrink-0 text-sm font-bold">
                          {formatPrice(product.price)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : query ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No matches for “{query}”. Try a brand or category.
                </p>
              ) : (
                <div className="p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    <TrendingUp className="h-3.5 w-3.5" /> Trending searches
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {trendingSearches.map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => setQuery(term)}
                        className="rounded-full border border-border px-3 py-1 text-sm transition-colors hover:bg-accent"
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="hidden items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent xl:flex"
          >
            <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="leading-tight">
              <span className="block text-xs text-muted-foreground">Deliver to</span>
              <span className="block font-semibold">Mumbai 400001</span>
            </span>
          </button>

          <ThemeToggle className="hidden sm:inline-flex" />

          <Button variant="ghost" size="icon" aria-label="Notifications" className="hidden sm:inline-flex">
            <Bell className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" aria-label="Wishlist" className="relative hidden sm:inline-flex">
            <Heart className="h-5 w-5" />
            {wishlist.length > 0 && <CountBadge value={wishlist.length} />}
          </Button>

          <Button variant="ghost" size="icon" aria-label="Account" className="hidden sm:inline-flex">
            <User className="h-5 w-5" />
          </Button>

          <Button variant="ghost" size="icon" aria-label="Cart" className="relative">
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && <CountBadge value={cartCount} />}
          </Button>
        </div>
      </div>

      <nav className="hidden border-t border-border lg:block">
        <ul className="mx-auto flex max-w-[1440px] items-center gap-1 px-4 sm:px-6 lg:px-8">
          {categories.map((category) => (
            <li
              key={category.id}
              className="relative"
              onMouseEnter={() => setOpenCategory(category.id)}
              onMouseLeave={() => setOpenCategory(null)}
            >
              <button
                type="button"
                className="flex items-center gap-1 px-3 py-2.5 text-sm font-semibold transition-colors hover:text-muted-foreground"
              >
                {category.name}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {openCategory === category.id && (
                <div className="absolute top-full left-0 z-50 w-64 overflow-hidden rounded-2xl border border-border bg-popover p-2 shadow-lift">
                  <p className="px-2 pt-1 pb-2 text-xs font-semibold text-muted-foreground">
                    {category.tagline}
                  </p>
                  {category.children.map((child) => (
                    <span
                      key={child}
                      className="block cursor-pointer rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent"
                    >
                      {child}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
      {value > 99 ? "99+" : value}
    </span>
  );
}

function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] overflow-y-auto p-0">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle className="font-display text-lg">Shop by category</SheetTitle>
        </SheetHeader>
        <div className="p-2">
          {categories.map((category) => (
            <div key={category.id} className="rounded-xl p-2">
              <p className="text-sm font-bold">{category.name}</p>
              <p className="text-xs text-muted-foreground">{category.children.join(" · ")}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-border p-4">
          <span className="text-sm font-semibold">Appearance</span>
          <ThemeToggle />
        </div>
      </SheetContent>
    </Sheet>
  );
}
