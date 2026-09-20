import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStore, MfaRequiredError } from "@/context/store";
import { errorMessage } from "@/lib/api";

/* Minimal shape of the Google Identity Services client we actually use. */
interface GoogleCredentialResponse {
  credential?: string | undefined;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: string;
      size?: string;
      type?: string;
      text?: string;
      shape?: string;
      width?: number;
      logo_alignment?: string;
    },
  ) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } } | undefined;
  }
}

const GSI_SRC = "https://accounts.google.com/gsi/client";

/**
 * Renders the official Google button. Only mounted when the store has a
 * `googleClientId`, so there is never a dead "Continue with Google" control.
 */
export function GoogleSignInButton({ clientId }: { clientId: string }) {
  const { loginWithGoogle } = useStore();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const handleCredential = (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        toast.error("Google didn't return a sign-in token. Please try again.");
        return;
      }
      setPending(true);
      loginWithGoogle(response.credential)
        .catch((error: unknown) => {
          if (!(error instanceof MfaRequiredError)) toast.error(errorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setPending(false);
        });
    };

    const render = () => {
      const identity = window.google?.accounts.id;
      const node = containerRef.current;
      if (cancelled || !identity || !node) return;
      try {
        identity.initialize({
          client_id: clientId,
          callback: handleCredential,
          cancel_on_tap_outside: true,
        });
        node.replaceChildren();
        identity.renderButton(node, {
          theme: "outline",
          size: "large",
          type: "standard",
          text: "continue_with",
          shape: "pill",
          logo_alignment: "center",
          width: Math.min(400, Math.max(200, node.offsetWidth || 320)),
        });
      } catch {
        setFailed(true);
      }
    };

    if (window.google?.accounts.id) {
      render();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    const script = existing ?? document.createElement("script");
    const onLoad = () => render();
    const onError = () => setFailed(true);
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    if (!existing) {
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
  }, [clientId, loginWithGoogle]);

  if (failed) return null;

  return (
    <div className="relative">
      <div ref={containerRef} className="flex min-h-[40px] justify-center" />
      {pending && (
        <div className="absolute inset-0 grid place-items-center rounded-full bg-card/80 backdrop-blur-sm">
          <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing you in…
          </span>
        </div>
      )}
    </div>
  );
}
