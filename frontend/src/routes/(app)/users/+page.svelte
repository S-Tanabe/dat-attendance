<script lang='ts'>
	import type { PageData } from './$types'
	import { enhance } from '$app/forms'
	import RoleSelect from '$lib/components/RoleSelect.svelte'
	import { useEnhance } from '$lib/utils/forms'
	import { toRomaji } from '$lib/utils/romaji'
	import { fade, fly } from 'svelte/transition'

	export let data: PageData

	let showCreate = false
	let showEdit: null | string = null // userId
	let showReset: null | string = null
	let createForm: HTMLFormElement
	let editForm: HTMLFormElement
	let resetForm: HTMLFormElement

	const enhanceCreate = useEnhance({ successMessage: 'ユーザーを作成しました', invalidateDeps: ['app:users'] })
	const enhanceEdit = useEnhance({ successMessage: 'ユーザーを更新しました', invalidateDeps: ['app:users'] })
	const enhancePassword = useEnhance({ successMessage: 'パスワードをリセットしました', invalidateDeps: ['app:users'] })
	const enhanceStatus = useEnhance({ successMessage: 'ステータスを変更しました', invalidateDeps: ['app:users'] })
	const enhanceSimple = useEnhance({ successMessage: '完了しました', invalidateDeps: ['app:users'] })

	function openEdit(id: string) { showEdit = id }
	function openReset(id: string) { showReset = id }

	let autoRomaji = true
	function onNameInputCreate(e: Event, target: 'first' | 'last') {
		if (!autoRomaji)
			return
		const v = (e.target as HTMLInputElement).value
		const r = toRomaji(v)
		if (target === 'first')
			(createForm?.elements.namedItem('firstNameRomaji') as HTMLInputElement | null)?.setAttribute('value', r)
		if (target === 'last')
			(createForm?.elements.namedItem('lastNameRomaji') as HTMLInputElement | null)?.setAttribute('value', r)
	}

	function getRoleColor(role: string): string {
		const colors: Record<string, string> = {
			super_admin: 'badge-error',
			admin: 'badge-warning',
			member: 'badge-info',
			viewer: 'badge-ghost',
		}
		return colors[role] || 'badge-ghost'
	}

	function getInitials(displayName: string | null): string {
		if (!displayName)
			return '?'
		const parts = displayName.split(' ')
		if (parts.length >= 2) {
			return parts[0][0] + parts[1][0]
		}
		return displayName.substring(0, 2).toUpperCase()
	}
</script>

<svelte:head>
	<title>ユーザー管理</title>
</svelte:head>

<div class='space-y-8'>
	<!-- Header Section -->
	<div class='flex flex-col sm:flex-row sm:items-center justify-between gap-4'>
		<div>
			<h1 class='text-3xl font-bold bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent'>
				ユーザー管理
			</h1>
			<p class='text-sm opacity-70 mt-1'>
				管理者向け：ユーザーの作成・編集・ロール・状態変更・パスワードリセット
			</p>
		</div>
		<button
			class='btn btn-primary shadow-lg hover:shadow-xl transition-all duration-300 group'
			onclick={() => showCreate = true}
		>
			<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 mr-2 group-hover:rotate-90 transition-transform duration-300' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 4v16m8-8H4' />
			</svg>
			新規ユーザー作成
		</button>
	</div>

	<!-- Stats Cards -->
	<div class='grid grid-cols-1 sm:grid-cols-3 gap-4'>
		<div class='stats shadow-md hover:shadow-lg transition-shadow duration-300'>
			<div class='stat'>
				<div class='stat-title'>総ユーザー数</div>
				<div class='stat-value text-primary'>{data.users.length}</div>
				<div class='stat-desc'>登録済みユーザー</div>
			</div>
		</div>
		<div class='stats shadow-md hover:shadow-lg transition-shadow duration-300'>
			<div class='stat'>
				<div class='stat-title'>アクティブ</div>
				<div class='stat-value text-success'>{data.users.filter((u) => u.is_active).length}</div>
				<div class='stat-desc'>有効なアカウント</div>
			</div>
		</div>
		<div class='stats shadow-md hover:shadow-lg transition-shadow duration-300'>
			<div class='stat'>
				<div class='stat-title'>非アクティブ</div>
				<div class='stat-value text-warning'>{data.users.filter((u) => !u.is_active).length}</div>
				<div class='stat-desc'>無効なアカウント</div>
			</div>
		</div>
	</div>

	<!-- Users Table -->
	<div class='card bg-base-100 shadow-xl border border-base-300/50'>
		<div class='card-body p-0'>
			<div class='overflow-x-auto'>
				<table class='table table-zebra'>
					<thead class='bg-base-200/50'>
						<tr>
							<th class='text-base font-semibold'>ユーザー</th>
							<th class='text-base font-semibold'>Email</th>
							<th class='text-base font-semibold'>ロール</th>
							<th class='text-base font-semibold'>状態</th>
							<th class='text-base font-semibold'>作成日</th>
							<th class='text-base font-semibold text-center'>操作</th>
						</tr>
					</thead>
					<tbody>
						{#each data.users as u, idx}
							<tr
								class='hover:bg-base-200/30 transition-colors duration-200'
								in:fade={{ delay: idx * 50, duration: 300 }}
							>
								<td>
									<div class='flex items-center gap-3'>
										<div class='avatar avatar-placeholder'>
											<div class='bg-linear-to-br from-primary to-secondary text-primary-content rounded-full w-10 flex items-center justify-center shadow-md'>
												<span class='leading-none text-sm font-semibold'>{getInitials(u.display_name)}</span>
											</div>
										</div>
										<div>
											<div class='font-bold text-base'>{u.display_name ?? 'Unknown'}</div>
											<div class='text-xs opacity-60'>ID: {u.id.slice(0, 8)}...</div>
										</div>
									</div>
								</td>
								<td>
									<div class='flex items-center gap-2'>
										<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4 opacity-50' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
											<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
										</svg>
										<span class='text-sm'>{u.email}</span>
									</div>
								</td>
								<td>
									<span class='badge {getRoleColor(u.role)} badge-sm capitalize font-medium'>
										{u.role}
									</span>
								</td>
								<td>
									{#if u.is_active}
										<div class='flex items-center gap-2'>
											<div class='w-2 h-2 bg-success rounded-full animate-pulse'></div>
											<span class='badge badge-success badge-outline badge-sm'>Active</span>
										</div>
									{:else}
										<div class='flex items-center gap-2'>
											<div class='w-2 h-2 bg-warning rounded-full'></div>
											<span class='badge badge-ghost badge-sm'>Inactive</span>
										</div>
									{/if}
								</td>
								<td>
									<div class='text-sm'>
										<div class='font-medium'>{new Date(u.created_at).toLocaleDateString('ja-JP')}</div>
										<div class='text-xs opacity-60'>{new Date(u.created_at).toLocaleTimeString('ja-JP')}</div>
									</div>
								</td>
								<td>
									<div class='flex gap-1 justify-center flex-wrap'>
										<div class='tooltip' data-tip='編集'>
											<button
												class='btn btn-ghost btn-sm btn-square hover:btn-primary transition-colors duration-200'
												onclick={() => openEdit(u.id)}
												aria-label={`ユーザー ${(u.display_name ?? u.email) || u.id} を編集`}
											>
												<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
													<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' />
												</svg>
											</button>
										</div>
										<div class='tooltip' data-tip='パスワードリセット'>
											<button
												class='btn btn-ghost btn-sm btn-square hover:btn-warning transition-colors duration-200'
												onclick={() => openReset(u.id)}
												aria-label={`ユーザー ${(u.display_name ?? u.email) || u.id} のパスワードをリセット`}
											>
												<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
													<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' />
												</svg>
											</button>
										</div>
										<form method='POST' action='?/change_status' use:enhance={enhanceStatus} class='inline'>
											<input type='hidden' name='userId' value={u.id} />
											<input type='hidden' name='isActive' value={!u.is_active} />
											<div class='tooltip' data-tip={u.is_active ? '無効化' : '有効化'}>
												<button
													class='btn btn-ghost btn-sm btn-square'
													class:hover:btn-error={u.is_active}
													class:hover:btn-success={!u.is_active}
													aria-label={`ユーザー ${(u.display_name ?? u.email) || u.id} を${u.is_active ? '無効化' : '有効化'}`}
													aria-pressed={u.is_active}
												>
													{#if u.is_active}
														<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
															<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' />
														</svg>
													{:else}
														<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
															<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' />
														</svg>
													{/if}
												</button>
											</div>
										</form>
										<form method='POST' action='?/force_logout' use:enhance={enhanceSimple} class='inline'>
											<input type='hidden' name='userId' value={u.id} />
											<div class='tooltip' data-tip='強制ログアウト'>
												<button class='btn btn-ghost btn-sm btn-square hover:btn-error transition-colors duration-200' aria-label={`ユーザー ${(u.display_name ?? u.email) || u.id} を強制ログアウト`}>
													<svg xmlns='http://www.w3.org/2000/svg' class='h-4 w-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
														<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1' />
													</svg>
												</button>
											</div>
										</form>
									</div>
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan='6' class='text-center py-8 text-base-content/50'>
									<svg xmlns='http://www.w3.org/2000/svg' class='h-12 w-12 mx-auto mb-4 opacity-30' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
										<path stroke-linecap='round' stroke-linejoin='round' stroke-width='1' d='M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' />
									</svg>
									<div class='text-lg font-medium'>ユーザーが登録されていません</div>
									<div class='text-sm opacity-60 mt-1'>新規ユーザーを作成してください</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	</div>

	<!-- Create Modal -->
	{#if showCreate}
		<div class='modal modal-open' transition:fade={{ duration: 200 }}>
			<div class='modal-box max-w-2xl' in:fly={{ y: -50, duration: 300 }}>
				<!-- Modal Header -->
				<div class='flex items-center justify-between mb-6'>
					<div>
						<h3 class='text-2xl font-bold'>新規ユーザー作成</h3>
						<p class='text-sm opacity-60 mt-1'>ユーザー情報を入力してください</p>
					</div>
					<button
						type='button'
						class='btn btn-sm btn-circle btn-ghost'
						onclick={() => showCreate = false}
						aria-label='新規ユーザー作成モーダルを閉じる'
					>
						<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
						</svg>
					</button>
				</div>

				<!-- Progress Indicator -->
				<div class='w-full bg-base-200 rounded-full h-1.5 mb-6'>
					<div class='bg-linear-to-r from-primary to-secondary h-1.5 rounded-full' style='width: 33%'></div>
				</div>

				<form method='POST' action='?/create' bind:this={createForm} use:enhance={enhanceCreate} onsubmit={() => showCreate = false} class='space-y-6'>
					<!-- Account Information -->
					<div class='bg-base-200/30 rounded-lg p-4'>
						<div class='flex items-center gap-2 mb-4'>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-primary' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' />
							</svg>
							<h4 class='font-semibold'>アカウント情報</h4>
						</div>
						<div class='grid grid-cols-1 md:grid-cols-2 gap-4'>
							<div class='form-control'>
								<label class='label' for='create-display-name'>
									<span class='label-text font-medium'>表示名 <span class='text-error'>*</span></span>
								</label>
								<input
									id='create-display-name'
									name='displayName'
									class='input input-bordered focus:input-primary transition-all duration-200'
									placeholder='山田 太郎'
									required
								/>
							</div>
							<div class='form-control'>
								<label class='label' for='create-email'>
									<span class='label-text font-medium'>Email <span class='text-error'>*</span></span>
								</label>
								<input
									id='create-email'
									name='email'
									type='email'
									class='input input-bordered focus:input-primary transition-all duration-200'
									placeholder='user@example.com'
									required
								/>
							</div>
							<div class='form-control md:col-span-2'>
								<label class='label' for='create-password'>
									<span class='label-text font-medium'>初期パスワード <span class='text-error'>*</span></span>
									<span class='label-text-alt'>8文字以上</span>
								</label>
								<input
									id='create-password'
									name='password'
									type='password'
									minlength='8'
									class='input input-bordered focus:input-primary transition-all duration-200'
									placeholder='••••••••'
									required
								/>
							</div>
						</div>
					</div>

					<!-- Personal Information -->
					<div class='bg-base-200/30 rounded-lg p-4'>
						<div class='flex items-center gap-2 mb-4'>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-primary' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2' />
							</svg>
							<h4 class='font-semibold'>個人情報（オプション）</h4>
							<div class='form-control'>
								<label class='label cursor-pointer gap-2'>
									<span class='label-text text-xs'>自動ローマ字変換</span>
									<input type='checkbox' class='toggle toggle-sm toggle-primary' bind:checked={autoRomaji} />
								</label>
							</div>
						</div>
						<div class='grid grid-cols-1 md:grid-cols-2 gap-4'>
							<div class='form-control'>
								<label class='label' for='create-last-name'>
									<span class='label-text font-medium'>姓</span>
								</label>
								<input
									id='create-last-name'
									name='lastName'
									class='input input-bordered focus:input-primary transition-all duration-200'
									placeholder='山田'
									oninput={(e) => onNameInputCreate(e, 'last')}
								/>
							</div>
							<div class='form-control'>
								<label class='label' for='create-first-name'>
									<span class='label-text font-medium'>名</span>
								</label>
								<input
									id='create-first-name'
									name='firstName'
									class='input input-bordered focus:input-primary transition-all duration-200'
									placeholder='太郎'
									oninput={(e) => onNameInputCreate(e, 'first')}
								/>
							</div>
							<div class='form-control'>
								<label class='label' for='create-last-name-romaji'>
									<span class='label-text font-medium'>Last Name (ローマ字)</span>
								</label>
								<input
									id='create-last-name-romaji'
									name='lastNameRomaji'
									class='input input-bordered focus:input-primary transition-all duration-200'
									pattern='^[A-Za-z]+$'
									inputmode='text'
									placeholder='Yamada'
									title='半角英字のみ'
								/>
							</div>
							<div class='form-control'>
								<label class='label' for='create-first-name-romaji'>
									<span class='label-text font-medium'>First Name (ローマ字)</span>
								</label>
								<input
									id='create-first-name-romaji'
									name='firstNameRomaji'
									class='input input-bordered focus:input-primary transition-all duration-200'
									pattern='^[A-Za-z]+$'
									inputmode='text'
									placeholder='Taro'
									title='半角英字のみ'
								/>
							</div>
						</div>
					</div>

					<!-- Role Assignment -->
					<div class='bg-base-200/30 rounded-lg p-4'>
						<div class='flex items-center gap-2 mb-4'>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-primary' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' />
							</svg>
							<h4 class='font-semibold'>権限設定</h4>
						</div>
						<RoleSelect name='roleName' roles={data.roles} placeholder='ロールを選択' />
					</div>

					<div class='divider'></div>

					<!-- Action Buttons -->
					<div class='modal-action'>
						<button type='button' class='btn btn-ghost' onclick={() => showCreate = false}>
							キャンセル
						</button>
						<button type='submit' class='btn btn-primary shadow-lg'>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 mr-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 4v16m8-8H4' />
							</svg>
							ユーザーを作成
						</button>
					</div>
				</form>
			</div>
			<div
				class='modal-backdrop'
				role='button'
				tabindex='0'
				aria-label='新規ユーザー作成モーダルを閉じる'
				onclick={() => showCreate = false}
				onkeydown={(event) => {
					if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
						event.preventDefault()
						showCreate = false
					}
				}}
			></div>
		</div>
	{/if}

	<!-- Edit Modal -->
	{#if showEdit}
		{#each data.users as u}
			{#if u.id === showEdit}
				<div class='modal modal-open' transition:fade={{ duration: 200 }}>
					<div class='modal-box max-w-xl' in:fly={{ y: -50, duration: 300 }}>
						<!-- Modal Header -->
						<div class='flex items-center justify-between mb-6'>
							<div class='flex items-center gap-3'>
								<div class='avatar avatar-placeholder'>
									<div class='bg-linear-to-br from-primary to-secondary text-primary-content rounded-full w-12 flex items-center justify-center shadow-md'>
										<span class='leading-none text-base font-semibold'>{getInitials(u.display_name)}</span>
									</div>
								</div>
								<div>
									<h3 class='text-2xl font-bold'>ユーザー編集</h3>
									<p class='text-sm opacity-60'>{u.email}</p>
								</div>
							</div>
							<button
								type='button'
								class='btn btn-sm btn-circle btn-ghost'
								onclick={() => showEdit = null}
								aria-label='ユーザー編集モーダルを閉じる'
							>
								<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
									<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
								</svg>
							</button>
						</div>

						<form method='POST' action='?/update' bind:this={editForm} use:enhance={enhanceEdit} onsubmit={() => showEdit = null} class='space-y-6'>
							<input type='hidden' name='userId' value={u.id} />

							<!-- Account Information -->
							<div class='bg-base-200/30 rounded-lg p-4'>
								<div class='flex items-center gap-2 mb-4'>
									<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-primary' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
										<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' />
									</svg>
									<h4 class='font-semibold'>アカウント情報</h4>
								</div>
								<div class='grid grid-cols-1 gap-4'>
									<div class='form-control'>
										<label class='label' for={`edit-display-name-${u.id}`}>
											<span class='label-text font-medium'>表示名</span>
										</label>
										<input
											id={`edit-display-name-${u.id}`}
											name='displayName'
											class='input input-bordered focus:input-primary transition-all duration-200'
											value={u.display_name ?? ''}
											placeholder='表示名を入力'
										/>
									</div>
									<div class='form-control'>
										<label class='label' for={`edit-email-${u.id}`}>
											<span class='label-text font-medium'>Email</span>
										</label>
										<input
											id={`edit-email-${u.id}`}
											name='email'
											type='email'
											class='input input-bordered focus:input-primary transition-all duration-200'
											value={u.email}
											placeholder='email@example.com'
										/>
									</div>
								</div>
							</div>

							<!-- Role Assignment -->
							<div class='bg-base-200/30 rounded-lg p-4'>
								<div class='flex items-center gap-2 mb-4'>
									<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 text-primary' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
										<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' />
									</svg>
									<h4 class='font-semibold'>権限設定</h4>
								</div>
								<RoleSelect name='roleName' roles={data.roles} placeholder='変更しない' value={u.role} />
							</div>

							<div class='divider'></div>

							<!-- Action Buttons -->
							<div class='modal-action'>
								<button type='button' class='btn btn-ghost' onclick={() => showEdit = null}>
									キャンセル
								</button>
								<button type='submit' class='btn btn-primary shadow-lg'>
									<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 mr-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
										<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7' />
									</svg>
									変更を保存
								</button>
							</div>
						</form>
					</div>
					<div
						class='modal-backdrop'
						role='button'
						tabindex='0'
						aria-label='ユーザー編集モーダルを閉じる'
						onclick={() => showEdit = null}
						onkeydown={(event) => {
							if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
								event.preventDefault()
								showEdit = null
							}
						}}
					></div>
				</div>
			{/if}
		{/each}
	{/if}

	<!-- Reset Password Modal -->
	{#if showReset}
		<div class='modal modal-open' transition:fade={{ duration: 200 }}>
			<div class='modal-box max-w-md' in:fly={{ y: -50, duration: 300 }}>
				<!-- Modal Header -->
				<div class='flex items-center justify-between mb-6'>
					<div class='flex items-center gap-3'>
						<div class='p-3 bg-warning/20 rounded-full'>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6 text-warning' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' />
							</svg>
						</div>
						<div>
							<h3 class='text-xl font-bold'>パスワードリセット</h3>
							<p class='text-sm opacity-60'>新しいパスワードを設定します</p>
						</div>
					</div>
					<button
						type='button'
						class='btn btn-sm btn-circle btn-ghost'
						onclick={() => showReset = null}
						aria-label='パスワードリセットモーダルを閉じる'
					>
						<svg xmlns='http://www.w3.org/2000/svg' class='h-6 w-6' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
							<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
						</svg>
					</button>
				</div>

				<!-- Warning Alert -->
				<div class='alert alert-warning mb-6'>
					<svg xmlns='http://www.w3.org/2000/svg' class='stroke-current shrink-0 h-6 w-6' fill='none' viewBox='0 0 24 24'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' />
					</svg>
					<span class='text-sm'>この操作によりユーザーのパスワードが変更されます</span>
				</div>

				<form method='POST' action='?/reset_password' bind:this={resetForm} use:enhance={enhancePassword} onsubmit={() => showReset = null} class='space-y-6'>
					<input type='hidden' name='userId' value={showReset} />

					<div class='form-control'>
						<label class='label' for={`reset-password-${showReset ?? 'user'}`}>
							<span class='label-text font-medium'>新しいパスワード</span>
							<span class='label-text-alt'>8文字以上</span>
						</label>
						<input
							id={`reset-password-${showReset ?? 'user'}`}
							name='newPassword'
							type='password'
							minlength='8'
							class='input input-bordered input-warning focus:input-warning transition-all duration-200'
							placeholder='••••••••'
							required
						/>
						<p class='label-text-alt text-warning mt-1'>パスワードは安全に保管してください</p>
					</div>

					<div class='divider'></div>

					<!-- Action Buttons -->
					<div class='modal-action'>
						<button type='button' class='btn btn-ghost' onclick={() => showReset = null}>
							キャンセル
						</button>
						<button type='submit' class='btn btn-warning shadow-lg'>
							<svg xmlns='http://www.w3.org/2000/svg' class='h-5 w-5 mr-2' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' />
							</svg>
							パスワードをリセット
						</button>
					</div>
				</form>
			</div>
			<div
				class='modal-backdrop'
				role='button'
				tabindex='0'
				aria-label='パスワードリセットモーダルを閉じる'
				onclick={() => showReset = null}
				onkeydown={(event) => {
					if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
						event.preventDefault()
						showReset = null
					}
				}}
			></div>
		</div>
	{/if}

</div>

<style>
  .modal-open .modal-box {
    max-width: 48rem;
    overflow: visible;
    animation: modalSlide 0.3s ease-out;
  }

  .modal-backdrop {
    background-color: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
  }

  .table :global(th), .table :global(td) {
    white-space: nowrap;
  }

  @keyframes modalSlide {
    from {
      transform: translateY(-50px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .badge {
    font-weight: 500;
    letter-spacing: 0.025em;
  }

  .stats {
    background: var(--b1);
  }
</style>
