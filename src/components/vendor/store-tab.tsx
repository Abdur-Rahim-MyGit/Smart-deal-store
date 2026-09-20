import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Info, Loader2, Percent } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { VendorDocumentsCard } from "@/components/vendor/documents-card";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useStore } from "@/context/store";
import { useCategories } from "@/hooks/use-categories";
import { api, errorMessage } from "@/lib/api";
import type { User, VendorStatus } from "@/lib/types";
import { useVendorGate } from "@/components/vendor/vendor-status";

interface StoreForm {
  businessName: string;
  storeDescription: string;
  supportEmail: string;
  supportPhone: string;
  corporateAddress: string;
  vatNumber: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
}

type FormErrors = Partial<Record<keyof StoreForm, string>>;

const IBAN_PATTERN = /^AE\d{21}$/;

function initialForm(user: User | null): StoreForm {
  const details = user?.vendorDetails;
  const bank = details?.bankAccount;
  return {
    businessName: details?.businessName ?? "",
    storeDescription: details?.storeDescription ?? "",
    supportEmail: details?.supportEmail ?? "",
    supportPhone: details?.supportPhone ?? "",
    corporateAddress: details?.corporateAddress ?? "",
    vatNumber: details?.vatNumber ?? "",
    bankName: bank?.bankName ?? "",
    accountName: bank?.accountName ?? "",
    accountNumber: bank?.accountNumber ?? "",
    iban: bank?.iban ?? "",
  };
}

/** Store profile, payout bank account and the commission note. */
export function StoreTab() {
  const { user, setUser } = useStore();
  const gate = useVendorGate();
  const queryClient = useQueryClient();
  const { categories } = useCategories();

  const [form, setForm] = useState<StoreForm>(() => initialForm(user));
  const [errors, setErrors] = useState<FormErrors>({});

  const set = (key: keyof StoreForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<{ message: string; user: User }>("/vendors/profile", { method: "PUT", body: payload }),
    onSuccess: (response) => {
      toast.success(response.message || "Store settings saved");
      setUser(response.user);
      setForm(initialForm(response.user));
      void queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["vendor-payouts"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submit() {
    const iban = form.iban.replace(/\s+/g, "").toUpperCase();
    const next: FormErrors = {};
    if (form.businessName.trim().length < 2) next.businessName = "Business name is required";
    if (form.supportEmail && !/^\S+@\S+\.\S+$/.test(form.supportEmail.trim()))
      next.supportEmail = "Enter a valid email address";
    if (form.supportPhone && !/^\+?\d[\d\s-]{7,}$/.test(form.supportPhone.trim()))
      next.supportPhone = "Enter a valid UAE phone number";
    if (iban && !IBAN_PATTERN.test(iban))
      next.iban = "UAE IBANs start with AE followed by 21 digits";

    const problem = Object.values(next).find(Boolean);
    if (problem) {
      setErrors(next);
      toast.error(problem);
      return;
    }

    mutation.mutate({
      businessName: form.businessName.trim(),
      storeDescription: form.storeDescription.trim(),
      supportEmail: form.supportEmail.trim(),
      supportPhone: form.supportPhone.trim(),
      corporateAddress: form.corporateAddress.trim(),
      vatNumber: form.vatNumber.trim(),
      bankAccount: {
        bankName: form.bankName.trim(),
        accountName: form.accountName.trim(),
        accountNumber: form.accountNumber.trim(),
        iban,
      },
    });
  }

  const details = user?.vendorDetails;
  const status: VendorStatus = gate.status;
  const override = details?.commissionRateOverride;
  const topCategories = categories.filter((category) => !category.parentCategory).slice(0, 8);
  const fieldError = (message?: string | undefined) =>
    message ? <p className="text-xs font-medium text-destructive">{message}</p> : null;

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Store settings</h2>
          <p className="text-sm text-muted-foreground">
            Shoppers see your store name and description on every listing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Store status</span>
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <VendorDocumentsCard />

          <SectionCard title="Store profile">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="store-name">Business name</Label>
                <Input
                  id="store-name"
                  value={form.businessName}
                  onChange={(event) => set("businessName", event.target.value)}
                  className="h-10 rounded-xl"
                />
                {fieldError(errors.businessName)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-description">Store description</Label>
                <Textarea
                  id="store-description"
                  value={form.storeDescription}
                  onChange={(event) => set("storeDescription", event.target.value)}
                  placeholder="What you sell, what makes your store different, how quickly you ship."
                  className="min-h-[110px] rounded-xl"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="store-email">Support email</Label>
                  <Input
                    id="store-email"
                    type="email"
                    value={form.supportEmail}
                    onChange={(event) => set("supportEmail", event.target.value)}
                    placeholder="care@yourstore.ae"
                    className="h-10 rounded-xl"
                  />
                  {fieldError(errors.supportEmail)}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="store-phone">Support phone</Label>
                  <Input
                    id="store-phone"
                    type="tel"
                    value={form.supportPhone}
                    onChange={(event) => set("supportPhone", event.target.value)}
                    placeholder="+9714 222 3344"
                    className="h-10 rounded-xl"
                  />
                  {fieldError(errors.supportPhone)}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="store-address">Corporate address</Label>
                <Input
                  id="store-address"
                  value={form.corporateAddress}
                  onChange={(event) => set("corporateAddress", event.target.value)}
                  placeholder="Al Quoz Industrial 3, Dubai"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="store-vat">VAT / TRN number</Label>
                  <Input
                    id="store-vat"
                    value={form.vatNumber}
                    onChange={(event) => set("vatNumber", event.target.value)}
                    placeholder="100245879600003"
                    className="h-10 rounded-xl font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="store-licence">Trade licence number</Label>
                  <Input
                    id="store-licence"
                    value={details?.tradeLicenseNumber ?? "—"}
                    readOnly
                    disabled
                    className="h-10 rounded-xl bg-muted/50 font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Verified by Smart Deal at onboarding. Contact support to change it.
                  </p>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Bank account"
            description="Payouts are transferred to this UAE account."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bank-name">Bank name</Label>
                <Input
                  id="bank-name"
                  value={form.bankName}
                  onChange={(event) => set("bankName", event.target.value)}
                  placeholder="Emirates NBD"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank-account-name">Account holder name</Label>
                <Input
                  id="bank-account-name"
                  value={form.accountName}
                  onChange={(event) => set("accountName", event.target.value)}
                  placeholder="As printed on the account"
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank-account-number">Account number</Label>
                <Input
                  id="bank-account-number"
                  value={form.accountNumber}
                  onChange={(event) => set("accountNumber", event.target.value)}
                  className="h-10 rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank-iban">IBAN</Label>
                <Input
                  id="bank-iban"
                  value={form.iban}
                  onChange={(event) => set("iban", event.target.value.toUpperCase())}
                  placeholder="AE070331234567890123456"
                  className="h-10 rounded-xl font-mono"
                  maxLength={30}
                />
                {fieldError(errors.iban) ?? (
                  <p className="text-[11px] text-muted-foreground">AE followed by 21 digits.</p>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-5">
          <SectionCard title="Commission">
            <div className="space-y-3 text-sm leading-relaxed">
              <p className="flex items-start gap-2 text-muted-foreground">
                <Percent className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  {override !== undefined && override !== null
                    ? `Your account has an agreed rate of ${override}% on every sale, which replaces the category rates below.`
                    : "Smart Deal charges commission per category — the rate that applies to each item is stored on the order, so your earnings never change after a sale."}
                </span>
              </p>
              {topCategories.length > 0 && (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {topCategories.map((category) => (
                    <li
                      key={category._id}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">{category.name}</span>
                      <span
                        className={
                          override !== undefined && override !== null
                            ? "text-muted-foreground line-through tabular-nums"
                            : "font-semibold tabular-nums"
                        }
                      >
                        {category.commissionRate}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Commission is deducted from the item price; VAT, shipping and COD fees are
                  collected by Smart Deal.
                </span>
              </p>
            </div>
          </SectionCard>

          <SectionCard title="Account">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  Owner
                </dt>
                <dd className="mt-0.5 font-medium">{user?.name}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  Sign-in email
                </dt>
                <dd className="mt-0.5 break-all">{user?.email}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  Store status
                </dt>
                <dd className="mt-1">
                  <StatusBadge status={status} />
                  {gate.rejectionReason && (
                    <p className="mt-1 text-xs text-destructive">{gate.rejectionReason}</p>
                  )}
                </dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-lift backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          className="rounded-xl"
          disabled={mutation.isPending}
          onClick={() => {
            setForm(initialForm(user));
            setErrors({});
          }}
        >
          Reset
        </Button>
        <Button type="submit" className="rounded-xl font-semibold" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </form>
  );
}
