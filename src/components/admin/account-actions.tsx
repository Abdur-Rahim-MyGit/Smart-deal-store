/** Account maintenance shared by the Customers and Sellers tabs: edit, reset, unlock, delete. */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, LockOpen, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/api";
import type { User } from "@/lib/types";
import {
  ConfirmDialog,
  Field,
  FormDialog,
  Note,
  SELECT_CLASS,
} from "@/components/admin/people-shared";
import type { AdminUserDetail } from "@/components/admin/people-user-dialog";

const GENDERS = ["", "Male", "Female", "Prefer not to say"] as const;

interface EditForm {
  name: string;
  email: string;
  phone: string;
  gender: string;
}

const formFrom = (user: User): EditForm => ({
  name: user.name,
  email: user.email,
  phone: user.phone ?? "",
  gender: user.gender ?? "",
});

/** In development the API returns the link it emailed, so the flow can be tested end to end. */
function devLinkToast(message: string, url: string | undefined) {
  if (url) toast.success(message, { description: url, duration: 15_000 });
  else toast.success(message);
}

export function AccountActions({
  detail,
  mode,
  onDeleted,
}: {
  detail: AdminUserDetail;
  mode: "customer" | "vendor";
  /** Called after a customer is deleted, so the parent can close its drawer. */
  onDeleted?: (() => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const { user } = detail;
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EditForm>(() => formFrom(user));
  const [resetOpen, setResetOpen] = useState(false);
  const [signOut, setSignOut] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function refresh() {
    for (const key of ["admin-user", "admin-customers", "admin-vendors", "admin-dashboard"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  const editMutation = useMutation({
    mutationFn: (body: EditForm) =>
      api<{ message: string; devVerifyUrl?: string }>(`/admin/users/${user._id}`, {
        method: "PUT",
        body,
      }),
    onSuccess: (response) => {
      devLinkToast(response.message, response.devVerifyUrl);
      setEditOpen(false);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const resetMutation = useMutation({
    mutationFn: () =>
      api<{ message: string; devResetUrl?: string }>(`/admin/users/${user._id}/password-reset`, {
        method: "POST",
        body: { signOut },
      }),
    onSuccess: (response) => {
      devLinkToast(response.message, response.devResetUrl);
      setResetOpen(false);
      setSignOut(false);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const unlockMutation = useMutation({
    mutationFn: () =>
      api<{ message: string }>(`/admin/users/${user._id}/unlock`, { method: "POST" }),
    onSuccess: (response) => {
      toast.success(response.message);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api<{ message: string }>(`/admin/users/${user._id}`, { method: "DELETE" }),
    onSuccess: (response) => {
      toast.success(response.message);
      setDeleteOpen(false);
      refresh();
      onDeleted?.();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (user.deletedAt) return null;
  const blocked = user.status === "Blocked";

  function submitEdit() {
    if (form.name.trim().length < 2) {
      toast.error("Enter the full name");
      return;
    }
    if (!form.email.trim()) {
      toast.error("Enter an email address");
      return;
    }
    editMutation.mutate({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      gender: form.gender,
    });
  }

  return (
    <>
      <Button
        variant="outline"
        className="rounded-xl"
        onClick={() => {
          setForm(formFrom(user));
          setEditOpen(true);
        }}
      >
        <Pencil className="mr-1.5 h-4 w-4" /> Edit details
      </Button>
      <Button
        variant="outline"
        className="rounded-xl"
        disabled={blocked}
        title={blocked ? "Unblock the account first" : undefined}
        onClick={() => setResetOpen(true)}
      >
        <KeyRound className="mr-1.5 h-4 w-4" /> Send password reset
      </Button>
      {detail.security?.lockedUntil && (
        <Button
          variant="outline"
          className="rounded-xl"
          disabled={unlockMutation.isPending}
          onClick={() => unlockMutation.mutate()}
        >
          <LockOpen className="mr-1.5 h-4 w-4" /> Unlock sign-in
        </Button>
      )}
      {mode === "customer" && (
        <Button
          variant="outline"
          className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-1.5 h-4 w-4" /> Delete account
        </Button>
      )}

      <FormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Edit account details"
        description={user.email}
        submitLabel="Save details"
        pending={editMutation.isPending}
        onSubmit={submitEdit}
      >
        <Field label="Full name" htmlFor="acct-name" required>
          <Input
            id="acct-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="rounded-xl"
          />
        </Field>
        <Field
          label="Email"
          htmlFor="acct-email"
          required
          hint="Changing it sends a verification link to the new address and a notice to the old one. Checkout stays locked until the new address is verified."
        >
          <Input
            id="acct-email"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="rounded-xl"
          />
        </Field>
        <Field label="Mobile number" htmlFor="acct-phone" hint="UAE number, e.g. +971 50 123 4567">
          <Input
            id="acct-phone"
            type="tel"
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            className="rounded-xl"
          />
        </Field>
        <Field label="Gender" htmlFor="acct-gender">
          <select
            id="acct-gender"
            className={SELECT_CLASS}
            value={form.gender}
            onChange={(event) => setForm({ ...form, gender: event.target.value })}
          >
            {GENDERS.map((gender) => (
              <option key={gender} value={gender}>
                {gender || "Not specified"}
              </option>
            ))}
          </select>
        </Field>
        <Note>The change is recorded in the audit log.</Note>
      </FormDialog>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Send a password reset link?"
        destructive={false}
        confirmLabel="Send link"
        pending={resetMutation.isPending}
        description={
          <p>
            {user.name} gets an email at <strong className="text-foreground">{user.email}</strong>{" "}
            with a link to choose a new password. It works once and expires after an hour.
          </p>
        }
        onConfirm={() => resetMutation.mutate()}
      >
        <div className="flex items-start gap-2">
          <Checkbox
            id="acct-signout"
            checked={signOut}
            onCheckedChange={(checked) => setSignOut(checked === true)}
          />
          <Label htmlFor="acct-signout" className="text-xs leading-snug font-normal">
            Also sign them out of every device now (use this if the account may be compromised)
          </Label>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this customer account?"
        confirmLabel="Delete account"
        pending={deleteMutation.isPending}
        description={
          <>
            <p>
              {user.name}&apos;s name, email, phone, addresses, wishlist and cart are erased, and
              they&apos;re signed out everywhere. This can&apos;t be undone.
            </p>
            <p>
              Past orders and their VAT invoices, including the delivery address on each, are kept
              as UAE tax rules require. Accounts with open orders or wallet credit can&apos;t be
              deleted.
            </p>
          </>
        }
        onConfirm={() => deleteMutation.mutate()}
      />
    </>
  );
}
