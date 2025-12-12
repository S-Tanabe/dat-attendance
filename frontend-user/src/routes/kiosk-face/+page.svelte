<script lang='ts'>
	import { browser } from '$app/environment'
	import { onDestroy, onMount } from 'svelte'

	// 状態管理
	let videoElement: HTMLVideoElement | null = $state(null)
	let canvasElement: HTMLCanvasElement | null = $state(null)
	let stream: MediaStream | null = $state(null)
	let isScanning = $state(false)
	let isProcessing = $state(false)
	let isModelLoading = $state(true)
	let error = $state<string | null>(null)
	let successMessage = $state<string | null>(null)
	let successUserName = $state<string | null>(null)
	let clockType = $state<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN')
	let currentTime = $state(new Date())

	// スキャン完了後のカメラ停止を制御
	let scanCompleted = $state(false)

	// face-api.js
	let faceapi: typeof import('face-api.js') | null = null

	// 時計更新
	let timeInterval: ReturnType<typeof setInterval> | null = null

	onMount(async () => {
		if (!browser)
			return

		// 1秒ごとに時刻更新
		timeInterval = setInterval(() => {
			currentTime = new Date()
		}, 1000)

		// face-api.jsのモデルを読み込む
		await loadFaceApiModels()
	})

	onDestroy(() => {
		stopScanning()
		if (timeInterval) {
			clearInterval(timeInterval)
		}
	})

	async function loadFaceApiModels() {
		try {
			isModelLoading = true
			faceapi = await import('face-api.js')

			// モデルファイルの場所を指定
			const modelPath = '/models'

			await Promise.all([
				faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
				faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
				faceapi.nets.faceRecognitionNet.loadFromUri(modelPath),
			])

			isModelLoading = false
		} catch (err) {
			console.error('モデル読み込みエラー:', err)
			error = '顔認識モデルの読み込みに失敗しました。ページを再読み込みしてください。'
			isModelLoading = false
		}
	}

	async function startScanning() {
		if (!faceapi || isModelLoading) {
			error = 'モデルがまだ読み込まれていません'
			return
		}

		try {
			// 結果表示をリセット
			error = null
			successMessage = null
			successUserName = null
			scanCompleted = false

			stream = await navigator.mediaDevices.getUserMedia({
				video: {
					facingMode: 'user', // 顔認証は内側カメラ
					width: { ideal: 640 },
					height: { ideal: 480 },
				},
			})

			if (videoElement) {
				videoElement.srcObject = stream
				await videoElement.play()
			}

			isScanning = true

			// 顔検出ループ開始
			void detectFaceLoop()
		} catch {
			error = 'カメラへのアクセスが拒否されました'
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
		if (videoElement) {
			videoElement.srcObject = null
		}
	}

	interface VerifyResult {
		success: boolean
		user_name?: string
		confidence?: number
		error?: string
	}

	// 顔検出ループ
	async function detectFaceLoop() {
		if (!isScanning || !videoElement || !faceapi || !browser)
			return

		try {
			// 顔を検出
			const detection = await faceapi
				.detectSingleFace(videoElement)
				.withFaceLandmarks()
				.withFaceDescriptor()

			if (detection && !isProcessing) {
				// 顔が検出されたら認証処理
				await processDetection(detection.descriptor)
			}
		} catch {
		// 検出エラーは無視
		}

		if (isScanning) {
			requestAnimationFrame(() => void detectFaceLoop())
		}
	}

	async function processDetection(descriptor: Float32Array) {
		if (isProcessing)
			return

		isProcessing = true
		error = null
		successMessage = null
		successUserName = null

		try {
			const response = await fetch('/kiosk-face/api/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					descriptor: Array.from(descriptor),
					clock_type: clockType,
					liveness_check: false,
				}),
			})

			const result = await response.json() as VerifyResult

			if (result.success) {
				successUserName = result.user_name ?? 'ユーザー'
				successMessage = clockType === 'CLOCK_IN' ? '出勤' : '退勤'
				playSound('success')
			} else {
				error = result.error ?? 'エラーが発生しました'
				playSound('error')
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'エラーが発生しました'
			playSound('error')
		} finally {
			isProcessing = false
			scanCompleted = true

			// スキャン完了後、カメラを停止
			stopScanning()
		}
	}

	function playSound(type: 'success' | 'error') {
		if (!browser)
			return

		try {
			const audioContext = new AudioContext()
			const oscillator = audioContext.createOscillator()
			const gainNode = audioContext.createGain()

			oscillator.connect(gainNode)
			gainNode.connect(audioContext.destination)

			if (type === 'success') {
				oscillator.frequency.setValueAtTime(523, audioContext.currentTime) // C5
				oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1) // E5
				oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2) // G5
			} else {
				oscillator.frequency.setValueAtTime(200, audioContext.currentTime)
				oscillator.frequency.setValueAtTime(150, audioContext.currentTime + 0.15)
			}
			oscillator.type = 'sine'

			gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
			gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4)

			oscillator.start(audioContext.currentTime)
			oscillator.stop(audioContext.currentTime + 0.4)
		} catch {
		// ignore
		}
	}

	function formatTimeWithSeconds(date: Date): string {
		return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
	}

	function formatDate(date: Date): string {
		return date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' })
	}
</script>

<svelte:head>
	<title>顔認証打刻端末 - DAT勤怠管理</title>
	<meta name='viewport' content='width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'>
</svelte:head>

<div class='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col overflow-hidden'>
	<!-- ヘッダー：時計 -->
	<header class='relative z-10 py-6 px-8'>
		<div class='flex items-center justify-between'>
			<div>
				<p class='text-slate-400 text-lg'>{formatDate(currentTime)}</p>
				<p class='text-7xl font-extralight text-white tracking-tight tabular-nums'>
					{formatTimeWithSeconds(currentTime)}
				</p>
			</div>
			<div class='text-right'>
				<div class='flex items-center gap-3'>
					{#if isModelLoading}
						<div class='w-3 h-3 rounded-full bg-yellow-400 animate-pulse'></div>
						<span class='text-slate-400 text-sm'>モデル読込中</span>
					{:else if isScanning}
						<div class='w-3 h-3 rounded-full bg-emerald-400 animate-pulse'></div>
						<span class='text-slate-400 text-sm'>認証中</span>
					{:else if scanCompleted}
						<div class='w-3 h-3 rounded-full {successMessage ? 'bg-emerald-400' : 'bg-red-400'}'></div>
						<span class='text-slate-400 text-sm'>完了</span>
					{:else}
						<div class='w-3 h-3 rounded-full bg-slate-600'></div>
						<span class='text-slate-400 text-sm'>待機中</span>
					{/if}
				</div>
			</div>
		</div>
	</header>

	<!-- メインコンテンツ -->
	<main class='flex-1 flex items-center justify-center px-8 pb-8'>
		<div class='w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center'>

			<!-- 左：打刻ボタン -->
			<div class='lg:col-span-4 flex flex-col gap-4'>
				<button
					onclick={() => clockType = 'CLOCK_IN'}
					disabled={isScanning || isProcessing || isModelLoading}
					class='group relative overflow-hidden rounded-3xl p-8 transition-all duration-300 {clockType === 'CLOCK_IN'
						? 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-2xl shadow-emerald-500/30 scale-105'
						: 'bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700'}
						{isScanning || isProcessing || isModelLoading ? 'opacity-50 cursor-not-allowed' : ''}'
				>
					<div class='relative z-10 flex flex-col items-center gap-4'>
						<div class='w-16 h-16 rounded-2xl flex items-center justify-center {clockType === 'CLOCK_IN' ? 'bg-white/20' : 'bg-slate-700'}'>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-8 w-8 {clockType === 'CLOCK_IN' ? 'text-white' : 'text-slate-400'}' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'>
								<path stroke-linecap='round' stroke-linejoin='round' d='M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1' />
							</svg>
						</div>
						<span class='text-2xl font-bold {clockType === 'CLOCK_IN' ? 'text-white' : 'text-slate-300'}'>出勤</span>
					</div>
					{#if clockType === 'CLOCK_IN'}
						<div class='absolute inset-0 bg-gradient-to-t from-emerald-600/50 to-transparent'></div>
					{/if}
				</button>

				<button
					onclick={() => clockType = 'CLOCK_OUT'}
					disabled={isScanning || isProcessing || isModelLoading}
					class='group relative overflow-hidden rounded-3xl p-8 transition-all duration-300 {clockType === 'CLOCK_OUT'
						? 'bg-gradient-to-br from-amber-500 to-orange-500 shadow-2xl shadow-amber-500/30 scale-105'
						: 'bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700'}
						{isScanning || isProcessing || isModelLoading ? 'opacity-50 cursor-not-allowed' : ''}'
				>
					<div class='relative z-10 flex flex-col items-center gap-4'>
						<div class='w-16 h-16 rounded-2xl flex items-center justify-center {clockType === 'CLOCK_OUT' ? 'bg-white/20' : 'bg-slate-700'}'>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-8 w-8 {clockType === 'CLOCK_OUT' ? 'text-white' : 'text-slate-400'}' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'>
								<path stroke-linecap='round' stroke-linejoin='round' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
							</svg>
						</div>
						<span class='text-2xl font-bold {clockType === 'CLOCK_OUT' ? 'text-white' : 'text-slate-300'}'>退勤</span>
					</div>
					{#if clockType === 'CLOCK_OUT'}
						<div class='absolute inset-0 bg-gradient-to-t from-orange-600/50 to-transparent'></div>
					{/if}
				</button>
			</div>

			<!-- 中央：カメラ -->
			<div class='lg:col-span-8'>
				<div class='relative aspect-[4/3] rounded-[2rem] overflow-hidden bg-slate-800 shadow-2xl'>
					<!-- カメラ映像 -->
					<video
						bind:this={videoElement}
						class='absolute inset-0 w-full h-full object-cover {isScanning ? '' : 'hidden'}'
						autoplay
						playsinline
						muted
					></video>
					<canvas bind:this={canvasElement} class='hidden'></canvas>

					<!-- モデル読み込み中 -->
					{#if isModelLoading}
						<div class='absolute inset-0 flex flex-col items-center justify-center bg-slate-800'>
							<div class='text-center'>
								<div class='w-16 h-16 mx-auto mb-6 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin'></div>
								<p class='text-slate-400 text-lg'>顔認識モデルを読み込んでいます...</p>
								<p class='text-slate-500 text-sm mt-2'>初回は少し時間がかかります</p>
							</div>
						</div>
					{:else if !isScanning && !scanCompleted}
						<!-- カメラ停止中の表示 -->
						<div class='absolute inset-0 flex flex-col items-center justify-center bg-slate-800'>
							<div class='text-center'>
								<div class='w-24 h-24 mx-auto mb-6 rounded-full bg-slate-700/50 flex items-center justify-center'>
									<svg xmlns='http://www.w3.org/2000/svg' class='h-12 w-12 text-slate-500' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='1.5'>
										<path stroke-linecap='round' stroke-linejoin='round' d='M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' />
									</svg>
								</div>
								<p class='text-slate-400 text-lg mb-8'>カメラは停止中です</p>
								<button
									onclick={() => void startScanning()}
									class='px-8 py-4 rounded-2xl font-bold text-xl transition-all duration-300 {clockType === 'CLOCK_IN'
										? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-xl shadow-emerald-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 hover:scale-105'
										: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xl shadow-amber-500/30 hover:shadow-2xl hover:shadow-amber-500/40 hover:scale-105'}'
								>
									<span class='flex items-center gap-3'>
										<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2'>
											<path stroke-linecap='round' stroke-linejoin='round' d='M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' />
										</svg>
										顔認証開始
									</span>
								</button>
							</div>
						</div>
					{/if}

					<!-- スキャンフレーム -->
					{#if isScanning}
						<div class='absolute inset-0 flex items-center justify-center pointer-events-none'>
							<!-- 外側の暗いオーバーレイ -->
							<div class='absolute inset-0 bg-black/30'></div>

							<!-- 顔認識枠 -->
							<div class='relative w-64 h-80'>
								<!-- 角のデコレーション -->
								<div class='absolute -top-1 -left-1 w-12 h-12 border-t-4 border-l-4 rounded-tl-2xl {clockType === 'CLOCK_IN' ? 'border-emerald-400' : 'border-amber-400'}'></div>
								<div class='absolute -top-1 -right-1 w-12 h-12 border-t-4 border-r-4 rounded-tr-2xl {clockType === 'CLOCK_IN' ? 'border-emerald-400' : 'border-amber-400'}'></div>
								<div class='absolute -bottom-1 -left-1 w-12 h-12 border-b-4 border-l-4 rounded-bl-2xl {clockType === 'CLOCK_IN' ? 'border-emerald-400' : 'border-amber-400'}'></div>
								<div class='absolute -bottom-1 -right-1 w-12 h-12 border-b-4 border-r-4 rounded-br-2xl {clockType === 'CLOCK_IN' ? 'border-emerald-400' : 'border-amber-400'}'></div>

								<!-- 顔アイコン -->
								<div class='absolute inset-0 flex items-center justify-center'>
									<div class='w-20 h-20 rounded-full border-2 border-dashed {clockType === 'CLOCK_IN' ? 'border-emerald-400/50' : 'border-amber-400/50'} flex items-center justify-center animate-pulse'>
										<svg xmlns='http://www.w3.org/2000/svg' class='h-10 w-10 {clockType === 'CLOCK_IN' ? 'text-emerald-400/50' : 'text-amber-400/50'}' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='1.5'>
											<path stroke-linecap='round' stroke-linejoin='round' d='M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z' />
										</svg>
									</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- 処理中 -->
					{#if isProcessing}
						<div class='absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center'>
							<div class='flex flex-col items-center gap-4'>
								<div class='w-16 h-16 border-4 border-slate-600 border-t-white rounded-full animate-spin'></div>
								<p class='text-white text-xl font-medium'>認証中...</p>
							</div>
						</div>
					{/if}

					<!-- 成功 -->
					{#if successMessage && scanCompleted}
						<div class='absolute inset-0 {clockType === 'CLOCK_IN' ? 'bg-emerald-500' : 'bg-amber-500'} flex items-center justify-center'>
							<div class='text-center text-white'>
								<div class='w-24 h-24 mx-auto mb-6 rounded-full bg-white/20 flex items-center justify-center'>
									<svg xmlns='http://www.w3.org/2000/svg' class='h-14 w-14' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2.5'>
										<path stroke-linecap='round' stroke-linejoin='round' d='M5 13l4 4L19 7' />
									</svg>
								</div>
								<p class='text-4xl font-bold mb-2'>{successUserName}さん</p>
								<p class='text-2xl font-medium opacity-90'>{successMessage}しました</p>
								<button
									onclick={() => { scanCompleted = false; successMessage = null; successUserName = null }}
									class='mt-8 px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl text-lg font-medium transition-colors'
								>
									次の打刻へ
								</button>
							</div>
						</div>
					{/if}

					<!-- エラー -->
					{#if error && scanCompleted}
						<div class='absolute inset-0 bg-red-500 flex items-center justify-center'>
							<div class='text-center text-white'>
								<div class='w-24 h-24 mx-auto mb-6 rounded-full bg-white/20 flex items-center justify-center'>
									<svg xmlns='http://www.w3.org/2000/svg' class='h-14 w-14' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2.5'>
										<path stroke-linecap='round' stroke-linejoin='round' d='M6 18L18 6M6 6l12 12' />
									</svg>
								</div>
								<p class='text-2xl font-bold'>{error}</p>
								<button
									onclick={() => { scanCompleted = false; error = null }}
									class='mt-8 px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl text-lg font-medium transition-colors'
								>
									再試行
								</button>
							</div>
						</div>
					{/if}

					<!-- モデル読み込みエラー -->
					{#if error && !scanCompleted && !isModelLoading}
						<div class='absolute inset-0 bg-red-500 flex items-center justify-center'>
							<div class='text-center text-white p-8'>
								<div class='w-24 h-24 mx-auto mb-6 rounded-full bg-white/20 flex items-center justify-center'>
									<svg xmlns='http://www.w3.org/2000/svg' class='h-14 w-14' fill='none' viewBox='0 0 24 24' stroke='currentColor' stroke-width='2.5'>
										<path stroke-linecap='round' stroke-linejoin='round' d='M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z' />
									</svg>
								</div>
								<p class='text-xl font-bold mb-4'>{error}</p>
								<button
									onclick={() => location.reload()}
									class='px-6 py-3 bg-white/20 hover:bg-white/30 rounded-xl text-lg font-medium transition-colors'
								>
									ページを再読み込み
								</button>
							</div>
						</div>
					{/if}

					<!-- ガイドテキスト -->
					{#if isScanning && !isProcessing}
						<div class='absolute bottom-8 inset-x-0 text-center'>
							<p class='text-white text-xl font-medium drop-shadow-lg'>
								顔をカメラに向けてください
							</p>
						</div>
					{/if}
				</div>
			</div>

		</div>
	</main>

	<!-- フッター -->
	<footer class='py-4 px-8 flex items-center justify-between text-slate-500 text-sm'>
		<span>DAT 勤怠管理システム</span>
		<span class='flex items-center gap-2'>
			<span class='w-2 h-2 rounded-full {isScanning ? 'bg-emerald-400' : 'bg-slate-600'}'></span>
			顔認証打刻端末
		</span>
	</footer>
</div>
