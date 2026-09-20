import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { useCategories } from "@/hooks/use-categories";
import { api, errorMessage } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import {
  ConfirmDialog,
  DataTable,
  Field,
  FormDialog,
  Note,
  SELECT_CLASS,
  TabState,
  adminRetry,
  fromLocalInput,
  numberField,
  toLocalInput,
} from "@/components/admin/people-shared";

type DiscountType = "Percentage" | "Fixed" | "Free Shipping";

interface AdminCoupon {
  _id: string;
  code: string;
  description?: string | undefined;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount?: number | null | undefined;
  minOrderValue: number;
  startDate: string;
  endDate: string;
  usageLimit?: number | null | undefined;
  usedCount: number;
  limitPerUser: number;
  isActive: boolean;
  excludedCategories?: string[] | undefined;
  excludedBrands?: string[] | undefined;
  excludeClearance?: boolean | undefined;
  state: string;
}

interface CouponForm {
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  maxDiscount: string;
  minOrderValue: string;
  startDate: string;
  endDate: string;
  usageLimit: string;
  limitPerUser: string;
  isActive: boolean;
  excludedCategories: string[];
  excludedBrands: string;
  excludeClearance: boolean;
}

function blankForm(): CouponForm {
  const now = new Date();
  const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return {
    code: "",
    description: "",
    discountType: "Percentage",
    discountValue: "10",
    maxDiscount: "",
    minOrderValue: "0",
    startDate: toLocalInput(now.toISOString()),
    endDate: toLocalInput(inThirtyDays.toISOString()),
    usageLimit: "",
    limitPerUser: "1",
    isActive: true,
    excludedCategories: [],
    excludedBrands: "",
    excludeClearance: false,
  };
}

function formFrom(coupon: AdminCoupon): CouponForm {
  return {
    code: coupon.code,
    description: coupon.description ?? "",
    discountType: coupon.discountType,
    discountValue: String(coupon.discountValue ?? ""),
    maxDiscount:
      coupon.maxDiscount === null || coupon.maxDiscount === undefined
        ? ""
        : String(coupon.maxDiscount),
    minOrderValue: String(coupon.minOrderValue ?? 0),
    startDate: toLocalInput(coupon.startDate),
    endDate: toLocalInput(coupon.endDate),
    usageLimit:
      coupon.usageLimit === null || coupon.usageLimit === undefined
        ? ""
        : String(coupon.usageLimit),
    limitPerUser: String(coupon.limitPerUser ?? 1),
    isActive: coupon.isActive,
    excludedCategories: coupon.excludedCategories ?? [],
    excludedBrands: (coupon.excludedBrands ?? []).join(", "),
    excludeClearance: Boolean(coupon.excludeClearance),
  };
}

function discountLabel(coupon: AdminCoupon): string {
  if (coupon.discountType === "Free Shipping") return "Free delivery";
  if (coupon.discountType === "Percentage") {
    return `${coupon.discountValue}%${coupon.maxDiscount ? ` · max ${formatPrice(coupon.maxDiscount)}` : ""}`;
  }
  return formatPrice(coupon.discountValue);
}

export function CouponsTab() {
  const queryClient = useQueryClient();
  const { categories } = useCategories();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [form, setForm] = useState<CouponForm>(blankForm);
  const [deleteTarget, setDeleteTarget] = useState<AdminCoupon | null>(null);

  const query = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => api<{ coupons: AdminCoupon[] }>("/admin/coupons"),
    retry: adminRetry,
  });

  const categoryName = useMemo(
    () => new Map(categories.map((category) => [category._id, category.name])),
    [categories],
  );

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
  }

  const save = useMutation({
    mutationFn: (input: { id?: string | undefined; body: Record<string, unknown> }) =>
      input.id
        ? api<{ message: string }>(`/admin/coupons/${input.id}`, {
            method: "PUT",
            body: input.body,
          })
        : api<{ message: string }>("/admin/coupons", { method: "POST", body: input.body }),
    onSuccess: (response) => {
      toast.success(response.message || "Coupon saved");
      setFormOpen(false);
      setEditing(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/admin/coupons/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Coupon deleted");
      setDeleteTarget(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setFormOpen(true);
  }

  function openEdit(coupon: AdminCoupon) {
    setEditing(coupon);
    setForm(formFrom(coupon));
    setFormOpen(true);
  }

  function submit() {
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
      toast.error("Coupon codes must be 3–30 letters, numbers, dashes or underscores");
      return;
    }
    const start = fromLocalInput(form.startDate);
    const end = fromLocalInput(form.endDate);
    if (!start || !end) {
      toast.error("Set both a start and an end date");
      return;
    }
    if (new Date(end) <= new Date(start)) {
      toast.error("The end date must be after the start date");
      return;
    }

    const value = numberField(form.discountValue) ?? 0;
    if (form.discountType === "Percentage" && !(value > 0 && value <= 100)) {
      toast.error("Percentage discounts must be between 1 and 100");
      return;
    }
    if (form.discountType === "Fixed" && !(value > 0)) {
      toast.error("Enter the discount amount in AED");
      return;
    }

    const body: Record<string, unknown> = {
      code,
      description: form.description.trim(),
      discountType: form.discountType,
      discountValue: form.discountType === "Free Shipping" ? 0 : value,
      maxDiscount:
        form.discountType === "Percentage" ? (numberField(form.maxDiscount) ?? null) : null,
      minOrderValue: numberField(form.minOrderValue) ?? 0,
      startDate: start,
      endDate: end,
      usageLimit: numberField(form.usageLimit) ?? null,
      limitPerUser: numberField(form.limitPerUser) ?? 1,
      isActive: form.isActive,
      excludedCategories: form.excludedCategories,
      excludedBrands: form.excludedBrands
        .split(",")
        .map((brand) => brand.trim())
        .filter(Boolean),
      excludeClearance: form.excludeClearance,
    };

    save.mutate({ id: editing?._id, body });
  }

  function toggleCategory(id: string) {
    setForm((current) => ({
      ...current,
      excludedCategories: current.excludedCategories.includes(id)
        ? current.excludedCategories.filter((entry) => entry !== id)
        : [...current.excludedCategories, id],
    }));
  }

  const rows = query.data?.coupons ?? [];

  return (
    <div className="space-y-4">
      <SectionCard
        title="Coupons"
        description="Discount codes customers type into the cart or checkout summary."
        actions={
          <Button className="rounded-xl" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> New coupon
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
                icon={Ticket}
                title="No coupons yet"
                description="Create a code and customers can apply it at the cart or checkout."
                action={
                  <Button className="rounded-xl" onClick={openCreate}>
                    <Plus className="mr-1.5 h-4 w-4" /> New coupon
                  </Button>
                }
              />
            ) : (
              <DataTable
                rows={rows}
                rowKey={(row) => row._id}
                columns={[
                  {
                    key: "code",
                    header: "Code",
                    cell: (row) => (
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold">{row.code}</p>
                        {row.description && (
                          <p className="truncate text-xs text-muted-foreground">
                            {row.description}
                          </p>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: "type",
                    header: "Discount",
                    cell: (row) => (
                      <div>
                        <p className="font-semibold">{discountLabel(row)}</p>
                        <p className="text-[11px] text-muted-foreground">{row.discountType}</p>
                      </div>
                    ),
                  },
                  {
                    key: "min",
                    header: "Min order",
                    className: "text-right tabular-nums",
                    cell: (row) => (row.minOrderValue ? formatPrice(row.minOrderValue) : "—"),
                  },
                  {
                    key: "usage",
                    header: "Usage",
                    className: "text-right tabular-nums",
                    cell: (row) => (
                      <span>
                        {row.usedCount}
                        <span className="text-muted-foreground">
                          {" "}
                          / {row.usageLimit ? row.usageLimit : "∞"}
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: "perUser",
                    header: "Per user",
                    className: "text-right tabular-nums",
                    cell: (row) => row.limitPerUser,
                  },
                  {
                    key: "window",
                    header: "Valid",
                    className: "whitespace-nowrap",
                    cell: (row) => (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(row.startDate)} → {formatDate(row.endDate)}
                      </span>
                    ),
                  },
                  {
                    key: "state",
                    header: "State",
                    cell: (row) => <StatusBadge status={row.state} />,
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
                          aria-label={`Edit ${row.code}`}
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-destructive"
                          aria-label={`Delete ${row.code}`}
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
                        <p className="font-mono text-sm font-bold">{row.code}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {discountLabel(row)}
                        </p>
                      </div>
                      <StatusBadge status={row.state} />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(row.startDate)} → {formatDate(row.endDate)} · used {row.usedCount}
                      {row.usageLimit ? ` of ${row.usageLimit}` : ""}
                    </p>
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
            Customers apply these codes in the cart or on the checkout summary. A coupon only works
            inside its validity window, while it's active, and until the usage limits run out.
          </Note>
        </div>
      </SectionCard>

      <FormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        size="lg"
        title={editing ? `Edit ${editing.code}` : "New coupon"}
        description="Codes are stored in uppercase and matched exactly at checkout."
        submitLabel={editing ? "Save coupon" : "Create coupon"}
        pending={save.isPending}
        onSubmit={submit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Code"
            htmlFor="coupon-code"
            required
            hint="3–30 letters, numbers, dashes or underscores."
          >
            <Input
              id="coupon-code"
              value={form.code}
              onChange={(event) =>
                setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))
              }
              placeholder="WELCOME10"
              className="rounded-xl font-mono uppercase"
            />
          </Field>
          <Field label="Discount type" htmlFor="coupon-type" required>
            <select
              id="coupon-type"
              className={SELECT_CLASS}
              value={form.discountType}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  discountType: event.target.value as DiscountType,
                }))
              }
            >
              <option value="Percentage">Percentage off</option>
              <option value="Fixed">Fixed amount off</option>
              <option value="Free Shipping">Free shipping</option>
            </select>
          </Field>
        </div>

        <Field
          label="Description"
          htmlFor="coupon-description"
          hint="Shown to customers when the code is applied."
        >
          <Textarea
            id="coupon-description"
            rows={2}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="10% off your order (max AED 50)"
            className="rounded-xl"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          {form.discountType !== "Free Shipping" && (
            <Field
              label={form.discountType === "Percentage" ? "Percentage off" : "Amount off (AED)"}
              htmlFor="coupon-value"
              required
            >
              <Input
                id="coupon-value"
                type="number"
                min={form.discountType === "Percentage" ? 1 : 0}
                max={form.discountType === "Percentage" ? 100 : undefined}
                step="0.01"
                value={form.discountValue}
                onChange={(event) =>
                  setForm((current) => ({ ...current, discountValue: event.target.value }))
                }
                className="rounded-xl"
              />
            </Field>
          )}
          {form.discountType === "Percentage" && (
            <Field label="Max discount (AED)" htmlFor="coupon-max" hint="Blank means no cap.">
              <Input
                id="coupon-max"
                type="number"
                min={0}
                step="0.01"
                value={form.maxDiscount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, maxDiscount: event.target.value }))
                }
                className="rounded-xl"
              />
            </Field>
          )}
          <Field
            label="Minimum order (AED)"
            htmlFor="coupon-min"
            hint="0 means any order qualifies."
          >
            <Input
              id="coupon-min"
              type="number"
              min={0}
              step="0.01"
              value={form.minOrderValue}
              onChange={(event) =>
                setForm((current) => ({ ...current, minOrderValue: event.target.value }))
              }
              className="rounded-xl"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" htmlFor="coupon-start" required>
            <Input
              id="coupon-start"
              type="datetime-local"
              value={form.startDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, startDate: event.target.value }))
              }
              className="rounded-xl"
            />
          </Field>
          <Field label="Ends" htmlFor="coupon-end" required>
            <Input
              id="coupon-end"
              type="datetime-local"
              value={form.endDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, endDate: event.target.value }))
              }
              className="rounded-xl"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Total redemptions" htmlFor="coupon-limit" hint="Blank means unlimited.">
            <Input
              id="coupon-limit"
              type="number"
              min={0}
              value={form.usageLimit}
              onChange={(event) =>
                setForm((current) => ({ ...current, usageLimit: event.target.value }))
              }
              className="rounded-xl"
            />
          </Field>
          <Field label="Uses per customer" htmlFor="coupon-per-user" required>
            <Input
              id="coupon-per-user"
              type="number"
              min={1}
              value={form.limitPerUser}
              onChange={(event) =>
                setForm((current) => ({ ...current, limitPerUser: event.target.value }))
              }
              className="rounded-xl"
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-3 py-2.5">
          <div>
            <Label htmlFor="coupon-active" className="text-xs font-bold">
              Active
            </Label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Turn this off to disable the code without deleting it.
            </p>
          </div>
          <Switch
            id="coupon-active"
            checked={form.isActive}
            onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-bold">Excluded categories</Label>
          <p className="text-[11px] text-muted-foreground">
            Items in these categories don't count towards the discount.
          </p>
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
            {categories.length === 0 ? (
              <p className="px-1 py-2 text-[11px] text-muted-foreground">
                No categories available.
              </p>
            ) : (
              categories.map((category) => {
                const id = `coupon-cat-${category._id}`;
                return (
                  <label
                    key={category._id}
                    htmlFor={id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs hover:bg-accent"
                  >
                    <Checkbox
                      id={id}
                      checked={form.excludedCategories.includes(category._id)}
                      onCheckedChange={() => toggleCategory(category._id)}
                    />
                    <span className="min-w-0 truncate">{category.name}</span>
                  </label>
                );
              })
            )}
          </div>
          {form.excludedCategories.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Excluding:{" "}
              {form.excludedCategories.map((id) => categoryName.get(id) ?? id).join(", ")}
            </p>
          )}
        </div>

        <Field
          label="Excluded brands"
          htmlFor="coupon-brands"
          hint="Comma-separated, matched exactly against the product brand."
        >
          <Input
            id="coupon-brands"
            value={form.excludedBrands}
            onChange={(event) =>
              setForm((current) => ({ ...current, excludedBrands: event.target.value }))
            }
            placeholder="Apple, Dyson"
            className="rounded-xl"
          />
        </Field>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
          <span>
            <span className="block text-sm font-semibold">Exclude clearance items</span>
            <span className="block text-[11px] text-muted-foreground">
              Products marked as clearance in Products don&apos;t count towards this coupon.
            </span>
          </span>
          <Switch
            checked={form.excludeClearance}
            onCheckedChange={(checked) =>
              setForm((current) => ({ ...current, excludeClearance: checked }))
            }
          />
        </label>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this coupon?"
        confirmLabel="Delete coupon"
        pending={remove.isPending}
        description={
          <>
            <p>
              <strong className="text-foreground font-mono">{deleteTarget?.code}</strong> stops
              working the moment it's deleted, and anyone with the code will see it as invalid at
              checkout.
            </p>
            <p>To pause it instead, edit the coupon and switch it to inactive.</p>
          </>
        }
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget._id)}
      />
    </div>
  );
}
