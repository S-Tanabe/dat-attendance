/**
 * QR Code Clock Method
 * QRコード打刻
 *
 * A方式: ユーザーがQRコードを表示し、管理者/受付がスキャンして打刻を承認
 * - ユーザーはアプリでQRコード（時限式トークン）を表示
 * - 管理者/受付がQRをスキャンしてAPI経由で打刻を承認
 * - このクラスは主にverify時のバイパス用（QR経由の打刻は既に承認済み）
 */

import { ClockMethodCodeEnum } from '../types';
import type { ClockMethodCode } from '../types';
import { BaseClockMethod, type ClockContext, type ClockVerificationResult } from './interface';

/**
 * QRコードの検証データ
 */
interface QRVerificationData {
  qr_token?: string;
  verified_by?: string;
  verified_at?: string;
  location_id?: string;
}

export class QRCodeClockMethod extends BaseClockMethod {
  readonly code: ClockMethodCode = ClockMethodCodeEnum.QR_CODE;
  readonly name = 'QRコード打刻';

  async verify(context: ClockContext): Promise<ClockVerificationResult> {
    const verificationData = context.request.verification_data as QRVerificationData | undefined;

    // QRコード打刻は管理者が承認した時点で既に検証済み
    // verification_dataに必要な情報が含まれているかを確認
    if (!verificationData?.qr_token || !verificationData?.verified_by) {
      return this.failure('QR_VERIFICATION_REQUIRED', 'QRコード認証が必要です');
    }

    // 管理者による承認があるので成功
    return this.success({
      method: 'qr_code',
      qr_token: verificationData.qr_token,
      verified_by: verificationData.verified_by,
      verified_at: verificationData.verified_at ?? new Date().toISOString(),
      location_id: verificationData.location_id,
    });
  }

  async isAvailable(_context: ClockContext): Promise<boolean> {
    // QRコード打刻は常に利用可能（有効/無効はclock_methodsテーブルで管理）
    return true;
  }

  requiresConfiguration(): boolean {
    return false;
  }

  validateConfiguration(_config: Record<string, unknown>): boolean {
    // QRコード打刻に特別な設定は不要
    return true;
  }
}
