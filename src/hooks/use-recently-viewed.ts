import { useCallback, useEffect, useState } from "react";
import type { ProductListing } from "@/lib/types";

const STORAGE_KEY = "smartdeal.recentlyViewed";
const MAX_ITEMS = 12;

function read(): ProductListing[] {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]") as ProductListing[];
  } catch {
    return [];
  }
}

/** Recently viewed products, kept per browser. */
export function useRecentlyViewed(excludeId?: string) {
  const [items, setItems] = useState<ProductListing[]>([]);

  useEffect(() => {
    setItems(read());
  }, []);

  const add = useCallback((product: ProductListing) => {
    const next = [product, ...read().filter((item) => item._id !== product._id)].slice(
      0,
      MAX_ITEMS,
    );
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures
    }
    setItems(next);
  }, []);

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setItems([]);
  }, []);

  return { items: excludeId ? items.filter((item) => item._id !== excludeId) : items, add, clear };
}
