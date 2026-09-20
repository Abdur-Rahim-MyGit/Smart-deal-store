/**
 * Single HTTP client for the Smart Deal API.
 *
 * - The short-lived access token lives in memory only.
 * - The refresh token is an httpOnly cookie; `refreshSession()` exchanges it
 *   for a new access token, and any 401 is retried once after a refresh.
 */
import type { User } from "@/lib/types";

const DEFAULT_API_URL = "http://localhost:5050/api";

export const API_URL: string = (
  (import.meta.env["VITE_API_URL"] as string | undefined) || DEFAULT_API_URL
).replace(/\/$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type QueryValue = string | number | boolean | null | undefined;

export interface ApiOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

type SessionListener = (event: {
  accessToken: string | null;
  user?: User | null | undefined;
}) => void;

let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;
const listeners = new Set<SessionListener>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null, user?: User | null): void {
  accessToken = token;
  listeners.forEach((listener) => listener({ accessToken: token, user }));
}

/** Notified whenever the session is refreshed or ends (e.g. refresh cookie expired). */
export function onSessionChange(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${API_URL}/auth/refresh`, { method: "POST", credentials: "include" })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          accessToken?: string;
          user?: User;
        };
        if (response.ok && data.accessToken) {
          setAccessToken(data.accessToken, data.user ?? null);
          return data.accessToken;
        }
        if (response.status === 401) setAccessToken(null, null);
        return null;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/** Calls the API and returns the parsed JSON body, throwing ApiError on failure. */
export async function api<T = Record<string, unknown>>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { method = "GET", body, query, signal } = options;
  const url = buildUrl(path, query);

  const send = (token: string | null) => {
    const init: RequestInit = {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    if (signal) init.signal = signal;
    if (body !== undefined) init.body = JSON.stringify(body);
    return fetch(url, init);
  };

  let response: Response;
  try {
    response = await send(accessToken);
    if (response.status === 401 && accessToken && !path.startsWith("/auth/refresh")) {
      const renewed = await refreshSession();
      if (renewed) response = await send(renewed);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      "We couldn't reach Smart Deal. Please check your connection and try again.",
      0,
    );
  }

  const data = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    details?: unknown;
  };
  if (!response.ok || data.success === false) {
    throw new ApiError(
      data.message || `Request failed (${response.status})`,
      response.status,
      data.details,
    );
  }
  return data as T;
}

/** Human-readable message for any thrown value. */
export function errorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error instanceof ApiError || error instanceof Error) return error.message || fallback;
  return fallback;
}
