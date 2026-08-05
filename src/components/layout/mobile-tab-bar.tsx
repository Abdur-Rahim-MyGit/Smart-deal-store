import { Heart, Home, LayoutGrid, ShoppingCart, User } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useStore } from "@/context/store";

/** Mobile-only bottom navigation, matching the app-style shell. */
export function MobileTabBar() {
  const { cartCount, wishlist } = useStore();

  const items = [
    { label: "Home", icon: Home, count: 0 },
    { label: "Categories", icon: LayoutGrid, count: 0 },
    { label: "Wishlist", icon: Heart, count: wishlist.length },
    { label: "Cart", icon: ShoppingCart, count: cartCount },
    { label: "Account", icon: User, count: 0 },
  ];

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map(({ label, icon: Icon, count }) => (
          <li key={label}>
            {label === "Home" ? (
              <Link
                to="/"
                className="flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold"
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ) : (
              <button
                type="button"
                className="flex w-full flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-muted-foreground"
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {count > 0 && (
                    <span className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {count}
                    </span>
                  )}
                </span>
                {label}
              </button>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
