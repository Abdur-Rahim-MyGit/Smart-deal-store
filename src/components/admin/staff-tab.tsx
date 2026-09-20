import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Crown,
  Eye,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserCog,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { useStore } from "@/context/store";
import { api, errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { AdminPermission, User } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ConfirmDialog,
  DataTable,
  Field,
  FormDialog,
  Note,
  SELECT_CLASS,
  TabState,
  adminRetry,
} from "@/components/admin/people-shared";

interface StaffResponse {
  staff: User[];
  permissions: AdminPermission[];
}

interface AdminRole {
  _id: string;
  name: string;
  description?: string | undefined;
  permissions: AdminPermission[];
  viewPermissions: AdminPermission[];
  staffCount: number;
}

interface Access {
  permissions: AdminPermission[];
  viewPermissions: AdminPermission[];
}

type Level = "none" | "view" | "edit";

/** What each permission unlocks in the console — shown as a legend and next to the controls. */
const PERMISSION_COPY: Record<AdminPermission, string> = {
  orders: "Orders, fulfilment status changes and return decisions",
  products: "Product moderation, merchandising, categories and brands",
  customers: "Customer accounts: edit, block, reset passwords, delete",
  vendors: "Seller applications, suspensions and commission overrides",
  marketing: "Coupons, banners, content pages and newsletter subscribers",
  reviews: "Review moderation and deletion",
  support: "Support tickets and the contact-form inbox",
  finance: "Seller payouts and customer wallet adjustments",
  settings: "Store settings, delivery rates and the audit log",
};

const PASSWORD_RULES: Array<{ label: string; test: (value: string) => boolean }> = [
  { label: "At least 8 characters", test: (value) => value.length >= 8 },
  { label: "An uppercase letter", test: (value) => /[A-Z]/.test(value) },
  { label: "A lowercase letter", test: (value) => /[a-z]/.test(value) },
  { label: "A number", test: (value) => /\d/.test(value) },
  { label: "A special character", test: (value) => /[^A-Za-z0-9]/.test(value) },
];

interface StaffForm extends Access {
  name: string;
  email: string;
  phone: string;
  password: string;
  adminRole: string; // "" = custom access
  isSuperAdmin: boolean;
  status: "Active" | "Blocked";
}

const BLANK: StaffForm = {
  name: "",
  email: "",
  phone: "",
  password: "",
  adminRole: "",
  permissions: [],
  viewPermissions: [],
  isSuperAdmin: false,
  status: "Active",
};

interface RoleForm extends Access {
  name: string;
  description: string;
}

const BLANK_ROLE: RoleForm = { name: "", description: "", permissions: [], viewPermissions: [] };

const roleIdOf = (staff: User): string =>
  typeof staff.adminRole === "object" && staff.adminRole
    ? staff.adminRole._id
    : (staff.adminRole ?? "");

const roleNameOf = (staff: User): string | null =>
  typeof staff.adminRole === "object" && staff.adminRole ? staff.adminRole.name : null;

function levelOf(access: Access, permission: AdminPermission): Level {
  if (access.permissions.includes(permission)) return "edit";
  if (access.viewPermissions.includes(permission)) return "view";
  return "none";
}

function withLevel<T extends Access>(access: T, permission: AdminPermission, level: Level): T {
  return {
    ...access,
    permissions:
      level === "edit"
        ? [...new Set([...access.permissions, permission])]
        : access.permissions.filter((entry) => entry !== permission),
    viewPermissions:
      level === "view"
        ? [...new Set([...access.viewPermissions, permission])]
        : access.viewPermissions.filter((entry) => entry !== permission),
  };
}

export function StaffTab() {
  const queryClient = useQueryClient();
  const { user: admin } = useStore();

  const [editing, setEditing] = useState<User | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<StaffForm>(BLANK);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const [editingRole, setEditingRole] = useState<AdminRole | null>(null);
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [roleForm, setRoleForm] = useState<RoleForm>(BLANK_ROLE);
  const [deleteRole, setDeleteRole] = useState<AdminRole | null>(null);
  const [mfaResetTarget, setMfaResetTarget] = useState<User | null>(null);

  const query = useQuery({
    queryKey: ["admin-staff"],
    queryFn: () => api<StaffResponse>("/admin/staff"),
    retry: adminRetry,
  });

  const rolesQuery = useQuery({
    queryKey: ["admin-roles"],
    queryFn: () => api<{ roles: AdminRole[] }>("/admin/roles").then((response) => response.roles),
    retry: adminRetry,
  });
  const roles = rolesQuery.data ?? [];

  const permissions =
    query.data?.permissions ?? (Object.keys(PERMISSION_COPY) as AdminPermission[]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-staff"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
  }

  const save = useMutation({
    mutationFn: (input: { id?: string | undefined; body: Record<string, unknown> }) =>
      input.id
        ? api<{ message: string }>(`/admin/staff/${input.id}`, { method: "PUT", body: input.body })
        : api<{ message: string }>("/admin/staff", { method: "POST", body: input.body }),
    onSuccess: (response) => {
      toast.success(response.message || "Staff account saved");
      setFormOpen(false);
      setEditing(null);
      setForm(BLANK);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/admin/staff/${id}`, { method: "DELETE" }),
    onSuccess: (response) => {
      toast.success(response.message || "Staff account deleted");
      setDeleteTarget(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const saveRole = useMutation({
    mutationFn: (input: { id?: string | undefined; body: RoleForm }) =>
      api<{ message: string }>(input.id ? `/admin/roles/${input.id}` : "/admin/roles", {
        method: input.id ? "PUT" : "POST",
        body: input.body,
      }),
    onSuccess: (response) => {
      toast.success(response.message);
      setRoleFormOpen(false);
      setEditingRole(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const resetMfa = useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/admin/staff/${id}/mfa-reset`, { method: "POST" }),
    onSuccess: (response) => {
      toast.success(response.message);
      setMfaResetTarget(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const removeRole = useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/admin/roles/${id}`, { method: "DELETE" }),
    onSuccess: (response) => {
      toast.success(response.message);
      setDeleteRole(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function openCreate() {
    setEditing(null);
    setForm(BLANK);
    setFormOpen(true);
  }

  function openEdit(staff: User) {
    setEditing(staff);
    setForm({
      name: staff.name,
      email: staff.email,
      phone: staff.phone ?? "",
      password: "",
      adminRole: roleIdOf(staff),
      permissions: staff.permissions ?? [],
      viewPermissions: staff.viewPermissions ?? [],
      isSuperAdmin: Boolean(staff.isSuperAdmin),
      status: staff.status,
    });
    setFormOpen(true);
  }

  function openRole(role: AdminRole | null) {
    setEditingRole(role);
    setRoleForm(
      role
        ? {
            name: role.name,
            description: role.description ?? "",
            permissions: role.permissions,
            viewPermissions: role.viewPermissions,
          }
        : BLANK_ROLE,
    );
    setRoleFormOpen(true);
  }

  /** Access shown in the staff form: the chosen role's, or the custom selection. */
  const selectedRole = roles.find((role) => role._id === form.adminRole) ?? null;
  const formAccess: Access = selectedRole ?? form;

  function accessBody(): Record<string, unknown> {
    return form.adminRole
      ? { adminRole: form.adminRole }
      : { adminRole: null, permissions: form.permissions, viewPermissions: form.viewPermissions };
  }

  function submit() {
    if (!form.name.trim()) {
      toast.error("Enter the staff member's name");
      return;
    }
    const hasAccess =
      form.isSuperAdmin ||
      Boolean(form.adminRole) ||
      form.permissions.length > 0 ||
      form.viewPermissions.length > 0;

    if (editing) {
      const isSelf = editing._id === admin?._id;
      save.mutate({
        id: editing._id,
        body: {
          name: form.name.trim(),
          ...accessBody(),
          isSuperAdmin: form.isSuperAdmin,
          ...(isSelf ? {} : { status: form.status }),
        },
      });
      return;
    }

    if (!form.email.trim()) {
      toast.error("Enter a work email address");
      return;
    }
    const failed = PASSWORD_RULES.filter((rule) => !rule.test(form.password));
    if (failed.length) {
      toast.error(`Password needs: ${failed.map((rule) => rule.label.toLowerCase()).join(", ")}`);
      return;
    }
    if (!hasAccess) {
      toast.error("Pick a role or some access, or make this account a super admin");
      return;
    }

    save.mutate({
      body: {
        name: form.name.trim(),
        email: form.email.trim(),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        password: form.password,
        ...accessBody(),
        isSuperAdmin: form.isSuperAdmin,
      },
    });
  }

  function submitRole() {
    if (roleForm.name.trim().length < 2) {
      toast.error("Give the role a name");
      return;
    }
    saveRole.mutate({
      ...(editingRole ? { id: editingRole._id } : {}),
      body: { ...roleForm, name: roleForm.name.trim(), description: roleForm.description.trim() },
    });
  }

  const rows = query.data?.staff ?? [];

  return (
    <div className="space-y-4">
      <SectionCard
        title="Staff"
        description="Admin accounts that can sign in to this console, and what each of them can reach."
        actions={
          <Button className="rounded-xl" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> Create staff
          </Button>
        }
      >
        <div className="space-y-4">
          <TabState
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
          >
            {rows.length === 0 ? (
              <EmptyState
                icon={UserCog}
                title="No admin accounts yet"
                description="Create the first staff login."
              />
            ) : (
              <DataTable
                rows={rows}
                rowKey={(row) => row._id}
                columns={[
                  {
                    key: "name",
                    header: "Staff member",
                    cell: (row) => (
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-semibold">
                          {row.name}
                          {row._id === admin?._id && (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                              You
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                      </div>
                    ),
                  },
                  {
                    key: "access",
                    header: "Access",
                    cell: (row) => <StaffAccess staff={row} />,
                  },
                  {
                    key: "mfa",
                    header: "2-step",
                    cell: (row) =>
                      row.mfaEnabled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
                          <ShieldCheck className="h-3.5 w-3.5" /> On
                          {row._id !== admin?._id && (
                            <button
                              type="button"
                              className="ml-1 text-muted-foreground underline underline-offset-2"
                              onClick={() => setMfaResetTarget(row)}
                            >
                              Reset
                            </button>
                          )}
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Off</span>
                      ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (row) => <StatusBadge status={row.status} />,
                  },
                  {
                    key: "created",
                    header: "Added",
                    className: "whitespace-nowrap",
                    cell: (row) => (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(row.createdAt)}
                      </span>
                    ),
                  },
                  {
                    key: "actions",
                    header: <span className="sr-only">Actions</span>,
                    className: "text-right",
                    cell: (row) => (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          aria-label={`Edit ${row.name}`}
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-destructive"
                          aria-label={`Delete ${row.name}`}
                          disabled={row._id === admin?._id}
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ),
                  },
                ]}
                card={(row) => (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{row.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                      </div>
                      <StatusBadge status={row.status} />
                    </div>
                    <StaffAccess staff={row} />
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => openEdit(row)}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-destructive"
                        disabled={row._id === admin?._id}
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </div>
                )}
              />
            )}
          </TabState>

          <Note>
            You can&apos;t block or demote your own account, and Smart Deal always keeps at least
            one active super admin. Blocking a staff account ends their sessions immediately.
          </Note>
        </div>
      </SectionCard>

      <SectionCard
        title="Roles"
        description="Named sets of access. Changing a role updates everyone who has it."
        actions={
          <Button variant="outline" className="rounded-xl" onClick={() => openRole(null)}>
            <Plus className="mr-1.5 h-4 w-4" /> New role
          </Button>
        }
      >
        <TabState
          isLoading={rolesQuery.isLoading}
          error={rolesQuery.error}
          onRetry={() => void rolesQuery.refetch()}
        >
          {roles.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No roles yet"
              description="Create a role to give several staff the same access in one step."
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {roles.map((role) => (
                <li key={role._id} className="space-y-2 rounded-2xl border border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display font-bold">{role.name}</p>
                      {role.description && (
                        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                          {role.description}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
                      {role.staffCount} staff
                    </span>
                  </div>
                  <PermissionChips access={role} />
                  <div className="flex gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => openRole(role)}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-destructive"
                      disabled={role.staffCount > 0}
                      title={
                        role.staffCount > 0 ? "Move its staff to another role first" : undefined
                      }
                      onClick={() => setDeleteRole(role)}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabState>
      </SectionCard>

      <SectionCard
        title="What each area covers"
        description="View access can open a section and read everything in it; edit access can also change it."
      >
        <dl className="grid gap-2 sm:grid-cols-2">
          {permissions.map((permission) => (
            <div key={permission} className="rounded-xl border border-border px-3 py-2">
              <dt className="text-xs font-bold capitalize">{permission}</dt>
              <dd className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {PERMISSION_COPY[permission] ?? "Access to this section of the console"}
              </dd>
            </div>
          ))}
        </dl>
      </SectionCard>

      <FormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        size="lg"
        title={editing ? `Edit ${editing.name}` : "Create a staff account"}
        description={
          editing
            ? "Change what this account can reach, or block it to end their sessions."
            : "The new admin can sign in straight away with the password you set here."
        }
        submitLabel={editing ? "Save changes" : "Create account"}
        pending={save.isPending}
        onSubmit={submit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="staff-name" required>
            <Input
              id="staff-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="rounded-xl"
            />
          </Field>
          <Field
            label="Work email"
            htmlFor="staff-email"
            required
            hint={editing ? "Email can't be changed." : undefined}
          >
            <Input
              id="staff-email"
              type="email"
              autoComplete="off"
              disabled={Boolean(editing)}
              value={form.email}
              onChange={(event) =>
                setForm((current) => ({ ...current, email: event.target.value }))
              }
              className="rounded-xl"
            />
          </Field>
        </div>

        {!editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Phone (optional)"
              htmlFor="staff-phone"
              hint="UAE mobile, e.g. +971501234567"
            >
              <Input
                id="staff-phone"
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                className="rounded-xl"
              />
            </Field>
            <Field label="Temporary password" htmlFor="staff-password" required>
              <Input
                id="staff-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                className="rounded-xl"
              />
            </Field>
          </div>
        )}

        {!editing && (
          <ul className="grid gap-1 rounded-xl bg-muted/60 px-3 py-2.5 sm:grid-cols-2">
            {PASSWORD_RULES.map((rule) => {
              const ok = rule.test(form.password);
              return (
                <li
                  key={rule.label}
                  className={cn(
                    "flex items-center gap-1.5 text-[11px]",
                    ok ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {rule.label}
                </li>
              );
            })}
          </ul>
        )}

        {editing && (
          <Field
            label="Account status"
            htmlFor="staff-status"
            hint="Blocking signs this admin out of every device right away."
          >
            <select
              id="staff-status"
              className={SELECT_CLASS}
              value={form.status}
              disabled={editing._id === admin?._id}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value === "Blocked" ? "Blocked" : "Active",
                }))
              }
            >
              <option value="Active">Active</option>
              <option value="Blocked">Blocked</option>
            </select>
          </Field>
        )}

        <div className="flex items-start justify-between gap-4 rounded-xl border border-border px-3 py-2.5">
          <div className="min-w-0">
            <Label htmlFor="staff-super" className="flex items-center gap-1.5 text-xs font-bold">
              <Crown className="h-3.5 w-3.5" /> Super admin
            </Label>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
              Full access to every section, including staff and roles. Role and access below are
              ignored.
            </p>
          </div>
          <Switch
            id="staff-super"
            checked={form.isSuperAdmin}
            disabled={Boolean(editing && editing._id === admin?._id)}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, isSuperAdmin: checked }))
            }
          />
        </div>

        <div className={cn("space-y-3", form.isSuperAdmin && "pointer-events-none opacity-50")}>
          <Field
            label="Role"
            htmlFor="staff-role"
            hint="Pick a role to keep this account in step with it, or set custom access."
          >
            <select
              id="staff-role"
              className={SELECT_CLASS}
              value={form.adminRole}
              onChange={(event) =>
                setForm((current) => ({ ...current, adminRole: event.target.value }))
              }
            >
              <option value="">Custom access</option>
              {roles.map((role) => (
                <option key={role._id} value={role._id}>
                  {role.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-bold">
              <KeyRound className="h-3.5 w-3.5" />{" "}
              {selectedRole ? `Access from ${selectedRole.name}` : "Access"}
            </Label>
            <AccessMatrix
              permissions={permissions}
              access={formAccess}
              disabled={Boolean(selectedRole)}
              onChange={(permission, level) =>
                setForm((current) => withLevel(current, permission, level))
              }
            />
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={roleFormOpen}
        onOpenChange={(open) => {
          setRoleFormOpen(open);
          if (!open) setEditingRole(null);
        }}
        size="lg"
        title={editingRole ? `Edit ${editingRole.name}` : "New role"}
        description={
          editingRole && editingRole.staffCount > 0
            ? `Saving updates the ${editingRole.staffCount} staff account(s) on this role straight away.`
            : "Staff assigned to this role get exactly this access."
        }
        submitLabel={editingRole ? "Save role" : "Create role"}
        pending={saveRole.isPending}
        onSubmit={submitRole}
      >
        <Field label="Role name" htmlFor="role-name" required>
          <Input
            id="role-name"
            value={roleForm.name}
            onChange={(event) => setRoleForm({ ...roleForm, name: event.target.value })}
            placeholder="e.g. Weekend support"
            className="rounded-xl"
          />
        </Field>
        <Field label="Description" htmlFor="role-description">
          <Textarea
            id="role-description"
            rows={2}
            value={roleForm.description}
            onChange={(event) => setRoleForm({ ...roleForm, description: event.target.value })}
            className="rounded-xl"
          />
        </Field>
        <AccessMatrix
          permissions={permissions}
          access={roleForm}
          onChange={(permission, level) =>
            setRoleForm((current) => withLevel(current, permission, level))
          }
        />
      </FormDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this staff account?"
        confirmLabel="Delete account"
        pending={remove.isPending}
        description={
          <>
            <p>
              <strong className="text-foreground">{deleteTarget?.name}</strong> (
              {deleteTarget?.email}) will lose access to the console immediately. This can&apos;t be
              undone.
            </p>
            <p>Their past actions stay in the audit log.</p>
          </>
        }
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget._id)}
      />

      <ConfirmDialog
        open={Boolean(mfaResetTarget)}
        onOpenChange={(open) => !open && setMfaResetTarget(null)}
        title={`Reset two-step sign-in for ${mfaResetTarget?.name ?? ""}?`}
        confirmLabel="Reset"
        pending={resetMfa.isPending}
        description={
          <p>
            Use this when they&apos;ve lost their phone. Their authenticator and recovery codes stop
            working, they&apos;re signed out everywhere, and they set it up again at their next
            sign-in.
          </p>
        }
        onConfirm={() => mfaResetTarget && resetMfa.mutate(mfaResetTarget._id)}
      />

      <ConfirmDialog
        open={Boolean(deleteRole)}
        onOpenChange={(open) => !open && setDeleteRole(null)}
        title={`Delete the ${deleteRole?.name ?? ""} role?`}
        confirmLabel="Delete role"
        pending={removeRole.isPending}
        description={<p>No staff use it, so nobody loses access.</p>}
        onConfirm={() => deleteRole && removeRole.mutate(deleteRole._id)}
      />
    </div>
  );
}

const LEVELS: Array<{ value: Level; label: string }> = [
  { value: "none", label: "No access" },
  { value: "view", label: "View" },
  { value: "edit", label: "Edit" },
];

/** One row per console area with a No access / View / Edit switch. */
function AccessMatrix({
  permissions,
  access,
  onChange,
  disabled = false,
}: {
  permissions: AdminPermission[];
  access: Access;
  onChange: (permission: AdminPermission, level: Level) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border">
      {permissions.map((permission) => {
        const current = levelOf(access, permission);
        return (
          <li
            key={permission}
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold capitalize">{permission}</span>
              <span className="block text-[11px] leading-snug text-muted-foreground">
                {PERMISSION_COPY[permission] ?? "Access to this section of the console"}
              </span>
            </span>
            <span
              role="radiogroup"
              aria-label={`${permission} access`}
              className="flex shrink-0 rounded-lg border border-border p-0.5"
            >
              {LEVELS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  role="radio"
                  aria-checked={current === level.value}
                  disabled={disabled}
                  onClick={() => onChange(permission, level.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed",
                    current === level.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {level.label}
                </button>
              ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function StaffAccess({ staff }: { staff: User }) {
  if (staff.isSuperAdmin) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2.5 py-0.5 text-[11px] font-bold text-primary">
        <Crown className="h-3 w-3" /> Super admin
      </span>
    );
  }
  const roleName = roleNameOf(staff);
  return (
    <div className="space-y-1">
      {roleName && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold">
          <ShieldCheck className="h-3 w-3" /> {roleName}
        </span>
      )}
      <PermissionChips
        access={{
          permissions: staff.permissions ?? [],
          viewPermissions: staff.viewPermissions ?? [],
        }}
      />
    </div>
  );
}

function PermissionChips({ access }: { access: Access }) {
  if (access.permissions.length === 0 && access.viewPermissions.length === 0) {
    return <span className="text-xs text-muted-foreground">No access</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {access.permissions.map((permission) => (
        <span
          key={permission}
          title={`Edit: ${PERMISSION_COPY[permission]}`}
          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold capitalize"
        >
          {permission}
        </span>
      ))}
      {access.viewPermissions.map((permission) => (
        <span
          key={permission}
          title={`View only: ${PERMISSION_COPY[permission]}`}
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground capitalize"
        >
          <Eye className="h-2.5 w-2.5" /> {permission}
        </span>
      ))}
    </div>
  );
}
