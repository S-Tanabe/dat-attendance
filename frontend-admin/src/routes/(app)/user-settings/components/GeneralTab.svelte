<script lang='ts'>
	import type { users } from '$lib/generated/client'
	import ThemeSelector from '$lib/components/ThemeSelector.svelte'
	import { invalidateSpecific } from '$lib/utils/data-fetching'
	import { toRomaji } from '$lib/utils/romaji'
	import AvatarUpload from './AvatarUpload.svelte'

	export let profile: users.UserProfile
	export let onSave: (data: unknown) => Promise<void>
	export let onPasswordChange: (data: unknown) => Promise<void>
	export let onAvatarUpload: (data: unknown) => Promise<void>
	export let onAvatarRemove: () => Promise<void>

	let firstName = profile.first_name || ''
	let lastName = profile.last_name || ''
	let firstNameRomaji = profile.first_name_romaji || ''
	let lastNameRomaji = profile.last_name_romaji || ''
	let displayName = profile.display_name || ''

	let currentPassword = ''
	let newPassword = ''
	let confirmPassword = ''

	let saving = false
	let changingPassword = false
	let uploadingAvatar = false
	let saveMessage = ''
	let passwordMessage = ''
	let passwordError = ''

	// 名前が変更されたらローマ字を自動生成
	let isAutoGenerating = true

	// ユーザーが名前を入力した時にローマ字を自動生成
	function handleFirstNameInput() {
		if (isAutoGenerating && firstName) {
			const newRomaji = toRomaji(firstName)
			if (newRomaji && newRomaji !== firstName) {
				firstNameRomaji = newRomaji
			}
		}
	}

	function handleLastNameInput() {
		if (isAutoGenerating && lastName) {
			const newRomaji = toRomaji(lastName)
			if (newRomaji && newRomaji !== lastName) {
				lastNameRomaji = newRomaji
			}
		}
	}

	// 手動編集されたら自動生成を無効化
	function handleRomajiManualEdit() {
		isAutoGenerating = false
		// 少し遅延してから自動生成を再有効化（ユーザーが連続して編集している間は無効のまま）
		setTimeout(() => {
			isAutoGenerating = true
		}, 2000)
	}

	// ローマ字フィールドの入力フィルタリング
	function filterRomajiInput(event: Event) {
		const target = event.target as HTMLInputElement
		const value = target.value
		// 英小文字とスペースのみ許可
		const filtered = value.replace(/[^a-z ]/g, '')
		if (value !== filtered) {
			target.value = filtered
			// bind:valueを更新するために手動でイベントをディスパッチ
			target.dispatchEvent(new Event('input', { bubbles: true }))
		}
	}

	async function handleSave() {
		saving = true
		saveMessage = ''

		try {
			const resp = await fetch('/user-settings/profile', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					display_name: displayName,
					first_name: firstName,
					last_name: lastName,
					first_name_romaji: firstNameRomaji,
					last_name_romaji: lastNameRomaji,
				}),
			})
			if (!resp.ok) {
				const errorData: unknown = await resp.json()
				const errorMessage = typeof errorData === 'object' && errorData !== null && 'error' in errorData && typeof errorData.error === 'string'
					? errorData.error
					: 'プロファイルの更新に失敗しました'
				throw new Error(errorMessage)
			}

			await onSave({
				display_name: displayName,
				first_name: firstName,
				last_name: lastName,
				first_name_romaji: firstNameRomaji,
				last_name_romaji: lastNameRomaji,
			})

			saveMessage = 'プロファイルを更新しました'
			setTimeout(() => saveMessage = '', 3000)

			// ユーザープロファイルのみ再取得
			await invalidateSpecific('app:user-profile')
		} catch (error: unknown) {
			console.error('Failed to save profile:', error)
			saveMessage = error instanceof Error ? error.message : 'プロファイルの更新に失敗しました'
		} finally {
			saving = false
		}
	}

	async function handlePasswordChange() {
		passwordMessage = ''
		passwordError = ''

		// バリデーション
		if (!currentPassword || !newPassword || !confirmPassword) {
			passwordError = 'すべてのフィールドを入力してください'
			return
		}

		if (newPassword.length < 8) {
			passwordError = 'パスワードは8文字以上である必要があります'
			return
		}

		if (newPassword !== confirmPassword) {
			passwordError = '新しいパスワードが一致しません'
			return
		}

		changingPassword = true

		try {
			const res = await fetch('/user-settings/password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
			})
			if (!res.ok) {
				const errorData: unknown = await res.json()
				const errorMessage = typeof errorData === 'object' && errorData !== null && 'error' in errorData && typeof errorData.error === 'string'
					? errorData.error
					: 'パスワードの変更に失敗しました'
				throw new Error(errorMessage)
			}

			await onPasswordChange({ current_password: currentPassword, new_password: newPassword })

			passwordMessage = 'パスワードを変更しました'
			// フィールドをクリア
			currentPassword = ''
			newPassword = ''
			confirmPassword = ''
			setTimeout(() => passwordMessage = '', 3000)

			// パスワード変更後はセキュリティのためユーザー情報を再取得
			await invalidateSpecific('app:user-profile')
		} catch (error: unknown) {
			console.error('Failed to change password:', error)
			passwordError = error instanceof Error ? error.message : 'パスワードの変更に失敗しました'
		} finally {
			changingPassword = false
		}
	}

	async function handleAvatarUpload(event: CustomEvent) {
		uploadingAvatar = true
		try {
			const detail = event.detail as { data: string, contentType: string }
			const resp = await fetch('/user-settings/avatar', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ data: detail.data, contentType: detail.contentType }),
			})
			if (!resp.ok) {
				const errorData: unknown = await resp.json()
				const errorMessage = (typeof errorData === 'object' && errorData !== null && 'error' in errorData && typeof errorData.error === 'string') ? errorData.error : 'アバターのアップロードに失敗しました'
				throw new Error(errorMessage)
			}
			const result: unknown = await resp.json()

			// プロフィールを即座に更新（avatarのみ）
			if (typeof result === 'object' && result !== null && 'avatar_url' in result && 'avatar_bucket_key' in result) {
				profile = {
					...profile,
					avatar_url: typeof result.avatar_url === 'string' ? result.avatar_url : undefined,
					avatar_bucket_key: typeof result.avatar_bucket_key === 'string' ? result.avatar_bucket_key : undefined,
				}
			}

			await onAvatarUpload(event.detail)
			// ユーザープロファイルのみ再取得
			await invalidateSpecific('app:user-profile')
		} catch (error: unknown) {
			console.error('Failed to upload avatar:', error)
		} finally {
			uploadingAvatar = false
		}
	}

	async function handleAvatarRemove() {
		uploadingAvatar = true
		try {
			const resp = await fetch('/user-settings/avatar', { method: 'DELETE' })
			if (!resp.ok) {
				const errorData: unknown = await resp.json()
				const errorMessage = (typeof errorData === 'object' && errorData !== null && 'error' in errorData && typeof errorData.error === 'string') ? errorData.error : 'アバターの削除に失敗しました'
				throw new Error(errorMessage)
			}

			// プロフィールを即座に更新（avatarを削除）
			profile = {
				...profile,
				avatar_url: undefined,
				avatar_bucket_key: undefined,
			}

			await onAvatarRemove()
			// ユーザープロファイルのみ再取得
			await invalidateSpecific('app:user-profile')
		} catch (error: unknown) {
			console.error('Failed to remove avatar:', error)
		} finally {
			uploadingAvatar = false
		}
	}

	async function handleSaveSubmit(event: SubmitEvent) {
		event.preventDefault()
		await handleSave()
	}

	async function handlePasswordSubmit(event: SubmitEvent) {
		event.preventDefault()
		await handlePasswordChange()
	}
</script>

<div class='space-y-6'>
	<!-- アバター設定 -->
	<div class='card bg-base-100 shadow'>
		<div class='card-body'>
			<h2 class='text-lg font-semibold mb-4'>プロフィール画像</h2>
			<AvatarUpload
				avatarUrl={profile.avatar_url}
				displayName={displayName}
				firstName={firstName}
				lastName={lastName}
				email={profile.email}
				loading={uploadingAvatar}
				on:upload={handleAvatarUpload}
				on:remove={handleAvatarRemove}
			/>
		</div>
	</div>

	<!-- 基本情報とパスワード変更を横並び -->
	<div class='grid grid-cols-1 lg:grid-cols-2 gap-6'>
		<!-- 基本情報 -->
		<div class='card bg-base-100 shadow'>
			<div class='card-body'>
				<h2 class='text-lg font-semibold mb-4'>基本情報</h2>

				<form id='basic-info-form' onsubmit={handleSaveSubmit} class='space-y-4'>
					<div class='form-control'>
						<label class='label' for='display-name'>
							<span class='label-text'>表示名</span>
						</label>
						<input
							id='display-name'
							type='text'
							bind:value={displayName}
							class='input input-bordered input-sm'
							placeholder='表示名'
						/>
					</div>

					<div class='grid grid-cols-2 gap-3'>
						<div class='form-control'>
							<label class='label' for='last-name'>
								<span class='label-text'>姓</span>
							</label>
							<input
								id='last-name'
								type='text'
								bind:value={lastName}
								oninput={handleLastNameInput}
								class='input input-bordered input-sm'
								placeholder='山田'
							/>
						</div>

						<div class='form-control'>
							<label class='label' for='first-name'>
								<span class='label-text'>名</span>
							</label>
							<input
								id='first-name'
								type='text'
								bind:value={firstName}
								oninput={handleFirstNameInput}
								class='input input-bordered input-sm'
								placeholder='太郎'
							/>
						</div>
					</div>

					<div class='grid grid-cols-2 gap-3'>
						<div class='form-control'>
							<label class='label' for='last-name-romaji'>
								<span class='label-text text-xs'>姓（ローマ字）</span>
							</label>
							<input
								id='last-name-romaji'
								type='text'
								bind:value={lastNameRomaji}
								oninput={filterRomajiInput}
								onfocus={handleRomajiManualEdit}
								class='input input-bordered input-sm'
								placeholder='yamada'
								pattern='[a-z ]*'
								inputmode='text'
								title='英小文字のみ入力できます'
							/>
						</div>

						<div class='form-control'>
							<label class='label' for='first-name-romaji'>
								<span class='label-text text-xs'>名（ローマ字）</span>
							</label>
							<input
								id='first-name-romaji'
								type='text'
								bind:value={firstNameRomaji}
								oninput={filterRomajiInput}
								onfocus={handleRomajiManualEdit}
								class='input input-bordered input-sm'
								placeholder='taro'
								pattern='[a-z ]*'
								inputmode='text'
								title='英小文字のみ入力できます'
							/>
						</div>
					</div>
				</form>

				{#if saveMessage}
					<div class="alert {saveMessage.includes('失敗') ? 'alert-error' : 'alert-success'} mt-4">
						<span class='text-sm'>{saveMessage}</span>
					</div>
				{/if}

				<div class='card-actions justify-end mt-4'>
					<button
						type='submit'
						form='basic-info-form'
						class='btn btn-primary btn-sm'
						disabled={saving}
					>
						{#if saving}
							<span class='loading loading-spinner loading-xs'></span>
						{/if}
						保存
					</button>
				</div>
			</div>
		</div>

		<!-- パスワード変更 -->
		<div class='card bg-base-100 shadow'>
			<div class='card-body'>
				<h2 class='text-lg font-semibold mb-4'>パスワード変更</h2>

				<form id='password-form' onsubmit={handlePasswordSubmit} class='space-y-4'>
					<div class='form-control'>
						<label class='label' for='current-password'>
							<span class='label-text'>現在のパスワード</span>
						</label>
						<input
							id='current-password'
							type='password'
							bind:value={currentPassword}
							class='input input-bordered input-sm'
							placeholder='現在のパスワード'
						/>
					</div>

					<div class='form-control'>
						<label class='label' for='new-password'>
							<span class='label-text'>新しいパスワード</span>
						</label>
						<input
							id='new-password'
							type='password'
							bind:value={newPassword}
							class='input input-bordered input-sm'
							placeholder='8文字以上'
						/>
					</div>

					<div class='form-control'>
						<label class='label' for='confirm-password'>
							<span class='label-text'>パスワード（確認）</span>
						</label>
						<input
							id='confirm-password'
							type='password'
							bind:value={confirmPassword}
							class='input input-bordered input-sm'
							placeholder='再入力'
						/>
					</div>
				</form>

				{#if passwordError}
					<div class='alert alert-error mt-4'>
						<span class='text-sm'>{passwordError}</span>
					</div>
				{/if}

				{#if passwordMessage}
					<div class='alert alert-success mt-4'>
						<span class='text-sm'>{passwordMessage}</span>
					</div>
				{/if}

				<div class='card-actions justify-end mt-4'>
					<button
						type='submit'
						form='password-form'
						class='btn btn-primary btn-sm'
						disabled={changingPassword}
					>
						{#if changingPassword}
							<span class='loading loading-spinner loading-xs'></span>
						{/if}
						変更
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- テーマ設定 -->
	<div class='card bg-base-100 shadow'>
		<div class='card-body'>
			<ThemeSelector />
		</div>
	</div>
</div>
