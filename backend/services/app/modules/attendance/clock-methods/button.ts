/**
 * Button Clock Method
 * ボタン打刻（デフォルト）
 *
 * 最もシンプルな打刻方法。
 * 画面上のボタンをクリックするだけで打刻が完了します。
 */

import { ClockMethodCodeEnum } from '../types';
import type { ClockMethodCode } from '../types';
import { BaseClockMethod, type ClockContext, type ClockVerificationResult } from './interface';

export class ButtonClockMethod extends BaseClockMethod {
  readonly code: ClockMethodCode = ClockMethodCodeEnum.BUTTON;
  readonly name = 'ボタン打刻';

  async verify(context: ClockContext): Promise<ClockVerificationResult> {
    // ボタン打刻は特別な検証は不要
    // デバイス情報があれば記録
    const verification_data: Record<string, unknown> = {
      method: 'button',
      verified_at: new Date().toISOString(),
    };

    if (context.device_info) {
      verification_data.device_type = context.device_info.device_type;
      verification_data.browser = context.device_info.browser;
    }

    return this.success(verification_data);
  }

  async isAvailable(_context: ClockContext): Promise<boolean> {
    // ボタン打刻は常に利用可能
    return true;
  }
}
