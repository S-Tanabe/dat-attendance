---
name: foundation-notification
description: |
  dashboard-acceleratorテンプレートが提供する通知システム。
  SSE (Server-Sent Events) によるリアルタイム通知を提供。

  【WHEN to use】
  - リアルタイム通知実装時
  - SSE接続時
  - 通知テンプレート作成時

  【TRIGGER keywords】
  通知、notification、SSE、リアルタイム、Server-Sent Events
allowed-tools: Read, Grep
---

# Template Notification: 通知システム

## Overview

**実装パス**:
- Backend: `backend/services/notification/`
- Frontend: `frontend/src/lib/notifications/store.ts`
- Database: `notifications`, `notification_deliveries` (notification物理データベース内)

### Provided Features

- **SSE (Server-Sent Events)**: リアルタイム通知配信
- **通知テンプレート**: 再利用可能な通知メッセージ
- **未読管理**: 未読件数カウント
- **通知設定**: ユーザーごとの通知ON/OFF

---

## Quick Reference

### Backend: SSE Endpoint

```typescript
// backend/services/notification/web_delivery.ts

import type { ServerResponse, IncomingMessage } from "http";
import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";

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

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    res.write(`event: ping\ndata: connected\n\n`);

    // SSE接続管理とPubSub連携
    const connection = { res, userId: auth.userID, channels: new Set([...]) };
    registerConnection(connection);

    res.on("close", () => {
      unregisterConnection(connection);
    });
  }
);
```

### Frontend: SSE接続

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  let notifications = $state<Notification[]>([]);

  onMount(() => {
    const eventSource = new EventSource('/notifications/stream');

    eventSource.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      notifications = [notification, ...notifications];
    };

    return () => eventSource.close();
  });
</script>
```

---

## Related Skills

- **foundation-components header-pattern.md**: ヘッダー通知アイコン
- **foundation-database extensions.md**: tcn（変更通知）
