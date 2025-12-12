// @ts-check
/**
 * ESLint Configuration for SvelteKit + Encore.dev
 * 
 * 設計原則:
 * 1. svelte-check: .svelte ファイルの型チェック専任
 * 2. ESLint (type-aware): .ts ファイルの型チェック + 論理エラー検出
 * 3. ESLint (通常): .svelte ファイルの論理エラー（Promise等）のみ
 * 
 * AI駆動開発最適化:
 * - warn ルールを最小化（AI回避防止）
 * - error/off のバイナリ判断を優先
 * - 自動修正可能なスタイル系は自動処理
 * 
 * Last Updated: 2025-11-04
 */

import antfu from '@antfu/eslint-config'

export default antfu({
  // ============================================
  // Svelte サポート有効化 (Svelte 5 対応)
  // ============================================
  svelte: {
    version: 5,
  },

  // ============================================
  // TypeScript サポート（type-aware 有効）
  // .ts ファイルに対してのみ型情報ベースチェック
  // ============================================
  typescript: {
    tsconfigPath: './tsconfig.json',
  },

  // ============================================
  // フォーマッティング有効化（Prettier代替）
  // スタイル系は自動修正で対応→手動対応不要
  // ============================================
  stylistic: {
    indent: 'tab',
    quotes: 'single',
    semi: false,
  },

  // ============================================
  // 無視パターン
  // ============================================
  ignores: [
    '**/build/**',
    '**/.svelte-kit/**',
    '**/dist/**',
    '**/node_modules/**',
    '**/package-lock.json',
    '**/pnpm-lock.yaml',
    '**/.env*',
    '**/generated/**',
    '**/.encore/**',
    '**/AGENTS.md',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/*.config.js',
    '**/*.config.ts',
    '**/svelte.config.js',
    '**/*.md',  // Markdownファイルを無視
    '**/*.json',  // JSONファイルを無視（package.jsonなど）
    '**/*.yaml',  // YAMLファイルを無視
    '**/*.yml',  // YAMLファイルを無視
  ],
}, {
  // ============================================
  // グローバルルール設定
  // .ts と .svelte の両方に適用される基礎ルール
  // ============================================
  rules: {
    // ===============================================
    // SECTION 1: 安全性ルール（エラーレベル）
    // AIがルールを回避できないようにエラーに設定
    // ===============================================

    // 変数管理：AIが最も誤るセクション
    'ts/no-unused-vars': 'error',              // 未使用変数は必ず削除
    'no-unused-vars': 'error',                 // フォールバック
    'unused-imports/no-unused-vars': 'error',  // import周りも厳格
    'no-unused-expressions': 'error',          // 副作用なし式は死んだコード
    'ts/no-redeclare': 'error',                // 再宣言は厳禁

    // 型安全性：TypeScriptの根本的役割
    'ts/no-explicit-any': 'error',             // any型は禁止
    'ts/no-unsafe-assignment': 'error',        // 型違反の代入
    'ts/no-unsafe-member-access': 'error',     // 型安全でないプロパティアクセス
    'ts/no-unsafe-call': 'error',              // 型安全でない関数呼び出し
    'ts/no-unsafe-argument': 'error',          // 型安全でない関数引数
    'ts/no-unsafe-return': 'error',            // 型安全でない戻り値

    // Promise・非同期処理：最重要（バグの温床）
    // 注: Svelteファイルでも有効（svelte-checkは検出しない）
    'ts/no-floating-promises': 'error',        // await忘れ検出：CRITICAL
    'ts/no-misused-promises': 'error',         // Promise誤用：CRITICAL
    'ts/await-thenable': 'error',              // 不要なawait検出

    // スイッチ文の網羅性
    'ts/switch-exhaustiveness-check': 'error', // enum全パターン必須

    // デバッグ・本番環境対応
    'no-console': 'off',                       // console許可（本番環境で削除したければローカルフック設定）

    // ===============================================
    // SECTION 2: 削除したルール（off）
    // AIが回避してほしくない、実装パターン依存のもの
    // ===============================================

    // 日本語正規表現対応
    'regexp/no-obscure-range': 'off',          // 日本語対応必須

    // Number周り：実装パターン依存
    'unicorn/prefer-number-properties': 'off', // isNaN許可（理由あり）

    // TypeScriptの過度な厳格さ
    'ts/strict-boolean-expressions': 'off',    // if(x)のような型変換許可

    // スタイル系：自動修正で対応（手動対応不要）
    'style/max-statements-per-line': 'off',    // 1行複数文を許可
    'style/indent-binary-ops': 'off',          // 自動修正で対応
    'style/no-mixed-spaces-and-tabs': 'off',   // 自動修正で対応

    // 実装パターン依存：AIの工夫を許す
    'regexp/strict': 'off',                    // 正規表現の厳格さ
    'no-alert': 'off',                         // alertの使用許可
    'no-case-declarations': 'off',             // case内変数宣言許可（ブロックスコープで対応）
    'no-useless-catch': 'off',                 // 再スロー用途あり
    'one-var': 'off',                          // 複数変数一括宣言許可

    // レガシー対応
    'ts/no-use-before-define': 'off',          // ホイスティング関連（複雑）
    'no-use-before-define': 'off',             // 同上

    // ===============================================
    // SECTION 3: スタイル系（エラー/自動修正対応）
    // ESLintではなく npm run format で対応
    // ===============================================

    'style/brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'style/arrow-parens': ['error', 'always'],
  },
}, {
  // ============================================
  // .ts ファイル専用ルール
  // type-aware ルールが有効（完全な型チェック）
  // ============================================
  files: ['**/*.ts'],
  rules: {
    // TypeScript専用の重要ルール
    // 全て error にして AI への制約を明確化
    'ts/no-floating-promises': 'error',        // 再度強調（重要）
    'ts/no-misused-promises': 'error',         // 再度強調（重要）
    'ts/await-thenable': 'error',              // 再度強調（重要）
  },
}, {
  // ============================================
  // .svelte ファイル専用ルール
  // 
  // 役割分担:
  // - svelte-check: .svelte ファイル内の型チェック
  // - ESLint: .svelte ファイル内の論理エラー検出
  // 
  // 注意: svelte-checkは .ts ファイルをチェックしないため、
  // .ts ファイルの型チェックはESLintが全責任を持つ
  // ============================================
  files: ['**/*.svelte'],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    // ===================================================
    // Svelte 固有の誤検知：これらのみ off に設定
    // ===================================================
    
    // svelte-check では export let の型情報が部分的に得られないため
    // ESLint の型チェックが過度に厳しくなる → false positive
    'ts/no-unsafe-member-access': 'off',
    
    // export let は Svelte コンポーネントの標準パターン
    // ESLint の「mutable exports は禁止」ルール衝突
    'import/no-mutable-exports': 'off',
    
    // ===================================================
    // 他のルールは有効（svelte-check では検出しない）
    // ===================================================
    
    // Promise・非同期処理：svelte-check は検出しない（重要）
    'ts/no-floating-promises': 'error',        // CRITICAL
    'ts/no-misused-promises': 'error',         // CRITICAL
    'ts/await-thenable': 'error',              // CRITICAL
    
    // 変数管理：svelte-check は完全には検出しない
    'ts/no-unused-vars': 'error',              // 重要
    'no-unused-expressions': 'error',          // 重要
    
    // 型安全性：svelte-check の型推論と協調
    'ts/no-explicit-any': 'error',             // any型は禁止
    
    // Svelte セキュリティ
    'svelte/no-at-html-tags': 'error',         // XSS防止：必須
  },
}, {
  // ============================================
  // test/*.ts / **/*.test.ts ファイル：緩和版
  // テストコードは実装コードほど厳格でなくてもよい
  // ============================================
  files: ['**/test/**', '**/*.test.ts', '**/*.spec.ts'],
  rules: {
    // テストではconsoleの使用を許可
    'no-console': 'off',
    
    // テストでは複数の処理を一度に行うことあり
    'no-unused-expressions': 'off',
    
    // テストデータとしてのany型を部分的に許可
    'ts/no-explicit-any': 'warn',
  },
})
