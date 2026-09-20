import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Ban,
  Box,
  CheckCircle2,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Tag,
  Timer,
  TrendingUp,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SectionCard, TableScroll } from "@/components/dashboard/dashboard-shell";
import { StatusBadge } from "@/components/common/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { PaginationBar } from "@/components/common/pagination-bar";
import { ProductEditor } from "@/components/catalog/product-editor";
import { flattenDescendants, useCategories } from "@/hooks/use-categories";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { Paginated, Product, ProductStatus, User } from "@/lib/types";
import {
  FilterChips,
  FilterField,
  FilterRow,
  ForbiddenState,
  SearchInput,
  TableSkeleton,
  Thumb,
  type ChipOption,
} from "@/components/admin/ops-common";
import {
  isForbidden,
  opsRetry,
  selectClass,
  useAdminSearch,
  useOpsInvalidate,
} from "@/components/admin/ops-utils";
import { ProductPreviewPanel } from "@/components/admin/ops-product-preview";
import { cn } from "@/lib/utils";
import { fromLocalInput, toLocalInput } from "@/components/admin/people-shared";

type FlagKey = "isFeatured" | "isBestSeller" | "isNewArrival" | "isClearance";

interface FlagBody {
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  isClearance?: boolean;
  isFlashDeal?: boolean;
  flashDealStartsAt?: string | null;
  flashDealEndsAt?: string | null;
  flashDealStock?: number | null;
}

/** Where a flash deal stands right now, for the merchandising column. */
function flashState(
  product: Pick<
    Product,
    "isFlashDeal" | "flashDealStartsAt" | "flashDealEndsAt" | "flashDealStock" | "flashDealSold"
  >,
): string | null {
  if (!product.isFlashDeal) return null;
  const now = Date.now();
  if (product.flashDealStartsAt && new Date(product.flashDealStartsAt).getTime() > now)
    return "Flash · scheduled";
  if (product.flashDealEndsAt && new Date(product.flashDealEndsAt).getTime() <= now)
    return "Flash · ended";
  if (product.flashDealStock) {
    const sold = product.flashDealSold ?? 0;
    return sold >= product.flashDealStock
      ? "Flash · sold out"
      : `Flash · ${sold}/${product.flashDealStock} claimed`;
  }
  return "Flash · live";
}

const STATUSES: ProductStatus[] = ["Pending Approval", "Active", "Draft", "Rejected", "Suspended"];

interface AdminProductVendor {
  _id: string;
  name: string;
  email?: string | undefined;
  role?: string | undefined;
  vendorDetails?: { businessName?: string | undefined } | undefined;
}

interface AdminProduct extends Omit<Product, "vendor"> {
  vendor: AdminProductVendor | string | null;
}

interface ProductsResponse extends Paginated {
  products: AdminProduct[];
  statusCounts: Record<string, number>;
}

type ModerationIntent = "Rejected" | "Suspended";

const sellerOf = (product: AdminProduct): string =>
  typeof product.vendor === "object" && product.vendor
    ? product.vendor.vendorDetails?.businessName || product.vendor.name
    : "Smart Deal";

const categoryOf = (product: AdminProduct): string =>
  product.category && typeof product.category === "object" ? product.category.name : "—";

/** ProductEditor expects the storefront vendor shape, so narrow the admin one. */
function toEditable(product: AdminProduct): Product {
  const vendor =
    typeof product.vendor === "object" && product.vendor
      ? { _id: product.vendor._id, name: product.vendor.name }
      : product.vendor;
  return { ...product, vendor } as Product;
}

export function ProductsTab() {
  const search = useAdminSearch();
  const invalidate = useOpsInvalidate();
  const { tree } = useCategories();

  const initialStatus = STATUSES.includes(search.status as ProductStatus)
    ? (search.status as string)
    : "";

  const [status, setStatus] = useState(initialStatus);
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("");
  const [vendor, setVendor] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<{ product: AdminProduct | null } | null>(null);
  const [preview, setPreview] = useState<AdminProduct | null>(null);
  const [moderating, setModerating] = useState<{
    product: AdminProduct;
    intent: ModerationIntent;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [flashFor, setFlashFor] = useState<AdminProduct | null>(null);
  const [flashStartsAt, setFlashStartsAt] = useState("");
  const [flashEndsAt, setFlashEndsAt] = useState("");
  const [flashStock, setFlashStock] = useState("");
  const [deleting, setDeleting] = useState<AdminProduct | null>(null);

  const q = useDebounce(term, 350);

  const query = useQuery({
    queryKey: ["admin-products", { status, q, category, vendor, lowStock, page }],
    queryFn: () =>
      api<ProductsResponse>("/admin/products", {
        query: { status, q, category, vendor, lowStock: lowStock ? "true" : "", page, limit: 20 },
      }),
    placeholderData: keepPreviousData,
    retry: opsRetry,
  });

  /** Optional: only super admins / staff with the vendors permission can list sellers. */
  const sellers = useQuery({
    queryKey: ["admin-vendor-options"],
    queryFn: () =>
      api<{ users: User[] }>("/admin/vendors", { query: { limit: 100, vendorStatus: "Active" } }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const moderate = useMutation({
    mutationFn: ({
      id,
      next,
      rejectionReason,
    }: {
      id: string;
      next: ProductStatus;
      rejectionReason?: string;
    }) =>
      api<{ message: string }>(`/admin/products/${id}/moderate`, {
        method: "PUT",
        body: { status: next, ...(rejectionReason ? { rejectionReason } : {}) },
      }),
    onSuccess: (response) => {
      toast.success(response.message);
      setModerating(null);
      setReason("");
      setPreview(null);
      invalidate("admin-products", "admin-dashboard");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const flags = useMutation({
    mutationFn: ({ id, body }: { id: string; body: FlagBody }) =>
      api<{ message: string }>(`/admin/products/${id}/flags`, { method: "PUT", body }),
    onSuccess: (response) => {
      toast.success(response.message);
      setFlashFor(null);
      invalidate("admin-products", "home");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api<{ message: string }>(`/products/${id}`, { method: "DELETE" }),
    onSuccess: (response) => {
      toast.success(response.message || "Product deleted");
      setDeleting(null);
      invalidate("admin-products", "admin-dashboard");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function toggleFlag(product: AdminProduct, key: FlagKey) {
    flags.mutate({ id: product._id, body: { [key]: !product[key] } });
  }

  function openFlashDeal(product: AdminProduct) {
    setFlashStartsAt(toLocalInput(product.isFlashDeal ? product.flashDealStartsAt : null));
    setFlashEndsAt(toLocalInput(product.isFlashDeal ? product.flashDealEndsAt : null));
    setFlashStock(
      product.isFlashDeal && product.flashDealStock ? String(product.flashDealStock) : "",
    );
    setFlashFor(product);
  }

  function endFlashDeal(product: AdminProduct) {
    flags.mutate({ id: product._id, body: { isFlashDeal: false } });
  }

  function saveFlashDeal() {
    if (!flashFor) return;
    const stock = flashStock.trim() ? Number(flashStock) : null;
    if (stock !== null && (!Number.isInteger(stock) || stock < 1)) {
      toast.error("The deal stock limit must be a whole number of 1 or more");
      return;
    }
    flags.mutate({
      id: flashFor._id,
      body: {
        isFlashDeal: true,
        flashDealStartsAt: fromLocalInput(flashStartsAt),
        flashDealEndsAt: fromLocalInput(flashEndsAt),
        flashDealStock: stock,
      },
    });
  }

  const counts = useMemo(() => query.data?.statusCounts ?? {}, [query.data]);
  const total = useMemo(
    () => Object.values(counts).reduce((sum, value) => sum + value, 0),
    [counts],
  );

  const chips: ChipOption[] = [
    { value: "", label: "All", count: total },
    ...STATUSES.filter((entry) => counts[entry]).map((entry) => ({
      value: entry as string,
      label: entry as string,
      count: counts[entry],
    })),
  ];

  const filtersDirty = Boolean(status || term || category || vendor || lowStock);

  function update<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  function resetFilters() {
    setStatus("");
    setTerm("");
    setCategory("");
    setVendor("");
    setLowStock(false);
    setPage(1);
  }

  /* ---------- editor ---------- */
  if (editing) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            className="rounded-xl font-semibold"
            onClick={() => setEditing(null)}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to products
          </Button>
          <h2 className="font-display text-lg font-bold">
            {editing.product ? `Editing “${editing.product.title}”` : "New product"}
          </h2>
        </div>
        <ProductEditor
          product={editing.product ? toEditable(editing.product) : null}
          mode="admin"
          onSaved={() => {
            setEditing(null);
            invalidate("admin-products", "admin-dashboard");
          }}
          onCancel={() => setEditing(null)}
        />
      </div>
    );
  }

  if (isForbidden(query.error)) return <ForbiddenState section="products" />;

  const products = query.data?.products ?? [];

  const moderationActions = (product: AdminProduct) => (
    <>
      {product.status !== "Active" && (
        <Button
          size="sm"
          className="rounded-xl font-semibold"
          disabled={moderate.isPending}
          onClick={() => moderate.mutate({ id: product._id, next: "Active" })}
        >
          {moderate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <CheckCircle2 className="mr-1.5 h-4 w-4" /> Approve
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        className="rounded-xl font-semibold"
        onClick={() => {
          setReason(product.rejectionReason ?? "");
          setModerating({ product, intent: "Rejected" });
        }}
      >
        <XCircle className="mr-1.5 h-4 w-4" /> Reject
      </Button>
      {product.status === "Active" && (
        <Button
          size="sm"
          variant="ghost"
          className="rounded-xl font-semibold text-destructive hover:text-destructive"
          onClick={() => {
            setReason("");
            setModerating({ product, intent: "Suspended" });
          }}
        >
          <Ban className="mr-1.5 h-4 w-4" /> Suspend
        </Button>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold">Products</h2>
            <p className="text-xs text-muted-foreground">
              Moderate the catalogue, merchandise the storefront and fix listings on a seller's
              behalf.
            </p>
          </div>
          <Button
            className="rounded-xl font-semibold"
            onClick={() => setEditing({ product: null })}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Create product
          </Button>
        </div>

        <FilterChips
          options={chips}
          value={status}
          onChange={update(setStatus)}
          ariaLabel="Filter by product status"
        />

        <FilterRow>
          <SearchInput
            value={term}
            onChange={update(setTerm)}
            placeholder="Title, brand, tag or SKU"
            label="Search products"
          />
          <FilterField label="Category">
            <select
              aria-label="Category"
              className={selectClass}
              value={category}
              onChange={(event) => update(setCategory)(event.target.value)}
            >
              <option value="">All categories</option>
              {tree.map((parent) => (
                <optgroup key={parent._id} label={parent.name}>
                  <option value={parent.slug}>All {parent.name}</option>
                  {flattenDescendants(parent).map(({ category: child, depth }) => (
                    <option key={child._id} value={child.slug}>
                      {"\u00a0\u00a0\u00a0".repeat(depth - 1)}
                      {depth > 1 ? "↳ " : ""}
                      {child.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </FilterField>
          {sellers.data && sellers.data.users.length > 0 && (
            <FilterField label="Seller">
              <select
                aria-label="Seller"
                className={selectClass}
                value={vendor}
                onChange={(event) => update(setVendor)(event.target.value)}
              >
                <option value="">All sellers</option>
                {sellers.data.users.map((seller) => (
                  <option key={seller._id} value={seller._id}>
                    {seller.vendorDetails?.businessName || seller.name}
                  </option>
                ))}
              </select>
            </FilterField>
          )}
          <button
            type="button"
            onClick={() => update(setLowStock)(!lowStock)}
            aria-pressed={lowStock}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
              lowStock
                ? "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Timer className="h-4 w-4" /> Low stock
          </button>
          {filtersDirty && (
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={resetFilters}>
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          )}
        </FilterRow>
      </div>

      <SectionCard
        title={
          query.data
            ? `${query.data.total} product${query.data.total === 1 ? "" : "s"}`
            : "Products"
        }
        description={filtersDirty ? "Filtered view" : "Most recently updated first"}
        bodyClassName="p-3 sm:p-4"
      >
        {query.isPending && <TableSkeleton rows={8} />}

        {query.isError && !isForbidden(query.error) && (
          <InlineError message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        )}

        {query.data && products.length === 0 && (
          <EmptyState
            icon={Box}
            title="No products match these filters"
            description="Try another status, category or search term."
            action={
              filtersDirty ? (
                <Button variant="outline" className="rounded-xl" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}

        {products.length > 0 && (
          <>
            <TableScroll className="hidden md:block">
              <thead>
                <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
                  <th className="py-2 pr-3 font-bold">Product</th>
                  <th className="py-2 pr-3 font-bold">Seller</th>
                  <th className="py-2 pr-3 font-bold">Category</th>
                  <th className="py-2 pr-3 text-right font-bold">Price</th>
                  <th className="py-2 pr-3 text-right font-bold">Stock</th>
                  <th className="py-2 pr-3 font-bold">Status</th>
                  <th className="py-2 pr-3 font-bold">Merchandising</th>
                  <th className="py-2 font-bold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => (
                  <tr key={product._id} className="align-top hover:bg-accent/40">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-start gap-2">
                        <Thumb src={product.thumbnail} alt="" className="h-10 w-10" />
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => setPreview(product)}
                            className="block max-w-[240px] truncate text-left font-medium hover:underline"
                          >
                            {product.title}
                          </button>
                          <span className="block text-[11px] text-muted-foreground">
                            {product.brand}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 max-w-[160px] truncate text-xs">
                      {sellerOf(product)}
                    </td>
                    <td className="py-2.5 pr-3 text-xs">{categoryOf(product)}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">
                      {formatPrice(product.price)}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">
                      <span
                        className={cn(product.totalStock === 0 && "font-semibold text-destructive")}
                      >
                        {product.totalStock}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <StatusBadge status={product.status} />
                      {product.rejectionReason && (
                        <span
                          className="mt-0.5 block max-w-[160px] truncate text-[11px] text-destructive"
                          title={product.rejectionReason}
                        >
                          {product.rejectionReason}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex flex-wrap gap-1">
                        {product.isFeatured && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                            <Star className="h-3 w-3" /> Featured
                          </span>
                        )}
                        {product.isFlashDeal && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                            <Sparkles className="h-3 w-3" /> {flashState(product)}
                          </span>
                        )}
                        {product.isBestSeller && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-semibold text-success">
                            <TrendingUp className="h-3 w-3" /> Best seller
                          </span>
                        )}
                        {product.isNewArrival && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                            <Timer className="h-3 w-3" /> New arrival
                          </span>
                        )}
                        {product.isClearance && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold">
                            <Tag className="h-3 w-3" /> Clearance
                          </span>
                        )}
                        {!product.isFeatured &&
                          !product.isFlashDeal &&
                          !product.isBestSeller &&
                          !product.isNewArrival &&
                          !product.isClearance && (
                            <span className="text-[11px] text-muted-foreground">—</span>
                          )}
                      </div>
                    </td>
                    <td className="py-2.5 text-right">
                      <RowActions
                        product={product}
                        onPreview={() => setPreview(product)}
                        onEdit={() => setEditing({ product })}
                        onApprove={() => moderate.mutate({ id: product._id, next: "Active" })}
                        onReject={() => {
                          setReason(product.rejectionReason ?? "");
                          setModerating({ product, intent: "Rejected" });
                        }}
                        onSuspend={() => {
                          setReason("");
                          setModerating({ product, intent: "Suspended" });
                        }}
                        onFlag={(key) => toggleFlag(product, key)}
                        onFlashDeal={() => openFlashDeal(product)}
                        onEndFlash={() => endFlashDeal(product)}
                        onDelete={() => setDeleting(product)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </TableScroll>

            {/* Mobile cards */}
            <ul className="space-y-2 md:hidden">
              {products.map((product) => (
                <li key={product._id} className="rounded-xl border border-border p-3">
                  <div className="flex gap-3">
                    <Thumb src={product.thumbnail} alt="" className="h-14 w-14" />
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setPreview(product)}
                        className="block truncate text-left text-sm font-semibold"
                      >
                        {product.title}
                      </button>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {sellerOf(product)} · {categoryOf(product)}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <StatusBadge status={product.status} />
                        <span className="text-xs font-semibold tabular-nums">
                          {formatPrice(product.price)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {product.totalStock} in stock
                        </span>
                      </div>
                    </div>
                    <RowActions
                      product={product}
                      onPreview={() => setPreview(product)}
                      onEdit={() => setEditing({ product })}
                      onApprove={() => moderate.mutate({ id: product._id, next: "Active" })}
                      onReject={() => {
                        setReason(product.rejectionReason ?? "");
                        setModerating({ product, intent: "Rejected" });
                      }}
                      onSuspend={() => {
                        setReason("");
                        setModerating({ product, intent: "Suspended" });
                      }}
                      onFlag={(key) => toggleFlag(product, key)}
                      onFlashDeal={() => openFlashDeal(product)}
                      onEndFlash={() => endFlashDeal(product)}
                      onDelete={() => setDeleting(product)}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <PaginationBar
              page={query.data?.page ?? page}
              pages={query.data?.pages ?? 1}
              onChange={setPage}
              className="mt-4"
            />
          </>
        )}
      </SectionCard>

      <ProductPreviewPanel
        product={preview ? toEditable(preview) : null}
        vendorName={preview ? sellerOf(preview) : undefined}
        categoryName={preview ? categoryOf(preview) : undefined}
        onClose={() => setPreview(null)}
        actions={
          preview ? (
            <>
              {moderationActions(preview)}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto rounded-xl font-semibold"
                onClick={() => setEditing({ product: preview })}
              >
                <Pencil className="mr-1.5 h-4 w-4" /> Edit
              </Button>
            </>
          ) : undefined
        }
      />

      {/* Reject / suspend */}
      <Dialog open={Boolean(moderating)} onOpenChange={(open) => !open && setModerating(null)}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {moderating?.intent === "Suspended" ? "Suspend this product" : "Reject this product"}
            </DialogTitle>
            <DialogDescription>
              {moderating?.intent === "Suspended"
                ? `“${moderating.product.title}” is taken off the storefront immediately and the seller can't edit it until it is reinstated.`
                : `“${moderating?.product.title}” stays off the storefront. The seller is notified with your reason so they can fix and resubmit it.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="moderate-reason">Reason (sent to the seller)</Label>
            <Textarea
              id="moderate-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. The images show a different product, and the ingredient list is missing."
              className="min-h-[96px] rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => setModerating(null)}
              disabled={moderate.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl font-semibold"
              disabled={moderate.isPending || !reason.trim()}
              onClick={() => {
                if (moderating) {
                  moderate.mutate({
                    id: moderating.product._id,
                    next: moderating.intent,
                    rejectionReason: reason.trim(),
                  });
                }
              }}
            >
              {moderate.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {moderating?.intent === "Suspended" ? "Suspend product" : "Reject product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flash deal */}
      <Dialog open={Boolean(flashFor)} onOpenChange={(open) => !open && setFlashFor(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {flashFor?.isFlashDeal ? "Edit flash deal" : "Start a flash deal"}
            </DialogTitle>
            <DialogDescription>
              “{flashFor?.title}” shows in the flash deal rail with a countdown while the deal runs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="flash-starts">Starts at</Label>
              <Input
                id="flash-starts"
                type="datetime-local"
                value={flashStartsAt}
                onChange={(event) => setFlashStartsAt(event.target.value)}
                className="h-10 rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">Empty starts it straight away.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="flash-ends">Ends at</Label>
              <Input
                id="flash-ends"
                type="datetime-local"
                value={flashEndsAt}
                onChange={(event) => setFlashEndsAt(event.target.value)}
                className="h-10 rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">Empty runs until you end it.</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="flash-stock">Deal stock (units)</Label>
            <Input
              id="flash-stock"
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              placeholder={`Up to ${flashFor?.totalStock ?? 0}`}
              value={flashStock}
              onChange={(event) => setFlashStock(event.target.value)}
              className="h-10 rounded-xl"
            />
            <p className="text-[11px] text-muted-foreground">
              Optional. Shoppers see how much is claimed, and the deal closes once these units sell.
              Starting or rescheduling a deal resets the count.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => setFlashFor(null)}
              disabled={flags.isPending}
            >
              Cancel
            </Button>
            <Button
              className="rounded-xl font-semibold"
              disabled={flags.isPending}
              onClick={saveFlashDeal}
            >
              {flags.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {flashFor?.isFlashDeal ? "Save flash deal" : "Start flash deal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The listing is removed from the marketplace. Existing orders keep their copy of the
              item, but customers will no longer be able to find or buy it. This can't be undone —
              suspending it instead is usually safer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={remove.isPending}>
              Keep product
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive font-semibold text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleting) remove.mutate(deleting._id);
              }}
            >
              {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RowActions({
  product,
  onPreview,
  onEdit,
  onApprove,
  onReject,
  onSuspend,
  onFlag,
  onFlashDeal,
  onEndFlash,
  onDelete,
}: {
  product: AdminProduct;
  onPreview: () => void;
  onEdit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onSuspend: () => void;
  onFlag: (key: FlagKey) => void;
  onFlashDeal: () => void;
  onEndFlash: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg"
          aria-label={`Actions for ${product.title}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
        <DropdownMenuLabel className="text-[11px] tracking-wide text-muted-foreground uppercase">
          Moderation
        </DropdownMenuLabel>
        {product.status !== "Active" && (
          <DropdownMenuItem className="cursor-pointer rounded-lg" onClick={onApprove}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="cursor-pointer rounded-lg" onClick={onReject}>
          <XCircle className="mr-2 h-4 w-4" /> Reject…
        </DropdownMenuItem>
        {product.status === "Active" && (
          <DropdownMenuItem className="cursor-pointer rounded-lg" onClick={onSuspend}>
            <Ban className="mr-2 h-4 w-4" /> Suspend…
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] tracking-wide text-muted-foreground uppercase">
          Merchandising
        </DropdownMenuLabel>
        <DropdownMenuItem
          className="cursor-pointer rounded-lg"
          onClick={() => onFlag("isFeatured")}
        >
          <Star className="mr-2 h-4 w-4" />{" "}
          {product.isFeatured ? "Remove from featured" : "Mark as featured"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer rounded-lg"
          onClick={() => onFlag("isBestSeller")}
        >
          <TrendingUp className="mr-2 h-4 w-4" />{" "}
          {product.isBestSeller ? "Unpin from best sellers" : "Pin to best sellers"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer rounded-lg"
          onClick={() => onFlag("isNewArrival")}
        >
          <Timer className="mr-2 h-4 w-4" />{" "}
          {product.isNewArrival ? "Unpin from new arrivals" : "Pin to new arrivals"}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer rounded-lg"
          onClick={() => onFlag("isClearance")}
        >
          <Tag className="mr-2 h-4 w-4" />{" "}
          {product.isClearance ? "Remove clearance" : "Mark as clearance"}
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer rounded-lg" onClick={onFlashDeal}>
          <Sparkles className="mr-2 h-4 w-4" />{" "}
          {product.isFlashDeal ? "Edit flash deal…" : "Start flash deal…"}
        </DropdownMenuItem>
        {product.isFlashDeal && (
          <DropdownMenuItem className="cursor-pointer rounded-lg" onClick={onEndFlash}>
            <X className="mr-2 h-4 w-4" /> End flash deal
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer rounded-lg" onClick={onPreview}>
          <Eye className="mr-2 h-4 w-4" /> Quick preview
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer rounded-lg" onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" /> Edit product
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer rounded-lg text-destructive focus:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
