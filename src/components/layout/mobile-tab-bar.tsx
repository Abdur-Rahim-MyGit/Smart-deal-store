import { Heart, Home, LayoutGrid, User } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { CartIcon } from "@/components/common/cart-icon";
import { useStore } from "@/context/store";

const itemClass =
  "flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold text-muted-foreground";
const activeProps = { className: "!text-foreground" };

function Dot({ value }: { value: number }) {
  if (value <= 0) return null;
  return (
    <span className="absolute -top-1.5 -right-2 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
      {value > 99 ? "99+" : value}
    </span>
  );
}

/** Mobile bottom navigation. */
export function MobileTabBar() {
  const { cartCount, wishlist, user } = useStore();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="grid grid-cols-5">
        <li>
          <Link
            to="/"
            className={itemClass}
            activeProps={activeProps}
            activeOptions={{ exact: true }}
          >
            <Home className="h-5 w-5" /> Home
          </Link>
        </li>
        <li>
          <Link to="/search" className={itemClass} activeProps={activeProps}>
            <LayoutGrid className="h-5 w-5" /> Shop
          </Link>
        </li>
        <li>
          <Link to="/wishlist" className={itemClass} activeProps={activeProps}>
            <span className="relative">
              <Heart className="h-5 w-5" />
              <Dot value={wishlist.length} />
            </span>
            Wishlist
          </Link>
        </li>
        <li>
          <Link to="/cart" className={itemClass} activeProps={activeProps}>
            <span className="relative">
              <CartIcon className="h-5 w-5" />
              <Dot value={cartCount} />
            </span>
            Cart
          </Link>
        </li>
        <li>
          {user ? (
            <Link to="/account" className={itemClass} activeProps={activeProps}>
              <User className="h-5 w-5" /> Account
            </Link>
          ) : (
            <Link to="/login" className={itemClass} activeProps={activeProps}>
              <User className="h-5 w-5" /> Sign in
            </Link>
          )}
        </li>
      </ul>
    </nav>
  );
}
