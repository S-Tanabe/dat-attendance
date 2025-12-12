/**
 * Attendance APIs
 * 出退勤関連のAPIエンドポイント
 *
 * エンドポイント一覧:
 * - POST /attendance/clock-in        : 出勤打刻
 * - POST /attendance/clock-out       : 退勤打刻
 * - GET  /attendance/today           : 今日の打刻状態
 * - GET  /attendance/me              : 自分の打刻履歴
 * - GET  /attendance/clock-methods   : 有効な打刻方法一覧
 * - GET  /admin/attendance           : [管理者] ユーザーの打刻履歴
 * - PATCH /admin/attendance/:id      : [管理者] 打刻修正
 * - POST /admin/attendance/clock     : [管理者] 代理打刻
 */

import { api, APIError } from 'encore.dev/api';
import { getAuthData } from '~encore/auth';
import { requirePermission, RoleLevel } from '../users/permissions';
import {
  clockIn,
  clockOut,
  getTodayStatus,
  getAttendanceHistory,
  updateAttendance,
  adminClock,
  getActiveClockMethods as getActiveClockMethodsService,
} from './service';
import type {
  ClockRequest,
  ClockResponse,
  TodayStatus,
  AttendanceListResponse,
  UpdateAttendanceRequest,
  ClockMethod,
  AttendanceType,
  AttendanceRecord,
} from './types';

// =====================================================
// ユーザー向けAPI
// =====================================================

/**
 * 出勤打刻
 */
export const clock_in = api(
  {
    expose: true,
    method: 'POST',
    path: '/attendance/clock-in',
    auth: true,
  },
  async (req: ClockRequest): Promise<ClockResponse> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    return clockIn(auth.userID, req);
  }
);

/**
 * 退勤打刻
 */
export const clock_out = api(
  {
    expose: true,
    method: 'POST',
    path: '/attendance/clock-out',
    auth: true,
  },
  async (req: ClockRequest): Promise<ClockResponse> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    return clockOut(auth.userID, req);
  }
);

/**
 * 今日の打刻状態を取得
 */
export const get_today_status = api(
  {
    expose: true,
    method: 'GET',
    path: '/attendance/today',
    auth: true,
  },
  async (): Promise<TodayStatus> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    return getTodayStatus(auth.userID);
  }
);

/**
 * 自分の打刻履歴を取得
 */
export interface GetMyAttendanceRequest {
  from: string;  // YYYY-MM-DD
  to: string;    // YYYY-MM-DD
  type?: AttendanceType;
  limit?: number;
  offset?: number;
}

export const get_my_attendance = api(
  {
    expose: true,
    method: 'GET',
    path: '/attendance/me',
    auth: true,
  },
  async (req: GetMyAttendanceRequest): Promise<AttendanceListResponse> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    // バリデーション
    if (!req.from || !req.to) {
      throw APIError.invalidArgument('from と to は必須です');
    }

    return getAttendanceHistory({
      user_id: auth.userID,
      from: req.from,
      to: req.to,
      type: req.type,
      limit: req.limit,
      offset: req.offset,
    });
  }
);

/**
 * 有効な打刻方法一覧を取得
 */
export const get_clock_methods = api(
  {
    expose: true,
    method: 'GET',
    path: '/attendance/clock-methods',
    auth: true,
  },
  async (): Promise<{ methods: ClockMethod[] }> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    const methods = await getActiveClockMethodsService();
    return { methods };
  }
);

// =====================================================
// 管理者向けAPI
// =====================================================

/**
 * [管理者] ユーザーの打刻履歴を取得
 */
export interface GetAdminAttendanceRequest {
  user_id?: string;  // 省略時は全ユーザー
  from: string;      // YYYY-MM-DD
  to: string;        // YYYY-MM-DD
  type?: AttendanceType;
  limit?: number;
  offset?: number;
}

export const admin_get_attendance = api(
  {
    expose: true,
    method: 'GET',
    path: '/admin/attendance',
    auth: true,
  },
  async (req: GetAdminAttendanceRequest): Promise<AttendanceListResponse> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    // 管理者権限チェック（level <= 2）
    await requirePermission(RoleLevel.ADMIN);

    // バリデーション
    if (!req.from || !req.to) {
      throw APIError.invalidArgument('from と to は必須です');
    }

    return getAttendanceHistory({
      user_id: req.user_id,  // 省略可能
      from: req.from,
      to: req.to,
      type: req.type,
      limit: req.limit,
      offset: req.offset,
    });
  }
);

/**
 * [管理者] 打刻を修正
 */
export const admin_update_attendance = api(
  {
    expose: true,
    method: 'PATCH',
    path: '/admin/attendance/:id',
    auth: true,
  },
  async (req: UpdateAttendanceRequest): Promise<{ record: AttendanceRecord }> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    // 管理者権限チェック
    await requirePermission(RoleLevel.ADMIN);

    // バリデーション
    if (!req.id) {
      throw APIError.invalidArgument('id は必須です');
    }

    const record = await updateAttendance(req, auth.userID);
    return { record };
  }
);

/**
 * [管理者] 代理打刻
 */
export interface AdminClockRequest {
  user_id: string;       // 対象ユーザー
  type: AttendanceType;  // CLOCK_IN, CLOCK_OUT, ADJUSTMENT
  timestamp?: string;    // カスタム時刻
  note?: string;         // メモ
}

export const admin_clock = api(
  {
    expose: true,
    method: 'POST',
    path: '/admin/attendance/clock',
    auth: true,
  },
  async (req: AdminClockRequest): Promise<ClockResponse> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    // 管理者権限チェック
    await requirePermission(RoleLevel.ADMIN);

    // バリデーション
    if (!req.user_id) {
      throw APIError.invalidArgument('user_id は必須です');
    }
    if (!req.type) {
      throw APIError.invalidArgument('type は必須です');
    }

    return adminClock(
      req.user_id,
      req.type,
      {
        timestamp: req.timestamp,
        note: req.note,
      },
      auth.userID
    );
  }
);

/**
 * [管理者] ユーザーの今日の打刻状態を取得
 */
export interface GetUserTodayStatusRequest {
  user_id: string;
}

export const admin_get_user_today = api(
  {
    expose: true,
    method: 'GET',
    path: '/admin/attendance/today/:user_id',
    auth: true,
  },
  async (req: GetUserTodayStatusRequest): Promise<TodayStatus> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    // 管理者権限チェック
    await requirePermission(RoleLevel.ADMIN);

    // バリデーション
    if (!req.user_id) {
      throw APIError.invalidArgument('user_id は必須です');
    }

    return getTodayStatus(req.user_id);
  }
);

// =====================================================
// QR Code APIs
// =====================================================

import {
  generateQRToken,
  verifyQRTokenAndClock,
  getActiveQRToken,
  registerFace,
  verifyFaceAndClock,
  getFaceDataStatus,
  deleteFaceData,
} from './service';
import type {
  GenerateQRTokenRequest,
  GenerateQRTokenResponse,
  VerifyQRTokenRequest,
  VerifyQRTokenResponse,
  RegisterFaceRequest,
  RegisterFaceResponse,
  VerifyFaceRequest,
  VerifyFaceResponse,
  FaceDataStatusResponse,
} from './types';

/**
 * QRトークンを生成する（ユーザー用）
 * ユーザーがこのトークンを含むQRコードを表示し、管理者/受付がスキャンする
 */
export const generate_qr_token = api(
  {
    expose: true,
    method: 'POST',
    path: '/attendance/qr/generate',
    auth: true,
  },
  async (req: GenerateQRTokenRequest): Promise<GenerateQRTokenResponse> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    return generateQRToken(auth.userID, req);
  }
);

/**
 * 現在有効なQRトークンを取得する（ユーザー用）
 */
export interface GetActiveQRTokenRequest {
  clock_type?: 'CLOCK_IN' | 'CLOCK_OUT';
}

export interface GetActiveQRTokenResponse {
  token: string | null;
  qr_data: string | null;
  expires_at: string | null;
  clock_type: 'CLOCK_IN' | 'CLOCK_OUT' | null;
}

export const get_active_qr_token = api(
  {
    expose: true,
    method: 'GET',
    path: '/attendance/qr/active',
    auth: true,
  },
  async (req: GetActiveQRTokenRequest): Promise<GetActiveQRTokenResponse> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    const token = await getActiveQRToken(auth.userID, req.clock_type);
    if (!token) {
      return {
        token: null,
        qr_data: null,
        expires_at: null,
        clock_type: null,
      };
    }

    const qrData = JSON.stringify({
      type: 'attendance_qr',
      token: token.token,
      clock_type: token.clock_type,
      expires_at: token.expires_at,
    });

    return {
      token: token.token,
      qr_data: qrData,
      expires_at: token.expires_at.toISOString(),
      clock_type: token.clock_type,
    };
  }
);

/**
 * [管理者] QRトークンを検証して打刻を行う
 */
export const admin_verify_qr_token = api(
  {
    expose: true,
    method: 'POST',
    path: '/admin/attendance/qr/verify',
    auth: true,
  },
  async (req: VerifyQRTokenRequest): Promise<VerifyQRTokenResponse> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    // 管理者権限チェック
    await requirePermission(RoleLevel.ADMIN);

    // バリデーション
    if (!req.token) {
      throw APIError.invalidArgument('token は必須です');
    }
    if (!req.clock_type) {
      throw APIError.invalidArgument('clock_type は必須です');
    }

    return verifyQRTokenAndClock(req, auth.userID);
  }
);

// =====================================================
// Face Recognition APIs
// =====================================================

/**
 * 顔データを登録する（ユーザー用）
 */
export const register_face = api(
  {
    expose: true,
    method: 'POST',
    path: '/attendance/face/register',
    auth: true,
  },
  async (req: RegisterFaceRequest): Promise<RegisterFaceResponse> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    // バリデーション
    if (!req.descriptor || !Array.isArray(req.descriptor)) {
      throw APIError.invalidArgument('descriptor は必須です');
    }

    return registerFace(auth.userID, req);
  }
);

/**
 * 顔認証で打刻する（ユーザー用）
 */
export const verify_face_and_clock = api(
  {
    expose: true,
    method: 'POST',
    path: '/attendance/face/verify',
    auth: true,
  },
  async (req: VerifyFaceRequest): Promise<VerifyFaceResponse> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    // バリデーション
    if (!req.descriptor || !Array.isArray(req.descriptor)) {
      throw APIError.invalidArgument('descriptor は必須です');
    }
    if (!req.clock_type) {
      throw APIError.invalidArgument('clock_type は必須です');
    }

    return verifyFaceAndClock(auth.userID, req);
  }
);

/**
 * 顔データの登録状態を取得する（ユーザー用）
 */
export const get_face_status = api(
  {
    expose: true,
    method: 'GET',
    path: '/attendance/face/status',
    auth: true,
  },
  async (): Promise<FaceDataStatusResponse> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    return getFaceDataStatus(auth.userID);
  }
);

/**
 * 顔データを削除する（ユーザー用）
 */
export interface DeleteFaceRequest {
  face_id: string;
}

export interface DeleteFaceResponse {
  success: boolean;
}

export const delete_face = api(
  {
    expose: true,
    method: 'DELETE',
    path: '/attendance/face/:face_id',
    auth: true,
  },
  async (req: DeleteFaceRequest): Promise<DeleteFaceResponse> => {
    const auth = getAuthData();
    if (!auth) {
      throw APIError.unauthenticated('認証が必要です');
    }

    // バリデーション
    if (!req.face_id) {
      throw APIError.invalidArgument('face_id は必須です');
    }

    const success = await deleteFaceData(auth.userID, req.face_id);
    return { success };
  }
);
