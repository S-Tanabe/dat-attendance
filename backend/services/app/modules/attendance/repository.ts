/**
 * Attendance Repository
 * 出退勤データのリポジトリ層
 */

import { db } from '../../database';
import type {
  AttendanceRecord,
  AttendanceType,
  AttendanceSource,
  ClockMethod,
  ClockMethodCode,
  DeviceInfo,
  LocationData,
} from './types';

/**
 * 打刻レコード作成パラメータ
 */
interface CreateAttendanceParams {
  user_id: string;
  timestamp: Date;
  type: AttendanceType;
  source: AttendanceSource;
  note?: string;
  clock_method_id?: string;
  verification_data?: Record<string, unknown>;
  device_info?: DeviceInfo;
  location_data?: LocationData;
  created_by?: string;
}

/**
 * 打刻レコード更新パラメータ
 */
interface UpdateAttendanceParams {
  id: string;
  timestamp?: Date;
  type?: AttendanceType;
  note?: string;
  updated_by?: string;
}

/**
 * 打刻レコード検索パラメータ
 */
interface FindAttendanceParams {
  user_id?: string;
  from: Date;
  to: Date;
  type?: AttendanceType;
  limit?: number;
  offset?: number;
}

/**
 * 打刻レコードを作成する
 */
export async function createAttendanceRecord(
  params: CreateAttendanceParams
): Promise<AttendanceRecord> {
  const {
    user_id,
    timestamp,
    type,
    source,
    note,
    clock_method_id,
    verification_data,
    device_info,
    location_data,
    created_by,
  } = params;

  const row = await db.queryRow<AttendanceRecord>`
    INSERT INTO attendance_records (
      user_id,
      timestamp,
      type,
      source,
      note,
      clock_method_id,
      verification_data,
      device_info,
      location_data,
      created_by
    ) VALUES (
      ${user_id},
      ${timestamp},
      ${type},
      ${source},
      ${note ?? null},
      ${clock_method_id ?? null},
      ${JSON.stringify(verification_data ?? {})}::jsonb,
      ${JSON.stringify(device_info ?? {})}::jsonb,
      ${JSON.stringify(location_data ?? {})}::jsonb,
      ${created_by ?? null}
    )
    RETURNING *
  `;

  if (!row) {
    throw new Error('Failed to create attendance record');
  }

  return row;
}

/**
 * 打刻レコードを更新する
 */
export async function updateAttendanceRecord(
  params: UpdateAttendanceParams
): Promise<AttendanceRecord | null> {
  const { id, timestamp, type, note, updated_by } = params;

  const row = await db.queryRow<AttendanceRecord>`
    UPDATE attendance_records
    SET
      timestamp = COALESCE(${timestamp ?? null}, timestamp),
      type = COALESCE(${type ?? null}, type),
      note = COALESCE(${note ?? null}, note),
      updated_by = ${updated_by ?? null},
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return row;
}

/**
 * IDで打刻レコードを取得する
 */
export async function getAttendanceRecordById(id: string): Promise<AttendanceRecord | null> {
  const row = await db.queryRow<AttendanceRecord>`
    SELECT * FROM attendance_records WHERE id = ${id}
  `;
  return row;
}

/**
 * 打刻レコードを検索する
 */
export async function findAttendanceRecords(
  params: FindAttendanceParams
): Promise<{ records: AttendanceRecord[]; total: number }> {
  const { user_id, from, to, type, limit = 100, offset = 0 } = params;

  // 条件に応じたクエリを実行
  let total = 0;
  const records: AttendanceRecord[] = [];

  if (user_id && type) {
    // user_id と type 両方指定
    const countResult = await db.queryRow<{ count: string }>`
      SELECT COUNT(*) as count FROM attendance_records
      WHERE timestamp >= ${from} AND timestamp < ${to}
        AND user_id = ${user_id} AND type = ${type}
    `;
    total = parseInt(countResult?.count ?? '0', 10);

    const recordsGen = db.query<AttendanceRecord>`
      SELECT * FROM attendance_records
      WHERE timestamp >= ${from} AND timestamp < ${to}
        AND user_id = ${user_id} AND type = ${type}
      ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}
    `;
    for await (const record of recordsGen) {
      records.push(record);
    }
  } else if (user_id) {
    // user_id のみ指定
    const countResult = await db.queryRow<{ count: string }>`
      SELECT COUNT(*) as count FROM attendance_records
      WHERE timestamp >= ${from} AND timestamp < ${to}
        AND user_id = ${user_id}
    `;
    total = parseInt(countResult?.count ?? '0', 10);

    const recordsGen = db.query<AttendanceRecord>`
      SELECT * FROM attendance_records
      WHERE timestamp >= ${from} AND timestamp < ${to}
        AND user_id = ${user_id}
      ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}
    `;
    for await (const record of recordsGen) {
      records.push(record);
    }
  } else if (type) {
    // type のみ指定
    const countResult = await db.queryRow<{ count: string }>`
      SELECT COUNT(*) as count FROM attendance_records
      WHERE timestamp >= ${from} AND timestamp < ${to}
        AND type = ${type}
    `;
    total = parseInt(countResult?.count ?? '0', 10);

    const recordsGen = db.query<AttendanceRecord>`
      SELECT * FROM attendance_records
      WHERE timestamp >= ${from} AND timestamp < ${to}
        AND type = ${type}
      ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}
    `;
    for await (const record of recordsGen) {
      records.push(record);
    }
  } else {
    // 条件なし（期間のみ）
    const countResult = await db.queryRow<{ count: string }>`
      SELECT COUNT(*) as count FROM attendance_records
      WHERE timestamp >= ${from} AND timestamp < ${to}
    `;
    total = parseInt(countResult?.count ?? '0', 10);

    const recordsGen = db.query<AttendanceRecord>`
      SELECT * FROM attendance_records
      WHERE timestamp >= ${from} AND timestamp < ${to}
      ORDER BY timestamp DESC LIMIT ${limit} OFFSET ${offset}
    `;
    for await (const record of recordsGen) {
      records.push(record);
    }
  }

  return {
    records,
    total,
  };
}

/**
 * ユーザーの今日の打刻レコードを取得する
 */
export async function getTodayRecords(
  user_id: string,
  timezone: string = 'Asia/Tokyo'
): Promise<AttendanceRecord[]> {
  // タイムゾーンを考慮した「今日」の範囲を計算
  // date_trunc('day', NOW() AT TIME ZONE tz) で指定タイムゾーンの日付開始を取得し、
  // AT TIME ZONE tz でUTCに変換してtimestamp型と比較
  const recordsGen = db.query<AttendanceRecord>`
    SELECT *
    FROM attendance_records
    WHERE user_id = ${user_id}
      AND timestamp >= date_trunc('day', NOW() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone}
      AND timestamp < date_trunc('day', NOW() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone} + INTERVAL '1 day'
    ORDER BY timestamp ASC
  `;

  const records: AttendanceRecord[] = [];
  for await (const record of recordsGen) {
    records.push(record);
  }

  return records;
}

/**
 * ユーザーの最新の打刻レコードを取得する
 */
export async function getLatestRecord(
  user_id: string,
  type?: AttendanceType
): Promise<AttendanceRecord | null> {
  if (type) {
    const row = await db.queryRow<AttendanceRecord>`
      SELECT *
      FROM attendance_records
      WHERE user_id = ${user_id} AND type = ${type}
      ORDER BY timestamp DESC
      LIMIT 1
    `;
    return row;
  }

  const row = await db.queryRow<AttendanceRecord>`
    SELECT *
    FROM attendance_records
    WHERE user_id = ${user_id}
    ORDER BY timestamp DESC
    LIMIT 1
  `;

  return row;
}

/**
 * 打刻方法をコードで取得する
 */
export async function getClockMethodByCode(code: ClockMethodCode): Promise<ClockMethod | null> {
  const row = await db.queryRow<ClockMethod>`
    SELECT * FROM clock_methods WHERE code = ${code} AND is_active = true
  `;
  return row;
}

/**
 * 全ての有効な打刻方法を取得する
 */
export async function getActiveClockMethods(): Promise<ClockMethod[]> {
  const rowsGen = db.query<ClockMethod>`
    SELECT * FROM clock_methods WHERE is_active = true ORDER BY code
  `;

  const methods: ClockMethod[] = [];
  for await (const row of rowsGen) {
    methods.push(row);
  }

  return methods;
}

/**
 * 打刻方法の有効/無効を切り替える
 */
export async function setClockMethodActive(
  code: ClockMethodCode,
  is_active: boolean
): Promise<ClockMethod | null> {
  const row = await db.queryRow<ClockMethod>`
    UPDATE clock_methods
    SET is_active = ${is_active}, updated_at = NOW()
    WHERE code = ${code}
    RETURNING *
  `;
  return row;
}

// =====================================================
// QR Token Repository
// =====================================================

/**
 * QRトークン
 */
export interface QRToken {
  id: string;
  user_id: string;
  token: string;
  token_type: string;
  clock_type: 'CLOCK_IN' | 'CLOCK_OUT' | null;
  expires_at: Date;
  used_at: Date | null;
  used_by: string | null;
  device_info: DeviceInfo;
  created_at: Date;
  updated_at: Date;
}

/**
 * QRトークン作成パラメータ
 */
interface CreateQRTokenParams {
  user_id: string;
  token: string;
  token_type?: string;
  clock_type?: 'CLOCK_IN' | 'CLOCK_OUT' | null;
  expires_at: Date;
  device_info?: DeviceInfo;
}

/**
 * QRトークンを作成する
 */
export async function createQRToken(params: CreateQRTokenParams): Promise<QRToken> {
  const {
    user_id,
    token,
    token_type = 'clock',
    clock_type = null,
    expires_at,
    device_info,
  } = params;

  const row = await db.queryRow<QRToken>`
    INSERT INTO qr_tokens (
      user_id, token, token_type, clock_type, expires_at, device_info
    ) VALUES (
      ${user_id},
      ${token},
      ${token_type},
      ${clock_type},
      ${expires_at},
      ${JSON.stringify(device_info ?? {})}::jsonb
    )
    RETURNING *
  `;

  if (!row) {
    throw new Error('Failed to create QR token');
  }

  return row;
}

/**
 * トークン文字列でQRトークンを取得する
 */
export async function getQRTokenByToken(token: string): Promise<QRToken | null> {
  const row = await db.queryRow<QRToken>`
    SELECT * FROM qr_tokens WHERE token = ${token}
  `;
  return row;
}

/**
 * ユーザーの有効なQRトークンを取得する
 */
export async function getActiveQRTokenForUser(
  user_id: string,
  clock_type?: 'CLOCK_IN' | 'CLOCK_OUT' | null
): Promise<QRToken | null> {
  if (clock_type) {
    const row = await db.queryRow<QRToken>`
      SELECT * FROM qr_tokens
      WHERE user_id = ${user_id}
        AND expires_at > NOW()
        AND used_at IS NULL
        AND (clock_type = ${clock_type} OR clock_type IS NULL)
      ORDER BY created_at DESC
      LIMIT 1
    `;
    return row;
  }

  const row = await db.queryRow<QRToken>`
    SELECT * FROM qr_tokens
    WHERE user_id = ${user_id}
      AND expires_at > NOW()
      AND used_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return row;
}

/**
 * QRトークンを使用済みにする
 */
export async function markQRTokenAsUsed(
  token: string,
  used_by: string
): Promise<QRToken | null> {
  const row = await db.queryRow<QRToken>`
    UPDATE qr_tokens
    SET used_at = NOW(), used_by = ${used_by}, updated_at = NOW()
    WHERE token = ${token}
      AND expires_at > NOW()
      AND used_at IS NULL
    RETURNING *
  `;
  return row;
}

/**
 * 期限切れのQRトークンを削除する（クリーンアップ用）
 */
export async function deleteExpiredQRTokens(): Promise<number> {
  const result = await db.queryRow<{ count: string }>`
    WITH deleted AS (
      DELETE FROM qr_tokens
      WHERE expires_at < NOW() - INTERVAL '1 day'
      RETURNING *
    )
    SELECT COUNT(*) as count FROM deleted
  `;
  return parseInt(result?.count ?? '0', 10);
}

// =====================================================
// Face Data Repository
// =====================================================

/**
 * 顔データ
 */
export interface FaceData {
  id: string;
  user_id: string;
  descriptor: number[];
  label: string | null;
  is_primary: boolean;
  confidence_threshold: number;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

/**
 * 顔データ作成パラメータ
 */
interface CreateFaceDataParams {
  user_id: string;
  descriptor: number[];
  label?: string;
  is_primary?: boolean;
  confidence_threshold?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 顔データを作成する
 */
export async function createFaceData(params: CreateFaceDataParams): Promise<FaceData> {
  const {
    user_id,
    descriptor,
    label,
    is_primary = true,
    confidence_threshold = 0.85,
    metadata,
  } = params;

  // プライマリの場合、既存のプライマリを解除
  if (is_primary) {
    await db.exec`
      UPDATE face_data
      SET is_primary = false, updated_at = NOW()
      WHERE user_id = ${user_id} AND is_primary = true
    `;
  }

  // Encoreのテンプレートリテラルでは、JSON.stringifyした文字列を直接使用
  // descriptorは数値配列なので、そのままJSON形式の文字列として渡す
  const descriptorJson = JSON.stringify(descriptor);
  const metadataJson = JSON.stringify(metadata ?? {});

  const row = await db.queryRow<FaceData>`
    INSERT INTO face_data (
      user_id, descriptor, label, is_primary, confidence_threshold, metadata
    ) VALUES (
      ${user_id},
      ${descriptorJson}::jsonb,
      ${label ?? null},
      ${is_primary},
      ${confidence_threshold},
      ${metadataJson}::jsonb
    )
    RETURNING *
  `;

  if (!row) {
    throw new Error('Failed to create face data');
  }

  return row;
}

/**
 * ユーザーのプライマリ顔データを取得する
 */
export async function getPrimaryFaceData(user_id: string): Promise<FaceData | null> {
  const row = await db.queryRow<FaceData>`
    SELECT * FROM face_data
    WHERE user_id = ${user_id} AND is_primary = true
  `;
  return row;
}

/**
 * ユーザーの全ての顔データを取得する
 */
export async function getAllFaceDataForUser(user_id: string): Promise<FaceData[]> {
  const rowsGen = db.query<FaceData>`
    SELECT * FROM face_data WHERE user_id = ${user_id} ORDER BY is_primary DESC, created_at DESC
  `;

  const data: FaceData[] = [];
  for await (const row of rowsGen) {
    data.push(row);
  }
  return data;
}

/**
 * 顔データを削除する
 */
export async function deleteFaceData(id: string, user_id: string): Promise<boolean> {
  const result = await db.queryRow<{ id: string }>`
    DELETE FROM face_data WHERE id = ${id} AND user_id = ${user_id} RETURNING id
  `;
  return !!result;
}

/**
 * ユーザーの顔データが登録されているか確認する
 */
export async function hasFaceData(user_id: string): Promise<boolean> {
  const row = await db.queryRow<{ count: string }>`
    SELECT COUNT(*) as count FROM face_data WHERE user_id = ${user_id}
  `;
  return parseInt(row?.count ?? '0', 10) > 0;
}

/**
 * 全ユーザーのプライマリ顔データを取得する（キオスク端末用）
 */
export async function getAllPrimaryFaceData(): Promise<FaceData[]> {
  const rowsGen = db.query<FaceData>`
    SELECT * FROM face_data WHERE is_primary = true ORDER BY created_at DESC
  `;

  const data: FaceData[] = [];
  for await (const row of rowsGen) {
    data.push(row);
  }
  return data;
}

// =====================================================
// Attendance Summary Repository
// =====================================================

/**
 * 指定期間のユーザーの勤怠サマリーを取得
 */
export interface MonthlyAttendanceSummary {
  user_id: string;
  total_minutes: number;
  working_days: number;
}

export async function getMonthlyAttendanceSummary(
  user_id: string,
  year: number,
  month: number,
  timezone: string = 'Asia/Tokyo'
): Promise<MonthlyAttendanceSummary> {
  // 月の開始と終了を計算
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  // 日別の勤務時間を集計
  const row = await db.queryRow<{ total_minutes: string; working_days: string }>`
    WITH daily_work AS (
      SELECT
        (timestamp AT TIME ZONE ${timezone})::date as work_date,
        MIN(CASE WHEN type = 'CLOCK_IN' THEN timestamp END) as first_clock_in,
        MAX(CASE WHEN type = 'CLOCK_OUT' THEN timestamp END) as last_clock_out
      FROM attendance_records
      WHERE user_id = ${user_id}
        AND timestamp >= ${startDate}::date AT TIME ZONE ${timezone}
        AND timestamp < ${endDate}::date AT TIME ZONE ${timezone}
        AND type IN ('CLOCK_IN', 'CLOCK_OUT')
      GROUP BY work_date
    )
    SELECT
      COALESCE(SUM(
        CASE
          WHEN first_clock_in IS NOT NULL AND last_clock_out IS NOT NULL
          THEN EXTRACT(EPOCH FROM (last_clock_out - first_clock_in)) / 60
          ELSE 0
        END
      ), 0)::integer as total_minutes,
      COUNT(DISTINCT CASE WHEN first_clock_in IS NOT NULL THEN work_date END)::integer as working_days
    FROM daily_work
  `;

  return {
    user_id,
    total_minutes: parseInt(row?.total_minutes ?? '0', 10),
    working_days: parseInt(row?.working_days ?? '0', 10),
  };
}

/**
 * 指定期間の日別勤怠データを取得
 */
export interface DailyAttendanceData {
  date: string;
  clock_in: Date | null;
  clock_out: Date | null;
  working_minutes: number;
}

export async function getDailyAttendanceData(
  user_id: string,
  year: number,
  month: number,
  timezone: string = 'Asia/Tokyo'
): Promise<DailyAttendanceData[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const rowsGen = db.query<{
    work_date: string;
    first_clock_in: Date | null;
    last_clock_out: Date | null;
    working_minutes: string;
  }>`
    WITH daily_records AS (
      SELECT
        to_char((timestamp AT TIME ZONE ${timezone})::date, 'YYYY-MM-DD') as work_date,
        type,
        timestamp as record_ts
      FROM attendance_records
      WHERE user_id = ${user_id}
        AND timestamp >= ${startDate}::date AT TIME ZONE ${timezone}
        AND timestamp < ${endDate}::date AT TIME ZONE ${timezone}
        AND type IN ('CLOCK_IN', 'CLOCK_OUT')
    )
    SELECT
      work_date,
      MIN(CASE WHEN type = 'CLOCK_IN' THEN record_ts END) as first_clock_in,
      MAX(CASE WHEN type = 'CLOCK_OUT' THEN record_ts END) as last_clock_out,
      COALESCE(
        EXTRACT(EPOCH FROM (
          MAX(CASE WHEN type = 'CLOCK_OUT' THEN record_ts END) -
          MIN(CASE WHEN type = 'CLOCK_IN' THEN record_ts END)
        )) / 60,
        0
      )::integer as working_minutes
    FROM daily_records
    GROUP BY work_date
    ORDER BY work_date
  `;

  const results: DailyAttendanceData[] = [];
  for await (const row of rowsGen) {
    results.push({
      date: row.work_date,
      clock_in: row.first_clock_in,
      clock_out: row.last_clock_out,
      working_minutes: parseInt(row.working_minutes, 10),
    });
  }

  return results;
}

/**
 * 指定期間の全打刻レコードを取得（ユーザー指定）
 */
export async function getRecordsForPeriod(
  user_id: string,
  year: number,
  month: number,
  timezone: string = 'Asia/Tokyo'
): Promise<AttendanceRecord[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const rowsGen = db.query<AttendanceRecord>`
    SELECT *
    FROM attendance_records
    WHERE user_id = ${user_id}
      AND timestamp >= ${startDate}::date AT TIME ZONE ${timezone}
      AND timestamp < ${endDate}::date AT TIME ZONE ${timezone}
    ORDER BY timestamp ASC
  `;

  const records: AttendanceRecord[] = [];
  for await (const row of rowsGen) {
    records.push(row);
  }

  return records;
}
