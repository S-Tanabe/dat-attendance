/*
 * Session Cleanup Jobs
 *
 * 概要:
 * - 期限切れ/失効済みセッションの定期削除と、監査ログのアーカイブ削除、
 *   簡易的な疑わしいセッションパターンのマーキングを行います。
 *
 * 運用ノート:
 * - 物理削除はビジネス/コンプライアンス要件（保持期間）に合わせて調整してください。
 * - 大量削除時のロック/IO負荷に注意。必要に応じてバッチ/LIMIT分割を検討。
 */
import { CronJob } from "encore.dev/cron";
import { api } from "encore.dev/api";
import { db } from "./database";
import log from "encore.dev/log";

// クリーンアップ処理を実行するAPI
export const cleanup_sessions_api = api({expose: false}, async () => {
    try {
      // 削除前の統計を取得
      const beforeStats = await db.queryRow<{
        total_count: number;
        expired_count: number;
        revoked_count: number;
      }>`
        SELECT 
          COUNT(*) as total_count,
          COUNT(CASE WHEN expires_at < NOW() AND revoked_at IS NULL THEN 1 END) as expired_count,
          COUNT(CASE WHEN revoked_at IS NOT NULL THEN 1 END) as revoked_count
        FROM auth_sessions
      `;
      
      // 無効化されたセッション、または期限切れセッションを削除
      const deleteResult = await db.query`
        DELETE FROM auth_sessions 
        WHERE revoked_at IS NOT NULL 
           OR expires_at < NOW()
        RETURNING id, 
          CASE 
            WHEN revoked_at IS NOT NULL THEN 'revoked' 
            ELSE 'expired' 
          END as delete_reason
      `;
      
      // 削除された行を集計
      let expiredDeleted = 0;
      let revokedDeleted = 0;
      for await (const row of deleteResult) {
        if (row.delete_reason === 'expired') {
          expiredDeleted++;
        } else {
          revokedDeleted++;
        }
      }
      
      // 削除後の統計情報を取得
      const afterStats = await db.queryRow<{
        total_sessions: number;
        active_sessions: number;
      }>`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN revoked_at IS NULL AND expires_at > NOW() THEN 1 END) as active_sessions
        FROM auth_sessions
      `;
      
      log.info("cleanup_sessions_api completed", {
        expired_deleted: expiredDeleted,
        revoked_deleted: revokedDeleted,
        remaining_total: afterStats?.total_sessions || 0,
        remaining_active: afterStats?.active_sessions || 0
      });
      
      return {
        success: true,
        expired_deleted: expiredDeleted,
        revoked_deleted: revokedDeleted,
        remaining_total: afterStats?.total_sessions || 0,
        remaining_active: afterStats?.active_sessions || 0,
      };
    } catch (error) {
      log.error("Session cleanup failed:", error as Error);
      throw error;
    }
});

// 毎時間セッションクリーンアップを実行（基本クリーンアップ）
const cleanupSessions = new CronJob(
  "cleanup-sessions",
  {
    title: "Clean up expired and revoked sessions",
    every: "1h", // 毎時間
    endpoint: cleanup_sessions_api,
  }
);

// 高度なクリーンアップAPI（内部使用）
export const advanced_cleanup_sessions = api(
  { expose: false },
  async (): Promise<{
    success: boolean;
    expired_deleted: number;
    revoked_deleted: number;
    audit_logs_archived: number;
    suspicious_sessions_marked: number;
    execution_time_ms: number;
  }> => {
    const startTime = Date.now();
    
    try {
      // 1. 30日以上前の無効化されたセッションを削除
      // まず削除対象の件数を取得
      const revokedCountResult = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM auth_sessions 
        WHERE revoked_at IS NOT NULL 
        AND revoked_at < NOW() - INTERVAL '30 days'
      `;
      const revokedDeleted = revokedCountResult?.count || 0;
      
      // 実際に削除を実行
      if (revokedDeleted > 0) {
        await db.exec`
          DELETE FROM auth_sessions 
          WHERE revoked_at IS NOT NULL 
          AND revoked_at < NOW() - INTERVAL '30 days'
        `;
      }
      
      // 2. 期限切れから7日以上経過したセッションを削除
      // まず削除対象の件数を取得
      const expiredCountResult = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM auth_sessions 
        WHERE expires_at < NOW() - INTERVAL '7 days'
      `;
      const expiredDeleted = expiredCountResult?.count || 0;
      
      // 実際に削除を実行
      if (expiredDeleted > 0) {
        await db.exec`
          DELETE FROM auth_sessions 
          WHERE expires_at < NOW() - INTERVAL '7 days'
        `;
      }
      
      // 3. 90日以上前の監査ログをアーカイブ（実際の実装では外部ストレージへ移動）
      // まず削除対象の件数を取得
      const auditCountResult = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM auth_session_audit_logs 
        WHERE created_at < NOW() - INTERVAL '90 days'
      `;
      const auditArchived = auditCountResult?.count || 0;
      
      // 実際に削除を実行
      if (auditArchived > 0) {
        await db.exec`
          DELETE FROM auth_session_audit_logs 
          WHERE created_at < NOW() - INTERVAL '90 days'
        `;
      }
      
      // 4. 疑わしいセッションパターンを検出してマーク
      // - 同一ユーザーで短時間に異なるIPから大量のセッション作成
      // まず更新対象の件数を取得
      const suspiciousCountResult = await db.queryRow<{ count: number }>`
        SELECT COUNT(*) as count
        FROM auth_sessions s1
        WHERE s1.is_suspicious = false
        AND EXISTS (
          SELECT 1
          FROM auth_sessions s2
          WHERE s2.user_id = s1.user_id
          AND s2.id != s1.id
          AND s2.created_at BETWEEN s1.created_at - INTERVAL '10 minutes' 
                               AND s1.created_at + INTERVAL '10 minutes'
          AND s2.ip_address != s1.ip_address
          GROUP BY s2.user_id
          HAVING COUNT(DISTINCT s2.ip_address) > 3
        )
      `;
      const suspiciousMarked = suspiciousCountResult?.count || 0;
      
      // 実際に更新を実行
      if (suspiciousMarked > 0) {
        await db.exec`
          UPDATE auth_sessions s1
          SET is_suspicious = true
          WHERE s1.is_suspicious = false
          AND EXISTS (
            SELECT 1
            FROM auth_sessions s2
            WHERE s2.user_id = s1.user_id
            AND s2.id != s1.id
            AND s2.created_at BETWEEN s1.created_at - INTERVAL '10 minutes' 
                                 AND s1.created_at + INTERVAL '10 minutes'
            AND s2.ip_address != s1.ip_address
            GROUP BY s2.user_id
            HAVING COUNT(DISTINCT s2.ip_address) > 3
          )
        `;
      }
      
      // 5. クリーンアップ統計を記録
      const executionTime = Date.now() - startTime;
      await db.exec`
        INSERT INTO auth_cleanup_stats 
        (expired_sessions_deleted, revoked_sessions_deleted, audit_logs_archived, execution_time_ms)
        VALUES (${expiredDeleted}, ${revokedDeleted}, ${auditArchived}, ${executionTime})
      `;
      
      log.info("Advanced session cleanup completed", {
        expired_deleted: expiredDeleted,
        revoked_deleted: revokedDeleted,
        audit_logs_archived: auditArchived,
        suspicious_sessions_marked: suspiciousMarked,
        execution_time_ms: executionTime,
      });
      
      return {
        success: true,
        expired_deleted: expiredDeleted,
        revoked_deleted: revokedDeleted,
        audit_logs_archived: auditArchived,
        suspicious_sessions_marked: suspiciousMarked,
        execution_time_ms: executionTime,
      };
    } catch (error) {
      log.error("Advanced cleanup failed", error as Error);
      throw error;
    }
  }
);

// 高度なクリーンアップCronジョブ - 毎日深夜2時に実行
const advancedCleanupSessions = new CronJob(
  "advanced-cleanup-sessions",
  {
    title: "Advanced Session Cleanup",
    schedule: "0 2 * * *", // 毎日午前2時
    endpoint: advanced_cleanup_sessions,
  }
);
