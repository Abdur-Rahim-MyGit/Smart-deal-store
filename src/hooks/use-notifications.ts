import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_URL, api, getAccessToken } from "@/lib/api";
import { useStore } from "@/context/store";
import type { AppNotification } from "@/lib/types";

export function useNotifications() {
  const { isAuthenticated } = useStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      api<{ notifications: AppNotification[]; unreadCount: number }>("/notifications", {
        query: { limit: 20 },
      }),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    staleTime: 20_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["notifications"] });

  // Live real-time notification stream via Server-Sent Events
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getAccessToken();
    if (!token) return;

    let source: EventSource | null = null;
    try {
      source = new EventSource(`${API_URL}/notifications/stream?token=${encodeURIComponent(token)}`);

      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as AppNotification;
          if (payload?.title) {
            toast.info(payload.title, {
              description: payload.message,
            });
            void invalidate();
          }
        } catch {
          // heartbeat or unparseable event
        }
      };

      source.onerror = () => {
        // EventSource will auto-reconnect
      };
    } catch {
      // Graceful fallback to periodic polling
    }

    return () => {
      if (source) source.close();
    };
  }, [isAuthenticated]);

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: "PUT" }),
    onSuccess: invalidate,
  });
  const markAllRead = useMutation({
    mutationFn: () => api("/notifications/read-all", { method: "PUT" }),
    onSuccess: invalidate,
  });

  return {
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
    isLoading: query.isLoading,
    markRead: (id: string) => markRead.mutate(id),
    markAllRead: () => markAllRead.mutate(),
  };
}
