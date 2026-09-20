import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Info, Loader2, ShoppingBag, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrength } from "@/components/auth/password-strength";
import {
  isEmail,
  isStrongPassword,
  isUaeIban,
  isUaePhone,
  normalizePhone,
} from "@/components/auth/utils";
import { useStore, type RegisterInput } from "@/context/store";
import { errorMessage } from "@/lib/api";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

type Values = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  businessName: string;
  tradeLicenseNumber: string;
  corporateAddress: string;
  vatNumber: string;
  bankName: string;
  iban: string;
};

type Errors = { [K in keyof Values | "terms"]?: string | undefined };

const EMPTY: Values = {
  name: "",
  email: "",
  phone: "",
  password: "",
  confirm: "",
  businessName: "",
  tradeLicenseNumber: "",
  corporateAddress: "",
  vatNumber: "",
  bankName: "",
  iban: "",
};

const ACCOUNT_TYPES = [
  {
    value: "Customer" as const,
    label: "Customer",
    body: "Shop and track orders",
    icon: ShoppingBag,
  },
  { value: "Vendor" as const, label: "Seller", body: "List and sell products", icon: Store },
];

/** Create a customer or seller account. */
export function RegisterForm({ onRegistered }: { onRegistered: (user: User) => void }) {
  const { register } = useStore();
  const [role, setRole] = useState<"Customer" | "Vendor">("Customer");
  const [values, setValues] = useState<Values>(EMPTY);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState(false);

  const isSeller = role === "Vendor";

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  function validate(): boolean {
    const next: Errors = {};
    if (values.name.trim().length < 2) next.name = "Enter your full name";
    if (!isEmail(values.email)) next.email = "Enter a valid email address";
    if (!isUaePhone(values.phone)) next.phone = "Enter a UAE mobile number, e.g. 050 123 4567";
    if (!isStrongPassword(values.password))
      next.password = "Your password doesn't meet all five rules yet";
    if (values.confirm !== values.password) next.confirm = "Passwords don't match";

    if (isSeller) {
      if (values.businessName.trim().length < 2)
        next.businessName = "Enter your registered business name";
      if (!values.tradeLicenseNumber.trim())
        next.tradeLicenseNumber = "Enter your trade licence number";
      if (values.corporateAddress.trim().length < 5)
        next.corporateAddress = "Enter your corporate address";
      if (!values.bankName.trim()) next.bankName = "Enter the bank that holds your account";
      if (!isUaeIban(values.iban)) next.iban = "Enter a UAE IBAN — AE followed by 21 digits";
    }

    if (!terms) next.terms = "Please accept the terms to continue";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    const payload: RegisterInput = {
      name: values.name.trim(),
      email: values.email.trim().toLowerCase(),
      phone: normalizePhone(values.phone),
      password: values.password,
      role,
      ...(isSeller
        ? {
            vendorDetails: {
              businessName: values.businessName.trim(),
              tradeLicenseNumber: values.tradeLicenseNumber.trim(),
              corporateAddress: values.corporateAddress.trim(),
              vatNumber: values.vatNumber.trim() || undefined,
              bankAccount: {
                bankName: values.bankName.trim(),
                accountName: values.businessName.trim(),
                iban: values.iban.replace(/\s/g, "").toUpperCase(),
              },
            },
          }
        : {}),
    };

    setPending(true);
    try {
      const user = await register(payload);
      onRegistered(user);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  const field = (
    key: keyof Values,
    label: string,
    props: {
      placeholder?: string;
      type?: string;
      inputMode?: "text" | "tel" | "email";
      autoComplete?: string;
      hint?: ReactNode;
    } = {},
  ) => {
    const { hint, ...inputProps } = props;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`register-${key}`}>{label}</Label>
        <Input
          id={`register-${key}`}
          value={values[key]}
          onChange={(event) => set(key, event.target.value)}
          aria-invalid={Boolean(errors[key])}
          aria-describedby={errors[key] ? `register-${key}-error` : undefined}
          className="h-11 rounded-xl"
          {...inputProps}
        />
        {errors[key] ? (
          <p id={`register-${key}-error`} className="text-xs font-medium text-destructive">
            {errors[key]}
          </p>
        ) : (
          hint && <p className="text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">I want to</legend>
        <div className="grid grid-cols-2 gap-2">
          {ACCOUNT_TYPES.map(({ value, label, body, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setRole(value)}
              aria-pressed={role === value}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                role === value ? "border-foreground bg-accent" : "border-border hover:bg-accent/60",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="text-sm font-bold">{label}</span>
              <span className="text-[11px] leading-tight text-muted-foreground">{body}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-4">
        {field("name", "Full name", { autoComplete: "name", placeholder: "Fatima Al Suwaidi" })}
        <div className="grid gap-4 sm:grid-cols-2">
          {field("email", "Email address", {
            type: "email",
            inputMode: "email",
            autoComplete: "email",
            placeholder: "you@example.com",
          })}
          {field("phone", "Mobile number", {
            type: "tel",
            inputMode: "tel",
            autoComplete: "tel",
            placeholder: "050 123 4567",
          })}
        </div>

        <PasswordField
          id="register-password"
          label="Password"
          value={values.password}
          onChange={(value) => set("password", value)}
          error={errors.password}
          autoComplete="new-password"
        />
        <PasswordStrength password={values.password} />

        <PasswordField
          id="register-confirm"
          label="Confirm password"
          value={values.confirm}
          onChange={(value) => set("confirm", value)}
          error={errors.confirm}
          autoComplete="new-password"
        />
      </div>

      {isSeller && (
        <div className="space-y-4 rounded-2xl border border-border bg-muted/40 p-4">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Seller accounts are reviewed by our team before your storefront goes live. Payouts are
              sent to the UAE bank account below.
            </p>
          </div>

          {field("businessName", "Business name", { placeholder: "Gulf Beauty Trading LLC" })}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("tradeLicenseNumber", "Trade licence number", { placeholder: "CN-1234567" })}
            {field("vatNumber", "VAT number (optional)", { placeholder: "100123456700003" })}
          </div>
          {field("corporateAddress", "Corporate address", {
            placeholder: "Office 1204, Business Bay, Dubai",
          })}
          <div className="grid gap-4 sm:grid-cols-2">
            {field("bankName", "Bank name", { placeholder: "Emirates NBD" })}
            {field("iban", "IBAN", {
              placeholder: "AE070331234567890123456",
              hint: "AE followed by 21 digits",
            })}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed">
          <Checkbox
            checked={terms}
            onCheckedChange={(checked) => {
              setTerms(checked === true);
              setErrors((current) => ({ ...current, terms: undefined }));
            }}
            aria-invalid={Boolean(errors.terms)}
            className="mt-0.5"
          />
          <span className="text-muted-foreground">
            I agree to Smart Deal&apos;s{" "}
            <Link
              to="/pages/$slug"
              params={{ slug: "terms-of-use" }}
              target="_blank"
              className="font-semibold text-foreground underline underline-offset-4"
            >
              Terms of Use
            </Link>{" "}
            and consent to order updates by email and SMS.
          </span>
        </label>
        {errors.terms && <p className="text-xs font-medium text-destructive">{errors.terms}</p>}
      </div>

      <Button type="submit" className="h-11 w-full rounded-xl font-semibold" disabled={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        {pending ? "Creating account…" : isSeller ? "Apply to sell" : "Create account"}
      </Button>
    </form>
  );
}
