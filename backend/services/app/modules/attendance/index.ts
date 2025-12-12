/**
 * Attendance Module
 * 出退勤機能のエクスポート
 */

// 型定義
export * from './types';

// 打刻方法
export * from './clock-methods';

// サービス
export {
  clockIn,
  clockOut,
  getTodayStatus,
  getAttendanceHistory,
  updateAttendance,
  adminClock,
  getActiveClockMethods,
  toggleClockMethod,
} from './service';
