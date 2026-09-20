import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Emirate, StoreSettings } from "@/lib/types";

/** Used until /public/settings responds (and if the API is unreachable). */
export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Smart Deal",
  tagline: "Beauty, tech & fashion at honest prices",
  supportEmail: "support@smartdeal.ae",
  supportPhone: "+971 4 123 4567",
  address: "Business Bay, Dubai, United Arab Emirates",
  trn: "",
  announcement: "Free delivery on orders over AED 150 in Dubai & Sharjah · 14-day easy returns",
  vatEnabled: true,
  vatPercent: 5,
  pricesIncludeVat: false,
  codEnabled: true,
  codFee: 10,
  walletEnabled: true,
  cardEnabled: false,
  cardTestMode: false,
  shippingMatrix: [
    { emirate: "Dubai", fee: 15, freeThreshold: 150, eta: "Within 24 hours" },
    { emirate: "Abu Dhabi", fee: 20, freeThreshold: 200, eta: "24–48 hours" },
    { emirate: "Sharjah", fee: 15, freeThreshold: 150, eta: "24–48 hours" },
    { emirate: "Ajman", fee: 20, freeThreshold: 200, eta: "48 hours" },
    { emirate: "Umm Al Quwain", fee: 25, freeThreshold: 250, eta: "48–72 hours" },
    { emirate: "Ras Al Khaimah", fee: 25, freeThreshold: 250, eta: "48–72 hours" },
    { emirate: "Fujairah", fee: 25, freeThreshold: 250, eta: "48–72 hours" },
  ],
  expressFee: 25,
  expressEta: "Next business day",
  sameDayFee: 35,
  sameDayEmirates: ["Dubai", "Sharjah", "Ajman"],
  sameDayCutoff: "12:00 PM",
  returnWindowDays: 14,
  social: {},
  googleClientId: null,
};

export const settingsQueryOptions = {
  queryKey: ["public-settings"],
  queryFn: () =>
    api<{ settings: StoreSettings }>("/public/settings").then((response) => response.settings),
  staleTime: 5 * 60 * 1000,
};

export function useSettings(): StoreSettings {
  const { data } = useQuery(settingsQueryOptions);
  return data ?? DEFAULT_SETTINGS;
}

/**
 * Standard-delivery estimate for an emirate, used on product and cart pages. Mirrors the
 * API: the base fee is waived above the free threshold, a weight surcharge is not.
 */
export function estimateShipping(
  settings: StoreSettings,
  emirate: Emirate,
  subtotal: number,
  weightKg = 0,
) {
  const rule =
    settings.shippingMatrix.find((entry) => entry.emirate === emirate) ??
    settings.shippingMatrix[0];
  if (!rule) return { fee: 0, freeThreshold: 0, eta: "", remainingForFree: 0, surcharge: 0 };
  const free = subtotal >= rule.freeThreshold;
  const extraKg = Math.max(0, Math.ceil(weightKg - (rule.includedWeightKg ?? 0) - 1e-9));
  const surcharge = Math.round(extraKg * (rule.extraPerKg ?? 0) * 100) / 100;
  return {
    fee: (free ? 0 : rule.fee) + surcharge,
    freeThreshold: rule.freeThreshold,
    eta: rule.eta,
    remainingForFree: free ? 0 : Math.max(0, rule.freeThreshold - subtotal),
    surcharge,
  };
}

/**
 * Prices are stored before VAT. When the store shows VAT-inclusive prices, shoppers see
 * them with VAT added; checkout and invoices still itemise the VAT.
 */
export function useDisplayPrice() {
  const settings = useSettings();
  const inclusive = Boolean(
    settings.pricesIncludeVat && settings.vatEnabled && settings.vatPercent > 0,
  );
  const factor = inclusive ? 1 + settings.vatPercent / 100 : 1;
  return {
    inclusive,
    vatPercent: settings.vatPercent,
    display: (amount: number) => Math.round(amount * factor * 100) / 100,
  };
}
