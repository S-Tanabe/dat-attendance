-- =====================================================
-- QR Tokens & Face Data Tables Migration (Rollback)
-- =====================================================

-- トリガー削除
DROP TRIGGER IF EXISTS face_data_updated_at ON face_data;
DROP TRIGGER IF EXISTS qr_tokens_updated_at ON qr_tokens;

-- テーブル削除（依存関係の順序に注意）
DROP TABLE IF EXISTS face_data;
DROP TABLE IF EXISTS qr_tokens;
