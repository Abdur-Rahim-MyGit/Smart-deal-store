import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy URL — the account area now lives at /account.
export const Route = createFileRoute("/profile")({
  beforeLoad: () => {
    throw redirect({ to: "/account" });
  },
});
