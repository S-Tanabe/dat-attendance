-- =====================================================
-- QR Tokens & Face Data Tables Migration
-- QRコードトークンと顔認証データのテーブル定義
-- =====================================================

-- QRコードトークンテーブル
-- A方式: ユーザーがQRを表示 → 管理者/受付がスキャン → 打刻承認
CREATE TABLE IF NOT EXISTS qr_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,                      -- QRコードに含まれるトークン（ランダム文字列）
  token_type TEXT NOT NULL DEFAULT 'clock',        -- トークン種別 (clock, temporary, etc.)
  clock_type TEXT CHECK (clock_type IN ('CLOCK_IN', 'CLOCK_OUT')), -- 打刻種別（NULLの場合は両方に使用可能）
  expires_at TIMESTAMPTZ NOT NULL,                 -- 有効期限
  used_at TIMESTAMPTZ,                             -- 使用日時（NULL = 未使用）
  used_by UUID REFERENCES app_users(id),           -- 使用者（スキャンした管理者/受付）
  device_info JSONB DEFAULT '{}',                  -- 生成時のデバイス情報
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_qr_tokens_user_id ON qr_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_token ON qr_tokens(token);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_expires_at ON qr_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_qr_tokens_used_at ON qr_tokens(used_at);

-- 顔認証データテーブル
-- ユーザーの顔特徴データを保存
CREATE TABLE IF NOT EXISTS face_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  descriptor JSONB NOT NULL,                       -- 顔特徴ベクトル（Float32Array → JSON）
  label TEXT,                                      -- ラベル（識別用）
  is_primary BOOLEAN DEFAULT true,                 -- プライマリ顔データかどうか
  confidence_threshold FLOAT DEFAULT 0.85,         -- 認証閾値
  metadata JSONB DEFAULT '{}',                     -- 追加のメタデータ（登録時の画像情報等）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_face_data_user_id ON face_data(user_id);
CREATE INDEX IF NOT EXISTS idx_face_data_is_primary ON face_data(is_primary);

-- ユーザーごとに1つのプライマリ顔データのみ許可
CREATE UNIQUE INDEX IF NOT EXISTS idx_face_data_user_primary
  ON face_data(user_id) WHERE is_primary = true;

-- updated_at 自動更新トリガー
CREATE TRIGGER qr_tokens_updated_at
  BEFORE UPDATE ON qr_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_updated_at();

CREATE TRIGGER face_data_updated_at
  BEFORE UPDATE ON face_data
  FOR EACH ROW
  EXECUTE FUNCTION update_attendance_updated_at();

-- コメント
COMMENT ON TABLE qr_tokens IS 'QRコード打刻用トークン（時限式）';
COMMENT ON TABLE face_data IS 'ユーザーの顔認証用特徴データ';
COMMENT ON COLUMN qr_tokens.token IS 'QRコードに含まれるランダムトークン';
COMMENT ON COLUMN qr_tokens.clock_type IS '打刻種別。NULLの場合は出勤・退勤両方に使用可能';
COMMENT ON COLUMN qr_tokens.used_at IS '使用日時。NULLの場合は未使用';
COMMENT ON COLUMN face_data.descriptor IS '顔特徴ベクトル（128次元のFloat配列）';
COMMENT ON COLUMN face_data.confidence_threshold IS '認証時の閾値（0-1、デフォルト0.85）';
