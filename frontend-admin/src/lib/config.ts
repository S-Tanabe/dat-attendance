import { env as publicEnv } from '$env/dynamic/public'

// アプリの既定遷移先（未設定時は /dashboard）
export const DEFAULT_APP_PATH: string = publicEnv.PUBLIC_DEFAULT_APP_PATH ?? '/dashboard'
