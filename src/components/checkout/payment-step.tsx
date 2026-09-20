import type { ComponentProps, ReactNode } from "react";
import { Banknote, CreditCard, Info, Wallet } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/format";
import type { PaymentMethod } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  cardDigits,
  detectBrand,
  formatCardNumber,
  formatExpiry,
  type CardDetails,
  type CardErrors,
} from "./card-utils";

export interface PaymentStepProps {
  methods: Record<PaymentMethod, boolean>;
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  codFee: number;
  walletBalance: number;
  total: number;
  cardTestMode: boolean;
  card: CardDetails;
  cardErrors: CardErrors;
  onCardChange: (card: CardDetails) => void;
}

function Option({
  id,
  checked,
  disabled,
  icon: Icon,
  title,
  meta,
  description,
  note,
  onSelect,
  children,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean | undefined;
  icon: typeof Wallet;
  title: string;
  meta?: string | undefined;
  description: string;
  note?: string | undefined;
  onSelect: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        checked ? "border-foreground bg-accent/40" : "border-border",
        disabled ? "opacity-60" : !checked && "hover:bg-accent/20",
      )}
    >
      <label
        htmlFor={id}
        className={cn(
          "flex items-start gap-3 p-4",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        <input
          id={id}
          type="radio"
          name="payment-method"
          checked={checked}
          disabled={disabled}
          onChange={onSelect}
          className="mt-1 h-4 w-4 shrink-0 accent-primary"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-bold">
              <Icon className="h-4 w-4 shrink-0" />
              {title}
            </span>
            {meta && <span className="text-sm font-semibold tabular-nums">{meta}</span>}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
          {note && (
            <span className="mt-1 block text-xs font-semibold text-destructive">{note}</span>
          )}
        </span>
      </label>
      {children}
    </div>
  );
}

/** Step 3: payment method, limited to what the server says is available. */
export function PaymentStep({
  methods,
  value,
  onChange,
  codFee,
  walletBalance,
  total,
  cardTestMode,
  card,
  cardErrors,
  onCardChange,
}: PaymentStepProps) {
  const walletShort = walletBalance < total;
  const brand = detectBrand(card.number);

  const field = (
    key: keyof CardDetails,
    label: string,
    props: Omit<ComponentProps<typeof Input>, "value" | "onChange" | "id"> = {},
    format?: (value: string) => string,
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`card-${key}`}>{label}</Label>
      <Input
        id={`card-${key}`}
        value={card[key]}
        onChange={(event) =>
          onCardChange({ ...card, [key]: format ? format(event.target.value) : event.target.value })
        }
        aria-invalid={Boolean(cardErrors[key])}
        aria-describedby={cardErrors[key] ? `card-${key}-error` : undefined}
        className="h-10 rounded-xl"
        {...props}
      />
      {cardErrors[key] && (
        <p id={`card-${key}-error`} className="text-xs font-medium text-destructive">
          {cardErrors[key]}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <fieldset className="space-y-3">
        <legend className="sr-only">Payment method</legend>

        {methods.COD && (
          <Option
            id="payment-cod"
            icon={Banknote}
            checked={value === "COD"}
            onSelect={() => onChange("COD")}
            title="Cash on Delivery"
            meta={codFee > 0 ? `+ ${formatPrice(codFee)}` : undefined}
            description={
              codFee > 0
                ? `Pay the courier in cash when your order arrives. A ${formatPrice(codFee)} handling fee applies.`
                : "Pay the courier in cash when your order arrives."
            }
          />
        )}

        {methods.Wallet && (
          <Option
            id="payment-wallet"
            icon={Wallet}
            checked={value === "Wallet"}
            disabled={walletShort}
            onSelect={() => onChange("Wallet")}
            title="Smart Deal Wallet"
            meta={formatPrice(walletBalance)}
            description="Instant payment from your wallet balance — refunds return here too."
            note={
              walletShort
                ? `Your balance of ${formatPrice(walletBalance)} doesn't cover this order's total of ${formatPrice(total)}. Top up or choose another method.`
                : undefined
            }
          />
        )}

        {methods.Card && (
          <Option
            id="payment-card"
            icon={CreditCard}
            checked={value === "Card"}
            onSelect={() => onChange("Card")}
            title="Credit or debit card"
            description="Visa and Mastercard accepted. Your card number never reaches our servers."
          >
            {value === "Card" && (
              <div className="space-y-4 border-t border-border p-4">
                {cardTestMode && (
                  <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2 text-xs font-semibold">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Test mode — no real charge is made. Use any valid test card number.
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="card-number">Card number</Label>
                  <div className="relative">
                    <Input
                      id="card-number"
                      value={card.number}
                      onChange={(event) =>
                        onCardChange({ ...card, number: formatCardNumber(event.target.value) })
                      }
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="1234 5678 9012 3456"
                      aria-invalid={Boolean(cardErrors.number)}
                      aria-describedby={cardErrors.number ? "card-number-error" : undefined}
                      className="h-10 rounded-xl pr-20"
                    />
                    {cardDigits(card.number).length >= 2 && brand !== "Card" && (
                      <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        {brand}
                      </span>
                    )}
                  </div>
                  {cardErrors.number && (
                    <p id="card-number-error" className="text-xs font-medium text-destructive">
                      {cardErrors.number}
                    </p>
                  )}
                </div>

                {field("name", "Name on card", {
                  autoComplete: "cc-name",
                  placeholder: "As printed on the card",
                })}

                <div className="grid gap-4 sm:grid-cols-2">
                  {field(
                    "expiry",
                    "Expiry (MM/YY)",
                    {
                      autoComplete: "cc-exp",
                      inputMode: "numeric",
                      placeholder: "MM/YY",
                      maxLength: 5,
                    },
                    formatExpiry,
                  )}
                  {field(
                    "cvv",
                    "CVV",
                    {
                      autoComplete: "cc-csc",
                      inputMode: "numeric",
                      placeholder: "123",
                      maxLength: 4,
                    },
                    (input) => input.replace(/\D/g, "").slice(0, 4),
                  )}
                </div>
              </div>
            )}
          </Option>
        )}
      </fieldset>

      {!methods.COD && !methods.Wallet && !methods.Card && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive">
          No payment method is available right now. Please contact support.
        </p>
      )}
    </div>
  );
}
