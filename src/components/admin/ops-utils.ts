import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import type { AdminPermission, User } from "@/lib/types";

/**
 * Non-visual helpers for the operations half of the admin console
 * (overview, orders, returns, products, categories, reviews, tickets).
 */

export const selectClass =
  "h-9 rounded-xl border border-input bg-background px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60";

export const inputClass = "h-9 rounded-xl";

/** A 403 means the signed-in admin lacks the permission for that endpoint. */
export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/** Never retry a permission failure — it would loop forever. */
export function opsRetry(failureCount: number, error: unknown): boolean {
  return !isForbidden(error) && failureCount < 2;
}

/** Can change things in this console area. */
export function canDo(user: User | null | undefined, permission: AdminPermission): boolean {
  if (!user) return false;
  return Boolean(user.isSuperAdmin) || (user.permissions ?? []).includes(permission);
}

/** Can at least open and read this console area. */
export function canView(user: User | null | undefined, permission: AdminPermission): boolean {
  return canDo(user, permission) || Boolean(user?.viewPermissions?.includes(permission));
}

/** Invalidates query-key prefixes after a mutation. */
export function useOpsInvalidate(): (...prefixes: string[]) => void {
  const queryClient = useQueryClient();
  return (...prefixes: string[]) => {
    for (const prefix of prefixes) void queryClient.invalidateQueries({ queryKey: [prefix] });
  };
}

/* ---------- console search params ---------- */

export function useAdminSearch() {
  return useSearch({ from: "/admin-dashboard" });
}

export function useAdminNavigate() {
  return useNavigate({ from: "/admin-dashboard" });
}
