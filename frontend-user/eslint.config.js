// @ts-check
/**
 * ESLint Configuration for SvelteKit (User Frontend)
 *
 * 設計原則:
 * 1. svelte-check: .svelte ファイルの型チェック専任
 * 2. ESLint (type-aware): .ts ファイルの型チェック + 論理エラー検出
 * 3. ESLint (通常): .svelte ファイルの論理エラー（Promise等）のみ
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
    '**/playwright-report/**',
    '**/test-results/**',
    '**/*.config.js',
    '**/*.config.ts',
    '**/svelte.config.js',
    '**/*.md',
    '**/*.json',
    '**/*.yaml',
    '**/*.yml',
  ],
}, {
  // ============================================
  // グローバルルール設定
  // ============================================
  rules: {
    // 変数管理
    'ts/no-unused-vars': 'error',
    'no-unused-vars': 'error',
    'unused-imports/no-unused-vars': 'error',
    'no-unused-expressions': 'error',
    'ts/no-redeclare': 'error',

    // 型安全性
    'ts/no-explicit-any': 'error',
    'ts/no-unsafe-assignment': 'error',
    'ts/no-unsafe-member-access': 'error',
    'ts/no-unsafe-call': 'error',
    'ts/no-unsafe-argument': 'error',
    'ts/no-unsafe-return': 'error',

    // Promise・非同期処理
    'ts/no-floating-promises': 'error',
    'ts/no-misused-promises': 'error',
    'ts/await-thenable': 'error',

    // スイッチ文の網羅性
    'ts/switch-exhaustiveness-check': 'error',

    // デバッグ
    'no-console': 'off',

    // 日本語正規表現対応
    'regexp/no-obscure-range': 'off',

    // Number周り
    'unicorn/prefer-number-properties': 'off',

    // TypeScriptの過度な厳格さ
    'ts/strict-boolean-expressions': 'off',

    // スタイル系
    'style/max-statements-per-line': 'off',
    'style/indent-binary-ops': 'off',
    'style/no-mixed-spaces-and-tabs': 'off',

    // 実装パターン依存
    'regexp/strict': 'off',
    'no-alert': 'off',
    'no-case-declarations': 'off',
    'no-useless-catch': 'off',
    'one-var': 'off',

    // レガシー対応
    'ts/no-use-before-define': 'off',
    'no-use-before-define': 'off',

    // スタイル系（エラー/自動修正対応）
    'style/brace-style': ['error', '1tbs', { allowSingleLine: true }],
    'style/arrow-parens': ['error', 'always'],
  },
}, {
  // ============================================
  // .ts ファイル専用ルール
  // ============================================
  files: ['**/*.ts'],
  rules: {
    'ts/no-floating-promises': 'error',
    'ts/no-misused-promises': 'error',
    'ts/await-thenable': 'error',
  },
}, {
  // ============================================
  // .svelte ファイル専用ルール
  // ============================================
  files: ['**/*.svelte'],
  languageOptions: {
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  rules: {
    // Svelte 固有の誤検知
    'ts/no-unsafe-member-access': 'off',
    'import/no-mutable-exports': 'off',

    // Promise・非同期処理
    'ts/no-floating-promises': 'error',
    'ts/no-misused-promises': 'error',
    'ts/await-thenable': 'error',

    // 変数管理
    'ts/no-unused-vars': 'error',
    'no-unused-expressions': 'error',

    // 型安全性
    'ts/no-explicit-any': 'error',

    // Svelte セキュリティ
    'svelte/no-at-html-tags': 'error',
  },
})
