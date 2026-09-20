import { API_URL, getAccessToken, refreshSession } from "@/lib/api";

async function authorisedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const send = (token: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  let response = await send(getAccessToken());
  if (response.status === 401) response = await send(await refreshSession());
  return response;
}

async function failureMessage(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as { message?: string } | null;
  return data?.message ?? "Something went wrong. Please try again.";
}

/**
 * Opens a file that needs the signed-in user's token (a plain link can't send it).
 * The tab is opened straight away so pop-up blockers allow it, then pointed at the file.
 */
export async function openProtectedFile(path: string): Promise<void> {
  const tab = window.open("", "_blank");
  try {
    const response = await authorisedFetch(path);
    if (!response.ok) throw new Error(await failureMessage(response));
    const url = URL.createObjectURL(await response.blob());
    if (tab) tab.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

/** Uploads one file as multipart form data and returns the parsed JSON response. */
export async function uploadFile<T>(
  path: string,
  file: File,
  fields: Record<string, string> = {},
): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  for (const [key, value] of Object.entries(fields)) if (value) form.append(key, value);
  const response = await authorisedFetch(path, { method: "POST", body: form });
  if (!response.ok) throw new Error(await failureMessage(response));
  return (await response.json()) as T;
}
