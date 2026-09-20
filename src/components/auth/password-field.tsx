import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Password input with a show/hide toggle, label and inline error message. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete = "current-password",
  placeholder = "••••••••",
  disabled = false,
  action,
  className,
}: {
  id?: string | undefined;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  autoComplete?: string;
  placeholder?: string;
  disabled?: boolean;
  action?: React.ReactNode;
  className?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={fieldId}>{label}</Label>
        {action}
      </div>
      <div className="relative">
        <Input
          id={fieldId}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          className="h-11 rounded-xl pr-11"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          aria-label={visible ? "Hide password" : "Show password"}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error && (
        <p id={`${fieldId}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
