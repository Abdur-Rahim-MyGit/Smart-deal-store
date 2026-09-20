/**
 * Client-side card helpers for the test checkout.
 * The card number never leaves the browser — only `{ last4, brand }` is sent to the API.
 */

export type CardBrand = "Visa" | "Mastercard" | "Card";

export interface CardDetails {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
}

export interface CardErrors {
  number?: string | undefined;
  name?: string | undefined;
  expiry?: string | undefined;
  cvv?: string | undefined;
}

export const EMPTY_CARD: CardDetails = { number: "", name: "", expiry: "", cvv: "" };

export const cardDigits = (value: string): string => value.replace(/\D/g, "").slice(0, 19);

/** "4111111111111111" → "4111 1111 1111 1111" */
export function formatCardNumber(value: string): string {
  const digits = cardDigits(value);
  const groups = digits.match(/.{1,4}/g);
  return groups ? groups.join(" ") : digits;
}

export function detectBrand(value: string): CardBrand {
  const digits = cardDigits(value);
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  return "Card";
}

/** Luhn mod-10 check. */
export function luhnValid(value: string): boolean {
  const digits = cardDigits(value);
  if (digits.length < 12) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = digits.charCodeAt(index) - 48;
    if (digit < 0 || digit > 9) return false;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Keeps the expiry input as MM/YY while typing. */
export function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function expiryIsFuture(value: string): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (!month || month < 1 || month > 12) return false;
  // Valid through the last moment of the expiry month.
  const expiresAt = new Date(2000 + year, month, 1).getTime();
  return expiresAt > Date.now();
}

export function validateCard(card: CardDetails): CardErrors {
  const errors: CardErrors = {};
  const digits = cardDigits(card.number);

  if (!digits) errors.number = "Enter your card number";
  else if (digits.length < 13 || !luhnValid(digits))
    errors.number = "That card number doesn't look right";
  else if (detectBrand(digits) === "Card") errors.number = "We accept Visa and Mastercard";

  if (card.name.trim().length < 2) errors.name = "Enter the name printed on the card";

  if (!/^\d{2}\/\d{2}$/.test(card.expiry.trim())) errors.expiry = "Use MM/YY";
  else if (!expiryIsFuture(card.expiry)) errors.expiry = "This card has expired";

  if (!/^\d{3,4}$/.test(card.cvv.trim())) errors.cvv = "3 or 4 digits";

  return errors;
}

export function cardPayload(card: CardDetails): { last4: string; brand: CardBrand } {
  const digits = cardDigits(card.number);
  return { last4: digits.slice(-4), brand: detectBrand(digits) };
}
