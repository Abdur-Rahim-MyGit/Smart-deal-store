import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  Package,
  PackageSearch,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { SectionCard, TableScroll } from "@/components/dashboard/dashboard-shell";
import { ProductEditor } from "@/components/catalog/product-editor";
import { EmptyState } from "@/components/common/empty-state";
import { InlineError } from "@/components/common/page-loader";
import { PaginationBar } from "@/components/common/pagination-bar";
import { StatusBadge } from "@/components/common/status-badge";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { Product, ProductStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  FilterChip,
  ResultCount,
  SearchBox,
  TableSkeleton,
  Thumb,
} from "@/components/vendor/common";
import { StockDialog } from "@/components/vendor/stock-dialog";
import { LockedNotice, useVendorGate } from "@/components/vendor/vendor-status";
import type { VendorProductsResponse, VendorTabProps } from "@/components/vendor/types";

const STATUS_FILTERS: ProductStatus[] = [
  "Active",
  "Pending Approval",
  "Draft",
  "Rejected",
  "Suspended",
];

const categoryName = (category: Product["category"]): string =>
  category && typeof category === "object" ? category.name : "—";

function priceRange(product: Product): string {
  const prices = product.variants
    .map((variant) => variant.price)
    .filter((price) => Number.isFinite(price));
  if (!prices.length) return formatPrice(product.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`;
}

const isLowStock = (product: Product): boolean =>
  product.variants.some((variant) => variant.stock <= (variant.lowStockThreshold ?? 5));

export interface ProductsTabProps extends VendorTabProps {
  /** Pre-applies the low-stock filter when the seller arrives from the overview. */
  initialLowStock?: boolean | undefined;
}

/** Catalogue management: filter, edit, restock, publish and delete listings. */
export function ProductsTab({ initialLowStock }: ProductsTabProps) {
  const gate = useVendorGate();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<ProductStatus | "">("");
  const [search, setSearch] = useState("");
  const [lowStock, setLowStock] = useState(Boolean(initialLowStock));
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{ product: Product | null } | null>(null);
  const [stockTarget, setStockTarget] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const debouncedSearch = useDebounce(search, 350);
  const filtered = Boolean(status || debouncedSearch || lowStock);

  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["vendor-products", { status, q: debouncedSearch, lowStock, page }],
    queryFn: () =>
      api<VendorProductsResponse>("/vendors/products", {
        query: {
          status: status || undefined,
          q: debouncedSearch || undefined,
          lowStock: lowStock ? "true" : undefined,
          page,
        },
      }),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (product: Product) =>
      api<{ message: string }>(`/products/${product._id}`, { method: "DELETE" }),
    onSuccess: (response) => {
      toast.success(response.message || "Product deleted");
      setDeleteTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
      void queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
    },
    onError: (mutationError) => toast.error(errorMessage(mutationError)),
  });

  function closeEditor() {
    setEditor(null);
  }

  function onSaved() {
    void queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
    void queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
    setEditor(null);
  }

  function applyFilter(next: () => void) {
    next();
    setPage(1);
  }

  /* ---------- full-width editor panel ---------- */
  if (editor) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" className="rounded-xl font-semibold" onClick={closeEditor}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to products
          </Button>
          <h2 className="font-display text-lg font-bold">
            {editor.product ? "Edit product" : "New product"}
          </h2>
        </div>
        <ProductEditor
          mode="vendor"
          product={editor.product}
          onSaved={onSaved}
          onCancel={closeEditor}
        />
      </div>
    );
  }

  const products = data?.products ?? [];
  const counts = data?.statusCounts ?? {};
  const totalListings = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Products</h2>
          <p className="text-sm text-muted-foreground">
            {totalListings} {totalListings === 1 ? "listing" : "listings"} in your catalogue
          </p>
        </div>
        <Button
          className="rounded-xl font-semibold"
          disabled={!gate.isActive}
          title={gate.isActive ? undefined : "Approval required"}
          onClick={() => setEditor({ product: null })}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add product
        </Button>
      </div>

      {!gate.isActive && (
        <LockedNotice
          reason={`New listings can't be created yet. ${gate.lockReason ?? ""}`.trim()}
        />
      )}

      <div className="rail-scroll flex gap-2 overflow-x-auto pb-1">
        <FilterChip
          label="All"
          count={totalListings}
          active={status === ""}
          onClick={() => applyFilter(() => setStatus(""))}
        />
        {STATUS_FILTERS.map((entry) => (
          <FilterChip
            key={entry}
            label={entry}
            count={counts[entry] ?? 0}
            active={status === entry}
            onClick={() => applyFilter(() => setStatus(entry))}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchBox
          value={search}
          onChange={(value) => applyFilter(() => setSearch(value))}
          placeholder="Search title, brand or SKU"
          label="Search your products"
        />
        <FilterChip
          label="Low stock only"
          active={lowStock}
          onClick={() => applyFilter(() => setLowStock((current) => !current))}
        />
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            className="rounded-xl font-semibold text-muted-foreground"
            onClick={() =>
              applyFilter(() => {
                setStatus("");
                setSearch("");
                setLowStock(false);
              })
            }
          >
            Clear filters
          </Button>
        )}
        <div className="ml-auto">
          <ResultCount shown={products.length} total={data?.total ?? 0} noun="products" />
        </div>
      </div>

      <SectionCard>
        {isPending ? (
          <TableSkeleton rows={8} />
        ) : isError ? (
          <InlineError
            message={errorMessage(error, "We couldn't load your products.")}
            onRetry={() => void refetch()}
          />
        ) : products.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={PackageSearch}
              title="No products match these filters"
              description="Try a different status, clear the low-stock filter or search for another SKU."
              action={
                <Button
                  variant="outline"
                  className="rounded-xl font-semibold"
                  onClick={() =>
                    applyFilter(() => {
                      setStatus("");
                      setSearch("");
                      setLowStock(false);
                    })
                  }
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Package}
              title="Your catalogue is empty"
              description={
                gate.isActive
                  ? "Add your first listing with photos, variants and stock. Smart Deal reviews new products before they go live."
                  : "You'll be able to add listings as soon as Smart Deal approves your store."
              }
              action={
                <Button
                  className="rounded-xl font-semibold"
                  disabled={!gate.isActive}
                  onClick={() => setEditor({ product: null })}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Add product
                </Button>
              }
            />
          )
        ) : (
          <div className={cn("transition-opacity", isFetching && "opacity-60")}>
            <TableScroll>
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="pb-2 font-semibold">Product</th>
                  <th className="pb-2 font-semibold">Category</th>
                  <th className="pb-2 text-right font-semibold">SKUs</th>
                  <th className="pb-2 font-semibold">Price</th>
                  <th className="pb-2 text-right font-semibold">Stock</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => {
                  const low = isLowStock(product);
                  return (
                    <tr key={product._id} className="align-middle">
                      <td className="py-3 pr-3">
                        <div className="flex items-start gap-2.5">
                          <Thumb src={product.thumbnail} alt="" className="h-11 w-11" />
                          <div className="min-w-0">
                            <p className="font-semibold">{product.title}</p>
                            <p className="text-xs text-muted-foreground">{product.brand}</p>
                            {product.status === "Rejected" && product.rejectionReason && (
                              <p className="mt-1 max-w-sm text-xs font-medium text-destructive">
                                Rejected: {product.rejectionReason}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-3 text-muted-foreground">
                        {categoryName(product.category)}
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">
                        {product.variants.length}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap tabular-nums">
                        {priceRange(product)}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums",
                            low
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              : "text-foreground",
                          )}
                        >
                          {product.totalStock}
                        </span>
                        {low && (
                          <span className="block text-[11px] text-muted-foreground">Low stock</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <StatusBadge status={product.status} />
                      </td>
                      <td className="py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-xl"
                              aria-label={`Actions for ${product.title}`}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52 rounded-2xl p-1.5">
                            <DropdownMenuItem
                              className="cursor-pointer rounded-lg"
                              onClick={() => setEditor({ product })}
                            >
                              <Pencil className="mr-2 h-4 w-4" /> Edit product
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer rounded-lg"
                              onClick={() => setStockTarget(product)}
                            >
                              <SlidersHorizontal className="mr-2 h-4 w-4" /> Update stock
                            </DropdownMenuItem>
                            {product.status === "Active" && (
                              <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                                <a
                                  href={`/product/${product.slug}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" /> View on store
                                </a>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer rounded-lg text-destructive focus:text-destructive"
                              onClick={() => setDeleteTarget(product)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableScroll>
          </div>
        )}
      </SectionCard>

      <PaginationBar page={data?.page ?? 1} pages={data?.pages ?? 1} onChange={setPage} />

      {stockTarget && <StockDialog product={stockTarget} onClose={() => setStockTarget(null)} />}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => (open ? undefined : setDeleteTarget(null))}
      >
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title}” will be removed from the store, from shoppers' carts and
              wishlists, and its reviews will be deleted. Past orders keep their record. This can't
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={deleteMutation.isPending}>
              Keep product
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget);
              }}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
