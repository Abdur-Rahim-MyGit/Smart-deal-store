import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Info,
  Loader2,
  Percent,
  Save,
  Share2,
  Store,
  Truck,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard, TableScroll } from "@/components/dashboard/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { EMIRATES } from "@/lib/constants";
import { api, errorMessage } from "@/lib/api";
import type { Emirate, ShippingRule } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Field, Note, TabState, adminRetry, numberField } from "@/components/admin/people-shared";

interface AdminSettings {
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  trn: string;
  announcement: string;
  vatEnabled: boolean;
  vatPercent: number;
  pricesIncludeVat?: boolean | undefined;
  codEnabled: boolean;
  codFee: number;
  cardEnabled: boolean;
  walletEnabled: boolean;
  shippingMatrix: ShippingRule[];
  expressFee: number;
  expressEta: string;
  sameDayFee: number;
  sameDayEmirates: Emirate[];
  sameDayCutoff: string;
  returnWindowDays: number;
  minPayout: number;
  payoutHoldDays: number;
  social: { instagram?: string; facebook?: string; x?: string; youtube?: string };
}

interface SettingsResponse {
  settings: AdminSettings;
  paymentMode: string;
}

type Group = "identity" | "payments" | "delivery" | "policies" | "social";

interface ShippingDraft {
  emirate: Emirate;
  fee: string;
  freeThreshold: string;
  eta: string;
  includedWeightKg: string;
  extraPerKg: string;
}

interface Draft {
  storeName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  trn: string;
  announcement: string;
  vatEnabled: boolean;
  vatPercent: string;
  pricesIncludeVat: boolean;
  codEnabled: boolean;
  codFee: string;
  walletEnabled: boolean;
  shippingMatrix: ShippingDraft[];
  expressFee: string;
  expressEta: string;
  sameDayFee: string;
  sameDayCutoff: string;
  sameDayEmirates: Emirate[];
  returnWindowDays: string;
  minPayout: string;
  payoutHoldDays: string;
  social: { instagram: string; facebook: string; x: string; youtube: string };
}

function toDraft(settings: AdminSettings): Draft {
  return {
    storeName: settings.storeName ?? "",
    tagline: settings.tagline ?? "",
    supportEmail: settings.supportEmail ?? "",
    supportPhone: settings.supportPhone ?? "",
    address: settings.address ?? "",
    trn: settings.trn ?? "",
    announcement: settings.announcement ?? "",
    vatEnabled: settings.vatEnabled,
    vatPercent: String(settings.vatPercent ?? 0),
    pricesIncludeVat: Boolean(settings.pricesIncludeVat),
    codEnabled: settings.codEnabled,
    codFee: String(settings.codFee ?? 0),
    walletEnabled: settings.walletEnabled,
    shippingMatrix: EMIRATES.map((emirate) => {
      const rule = settings.shippingMatrix?.find((entry) => entry.emirate === emirate);
      return {
        emirate,
        fee: String(rule?.fee ?? 0),
        freeThreshold: String(rule?.freeThreshold ?? 0),
        includedWeightKg: String(rule?.includedWeightKg ?? 0),
        extraPerKg: String(rule?.extraPerKg ?? 0),
        eta: rule?.eta ?? "",
      };
    }),
    expressFee: String(settings.expressFee ?? 0),
    expressEta: settings.expressEta ?? "",
    sameDayFee: String(settings.sameDayFee ?? 0),
    sameDayCutoff: settings.sameDayCutoff ?? "",
    sameDayEmirates: settings.sameDayEmirates ?? [],
    returnWindowDays: String(settings.returnWindowDays ?? 0),
    minPayout: String(settings.minPayout ?? 0),
    payoutHoldDays: String(settings.payoutHoldDays ?? 0),
    social: {
      instagram: settings.social?.instagram ?? "",
      facebook: settings.social?.facebook ?? "",
      x: settings.social?.x ?? "",
      youtube: settings.social?.youtube ?? "",
    },
  };
}

export function SettingsTab() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);

  const query = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => api<SettingsResponse>("/admin/settings"),
    retry: adminRetry,
  });

  // Seed the form once; afterwards only a saved group is refreshed, so unsaved edits in the
  // other groups survive.
  useEffect(() => {
    const settings = query.data?.settings;
    if (settings) setDraft((current) => current ?? toDraft(settings));
  }, [query.data]);

  const save = useMutation({
    mutationFn: (input: { group: Group; body: Record<string, unknown> }) =>
      api<{ message: string; settings: AdminSettings }>("/admin/settings", {
        method: "PUT",
        body: input.body,
      }),
    onSuccess: (response, input) => {
      toast.success(response.message || "Settings saved");
      const fresh = toDraft(response.settings);
      const savedKeys = Object.keys(input.body).filter((key): key is keyof Draft => key in fresh);
      setDraft((current) =>
        current
          ? { ...current, ...Object.fromEntries(savedKeys.map((key) => [key, fresh[key]])) }
          : fresh,
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
      // The storefront reads the same values, so refresh them straight away.
      void queryClient.invalidateQueries({ queryKey: ["public-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["cms-pages"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const patch = (changes: Partial<Draft>) =>
    setDraft((current) => (current ? { ...current, ...changes } : current));

  function saving(group: Group): boolean {
    return save.isPending && save.variables?.group === group;
  }

  function submit(group: Group, body: Record<string, unknown>) {
    save.mutate({ group, body });
  }

  return (
    <TabState
      isLoading={query.isLoading || !draft}
      error={query.error}
      onRetry={() => void query.refetch()}
      skeleton={
        <div className="space-y-4" aria-hidden>
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      }
    >
      {draft && (
        <div className="space-y-4">
          {/* ------------------------------------------------ store identity */}
          <SectionCard
            title="Store identity"
            description="Names, contact details and the announcement strip customers see everywhere."
            actions={
              <SaveButton
                pending={saving("identity")}
                onClick={() =>
                  submit("identity", {
                    storeName: draft.storeName.trim(),
                    tagline: draft.tagline.trim(),
                    supportEmail: draft.supportEmail.trim(),
                    supportPhone: draft.supportPhone.trim(),
                    address: draft.address.trim(),
                    trn: draft.trn.trim(),
                    announcement: draft.announcement.trim(),
                  })
                }
              />
            }
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Store name" htmlFor="set-name">
                  <Input
                    id="set-name"
                    value={draft.storeName}
                    onChange={(event) => patch({ storeName: event.target.value })}
                    className="rounded-xl"
                  />
                </Field>
                <Field
                  label="Tagline"
                  htmlFor="set-tagline"
                  hint="Used in the footer and page titles."
                >
                  <Input
                    id="set-tagline"
                    value={draft.tagline}
                    onChange={(event) => patch({ tagline: event.target.value })}
                    className="rounded-xl"
                  />
                </Field>
                <Field label="Support email" htmlFor="set-email">
                  <Input
                    id="set-email"
                    type="email"
                    value={draft.supportEmail}
                    onChange={(event) => patch({ supportEmail: event.target.value })}
                    className="rounded-xl"
                  />
                </Field>
                <Field label="Support phone" htmlFor="set-phone">
                  <Input
                    id="set-phone"
                    value={draft.supportPhone}
                    onChange={(event) => patch({ supportPhone: event.target.value })}
                    className="rounded-xl"
                  />
                </Field>
                <Field label="Registered address" htmlFor="set-address">
                  <Input
                    id="set-address"
                    value={draft.address}
                    onChange={(event) => patch({ address: event.target.value })}
                    className="rounded-xl"
                  />
                </Field>
                <Field
                  label="Tax registration number (TRN)"
                  htmlFor="set-trn"
                  hint="Printed on VAT invoices."
                >
                  <Input
                    id="set-trn"
                    value={draft.trn}
                    onChange={(event) => patch({ trn: event.target.value })}
                    className="rounded-xl font-mono"
                  />
                </Field>
              </div>
              <Field
                label="Announcement bar"
                htmlFor="set-announcement"
                hint="Shows in the strip at the top of every storefront page. Leave blank to hide the strip."
              >
                <Textarea
                  id="set-announcement"
                  rows={2}
                  value={draft.announcement}
                  onChange={(event) => patch({ announcement: event.target.value })}
                  className="rounded-xl"
                />
              </Field>
            </div>
          </SectionCard>

          {/* ---------------------------------------------- payments and tax */}
          <SectionCard
            title="Payments & tax"
            description="What customers can pay with, and how VAT is applied at checkout."
            actions={
              <SaveButton
                pending={saving("payments")}
                onClick={() =>
                  submit("payments", {
                    vatEnabled: draft.vatEnabled,
                    vatPercent: numberField(draft.vatPercent) ?? 0,
                    pricesIncludeVat: draft.pricesIncludeVat,
                    codEnabled: draft.codEnabled,
                    codFee: numberField(draft.codFee) ?? 0,
                    walletEnabled: draft.walletEnabled,
                  })
                }
              />
            }
          >
            <div className="space-y-4">
              <ToggleRow
                id="set-vat"
                icon={Percent}
                label="Charge VAT"
                description="VAT applies to items minus discount, plus shipping and any COD fee."
                checked={draft.vatEnabled}
                onChange={(checked) => patch({ vatEnabled: checked })}
              >
                <Field label="VAT rate (%)" htmlFor="set-vat-percent" className="w-32">
                  <Input
                    id="set-vat-percent"
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    disabled={!draft.vatEnabled}
                    value={draft.vatPercent}
                    onChange={(event) => patch({ vatPercent: event.target.value })}
                    className="rounded-xl"
                  />
                </Field>
              </ToggleRow>

              <ToggleRow
                id="set-vat-inclusive"
                icon={Percent}
                label="Show prices with VAT included"
                description="Storefront prices include VAT, and the cart and checkout show VAT as included. Invoices still itemise it. UAE consumer pricing is normally shown this way."
                checked={draft.pricesIncludeVat}
                onChange={(checked) => patch({ pricesIncludeVat: checked })}
              />

              <ToggleRow
                id="set-cod"
                icon={Truck}
                label="Cash on delivery"
                description="Lets customers pay the courier when their order arrives."
                checked={draft.codEnabled}
                onChange={(checked) => patch({ codEnabled: checked })}
              >
                <Field label="COD fee (AED)" htmlFor="set-cod-fee" className="w-32">
                  <Input
                    id="set-cod-fee"
                    type="number"
                    min={0}
                    step="0.5"
                    disabled={!draft.codEnabled}
                    value={draft.codFee}
                    onChange={(event) => patch({ codFee: event.target.value })}
                    className="rounded-xl"
                  />
                </Field>
              </ToggleRow>

              <ToggleRow
                id="set-wallet"
                icon={Store}
                label="Smart Deal wallet"
                description="Refunds and goodwill credit can be spent at checkout."
                checked={draft.walletEnabled}
                onChange={(checked) => patch({ walletEnabled: checked })}
              />

              <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                <CreditCard className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs font-bold">
                    Card payments ·{" "}
                    <span
                      className={
                        query.data?.settings.cardEnabled ? "text-success" : "text-muted-foreground"
                      }
                    >
                      {query.data?.settings.cardEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {query.data?.paymentMode === "test"
                      ? "Card checkout runs through a simulated test gateway — no money moves and card numbers never reach the server. Connect a payment gateway to take live payments."
                      : `Payment mode: ${query.data?.paymentMode ?? "disabled"}. Card payments are managed by the gateway configuration, not from this console.`}
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ----------------------------------------------------- delivery */}
          <SectionCard
            title="Delivery"
            description="Standard rates per emirate, plus the express and same-day options."
            actions={
              <SaveButton
                pending={saving("delivery")}
                onClick={() => {
                  const matrix = draft.shippingMatrix.map((row) => ({
                    emirate: row.emirate,
                    fee: numberField(row.fee) ?? 0,
                    freeThreshold: numberField(row.freeThreshold) ?? 0,
                    eta: row.eta.trim(),
                    includedWeightKg: numberField(row.includedWeightKg) ?? 0,
                    extraPerKg: numberField(row.extraPerKg) ?? 0,
                  }));
                  if (
                    matrix.some(
                      (row) =>
                        row.fee < 0 ||
                        row.freeThreshold < 0 ||
                        row.includedWeightKg < 0 ||
                        row.extraPerKg < 0,
                    )
                  ) {
                    toast.error("Delivery fees, thresholds and weights can't be negative");
                    return;
                  }
                  submit("delivery", {
                    shippingMatrix: matrix,
                    expressFee: numberField(draft.expressFee) ?? 0,
                    expressEta: draft.expressEta.trim(),
                    sameDayFee: numberField(draft.sameDayFee) ?? 0,
                    sameDayCutoff: draft.sameDayCutoff.trim(),
                    sameDayEmirates: draft.sameDayEmirates,
                  });
                }}
              />
            }
          >
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-bold">Standard delivery</h3>
                <p className="mb-2 text-[11px] text-muted-foreground">
                  All seven emirates are always saved together, so fill in every row. For
                  weight-based pricing, the fee covers the included weight and each extra kg
                  (rounded up) costs the per-kg rate. That charge applies even when delivery is
                  otherwise free. Leave both at 0 for a flat fee.
                </p>
                <TableScroll>
                  <thead>
                    <tr className="border-b border-border">
                      <th
                        scope="col"
                        className="px-2 py-2 text-left text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
                      >
                        Emirate
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-2 text-left text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
                      >
                        Fee (AED)
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-2 text-left text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
                      >
                        Free over (AED)
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-2 text-left text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
                      >
                        Delivery estimate
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-2 text-left text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
                      >
                        Includes (kg)
                      </th>
                      <th
                        scope="col"
                        className="px-2 py-2 text-left text-[11px] font-bold tracking-wide text-muted-foreground uppercase"
                      >
                        Per extra kg (AED)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.shippingMatrix.map((row, index) => (
                      <tr key={row.emirate} className="border-b border-border/60 last:border-0">
                        <td className="px-2 py-2 text-sm font-semibold whitespace-nowrap">
                          {row.emirate}
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.5"
                            aria-label={`Delivery fee for ${row.emirate}`}
                            value={row.fee}
                            onChange={(event) => {
                              const value = event.target.value;
                              patch({
                                shippingMatrix: draft.shippingMatrix.map((entry, position) =>
                                  position === index ? { ...entry, fee: value } : entry,
                                ),
                              });
                            }}
                            className="h-9 w-24 rounded-xl"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            step="10"
                            aria-label={`Free delivery threshold for ${row.emirate}`}
                            value={row.freeThreshold}
                            onChange={(event) => {
                              const value = event.target.value;
                              patch({
                                shippingMatrix: draft.shippingMatrix.map((entry, position) =>
                                  position === index ? { ...entry, freeThreshold: value } : entry,
                                ),
                              });
                            }}
                            className="h-9 w-28 rounded-xl"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            aria-label={`Delivery estimate for ${row.emirate}`}
                            value={row.eta}
                            placeholder="24–48 hours"
                            onChange={(event) => {
                              const value = event.target.value;
                              patch({
                                shippingMatrix: draft.shippingMatrix.map((entry, position) =>
                                  position === index ? { ...entry, eta: value } : entry,
                                ),
                              });
                            }}
                            className="h-9 min-w-40 rounded-xl"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.5"
                            aria-label={`Weight included in the fee for ${row.emirate}`}
                            value={row.includedWeightKg}
                            onChange={(event) => {
                              const value = event.target.value;
                              patch({
                                shippingMatrix: draft.shippingMatrix.map((entry, position) =>
                                  position === index
                                    ? { ...entry, includedWeightKg: value }
                                    : entry,
                                ),
                              });
                            }}
                            className="h-9 w-20 rounded-xl"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.5"
                            aria-label={`Charge per extra kg for ${row.emirate}`}
                            value={row.extraPerKg}
                            onChange={(event) => {
                              const value = event.target.value;
                              patch({
                                shippingMatrix: draft.shippingMatrix.map((entry, position) =>
                                  position === index ? { ...entry, extraPerKg: value } : entry,
                                ),
                              });
                            }}
                            className="h-9 w-24 rounded-xl"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableScroll>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Express fee (AED)" htmlFor="set-express-fee">
                  <Input
                    id="set-express-fee"
                    type="number"
                    min={0}
                    step="0.5"
                    value={draft.expressFee}
                    onChange={(event) => patch({ expressFee: event.target.value })}
                    className="rounded-xl"
                  />
                </Field>
                <Field label="Express estimate" htmlFor="set-express-eta">
                  <Input
                    id="set-express-eta"
                    value={draft.expressEta}
                    placeholder="Next business day"
                    onChange={(event) => patch({ expressEta: event.target.value })}
                    className="rounded-xl"
                  />
                </Field>
              </div>

              <div className="space-y-3 rounded-xl border border-border p-3">
                <h3 className="text-xs font-bold">Same-day delivery</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Same-day fee (AED)" htmlFor="set-sameday-fee">
                    <Input
                      id="set-sameday-fee"
                      type="number"
                      min={0}
                      step="0.5"
                      value={draft.sameDayFee}
                      onChange={(event) => patch({ sameDayFee: event.target.value })}
                      className="rounded-xl"
                    />
                  </Field>
                  <Field
                    label="Order cutoff"
                    htmlFor="set-sameday-cutoff"
                    hint="Orders placed after this time ship the next day."
                  >
                    <Input
                      id="set-sameday-cutoff"
                      value={draft.sameDayCutoff}
                      placeholder="12:00 PM"
                      onChange={(event) => patch({ sameDayCutoff: event.target.value })}
                      className="rounded-xl"
                    />
                  </Field>
                </div>
                <div>
                  <Label className="text-xs font-bold">Emirates covered</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {EMIRATES.map((emirate) => {
                      const id = `sameday-${emirate}`;
                      const checked = draft.sameDayEmirates.includes(emirate);
                      return (
                        <label
                          key={emirate}
                          htmlFor={id}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors",
                            checked
                              ? "border-foreground bg-accent"
                              : "border-border hover:border-foreground/25",
                          )}
                        >
                          <Checkbox
                            id={id}
                            checked={checked}
                            onCheckedChange={() =>
                              patch({
                                sameDayEmirates: checked
                                  ? draft.sameDayEmirates.filter((entry) => entry !== emirate)
                                  : [...draft.sameDayEmirates, emirate],
                              })
                            }
                          />
                          {emirate}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* --------------------------------------------- policies & payouts */}
          <SectionCard
            title="Policies & payouts"
            description="The return window customers get, and when sellers can withdraw."
            actions={
              <SaveButton
                pending={saving("policies")}
                onClick={() =>
                  submit("policies", {
                    returnWindowDays: numberField(draft.returnWindowDays) ?? 0,
                    minPayout: numberField(draft.minPayout) ?? 0,
                    payoutHoldDays: numberField(draft.payoutHoldDays) ?? 0,
                  })
                }
              />
            }
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Return window (days)"
                htmlFor="set-return-days"
                hint="Counted from the delivery date. 0 disables returns."
              >
                <Input
                  id="set-return-days"
                  type="number"
                  min={0}
                  value={draft.returnWindowDays}
                  onChange={(event) => patch({ returnWindowDays: event.target.value })}
                  className="rounded-xl"
                />
              </Field>
              <Field
                label="Minimum payout (AED)"
                htmlFor="set-min-payout"
                hint="Smallest amount a seller can request."
              >
                <Input
                  id="set-min-payout"
                  type="number"
                  min={0}
                  step="10"
                  value={draft.minPayout}
                  onChange={(event) => patch({ minPayout: event.target.value })}
                  className="rounded-xl"
                />
              </Field>
              <Field
                label="Payout hold (days)"
                htmlFor="set-hold-days"
                hint="How long earnings stay on hold after delivery before they clear."
              >
                <Input
                  id="set-hold-days"
                  type="number"
                  min={0}
                  value={draft.payoutHoldDays}
                  onChange={(event) => patch({ payoutHoldDays: event.target.value })}
                  className="rounded-xl"
                />
              </Field>
            </div>
          </SectionCard>

          {/* ------------------------------------------------------- social */}
          <SectionCard
            title="Social links"
            description="Linked from the storefront footer. Leave a field blank to hide that icon."
            actions={
              <SaveButton
                pending={saving("social")}
                onClick={() =>
                  submit("social", {
                    social: {
                      instagram: draft.social.instagram.trim(),
                      facebook: draft.social.facebook.trim(),
                      x: draft.social.x.trim(),
                      youtube: draft.social.youtube.trim(),
                    },
                  })
                }
              />
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["instagram", "Instagram"],
                  ["facebook", "Facebook"],
                  ["x", "X (Twitter)"],
                  ["youtube", "YouTube"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label} htmlFor={`set-social-${key}`}>
                  <Input
                    id={`set-social-${key}`}
                    value={draft.social[key]}
                    placeholder={`https://${key === "x" ? "x" : key}.com/smartdeal`}
                    onChange={(event) =>
                      patch({ social: { ...draft.social, [key]: event.target.value } })
                    }
                    className="rounded-xl"
                  />
                </Field>
              ))}
            </div>
          </SectionCard>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Note className="flex-1">
              <Info className="mr-1 inline h-3 w-3 align-[-2px]" />
              Each group saves on its own. Saved changes reach the storefront immediately — VAT,
              delivery fees and the announcement bar all update on the next page load.
            </Note>
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={save.isPending || !query.data}
              onClick={() => {
                if (query.data) setDraft(toDraft(query.data.settings));
                toast.success("Reverted to the saved settings");
              }}
            >
              <Undo2 className="mr-1.5 h-4 w-4" /> Discard unsaved edits
            </Button>
          </div>
        </div>
      )}
    </TabState>
  );
}

function SaveButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <Button className="rounded-xl" disabled={pending} onClick={onClick}>
      {pending ? (
        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-1.5 h-4 w-4" />
      )}
      Save
    </Button>
  );
}

function ToggleRow({
  id,
  icon: Icon,
  label,
  description,
  checked,
  onChange,
  children,
}: {
  id: string;
  icon: typeof Share2;
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border px-3 py-2.5">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <Label htmlFor={id} className="text-xs font-bold">
            {label}
          </Label>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-end gap-4">
        {children}
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
      </div>
    </div>
  );
}
