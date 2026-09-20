import { useState } from "react";
import { Loader2, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AddressForm, type AddressInput } from "@/components/common/address-form";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/context/store";
import { api, errorMessage } from "@/lib/api";
import type { Address, User } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AddressResponse {
  addresses: Address[];
  message?: string | undefined;
}

/** Drop the Mongo id so it never ends up in the form state or the request body. */
function toInput(address: Address): AddressInput {
  const { _id, ...rest } = address;
  return rest;
}

export function AddressesSection({ user }: { user: User }) {
  const { setUser } = useStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Address | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const applyAddresses = (addresses: Address[]) => setUser({ ...user, addresses });

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(address: Address) {
    setEditing(address);
    setDialogOpen(true);
  }

  async function handleSubmit(input: AddressInput) {
    setSaving(true);
    try {
      const response = await api<AddressResponse>(
        editing?._id ? `/auth/addresses/${editing._id}` : "/auth/addresses",
        { method: editing?._id ? "PUT" : "POST", body: input },
      );
      applyAddresses(response.addresses);
      toast.success(editing ? "Address updated" : "Address saved");
      setDialogOpen(false);
      setEditing(null);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(address: Address) {
    if (!address._id) return;
    setBusyId(address._id);
    try {
      const response = await api<AddressResponse>(`/auth/addresses/${address._id}/default`, {
        method: "PUT",
      });
      applyAddresses(response.addresses);
      toast.success("Default delivery address updated");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    const address = pendingDelete;
    if (!address?._id) return;
    setBusyId(address._id);
    try {
      const response = await api<AddressResponse>(`/auth/addresses/${address._id}`, {
        method: "DELETE",
      });
      applyAddresses(response.addresses);
      toast.success("Address removed");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setBusyId(null);
      setPendingDelete(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Address book</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Save up to 10 delivery addresses across the seven emirates.
          </p>
        </div>
        <Button className="h-10 rounded-xl font-semibold" onClick={openAdd}>
          <Plus className="h-4 w-4" />
          Add address
        </Button>
      </div>

      {user.addresses.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No saved addresses"
          description="Add a delivery address now to make checkout a single tap."
          action={
            <Button className="rounded-xl font-semibold" onClick={openAdd}>
              Add your first address
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {user.addresses.map((address, index) => {
            const busy = busyId === address._id;
            return (
              <article
                key={address._id ?? index}
                className={cn(
                  "flex flex-col rounded-2xl border bg-card p-4 shadow-soft",
                  address.isDefault ? "border-foreground" : "border-border",
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-sm font-bold">{address.receiverName}</h2>
                  {address.addressType && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {address.addressType}
                    </span>
                  )}
                  {address.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-semibold text-success">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      Default
                    </span>
                  )}
                </div>

                <address className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground not-italic">
                  {address.buildingDetails}
                  <br />
                  {address.street}, {address.area}
                  <br />
                  {address.emirate}, United Arab Emirates
                  {address.landmark && (
                    <>
                      <br />
                      Near {address.landmark}
                    </>
                  )}
                  <br />
                  <span className="font-semibold text-foreground">{address.receiverPhone}</span>
                </address>

                <div className="mt-3.5 flex flex-wrap gap-2 border-t border-border pt-3.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-xl font-semibold"
                    onClick={() => openEdit(address)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  {!address.isDefault && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-xl font-semibold"
                      onClick={() => void makeDefault(address)}
                      disabled={busy}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Star className="h-3.5 w-3.5" />
                      )}
                      Set as default
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 rounded-xl font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setPendingDelete(address)}
                    disabled={busy}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit address" : "Add a delivery address"}
            </DialogTitle>
            <DialogDescription>
              We deliver across all seven emirates. Make sure the mobile number can receive calls
              from the courier.
            </DialogDescription>
          </DialogHeader>
          <AddressForm
            key={editing?._id ?? "new"}
            initial={editing ? toInput(editing) : undefined}
            submitLabel={editing ? "Save changes" : "Save address"}
            saving={saving}
            onSubmit={handleSubmit}
            onCancel={() => {
              setDialogOpen(false);
              setEditing(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this address?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `${pendingDelete.buildingDetails}, ${pendingDelete.area}, ${pendingDelete.emirate} will be removed from your address book. Orders already placed are not affected.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Keep address</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Delete address
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
