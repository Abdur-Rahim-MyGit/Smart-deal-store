import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { EMIRATES } from "@/lib/constants";
import type { Address, Emirate } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AddressInput = Omit<Address, "_id">;

const EMPTY: AddressInput = {
  receiverName: "",
  receiverPhone: "+971",
  emirate: "Dubai",
  area: "",
  street: "",
  buildingDetails: "",
  landmark: "",
  addressType: "Home",
  isDefault: false,
};

const selectClass =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

/** UAE address form (emirate, area, street, building) shared by checkout and the address book. */
export function AddressForm({
  initial,
  submitLabel = "Save address",
  onSubmit,
  onCancel,
  showDefaultToggle = true,
  saving = false,
  className,
}: {
  initial?: Partial<AddressInput> | undefined;
  submitLabel?: string;
  onSubmit: (address: AddressInput) => void | Promise<void>;
  onCancel?: (() => void) | undefined;
  showDefaultToggle?: boolean;
  saving?: boolean;
  className?: string | undefined;
}) {
  const [values, setValues] = useState<AddressInput>({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState<Partial<Record<keyof AddressInput, string>>>({});

  const set = <K extends keyof AddressInput>(key: K, value: AddressInput[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  function validate(): boolean {
    const next: Partial<Record<keyof AddressInput, string>> = {};
    if (values.receiverName.trim().length < 2)
      next.receiverName = "Enter the recipient's full name";
    const phone = values.receiverPhone.replace(/[\s-]/g, "");
    if (!/^(\+971|971|0)?5\d{8}$/.test(phone) && !/^\+971\d{8,9}$/.test(phone)) {
      next.receiverPhone = "Enter a UAE mobile number, e.g. +971501234567";
    }
    if (!values.area.trim()) next.area = "Enter the area or community";
    if (!values.street.trim()) next.street = "Enter the street";
    if (!values.buildingDetails.trim())
      next.buildingDetails = "Enter building, floor & apartment or villa number";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;
    await onSubmit({ ...values, receiverPhone: values.receiverPhone.replace(/[\s-]/g, "") });
  }

  const field = (key: keyof AddressInput, label: string, props: Record<string, unknown> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`address-${key}`}>{label}</Label>
      <Input
        id={`address-${key}`}
        value={String(values[key] ?? "")}
        onChange={(event) => set(key, event.target.value as never)}
        aria-invalid={Boolean(errors[key])}
        className="h-10 rounded-xl"
        {...props}
      />
      {errors[key] && <p className="text-xs font-medium text-destructive">{errors[key]}</p>}
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("receiverName", "Full name", { autoComplete: "name" })}
        {field("receiverPhone", "Mobile number", {
          autoComplete: "tel",
          inputMode: "tel",
          placeholder: "+971501234567",
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="address-emirate">Emirate</Label>
          <select
            id="address-emirate"
            className={selectClass}
            value={values.emirate}
            onChange={(event) => set("emirate", event.target.value as Emirate)}
          >
            {EMIRATES.map((emirate) => (
              <option key={emirate} value={emirate}>
                {emirate}
              </option>
            ))}
          </select>
        </div>
        {field("area", "Area / community", { placeholder: "e.g. Dubai Marina" })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("street", "Street", { placeholder: "e.g. Al Marsa Street" })}
        {field("buildingDetails", "Building, floor & apt / villa", {
          placeholder: "e.g. Marina Heights, Apt 1404",
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("landmark", "Nearest landmark (optional)", {
          placeholder: "e.g. Opposite Marina Mall",
        })}
        <div className="space-y-1.5">
          <Label>Address type</Label>
          <div className="flex gap-2">
            {(["Home", "Office", "Other"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => set("addressType", type)}
                className={cn(
                  "h-10 flex-1 rounded-xl border text-sm font-semibold transition-colors",
                  values.addressType === type
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-accent",
                )}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showDefaultToggle && (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={Boolean(values.isDefault)}
            onCheckedChange={(checked) => set("isDefault", checked === true)}
          />
          Use as my default delivery address
        </label>
      )}

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" className="rounded-xl font-semibold" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
