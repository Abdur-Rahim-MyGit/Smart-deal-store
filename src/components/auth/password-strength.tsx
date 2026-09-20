import { Check } from "lucide-react";
import { passwordRules } from "@/components/auth/utils";
import { cn } from "@/lib/utils";

const TONE = [
  { bar: "bg-destructive", text: "text-destructive", label: "Very weak" },
  { bar: "bg-destructive", text: "text-destructive", label: "Weak" },
  { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", label: "Fair" },
  { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", label: "Good" },
  { bar: "bg-success", text: "text-success", label: "Strong" },
] as const;

/** Live checklist of the five password rules the API enforces. */
export function PasswordStrength({
  password,
  className,
}: {
  password: string;
  className?: string;
}) {
  const rules = passwordRules(password);
  const met = rules.filter((rule) => rule.met).length;
  const tone = TONE[Math.max(0, met - 1)] ?? TONE[0];

  return (
    <div className={cn("space-y-2.5 rounded-xl border border-border bg-muted/40 p-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-1 gap-1" aria-hidden="true">
          {rules.map((rule, index) => (
            <span
              key={rule.label}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                index < met ? tone.bar : "bg-border",
              )}
            />
          ))}
        </div>
        {password.length > 0 && (
          <span className={cn("text-[11px] font-semibold", tone.text)}>{tone.label}</span>
        )}
      </div>

      <ul className="grid gap-1 sm:grid-cols-2">
        {rules.map((rule) => (
          <li
            key={rule.label}
            className={cn(
              "flex items-center gap-1.5 text-[11px] transition-colors",
              rule.met ? "text-success" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border",
                rule.met ? "border-success bg-success text-success-foreground" : "border-border",
              )}
            >
              {rule.met && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
            </span>
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
