import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, errorMessage } from "@/lib/api";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { variantLabel } from "@/components/vendor/common";

interface StockRow {
  sku: string;
  label: string;
  stock: string;
  lowStockThreshold: string;
  previous: number;
}

const toRows = (product: Product): StockRow[] =>
  product.variants.map((variant) => ({
    sku: variant.sku,
    label: variantLabel(variant.options, "Single option"),
    stock: String(variant.stock),
    lowStockThreshold: String(variant.lowStockThreshold ?? 5),
    previous: variant.stock,
  }));

/** Stock-only editor — these changes skip re-approval and go live immediately. */
export function StockDialog({ product, onClose }: { product: Product; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<StockRow[]>(() => toRows(product));

  const update = (sku: string, patch: Partial<StockRow>) =>
    setRows((current) => current.map((row) => (row.sku === sku ? { ...row, ...patch } : row)));

  const mutation = useMutation({
    mutationFn: (variants: Array<{ sku: string; stock: number; lowStockThreshold: number }>) =>
      api<{ message: string; product: Product }>(`/products/${product._id}/stock`, {
        method: "PATCH",
        body: { variants },
      }),
    onSuccess: (response) => {
      toast.success(response.message || "Stock updated");
      void queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
      void queryClient.invalidateQueries({ queryKey: ["vendor-dashboard"] });
      onClose();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  function submit() {
    const invalid = rows.find(
      (row) => row.stock === "" || !Number.isInteger(Number(row.stock)) || Number(row.stock) < 0,
    );
    if (invalid) {
      toast.error(`Stock for ${invalid.sku} must be a whole number`);
      return;
    }
    mutation.mutate(
      rows.map((row) => ({
        sku: row.sku,
        stock: Number(row.stock),
        lowStockThreshold: Math.max(0, Number(row.lowStockThreshold) || 0),
      })),
    );
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display">Update stock</DialogTitle>
          <DialogDescription>
            {product.title} — stock-only changes go live immediately, with no re-approval needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="hidden grid-cols-[1fr_88px_88px] gap-3 px-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase sm:grid">
            <span>Variant</span>
            <span>In stock</span>
            <span>Alert at</span>
          </div>
          {rows.map((row) => {
            const value = Number(row.stock);
            const low = Number.isFinite(value) && value <= Number(row.lowStockThreshold || 0);
            return (
              <div
                key={row.sku}
                className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_88px_88px] sm:items-center sm:gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{row.label}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{row.sku}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground sm:hidden">
                    In stock
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    aria-label={`Stock for ${row.sku}`}
                    value={row.stock}
                    onChange={(event) => update(row.sku, { stock: event.target.value })}
                    className={cn("h-9 rounded-lg tabular-nums", low && "border-amber-500/60")}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground sm:hidden">
                    Alert at
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    aria-label={`Low-stock alert for ${row.sku}`}
                    value={row.lowStockThreshold}
                    onChange={(event) => update(row.sku, { lowStockThreshold: event.target.value })}
                    className="h-9 rounded-lg tabular-nums"
                  />
                </div>
                {row.previous !== value && Number.isFinite(value) && (
                  <p className="text-[11px] text-muted-foreground sm:col-span-3">
                    Was {row.previous} ·{" "}
                    {value > row.previous
                      ? `adding ${value - row.previous}`
                      : `removing ${row.previous - value}`}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Shoppers see the new numbers straight away. Editing prices or copy sends the listing
            back for review.
          </span>
        </p>

        <DialogFooter>
          <Button
            variant="ghost"
            className="rounded-xl"
            onClick={onClose}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl font-semibold"
            onClick={submit}
            disabled={mutation.isPending}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
