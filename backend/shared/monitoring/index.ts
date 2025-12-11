/**
 * 監視・モニタリングシステム
 *
 * このモジュールは、Sentry統合などの監視機能を提供します。
 *
 * 使用例:
 * ```typescript
 * import { sentryMiddleware } from "../../shared/monitoring";
 *
 * export default new Service("myservice", {
 *   middlewares: [sentryMiddleware],
 * });
 * ```
 */

export * from "./sentry";
