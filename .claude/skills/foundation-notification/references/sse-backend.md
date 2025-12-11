# SSE Backend実装

## 実装場所

- `backend/services/notification/web_delivery.ts`
- `backend/services/notification/topics.ts`

---

## チャンネルベースSSE実装

### Encore.dev PubSub + api.raw()

実装では**PostgreSQL NOTIFY**ではなく、**Encore.dev PubSub**を使用してSSE配信を行います。

```typescript
import type { ServerResponse, IncomingMessage } from "http";
import { api } from "encore.dev/api";
import { Subscription } from "encore.dev/pubsub";
import { getAuthData } from "~encore/auth";
import { deliveryTopic } from "./topics";

interface SSEConnection {
  res: ServerResponse;
  userId: string;
  channels: Set<string>;  // user-{id}, admin-dashboard, all-users
}

// チャンネルごとの接続管理
const channelConnections = new Map<string, Set<SSEConnection>>();

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

    // ユーザーのロールレベルを取得
    const roleLevel = await getUserRoleLevel(auth.userID);

    // チャンネルセットを構築
    const channels = buildChannelSet(req, auth.userID, roleLevel);

    // SSE ヘッダー設定
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // 接続確認
    res.write(`event: ping\ndata: connected\n\n`);

    // SSE接続を登録
    const connection: SSEConnection = {
      res,
      userId: auth.userID,
      channels,
    };
    registerConnection(connection);

    // クライアント切断時の処理
    req.on("close", () => {
      unregisterConnection(connection);
    });
  }
);
```

---

## PubSub配信システム

### Delivery Topic Subscription

```typescript
// PubSubトピックからのイベントを購読し、SSE接続に配信
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
    await updateDeliveryStatus(
      event.notificationId,
      event.channel,
      "failed",
      error instanceof Error ? error.message : String(error)
    );
  }
}
```

---

## チャンネル管理

### サポートされるチャンネル

```typescript
// channels.ts
export const CHANNEL_ALL_USERS = "all-users";
export const CHANNEL_ADMIN_DASHBOARD = "admin-dashboard";

export function makeUserChannel(userId: string): string | null {
  return userId ? `user-${userId}` : null;
}
```

**チャンネルタイプ**:
- `user-{userId}`: 特定ユーザー宛て
- `all-users`: 全ユーザー宛て
- `admin-dashboard`: 管理者ダッシュボード宛て

---

## 接続管理

### Register/Unregister

```typescript
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
```

---

## ブロードキャスト

```typescript
async function broadcastToChannel(channel: string, payload: NotificationPayload) {
  const connections = channelConnections.get(channel);
  if (!connections) {
    return;
  }
  for (const connection of connections) {
    sendEvent(connection, { channel, payload });
  }
}

function sendEvent(connection: SSEConnection, message: SSEMessage) {
  const data = JSON.stringify(message);
  connection.res.write(`data: ${data}\n\n`);
}
```
