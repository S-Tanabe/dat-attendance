<script lang='ts'>
	import type { UIError } from '$lib/errors/types'
	import { clearError } from '$lib/stores/error'

	export let error: UIError

	function close() {
		clearError()
	}

	// エラーの重要度に応じた色分け
	$: severityClass = error.statusCode >= 500 ? 'critical' : 'warning'
</script>

<div class='error-toast {severityClass}' role='alert'>
	<div class='error-content'>
		<div class='error-icon'>
			{#if error.statusCode >= 500}
				⚠️
			{:else}
				ℹ️
			{/if}
		</div>

		<div class='error-message'>
			<p class='main-message'>{error.userMessage}</p>

			{#if error.details?.reason && import.meta.env.DEV}
				<p class='detail-message'>詳細: {error.details.reason}</p>
				<p class='error-code'>エラーコード: {error.code}</p>
			{/if}

			{#if error.details?.retryable}
				<p class='retry-hint'>再度お試しください。</p>
			{/if}
		</div>

		<button class='close-button' onclick={close} aria-label='エラーを閉じる'>
			✕
		</button>
	</div>
</div>

<style>
  .error-toast {
    position: fixed;
    top: 20px;
    right: 20px;
    max-width: 400px;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .error-toast.warning {
    background: #fff3cd;
    border-left: 4px solid #ffc107;
    color: #856404;
  }

  .error-toast.critical {
    background: #f8d7da;
    border-left: 4px solid #dc3545;
    color: #721c24;
  }

  .error-content {
    display: flex;
    gap: 1rem;
    align-items: flex-start;
  }

  .error-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .error-message {
    flex: 1;
    min-width: 0;
  }

  .main-message {
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    word-wrap: break-word;
  }

  .detail-message,
  .error-code {
    font-size: 0.875rem;
    margin: 0 0 0.25rem 0;
    opacity: 0.8;
  }

  .retry-hint {
    font-size: 0.875rem;
    font-style: italic;
    margin: 0.5rem 0 0 0;
  }

  .close-button {
    background: transparent;
    border: none;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    opacity: 0.7;
    transition: opacity 0.2s;
    flex-shrink: 0;
  }

  .close-button:hover {
    opacity: 1;
  }

  /* Dark mode support */
  @media (prefers-color-scheme: dark) {
    .error-toast.warning {
      background: #3d3010;
      color: #ffdd57;
    }

    .error-toast.critical {
      background: #3d1018;
      color: #ff6b7a;
    }
  }
</style>
