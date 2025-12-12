-- =====================================================
-- Attendance Tables Migration - Rollback
-- =====================================================

-- トリガー削除
DROP TRIGGER IF EXISTS attendance_records_updated_at ON attendance_records;
DROP TRIGGER IF EXISTS clock_methods_updated_at ON clock_methods;

-- 関数削除
DROP FUNCTION IF EXISTS update_attendance_updated_at();

-- テーブル削除（順序に注意: FK制約のある側から先に削除）
DROP TABLE IF EXISTS attendance_records;
DROP TABLE IF EXISTS clock_methods;
