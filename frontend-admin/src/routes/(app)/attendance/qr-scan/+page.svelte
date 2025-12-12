<script lang='ts'>
	import { browser } from '$app/environment'
	import { onDestroy, onMount } from 'svelte'

	// 状態管理
	let videoElement: HTMLVideoElement | null = $state(null)
	let stream: MediaStream | null = $state(null)
	let isScanning = $state(false)
	let isProcessing = $state(false)
	let error = $state<string | null>(null)
	let successMessage = $state<string | null>(null)
	let clockType = $state<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN')

	// スキャン履歴
	let scanHistory = $state<Array<{
		timestamp: Date
		user_name: string
		clock_type: 'CLOCK_IN' | 'CLOCK_OUT'
		success: boolean
	}>>([])

	onMount(async () => {
		if (!browser)
			return
		await startScanning()
	})

	onDestroy(() => {
		stopScanning()
	})

	async function startScanning() {
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: 'environment',
					width: { ideal: 640 },
					height: { ideal: 480 },
				},
			})

			if (videoElement) {
				videoElement.srcObject = stream
				await videoElement.play()
			}

			isScanning = true
			error = null

			// 定期的にフレームをスキャン
			void scanLoop()
		} catch {
			error = 'カメラへのアクセスが拒否されました。カメラの許可を確認してください。'
			isScanning = false
		}
	}

	function stopScanning() {
		isScanning = false
		if (stream) {
			for (const track of stream.getTracks()) {
				track.stop()
			}
			stream = null
		}
	}

	interface JsQRModule {
		default: (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null
	}

	interface QRData {
		type: string
		token: string
	}

	interface VerifyResult {
		success: boolean
		user_name?: string
		error?: string
	}

	// QRコードスキャンループ（jsQRを使用）
	async function scanLoop() {
		if (!isScanning || !videoElement || !browser)
			return

		try {
			// 動的にjsQRをインポート
			const jsQRModule = await import('jsqr') as JsQRModule
			const jsQR = jsQRModule.default

			const canvas = document.createElement('canvas')
			const ctx = canvas.getContext('2d')

			if (!ctx)
				return

			canvas.width = videoElement.videoWidth
			canvas.height = videoElement.videoHeight
			ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height)

			const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
			const code = jsQR(imageData.data, imageData.width, imageData.height)

			if (code && !isProcessing) {
				// QRコードが検出された
				await processQRCode(code.data)
			}
		} catch {
		// スキャンエラーは無視（フレームスキップ）
		}

		// 次のフレームをスキャン
		if (isScanning) {
			requestAnimationFrame(() => void scanLoop())
		}
	}

	async function processQRCode(data: string) {
		if (isProcessing)
			return

		isProcessing = true
		error = null
		successMessage = null

		try {
			// QRデータをパース
			const qrData = JSON.parse(data) as QRData

			if (qrData.type !== 'attendance_qr' || !qrData.token) {
				throw new Error('無効なQRコードです')
			}

			// サーバーに検証リクエスト
			const response = await fetch('/attendance/qr-scan/api/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token: qrData.token,
					clock_type: clockType,
				}),
			})

			const result = await response.json() as VerifyResult

			if (result.success) {
				successMessage = `${result.user_name ?? 'ユーザー'}の${clockType === 'CLOCK_IN' ? '出勤' : '退勤'}打刻を承認しました`

				// 履歴に追加
				scanHistory = [
					{
						timestamp: new Date(),
						user_name: result.user_name ?? '不明',
						clock_type: clockType,
						success: true,
					},
					...scanHistory.slice(0, 9), // 最新10件を保持
				]

				// 成功音を鳴らす（オプション）
				playSound('success')
			} else {
				error = result.error ?? 'QRコードの検証に失敗しました'

				// エラー音
				playSound('error')
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'QRコードの処理に失敗しました'
			playSound('error')
		} finally {
			isProcessing = false

			// 3秒後にメッセージをクリア
			setTimeout(() => {
				successMessage = null
				error = null
			}, 3000)
		}
	}

	function playSound(type: 'success' | 'error') {
		// Web Audio APIで簡単なビープ音を鳴らす
		if (!browser)
			return

		try {
			const audioContext = new AudioContext()
			const oscillator = audioContext.createOscillator()
			const gainNode = audioContext.createGain()

			oscillator.connect(gainNode)
			gainNode.connect(audioContext.destination)

			oscillator.frequency.value = type === 'success' ? 800 : 400
			oscillator.type = 'sine'

			gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
			gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)

			oscillator.start(audioContext.currentTime)
			oscillator.stop(audioContext.currentTime + 0.2)
		} catch {
		// サウンド再生エラーは無視
		}
	}

	// 時刻フォーマット
	function formatTime(date: Date): string {
		return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
	}
</script>

<svelte:head>
	<title>QRコードスキャン - DAT勤怠管理</title>
</svelte:head>

<div class='space-y-6'>
	<!-- ヘッダー -->
	<div class='flex items-center justify-between'>
		<div>
			<h1 class='text-2xl font-bold text-base-content'>QRコードスキャン</h1>
			<p class='text-base-content/60 mt-1'>ユーザーのQRコードをスキャンして打刻を承認</p>
		</div>
		<a href='/attendance' class='btn btn-ghost'>
			<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
			</svg>
			勤怠管理に戻る
		</a>
	</div>

	<div class='grid grid-cols-1 lg:grid-cols-2 gap-6'>
		<!-- スキャンエリア -->
		<div class='card bg-base-100 shadow-xl'>
			<div class='card-body'>
				<h2 class='card-title'>スキャナー</h2>

				<!-- 打刻種別選択 -->
				<div class='flex gap-2 mb-4'>
					<button
						onclick={() => clockType = 'CLOCK_IN'}
						class='btn flex-1 {clockType === 'CLOCK_IN' ? 'btn-primary' : 'btn-outline'}'
					>
						<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1' />
						</svg>
						出勤
					</button>
					<button
						onclick={() => clockType = 'CLOCK_OUT'}
						class='btn flex-1 {clockType === 'CLOCK_OUT' ? 'btn-warning' : 'btn-outline'}'
					>
						<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
						</svg>
						退勤
					</button>
				</div>

				<!-- カメラ表示 -->
				<div class='relative bg-base-300 rounded-xl overflow-hidden aspect-video'>
					<video
						bind:this={videoElement}
						class='w-full h-full object-cover'
						autoplay
						playsinline
						muted
					></video>

					<!-- スキャンオーバーレイ -->
					<div class='absolute inset-0 flex items-center justify-center pointer-events-none'>
						<div class='w-48 h-48 border-2 border-primary rounded-lg opacity-50'></div>
					</div>

					<!-- 処理中オーバーレイ -->
					{#if isProcessing}
						<div class='absolute inset-0 bg-black/50 flex items-center justify-center'>
							<span class='loading loading-spinner loading-lg text-white'></span>
						</div>
					{/if}

					<!-- 成功オーバーレイ -->
					{#if successMessage}
						<div class='absolute inset-0 bg-success/80 flex items-center justify-center'>
							<div class='text-center text-white'>
								<svg xmlns='http://www.w3.org/2000/svg' class='h-16 w-16 mx-auto mb-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
									<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7' />
								</svg>
								<p class='text-lg font-bold'>{successMessage}</p>
							</div>
						</div>
					{/if}

					<!-- エラーオーバーレイ -->
					{#if error}
						<div class='absolute inset-0 bg-error/80 flex items-center justify-center'>
							<div class='text-center text-white'>
								<svg xmlns='http://www.w3.org/2000/svg' class='h-16 w-16 mx-auto mb-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
									<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
								</svg>
								<p class='text-lg font-bold'>{error}</p>
							</div>
						</div>
					{/if}
				</div>

				<!-- ステータス -->
				<div class='flex items-center justify-center gap-2 mt-4'>
					{#if isScanning}
						<span class='relative flex h-3 w-3'>
							<span class='animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75'></span>
							<span class='relative inline-flex rounded-full h-3 w-3 bg-success'></span>
						</span>
						<span class='text-sm text-success'>スキャン中...</span>
					{:else}
						<span class='w-3 h-3 rounded-full bg-base-300'></span>
						<span class='text-sm text-base-content/60'>停止中</span>
					{/if}
				</div>
			</div>
		</div>

		<!-- スキャン履歴 -->
		<div class='card bg-base-100 shadow-xl'>
			<div class='card-body'>
				<h2 class='card-title'>スキャン履歴</h2>

				{#if scanHistory.length === 0}
					<div class='flex flex-col items-center justify-center py-8 text-base-content/60'>
						<svg xmlns='http://www.w3.org/2000/svg' class='h-12 w-12 mb-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' />
						</svg>
						<p>スキャン履歴はありません</p>
					</div>
				{:else}
					<div class='space-y-2 max-h-96 overflow-y-auto'>
						{#each scanHistory as item}
							<div class='flex items-center gap-3 p-3 bg-base-200 rounded-lg'>
								<div class='w-10 h-10 rounded-full flex items-center justify-center {item.clock_type === 'CLOCK_IN' ? 'bg-primary/20 text-primary' : 'bg-warning/20 text-warning'}'>
									{#if item.clock_type === 'CLOCK_IN'}
										<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
											<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1' />
										</svg>
									{:else}
										<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
											<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
										</svg>
									{/if}
								</div>
								<div class='flex-1'>
									<div class='font-medium'>{item.user_name}</div>
									<div class='text-sm text-base-content/60'>
										{item.clock_type === 'CLOCK_IN' ? '出勤' : '退勤'} - {formatTime(item.timestamp)}
									</div>
								</div>
								{#if item.success}
									<span class='badge badge-success'>成功</span>
								{:else}
									<span class='badge badge-error'>失敗</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>

	<!-- 使い方 -->
	<div class='alert alert-info'>
		<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
			<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
		</svg>
		<div>
			<h3 class='font-bold'>使い方</h3>
			<div class='text-sm'>
				<ol class='list-decimal list-inside space-y-1'>
					<li>出勤/退勤を選択してください</li>
					<li>ユーザーのスマートフォンに表示されたQRコードをカメラにかざしてください</li>
					<li>QRコードが読み取られると自動的に打刻が承認されます</li>
				</ol>
			</div>
		</div>
	</div>
</div>
