/**
 * Face Recognition Clock Method
 * 顔認証打刻
 *
 * ブラウザ側でface-api.jsを使用して顔特徴ベクトルを抽出し、
 * サーバー側で登録済みの顔データと照合して認証を行う。
 *
 * フロー:
 * 1. ユーザーが事前に顔データを登録（/attendance/face/register）
 * 2. 打刻時にカメラで顔を撮影
 * 3. ブラウザで顔特徴ベクトルを抽出
 * 4. サーバーで照合＆打刻（/attendance/face/verify）
 */

import { ClockMethodCodeEnum } from '../types';
import type { ClockMethodCode } from '../types';
import { BaseClockMethod, type ClockContext, type ClockVerificationResult } from './interface';

/**
 * 顔認証の検証データ
 */
interface FaceVerificationData {
  face_data_id?: string;     // 登録済み顔データID
  confidence?: number;       // 認証スコア（0-1）
  liveness_check?: boolean;  // 生体検知結果
  verified_at?: string;      // 検証日時
}

export class FaceRecognitionClockMethod extends BaseClockMethod {
  readonly code: ClockMethodCode = ClockMethodCodeEnum.FACE_RECOGNITION;
  readonly name = '顔認証打刻';

  async verify(context: ClockContext): Promise<ClockVerificationResult> {
    const verificationData = context.request.verification_data as FaceVerificationData | undefined;

    // 顔認証は既にverifyFaceAndClockで検証済み
    // verification_dataに必要な情報が含まれているかを確認
    if (!verificationData?.face_data_id || verificationData?.confidence === undefined) {
      return this.failure(
        'FACE_VERIFICATION_REQUIRED',
        '顔認証データが必要です'
      );
    }

    // 信頼度スコアの検証（念のため再チェック）（デモ用に一時的に50%に設定）
    const MIN_CONFIDENCE = 0.50;
    if (verificationData.confidence < MIN_CONFIDENCE) {
      return this.failure(
        'FACE_CONFIDENCE_LOW',
        `認証スコアが基準値（${MIN_CONFIDENCE * 100}%）を下回っています`
      );
    }

    // サービス層で検証済みなので成功
    return this.success({
      method: 'face_recognition',
      face_data_id: verificationData.face_data_id,
      confidence: verificationData.confidence,
      liveness_check: verificationData.liveness_check ?? false,
      verified_at: verificationData.verified_at ?? new Date().toISOString(),
    });
  }

  async isAvailable(_context: ClockContext): Promise<boolean> {
    // 顔認証は常に利用可能（有効/無効はclock_methodsテーブルで管理）
    return true;
  }

  requiresConfiguration(): boolean {
    return false;
  }

  validateConfiguration(_config: Record<string, unknown>): boolean {
    // 顔認証に特別な設定は不要（ブラウザ側でface-api.jsを使用）
    return true;
  }
}
