<script lang='ts'>
	import type { notification, users } from '$lib/generated/client'
	import { enhance } from '$app/forms'
	import { useEnhance } from '$lib/utils/forms'

	const { data, form } = $props()

	type PageData = {
		users: users.UserInfo[]
		total: number
		stats: { active: number, inactive: number }
		error?: string
		categoryOptions: ReadonlyArray<notification.NotificationCategory> | ReadonlyArray<string>
		priorityOptions: ReadonlyArray<notification.NotificationPriority> | ReadonlyArray<string>
		defaultSource: string
	}

	const pageData = data as PageData
	const categoryOptions = Array.from(pageData.categoryOptions as ReadonlyArray<string>)
	const priorityOptions = Array.from(pageData.priorityOptions as ReadonlyArray<string>)
	const defaultCategory = categoryOptions.includes('system')
		? 'system'
		: (categoryOptions[0] as string | undefined) ?? 'system'
	const defaultPriority = priorityOptions.includes('normal')
		? 'normal'
		: (priorityOptions[0] as string | undefined) ?? 'normal'

	const allUsers: users.UserInfo[] = Array.isArray(pageData.users) ? [...pageData.users] : []

	let searchQuery = $state('')
	let selectedUserIds = $state<string[]>([])
	let subject = $state('')
	let message = $state('')
	let source = $state(pageData.defaultSource ?? 'dev-tools')
	let category = $state<string>(defaultCategory)
	let priority = $state<string>(defaultPriority)
	let templateId = $state('')
	let variablesJson = $state('')
	let metadataJson = $state('')
	let scheduledAt = $state('')
	let expiresAt = $state('')
	let channelInput = $state('')
	const variablesPlaceholder = '{"cta":"https://..."}'
	const metadataPlaceholder = '{"campaign":"debug"}'
	let sendForm: HTMLFormElement | null = null
	let latestResult = $state<{
		id: string
		status: string
		selectionCount: number
		primaryUserId: string
	} | null>(null)

	const sendEnhance = useEnhance({ successMessage: '通知を送信しました' })

	const filteredUsers = $derived.by<users.UserInfo[]>(() => {
		const query = searchQuery.trim().toLowerCase()
		if (!query)
			return allUsers
		return allUsers.filter((user) => {
			const name = user.display_name?.toLowerCase() ?? ''
			return (
				name.includes(query)
				|| user.email.toLowerCase().includes(query)
				|| user.id.toLowerCase().includes(query)
				|| user.role.toLowerCase().includes(query)
			)
		})
	})

	const selectedUsers = $derived.by<users.UserInfo[]>(() => {
		const set = new Set(selectedUserIds)
		return allUsers.filter((user) => set.has(user.id))
	})

	const selectedCount = $derived(selectedUserIds.length)
	const canSend = $derived(selectedCount > 0 && message.trim().length > 0)
	const allVisibleSelected = $derived(
		filteredUsers.length > 0 && filteredUsers.every((user) => selectedUserIds.includes(user.id)),
	)

	const actionError = $derived.by((): string | undefined => {
		if (!form || typeof form !== 'object')
			return undefined
		if ('success' in form && form.success)
			return undefined
		if ('error' in form && typeof form.error === 'string')
			return form.error as string
		return undefined
	})

	$effect(() => {
		if (!form || typeof form !== 'object' || !('success' in form) || !form.success)
			return
		const payload = form as Record<string, unknown>
		const result = typeof payload.result === 'object' && payload.result !== null ? payload.result as Record<string, unknown> : null
		latestResult = {
			id: (result && 'id' in result && typeof result.id === 'string') ? result.id : '-unknown-',
			status: (result && 'status' in result && typeof result.status === 'string') ? result.status as 'pending' | 'processing' | 'completed' | 'failed' : 'pending',
			selectionCount: typeof payload.selectionCount === 'number' ? payload.selectionCount : selectedUserIds.length,
			primaryUserId: typeof payload.primaryUserId === 'string' ? payload.primaryUserId : '-',
		}
		selectedUserIds = []
		subject = ''
		message = ''
		templateId = ''
		variablesJson = ''
		metadataJson = ''
		scheduledAt = ''
		expiresAt = ''
		channelInput = ''
		category = defaultCategory
		priority = defaultPriority
		source = pageData.defaultSource ?? 'dev-tools'
		if (sendForm && typeof sendForm === 'object' && 'reset' in sendForm && typeof sendForm.reset === 'function')
			(sendForm.reset as () => void)()
	})

	function toggleSelectVisible() {
		const visibleIds = filteredUsers.map((user) => user.id)
		const allSelected = visibleIds.every((id) => selectedUserIds.includes(id))
		if (allSelected) {
			selectedUserIds = selectedUserIds.filter((id) => !visibleIds.includes(id))
		} else {
			const combined = new Set([...selectedUserIds, ...visibleIds])
			selectedUserIds = Array.from(combined)
		}
	}

	function clearSelection() {
		selectedUserIds = []
	}

	function getRoleBadge(role: string) {
		const map: Record<string, string> = {
			super_admin: 'badge-error',
			admin: 'badge-warning',
			member: 'badge-info',
			viewer: 'badge-ghost',
		}
		return map[role] ?? 'badge-ghost'
	}

	function getInitials(name: string | null | undefined) {
		if (!name)
			return '?'
		const parts = name.split(/\s+/).filter(Boolean)
		if (parts.length >= 2) {
			return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
		}
		return name.slice(0, 2).toUpperCase()
	}

	function formatDateTime(value: string) {
		try {
			return new Date(value).toLocaleString('ja-JP')
		} catch {
			return value
		}
	}
</script>

<svelte:head>
	<title>通知コンソール - 開発者ツール</title>
</svelte:head>

<div class='container mx-auto px-4 py-8 space-y-8'>
	<div class='flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6'>
		<div class='space-y-2'>
			<div class='flex items-center gap-3'>
				<div class='w-12 h-12 rounded-2xl bg-linear-to-br from-primary to-secondary flex items-center justify-center text-2xl text-base-100 shadow-lg'>
					✉️
				</div>
				<div>
					<h1 class='text-3xl font-bold tracking-tight'>通知コンソール</h1>
					<p class='text-base-content/70'>複数ユーザーへカスタム通知を即時配信できます</p>
				</div>
			</div>
			<div class='badge badge-lg badge-outline'>開発者ツール</div>
		</div>
		<div class='stats bg-base-100 shadow-lg border border-base-300/50'>
			<div class='stat'>
				<div class='stat-title'>登録ユーザー</div>
				<div class='stat-value text-primary'>{pageData.total}</div>
				<div class='stat-desc'>取得件数 {allUsers.length}</div>
			</div>
			<div class='stat'>
				<div class='stat-title'>アクティブ</div>
				<div class='stat-value text-success'>{pageData.stats.active}</div>
			</div>
			<div class='stat'>
				<div class='stat-title'>非アクティブ</div>
				<div class='stat-value text-warning'>{pageData.stats.inactive}</div>
			</div>
		</div>
	</div>

	{#if pageData.error}
		<div class='alert alert-error shadow-lg'>
			<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' class='stroke-current shrink-0 w-6 h-6'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M12 9v3.75m-9.303 3.376c0 1.621 1.315 2.936 2.937 2.936h14.73c1.621 0 2.936-1.315 2.936-2.936 0-.906-.412-1.717-1.059-2.255l-7.37-6.129a2.936 2.936 0 00-3.742 0l-7.37 6.129c-.647.538-1.059 1.349-1.059 2.255zm9.303 5.814h.008v.008h-.008v-.008z' />
			</svg>
			<div>
				<h3 class='font-bold'>ユーザー情報の取得に失敗しました</h3>
				<div class='text-sm'>{pageData.error}</div>
			</div>
		</div>
	{/if}

	{#if actionError}
		<div class='alert alert-warning shadow'>
			<svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' class='stroke-current shrink-0 w-6 h-6'>
				<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
			</svg>
			<span>{actionError}</span>
		</div>
	{/if}

	<form method='POST' action='?/send' use:enhance={sendEnhance} bind:this={sendForm} class='grid gap-6 xl:grid-cols-[2fr_1fr]'>
		<div class='space-y-6'>
			<section class='card bg-base-100 shadow-xl border border-primary/20'>
				<div class='card-body space-y-6'>
					<div class='flex items-center justify-between gap-3'>
						<h2 class='card-title text-2xl'>必須項目</h2>
						<span class='badge badge-primary badge-lg'>Required</span>
					</div>

					<div class='space-y-4'>
						<div class='flex flex-col lg:flex-row lg:items-center gap-3'>
							<label class='input input-bordered flex items-center gap-2 w-full lg:w-80'>
								<svg xmlns='http://www.w3.org/2000/svg' class='w-5 h-5 opacity-60' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='currentColor'>
									<path stroke-linecap='round' stroke-linejoin='round' d='M21 21l-4.35-4.35M18.75 10.875a7.875 7.875 0 11-15.75 0 7.875 7.875 0 0115.75 0z' />
								</svg>
								<input type='search' class='grow' placeholder='ユーザー名・メール・ID で検索' bind:value={searchQuery} />
							</label>
							<div class='flex gap-2'>
								<button type='button' class='btn btn-sm btn-outline' onclick={toggleSelectVisible}>
									{#if allVisibleSelected}
										表示中の選択を解除
									{:else}
										表示中をすべて選択
									{/if}
								</button>
								<button type='button' class='btn btn-sm btn-ghost' onclick={clearSelection} disabled={selectedCount === 0}>
									選択をクリア
								</button>
							</div>
						</div>

						<div class='overflow-hidden rounded-2xl border border-base-300/60'>
							<div class='max-h-[420px] overflow-auto'>
								<table class='table table-pin-rows'>
									<thead class='bg-base-200/80'>
										<tr>
											<th class='w-12'></th>
											<th>ユーザー</th>
											<th>Email</th>
											<th>ロール</th>
											<th>状態</th>
											<th>登録日</th>
										</tr>
									</thead>
									<tbody>
										{#if filteredUsers.length === 0}
											<tr>
												<td colspan='6' class='py-10 text-center text-base-content/60'>
													対象のユーザーが見つかりませんでした
												</td>
											</tr>
										{:else}
											{#each filteredUsers as user (user.id)}
												<tr class={`transition-colors duration-150 ${selectedUserIds.includes(user.id) ? 'bg-primary/10' : ''}`}>
													<td>
														<input
															class='checkbox checkbox-primary'
															type='checkbox'
															name='userIds'
															value={user.id}
															bind:group={selectedUserIds}
														/>
													</td>
													<td>
														<div class='flex items-center gap-3'>
															<div class='avatar avatar-placeholder'>
																<div class='w-10 rounded-full bg-linear-to-br from-primary to-secondary text-primary-content flex items-center justify-center'>
																	<span class='text-sm font-semibold'>{getInitials(user.display_name)}</span>
																</div>
															</div>
															<div>
																<div class='font-semibold'>{user.display_name ?? 'No name'}</div>
																<div class='text-xs opacity-60'>ID: {user.id.slice(0, 8)}…</div>
															</div>
														</div>
													</td>
													<td class='text-sm'>{user.email}</td>
													<td>
														<span class={`badge badge-sm ${getRoleBadge(user.role)} capitalize`}>{user.role}</span>
													</td>
													<td>
														{#if user.is_active}
															<span class='badge badge-success badge-outline badge-sm'>Active</span>
														{:else}
															<span class='badge badge-ghost badge-sm'>Inactive</span>
														{/if}
													</td>
													<td class='text-xs'>{formatDateTime(user.created_at)}</td>
												</tr>
											{/each}
										{/if}
									</tbody>
								</table>
							</div>
						</div>
					</div>

					<div class='space-y-3'>
						<label class='label' for='notification-message'>
							<span class='label-text text-base font-semibold'>メッセージ本文</span>
							<span class='badge badge-outline badge-sm'>必須</span>
						</label>
						<textarea
							id='notification-message'
							class='textarea textarea-bordered textarea-lg min-h-[160px]'
							name='message'
							placeholder='送信したいメッセージを入力してください'
							bind:value={message}
						></textarea>
						<div class='bg-base-200/60 rounded-xl p-4 text-sm leading-relaxed'>
							<p class='font-semibold mb-2'>プレビュー</p>
							{#if message.trim().length === 0}
								<p class='text-base-content/60'>入力中のメッセージがここに表示されます。</p>
							{:else}
								<p class='whitespace-pre-wrap'>{message}</p>
							{/if}
						</div>
					</div>
				</div>
			</section>

			<section class='card bg-base-100 shadow-xl border border-base-300/50'>
				<div class='card-body space-y-6'>
					<div class='flex items-center justify-between gap-3'>
						<h2 class='card-title text-2xl'>任意設定</h2>
						<span class='badge badge-outline badge-lg'>Optional</span>
					</div>

					<div class='grid grid-cols-1 md:grid-cols-2 gap-4'>
						<label class='form-control'>
							<span class='label-text text-sm font-semibold'>件名 (任意)</span>
							<input class='input input-bordered' type='text' name='subject' placeholder='通知の件名' bind:value={subject} />
						</label>
						<label class='form-control'>
							<span class='label-text text-sm font-semibold'>送信ソース</span>
							<input class='input input-bordered' type='text' name='source' placeholder='system' bind:value={source} />
						</label>
						<label class='form-control'>
							<span class='label-text text-sm font-semibold'>カテゴリ</span>
							<select class='select select-bordered' name='category' bind:value={category}>
								{#each categoryOptions as option}
									<option value={option}>{option}</option>
								{/each}
							</select>
						</label>
						<label class='form-control'>
							<span class='label-text text-sm font-semibold'>優先度</span>
							<select class='select select-bordered' name='priority' bind:value={priority}>
								{#each priorityOptions as option}
									<option value={option}>{option}</option>
								{/each}
							</select>
						</label>
						<label class='form-control'>
							<span class='label-text text-sm font-semibold'>テンプレートID</span>
							<input class='input input-bordered' type='text' name='templateId' placeholder='テンプレート識別子' bind:value={templateId} />
						</label>
						<label class='form-control'>
							<span class='label-text text-sm font-semibold'>チャネルID (改行またはカンマ区切り)</span>
							<textarea class='textarea textarea-bordered' rows='3' name='channelInput' bind:value={channelInput} placeholder='user-123, broadcast'></textarea>
						</label>
					</div>

					<div class='grid grid-cols-1 md:grid-cols-2 gap-4'>
						<label class='form-control'>
							<span class='label-text text-sm font-semibold'>送信予定日時</span>
							<input class='input input-bordered' type='datetime-local' name='scheduledAt' bind:value={scheduledAt} />
						</label>
						<label class='form-control'>
							<span class='label-text text-sm font-semibold'>失効日時</span>
							<input class='input input-bordered' type='datetime-local' name='expiresAt' bind:value={expiresAt} />
						</label>
					</div>

					<div class='grid grid-cols-1 md:grid-cols-2 gap-4'>
						<label class='form-control'>
							<span class='label-text text-sm font-semibold'>リッチ変数 JSON</span>
							<textarea class='textarea textarea-bordered font-mono' name='variablesJson' rows='5' bind:value={variablesJson} placeholder={variablesPlaceholder}></textarea>
						</label>
						<label class='form-control'>
							<span class='label-text text-sm font-semibold'>メタデータ JSON</span>
							<textarea class='textarea textarea-bordered font-mono' name='metadataJson' rows='5' bind:value={metadataJson} placeholder={metadataPlaceholder}></textarea>
						</label>
					</div>
				</div>
			</section>
		</div>

		<aside class='space-y-6'>
			<div class='card bg-base-100 shadow-xl border border-base-300/60 sticky top-4'>
				<div class='card-body space-y-4'>
					<div class='flex items-center justify-between'>
						<h3 class='card-title text-xl'>送信サマリー</h3>
						<span class='badge badge-outline badge-sm'>ライブ更新</span>
					</div>
					<div class='space-y-2 text-sm'>
						<div class='flex items-center justify-between'>
							<span class='opacity-70'>選択ユーザー</span>
							<span class='font-semibold text-lg'>{selectedCount}</span>
						</div>
						<div class='flex items-center justify-between'>
							<span class='opacity-70'>優先度</span>
							<span class='font-semibold capitalize'>{priority}</span>
						</div>
						<div>
							<span class='opacity-70'>対象一覧</span>
							<div class='mt-2 max-h-32 overflow-auto border border-base-300/60 rounded-lg p-2 space-y-1 bg-base-200/40 text-xs'>
								{#if selectedUsers.length === 0}
									<span class='opacity-50'>ユーザーを選択してください</span>
								{:else}
									{#each selectedUsers as user}
										<div class='flex items-center gap-2'>
											<div class='w-1.5 h-1.5 rounded-full bg-primary'></div>
											<span>{user.display_name ?? user.email}</span>
										</div>
									{/each}
								{/if}
							</div>
						</div>
					</div>
					<button class='btn btn-primary btn-lg' type='submit' disabled={!canSend}>
						<svg xmlns='http://www.w3.org/2000/svg' class='w-5 h-5' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='currentColor'>
							<path stroke-linecap='round' stroke-linejoin='round' d='M6 12L3 3l18 9-18 9 3-9zm0 0l7.5 4.5M6 12l7.5-4.5' />
						</svg>
						通知を送信
					</button>
					<p class='text-xs opacity-70'>
						ユーザー選択とメッセージ本文が入力されている場合のみ送信できます。送信履歴はバックエンドのログで確認できます。
					</p>
				</div>
			</div>

			{#if latestResult}
				<div class='card bg-linear-to-br from-primary/90 to-secondary/90 text-primary-content shadow-xl'>
					<div class='card-body space-y-2'>
						<div class='flex items-center gap-3'>
							<svg xmlns='http://www.w3.org/2000/svg' class='w-8 h-8' fill='none' viewBox='0 0 24 24' stroke-width='1.5' stroke='currentColor'>
								<path stroke-linecap='round' stroke-linejoin='round' d='M12 6v6l4 2' />
							</svg>
							<div>
								<h3 class='text-xl font-bold'>最新の送信結果</h3>
								<p class='text-sm opacity-80'>ID: {latestResult.id}</p>
							</div>
						</div>
						<div class='space-y-1 text-sm'>
							<div class='flex items-center justify-between'>
								<span>ステータス</span>
								<span class='font-semibold capitalize'>{latestResult.status}</span>
							</div>
							<div class='flex items-center justify-between'>
								<span>配信人数</span>
								<span class='font-semibold'>{latestResult.selectionCount}</span>
							</div>
							<div class='flex items-center justify-between'>
								<span>プライマリユーザー</span>
								<span class='font-semibold'>{latestResult.primaryUserId}</span>
							</div>
						</div>
					</div>
				</div>
			{/if}
		</aside>
	</form>
</div>
