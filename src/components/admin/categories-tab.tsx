import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CornerDownRight,
  FolderTree,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SectionCard, TableScroll } from "@/components/dashboard/dashboard-shell";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { ApiError, api, errorMessage } from "@/lib/api";
import type { Category } from "@/lib/types";
import { ForbiddenState, TableSkeleton, Thumb } from "@/components/admin/ops-common";
import { isForbidden, opsRetry, selectClass, useOpsInvalidate } from "@/components/admin/ops-utils";
import { cn } from "@/lib/utils";
import {
  MAX_CATEGORY_DEPTH,
  buildCategoryTree,
  flattenDescendants,
  type CategoryNode,
} from "@/hooks/use-categories";

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

interface FormState {
  _id?: string | undefined;
  name: string;
  slug: string;
  slugTouched: boolean;
  parentCategory: string;
  description: string;
  image: string;
  commissionRate: string;
  /** New categories copy their parent's rate until the admin types one. */
  rateTouched: boolean;
  sortOrder: string;
  isActive: boolean;
}

const emptyForm = (parent?: Category): FormState => ({
  name: "",
  slug: "",
  slugTouched: false,
  parentCategory: parent?._id ?? "",
  description: "",
  image: "",
  commissionRate: String(parent?.commissionRate ?? 10),
  rateTouched: false,
  sortOrder: "0",
  isActive: true,
});

const toForm = (category: Category): FormState => ({
  _id: category._id,
  name: category.name,
  slug: category.slug,
  slugTouched: true,
  parentCategory: category.parentCategory ?? "",
  description: category.description ?? "",
  image: category.image ?? "",
  commissionRate: String(category.commissionRate ?? 0),
  rateTouched: true,
  sortOrder: String(category.sortOrder ?? 0),
  isActive: category.isActive,
});

export function CategoriesTab() {
  const invalidate = useOpsInvalidate();
  const [form, setForm] = useState<FormState | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-categories"],
    queryFn: () =>
      api<{ categories: Category[] }>("/admin/categories").then((response) => response.categories),
    retry: opsRetry,
  });

  const categories = useMemo(() => query.data ?? [], [query.data]);
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  // Every category with its level (1 = top level), in tree order.
  const ordered = useMemo(
    () =>
      tree.flatMap((root) => [
        { category: root, depth: 1 },
        ...flattenDescendants(root).map((entry) => ({ ...entry, depth: entry.depth + 1 })),
      ]),
    [tree],
  );

  const save = useMutation({
    mutationFn: (state: FormState) => {
      const body = {
        name: state.name.trim(),
        slug: slugify(state.slug || state.name),
        parentCategory: state.parentCategory || null,
        description: state.description.trim(),
        image: state.image.trim(),
        commissionRate: Number(state.commissionRate) || 0,
        sortOrder: Number(state.sortOrder) || 0,
        isActive: state.isActive,
      };
      return state._id
        ? api<{ message: string }>(`/admin/categories/${state._id}`, { method: "PUT", body })
        : api<{ message: string }>("/admin/categories", { method: "POST", body });
    },
    onSuccess: (response) => {
      toast.success(response.message);
      setForm(null);
      invalidate("admin-categories", "categories", "admin-products");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api<{ message: string }>(`/admin/categories/${id}`, { method: "DELETE" }),
    onSuccess: (response) => {
      toast.success(response.message);
      setDeleting(null);
      setDeleteError(null);
      invalidate("admin-categories", "categories");
    },
    onError: (error) => {
      // 409 = still has products or subcategories; keep the dialog open and explain.
      if (error instanceof ApiError && error.status === 409) setDeleteError(error.message);
      else toast.error(errorMessage(error));
    },
  });

  if (isForbidden(query.error)) return <ForbiddenState section="products" />;

  // A category can go under anything that isn't itself or below it, as long as the tree stays
  // within three levels (counting the levels it already has underneath).
  const editing = form?._id ? ordered.find((entry) => entry.category._id === form._id) : undefined;
  const below = editing ? flattenDescendants(editing.category) : [];
  const ownBranch = new Set([
    ...(editing ? [editing.category._id] : []),
    ...below.map((entry) => entry.category._id),
  ]);
  const levelsBelow = Math.max(0, ...below.map((entry) => entry.depth));
  const parentOptions = ordered.filter(
    (entry) =>
      !ownBranch.has(entry.category._id) && entry.depth + 1 + levelsBelow <= MAX_CATEGORY_DEPTH,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold">Categories</h2>
          <p className="text-xs text-muted-foreground">
            The storefront navigation and the commission rate applied to every sale in a category.
          </p>
        </div>
        <Button className="rounded-xl font-semibold" onClick={() => setForm(emptyForm())}>
          <Plus className="mr-1.5 h-4 w-4" /> New category
        </Button>
      </div>

      <SectionCard
        title={`${categories.length} categor${categories.length === 1 ? "y" : "ies"}`}
        description="Up to three levels: category → subcategory → sub-subcategory"
        bodyClassName="p-3 sm:p-4"
      >
        {query.isPending && <TableSkeleton rows={8} />}

        {query.isError && !isForbidden(query.error) && (
          <InlineError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        )}

        {query.data && categories.length === 0 && (
          <EmptyState
            icon={FolderTree}
            title="No categories yet"
            description="Create your first category to organise the catalogue."
            action={
              <Button className="rounded-xl" onClick={() => setForm(emptyForm())}>
                <Plus className="mr-1.5 h-4 w-4" /> New category
              </Button>
            }
          />
        )}

        {categories.length > 0 && (
          <TableScroll>
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                <th className="py-2 pr-3 font-bold">Category</th>
                <th className="py-2 pr-3 font-bold">URL</th>
                <th className="py-2 pr-3 text-right font-bold">Products</th>
                <th className="py-2 pr-3 text-right font-bold">Commission</th>
                <th className="py-2 pr-3 text-right font-bold">Sort</th>
                <th className="py-2 pr-3 font-bold">Visible</th>
                <th className="py-2 font-bold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tree.map((root) => (
                <CategoryRows
                  key={root._id}
                  category={root}
                  depth={1}
                  onEdit={(entry) => setForm(toForm(entry))}
                  onAddChild={(parent) => setForm(emptyForm(parent))}
                  onDelete={(entry) => {
                    setDeleteError(null);
                    setDeleting(entry);
                  }}
                />
              ))}
            </tbody>
          </TableScroll>
        )}
      </SectionCard>

      <CategoryDialog
        form={form}
        parents={parentOptions}
        busy={save.isPending}
        onChange={setForm}
        onClose={() => setForm(null)}
        onSubmit={() => form && save.mutate(form)}
      />

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The category disappears from the storefront navigation and from every filter. Products
              and subcategories must be moved somewhere else first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <div className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{deleteError}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={remove.isPending}>
              Keep category
            </AlertDialogCancel>
            <Button
              variant="destructive"
              className="rounded-xl font-semibold"
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting._id)}
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete category
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryRows({
  category,
  depth,
  onEdit,
  onAddChild,
  onDelete,
}: {
  category: CategoryNode;
  depth: number;
  onEdit: (category: Category) => void;
  onAddChild: (parent: Category) => void;
  onDelete: (category: Category) => void;
}) {
  return (
    <>
      <CategoryRow
        category={category}
        depth={depth}
        onEdit={onEdit}
        onAddChild={depth < MAX_CATEGORY_DEPTH ? onAddChild : undefined}
        onDelete={onDelete}
      />
      {category.children.map((child) => (
        <CategoryRows
          key={child._id}
          category={child}
          depth={depth + 1}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

function CategoryRow({
  category,
  depth,
  onEdit,
  onAddChild,
  onDelete,
}: {
  category: Category;
  depth: number;
  onEdit: (category: Category) => void;
  onAddChild?: ((parent: Category) => void) | undefined;
  onDelete: (category: Category) => void;
}) {
  const nested = depth > 1;
  return (
    <tr className={cn("hover:bg-accent/40", nested && "bg-muted/20")}>
      <td className="py-2.5 pr-3">
        <div
          className={cn("flex items-center gap-2", depth === 2 && "pl-6", depth >= 3 && "pl-12")}
        >
          {nested && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <Thumb src={category.image} alt="" className="h-8 w-8" />
          <span className={cn("truncate", nested ? "text-sm" : "font-semibold")}>
            {category.name}
          </span>
        </div>
      </td>
      <td className="py-2.5 pr-3 font-mono text-[11px] text-muted-foreground">/{category.slug}</td>
      <td className="py-2.5 pr-3 text-right tabular-nums">
        {category.productCount ?? 0}
        {category.activeProductCount !== undefined && (
          <span className="block text-[11px] text-muted-foreground">
            {category.activeProductCount} active
          </span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-right tabular-nums">{category.commissionRate}%</td>
      <td className="py-2.5 pr-3 text-right tabular-nums text-muted-foreground">
        {category.sortOrder}
      </td>
      <td className="py-2.5 pr-3">
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
            category.isActive ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          {category.isActive ? "Visible" : "Hidden"}
        </span>
      </td>
      <td className="py-2.5 text-right whitespace-nowrap">
        {onAddChild && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => onAddChild(category)}
            aria-label={`Add a subcategory under ${category.name}`}
            title={depth === 1 ? "Add subcategory" : "Add sub-subcategory"}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={() => onEdit(category)}
          aria-label={`Edit ${category.name}`}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(category)}
          aria-label={`Delete ${category.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

function CategoryDialog({
  form,
  parents,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  form: FormState | null;
  parents: { category: Category; depth: number }[];
  busy: boolean;
  onChange: (form: FormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [imageBroken, setImageBroken] = useState(false);

  useEffect(() => {
    setImageBroken(false);
  }, [form?.image]);

  const patch = (changes: Partial<FormState>) => {
    if (form) onChange({ ...form, ...changes });
  };

  const autoSlug = form && !form.slugTouched ? slugify(form.name) : (form?.slug ?? "");
  const valid = Boolean(form?.name.trim() && (form.slugTouched ? slugify(form.slug) : autoSlug));

  return (
    <Dialog open={Boolean(form)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{form?._id ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>
            Categories drive the storefront navigation, search filters and the commission taken from
            each sale.
          </DialogDescription>
        </DialogHeader>

        {form && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                value={form.name}
                onChange={(event) => patch({ name: event.target.value })}
                placeholder="e.g. Skincare"
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-slug">URL slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/category/</span>
                <Input
                  id="cat-slug"
                  value={form.slugTouched ? form.slug : autoSlug}
                  onChange={(event) => patch({ slug: event.target.value, slugTouched: true })}
                  placeholder="skincare"
                  className="h-10 flex-1 rounded-xl font-mono text-sm"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Filled in from the name — edit it if you need a different URL.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-parent">Parent category</Label>
              <select
                id="cat-parent"
                className={cn(selectClass, "h-10 w-full")}
                value={form.parentCategory}
                onChange={(event) => {
                  const parentCategory = event.target.value;
                  const parent = parents.find((entry) => entry.category._id === parentCategory);
                  patch({
                    parentCategory,
                    ...(!form.rateTouched && parent
                      ? { commissionRate: String(parent.category.commissionRate) }
                      : {}),
                  });
                }}
              >
                <option value="">None — this is a top-level category</option>
                {parents.map(({ category, depth }) => (
                  <option key={category._id} value={category._id}>
                    {"\u00a0\u00a0\u00a0".repeat(depth - 1)}
                    {depth > 1 ? "↳ " : ""}
                    {category.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Up to three levels. Moving a category takes its subcategories and products with it.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-description">Description</Label>
              <Textarea
                id="cat-description"
                value={form.description}
                onChange={(event) => patch({ description: event.target.value })}
                placeholder="Shown on the category page under the title."
                className="min-h-[76px] rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-image">Tile image URL</Label>
              <Input
                id="cat-image"
                value={form.image}
                onChange={(event) => patch({ image: event.target.value })}
                placeholder="https://images.example.com/skincare.jpg"
                className="h-10 rounded-xl"
              />
              {form.image ? (
                imageBroken ? (
                  <p className="text-[11px] text-destructive">That image URL couldn't be loaded.</p>
                ) : (
                  <img
                    src={form.image}
                    alt=""
                    onError={() => setImageBroken(true)}
                    className="h-24 w-full rounded-xl border border-border object-cover"
                  />
                )
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Leave empty to use the bundled artwork for this slug.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cat-commission">Commission rate (%)</Label>
                <Input
                  id="cat-commission"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={form.commissionRate}
                  onChange={(event) =>
                    patch({ commissionRate: event.target.value, rateTouched: true })
                  }
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-sort">Sort order</Label>
                <Input
                  id="cat-sort"
                  type="number"
                  step="1"
                  value={form.sortOrder}
                  onChange={(event) => patch({ sortOrder: event.target.value })}
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <span className="text-sm">
                <span className="block font-semibold">Visible on the storefront</span>
                <span className="block text-xs text-muted-foreground">
                  Hidden categories keep their products but disappear from navigation.
                </span>
              </span>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => patch({ isActive: checked })}
              />
            </label>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" className="rounded-xl" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button className="rounded-xl font-semibold" disabled={busy || !valid} onClick={onSubmit}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {form?._id ? "Save category" : "Create category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
