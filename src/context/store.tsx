import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { acquisitionSource, captureAcquisitionSource } from "@/lib/acquisition";
import {
  ApiError,
  api,
  errorMessage,
  onSessionChange,
  refreshSession,
  setAccessToken,
} from "@/lib/api";
import type { CartData, User, VendorDetails } from "@/lib/types";

/**
 * Global session, cart and wishlist state.
 *
 * Signed-in users: the server cart/wishlist is the source of truth.
 * Guests: lines live in localStorage and are priced via /cart/preview, then
 * merged into the account cart as soon as they sign in.
 */

const GUEST_CART_KEY = "smartdeal.guestCart.v2";
const GUEST_WISHLIST_KEY = "smartdeal.guestWishlist.v2";
const LEGACY_KEYS = ["smartdeal.cart", "smartdeal.wishlist", "smartdeal.token", "smartdeal.user"];
const MAX_QTY = 10;

export interface GuestCartLine {
  productId: string;
  variantSku: string;
  qty: number;
}

export const EMPTY_CART: CartData = {
  items: [],
  savedForLater: [],
  summary: { itemCount: 0, subtotal: 0, savings: 0, hasIssues: false },
};

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: "Customer" | "Vendor";
  vendorDetails?: VendorDetails | undefined;
}

export interface AddToCartInput {
  productId: string;
  variantSku: string | null | undefined;
  qty?: number | undefined;
  title?: string | undefined;
  /** Suppresses this item's toast so batch adds can show one summary instead. */
  silent?: boolean | undefined;
}

interface AuthResponse {
  accessToken: string;
  user: User;
}

/** Staff with two-step sign-in get this instead of a session after their password. */
interface MfaChallengeResponse {
  mfaRequired: true;
  mfaToken: string;
}

type SignInResponse = AuthResponse | MfaChallengeResponse;

/** Thrown by the sign-in actions when an authenticator code is needed to finish. */
export class MfaRequiredError extends Error {
  constructor() {
    super("Enter the code from your authenticator app");
    this.name = "MfaRequiredError";
  }
}

interface StoreValue {
  /** False until the saved session (if any) has been restored. */
  hydrated: boolean;
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
  login: (email: string, password: string) => Promise<User>;
  sendOtp: (phone: string) => Promise<{ devCode?: string; cooldownSeconds?: number }>;
  verifyOtp: (phone: string, code: string) => Promise<User>;
  loginWithGoogle: (credential: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<void>;
  /** A password (or phone code) was accepted and an authenticator code is now needed. */
  mfaPending: boolean;
  completeMfa: (code: string) => Promise<User>;
  cancelMfa: () => void;

  cart: CartData;
  cartReady: boolean;
  cartCount: number;
  addToCart: (input: AddToCartInput) => Promise<boolean>;
  updateCartQty: (productId: string, variantSku: string, qty: number) => Promise<void>;
  removeFromCart: (productId: string, variantSku: string) => Promise<void>;
  saveForLater: (productId: string, variantSku: string) => Promise<void>;
  moveToCart: (productId: string, variantSku: string) => Promise<void>;
  removeSaved: (productId: string, variantSku: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  /** Clears local cart state after an order is placed (the server already emptied it). */
  resetCart: () => void;
  guestCartLines: () => GuestCartLine[];

  wishlist: string[];
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (productId: string, title?: string) => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked (private mode) — state still works for this tab.
  }
}

function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

const sameLine = (a: { productId: string; variantSku: string }, productId: string, sku: string) =>
  a.productId === productId && a.variantSku.toUpperCase() === sku.toUpperCase();

export function StoreProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const [hydrated, setHydrated] = useState(false);
  const [user, setUserState] = useState<User | null>(null);
  const [cart, setCart] = useState<CartData>(EMPTY_CART);
  const [cartReady, setCartReady] = useState(false);
  const [wishlist, setWishlist] = useState<string[]>([]);

  const userRef = useRef<User | null>(null);
  const wishlistRef = useRef<string[]>([]);
  userRef.current = user;
  wishlistRef.current = wishlist;

  /* ---------------- cart plumbing ---------------- */

  const loadServerCart = useCallback(async () => {
    const data = await api<{ cart: CartData }>("/cart");
    setCart(data.cart);
    setCartReady(true);
  }, []);

  const priceGuestCart = useCallback(
    async (lines: GuestCartLine[], depth = 0): Promise<CartData> => {
      if (!lines.length) {
        setCart(EMPTY_CART);
        setCartReady(true);
        return EMPTY_CART;
      }
      const data = await api<{ cart: CartData }>("/cart/preview", {
        method: "POST",
        body: { items: lines },
      });

      // Drop lines for deleted products and clamp quantities to available stock.
      let changed = false;
      const cleaned = lines.flatMap((line) => {
        const match = data.cart.items.find((item) =>
          sameLine(item, line.productId, line.variantSku),
        );
        if (!match) {
          changed = true;
          return [];
        }
        if (match.issue === "insufficient_stock" && match.stock > 0) {
          changed = true;
          return [{ ...line, qty: match.stock }];
        }
        return [line];
      });

      if (changed && depth === 0) {
        writeStorage(GUEST_CART_KEY, cleaned);
        return priceGuestCart(cleaned, 1);
      }
      setCart(data.cart);
      setCartReady(true);
      return data.cart;
    },
    [],
  );

  /* ---------------- session lifecycle ---------------- */

  const adoptSession = useCallback(
    async (nextUser: User) => {
      userRef.current = nextUser;
      setUserState(nextUser);
      setWishlist(nextUser.wishlist ?? []);

      const guestLines = readStorage<GuestCartLine[]>(GUEST_CART_KEY, []);
      const guestWishlist = readStorage<string[]>(GUEST_WISHLIST_KEY, []);
      try {
        if (guestLines.length) {
          const data = await api<{ cart: CartData }>("/cart/merge", {
            method: "POST",
            body: { items: guestLines },
          });
          setCart(data.cart);
          setCartReady(true);
          removeStorage(GUEST_CART_KEY);
        } else {
          await loadServerCart();
        }
        if (guestWishlist.length) {
          const data = await api<{ wishlist: string[] }>("/cart/wishlist/merge", {
            method: "POST",
            body: { productIds: guestWishlist },
          });
          setWishlist(data.wishlist);
          removeStorage(GUEST_WISHLIST_KEY);
        }
      } catch (error) {
        console.error("Could not sync cart after sign-in", error);
        setCartReady(true);
      }
    },
    [loadServerCart],
  );

  const endSession = useCallback(() => {
    userRef.current = null;
    setUserState(null);
    setAccessToken(null);
    setWishlist([]);
    setCart(EMPTY_CART);
    queryClient.removeQueries({
      predicate: (query) =>
        !["public-settings", "categories", "cms-pages", "home"].includes(String(query.queryKey[0])),
    });
  }, [queryClient]);

  // Restore the session from the refresh cookie on first load.
  useEffect(() => {
    LEGACY_KEYS.forEach(removeStorage);
    let cancelled = false;
    (async () => {
      const token = await refreshSession();
      if (cancelled) return;
      if (!token) {
        setWishlist(readStorage<string[]>(GUEST_WISHLIST_KEY, []));
        try {
          await priceGuestCart(readStorage<GuestCartLine[]>(GUEST_CART_KEY, []));
        } catch {
          setCartReady(true);
        }
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [priceGuestCart]);

  // Remember where this browser first arrived from, for sign-up analytics.
  useEffect(() => {
    captureAcquisitionSource();
  }, []);

  // React to refreshes happening anywhere (e.g. a 401 retry inside api()).
  useEffect(
    () =>
      onSessionChange(({ accessToken, user: sessionUser }) => {
        if (accessToken && sessionUser) {
          if (!userRef.current) void adoptSession(sessionUser);
          else setUserState(sessionUser);
        } else if (!accessToken && userRef.current) {
          endSession();
          toast.info("Your session has expired. Please sign in again.");
        }
      }),
    [adoptSession, endSession],
  );

  // Keep prices and stock fresh when the shopper returns to the tab.
  useEffect(() => {
    let lastRefresh = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastRefresh < 60_000) return;
      lastRefresh = Date.now();
      if (userRef.current) void loadServerCart().catch(() => undefined);
      else
        void priceGuestCart(readStorage<GuestCartLine[]>(GUEST_CART_KEY, [])).catch(
          () => undefined,
        );
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadServerCart, priceGuestCart]);

  const [mfaToken, setMfaToken] = useState<string | null>(null);

  const establish = useCallback(
    async (data: SignInResponse) => {
      if ("mfaRequired" in data) {
        setMfaToken(data.mfaToken);
        throw new MfaRequiredError();
      }
      setMfaToken(null);
      setAccessToken(data.accessToken);
      await adoptSession(data.user);
      void queryClient.invalidateQueries();
      return data.user;
    },
    [adoptSession, queryClient],
  );

  /* ---------------- auth actions ---------------- */

  const login = useCallback(
    async (email: string, password: string) =>
      establish(
        await api<SignInResponse>("/auth/login", { method: "POST", body: { email, password } }),
      ),
    [establish],
  );

  const sendOtp = useCallback(
    (phone: string) =>
      api<{ devCode?: string; cooldownSeconds?: number }>("/auth/otp/send", {
        method: "POST",
        body: { phone },
      }),
    [],
  );

  const verifyOtp = useCallback(
    async (phone: string, code: string) =>
      establish(
        await api<SignInResponse>("/auth/otp/verify", { method: "POST", body: { phone, code } }),
      ),
    [establish],
  );

  const loginWithGoogle = useCallback(
    async (credential: string) =>
      establish(
        await api<SignInResponse>("/auth/google", {
          method: "POST",
          body: { credential, signupSource: acquisitionSource() },
        }),
      ),
    [establish],
  );

  const completeMfa = useCallback(
    async (code: string) => {
      if (!mfaToken) throw new Error("This sign-in has expired. Please sign in again.");
      try {
        return await establish(
          await api<AuthResponse>("/auth/mfa/verify", {
            method: "POST",
            body: { mfaToken, code },
          }),
        );
      } catch (error) {
        // An expired challenge can't be retried: send them back to the password step.
        if (error instanceof ApiError && error.status === 401) setMfaToken(null);
        throw error;
      }
    },
    [establish, mfaToken],
  );

  const cancelMfa = useCallback(() => setMfaToken(null), []);

  const register = useCallback(
    async (input: RegisterInput) =>
      establish(
        await api<AuthResponse>("/auth/register", {
          method: "POST",
          body: { ...input, signupSource: acquisitionSource() },
        }),
      ),
    [establish],
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // Clear local state even if the network call fails.
    }
    endSession();
    toast.success("You've been signed out");
    void router.navigate({ to: "/" });
  }, [endSession, router]);

  const logoutAllDevices = useCallback(async () => {
    await api("/auth/logout-all", { method: "POST" });
    endSession();
    toast.success("Signed out of all devices");
    void router.navigate({ to: "/login" });
  }, [endSession, router]);

  const refreshUser = useCallback(async () => {
    if (!userRef.current) return;
    const data = await api<{ user: User }>("/auth/me");
    userRef.current = data.user;
    setUserState(data.user);
    setWishlist(data.user.wishlist ?? []);
  }, []);

  const setUser = useCallback((next: User) => {
    userRef.current = next;
    setUserState(next);
  }, []);

  /* ---------------- cart actions ---------------- */

  const viewCartAction = useMemo(
    () => ({ label: "View cart", onClick: () => void router.navigate({ to: "/cart" }) }),
    [router],
  );

  const addToCart = useCallback(
    async ({ productId, variantSku, qty = 1, title, silent = false }: AddToCartInput) => {
      if (!variantSku) {
        if (!silent) toast.error("Please choose an option first");
        return false;
      }
      try {
        if (userRef.current) {
          const data = await api<{ cart: CartData; message?: string }>("/cart/items", {
            method: "POST",
            body: { productId, variantSku, qty },
          });
          setCart(data.cart);
          if (silent) return true;
          if (data.message && data.message !== "Added to cart") toast.warning(data.message);
          else toast.success("Added to cart", { description: title, action: viewCartAction });
          return true;
        }

        const lines = readStorage<GuestCartLine[]>(GUEST_CART_KEY, []);
        const existing = lines.find((line) => sameLine(line, productId, variantSku));
        const nextLines = existing
          ? lines.map((line) =>
              line === existing ? { ...line, qty: Math.min(line.qty + qty, MAX_QTY) } : line,
            )
          : [
              ...lines,
              { productId, variantSku: variantSku.toUpperCase(), qty: Math.min(qty, MAX_QTY) },
            ];
        writeStorage(GUEST_CART_KEY, nextLines);

        const priced = await priceGuestCart(nextLines);
        const added = priced.items.find((item) => sameLine(item, productId, variantSku));
        if (!added || added.issue === "out_of_stock" || added.issue === "unavailable") {
          const remaining = nextLines.filter((line) => !sameLine(line, productId, variantSku));
          writeStorage(GUEST_CART_KEY, remaining);
          await priceGuestCart(remaining);
          if (!silent) toast.error("Sorry, this item is out of stock");
          return false;
        }
        if (!silent) toast.success("Added to cart", { description: title, action: viewCartAction });
        return true;
      } catch (error) {
        if (!silent) toast.error(errorMessage(error));
        return false;
      }
    },
    [priceGuestCart, viewCartAction],
  );

  const updateCartQty = useCallback(
    async (productId: string, variantSku: string, qty: number) => {
      try {
        if (userRef.current) {
          const data = await api<{ cart: CartData }>("/cart/items", {
            method: "PATCH",
            body: { productId, variantSku, qty },
          });
          setCart(data.cart);
          return;
        }
        const lines = readStorage<GuestCartLine[]>(GUEST_CART_KEY, []);
        const next =
          qty <= 0
            ? lines.filter((line) => !sameLine(line, productId, variantSku))
            : lines.map((line) =>
                sameLine(line, productId, variantSku)
                  ? { ...line, qty: Math.min(qty, MAX_QTY) }
                  : line,
              );
        writeStorage(GUEST_CART_KEY, next);
        await priceGuestCart(next);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [priceGuestCart],
  );

  const removeFromCart = useCallback(
    async (productId: string, variantSku: string) => {
      try {
        if (userRef.current) {
          const data = await api<{ cart: CartData }>("/cart/items", {
            method: "DELETE",
            query: { productId, variantSku },
          });
          setCart(data.cart);
        } else {
          const next = readStorage<GuestCartLine[]>(GUEST_CART_KEY, []).filter(
            (line) => !sameLine(line, productId, variantSku),
          );
          writeStorage(GUEST_CART_KEY, next);
          await priceGuestCart(next);
        }
        toast.message("Removed from cart");
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [priceGuestCart],
  );

  const requireAccount = useCallback(
    (message: string) => {
      if (userRef.current) return true;
      toast.info(message, {
        action: {
          label: "Sign in",
          onClick: () => void router.navigate({ to: "/login", search: { redirect: "/cart" } }),
        },
      });
      return false;
    },
    [router],
  );

  const saveForLater = useCallback(
    async (productId: string, variantSku: string) => {
      if (!requireAccount("Sign in to save items for later")) return;
      try {
        const data = await api<{ cart: CartData }>("/cart/saved", {
          method: "POST",
          body: { productId, variantSku },
        });
        setCart(data.cart);
        toast.success("Saved for later");
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [requireAccount],
  );

  const moveToCart = useCallback(async (productId: string, variantSku: string) => {
    try {
      const data = await api<{ cart: CartData }>("/cart/saved/move-to-cart", {
        method: "POST",
        body: { productId, variantSku },
      });
      setCart(data.cart);
      toast.success("Moved to cart");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, []);

  const removeSaved = useCallback(async (productId: string, variantSku: string) => {
    try {
      const data = await api<{ cart: CartData }>("/cart/saved", {
        method: "DELETE",
        query: { productId, variantSku },
      });
      setCart(data.cart);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, []);

  const refreshCart = useCallback(async () => {
    try {
      if (userRef.current) await loadServerCart();
      else await priceGuestCart(readStorage<GuestCartLine[]>(GUEST_CART_KEY, []));
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, [loadServerCart, priceGuestCart]);

  const resetCart = useCallback(() => {
    setCart((current) => ({ ...EMPTY_CART, savedForLater: current.savedForLater }));
    removeStorage(GUEST_CART_KEY);
  }, []);

  const guestCartLines = useCallback(() => readStorage<GuestCartLine[]>(GUEST_CART_KEY, []), []);

  /* ---------------- wishlist ---------------- */

  const toggleWishlist = useCallback(
    async (productId: string, title?: string) => {
      const previous = wishlistRef.current;
      const wasSaved = previous.includes(productId);
      const optimistic = wasSaved
        ? previous.filter((id) => id !== productId)
        : [...previous, productId];
      setWishlist(optimistic);
      try {
        if (userRef.current) {
          const data = await api<{ wishlist: string[] }>("/cart/wishlist/toggle", {
            method: "POST",
            body: { productId },
          });
          setWishlist(data.wishlist);
        } else {
          writeStorage(GUEST_WISHLIST_KEY, optimistic);
        }
        if (wasSaved) toast.message("Removed from wishlist", { description: title });
        else toast.success("Saved to wishlist", { description: title });
        void queryClient.invalidateQueries({ queryKey: ["wishlist"] });
      } catch (error) {
        setWishlist(previous);
        toast.error(errorMessage(error));
      }
    },
    [queryClient],
  );

  const value = useMemo<StoreValue>(
    () => ({
      hydrated,
      user,
      isAuthenticated: Boolean(user),
      setUser,
      refreshUser,
      login,
      sendOtp,
      verifyOtp,
      loginWithGoogle,
      register,
      logout,
      logoutAllDevices,
      mfaPending: Boolean(mfaToken),
      completeMfa,
      cancelMfa,
      cart,
      cartReady,
      cartCount: cart.summary.itemCount,
      addToCart,
      updateCartQty,
      removeFromCart,
      saveForLater,
      moveToCart,
      removeSaved,
      refreshCart,
      resetCart,
      guestCartLines,
      wishlist,
      isWishlisted: (productId: string) => wishlist.includes(productId),
      toggleWishlist,
    }),
    [
      hydrated,
      user,
      setUser,
      refreshUser,
      login,
      sendOtp,
      verifyOtp,
      loginWithGoogle,
      register,
      logout,
      logoutAllDevices,
      mfaToken,
      completeMfa,
      cancelMfa,
      cart,
      cartReady,
      addToCart,
      updateCartQty,
      removeFromCart,
      saveForLater,
      moveToCart,
      removeSaved,
      refreshCart,
      resetCart,
      guestCartLines,
      wishlist,
      toggleWishlist,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
