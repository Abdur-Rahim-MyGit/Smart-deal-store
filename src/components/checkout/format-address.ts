import type { Address } from "@/lib/types";

/** One-line address used on the checkout cards and summary. */
export function formatAddressLines(address: Address): string {
  return [address.buildingDetails, address.street, address.area, address.emirate]
    .filter(Boolean)
    .join(", ");
}
