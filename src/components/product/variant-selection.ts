import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product, ProductVariant } from "@/lib/types";

export interface VariantSelection {
  /** Option names in the order the seller defined them, e.g. ["Colour", "Size"]. */
  optionNames: string[];
  valuesFor: (name: string) => string[];
  selected: Record<string, string>;
  select: (name: string, value: string) => void;
  /** The variant matching the current selection (falls back to the first variant). */
  variant: ProductVariant | null;
  /** False when every variant carrying that value is sold out. */
  isValueAvailable: (name: string, value: string) => boolean;
}

/** Variant picker state for the product page: chips per option, availability and the live variant. */
export function useVariantSelection(product: Product): VariantSelection {
  const variants = product.variants;

  const optionNames = useMemo(() => {
    const names: string[] = [];
    variants.forEach((variant) => {
      Object.keys(variant.options ?? {}).forEach((name) => {
        if (!names.includes(name)) names.push(name);
      });
    });
    return names;
  }, [variants]);

  const valuesByName = useMemo(() => {
    const map = new Map<string, string[]>();
    optionNames.forEach((name) => {
      const values: string[] = [];
      variants.forEach((variant) => {
        const value = variant.options?.[name];
        if (value && !values.includes(value)) values.push(value);
      });
      map.set(name, values);
    });
    return map;
  }, [variants, optionNames]);

  const initial = useMemo(() => {
    const preferred = variants.find((variant) => variant.stock > 0) ?? variants[0];
    const result: Record<string, string> = {};
    optionNames.forEach((name) => {
      const value = preferred?.options?.[name];
      if (value) result[name] = value;
    });
    return result;
  }, [variants, optionNames]);

  const [selected, setSelected] = useState<Record<string, string>>(initial);

  useEffect(() => {
    setSelected(initial);
  }, [initial]);

  const select = useCallback(
    (name: string, value: string) => {
      setSelected((current) => {
        const next = { ...current, [name]: value };
        const exact = variants.some((variant) =>
          optionNames.every((option) => variant.options?.[option] === next[option]),
        );
        if (exact) return next;

        // The combination doesn't exist — snap the other options to a variant that has this value.
        const fallback =
          variants.find((variant) => variant.options?.[name] === value && variant.stock > 0) ??
          variants.find((variant) => variant.options?.[name] === value);
        if (!fallback) return next;

        const adjusted: Record<string, string> = {};
        optionNames.forEach((option) => {
          const optionValue = fallback.options?.[option];
          if (optionValue) adjusted[option] = optionValue;
        });
        return adjusted;
      });
    },
    [variants, optionNames],
  );

  const variant = useMemo(() => {
    const match = variants.find((entry) =>
      optionNames.every((name) => entry.options?.[name] === selected[name]),
    );
    return match ?? variants[0] ?? null;
  }, [variants, optionNames, selected]);

  const isValueAvailable = useCallback(
    (name: string, value: string) =>
      variants.some(
        (entry) =>
          entry.options?.[name] === value &&
          entry.stock > 0 &&
          optionNames
            .filter((option) => option !== name)
            .every((option) => !selected[option] || entry.options?.[option] === selected[option]),
      ),
    [variants, optionNames, selected],
  );

  const valuesFor = useCallback((name: string) => valuesByName.get(name) ?? [], [valuesByName]);

  return { optionNames, valuesFor, selected, select, variant, isValueAvailable };
}
