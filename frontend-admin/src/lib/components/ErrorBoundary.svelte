<script lang='ts'>
	import type { Snippet } from 'svelte'
	import { transformApiError } from '$lib/errors/transformer'
	import { setError } from '$lib/stores/error'
	import { onMount } from 'svelte'

	interface Props {
		children: Snippet
		fallback?: Snippet<[{ error: Error, reset: () => void }]>
	}

	const { children, fallback }: Props = $props()

	let hasErrored = $state(false)
	let error = $state<Error | null>(null)

	function reset() {
		hasErrored = false
		error = null
	}

	onMount(() => {
		// グローバルエラーハンドラ
		const handleError = (event: ErrorEvent) => {
			console.error('[ErrorBoundary] Caught error:', event.error)
			error = event.error instanceof Error ? event.error : new Error(String(event.error))
			hasErrored = true

			// UIエラーに変換してグローバルストアにセット
			const uiError = transformApiError(event.error)
			setError(uiError)

			// デフォルトの動作を防止
			event.preventDefault()
		}

		// 未処理のPromiseリジェクションをキャッチ
		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			console.error('[ErrorBoundary] Unhandled rejection:', event.reason)
			error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
			hasErrored = true

			// UIエラーに変換してグローバルストアにセット
			const uiError = transformApiError(event.reason)
			setError(uiError)

			// デフォルトの動作を防止
			event.preventDefault()
		}

		window.addEventListener('error', handleError)
		window.addEventListener('unhandledrejection', handleUnhandledRejection)

		return () => {
			window.removeEventListener('error', handleError)
			window.removeEventListener('unhandledrejection', handleUnhandledRejection)
		}
	})
</script>

{#if hasErrored && error}
	{#if fallback}
		{@render fallback({ error, reset })}
	{:else}
		<div class='error-boundary'>
			<div class='error-content'>
				<h2>エラーが発生しました</h2>
				<p>申し訳ございません。予期しないエラーが発生しました。</p>

				{#if import.meta.env.DEV}
					<details class='error-details'>
						<summary>詳細情報（開発環境のみ）</summary>
						<pre>{error.message}\n\n{error.stack}</pre>
					</details>
				{/if}

				<div class='error-actions'>
					<button onclick={reset} class='btn-primary'>
						再試行
					</button>
					<button onclick={() => window.location.href = '/'} class='btn-secondary'>
						ホームに戻る
					</button>
				</div>
			</div>
		</div>
	{/if}
{:else}
	{@render children()}
{/if}

<style>
  .error-boundary {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .error-content {
    max-width: 600px;
    padding: 2rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
    text-align: center;
  }

  h2 {
    margin: 0 0 1rem 0;
    font-size: 2rem;
    color: #333;
  }

  p {
    margin: 0 0 1.5rem 0;
    color: #666;
    line-height: 1.6;
  }

  .error-details {
    margin: 1.5rem 0;
    text-align: left;
    padding: 1rem;
    background: #f5f5f5;
    border-radius: 8px;
  }

  .error-details summary {
    cursor: pointer;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .error-details pre {
    margin: 0;
    padding: 1rem;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 0.875rem;
    line-height: 1.5;
  }

  .error-actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #667eea;
    color: white;
  }

  .btn-primary:hover {
    background: #5568d3;
  }

  .btn-secondary {
    background: #e0e0e0;
    color: #333;
  }

  .btn-secondary:hover {
    background: #d0d0d0;
  }

  @media (prefers-color-scheme: dark) {
    .error-content {
      background: #1a1a1a;
      color: #fff;
    }

    h2 {
      color: #fff;
    }

    p {
      color: #aaa;
    }

    .error-details {
      background: #2a2a2a;
    }

    .error-details pre {
      background: #1a1a1a;
      border-color: #444;
      color: #fff;
    }

    .btn-secondary {
      background: #333;
      color: #fff;
    }

    .btn-secondary:hover {
      background: #444;
    }
  }
</style>
