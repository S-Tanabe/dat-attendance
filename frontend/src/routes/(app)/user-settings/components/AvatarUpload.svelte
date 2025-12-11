<script lang='ts'>
	import { fileToBase64, getAvatarColor, getInitials, validateFileSize, validateFileType } from '$lib/utils/avatar'
	import { createEventDispatcher } from 'svelte'

	export let avatarUrl: string | null = null
	export let displayName: string = ''
	export let firstName: string = ''
	export let lastName: string = ''
	export let email: string = ''
	export let loading: boolean = false

	const dispatch = createEventDispatcher()

	let fileInput: HTMLInputElement
	let uploadError = ''

	$: initials = getInitials(firstName, lastName, displayName, email)
	$: avatarColor = getAvatarColor(initials)

	async function handleFile(file: File) {
		uploadError = ''

		// ファイルタイプの検証
		if (!validateFileType(file)) {
			uploadError = '画像ファイル（JPEG、PNG、GIF、WebP）を選択してください'
			return
		}

		// ファイルサイズの検証（1MB）
		if (!validateFileSize(file, 1 * 1024 * 1024)) {
			uploadError = 'ファイルサイズは1MB以下にしてください'
			return
		}

		try {
			const base64 = await fileToBase64(file)
			dispatch('upload', {
				contentType: file.type,
				data: base64,
			})
		} catch {
			uploadError = 'ファイルの読み込みに失敗しました'
		}
	}

	async function handleFileSelect(e: Event) {
		const target = e.target as HTMLInputElement
		const files = target.files
		if (files && files.length > 0) {
			await handleFile(files[0])
		}
	}

	function handleRemove() {
		if (confirm('アバターを削除しますか？')) {
			dispatch('remove')
		}
	}
</script>

<div class='flex items-center gap-6'>
	<!-- アバター表示 -->
	<div class='relative shrink-0'>
		{#if avatarUrl}
			<div class='avatar'>
				<div class='w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2'>
					<img src={avatarUrl} alt='Avatar' />
				</div>
			</div>
		{:else}
			<div class='avatar avatar-placeholder'>
				<div class='w-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2 {avatarColor} flex items-center justify-center'>
					<span class='text-2xl text-white leading-none'>{initials}</span>
				</div>
			</div>
		{/if}

		{#if loading}
			<div class='absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full'>
				<span class='loading loading-spinner loading-md text-white'></span>
			</div>
		{/if}
	</div>

	<!-- アップロードボタン -->
	<div class='flex-1'>
		<div class='flex flex-col gap-2'>
			<p class='text-sm text-base-content/70'>
				プロフィール画像をアップロードしてください
			</p>
			<p class='text-xs text-base-content/50'>
				JPEG、PNG、GIF、WebP（最大1MB）
			</p>
			<div class='flex gap-2 mt-2'>
				<button
					type='button'
					class='btn btn-primary btn-sm'
					onclick={() => fileInput.click()}
					disabled={loading}
				>
					{#if loading}
						<span class='loading loading-spinner loading-xs'></span>
					{/if}
					画像を選択
				</button>
				{#if avatarUrl}
					<button
						type='button'
						class='btn btn-ghost btn-sm'
						onclick={handleRemove}
						disabled={loading}
					>
						削除
					</button>
				{/if}
			</div>
		</div>

		<!-- エラーメッセージ -->
		{#if uploadError}
			<div class='alert alert-error mt-2'>
				<svg xmlns='http://www.w3.org/2000/svg' class='stroke-current shrink-0 h-6 w-6' fill='none' viewBox='0 0 24 24'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' />
				</svg>
				<span class='text-sm'>{uploadError}</span>
			</div>
		{/if}
	</div>

	<!-- 非表示のファイル入力 -->
	<input
		bind:this={fileInput}
		type='file'
		accept='image/*'
		class='hidden'
		onchange={handleFileSelect}
	/>
</div>
