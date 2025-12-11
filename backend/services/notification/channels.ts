/**
 * 通知チャネル名に関するユーティリティ関数。
 *
 * - ユーザー宛てチャネルは `user-{id}` 形式（id は任意の文字列）
 * - 全体配信は `all-users`
 * - 運用向けチャネルは `admin-dashboard`
 */

const USER_PREFIX = "user-";

export const CHANNEL_ALL_USERS = "all-users";
export const CHANNEL_ADMIN_DASHBOARD = "admin-dashboard";

/** ユーザーIDから `user-{id}` 形式のチャネル名を生成する。 */
export function makeUserChannel(userId: string | null | undefined): string | null {
  if (!userId) return null;
  const trimmed = String(userId).trim();
  if (trimmed.length === 0) return null;
  return `${USER_PREFIX}${trimmed}`;
}

/** チャネル名がサポート対象か確認し、正規化した値を返す。 */
export function normalizeChannelId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (trimmed.length === 0) return null;

  if (trimmed === CHANNEL_ALL_USERS || trimmed === CHANNEL_ADMIN_DASHBOARD) {
    return trimmed;
  }

  if (trimmed.startsWith(USER_PREFIX)) {
    const candidate = trimmed.slice(USER_PREFIX.length).trim();
    if (candidate.length === 0) {
      return null;
    }
    return `${USER_PREFIX}${candidate}`;
  }

  return null;
}

/** チャネル名からユーザーIDを抽出（`user-{id}` のみ対象）。 */
export function extractUserId(channelId: string): string | null {
  if (!channelId.startsWith(USER_PREFIX)) {
    return null;
  }
  const userId = channelId.slice(USER_PREFIX.length);
  return userId.length > 0 ? userId : null;
}

export function isUserChannel(channelId: string): boolean {
  return extractUserId(channelId) !== null;
}

export function isAdminChannel(channelId: string): boolean {
  return channelId === CHANNEL_ADMIN_DASHBOARD;
}

export function isAllUsersChannel(channelId: string): boolean {
  return channelId === CHANNEL_ALL_USERS;
}

export function isSupportedChannelId(channelId: string | null | undefined): boolean {
  return normalizeChannelId(channelId) !== null;
}

/**
 * チャネルリストを正規化（無効な値は除外）し、一意な配列を返す。
 */
export function sanitizeChannelList(channels: Iterable<string>): string[] {
  const result = new Set<string>();
  for (const channel of channels) {
    const normalized = normalizeChannelId(channel);
    if (!normalized) continue;
    result.add(normalized);
  }
  return Array.from(result);
}

/** チャネルリストからユーザーID集合を抽出する。 */
export function collectUserTargets(channels: Iterable<string>): string[] {
  const result = new Set<string>();
  for (const channel of channels) {
    const userId = extractUserId(channel);
    if (!userId) continue;
    result.add(userId);
  }
  return Array.from(result);
}
