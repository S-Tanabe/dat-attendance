/**
 * Clock Method Registry
 * 打刻方法のレジストリ
 *
 * 利用可能な打刻方法を管理し、コードに基づいて適切な実装を返します。
 * 新しい打刻方法を追加する場合は、このファイルに登録してください。
 */

import type { ClockMethodCode } from '../types';
import type { IClockMethod } from './interface';
import { ButtonClockMethod } from './button';
import { QRCodeClockMethod } from './qr-code';
import { FaceRecognitionClockMethod } from './face-recognition';

/**
 * 打刻方法レジストリ
 */
class ClockMethodRegistry {
  private methods: Map<ClockMethodCode, IClockMethod> = new Map();
  private defaultMethod: IClockMethod;

  constructor() {
    // デフォルトはボタン打刻
    this.defaultMethod = new ButtonClockMethod();

    // 利用可能な打刻方法を登録
    this.register(new ButtonClockMethod());
    this.register(new QRCodeClockMethod());
    this.register(new FaceRecognitionClockMethod());

    // 将来の拡張用（未実装）
    // this.register(new NFCClockMethod());
    // this.register(new GPSClockMethod());
  }

  /**
   * 打刻方法を登録する
   */
  register(method: IClockMethod): void {
    this.methods.set(method.code, method);
  }

  /**
   * コードに基づいて打刻方法を取得する
   * @param code 打刻方法コード（未指定の場合はデフォルト）
   * @returns 打刻方法の実装
   */
  get(code?: ClockMethodCode): IClockMethod {
    if (!code) {
      return this.defaultMethod;
    }

    const method = this.methods.get(code);
    if (!method) {
      console.warn(`Unknown clock method code: ${code}, using default`);
      return this.defaultMethod;
    }

    return method;
  }

  /**
   * 全ての登録済み打刻方法を取得する
   */
  getAll(): IClockMethod[] {
    return Array.from(this.methods.values());
  }

  /**
   * 打刻方法コードが有効かどうかを確認する
   */
  isValidCode(code: string): code is ClockMethodCode {
    return this.methods.has(code as ClockMethodCode);
  }

  /**
   * デフォルトの打刻方法を取得する
   */
  getDefault(): IClockMethod {
    return this.defaultMethod;
  }

  /**
   * デフォルトの打刻方法を設定する
   */
  setDefault(code: ClockMethodCode): void {
    const method = this.methods.get(code);
    if (method) {
      this.defaultMethod = method;
    }
  }
}

// シングルトンインスタンス
export const clockMethodRegistry = new ClockMethodRegistry();

/**
 * 打刻方法を取得するヘルパー関数
 */
export function getClockMethod(code?: ClockMethodCode): IClockMethod {
  return clockMethodRegistry.get(code);
}

/**
 * 全ての打刻方法を取得するヘルパー関数
 */
export function getAllClockMethods(): IClockMethod[] {
  return clockMethodRegistry.getAll();
}
