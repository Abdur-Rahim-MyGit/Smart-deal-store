/**
 * First-touch acquisition channel for sign-up analytics: the `utm_source` of the first visit,
 * else the referring site's host, else "direct". Kept per browser and sent when an account is
 * created, so the admin dashboard can show where new customers come from.
 */
const SOURCE_KEY = "smartdeal.acquisitionSource";

export function captureAcquisitionSource(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(SOURCE_KEY)) return;
    let source = new URLSearchParams(window.location.search).get("utm_source")?.trim() || "";
    if (!source && document.referrer) {
      const host = new URL(document.referrer).hostname.replace(/^www\./, "");
      if (host && host !== window.location.hostname) source = host;
    }
    window.localStorage.setItem(SOURCE_KEY, (source || "direct").toLowerCase().slice(0, 60));
  } catch {
    // Storage blocked or a malformed referrer: the account is simply recorded as "direct".
  }
}

export function acquisitionSource(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage.getItem(SOURCE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
