import { useState } from "react";
import { ChevronDown, FlaskConical } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const DEMO_ACCOUNTS = [
  {
    label: "Customer",
    email: "user@smartdeal.ae",
    password: "userpassword1234",
    note: "Orders, wallet & tickets",
  },
  {
    label: "Seller",
    email: "vendor@smartdeal.ae",
    password: "vendorpassword1234",
    note: "Products, orders & payouts",
  },
  {
    label: "Admin",
    email: "admin@smartdeal.ae",
    password: "adminpassword1234",
    note: "Full platform access",
  },
  {
    label: "Support",
    email: "support@smartdeal.ae",
    password: "Support@12345",
    note: "Support desk only",
  },
];

/**
 * Development-only shortcut that fills the sign-in form with a seeded account.
 * Renders nothing in a production build.
 */
export function DemoAccounts({ onPick }: { onPick: (email: string, password: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!import.meta.env.DEV) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border border-dashed border-border bg-muted/40"
    >
      <CollapsibleTrigger className="flex w-full cursor-pointer items-center gap-2 px-3 py-2.5 text-left">
        <FlaskConical className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-xs font-semibold">Demo accounts</span>
        <span className="text-[11px] text-muted-foreground">development only</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <ul className="space-y-1.5 px-3 pb-3">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                onClick={() => onPick(account.email, account.password)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent"
              >
                <span className="min-w-14 text-xs font-bold">{account.label}</span>
                <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground">
                  {account.email}
                </span>
                <span className="hidden text-[11px] text-muted-foreground sm:block">
                  {account.note}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
