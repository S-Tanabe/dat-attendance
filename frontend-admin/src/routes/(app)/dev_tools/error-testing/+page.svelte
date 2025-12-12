<script lang='ts'>
	import type { UIError } from '$lib/errors/types'
	import { browserClient, withErrorHandling } from '$lib/api/client'
	import ErrorToast from '$lib/components/ErrorToast.svelte'
	import { clearError, globalError } from '$lib/stores/error'
	import * as Sentry from '@sentry/sveltekit'
	import { onMount } from 'svelte'

	let isLoading = $state(false)
	let lastResult = $state<string | null>(null)
	let lastError = $state<UIError | null>(null)

	const client = browserClient()

	// エラーテストAPI用のSDK拡張
	// 生成されたクライアントにメソッドが含まれていないため、生成SDKと同じパターンで拡張
	// NOTE: baseClient.callTypedAPI()を使うことで、SDKとして正しく動作し、withErrorHandling経由でエラーハンドリングが機能する

	// BaseClientの型定義（生成されたSDKから取得）
	interface BaseClient {
		callTypedAPI: (method: string, path: string) => Promise<Response>
	}

	// baseClientはprivateなので、unknown経由でアクセス
	const baseClient = (client.dev_tools as unknown as { baseClient: BaseClient }).baseClient

	const devTools = {
		testValidationError: async (): Promise<{ message: string }> => {
			const resp = await baseClient.callTypedAPI('GET', '/dev_tools/error-test/validation')
			return await resp.json() as { message: string }
		},
		testAuthenticationError: async (): Promise<{ message: string }> => {
			const resp = await baseClient.callTypedAPI('GET', '/dev_tools/error-test/auth')
			return await resp.json() as { message: string }
		},
		testPermissionError: async (): Promise<{ message: string }> => {
			const resp = await baseClient.callTypedAPI('GET', '/dev_tools/error-test/permission')
			return await resp.json() as { message: string }
		},
		testNotFoundError: async (): Promise<{ message: string }> => {
			const resp = await baseClient.callTypedAPI('GET', '/dev_tools/error-test/notfound')
			return await resp.json() as { message: string }
		},
		testRetryableBusinessError: async (): Promise<{ message: string }> => {
			const resp = await baseClient.callTypedAPI('GET', '/dev_tools/error-test/business-retryable')
			return await resp.json() as { message: string }
		},
		testNonRetryableBusinessError: async (): Promise<{ message: string }> => {
			const resp = await baseClient.callTypedAPI('GET', '/dev_tools/error-test/business-non-retryable')
			return await resp.json() as { message: string }
		},
		testInternalError: async (): Promise<{ message: string }> => {
			const resp = await baseClient.callTypedAPI('GET', '/dev_tools/error-test/internal')
			return await resp.json() as { message: string }
		},
		testSuccess: async (): Promise<{ message: string }> => {
			const resp = await baseClient.callTypedAPI('GET', '/dev_tools/error-test/success')
			return await resp.json() as { message: string }
		},
	}

	// ページマウント時にエラーをクリア + Sentryタグ設定
	onMount(() => {
		clearError()

		// ✅ コンポーネント固有のタグを設定
		Sentry.setTag('component', 'ErrorTestingPage')
		Sentry.setTag('page', 'error-testing')

	// NOTE: ユーザーコンテキストは実際のログイン情報を使用するため、
		// ここでは設定しない（認証フロー側でsetSentryUser()を呼び出す）
	})

	interface TestCase {
		name: string
		description: string
		endpoint: () => Promise<unknown>
		category: 'validation' | 'auth' | 'business' | 'system'
	}

	const testCases: TestCase[] = [
		{
			name: 'バリデーションエラー',
			description: '入力値が不正な場合のエラー（400）',
			endpoint: () => devTools.testValidationError(),
			category: 'validation',
		},
		{
			name: '認証エラー',
			description: 'トークンが期限切れの場合のエラー（401）',
			endpoint: () => devTools.testAuthenticationError(),
			category: 'auth',
		},
		{
			name: '権限エラー',
			description: '操作の権限がない場合のエラー（403）',
			endpoint: () => devTools.testPermissionError(),
			category: 'auth',
		},
		{
			name: 'リソース不在エラー',
			description: '指定されたリソースが見つからない場合のエラー（404）',
			endpoint: () => devTools.testNotFoundError(),
			category: 'validation',
		},
		{
			name: 'ビジネスエラー（再試行可能）',
			description: 'アカウント停止などの再試行可能なエラー',
			endpoint: () => devTools.testRetryableBusinessError(),
			category: 'business',
		},
		{
			name: 'ビジネスエラー（再試行不可）',
			description: 'メールアドレス重複などの再試行不可エラー',
			endpoint: () => devTools.testNonRetryableBusinessError(),
			category: 'business',
		},
		{
			name: 'システムエラー',
			description: '予期しないサーバーエラー（500）',
			endpoint: () => devTools.testInternalError(),
			category: 'system',
		},
		{
			name: '正常レスポンス',
			description: 'エラーなし（200）',
			endpoint: () => devTools.testSuccess(),
			category: 'validation',
		},
	]

	async function executeTest(testCase: TestCase) {
		isLoading = true
		lastResult = null
		lastError = null
		clearError()

		// ✅ アクションタグを設定
		Sentry.setTag('action', `test-${testCase.category}`)

		try {
			const result = await withErrorHandling(testCase.endpoint, {
				showGlobalError: true,
				redirectOnAuthError: false, // テストページなのでリダイレクトしない
				autoCloseMs: 0, // 手動でクリアするまで表示
			})

			// 成功時はアクションタグをクリア
			Sentry.setTag('action', null)

			lastResult = JSON.stringify(result, null, 2)
			lastError = null
		} catch (error) {
			// ✅ エラー時の追加コンテキスト
			Sentry.setContext('test_execution', {
				testName: testCase.name,
				testCategory: testCase.category,
				timestamp: new Date().toISOString(),
			})

			lastError = error as UIError
			lastResult = null
		} finally {
			isLoading = false
		}
	}

	function getCategoryColor(category: string): string {
		switch (category) {
			case 'validation':
				return 'badge-warning'
			case 'auth':
				return 'badge-error'
			case 'business':
				return 'badge-info'
			case 'system':
				return 'badge-secondary'
			default:
				return 'badge-ghost'
		}
	}
</script>

<div class='container mx-auto p-6'>
	<div class='mb-6'>
		<h1 class='text-3xl font-bold mb-2'>エラーハンドリングテスト</h1>
		<p class='text-base-content/60'>
			各種エラーをテストして、エラーハンドリングシステムの動作を確認できます。
		</p>
	</div>

	<!-- グローバルエラートースト -->
	{#if $globalError}
		<ErrorToast error={$globalError} />
	{/if}

	<!-- テストケース一覧 -->
	<div class='grid grid-cols-1 md:grid-cols-2 gap-4 mb-6'>
		{#each testCases as testCase}
			<div class='card bg-base-200 shadow-md'>
				<div class='card-body'>
					<div class='flex items-center justify-between mb-2'>
						<h2 class='card-title text-lg'>{testCase.name}</h2>
						<span class='badge {getCategoryColor(testCase.category)}'>
							{testCase.category}
						</span>
					</div>
					<p class='text-sm text-base-content/60 mb-4'>{testCase.description}</p>
					<div class='card-actions justify-end'>
						<button
							class='btn btn-primary btn-sm'
							onclick={() => executeTest(testCase)}
							disabled={isLoading}
						>
							{#if isLoading}
								<span class='loading loading-spinner loading-sm'></span>
							{/if}
							実行
						</button>
					</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- 結果表示エリア -->
	{#if lastResult || lastError}
		<div class='card bg-base-100 shadow-xl'>
			<div class='card-body'>
				<h2 class='card-title mb-4'>
					{#if lastResult}
						✅ 成功
					{:else}
						❌ エラー発生
					{/if}
				</h2>

				{#if lastResult}
					<div class='mockup-code'>
						<pre><code>{lastResult}</code></pre>
					</div>
				{/if}

				{#if lastError}
					<div class='space-y-4'>
						<div class='alert alert-error'>
							<svg
								xmlns='http://www.w3.org/2000/svg'
								class='stroke-current shrink-0 h-6 w-6'
								fill='none'
								viewBox='0 0 24 24'
							>
								<path
									stroke-linecap='round'
									stroke-linejoin='round'
									stroke-width='2'
									d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
								/>
							</svg>
							<div>
								<h3 class='font-bold'>エラーコード: {lastError.code}</h3>
								<div class='text-sm'>{lastError.userMessage}</div>
							</div>
						</div>

						<div class='stats stats-vertical lg:stats-horizontal shadow w-full'>
							<div class='stat'>
								<div class='stat-title'>ステータスコード</div>
								<div class='stat-value text-2xl'>{lastError.statusCode}</div>
							</div>

							<div class='stat'>
								<div class='stat-title'>再試行可能</div>
								<div class='stat-value text-2xl'>
									{lastError.details?.retryable ? '✅ Yes' : '❌ No'}
								</div>
							</div>

							{#if lastError.details?.suggestedAction}
								<div class='stat'>
									<div class='stat-title'>推奨アクション</div>
									<div class='stat-value text-lg'>
										{lastError.details.suggestedAction}
									</div>
								</div>
							{/if}
						</div>

						{#if lastError.details?.reason}
							<div class='mockup-code'>
								<pre class='text-sm'><code>{lastError.details.reason}</code></pre>
							</div>
						{/if}

						{#if lastError.details?.metadata}
							<details class='collapse collapse-arrow bg-base-200'>
								<summary class='collapse-title font-medium'>メタデータ</summary>
								<div class='collapse-content'>
									<pre class='text-sm'><code>{JSON.stringify(lastError.details.metadata, null, 2)}</code></pre>
								</div>
							</details>
						{/if}
					</div>
				{/if}

				<div class='card-actions justify-end mt-4'>
					<button
						class='btn btn-ghost btn-sm'
						onclick={() => {
							lastResult = null
							lastError = null
							clearError()
						}}
					>
						クリア
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- 説明セクション -->
	<div class='mt-8 prose max-w-none'>
		<h2>使い方</h2>
		<ol>
			<li>上記のテストケースから任意のエラーを選択して「実行」ボタンをクリック</li>
			<li>画面右上にエラートーストが表示されます</li>
			<li>下部の結果表示エリアに詳細情報が表示されます</li>
			<li>ブラウザの開発者ツールでもエラーログを確認できます</li>
		</ol>

		<h2>エラーカテゴリ</h2>
		<ul>
			<li><strong>validation</strong>: 入力バリデーションエラー（400, 404）</li>
			<li><strong>auth</strong>: 認証・権限エラー（401, 403）</li>
			<li><strong>business</strong>: ビジネスロジックエラー</li>
			<li><strong>system</strong>: システムエラー（500）</li>
		</ul>
	</div>
</div>

<style>
  .container {
    max-width: 1200px;
  }
</style>
