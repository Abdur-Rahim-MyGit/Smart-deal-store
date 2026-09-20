import { useEffect } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useStore } from "@/context/store";
import type { Role, User } from "@/lib/types";

/**
 * Client-side guard for account areas. Waits for the session to be restored,
 * then redirects guests to sign in (returning here afterwards) and users with
 * the wrong role to the home page.
 */
export function useRequireAuth(roles?: Role[]): {
  ready: boolean;
  allowed: boolean;
  user: User | null;
} {
  const { hydrated, user } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const roleKey = roles?.join(",") ?? "";
  const allowed = Boolean(user && (!roles || roles.includes(user.role)));

  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      void navigate({ to: "/login", search: { redirect: location.href }, replace: true });
      return;
    }
    if (roles && !roles.includes(user.role)) {
      toast.error("You don't have access to that page");
      void navigate({ to: "/", replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, user, roleKey]);

  return { ready: hydrated, allowed, user };
}
