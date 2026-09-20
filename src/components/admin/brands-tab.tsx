import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, RefreshCw, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/dashboard/dashboard-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { ImageUploader } from "@/components/common/image-uploader";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage } from "@/lib/api";
import {
  ConfirmDialog,
  DataTable,
  Field,
  FilterChips,
  FormDialog,
  Note,
  SearchField,
  TabState,
  adminRetry,
} from "@/components/admin/people-shared";

interface AdminBrand {
  _id: string;
  name: string;
  slug: string;
  logo?: string | undefined;
  description?: string | undefined;
  isActive: boolean;
  productCount: number;
  activeProductCount: number;
}

interface BrandForm {
  name: string;
  logo: string;
  description: string;
  isActive: boolean;
}

const BLANK: BrandForm = { name: "", logo: "", description: "", isActive: true };

const STATUS_CHIPS = [
  { value: "", label: "All brands" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

function BrandMark({ brand }: { brand: Pick<AdminBrand, "name" | "logo"> }) {
  return brand.logo ? (
    <img
      src={brand.logo}
      alt=""
      className="h-9 w-9 shrink-0 rounded-lg border border-border bg-white object-contain p-1"
    />
  ) : (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted text-xs font-bold">
      {brand.name.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** Master directory of brands that sellers can list products under. */
export function BrandsTab() {
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("");
  const search = useDebounce(term, 300);
  const [editing, setEditing] = useState<AdminBrand | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<BrandForm>(BLANK);
  const [deleteTarget, setDeleteTarget] = useState<AdminBrand | null>(null);

  const query = useQuery({
    queryKey: ["admin-brands", search, status],
    queryFn: () =>
      api<{ brands: AdminBrand[] }>("/admin/brands", { query: { q: search, status } }).then(
        (response) => response.brands,
      ),
    retry: adminRetry,
  });

  function refresh() {
    for (const key of ["admin-brands", "brand-directory", "admin-products", "products"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  }

  const save = useMutation({
    mutationFn: (input: { id?: string; body: BrandForm }) =>
      api<{ message: string }>(input.id ? `/admin/brands/${input.id}` : "/admin/brands", {
        method: input.id ? "PUT" : "POST",
        body: input.body,
      }),
    onSuccess: (response) => {
      toast.success(response.message);
      setFormOpen(false);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const toggle = useMutation({
    mutationFn: (brand: AdminBrand) =>
      api<{ message: string }>(`/admin/brands/${brand._id}`, {
        method: "PUT",
        body: { isActive: !brand.isActive },
      }),
    onSuccess: (response) => {
      toast.success(response.message);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/admin/brands/${id}`, { method: "DELETE" }),
    onSuccess: (response) => {
      toast.success(response.message);
      setDeleteTarget(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const sync = useMutation({
    mutationFn: () => api<{ message: string }>("/admin/brands/sync", { method: "POST" }),
    onSuccess: (response) => {
      toast.success(response.message);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function openForm(brand: AdminBrand | null) {
    setEditing(brand);
    setForm(
      brand
        ? {
            name: brand.name,
            logo: brand.logo ?? "",
            description: brand.description ?? "",
            isActive: brand.isActive,
          }
        : BLANK,
    );
    setFormOpen(true);
  }

  function submit() {
    if (form.name.trim().length < 2) {
      toast.error("Enter the brand name");
      return;
    }
    if (form.logo.trim() && !/^(https?:\/\/|\/)/.test(form.logo.trim())) {
      toast.error("The logo must be an upload or a link starting with https://");
      return;
    }
    save.mutate({
      ...(editing ? { id: editing._id } : {}),
      body: {
        name: form.name.trim(),
        logo: form.logo.trim(),
        description: form.description.trim(),
        isActive: form.isActive,
      },
    });
  }

  const brands = query.data ?? [];

  return (
    <div className="space-y-4">
      <SectionCard
        title="Brands"
        description="The directory of brands sellers can list under. A product's brand must come from here."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchField
              value={term}
              onChange={setTerm}
              placeholder="Brand name"
              label="Search brands"
            />
            <Button
              variant="outline"
              className="rounded-xl"
              disabled={sync.isPending}
              onClick={() => sync.mutate()}
              title="Add any brand already used by a product"
            >
              <RefreshCw className="mr-1.5 h-4 w-4" /> Import from catalog
            </Button>
            <Button className="rounded-xl" onClick={() => openForm(null)}>
              <Plus className="mr-1.5 h-4 w-4" /> Add brand
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <FilterChips options={STATUS_CHIPS} value={status} onChange={setStatus} />
          <TabState
            isLoading={query.isLoading}
            error={query.error}
            onRetry={() => void query.refetch()}
          >
            {brands.length === 0 ? (
              <EmptyState
                icon={Tags}
                title="No brands match"
                description="Add a brand, or import the ones your products already use."
              />
            ) : (
              <DataTable
                rows={brands}
                rowKey={(row) => row._id}
                onRowClick={(row) => openForm(row)}
                columns={[
                  {
                    key: "name",
                    header: "Brand",
                    cell: (row) => (
                      <div className="flex min-w-0 items-center gap-3">
                        <BrandMark brand={row} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{row.name}</p>
                          {row.description && (
                            <p className="max-w-[320px] truncate text-xs text-muted-foreground">
                              {row.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "products",
                    header: "Products",
                    className: "text-right tabular-nums",
                    cell: (row) => (
                      <span>
                        {row.productCount}
                        <span className="ml-1 text-[11px] text-muted-foreground">
                          ({row.activeProductCount} live)
                        </span>
                      </span>
                    ),
                  },
                  {
                    key: "status",
                    header: "Status",
                    cell: (row) => <StatusBadge status={row.isActive ? "Active" : "Inactive"} />,
                  },
                  {
                    key: "actions",
                    header: <span className="sr-only">Actions</span>,
                    className: "text-right",
                    cell: (row) => (
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <Switch
                          checked={row.isActive}
                          disabled={toggle.isPending}
                          onCheckedChange={() => toggle.mutate(row)}
                          aria-label={`${row.isActive ? "Deactivate" : "Activate"} ${row.name}`}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => openForm(row)}
                          aria-label={`Edit ${row.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg text-destructive hover:text-destructive"
                          disabled={row.productCount > 0}
                          title={
                            row.productCount > 0
                              ? "Brands used by products can be switched off, not deleted"
                              : undefined
                          }
                          onClick={() => setDeleteTarget(row)}
                          aria-label={`Delete ${row.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ),
                  },
                ]}
                card={(row) => (
                  <div className="flex items-center gap-3">
                    <BrandMark brand={row} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.productCount} product{row.productCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <StatusBadge status={row.isActive ? "Active" : "Inactive"} />
                  </div>
                )}
              />
            )}
          </TabState>
          <Note>
            Inactive brands can&apos;t be chosen for new or edited listings; products already listed
            under them stay on sale. Renaming a brand updates every product and coupon that uses it.
          </Note>
        </div>
      </SectionCard>

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? `Edit ${editing.name}` : "Add a brand"}
        submitLabel={editing ? "Save brand" : "Add brand"}
        pending={save.isPending}
        onSubmit={submit}
      >
        <Field label="Brand name" htmlFor="brand-name" required>
          <Input
            id="brand-name"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="rounded-xl"
          />
        </Field>
        <Field label="Logo" htmlFor="brand-logo" hint="Upload an image or paste a link.">
          <div className="flex items-center gap-3">
            <BrandMark brand={{ name: form.name || "?", logo: form.logo || undefined }} />
            <Input
              id="brand-logo"
              value={form.logo}
              placeholder="https://…"
              onChange={(event) => setForm({ ...form, logo: event.target.value })}
              className="rounded-xl"
            />
          </div>
          <ImageUploader onUploaded={(url) => setForm((current) => ({ ...current, logo: url }))} />
        </Field>
        <Field label="Description" htmlFor="brand-description">
          <Textarea
            id="brand-description"
            rows={3}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            className="rounded-xl"
          />
        </Field>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
          <span>
            <span className="block text-sm font-semibold">Available for listings</span>
            <span className="block text-[11px] text-muted-foreground">
              Sellers can pick this brand for new and edited products.
            </span>
          </span>
          <Switch
            checked={form.isActive}
            onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
          />
        </label>
      </FormDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.name ?? "this brand"}?`}
        confirmLabel="Delete brand"
        pending={remove.isPending}
        description={<p>It&apos;s removed from the directory. No products use it.</p>}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget._id)}
      />
    </div>
  );
}
