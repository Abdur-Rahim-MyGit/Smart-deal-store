/**
 * In-memory registry of active Server-Sent Events (SSE) connections.
 * Enables live pushes of order updates, alerts, and notifications.
 */

const clients = new Map(); // userId string -> Set of Response objects

export function registerClient(userId, res) {
  const id = String(userId);
  if (!clients.has(id)) {
    clients.set(id, new Set());
  }
  clients.get(id).add(res);

  // Remove on connection close
  res.on("close", () => {
    const userClients = clients.get(id);
    if (userClients) {
      userClients.delete(res);
      if (userClients.size === 0) {
        clients.delete(id);
      }
    }
  });
}

export function pushNotification(userId, data) {
  const id = String(userId);
  const userClients = clients.get(id);
  if (!userClients || userClients.size === 0) return;

  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of userClients) {
    try {
      client.write(payload);
    } catch (err) {
      console.error("[SSE] failed to write to client:", err.message);
    }
  }
}

export function pushToAdmins(adminUserIds, data) {
  for (const id of adminUserIds) {
    pushNotification(id, data);
  }
}
