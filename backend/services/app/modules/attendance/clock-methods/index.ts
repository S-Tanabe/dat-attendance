/**
 * Clock Methods Module
 * 打刻方法モジュールのエクスポート
 */

// インターフェース
export {
  type IClockMethod,
  type ClockContext,
  type ClockVerificationResult,
  BaseClockMethod,
} from './interface';

// 実装
export { ButtonClockMethod } from './button';
export { QRCodeClockMethod } from './qr-code';
export { FaceRecognitionClockMethod } from './face-recognition';

// レジストリ
export { clockMethodRegistry, getClockMethod, getAllClockMethods } from './registry';
