/*
 * Auth Handler for Encore Gateway
 *
 * 概要:
 * - Authorizationヘッダー または Cookie(`access_token`) からアクセストークンを受け取り、
 *   HS256 署名のJWTを検証します。
 * - JWTの `sub` を `userID` として、`email` をオプションで取り出して各APIに渡します。
 * - 役割/権限は users サービスが一次ソースのため、authハンドラでは扱いません。
 *
 * セキュリティ注意:
 * - 秘密鍵は Encore Secrets `JWT_SECRET` から取得し、必須です。
 * - 失敗時は APIError.unauthenticated を返してAPI本体へ到達させません。
 */
import { Header, Cookie, Gateway } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import { jwtVerify, JWTPayload } from "jose";
import { secret } from "encore.dev/config";

const JWT_SECRET = secret("JWT_SECRET"); // encore secret set ... で設定

// リクエストから受け取る認証情報（ヘッダ or Cookie を許可）
interface AuthParams {
  authorization?: Header<"Authorization">;
  accessToken?: Cookie<"acc_at">;
}

// 認証後にエンドポイントへ渡される型
export interface AuthData {
  userID: string;
  email?: string;
  // role/roleLevel は users サービスで解決するため未設定
}

// JWT検証（ロールは扱わない）
async function verifyAccessToken(token: string): Promise<AuthData> {
  const secretValue = JWT_SECRET();
  if (!secretValue) {
    throw new Error("JWT secret is not configured. Please set the 'JWT_SECRET' secret.");
  }
  const key = new TextEncoder().encode(secretValue);
  const { payload } = await jwtVerify(token, key, {
    algorithms: ["HS256"]
  });
  
  const userID = String(payload.sub);
  return {
    userID,
    email: typeof payload.email === "string" ? payload.email : undefined,
  };
}

export const auth = authHandler<AuthParams, AuthData>(async (p) => {
  const header = p.authorization ?? "";
  const cookie = p.accessToken?.value ?? "";
  
  // Authorizationヘッダーからトークンを抽出
  let token = "";
  if (header.startsWith("Bearer ")) {
    token = header.slice("Bearer ".length);
  } else if (cookie) {
    token = cookie;
  }

  if (!token) {
    throw (await import("encore.dev/api")).APIError.unauthenticated("no auth");
  }
  
  try {
    const result = await verifyAccessToken(token);
    return result;
  } catch {
    throw (await import("encore.dev/api")).APIError.unauthenticated("invalid token");
  }
});

// アプリのゲートウェイへAuthハンドラを登録
export const gateway = new Gateway({ authHandler: auth });
