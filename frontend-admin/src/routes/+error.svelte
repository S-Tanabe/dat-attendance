<script lang='ts'>
	import { goto } from '$app/navigation'
	import { page } from '$app/stores'
	import { onMount } from 'svelte'

	// エラーステータスコードを取得
	const status = $derived($page.status || 500)
	const errorCode = $derived(String(status))

	let glitchText = $state('500')
	const showGlitch = $state(true)

	// グリッチエフェクト用のランダム文字
	const glitchChars = '!@#$%^&*()_+-=[]{}|;:,.<>?0123456789ABCDEF'

	// ステータスコード別のメッセージ
	const errorMessages: Record<number, { title: string, message: string, action?: string }> = {
		400: {
			title: 'BAD REQUEST',
			message: 'リクエストが不正です。入力内容を確認してください。',
		},
		401: {
			title: 'UNAUTHORIZED',
			message: 'ログインが必要です。',
			action: 'relogin',
		},
		403: {
			title: 'FORBIDDEN',
			message: 'この操作を実行する権限がありません。',
		},
		404: {
			title: 'PAGE NOT FOUND',
			message: 'お探しのページが見つかりません。',
		},
		500: {
			title: 'INTERNAL SERVER ERROR',
			message: 'サーバーエラーが発生しました。しばらく待ってから再度お試しください。',
		},
		503: {
			title: 'SERVICE UNAVAILABLE',
			message: 'サービスが一時的に利用できません。しばらく待ってからお試しください。',
		},
	}

	const errorInfo = $derived(errorMessages[status] || errorMessages[500])

	// エラーコードが変わったらグリッチテキストも更新
	$effect(() => {
		glitchText = errorCode
	})

	onMount(() => {
		// グリッチアニメーション
		const interval = setInterval(() => {
			if (Math.random() > 0.7) {
				let newText = ''
				for (let i = 0; i < errorCode.length; i++) {
					if (Math.random() > 0.5) {
						newText += glitchChars[Math.floor(Math.random() * glitchChars.length)]
					} else {
						newText += errorCode[i]
					}
				}
				glitchText = newText

				setTimeout(() => {
					glitchText = errorCode
				}, 100)
			}
		}, 2000)

		return () => clearInterval(interval)
	})

	function handleAction() {
		if (errorInfo.action === 'relogin') {
			void goto('/login')
		} else {
			void goto('/')
		}
	}
</script>

<svelte:head>
	<title>{status} - {errorInfo.title}</title>
</svelte:head>

<div class='min-h-screen bg-base-300 flex items-center justify-center p-4 overflow-hidden'>
	<div class='relative'>
		<!-- メインコンテンツ -->
		<div class='text-center'>
			<!-- グリッチエフェクト付き404 -->
			<div class='relative mb-8'>
				<h1
					class='text-[10rem] md:text-[15rem] font-bold leading-none select-none'
					style="font-family: 'Courier New', monospace;"
				>
					<span class='relative inline-block'>
						<span class='text-base-content opacity-20 absolute inset-0 blur-sm'>{glitchText}</span>
						<span class='text-primary relative z-10 glitch-effect'>{glitchText}</span>
						{#if showGlitch}
							<span class='text-error absolute inset-0 animate-pulse opacity-50' style='transform: translate(2px, -2px);'>{glitchText}</span>
							<span class='text-info absolute inset-0 animate-pulse opacity-30' style='transform: translate(-2px, 2px);'>{glitchText}</span>
						{/if}
					</span>
				</h1>
			</div>

			<!-- エラーメッセージ -->
			<div class='max-w-md mx-auto mb-8'>
				<h2 class='text-2xl md:text-3xl font-bold text-base-content mb-4'>
					{errorInfo.title}
				</h2>
				<p class='text-base-content/60 mb-2'>
					{errorInfo.message}
				</p>

				{#if $page.error?.message}
					<p class='text-sm text-base-content/40 mt-2'>
						{$page.error.message}
					</p>
				{/if}

				<!-- パスを控えめに表示 -->
				{#if status === 404}
					<div class='inline-block mt-4 px-4 py-2 bg-base-200 rounded-lg'>
						<code class='text-sm text-base-content/50'>
							{$page.url.pathname}
						</code>
					</div>
				{/if}
			</div>

			<!-- アクションボタン -->
			<div class='flex justify-center'>
				<button
					class='btn btn-primary btn-lg group'
					onclick={handleAction}
				>
					<svg
						xmlns='http://www.w3.org/2000/svg'
						class='h-6 w-6 mr-2 transition-transform group-hover:-translate-x-1'
						fill='none'
						viewBox='0 0 24 24'
						stroke='currentColor'
					>
						<path
							stroke-linecap='round'
							stroke-linejoin='round'
							stroke-width='2'
							d='M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
						/>
					</svg>
					{errorInfo.action === 'relogin' ? 'ログインページへ' : 'ホームへ戻る'}
				</button>
			</div>
		</div>

		<!-- 背景装飾（オプション） -->
		<div class='absolute inset-0 pointer-events-none opacity-5'>
			<div class='absolute top-1/4 left-1/4 text-[20rem] font-bold text-base-content transform -rotate-12'>
				{errorCode}
			</div>
			<div class='absolute bottom-1/4 right-1/4 text-[20rem] font-bold text-base-content transform rotate-12'>
				{errorCode}
			</div>
		</div>
	</div>
</div>

<style>
  @keyframes glitch {
    0%, 100% {
      text-shadow:
        0.05em 0 0 rgba(255, 0, 0, 0.75),
        -0.025em -0.05em 0 rgba(0, 255, 0, 0.75),
        0.025em 0.05em 0 rgba(0, 0, 255, 0.75);
    }
    14% {
      text-shadow:
        0.05em 0 0 rgba(255, 0, 0, 0.75),
        -0.05em -0.025em 0 rgba(0, 255, 0, 0.75),
        0.025em 0.05em 0 rgba(0, 0, 255, 0.75);
    }
    15% {
      text-shadow:
        -0.05em -0.025em 0 rgba(255, 0, 0, 0.75),
        0.025em 0.025em 0 rgba(0, 255, 0, 0.75),
        -0.05em -0.05em 0 rgba(0, 0, 255, 0.75);
    }
    49% {
      text-shadow:
        -0.05em -0.025em 0 rgba(255, 0, 0, 0.75),
        0.025em 0.025em 0 rgba(0, 255, 0, 0.75),
        -0.05em -0.05em 0 rgba(0, 0, 255, 0.75);
    }
    50% {
      text-shadow:
        0.025em 0.05em 0 rgba(255, 0, 0, 0.75),
        0.05em 0 0 rgba(0, 255, 0, 0.75),
        0 -0.05em 0 rgba(0, 0, 255, 0.75);
    }
    99% {
      text-shadow:
        0.025em 0.05em 0 rgba(255, 0, 0, 0.75),
        0.05em 0 0 rgba(0, 255, 0, 0.75),
        0 -0.05em 0 rgba(0, 0, 255, 0.75);
    }
  }

  .glitch-effect {
    animation: glitch 2s infinite;
  }
</style>
