-- =====================================================
-- Attendance Tables Migration
-- 出退勤機能のためのテーブル定義
-- =====================================================

-- 打刻方法マスタテーブル
-- 将来的にQRコード、顔認証、NFC等の打刻方法を追加可能
CREATE TABLE IF NOT EXISTS clock_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,        -- システム内部コード (button, qr_code, face_recognition, nfc, etc.)
  name TEXT NOT NULL,               -- 表示名
  description TEXT,                 -- 説明
  is_active BOOLEAN DEFAULT true,   -- 有効/無効フラグ
  config JSONB DEFAULT '{}',        -- メソッド固有の設定（将来拡張用）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 出退勤レコードテーブル
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,                                           -- 打刻日時（UTC）
  type TEXT NOT NULL CHECK (type IN ('CLOCK_IN', 'CLOCK_OUT', 'ADJUSTMENT')), -- 打刻種別
  note TEXT,                                                                 -- 管理者コメント/理由
  source TEXT NOT NULL CHECK (source IN ('USER', 'ADMIN', 'SYSTEM')),        -- 登録者種別

  -- 打刻方法の拡張対応
  clock_method_id UUID REFERENCES clock_methods(id),   -- 打刻方法（NULL許可: レガシーデータ対応）
  verification_data JSONB DEFAULT '{}',                 -- 認証データ（QRトークン、顔認証スコア等）

  -- メタデータ
  device_info JSONB DEFAULT '{}',                       -- デバイス情報（IP, User-Agent等）
  location_data JSONB DEFAULT '{}',                     -- 位置情報（緯度経度、精度等）

  -- 監査カラム
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,                                      -- 作成者（ADMINによる代理打刻時など）
  updated_by UUID                                       -- 更新者
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_id ON attendance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_timestamp ON attendance_records(timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_records_user_timestamp ON attendance_records(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_records_type ON attendance_records(type);
CREATE INDEX IF NOT EXISTS idx_attendance_records_clock_method ON attendance_records(clock_method_id);

-- 打刻方法の初期データ
INSERT INTO clock_methods (code, name, description, is_active) VALUES
  ('button', 'ボタン打刻', '画面上のボタンをクリックして打刻', true),
  ('qr_code', 'QRコード打刻', 'QRコードをスキャンして打刻', false),
  ('face_recognition', '顔認証打刻', '顔認証を使用して打刻', false),
  ('nfc', 'NFC/ICカード打刻', 'NFCカードをタッチして打刻', false),
  ('gps', 'GPS打刻', '位置情報を使用して打刻', false)
ON CONFLICT (code) DO NOTHING;

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER attendance_records_updated_at
  BEFORE UPDATE ON attendance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_updated_at();

CREATE TRIGGER clock_methods_updated_at
  BEFORE UPDATE ON clock_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_updated_at();

-- コメント
COMMENT ON TABLE attendance_records IS '出退勤打刻レコード';
COMMENT ON TABLE clock_methods IS '打刻方法マスタ（拡張可能）';
COMMENT ON COLUMN attendance_records.clock_method_id IS '打刻方法。NULLの場合はデフォルト（ボタン打刻）';
COMMENT ON COLUMN attendance_records.verification_data IS '打刻方法固有の認証データ（QRトークン、顔認証スコア等）';
COMMENT ON COLUMN attendance_records.device_info IS 'デバイス情報（IP, User-Agent, ブラウザ情報等）';
COMMENT ON COLUMN attendance_records.location_data IS '位置情報（緯度、経度、精度、住所等）';
