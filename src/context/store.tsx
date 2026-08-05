import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { products, type Product } from "@/data/catalog";

/**
 * Cart + wishlist store. Persisted to localStorage in Phase 1; the same public
 * API is backed by the Cloud database in a later phase.
 */

export interface CartLine {
  id: string;
  qty: number;
}

interface StoreValue {
  cart: CartLine[];
  wishlist: string[];
  cartCount: number;
  cartTotal: number;
  cartSavings: number;
  addToCart: (product: Product, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  removeFromCart: (id: string) => void;
  toggleWishlist: (product: Product) => void;
  isWishlisted: (id: string) => boolean;
  cartProducts: Array<{ product: Product; qty: number }>;
}

const StoreContext = createContext<StoreValue | null>(null);

const CART_KEY = "smartdeal.cart";
const WISH_KEY = "smartdeal.wishlist";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setCart(read<CartLine[]>(CART_KEY, []));
    setWishlist(read<string[]>(WISH_KEY, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart, hydrated]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
  }, [wishlist, hydrated]);

  const addToCart = useCallback((product: Product, qty = 1) => {
    setCart((prev) => {
      const existing = prev.find((line) => line.id === product.id);
      if (existing) {
        return prev.map((line) =>
          line.id === product.id
            ? { ...line, qty: Math.min(line.qty + qty, product.stock) }
            : line,
        );
      }
      return [...prev, { id: product.id, qty: Math.min(qty, product.stock) }];
    });
    toast.success("Added to cart", { description: product.name });
  }, []);

  const setQty = useCallback((id: string, qty: number) => {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((line) => line.id !== id)
        : prev.map((line) => (line.id === id ? { ...line, qty } : line)),
    );
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((line) => line.id !== id));
  }, []);

  const toggleWishlist = useCallback((product: Product) => {
    setWishlist((prev) => {
      if (prev.includes(product.id)) {
        toast("Removed from wishlist", { description: product.name });
        return prev.filter((id) => id !== product.id);
      }
      toast.success("Saved to wishlist", { description: product.name });
      return [...prev, product.id];
    });
  }, []);

  const value = useMemo<StoreValue>(() => {
    const cartProducts = cart
      .map((line) => {
        const product = products.find((item) => item.id === line.id);
        return product ? { product, qty: line.qty } : null;
      })
      .filter((entry): entry is { product: Product; qty: number } => entry !== null);

    return {
      cart,
      wishlist,
      cartProducts,
      cartCount: cart.reduce((sum, line) => sum + line.qty, 0),
      cartTotal: cartProducts.reduce((sum, { product, qty }) => sum + product.price * qty, 0),
      cartSavings: cartProducts.reduce(
        (sum, { product, qty }) => sum + (product.mrp - product.price) * qty,
        0,
      ),
      addToCart,
      setQty,
      removeFromCart,
      toggleWishlist,
      isWishlisted: (id: string) => wishlist.includes(id),
    };
  }, [cart, wishlist, addToCart, setQty, removeFromCart, toggleWishlist]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
