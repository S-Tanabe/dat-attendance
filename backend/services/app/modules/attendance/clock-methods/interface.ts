/**
 * Clock Method Interface
 * 打刻方法のStrategy Patternインターフェース
 *
 * このインターフェースを実装することで、新しい打刻方法を追加できます。
 * 例: QRコード、顔認証、NFC、GPS等
 */

import type {
  ClockMethodCode,
  ClockRequest,
  DeviceInfo,
  LocationData,
} from '../types';

/**
 * 打刻検証結果
 */
export interface ClockVerificationResult {
  success: boolean;
  error_code?: string;
  error_message?: string;
  verification_data?: Record<string, unknown>;
}

/**
 * 打刻方法のコンテキスト（検証時に渡される情報）
 */
export interface ClockContext {
  user_id: string;
  request: ClockRequest;
  device_info?: DeviceInfo;
  location_data?: LocationData;
}

/**
 * 打刻方法インターフェース（Strategy Pattern）
 *
 * 新しい打刻方法を追加する場合:
 * 1. このインターフェースを実装したクラスを作成
 * 2. clock-methods/ ディレクトリに配置
 * 3. registry.ts に登録
 */
export interface IClockMethod {
  /**
   * 打刻方法コード
   */
  readonly code: ClockMethodCode;

  /**
   * 打刻方法名（表示用）
   */
  readonly name: string;

  /**
   * 打刻を検証する
   * @param context 打刻コンテキスト
   * @returns 検証結果
   */
  verify(context: ClockContext): Promise<ClockVerificationResult>;

  /**
   * この打刻方法が利用可能かどうか
   * @param context 打刻コンテキスト
   * @returns 利用可能ならtrue
   */
  isAvailable(context: ClockContext): Promise<boolean>;

  /**
   * 追加の設定が必要かどうか
   * @returns 設定が必要ならtrue
   */
  requiresConfiguration(): boolean;

  /**
   * 設定を検証する
   * @param config 設定オブジェクト
   * @returns 有効ならtrue
   */
  validateConfiguration(config: Record<string, unknown>): boolean;
}

/**
 * 打刻方法の基底クラス
 * 共通の処理を提供
 */
export abstract class BaseClockMethod implements IClockMethod {
  abstract readonly code: ClockMethodCode;
  abstract readonly name: string;

  abstract verify(context: ClockContext): Promise<ClockVerificationResult>;

  async isAvailable(_context: ClockContext): Promise<boolean> {
    // デフォルトは常に利用可能
    return true;
  }

  requiresConfiguration(): boolean {
    // デフォルトは設定不要
    return false;
  }

  validateConfiguration(_config: Record<string, unknown>): boolean {
    // デフォルトは常に有効
    return true;
  }

  /**
   * 成功結果を作成するヘルパー
   */
  protected success(verification_data?: Record<string, unknown>): ClockVerificationResult {
    return {
      success: true,
      verification_data,
    };
  }

  /**
   * 失敗結果を作成するヘルパー
   */
  protected failure(error_code: string, error_message: string): ClockVerificationResult {
    return {
      success: false,
      error_code,
      error_message,
    };
  }
}
