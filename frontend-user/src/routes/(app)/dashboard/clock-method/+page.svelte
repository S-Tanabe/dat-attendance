<script lang='ts'>
	import { goto } from '$app/navigation'

	// 打刻方法の定義
	const clockMethods = [
		{
			code: 'button',
			name: 'ボタン打刻',
			description: '画面のボタンをタップして打刻',
			icon: 'button',
			available: true,
		},
		{
			code: 'qr_code',
			name: 'QRコード打刻',
			description: 'QRコードを表示して受付でスキャン',
			icon: 'qr',
			available: true,
		},
		{
			code: 'face_recognition',
			name: '顔認証打刻',
			description: 'カメラで顔を撮影して打刻',
			icon: 'face',
			available: true,
		},
	]

	function selectMethod(code: string) {
		if (code === 'button') {
			// ボタン打刻はダッシュボードへ戻る
			void goto('/dashboard')
		} else if (code === 'qr_code') {
			void goto('/dashboard/qr')
		} else if (code === 'face_recognition') {
			void goto('/dashboard/face')
		}
	}
</script>

<svelte:head>
	<title>打刻方法選択 - DAT勤怠</title>
</svelte:head>

<div class='flex flex-col space-y-6'>
	<div class='text-center'>
		<h1 class='text-xl font-bold text-slate-800 dark:text-slate-100'>打刻方法を選択</h1>
		<p class='text-sm text-slate-500 dark:text-slate-400 mt-1'>使用する打刻方法を選んでください</p>
	</div>

	<div class='space-y-3'>
		{#each clockMethods as method}
			<button
				onclick={() => selectMethod(method.code)}
				class='w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
				disabled={!method.available}
			>
				<!-- アイコン -->
				<div class='w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 {method.code === 'button' ? 'bg-blue-100 dark:bg-blue-900/40' : method.code === 'qr_code' ? 'bg-purple-100 dark:bg-purple-900/40' : 'bg-green-100 dark:bg-green-900/40'}'>
					{#if method.icon === 'button'}
						<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6 text-blue-600 dark:text-blue-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122' />
						</svg>
					{:else if method.icon === 'qr'}
						<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6 text-purple-600 dark:text-purple-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z' />
						</svg>
					{:else if method.icon === 'face'}
						<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6 text-green-600 dark:text-green-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
						</svg>
					{/if}
				</div>

				<!-- テキスト -->
				<div class='flex-1 text-left'>
					<div class='font-medium text-slate-800 dark:text-slate-100'>{method.name}</div>
					<div class='text-sm text-slate-500 dark:text-slate-400'>{method.description}</div>
				</div>

				<!-- 矢印 -->
				<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-slate-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 5l7 7-7 7' />
				</svg>
			</button>
		{/each}
	</div>

	<!-- 戻るボタン -->
	<div class='text-center'>
		<a href='/dashboard' class='text-sm text-blue-600 dark:text-blue-400 hover:underline'>
			ダッシュボードに戻る
		</a>
	</div>
</div>
