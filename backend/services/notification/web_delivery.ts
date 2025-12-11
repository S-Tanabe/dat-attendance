import type { ServerResponse, IncomingMessage } from "http";
import { api } from "encore.dev/api";
import { Subscription } from "encore.dev/pubsub";
import log from "encore.dev/log";
import { getAuthData } from "~encore/auth";
import { app } from "~encore/clients";

import { deliveryTopic } from "./topics";
import type { DeliveryEvent, NotificationPayload } from "./types";
import { updateDeliveryStatus } from "./repository";
import {
  CHANNEL_ADMIN_DASHBOARD,
  CHANNEL_ALL_USERS,
  extractUserId,
  isAdminChannel,
  isAllUsersChannel,
  isUserChannel,
  makeUserChannel,
  normalizeChannelId,
} from "./channels";

interface SSEConnection {
  res: ServerResponse;
  userId: string;
  channels: Set<string>;
}

interface SSEMessage {
  channel: string;
  payload: NotificationPayload;
}

const channelConnections = new Map<string, Set<SSEConnection>>();

function registerConnection(connection: SSEConnection) {
  for (const channel of connection.channels) {
    if (!channelConnections.has(channel)) {
      channelConnections.set(channel, new Set());
    }
    channelConnections.get(channel)!.add(connection);
  }
}

function unregisterConnection(connection: SSEConnection) {
  for (const channel of connection.channels) {
    const set = channelConnections.get(channel);
    if (!set) continue;
    set.delete(connection);
    if (set.size === 0) {
      channelConnections.delete(channel);
    }
  }
}

function sendEvent(connection: SSEConnection, message: SSEMessage) {
  const data = JSON.stringify(message);
  connection.res.write(`data: ${data}\n\n`);
}

async function getUserRoleLevel(userId: string): Promise<number | null> {
  const profile = await app.get_user_profile({ id: userId });
  return profile?.profile?.role_level ?? null;
}

async function ensureAdmin(userId: string): Promise<void> {
  const roleLevel = await getUserRoleLevel(userId);
  if (roleLevel === null || roleLevel > 2) {
    throw new Error("admin role required");
  }
}

function isAdminRole(roleLevel: number | null): boolean {
  return roleLevel !== null && roleLevel <= 2;
}

function buildChannelSet(
  req: IncomingMessage,
  userId: string,
  roleLevel: number | null
): Set<string> {
  const channels = new Set<string>();
  const defaultUserChannel = makeUserChannel(userId);
  if (defaultUserChannel) {
    channels.add(defaultUserChannel);
  }
  channels.add(CHANNEL_ALL_USERS);

  if (!req.url) {
    return channels;
  }

  let parsed: URL;
  try {
    parsed = new URL(req.url, "http://localhost");
  } catch {
    return channels;
  }

  const requested = parsed.searchParams.getAll("channel");
  for (const raw of requested) {
    const normalized = normalizeChannelId(raw);
    if (!normalized) {
      log.warn("notifications.stream.unsupported_channel_param", {
        user_id: userId,
        requested: raw,
      });
      continue;
    }

    if (isUserChannel(normalized)) {
      const target = extractUserId(normalized);
      if (!target) continue;
      if (target === userId || isAdminRole(roleLevel)) {
        channels.add(normalized);
      }
      continue;
    }

    if (isAllUsersChannel(normalized)) {
      channels.add(normalized);
      continue;
    }

    if (isAdminChannel(normalized) && isAdminRole(roleLevel)) {
      channels.add(normalized);
      continue;
    }
  }

  return channels;
}

export const streamAdminNotifications = api.raw(
  {
    method: "GET",
    path: "/admin/notifications/stream",
    expose: true,
    auth: true,
  },
  async (_req: IncomingMessage, res: ServerResponse) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      res.statusCode = 401;
      res.end();
      return;
    }

    try {
      await ensureAdmin(auth.userID);
    } catch (error) {
      res.statusCode = 403;
      res.end();
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`event: ping\ndata: connected\n\n`);

    const connection: SSEConnection = {
      res,
      userId: auth.userID,
      channels: new Set([CHANNEL_ADMIN_DASHBOARD]),
    };

    registerConnection(connection);

    res.on("close", () => {
      unregisterConnection(connection);
    });
  }
);

export const streamUserNotifications = api.raw(
  {
    method: "GET",
    path: "/notifications/stream",
    expose: true,
    auth: true,
  },
  async (req: IncomingMessage, res: ServerResponse) => {
    const auth = getAuthData();
    if (!auth?.userID) {
      res.statusCode = 401;
      res.end();
      return;
    }

    let roleLevel: number | null = null;
    try {
      roleLevel = await getUserRoleLevel(auth.userID);
    } catch (error) {
      log.error("notifications.stream.role_lookup_failed", {
        user_id: auth.userID,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // ロール取得失敗してもSSE接続は継続する（roleLevel=nullとして扱う）
    }

    const channels = buildChannelSet(req, auth.userID, roleLevel);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`event: ping\ndata: connected\n\n`);

    const connection: SSEConnection = {
      res,
      userId: auth.userID,
      channels,
    };

    registerConnection(connection);

    req.on("close", () => {
      unregisterConnection(connection);
    });
  }
);

async function broadcastToChannel(channel: string, payload: NotificationPayload) {
  const connections = channelConnections.get(channel);
  if (!connections) {
    return;
  }
  for (const connection of connections) {
    sendEvent(connection, { channel, payload });
  }
}

async function handleDeliveryEvent(event: DeliveryEvent) {
  try {
    const enrichedPayload: NotificationPayload = {
      ...event.payload,
      metadata: {
        ...(event.payload.metadata ?? {}),
        deliveryChannel: event.channel,
      },
    };

    await broadcastToChannel(event.channel, enrichedPayload);
    await updateDeliveryStatus(event.notificationId, event.channel, "delivered");
  } catch (error) {
    log.error("delivery.web.failed", {
      notification_id: event.notificationId,
      channel: event.channel,
      error,
    });
    await updateDeliveryStatus(
      event.notificationId,
      event.channel,
      "failed",
      error instanceof Error ? error.message : String(error)
    );
  }
}

export const webDeliverySubscription = new Subscription(deliveryTopic, "web-delivery", {
  handler: async (event) => {
    if (
      event.channel === CHANNEL_ADMIN_DASHBOARD ||
      event.channel === CHANNEL_ALL_USERS ||
      event.channel.startsWith("user-")
    ) {
      await handleDeliveryEvent(event);
    }
  },
});

export async function sendToUser(userId: string, payload: NotificationPayload) {
  const channel = makeUserChannel(userId);
  if (!channel) return;
  await broadcastToChannel(channel, payload);
}
