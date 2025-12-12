<script lang='ts'>
	import { browser } from '$app/environment'
	import { onDestroy, onMount } from 'svelte'

	interface TodayStatus {
		has_clocked_in: boolean
		has_clocked_out: boolean
	}

	interface FaceStatus {
		has_face_data: boolean
		face_count: number
	}

	const { data } = $props<{
		data: {
			todayStatus: TodayStatus | null
			faceStatus: FaceStatus
		}
	}>()

	// 状態管理
	let videoElement: HTMLVideoElement | null = $state(null)
	let canvasElement: HTMLCanvasElement | null = $state(null)
	let stream: MediaStream | null = $state(null)
	let isModelLoading = $state(true)
	let isProcessing = $state(false)
	let error = $state<string | null>(null)
	let successMessage = $state<string | null>(null)
	let modelsLoaded = $state(false)
	let clockType = $state<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN')
	let mode = $state<'clock' | 'register'>('clock')

	// face-api.js のモジュール（動的インポート用）
	let faceapi: typeof import('face-api.js') | null = $state(null)

	// 現在の打刻状態から適切な打刻種別を判定
	$effect(() => {
		if (data.todayStatus?.has_clocked_in && !data.todayStatus?.has_clocked_out) {
			clockType = 'CLOCK_OUT'
		} else {
			clockType = 'CLOCK_IN'
		}
	})

	// 顔データが登録されていない場合は登録モードに
	$effect(() => {
		if (!data.faceStatus.has_face_data) {
			mode = 'register'
		}
	})

	onMount(async () => {
		if (!browser)
			return

		try {
			// face-api.js を動的インポート
			faceapi = await import('face-api.js')

			// モデルをロード（CDNから）
			const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model'
			await Promise.all([
				faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
				faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
				faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
			])

			modelsLoaded = true
			isModelLoading = false

			// カメラを起動
			await startCamera()
		} catch (e) {
			error = e instanceof Error ? e.message : 'モデルの読み込みに失敗しました'
			isModelLoading = false
		}
	})

	onDestroy(() => {
		stopCamera()
	})

	async function startCamera() {
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: 'user',
					width: { ideal: 640 },
					height: { ideal: 480 },
				},
			})

			if (videoElement) {
				videoElement.srcObject = stream
				await videoElement.play()
			}
		} catch {
			error = 'カメラへのアクセスが拒否されました。カメラの許可を確認してください。'
		}
	}

	function stopCamera() {
		if (stream) {
			for (const track of stream.getTracks()) {
				track.stop()
			}
			stream = null
		}
	}

	interface RegisterResult {
		error?: string
		success?: boolean
	}

	interface VerifyResult {
		error?: string
		success?: boolean
		confidence?: number
	}

	async function captureAndProcess() {
		if (!faceapi || !videoElement || !canvasElement || !modelsLoaded) {
			error = 'カメラまたはモデルの準備ができていません'
			return
		}

		isProcessing = true
		error = null
		successMessage = null

		try {
			// 顔を検出
			const detection = await faceapi
				.detectSingleFace(videoElement, new faceapi.TinyFaceDetectorOptions())
				.withFaceLandmarks()
				.withFaceDescriptor()

			if (!detection) {
				error = '顔が検出できませんでした。カメラに顔を向けてください。'
				isProcessing = false
				return
			}

			// 顔特徴ベクトルを取得（128次元）
			const descriptor = Array.from(detection.descriptor)

			if (mode === 'register') {
				// 顔データを登録
				const response = await fetch('/dashboard/face/api/register', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ descriptor }),
				})

				const result = await response.json() as RegisterResult

				if (!response.ok || result.error) {
					throw new Error(result.error ?? '顔データの登録に失敗しました')
				}

				successMessage = '顔データを登録しました'
				mode = 'clock'
			} else {
				// 顔認証で打刻
				const response = await fetch('/dashboard/face/api/verify', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						descriptor,
						clock_type: clockType,
						liveness_check: true,
					}),
				})

				const result = await response.json() as VerifyResult

				if (!response.ok || !result.success) {
					throw new Error(result.error ?? '顔認証に失敗しました')
				}

				successMessage = `${clockType === 'CLOCK_IN' ? '出勤' : '退勤'}打刻が完了しました（一致度: ${Math.round((result.confidence ?? 0) * 100)}%）`
			}
		} catch (e) {
			error = e instanceof Error ? e.message : '処理に失敗しました'
		} finally {
			isProcessing = false
		}
	}
</script>

<svelte:head>
	<title>顔認証打刻 - DAT勤怠</title>
</svelte:head>

<div class='flex flex-col items-center space-y-6'>
	<div class='text-center'>
		<h1 class='text-xl font-bold text-slate-800 dark:text-slate-100'>
			{mode === 'register' ? '顔データ登録' : '顔認証打刻'}
		</h1>
		<p class='text-sm text-slate-500 dark:text-slate-400 mt-1'>
			{mode === 'register' ? 'カメラに顔を向けて登録ボタンを押してください' : 'カメラに顔を向けて認証ボタンを押してください'}
		</p>
	</div>

	<!-- モード切替（顔データ登録済みの場合） -->
	{#if data.faceStatus.has_face_data}
		<div class='flex gap-2'>
			<button
				onclick={() => mode = 'clock'}
				class='px-4 py-2 rounded-lg text-sm font-medium transition-colors {mode === 'clock' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}'
			>
				打刻
			</button>
			<button
				onclick={() => mode = 'register'}
				class='px-4 py-2 rounded-lg text-sm font-medium transition-colors {mode === 'register' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}'
			>
				顔データ更新
			</button>
		</div>
	{/if}

	<!-- 打刻種別表示（打刻モード時のみ） -->
	{#if mode === 'clock'}
		<div class='inline-flex items-center gap-2 px-4 py-2 rounded-full {clockType === 'CLOCK_IN' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'}'>
			{#if clockType === 'CLOCK_IN'}
				<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1' />
				</svg>
				<span class='text-sm font-medium'>出勤</span>
			{:else}
				<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
				</svg>
				<span class='text-sm font-medium'>退勤</span>
			{/if}
		</div>
	{/if}

	<!-- カメラ表示エリア -->
	<div class='bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 overflow-hidden'>
		{#if isModelLoading}
			<div class='w-80 h-60 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-xl'>
				<div class='flex flex-col items-center gap-3'>
					<span class='loading loading-spinner loading-lg text-blue-500'></span>
					<span class='text-sm text-slate-500 dark:text-slate-400'>モデルを読み込み中...</span>
				</div>
			</div>
		{:else}
			<div class='relative'>
				<video
					bind:this={videoElement}
					class='w-80 h-60 object-cover rounded-xl bg-slate-900'
					autoplay
					playsinline
					muted
				></video>
				<canvas
					bind:this={canvasElement}
					class='absolute top-0 left-0 w-80 h-60'
				></canvas>

				<!-- オーバーレイ（処理中） -->
				{#if isProcessing}
					<div class='absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center'>
						<div class='flex flex-col items-center gap-2'>
							<span class='loading loading-spinner loading-lg text-white'></span>
							<span class='text-sm text-white'>処理中...</span>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- エラーメッセージ -->
	{#if error}
		<div class='w-full bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4'>
			<div class='flex items-center gap-2'>
				<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-red-500 flex-shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
				</svg>
				<span class='text-sm text-red-700 dark:text-red-300'>{error}</span>
			</div>
		</div>
	{/if}

	<!-- 成功メッセージ -->
	{#if successMessage}
		<div class='w-full bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-4'>
			<div class='flex items-center gap-2'>
				<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-green-500 flex-shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7' />
				</svg>
				<span class='text-sm text-green-700 dark:text-green-300'>{successMessage}</span>
			</div>
		</div>
	{/if}

	<!-- アクションボタン -->
	<button
		onclick={() => void captureAndProcess()}
		disabled={isModelLoading || isProcessing || !modelsLoaded}
		class='w-full max-w-xs h-14 rounded-2xl text-lg font-semibold transition-all duration-200 flex items-center justify-center gap-3
			{mode === 'register'
				? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40'
				: clockType === 'CLOCK_IN'
				? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40'
				: 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40'}
			disabled:opacity-50 disabled:cursor-not-allowed'
	>
		{#if isProcessing}
			<span class='loading loading-spinner loading-md'></span>
			処理中...
		{:else if mode === 'register'}
			<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7' />
			</svg>
			顔データを登録
		{:else}
			<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
			</svg>
			顔認証で{clockType === 'CLOCK_IN' ? '出勤' : '退勤'}
		{/if}
	</button>

	<!-- 説明 -->
	<div class='bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm'>
		<div class='flex items-start gap-3'>
			<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
			</svg>
			<div class='text-blue-700 dark:text-blue-300'>
				<p class='font-medium mb-1'>使い方</p>
				<ol class='list-decimal list-inside space-y-1 text-blue-600 dark:text-blue-400'>
					{#if mode === 'register'}
						<li>カメラに正面から顔を向けてください</li>
						<li>「顔データを登録」ボタンを押してください</li>
						<li>登録完了後、顔認証で打刻できます</li>
					{:else}
						<li>カメラに正面から顔を向けてください</li>
						<li>「顔認証で{clockType === 'CLOCK_IN' ? '出勤' : '退勤'}」ボタンを押してください</li>
						<li>認証に成功すると自動的に打刻されます</li>
					{/if}
				</ol>
			</div>
		</div>
	</div>

	<!-- 戻るボタン -->
	<a
		href='/dashboard'
		class='text-sm text-blue-600 dark:text-blue-400 hover:underline'
	>
		ダッシュボードに戻る
	</a>
</div>
