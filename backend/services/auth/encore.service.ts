import { Service } from "encore.dev/service";
import { secret } from "encore.dev/config";
import { createSentryMiddleware } from "../../shared/monitoring";

// Sentry DSNをシークレットとして取得
const sentryDsn = secret("SENTRY_DSN_BACKEND");

export default new Service("auth", {
  middlewares: [createSentryMiddleware("auth", sentryDsn)],
});