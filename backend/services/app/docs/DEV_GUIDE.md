# App Service Dev Guide

目的: アプリ固有のプロフィール/ロール管理。認証はauth担当。auth_usersとapp_usersは同一UUID対応。

フォルダ構成（モジュール化）:
- `modules/users` : ユーザー領域（`user_management.ts`, `user_settings.ts`, `permissions.ts`, `storage.ts`）
- `database.ts`   : appサービス共通DB初期化
- `migrations/`   : appスキーマ用SQL

主要API（公開）:
- GET /users/list, GET /users/:userId
- POST /users (SAGA: auth作成→app作成、失敗時補償)
- PUT /users/:userId（email更新はauthへ委譲）
- DELETE /users/:userId（論理削除）, POST /users/:userId/restore
- POST /users/:userId/role（SUPER_ADMINのみ）
- POST /users/:userId/password-reset（自己対象不可, PW>=8）
- GET /users/:userId/sessions, POST /users/:userId/force-logout

主要API（内部）:
- POST /users/internal/create-app-user, /delete-app-user
- GET /users/internal/profile

設計メモ:
- 権限判定は app.roles を一次ソースとし、プロセス内キャッシュ(TTL=60s, Secret USERS_ROLE_CACHE_TTL_MS)で高速化。
- ロール更新時は invalidateRoleCache(userId) を呼び出し。
