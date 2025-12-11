# SSE Frontend実装

## EventSource接続

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { notificationCenter } from '$lib/notifications/store';

  onMount(() => {
    const eventSource = new EventSource('/notifications/stream');

    eventSource.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      notificationCenter.add(notification);
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      eventSource.close();
    };

    return () => eventSource.close();
  });
</script>
```

## 通知ストア

```typescript
// frontend/src/lib/notifications/store.ts

import { writable } from 'svelte/store';

function createNotificationCenter() {
  const { subscribe, update } = writable<Notification[]>([]);

  return {
    subscribe,
    add(notification: Notification) {
      update(notifications => [notification, ...notifications]);
    },
    markAsRead(id: string) {
      update(notifications =>
        notifications.map(n => n.id === id ? { ...n, read: true } : n)
      );
    },
  };
}

export const notificationCenter = createNotificationCenter();
```
