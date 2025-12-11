import { Topic } from "encore.dev/pubsub";
import type { DeliveryEvent, NotificationPayload } from "./types";

/** 通知生成直後に processor サブスクライバへ渡すトピック。 */
export const notificationTopic = new Topic<NotificationPayload>("notifications", {
  deliveryGuarantee: "at-least-once",
});

/** 配信レイヤー（SSE 等）に通知するためのトピック。 */
export const deliveryTopic = new Topic<DeliveryEvent>("notification-delivery", {
  deliveryGuarantee: "at-least-once",
});
