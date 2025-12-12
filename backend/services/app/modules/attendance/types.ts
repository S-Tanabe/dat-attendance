/**
 * Attendance Types
 * 出退勤機能の型定義
 */

/**
 * 打刻種別
 */
export const AttendanceTypeEnum = {
  CLOCK_IN: 'CLOCK_IN',
  CLOCK_OUT: 'CLOCK_OUT',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;

export type AttendanceType = (typeof AttendanceTypeEnum)[keyof typeof AttendanceTypeEnum];

/**
 * 打刻登録元
 */
export const AttendanceSourceEnum = {
  USER: 'USER',      // ユーザー自身による打刻
  ADMIN: 'ADMIN',    // 管理者による代理打刻/修正
  SYSTEM: 'SYSTEM',  // システムによる自動打刻
} as const;

export type AttendanceSource = (typeof AttendanceSourceEnum)[keyof typeof AttendanceSourceEnum];

/**
 * 打刻方法コード
 */
export const ClockMethodCodeEnum = {
  BUTTON: 'button',
  QR_CODE: 'qr_code',
  FACE_RECOGNITION: 'face_recognition',
  NFC: 'nfc',
  GPS: 'gps',
} as const;

export type ClockMethodCode = (typeof ClockMethodCodeEnum)[keyof typeof ClockMethodCodeEnum];

/**
 * 打刻方法マスタ
 */
export interface ClockMethod {
  id: string;
  code: ClockMethodCode;
  name: string;
  description: string | null;
  is_active: boolean;
  config: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

/**
 * 出退勤レコード
 */
export interface AttendanceRecord {
  id: string;
  user_id: string;
  timestamp: Date;
  type: AttendanceType;
  note: string | null;
  source: AttendanceSource;
  clock_method_id: string | null;
  verification_data: Record<string, unknown>;
  device_info: DeviceInfo;
  location_data: LocationData;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

/**
 * デバイス情報
 */
export interface DeviceInfo {
  ip?: string;
  user_agent?: string;
  browser?: string;
  os?: string;
  device_type?: 'desktop' | 'mobile' | 'tablet';
}

/**
 * 位置情報
 */
export interface LocationData {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  address?: string;
  timestamp?: string;
}

/**
 * 打刻リクエスト（共通）
 */
export interface ClockRequest {
  timestamp?: string;          // カスタム打刻時刻（省略時はサーバー時刻）
  clock_method_code?: ClockMethodCode;  // 打刻方法
  verification_data?: Record<string, unknown>;  // 認証データ
  device_info?: DeviceInfo;    // デバイス情報
  location_data?: LocationData; // 位置情報
  note?: string;               // メモ
}

/**
 * 打刻レスポンス
 */
export interface ClockResponse {
  record: AttendanceRecord;
  clock_method: ClockMethod | null;
}

/**
 * 今日の打刻状態
 */
export interface TodayStatus {
  user_id: string;
  date: string;  // YYYY-MM-DD形式
  status: 'NOT_CLOCKED_IN' | 'WORKING' | 'CLOCKED_OUT';
  clock_in_record: AttendanceRecord | null;
  clock_out_record: AttendanceRecord | null;
  records: AttendanceRecord[];
}

/**
 * 打刻履歴取得パラメータ
 */
export interface GetAttendanceParams {
  user_id?: string;  // 指定しない場合は自分
  from: string;      // YYYY-MM-DD
  to: string;        // YYYY-MM-DD
  type?: AttendanceType;
  limit?: number;
  offset?: number;
}

/**
 * 打刻履歴レスポンス
 */
export interface AttendanceListResponse {
  records: AttendanceRecord[];
  total: number;
  from: string;
  to: string;
}

/**
 * 管理者による打刻修正リクエスト
 */
export interface UpdateAttendanceRequest {
  id: string;
  timestamp?: string;
  type?: AttendanceType;
  note?: string;
}

// =====================================================
// QR Code Types
// =====================================================

/**
 * QRトークン生成リクエスト
 */
export interface GenerateQRTokenRequest {
  clock_type?: 'CLOCK_IN' | 'CLOCK_OUT';  // 省略時は両方に使用可能
  ttl_seconds?: number;                    // 有効期限秒数（デフォルト: 300秒 = 5分）
}

/**
 * QRトークン生成レスポンス
 */
export interface GenerateQRTokenResponse {
  token: string;
  qr_data: string;                         // QRコードに埋め込むJSONデータ
  expires_at: string;                      // ISO形式
  clock_type: 'CLOCK_IN' | 'CLOCK_OUT' | null;
}

/**
 * QRトークン検証リクエスト（管理者/受付用）
 */
export interface VerifyQRTokenRequest {
  token: string;
  clock_type: 'CLOCK_IN' | 'CLOCK_OUT';    // どの打刻として承認するか
}

/**
 * QRトークン検証レスポンス
 */
export interface VerifyQRTokenResponse {
  success: boolean;
  user_id?: string;
  user_name?: string;
  clock_type?: 'CLOCK_IN' | 'CLOCK_OUT';
  record?: AttendanceRecord;
  error?: string;
}

// =====================================================
// Face Recognition Types
// =====================================================

/**
 * 顔データ登録リクエスト
 */
export interface RegisterFaceRequest {
  descriptor: number[];                    // 128次元の顔特徴ベクトル
  label?: string;                          // ラベル（任意）
}

/**
 * 顔データ登録レスポンス
 */
export interface RegisterFaceResponse {
  id: string;
  user_id: string;
  is_primary: boolean;
  created_at: string;
}

/**
 * 顔認証リクエスト
 */
export interface VerifyFaceRequest {
  descriptor: number[];                    // 認証時の顔特徴ベクトル
  clock_type: 'CLOCK_IN' | 'CLOCK_OUT';
  liveness_check?: boolean;                // 生体検知を行ったか
}

/**
 * 顔認証レスポンス
 */
export interface VerifyFaceResponse {
  success: boolean;
  confidence?: number;                     // 一致度（0-1）
  record?: AttendanceRecord;
  error?: string;
}

/**
 * 顔データ状態レスポンス
 */
export interface FaceDataStatusResponse {
  has_face_data: boolean;
  face_count: number;
}
