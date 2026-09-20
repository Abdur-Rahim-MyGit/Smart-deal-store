import { useState } from "react";
import { Check, MapPin, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AddressForm, type AddressInput } from "@/components/common/address-form";
import { EmptyState } from "@/components/common/empty-state";
import { api, errorMessage } from "@/lib/api";
import { formatAddressLines } from "@/components/checkout/format-address";
import type { Address } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface AddressStepProps {
  addresses: Address[];
  selectedId: string | null;
  onSelect: (addressId: string) => void;
  /** Hands the updated address book back so the session user can be refreshed. */
  onAddressesChange: (addresses: Address[]) => void;
}

/** Step 1: choose, add or edit the delivery address. */
export function AddressStep({
  addresses,
  selectedId,
  onSelect,
  onAddressesChange,
}: AddressStepProps) {
  const [mode, setMode] = useState<
    { type: "list" } | { type: "new" } | { type: "edit"; id: string }
  >({ type: "list" });
  const [saving, setSaving] = useState(false);
  const [settingDefault, setSettingDefault] = useState<string | null>(null);

  async function createAddress(values: AddressInput) {
    setSaving(true);
    try {
      const data = await api<{ address: Address; addresses: Address[] }>("/auth/addresses", {
        method: "POST",
        body: values,
      });
      onAddressesChange(data.addresses);
      if (data.address._id) onSelect(data.address._id);
      setMode({ type: "list" });
      toast.success("Address saved");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function updateAddress(addressId: string, values: AddressInput) {
    setSaving(true);
    try {
      const data = await api<{ address: Address; addresses: Address[] }>(
        `/auth/addresses/${addressId}`,
        {
          method: "PUT",
          body: values,
        },
      );
      onAddressesChange(data.addresses);
      setMode({ type: "list" });
      toast.success("Address updated");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(addressId: string) {
    setSettingDefault(addressId);
    try {
      const data = await api<{ addresses: Address[] }>(`/auth/addresses/${addressId}/default`, {
        method: "PUT",
      });
      onAddressesChange(data.addresses);
      toast.success("Default address updated");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSettingDefault(null);
    }
  }

  if (mode.type === "new") {
    return (
      <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
        <h3 className="mb-4 text-sm font-bold">New delivery address</h3>
        <AddressForm
          submitLabel="Save and deliver here"
          saving={saving}
          onSubmit={createAddress}
          onCancel={() => setMode({ type: "list" })}
          showDefaultToggle={addresses.length > 0}
        />
      </div>
    );
  }

  if (mode.type === "edit") {
    const editing = addresses.find((address) => address._id === mode.id);
    if (editing) {
      return (
        <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
          <h3 className="mb-4 text-sm font-bold">Edit address</h3>
          <AddressForm
            initial={editing}
            submitLabel="Save changes"
            saving={saving}
            onSubmit={(values) => updateAddress(mode.id, values)}
            onCancel={() => setMode({ type: "list" })}
          />
        </div>
      );
    }
  }

  if (addresses.length === 0) {
    return (
      <EmptyState
        icon={MapPin}
        title="No delivery address yet"
        description="Add where we should deliver your order. You can save up to 10 addresses."
        action={
          <Button className="rounded-xl font-semibold" onClick={() => setMode({ type: "new" })}>
            <Plus className="mr-1.5 h-4 w-4" /> Add an address
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <fieldset className="space-y-3">
        <legend className="sr-only">Delivery address</legend>
        {addresses.map((address) => {
          const id = address._id ?? "";
          const selected = id === selectedId;
          return (
            <div
              key={id}
              className={cn(
                "rounded-xl border p-4 transition-colors",
                selected ? "border-foreground bg-accent/40" : "border-border hover:bg-accent/20",
              )}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="delivery-address"
                  value={id}
                  checked={selected}
                  onChange={() => onSelect(id)}
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="min-w-0 flex-1 space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">{address.receiverName}</span>
                    {address.addressType && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {address.addressType}
                      </span>
                    )}
                    {address.isDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-semibold text-success">
                        <Star className="h-3 w-3 fill-current" /> Default
                      </span>
                    )}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {formatAddressLines(address)}
                  </span>
                  {address.landmark && (
                    <span className="block text-xs text-muted-foreground">
                      Near {address.landmark}
                    </span>
                  )}
                  <span className="block text-xs text-muted-foreground">
                    {address.receiverPhone}
                  </span>
                </span>
                {selected && <Check className="mt-1 h-4 w-4 shrink-0 text-success" />}
              </label>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 pl-7 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setMode({ type: "edit", id })}
                  className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                >
                  Edit
                </button>
                {!address.isDefault && (
                  <button
                    type="button"
                    disabled={settingDefault === id}
                    onClick={() => void makeDefault(id)}
                    className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    {settingDefault === id ? "Saving…" : "Set as default"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </fieldset>

      <Button
        variant="outline"
        className="w-full rounded-xl font-semibold sm:w-auto"
        onClick={() => setMode({ type: "new" })}
      >
        <Plus className="mr-1.5 h-4 w-4" /> Add a new address
      </Button>
    </div>
  );
}
