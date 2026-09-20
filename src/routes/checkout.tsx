import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Lock, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout, PageContainer, Breadcrumbs } from "@/components/layout/site-layout";
import { PageLoader, InlineError } from "@/components/common/page-loader";
import { EmptyState } from "@/components/common/empty-state";
import { AddressForm, type AddressInput } from "@/components/common/address-form";
import { VerifyEmailBanner } from "@/components/account/verify-email-banner";
import { CouponField } from "@/components/cart/coupon-field";
import { StepSection } from "@/components/checkout/step-section";
import { AddressStep } from "@/components/checkout/address-step";
import { formatAddressLines } from "@/components/checkout/format-address";
import { DeliveryStep } from "@/components/checkout/delivery-step";
import { PaymentStep } from "@/components/checkout/payment-step";
import { CheckoutSummary } from "@/components/checkout/checkout-summary";
import {
  EMPTY_CARD,
  cardPayload,
  validateCard,
  type CardDetails,
  type CardErrors,
} from "@/components/checkout/card-utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/context/store";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { ApiError, api, errorMessage } from "@/lib/api";
import { searchString } from "@/lib/search-params";
import type { Address, Order, PaymentMethod, Quote, ShippingCode, User } from "@/lib/types";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>): { coupon?: string | undefined } => ({
    coupon: searchString(search["coupon"]),
  }),
  head: () => ({ meta: [{ title: "Checkout | Smart Deal" }] }),
  component: CheckoutPage,
});

const PAYMENT_ORDER: PaymentMethod[] = ["COD", "Wallet", "Card"];
const MAX_INSTRUCTIONS = 500;

function CheckoutPage() {
  const { ready, allowed, user } = useRequireAuth();

  return (
    <SiteLayout>
      {!ready || !allowed || !user ? (
        <PageLoader label="Getting your checkout ready…" />
      ) : (
        <CheckoutFlow user={user} />
      )}
    </SiteLayout>
  );
}

function CheckoutFlow({ user }: { user: User }) {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { cart, cartReady, resetCart, setUser } = useStore();

  const defaultAddressId =
    user.addresses.find((address) => address.isDefault)?._id ?? user.addresses[0]?._id ?? null;
  const [addressId, setAddressId] = useState<string | null>(defaultAddressId);
  const [shippingMethod, setShippingMethod] = useState<ShippingCode>("Standard");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [couponCode, setCouponCode] = useState<string | undefined>(search.coupon);
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [billingSame, setBillingSame] = useState(true);
  const [billingAddress, setBillingAddress] = useState<AddressInput | null>(null);
  const [card, setCard] = useState<CardDetails>(EMPTY_CARD);
  const [cardErrors, setCardErrors] = useState<CardErrors>({});
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);

  // Keep the selection valid when the address book changes (added, edited or removed elsewhere).
  useEffect(() => {
    if (addressId && user.addresses.some((address) => address._id === addressId)) return;
    setAddressId(defaultAddressId);
  }, [addressId, defaultAddressId, user.addresses]);

  const hasItems = cart.items.length > 0;

  const quoteQuery = useQuery({
    queryKey: ["checkout-quote", addressId ?? "", shippingMethod, paymentMethod, couponCode ?? ""],
    queryFn: () =>
      api<{ quote: Quote }>("/orders/quote", {
        method: "POST",
        body: {
          addressId: addressId ?? undefined,
          shippingMethod,
          paymentMethod,
          couponCode: couponCode ?? undefined,
        },
      }).then((response) => response.quote),
    enabled: cartReady && hasItems && !placed,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const quote = quoteQuery.data;
  const serverShipping = quote?.shippingMethod?.code;

  // The server decides which option actually applies (e.g. same-day isn't offered everywhere).
  useEffect(() => {
    if (serverShipping && serverShipping !== shippingMethod) setShippingMethod(serverShipping);
  }, [serverShipping, shippingMethod]);

  // Fall back to an offered payment method if the selected one is switched off.
  useEffect(() => {
    if (!quote || quote.paymentMethods[paymentMethod]) return;
    const fallback = PAYMENT_ORDER.find((method) => quote.paymentMethods[method]);
    if (fallback) setPaymentMethod(fallback);
  }, [quote, paymentMethod]);

  function handleAddressesChange(addresses: Address[]) {
    setUser({ ...user, addresses });
  }

  const selectedAddress = user.addresses.find((address) => address._id === addressId) ?? null;
  const walletShort = Boolean(
    quote && paymentMethod === "Wallet" && quote.walletBalance < quote.total,
  );
  const noPaymentMethod = Boolean(
    quote && !PAYMENT_ORDER.some((method) => quote.paymentMethods[method]),
  );
  const unavailableLines = quote?.items.filter((line) => !line.isAvailable) ?? [];

  const blockedReason = !user.isVerified
    ? "Verify your email address to place your order"
    : !addressId
      ? "Choose a delivery address to continue"
      : quote?.hasIssues
        ? "Some items in your cart are unavailable — review your cart to continue"
        : walletShort
          ? "Your wallet balance doesn't cover this order — choose another payment method"
          : noPaymentMethod
            ? "No payment method is available right now"
            : !quote
              ? "Calculating your total…"
              : !billingSame && !billingAddress
                ? "Add a billing address or tick “Same as delivery address”"
                : null;

  async function placeOrder() {
    if (!quote || !addressId || placing) return;

    if (paymentMethod === "Card") {
      const errors = validateCard(card);
      setCardErrors(errors);
      if (Object.values(errors).some(Boolean)) {
        toast.error("Please check your card details");
        return;
      }
    }

    setPlacing(true);
    try {
      const body: Record<string, unknown> = {
        addressId,
        shippingMethod,
        paymentMethod,
        expectedTotal: quote.total,
      };
      if (quote.coupon && !quote.coupon.error) body["couponCode"] = quote.coupon.code;
      if (deliveryInstructions.trim()) body["deliveryInstructions"] = deliveryInstructions.trim();
      if (!billingSame && billingAddress) body["billingAddress"] = billingAddress;
      if (paymentMethod === "Card") body["card"] = cardPayload(card);

      const data = await api<{ order: Order }>("/orders", { method: "POST", body });

      setPlaced(true);
      resetCart();
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Order placed successfully");
      void navigate({
        to: "/account/orders/$orderId",
        params: { orderId: data.order._id },
        search: { placed: true },
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        void quoteQuery.refetch();
        toast.error("Prices in your cart changed — please review the total");
      } else {
        toast.error(errorMessage(error));
      }
    } finally {
      setPlacing(false);
    }
  }

  if (placed) return <PageLoader label="Taking you to your order…" />;

  if (!cartReady) return <PageLoader label="Loading your cart…" />;

  if (!hasItems) {
    return (
      <PageContainer className="py-10">
        <EmptyState
          icon={ShoppingCart}
          title="There's nothing to check out"
          description="Your cart is empty. Add a few items and come back to complete your order."
          action={
            <Button asChild className="rounded-xl font-semibold">
              <Link to="/">Start shopping</Link>
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="py-6 lg:py-8">
      <Breadcrumbs className="mb-4">
        {[
          <Link key="home" to="/">
            Home
          </Link>,
          <Link key="cart" to="/cart">
            Cart
          </Link>,
          "Checkout",
        ]}
      </Breadcrumbs>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Checkout</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Secure checkout · All prices in AED, VAT shown
            separately
          </p>
        </div>
        <Button asChild variant="outline" className="rounded-xl font-semibold">
          <Link to="/cart">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to cart
          </Link>
        </Button>
      </div>

      {!user.isVerified && (
        <VerifyEmailBanner
          className="mb-6"
          email={user.email}
          reason="You'll be able to place your order as soon as it's confirmed."
        />
      )}

      {unavailableLines.length > 0 && (
        <div className="mb-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="flex items-start gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {unavailableLines.length === 1
              ? `"${unavailableLines[0]?.title}" is no longer available in the quantity you selected.`
              : `${unavailableLines.length} items in your cart are no longer available in the quantity you selected.`}
          </p>
          <Link
            to="/cart"
            className="mt-2 inline-block text-sm font-semibold underline underline-offset-4"
          >
            Review your cart
          </Link>
        </div>
      )}

      {quoteQuery.isError && !quote && (
        <div className="mb-6">
          <InlineError
            message={errorMessage(quoteQuery.error)}
            onRetry={() => void quoteQuery.refetch()}
          />
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4 sm:space-y-6">
          <StepSection
            step={1}
            title="Delivery address"
            description="Where should we deliver this order?"
          >
            <AddressStep
              addresses={user.addresses}
              selectedId={addressId}
              onSelect={setAddressId}
              onAddressesChange={handleAddressesChange}
            />
          </StepSection>

          <StepSection
            step={2}
            title="Delivery option"
            description={
              quote ? `Options and fees for ${quote.emirate}` : "Choose how fast you need it"
            }
          >
            <DeliveryStep
              options={quote?.shippingOptions ?? []}
              value={shippingMethod}
              emirate={quote?.emirate ?? "Dubai"}
              loading={quoteQuery.isLoading}
              onChange={setShippingMethod}
            />
          </StepSection>

          <StepSection
            step={3}
            title="Payment"
            description="Choose how you'd like to pay for this order"
          >
            {quote ? (
              <PaymentStep
                methods={quote.paymentMethods}
                value={paymentMethod}
                onChange={setPaymentMethod}
                codFee={quote.codFee}
                walletBalance={quote.walletBalance}
                total={quote.total}
                cardTestMode={quote.cardTestMode}
                card={card}
                cardErrors={cardErrors}
                onCardChange={setCard}
              />
            ) : (
              <div className="space-y-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="h-[76px] animate-pulse rounded-xl bg-muted" />
                ))}
              </div>
            )}
          </StepSection>

          <StepSection
            step={4}
            title="Order details"
            description="Delivery notes, coupon and billing address"
          >
            <div className="space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="delivery-instructions">Delivery instructions (optional)</Label>
                <Textarea
                  id="delivery-instructions"
                  value={deliveryInstructions}
                  maxLength={MAX_INSTRUCTIONS}
                  rows={3}
                  placeholder="e.g. Call on arrival, leave with security, gate code 1234"
                  onChange={(event) =>
                    setDeliveryInstructions(event.target.value.slice(0, MAX_INSTRUCTIONS))
                  }
                  className="rounded-xl"
                />
                <p className="text-right text-xs text-muted-foreground">
                  {deliveryInstructions.length}/{MAX_INSTRUCTIONS}
                </p>
              </div>

              <div className="space-y-1.5">
                <CouponField
                  applied={quote?.coupon && !quote.coupon.error ? quote.coupon : null}
                  applying={quoteQuery.isFetching && Boolean(couponCode)}
                  error={quote?.coupon?.error ?? null}
                  onApply={(code) => setCouponCode(code)}
                  onRemove={() => setCouponCode(undefined)}
                  id="checkout-coupon"
                  initialCode={search.coupon}
                />
              </div>

              <div className="space-y-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={billingSame}
                    onCheckedChange={(checked) => {
                      const same = checked === true;
                      setBillingSame(same);
                      if (same) setBillingAddress(null);
                    }}
                  />
                  Billing address is the same as the delivery address
                </label>

                {!billingSame &&
                  (billingAddress ? (
                    <div className="rounded-xl border border-border bg-background p-4">
                      <p className="text-sm font-bold">{billingAddress.receiverName}</p>
                      <p className="text-sm text-muted-foreground">
                        {[
                          billingAddress.buildingDetails,
                          billingAddress.street,
                          billingAddress.area,
                          billingAddress.emirate,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {billingAddress.receiverPhone}
                      </p>
                      <button
                        type="button"
                        onClick={() => setBillingAddress(null)}
                        className="mt-2 text-xs font-semibold underline underline-offset-4"
                      >
                        Change billing address
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-background p-4">
                      <h3 className="mb-4 text-sm font-bold">Billing address</h3>
                      <AddressForm
                        submitLabel="Use this billing address"
                        showDefaultToggle={false}
                        onSubmit={(values) => {
                          setBillingAddress(values);
                          toast.success("Billing address saved for this order");
                        }}
                        onCancel={() => {
                          setBillingSame(true);
                          setBillingAddress(null);
                        }}
                      />
                    </div>
                  ))}
              </div>
            </div>
          </StepSection>
        </div>

        <div className="lg:sticky lg:top-24">
          <CheckoutSummary
            items={quote?.items ?? cart.items}
            quote={quote}
            loading={quoteQuery.isLoading || quoteQuery.isFetching}
            placing={placing}
            blockedReason={blockedReason}
            onPlaceOrder={() => void placeOrder()}
          />
          {selectedAddress && quote && (
            <p className="mt-3 px-1 text-xs text-muted-foreground">
              Delivering to{" "}
              <span className="font-semibold text-foreground">
                {formatAddressLines(selectedAddress)}
              </span>
            </p>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
