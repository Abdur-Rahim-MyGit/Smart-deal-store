import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Clock,
  Headphones,
  Heart,
  LogOut,
  MapPin,
  Menu,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  Store,
  Tag,
  TrendingUp,
  User as UserIcon,
  Wallet,
  X,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ThemeDropdown } from "@/components/layout/theme-dropdown";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/context/store";
import { useCategories } from "@/hooks/use-categories";
import { useDisplayPrice, useSettings } from "@/hooks/use-settings";
import { useDebounce } from "@/hooks/use-debounce";
import { useNotifications } from "@/hooks/use-notifications";
import { api } from "@/lib/api";
import { formatPrice, initials, timeAgo } from "@/lib/format";
import type { ProductListing } from "@/lib/types";
import { cn } from "@/lib/utils";

const TRENDING_SEARCHES = [
  "vitamin c serum",
  "anc earbuds",
  "oud perfume oil",
  "sunscreen",
  "leather handbag",
  "hair oil",
];
const RECENT_SEARCHES_KEY = "smartdeal.recentSearches";

/** Sticky storefront header: announcement, search, category navigation and account actions. */
export function Header() {
  const settings = useSettings();
  const { user, cartCount, wishlist } = useStore();
  const defaultAddress =
    user?.addresses?.find((address) => address.isDefault) ?? user?.addresses?.[0];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
      {settings.announcement && (
        <div className="brand-gradient px-4 py-1.5 text-center text-[11px] font-semibold text-ink sm:text-xs">
          {settings.announcement}
        </div>
      )}

      <div className="mx-auto grid max-w-[1440px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:gap-3 sm:px-6 lg:gap-6 lg:px-8">
        <div className="flex items-center gap-1">
          <MobileNav />
          <Logo />
        </div>

        <SearchBox className="hidden md:block" />

        <div className="flex shrink-0 items-center justify-end gap-0.5 sm:gap-1">
          {user ? (
            <Link
              to="/account"
              search={{ tab: "addresses" }}
              className="hidden items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent xl:flex"
            >
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="leading-tight">
                <span className="block text-[11px] text-muted-foreground">Deliver to</span>
                <span className="block max-w-[130px] truncate font-semibold">
                  {defaultAddress
                    ? `${defaultAddress.area}, ${defaultAddress.emirate}`
                    : "Add an address"}
                </span>
              </span>
            </Link>
          ) : (
            <span className="hidden items-center gap-1.5 px-2 text-left text-sm xl:flex">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="leading-tight">
                <span className="block text-[11px] text-muted-foreground">Delivering to</span>
                <span className="block font-semibold">All 7 emirates</span>
              </span>
            </span>
          )}

          <ThemeDropdown showLabel={false} className="hidden sm:inline-flex" />
          {user && <NotificationsMenu />}

          <Button asChild variant="ghost" size="icon" className="relative hidden sm:inline-flex">
            <Link to="/wishlist" aria-label={`Wishlist (${wishlist.length})`}>
              <Heart className="h-5 w-5" />
              {wishlist.length > 0 && <CountBadge value={wishlist.length} />}
            </Link>
          </Button>

          <AccountMenu />

          <Button asChild variant="ghost" size="icon" className="relative">
            <Link to="/cart" aria-label={`Cart (${cartCount} items)`}>
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && <CountBadge value={cartCount} />}
            </Link>
          </Button>
        </div>
      </div>

      <div className="px-4 pb-3 md:hidden">
        <SearchBox />
      </div>

      <CategoryNav />
    </header>
  );
}

function CountBadge({ value }: { value: number }) {
  return (
    <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground ring-2 ring-card">
      {value > 99 ? "99+" : value}
    </span>
  );
}

/* ---------------- Search ---------------- */

export function SearchBox({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const wrapper = useRef<HTMLDivElement>(null);
  const term = useDebounce(query.trim(), 250);
  const { categories } = useCategories();
  const displayPrice = useDisplayPrice();

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["search-suggestions", term],
    queryFn: ({ signal }) =>
      api<{ products: ProductListing[] }>("/products", {
        query: { q: term, limit: 6 },
        signal,
      }).then((response) => response.products),
    enabled: term.length >= 2,
    staleTime: 60_000,
  });

  useEffect(() => {
    try {
      setRecent(JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) || "[]") as string[]);
    } catch {
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (wrapper.current && !wrapper.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const matchingCategories =
    term.length >= 2
      ? categories
          .filter((category) => category.name.toLowerCase().includes(term.toLowerCase()))
          .slice(0, 3)
      : [];

  const saveRecent = (value: string) => {
    const next = [
      value,
      ...recent.filter((entry) => entry.toLowerCase() !== value.toLowerCase()),
    ].slice(0, 6);
    setRecent(next);
    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const go = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    saveRecent(trimmed);
    setQuery(trimmed);
    setOpen(false);
    onNavigate?.();
    void navigate({ to: "/search", search: { q: trimmed } });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    go(query);
  };

  const clearRecent = () => {
    setRecent([]);
    try {
      window.localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore
    }
  };

  return (
    <div ref={wrapper} className={cn("relative min-w-0", className)}>
      <form
        onSubmit={onSubmit}
        role="search"
        className={cn(
          "flex h-11 items-center gap-2 rounded-xl border bg-background pr-1 pl-3 transition-shadow",
          open ? "border-ring shadow-glow" : "border-border",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Search products, brands and categories"
          aria-label="Search products"
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-accent"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <Button type="submit" size="sm" className="h-9 rounded-lg px-3 font-semibold">
          Search
        </Button>
      </form>

      {open && (
        <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-lift">
          {term.length >= 2 ? (
            <div className="max-h-[420px] overflow-y-auto py-1">
              {matchingCategories.map((category) => (
                <Link
                  key={category._id}
                  to="/category/$slug"
                  params={{ slug: category.slug }}
                  onClick={() => {
                    setOpen(false);
                    onNavigate?.();
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent"
                >
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span>
                    in <span className="font-semibold">{category.name}</span>
                  </span>
                </Link>
              ))}
              {results.map((product) => (
                <Link
                  key={product._id}
                  to="/product/$slug"
                  params={{ slug: product.slug }}
                  onClick={() => {
                    saveRecent(term);
                    setOpen(false);
                    onNavigate?.();
                  }}
                  className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-accent"
                >
                  <img
                    src={product.thumbnail}
                    alt=""
                    loading="lazy"
                    className="h-11 w-11 rounded-lg object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{product.title}</span>
                    <span className="block text-xs text-muted-foreground">{product.brand}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold">
                    {formatPrice(displayPrice.display(product.price))}
                  </span>
                </Link>
              ))}
              {!isFetching && results.length === 0 && matchingCategories.length === 0 && (
                <p className="px-4 py-5 text-center text-sm text-muted-foreground">
                  No quick matches for “{term}”.
                </p>
              )}
              <button
                type="button"
                onClick={() => go(query)}
                className="flex w-full items-center gap-2 border-t border-border px-4 py-3 text-left text-sm font-semibold hover:bg-accent"
              >
                <Search className="h-4 w-4" /> See all results for “{query.trim()}”
              </button>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              {recent.length > 0 && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                      <Clock className="h-3.5 w-3.5" /> Recent searches
                    </p>
                    <button
                      type="button"
                      onClick={clearRecent}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((entry) => (
                      <button
                        key={entry}
                        type="button"
                        onClick={() => go(entry)}
                        className="rounded-full border border-border px-3 py-1 text-sm transition-colors hover:bg-accent"
                      >
                        {entry}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wide text-muted-foreground uppercase">
                  <TrendingUp className="h-3.5 w-3.5" /> Trending searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {TRENDING_SEARCHES.map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => go(entry)}
                      className="rounded-full border border-border px-3 py-1 text-sm transition-colors hover:bg-accent"
                    >
                      {entry}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- Account & notifications ---------------- */

function AccountMenu() {
  const { user, hydrated, logout } = useStore();

  if (!hydrated) return <span className="hidden h-9 w-9 sm:block" aria-hidden />;

  if (!user) {
    return (
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="hidden rounded-xl font-semibold sm:inline-flex"
      >
        <Link to="/login">
          <UserIcon className="mr-1.5 h-4 w-4" /> Sign in
        </Link>
      </Button>
    );
  }

  const itemClass = "cursor-pointer rounded-lg";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="hidden gap-1.5 rounded-xl px-1.5 sm:inline-flex"
          aria-label="Account menu"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
            {initials(user.name)}
          </span>
          <span className="hidden max-w-[90px] truncate text-sm font-semibold lg:inline">
            {user.name.split(" ")[0]}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl p-1.5">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.role === "Admin" && (
          <DropdownMenuItem asChild className={itemClass}>
            <Link to="/admin-dashboard">
              <ShieldCheck className="mr-2 h-4 w-4" /> Admin console
            </Link>
          </DropdownMenuItem>
        )}
        {user.role === "Vendor" && (
          <DropdownMenuItem asChild className={itemClass}>
            <Link to="/vendor-dashboard">
              <Store className="mr-2 h-4 w-4" /> Seller dashboard
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className={itemClass}>
          <Link to="/account">
            <UserIcon className="mr-2 h-4 w-4" /> My account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={itemClass}>
          <Link to="/account" search={{ tab: "orders" }}>
            <Package className="mr-2 h-4 w-4" /> Orders
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={itemClass}>
          <Link to="/wishlist">
            <Heart className="mr-2 h-4 w-4" /> Wishlist
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={itemClass}>
          <Link to="/account" search={{ tab: "wallet" }}>
            <Wallet className="mr-2 h-4 w-4" /> Wallet
            <span className="ml-auto text-xs font-semibold text-muted-foreground">
              {formatPrice(user.walletBalance)}
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={itemClass}>
          <Link to="/account" search={{ tab: "support" }}>
            <Headphones className="mr-2 h-4 w-4" /> Help & support
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => void logout()}
          className={cn(itemClass, "text-destructive focus:text-destructive")}
        >
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationsMenu() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && <CountBadge value={unreadCount} />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display font-bold">Notifications</p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Mark all as read
            </button>
          )}
        </div>
        <div className="max-h-[380px] overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification._id}
                type="button"
                onClick={() => {
                  if (!notification.isRead) markRead(notification._id);
                  setOpen(false);
                  if (notification.link) router.history.push(notification.link);
                }}
                className={cn(
                  "flex w-full gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-accent",
                  !notification.isRead && "bg-primary/10",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    notification.isRead ? "bg-transparent" : "bg-foreground",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{notification.title}</span>
                  <span className="line-clamp-2 block text-xs text-muted-foreground">
                    {notification.message}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {timeAgo(notification.createdAt)}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ---------------- Navigation ---------------- */

function CategoryNav() {
  const { tree } = useCategories();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <nav className="hidden border-t border-border lg:block" aria-label="Shop by category">
      <ul className="mx-auto flex h-[42px] max-w-[1440px] items-center gap-0.5 px-4 sm:px-6 lg:px-8">
        <li>
          <Link
            to="/search"
            search={{ discount: 20, sort: "discount" }}
            className="flex items-center gap-1.5 px-2.5 py-2.5 text-[13px] font-bold text-destructive"
          >
            <Tag className="h-3.5 w-3.5" /> Deals
          </Link>
        </li>
        {tree.map((category) => (
          <li
            key={category._id}
            className="relative"
            onMouseEnter={() => setOpenId(category._id)}
            onMouseLeave={() => setOpenId(null)}
          >
            <Link
              to="/category/$slug"
              params={{ slug: category.slug }}
              className="flex items-center gap-1 px-2.5 py-2.5 text-[13px] font-semibold whitespace-nowrap transition-colors hover:text-muted-foreground"
            >
              {category.name}
              {category.children.length > 0 && <ChevronDown className="h-3.5 w-3.5 opacity-50" />}
            </Link>
            {openId === category._id && category.children.length > 0 && (
              <div className="absolute top-full left-0 z-50 w-60 rounded-2xl border border-border bg-popover p-2 shadow-lift">
                {category.description && (
                  <p className="px-2 pt-1 pb-2 text-xs text-muted-foreground">
                    {category.description}
                  </p>
                )}
                {category.children.map((child) => (
                  <Link
                    key={child._id}
                    to="/category/$slug"
                    params={{ slug: child.slug }}
                    onClick={() => setOpenId(null)}
                    className="block rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {child.name}
                  </Link>
                ))}
                <Link
                  to="/category/$slug"
                  params={{ slug: category.slug }}
                  onClick={() => setOpenId(null)}
                  className="mt-1 flex items-center justify-between rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-accent"
                >
                  Shop all <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </li>
        ))}
        <li className="ml-auto hidden xl:block">
          <Link
            to="/pages/$slug"
            params={{ slug: "sell-on-smart-deal" }}
            className="flex items-center gap-1.5 px-2.5 py-2.5 text-[13px] font-semibold text-muted-foreground hover:text-foreground"
          >
            <Store className="h-4 w-4" /> Sell on Smart Deal
          </Link>
        </li>
      </ul>
    </nav>
  );
}

function MobileNav() {
  const { tree } = useCategories();
  const { user, logout } = useStore();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const linkClass =
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-accent";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex w-[310px] flex-col gap-0 overflow-y-auto p-0">
        <SheetHeader className="border-b border-border p-4 text-left">
          <SheetTitle className="font-display">
            {user ? `Hi, ${user.name.split(" ")[0]}` : "Welcome to Smart Deal"}
          </SheetTitle>
          {!user && (
            <div className="flex gap-2 pt-2">
              <Button asChild size="sm" className="flex-1 rounded-xl">
                <Link to="/login" onClick={close}>
                  Sign in
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="flex-1 rounded-xl">
                <Link to="/login" search={{ mode: "register" }} onClick={close}>
                  Register
                </Link>
              </Button>
            </div>
          )}
        </SheetHeader>

        <div className="p-2">
          <Link
            to="/search"
            search={{ discount: 20, sort: "discount" }}
            onClick={close}
            className={cn(linkClass, "text-destructive")}
          >
            <Tag className="h-4 w-4" /> Today's deals
          </Link>
          <p className="px-3 pt-3 pb-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">
            Shop by category
          </p>
          {tree.map((category) => (
            <details key={category._id} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-accent">
                {category.name}
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              </summary>
              <div className="pb-2 pl-3">
                <Link
                  to="/category/$slug"
                  params={{ slug: category.slug }}
                  onClick={close}
                  className="block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-accent"
                >
                  All {category.name}
                </Link>
                {category.children.map((child) => (
                  <Link
                    key={child._id}
                    to="/category/$slug"
                    params={{ slug: child.slug }}
                    onClick={close}
                    className="block rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            </details>
          ))}
        </div>

        <div className="border-t border-border p-2">
          {user?.role === "Admin" && (
            <Link to="/admin-dashboard" onClick={close} className={linkClass}>
              <ShieldCheck className="h-4 w-4" /> Admin console
            </Link>
          )}
          {user?.role === "Vendor" && (
            <Link to="/vendor-dashboard" onClick={close} className={linkClass}>
              <Store className="h-4 w-4" /> Seller dashboard
            </Link>
          )}
          {user && (
            <Link to="/account" search={{ tab: "orders" }} onClick={close} className={linkClass}>
              <Package className="h-4 w-4" /> My orders
            </Link>
          )}
          <Link to="/wishlist" onClick={close} className={linkClass}>
            <Heart className="h-4 w-4" /> Wishlist
          </Link>
          <Link to="/pages/$slug" params={{ slug: "faq" }} onClick={close} className={linkClass}>
            <Headphones className="h-4 w-4" /> Help centre
          </Link>
          <Link
            to="/pages/$slug"
            params={{ slug: "sell-on-smart-deal" }}
            onClick={close}
            className={linkClass}
          >
            <Store className="h-4 w-4" /> Sell on Smart Deal
          </Link>
        </div>

        <div className="mt-auto space-y-2 border-t border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Theme</span>
            <ThemeDropdown showLabel={false} />
          </div>
          {user && (
            <Button
              variant="outline"
              className="w-full rounded-xl text-destructive"
              onClick={() => {
                close();
                void logout();
              }}
            >
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
