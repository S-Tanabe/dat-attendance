# Auth Service Dev Guide

目的: 認証・セッション・セキュリティ基盤。ロール/プロフィールは持たない（users担当）。

主要API:
- Public
  - POST /auth/login, /auth/refresh, /auth/logout, GET /auth/me(id/email)
- Internal (expose:false)
  - セッション統計/クリーンアップ/監視: see realtime_monitoring.ts, session_cleanup.ts
  - 管理者用（dev_tools向け）: 
    - GET /auth/internal/admin/user/:userId/devices
    - DELETE /auth/internal/admin/device/:device_id
    - POST /auth/internal/admin/device/:device_id/revoke-sessions
    - POST /auth/internal/admin/device-trust
    - GET /auth/internal/admin/activities/:userId
    - GET /auth/internal/admin/anomalies

設計メモ:
- JWT(HS256)・Refresh(ハッシュ保存)・セッション上限・ファミリー失効。
- 異常検知/リアルタイムはRawRequest非対応箇所を段階的に統合予定。
