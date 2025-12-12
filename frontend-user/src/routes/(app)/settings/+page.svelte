<script lang='ts'>
	import { enhance } from '$app/forms'
	import { invalidateAll } from '$app/navigation'

	interface Profile {
		id: string
		email: string
		display_name?: string | null
		first_name?: string | null
		last_name?: string | null
		first_name_romaji?: string | null
		last_name_romaji?: string | null
		avatar_url?: string | null
		timezone?: string | null
		language?: string | null
	}

	interface FaceStatus {
		has_face_data: boolean
		face_count: number
	}

	const { data, form } = $props<{
		data: { profile: Profile | null, faceStatus: FaceStatus | null }
		form: { success?: boolean, error?: string, action?: string } | null
	}>()

	// フォーム状態
	let displayName = $state(data.profile?.display_name || '')
	let firstName = $state(data.profile?.first_name || '')
	let lastName = $state(data.profile?.last_name || '')

	// パスワード変更フォーム
	let currentPassword = $state('')
	let newPassword = $state('')
	let confirmPassword = $state('')
	let showPasswordForm = $state(false)

	// ローディング状態
	let isUpdating = $state(false)
	let isChangingPassword = $state(false)

	// 成功/エラーメッセージ
	let successMessage = $state<string | null>(null)
	let errorMessage = $state<string | null>(null)

	// フォーム結果の処理
	$effect(() => {
		if (form?.error) {
			errorMessage = form.error
			successMessage = null
		} else if (form?.success) {
			if (form.action === 'updateProfile') {
				successMessage = 'プロフィールを更新しました'
			} else if (form.action === 'changePassword') {
				successMessage = 'パスワードを変更しました'
				currentPassword = ''
				newPassword = ''
				confirmPassword = ''
				showPasswordForm = false
			}
			errorMessage = null
			setTimeout(() => {
				successMessage = null
			}, 3000)
		}
	})
</script>

<svelte:head>
	<title>設定 - DAT勤怠</title>
</svelte:head>

<div class='flex flex-col space-y-6'>
	<h1 class='text-xl font-bold text-slate-800 dark:text-slate-100'>設定</h1>

	<!-- メッセージ -->
	{#if errorMessage}
		<div class='bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3'>
			<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
			</svg>
			<span class='text-sm text-red-700 dark:text-red-300'>{errorMessage}</span>
		</div>
	{/if}

	{#if successMessage}
		<div class='bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center gap-3'>
			<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7' />
			</svg>
			<span class='text-sm text-green-700 dark:text-green-300'>{successMessage}</span>
		</div>
	{/if}

	<!-- プロフィール設定 -->
	<section class='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden'>
		<div class='px-4 py-3 border-b border-slate-100 dark:border-slate-700'>
			<h2 class='text-base font-semibold text-slate-800 dark:text-slate-100'>プロフィール</h2>
		</div>
		<form
			method='POST'
			action='?/updateProfile'
			class='p-4 space-y-4'
			use:enhance={() => {
				isUpdating = true
				return async ({ update }) => {
					isUpdating = false
					await update()
					await invalidateAll()
				}
			}}
		>
			<!-- メールアドレス（表示のみ） -->
			<div>
				<span class='block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1'>
					メールアドレス
				</span>
				<div class='px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg text-sm text-slate-600 dark:text-slate-300'>
					{data.profile?.email || '-'}
				</div>
			</div>

			<!-- 表示名 -->
			<div>
				<label for='display_name' class='block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1'>
					表示名
				</label>
				<input
					type='text'
					id='display_name'
					name='display_name'
					bind:value={displayName}
					class='w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
					placeholder='表示名を入力'
				/>
			</div>

			<!-- 姓・名 -->
			<div class='grid grid-cols-2 gap-3'>
				<div>
					<label for='last_name' class='block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1'>
						姓
					</label>
					<input
						type='text'
						id='last_name'
						name='last_name'
						bind:value={lastName}
						class='w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
						placeholder='姓'
					/>
				</div>
				<div>
					<label for='first_name' class='block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1'>
						名
					</label>
					<input
						type='text'
						id='first_name'
						name='first_name'
						bind:value={firstName}
						class='w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
						placeholder='名'
					/>
				</div>
			</div>

			<button
				type='submit'
				class='w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
				disabled={isUpdating}
			>
				{#if isUpdating}
					<span class='loading loading-spinner loading-sm'></span>
				{:else}
					保存
				{/if}
			</button>
		</form>
	</section>

	<!-- 顔認証データ -->
	<section class='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden'>
		<div class='px-4 py-3 border-b border-slate-100 dark:border-slate-700'>
			<h2 class='text-base font-semibold text-slate-800 dark:text-slate-100'>顔認証データ</h2>
		</div>
		<div class='p-4'>
			{#if data.faceStatus?.has_face_data}
				<div class='flex items-center justify-between'>
					<div class='flex items-center gap-3'>
						<div class='w-10 h-10 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center'>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-green-600 dark:text-green-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7' />
							</svg>
						</div>
						<div>
							<p class='text-sm font-medium text-slate-800 dark:text-slate-100'>登録済み</p>
							<p class='text-xs text-slate-500 dark:text-slate-400'>{data.faceStatus.face_count}件の顔データ</p>
						</div>
					</div>
					<a
						href='/dashboard/face'
						class='px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors'
					>
						再登録
					</a>
				</div>
			{:else}
				<div class='flex items-center justify-between'>
					<div class='flex items-center gap-3'>
						<div class='w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center'>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-slate-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' />
							</svg>
						</div>
						<div>
							<p class='text-sm font-medium text-slate-800 dark:text-slate-100'>未登録</p>
							<p class='text-xs text-slate-500 dark:text-slate-400'>顔認証打刻を利用するには登録が必要です</p>
						</div>
					</div>
					<a
						href='/dashboard/face'
						class='px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors'
					>
						登録する
					</a>
				</div>
			{/if}
		</div>
	</section>

	<!-- パスワード変更 -->
	<section class='bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden'>
		<div class='px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between'>
			<h2 class='text-base font-semibold text-slate-800 dark:text-slate-100'>パスワード</h2>
			{#if !showPasswordForm}
				<button
					type='button'
					class='text-sm text-blue-600 dark:text-blue-400 hover:underline'
					onclick={() => showPasswordForm = true}
				>
					変更する
				</button>
			{/if}
		</div>
		{#if showPasswordForm}
			<form
				method='POST'
				action='?/changePassword'
				class='p-4 space-y-4'
				use:enhance={() => {
					isChangingPassword = true
					return async ({ update }) => {
						isChangingPassword = false
						await update()
					}
				}}
			>
				<div>
					<label for='current_password' class='block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1'>
						現在のパスワード
					</label>
					<input
						type='password'
						id='current_password'
						name='current_password'
						bind:value={currentPassword}
						class='w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
						required
					/>
				</div>
				<div>
					<label for='new_password' class='block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1'>
						新しいパスワード
					</label>
					<input
						type='password'
						id='new_password'
						name='new_password'
						bind:value={newPassword}
						class='w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
						required
						minlength='8'
					/>
					<p class='text-xs text-slate-500 dark:text-slate-400 mt-1'>8文字以上</p>
				</div>
				<div>
					<label for='confirm_password' class='block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1'>
						新しいパスワード（確認）
					</label>
					<input
						type='password'
						id='confirm_password'
						name='confirm_password'
						bind:value={confirmPassword}
						class='w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
						required
					/>
				</div>
				<div class='flex gap-2'>
					<button
						type='button'
						class='flex-1 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors'
						onclick={() => {
							showPasswordForm = false
							currentPassword = ''
							newPassword = ''
							confirmPassword = ''
						}}
					>
						キャンセル
					</button>
					<button
						type='submit'
						class='flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
						disabled={isChangingPassword}
					>
						{#if isChangingPassword}
							<span class='loading loading-spinner loading-sm'></span>
						{:else}
							変更
						{/if}
					</button>
				</div>
			</form>
		{:else}
			<div class='p-4'>
				<p class='text-sm text-slate-500 dark:text-slate-400'>パスワードを変更できます</p>
			</div>
		{/if}
	</section>
</div>
