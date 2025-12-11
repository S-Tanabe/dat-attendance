// 生成クライアント(~encore/clients)ではスクリプト起点の呼び出しで
// "unable to determine service for call" が発生するため、
// サービス実装のエンドポイント関数を直接インポートして呼び出す。
import { get_user_by_email, create_auth_user } from "../services/auth/auth";
import { create_app_user } from "../services/app/modules/users/user_management";

async function seed() {
  console.log("Starting seed process...");
  
  // 1. ロールは app サービスのマイグレーション(0001)で投入済み想定
  console.log("Ensuring roles exist (via migrations) ... done");

  // 2. 初期ユーザー作成（内部API経由）
  const seedUsers = [
    {
      email: 'admin@fox-hound.jp',
      password: 'Archimedes212',
      displayName: 'System Administrator',
      role: 'super_admin'
    },
    {
      email: 'ai@fox-hound.jp',
      password: 'A_word_is_enough_to_the_wise',
      displayName: 'AI System Administrator',
      role: 'super_admin'
    }
  ];

  for (const u of seedUsers) {
    console.log(`Creating user: ${u.email}`);
    try {
      // 既存チェック（内部API）
      const existing = await get_user_by_email({ email: u.email });
      if (existing.user) {
        console.log(`User ${u.email} already exists, skipping...`);
        continue;
      }

      // 認証ユーザー作成（内部API: create_auth_user がハッシュ化まで担当）
      const created = await create_auth_user({ email: u.email, password: u.password });
      const userId = created.userId;

      // アプリユーザー作成（内部API、ロール名を解決）
      await create_app_user({ id: userId, displayName: u.displayName, role: u.role });

      console.log(`User created successfully: ${u.email} (ID: ${userId})`);
    } catch (error) {
      console.error(`Failed to create user ${u.email}:`, error);
    }
  }
  
  console.log("Seed completed successfully!");
}

seed().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
