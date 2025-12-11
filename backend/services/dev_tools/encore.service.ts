/*
 * Dev Tools Service (開発者/運用者向け)
 *
 * 概要:
 * - super_admin のみがアクセス可能な運用・監視ツール群を提供します。
 * - 認証/プロフィール/ロールの責務分離方針に従い、ロール判定は app サービス経由で行います。
 * - 実データの一部はモック/内部API依存のため、将来的に auth 側の管理用API整備と連携を前提とします。
 * - Sentry統合なし（開発者用の裏メニューのため、エラー監視は不要）
 */
import { Service } from "encore.dev/service";

export default new Service("dev-tools");
