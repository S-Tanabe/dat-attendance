/**
 * Attendance Service
 * 出退勤のビジネスロジック層
 */

import { APIError } from 'encore.dev/api';
import type {
  AttendanceRecord,
  AttendanceType,
  AttendanceSource,
  ClockMethodCode,
  ClockRequest,
  ClockResponse,
  TodayStatus,
  GetAttendanceParams,
  AttendanceListResponse,
  UpdateAttendanceRequest,
  ClockMethod,
} from './types';
import { AttendanceTypeEnum as AT, AttendanceSourceEnum as AS } from './types';
import * as repository from './repository';
import { getClockMethod, type ClockContext } from './clock-methods';

/**
 * 出勤打刻を行う
 */
export async function clockIn(
  user_id: string,
  request: ClockRequest,
  source: AttendanceSource = AS.USER,
  created_by?: string
): Promise<ClockResponse> {
  // 今日の打刻状態を確認
  const todayStatus = await getTodayStatus(user_id);

  // 既に出勤済みかチェック
  if (todayStatus.status === 'WORKING') {
    throw APIError.failedPrecondition(
      '既に出勤済みです。退勤打刻を行うか、管理者に連絡してください。'
    );
  }

  // 打刻方法の検証
  const clockMethod = getClockMethod(request.clock_method_code);
  const context: ClockContext = {
    user_id,
    request,
    device_info: request.device_info,
    location_data: request.location_data,
  };

  // 打刻方法が利用可能かチェック
  if (!(await clockMethod.isAvailable(context))) {
    throw APIError.failedPrecondition(
      `打刻方法「${clockMethod.name}」は現在利用できません。`
    );
  }

  // 打刻を検証
  const verificationResult = await clockMethod.verify(context);
  if (!verificationResult.success) {
    throw APIError.invalidArgument(
      verificationResult.error_message ?? '打刻の検証に失敗しました'
    );
  }

  // 打刻方法をDBから取得
  let clockMethodRecord: ClockMethod | null = null;
  if (request.clock_method_code) {
    clockMethodRecord = await repository.getClockMethodByCode(request.clock_method_code);
  }

  // 打刻レコードを作成
  const timestamp = request.timestamp ? new Date(request.timestamp) : new Date();
  const record = await repository.createAttendanceRecord({
    user_id,
    timestamp,
    type: AT.CLOCK_IN,
    source,
    note: request.note,
    clock_method_id: clockMethodRecord?.id,
    verification_data: verificationResult.verification_data,
    device_info: request.device_info,
    location_data: request.location_data,
    created_by,
  });

  return {
    record,
    clock_method: clockMethodRecord,
  };
}

/**
 * 退勤打刻を行う
 */
export async function clockOut(
  user_id: string,
  request: ClockRequest,
  source: AttendanceSource = AS.USER,
  created_by?: string
): Promise<ClockResponse> {
  // 今日の打刻状態を確認
  const todayStatus = await getTodayStatus(user_id);

  // 出勤していないかチェック
  if (todayStatus.status === 'NOT_CLOCKED_IN') {
    throw APIError.failedPrecondition(
      '出勤打刻がありません。先に出勤打刻を行ってください。'
    );
  }

  // 既に退勤済みかチェック
  if (todayStatus.status === 'CLOCKED_OUT') {
    throw APIError.failedPrecondition(
      '既に退勤済みです。管理者に連絡してください。'
    );
  }

  // 打刻方法の検証
  const clockMethod = getClockMethod(request.clock_method_code);
  const context: ClockContext = {
    user_id,
    request,
    device_info: request.device_info,
    location_data: request.location_data,
  };

  // 打刻方法が利用可能かチェック
  if (!(await clockMethod.isAvailable(context))) {
    throw APIError.failedPrecondition(
      `打刻方法「${clockMethod.name}」は現在利用できません。`
    );
  }

  // 打刻を検証
  const verificationResult = await clockMethod.verify(context);
  if (!verificationResult.success) {
    throw APIError.invalidArgument(
      verificationResult.error_message ?? '打刻の検証に失敗しました'
    );
  }

  // 打刻方法をDBから取得
  let clockMethodRecord: ClockMethod | null = null;
  if (request.clock_method_code) {
    clockMethodRecord = await repository.getClockMethodByCode(request.clock_method_code);
  }

  // 打刻レコードを作成
  const timestamp = request.timestamp ? new Date(request.timestamp) : new Date();
  const record = await repository.createAttendanceRecord({
    user_id,
    timestamp,
    type: AT.CLOCK_OUT,
    source,
    note: request.note,
    clock_method_id: clockMethodRecord?.id,
    verification_data: verificationResult.verification_data,
    device_info: request.device_info,
    location_data: request.location_data,
    created_by,
  });

  return {
    record,
    clock_method: clockMethodRecord,
  };
}

/**
 * 今日の打刻状態を取得する
 */
export async function getTodayStatus(
  user_id: string,
  timezone: string = 'Asia/Tokyo'
): Promise<TodayStatus> {
  const records = await repository.getTodayRecords(user_id, timezone);

  // 今日の日付を取得
  const now = new Date();
  const dateStr = now.toLocaleDateString('ja-JP', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\//g, '-');

  // 出勤・退勤レコードを抽出（ADJUSTMENT以外）
  const clockInRecords = records.filter(r => r.type === AT.CLOCK_IN);
  const clockOutRecords = records.filter(r => r.type === AT.CLOCK_OUT);

  // 最新の出勤・退勤レコードを取得
  const latestClockIn = clockInRecords.length > 0
    ? clockInRecords[clockInRecords.length - 1]
    : null;
  const latestClockOut = clockOutRecords.length > 0
    ? clockOutRecords[clockOutRecords.length - 1]
    : null;

  // ステータスを判定
  let status: TodayStatus['status'];
  if (!latestClockIn) {
    status = 'NOT_CLOCKED_IN';
  } else if (!latestClockOut) {
    status = 'WORKING';
  } else {
    // 最後の打刻が出勤なら勤務中、退勤なら退勤済み
    const lastRecord = records[records.length - 1];
    status = lastRecord?.type === AT.CLOCK_OUT ? 'CLOCKED_OUT' : 'WORKING';
  }

  return {
    user_id,
    date: dateStr,
    status,
    clock_in_record: latestClockIn,
    clock_out_record: latestClockOut,
    records,
  };
}

/**
 * 打刻履歴を取得する
 */
export async function getAttendanceHistory(
  params: GetAttendanceParams
): Promise<AttendanceListResponse> {
  const from = new Date(params.from);
  const to = new Date(params.to);
  // toを翌日の0:00にして、その日を含める
  to.setDate(to.getDate() + 1);

  const { records, total } = await repository.findAttendanceRecords({
    user_id: params.user_id,
    from,
    to,
    type: params.type,
    limit: params.limit,
    offset: params.offset,
  });

  return {
    records,
    total,
    from: params.from,
    to: params.to,
  };
}

/**
 * 管理者による打刻修正
 */
export async function updateAttendance(
  request: UpdateAttendanceRequest,
  admin_user_id: string
): Promise<AttendanceRecord> {
  // 既存レコードを取得
  const existingRecord = await repository.getAttendanceRecordById(request.id);
  if (!existingRecord) {
    throw APIError.notFound('打刻レコードが見つかりません');
  }

  // 更新
  const updated = await repository.updateAttendanceRecord({
    id: request.id,
    timestamp: request.timestamp ? new Date(request.timestamp) : undefined,
    type: request.type,
    note: request.note,
    updated_by: admin_user_id,
  });

  if (!updated) {
    throw APIError.internal('打刻レコードの更新に失敗しました');
  }

  return updated;
}

/**
 * 管理者による代理打刻
 */
export async function adminClock(
  target_user_id: string,
  type: AttendanceType,
  request: ClockRequest,
  admin_user_id: string
): Promise<ClockResponse> {
  if (type === AT.CLOCK_IN) {
    return clockIn(target_user_id, request, AS.ADMIN, admin_user_id);
  } else if (type === AT.CLOCK_OUT) {
    return clockOut(target_user_id, request, AS.ADMIN, admin_user_id);
  } else {
    // ADJUSTMENT: 調整打刻
    const timestamp = request.timestamp ? new Date(request.timestamp) : new Date();
    const record = await repository.createAttendanceRecord({
      user_id: target_user_id,
      timestamp,
      type: AT.ADJUSTMENT,
      source: AS.ADMIN,
      note: request.note ?? '管理者による調整',
      device_info: request.device_info,
      location_data: request.location_data,
      created_by: admin_user_id,
    });

    return {
      record,
      clock_method: null,
    };
  }
}

/**
 * 有効な打刻方法一覧を取得する
 */
export async function getActiveClockMethods(): Promise<ClockMethod[]> {
  return repository.getActiveClockMethods();
}

/**
 * 打刻方法の有効/無効を切り替える（管理者用）
 */
export async function toggleClockMethod(
  code: ClockMethodCode,
  is_active: boolean
): Promise<ClockMethod> {
  const updated = await repository.setClockMethodActive(code, is_active);
  if (!updated) {
    throw APIError.notFound('打刻方法が見つかりません');
  }
  return updated;
}

// =====================================================
// QR Token Service
// =====================================================

import type {
  GenerateQRTokenRequest,
  GenerateQRTokenResponse,
  VerifyQRTokenRequest,
  VerifyQRTokenResponse,
} from './types';
import { ClockMethodCodeEnum } from './types';
import * as crypto from 'crypto';

/** デフォルトのトークン有効期限（秒） */
const DEFAULT_QR_TOKEN_TTL = 300; // 5分

/**
 * QRトークンを生成する（ユーザー用）
 */
export async function generateQRToken(
  user_id: string,
  request: GenerateQRTokenRequest,
  device_info?: Record<string, unknown>
): Promise<GenerateQRTokenResponse> {
  const ttl = request.ttl_seconds ?? DEFAULT_QR_TOKEN_TTL;
  const expiresAt = new Date(Date.now() + ttl * 1000);

  // セキュアなランダムトークンを生成
  const token = crypto.randomBytes(32).toString('hex');

  // DBに保存
  await repository.createQRToken({
    user_id,
    token,
    token_type: 'clock',
    clock_type: request.clock_type ?? null,
    expires_at: expiresAt,
    device_info: device_info as repository.QRToken['device_info'],
  });

  // QRコードに埋め込むデータ
  const qrData = JSON.stringify({
    type: 'attendance_qr',
    token,
    clock_type: request.clock_type ?? null,
    expires_at: expiresAt.toISOString(),
  });

  return {
    token,
    qr_data: qrData,
    expires_at: expiresAt.toISOString(),
    clock_type: request.clock_type ?? null,
  };
}

/**
 * QRトークンを検証して打刻を行う（管理者/受付用）
 */
export async function verifyQRTokenAndClock(
  request: VerifyQRTokenRequest,
  verified_by: string
): Promise<VerifyQRTokenResponse> {
  // トークンを取得
  const qrToken = await repository.getQRTokenByToken(request.token);

  if (!qrToken) {
    return {
      success: false,
      error: 'QRコードが見つかりません',
    };
  }

  // 有効期限チェック
  if (new Date() > new Date(qrToken.expires_at)) {
    return {
      success: false,
      error: 'QRコードの有効期限が切れています',
    };
  }

  // 使用済みチェック
  if (qrToken.used_at) {
    return {
      success: false,
      error: 'このQRコードは既に使用されています',
    };
  }

  // 打刻種別チェック
  if (qrToken.clock_type && qrToken.clock_type !== request.clock_type) {
    return {
      success: false,
      error: `このQRコードは${qrToken.clock_type === 'CLOCK_IN' ? '出勤' : '退勤'}専用です`,
    };
  }

  // トークンを使用済みにマーク
  const usedToken = await repository.markQRTokenAsUsed(request.token, verified_by);
  if (!usedToken) {
    return {
      success: false,
      error: 'QRコードの検証に失敗しました',
    };
  }

  // 打刻を実行
  try {
    const clockRequest: ClockRequest = {
      clock_method_code: ClockMethodCodeEnum.QR_CODE,
      verification_data: {
        qr_token: request.token,
        verified_by,
        verified_at: new Date().toISOString(),
      },
    };

    let record: AttendanceRecord;
    if (request.clock_type === 'CLOCK_IN') {
      const response = await clockIn(qrToken.user_id, clockRequest);
      record = response.record;
    } else {
      const response = await clockOut(qrToken.user_id, clockRequest);
      record = response.record;
    }

    return {
      success: true,
      user_id: qrToken.user_id,
      clock_type: request.clock_type,
      record,
    };
  } catch (error) {
    return {
      success: false,
      user_id: qrToken.user_id,
      error: error instanceof Error ? error.message : '打刻に失敗しました',
    };
  }
}

/**
 * ユーザーの有効なQRトークンを取得する
 */
export async function getActiveQRToken(
  user_id: string,
  clock_type?: 'CLOCK_IN' | 'CLOCK_OUT'
): Promise<repository.QRToken | null> {
  return repository.getActiveQRTokenForUser(user_id, clock_type);
}

// =====================================================
// Face Recognition Service
// =====================================================

import type {
  RegisterFaceRequest,
  RegisterFaceResponse,
  VerifyFaceRequest,
  VerifyFaceResponse,
  FaceDataStatusResponse,
} from './types';

/** 顔認証の最低信頼度スコア（デモ用に一時的に50%に設定） */
const MIN_CONFIDENCE_SCORE = 0.50;

/**
 * JSONBから取得したdescriptorをnumber[]にパースする
 * PostgreSQLのJSONBは文字列として返される場合があり、
 * また二重エンコードされている場合もあるため、適切にパースする
 */
function parseDescriptor(descriptor: number[] | string): number[] {
  let parsed: unknown = descriptor;
  // 文字列の場合は配列になるまでパースを繰り返す
  while (typeof parsed === 'string') {
    parsed = JSON.parse(parsed) as unknown;
  }
  if (!Array.isArray(parsed)) {
    throw new Error('descriptorが配列ではありません');
  }
  return parsed as number[];
}

/**
 * ユークリッド距離を計算する
 */
function calculateEuclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('ベクトルの長さが一致しません');
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

/**
 * 距離を信頼度スコアに変換する（face-api.js互換）
 */
function distanceToConfidence(distance: number): number {
  // face-api.jsでは距離0.6以下を同一人物とする
  // 距離0を信頼度1、距離0.6を信頼度0.7として変換
  return Math.max(0, 1 - distance);
}

/**
 * 顔データを登録する
 */
export async function registerFace(
  user_id: string,
  request: RegisterFaceRequest
): Promise<RegisterFaceResponse> {
  // ベクトルの長さを検証（face-api.jsは128次元）
  if (!request.descriptor || request.descriptor.length !== 128) {
    throw APIError.invalidArgument('顔特徴ベクトルは128次元である必要があります');
  }

  const faceData = await repository.createFaceData({
    user_id,
    descriptor: request.descriptor,
    label: request.label,
    is_primary: true,
    confidence_threshold: MIN_CONFIDENCE_SCORE,
  });

  return {
    id: faceData.id,
    user_id: faceData.user_id,
    is_primary: faceData.is_primary,
    created_at: faceData.created_at.toISOString(),
  };
}

/**
 * 顔認証を行い打刻する
 */
export async function verifyFaceAndClock(
  user_id: string,
  request: VerifyFaceRequest
): Promise<VerifyFaceResponse> {
  // ベクトルの長さを検証
  if (!request.descriptor || request.descriptor.length !== 128) {
    return {
      success: false,
      error: '顔特徴ベクトルが不正です',
    };
  }

  // ユーザーの登録済み顔データを取得
  const registeredFace = await repository.getPrimaryFaceData(user_id);
  if (!registeredFace) {
    return {
      success: false,
      error: '顔データが登録されていません。先に顔データを登録してください。',
    };
  }

  // PostgreSQLのJSONBカラムは文字列として返される場合があるため、パースが必要
  // また、二重エンコードされている場合は二重にパースする
  let registeredDescriptor: number[];
  try {
    registeredDescriptor = parseDescriptor(registeredFace.descriptor);
  } catch {
    return {
      success: false,
      error: '登録済み顔データの形式が不正です',
    };
  }

  // 類似度を計算
  const distance = calculateEuclideanDistance(
    request.descriptor,
    registeredDescriptor
  );
  const confidence = distanceToConfidence(distance);

  // 信頼度チェック（デモ用: DBの閾値を無視して常にMIN_CONFIDENCE_SCOREを使用）
  const threshold = MIN_CONFIDENCE_SCORE;
  if (confidence < threshold) {
    return {
      success: false,
      confidence,
      error: `顔認証に失敗しました（一致度: ${Math.round(confidence * 100)}%）`,
    };
  }

  // 打刻を実行
  try {
    const clockRequest: ClockRequest = {
      clock_method_code: ClockMethodCodeEnum.FACE_RECOGNITION,
      verification_data: {
        face_data_id: registeredFace.id,
        confidence,
        liveness_check: request.liveness_check ?? false,
        verified_at: new Date().toISOString(),
      },
    };

    let record: AttendanceRecord;
    if (request.clock_type === 'CLOCK_IN') {
      const response = await clockIn(user_id, clockRequest);
      record = response.record;
    } else {
      const response = await clockOut(user_id, clockRequest);
      record = response.record;
    }

    return {
      success: true,
      confidence,
      record,
    };
  } catch (error) {
    return {
      success: false,
      confidence,
      error: error instanceof Error ? error.message : '打刻に失敗しました',
    };
  }
}

/**
 * ユーザーの顔データ状態を取得する
 */
export async function getFaceDataStatus(user_id: string): Promise<FaceDataStatusResponse> {
  const faceDataList = await repository.getAllFaceDataForUser(user_id);
  return {
    has_face_data: faceDataList.length > 0,
    face_count: faceDataList.length,
  };
}

/**
 * 顔データを削除する
 */
export async function deleteFaceData(user_id: string, face_id: string): Promise<boolean> {
  return repository.deleteFaceData(face_id, user_id);
}

/**
 * キオスク端末用：顔認証を行い打刻する（全ユーザーから検索）
 */
export interface PublicVerifyFaceRequest {
  descriptor: number[];
  clock_type: 'CLOCK_IN' | 'CLOCK_OUT';
  liveness_check?: boolean;
}

export interface PublicVerifyFaceResponse {
  success: boolean;
  user_name?: string;
  confidence?: number;
  record?: AttendanceRecord;
  error?: string;
}

export async function publicVerifyFaceAndClock(
  request: PublicVerifyFaceRequest
): Promise<PublicVerifyFaceResponse> {
  // ベクトルの長さを検証
  if (!request.descriptor || request.descriptor.length !== 128) {
    return {
      success: false,
      error: '顔特徴ベクトルが不正です',
    };
  }

  // 全ユーザーの登録済み顔データを取得
  const allFaceData = await repository.getAllPrimaryFaceData();
  if (allFaceData.length === 0) {
    return {
      success: false,
      error: '登録済みの顔データがありません',
    };
  }

  // 最も一致度の高いユーザーを検索
  let bestMatch: { user_id: string; face_data_id: string; confidence: number; threshold: number } | null = null;

  for (const faceData of allFaceData) {
    let registeredDescriptor: number[];
    try {
      registeredDescriptor = parseDescriptor(faceData.descriptor);
    } catch {
      continue; // 不正なデータはスキップ
    }

    const distance = calculateEuclideanDistance(
      request.descriptor,
      registeredDescriptor
    );
    const confidence = distanceToConfidence(distance);
    // デモ用: DBの閾値を無視して常にMIN_CONFIDENCE_SCOREを使用
    const threshold = MIN_CONFIDENCE_SCORE;

    if (confidence >= threshold) {
      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = {
          user_id: faceData.user_id,
          face_data_id: faceData.id,
          confidence,
          threshold,
        };
      }
    }
  }

  if (!bestMatch) {
    return {
      success: false,
      error: '顔認証に失敗しました。登録された顔と一致しませんでした。',
    };
  }

  // ユーザー名を取得
  let userName = 'ユーザー';
  try {
    const userResponse = await app.get_user_detail({ userId: bestMatch.user_id });
    userName = userResponse.user.display_name || userResponse.user.email.split('@')[0];
  } catch {
    // ユーザー情報取得に失敗しても続行
  }

  // 打刻を実行
  try {
    const clockRequest: ClockRequest = {
      clock_method_code: ClockMethodCodeEnum.FACE_RECOGNITION,
      verification_data: {
        face_data_id: bestMatch.face_data_id,
        confidence: bestMatch.confidence,
        liveness_check: request.liveness_check ?? false,
        verified_at: new Date().toISOString(),
        verified_by: 'KIOSK',
      },
    };

    let record: AttendanceRecord;
    if (request.clock_type === 'CLOCK_IN') {
      const response = await clockIn(bestMatch.user_id, clockRequest);
      record = response.record;
    } else {
      const response = await clockOut(bestMatch.user_id, clockRequest);
      record = response.record;
    }

    return {
      success: true,
      user_name: userName,
      confidence: bestMatch.confidence,
      record,
    };
  } catch (error) {
    return {
      success: false,
      confidence: bestMatch.confidence,
      error: error instanceof Error ? error.message : '打刻に失敗しました',
    };
  }
}

// =====================================================
// Attendance Summary Service
// =====================================================

import type {
  UserAttendanceSummary,
  UserAttendanceSummaryListResponse,
  DailyAttendance,
  UserAttendanceDetailResponse,
} from './types';
import { app } from '~encore/clients';

/**
 * ユーザー勤怠サマリー一覧を取得する（管理者用）
 */
export async function getUserAttendanceSummaryList(
  timezone: string = 'Asia/Tokyo'
): Promise<UserAttendanceSummaryListResponse> {
  // ユーザー一覧を取得
  const usersResponse = await app.list_users({ limit: 1000, page: 1 });
  const users = usersResponse.users || [];

  // 今月の年月を取得
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // 各ユーザーのサマリーを並列取得
  const summaries: UserAttendanceSummary[] = await Promise.all(
    users.map(async (user) => {
      // 今日の状態を取得
      const todayStatus = await getTodayStatus(user.id, timezone);

      // 今月の勤怠サマリーを取得
      const monthlySummary = await repository.getMonthlyAttendanceSummary(
        user.id,
        year,
        month,
        timezone
      );

      return {
        user_id: user.id,
        display_name: user.display_name || user.email,
        email: user.email,
        today_status: todayStatus.status,
        today_clock_in: todayStatus.clock_in_record?.timestamp?.toISOString() ?? null,
        today_clock_out: todayStatus.clock_out_record?.timestamp?.toISOString() ?? null,
        month_total_minutes: monthlySummary.total_minutes,
        month_working_days: monthlySummary.working_days,
      };
    })
  );

  return {
    summaries,
    total: summaries.length,
  };
}

/**
 * ユーザー勤怠詳細を取得する（管理者用）
 */
export async function getUserAttendanceDetail(
  user_id: string,
  year: number,
  month: number,
  timezone: string = 'Asia/Tokyo'
): Promise<UserAttendanceDetailResponse> {
  // ユーザー情報を取得
  const userResponse = await app.get_user_detail({ userId: user_id });

  // 日別勤怠データを取得
  const dailyData = await repository.getDailyAttendanceData(user_id, year, month, timezone);

  // 月間のすべての打刻レコードを取得
  const allRecords = await repository.getRecordsForPeriod(user_id, year, month, timezone);

  // 日別にレコードをグループ化
  const recordsByDate = new Map<string, AttendanceRecord[]>();
  for (const record of allRecords) {
    // タイムゾーンを考慮して日付を取得
    const recordDate = new Date(record.timestamp);
    // UTC時間に9時間（日本時間）を加算してローカル日付を取得
    const jstOffset = timezone === 'Asia/Tokyo' ? 9 * 60 * 60 * 1000 : 0;
    const localDate = new Date(recordDate.getTime() + jstOffset);
    const dateStr = localDate.toISOString().split('T')[0];
    const existing = recordsByDate.get(dateStr) || [];
    existing.push(record);
    recordsByDate.set(dateStr, existing);
  }

  // DailyAttendance形式に変換
  const dailyAttendances: DailyAttendance[] = dailyData.map((day) => ({
    date: day.date,
    clock_in: day.clock_in?.toISOString() ?? null,
    clock_out: day.clock_out?.toISOString() ?? null,
    working_minutes: day.working_minutes,
    records: recordsByDate.get(day.date) || [],
  }));

  // 月間合計を計算
  const monthTotalMinutes = dailyData.reduce((sum, d) => sum + d.working_minutes, 0);
  const monthWorkingDays = dailyData.filter((d) => d.clock_in !== null).length;

  return {
    user_id,
    display_name: userResponse.user.display_name || userResponse.user.email,
    email: userResponse.user.email,
    year,
    month,
    daily_attendances: dailyAttendances,
    month_total_minutes: monthTotalMinutes,
    month_working_days: monthWorkingDays,
  };
}
