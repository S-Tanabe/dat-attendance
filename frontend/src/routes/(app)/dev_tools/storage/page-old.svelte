<script lang='ts'>
	import type {
		ListObjectsResponse,
		StorageBucketSummary,
	} from './api'
	import { enhance } from '$app/forms'
	import { goto, invalidate } from '$app/navigation'
	import { toast } from '$lib/stores/toast'
	import { useEnhance } from '$lib/utils/forms'

	const { data, form } = $props()

	const buckets = $derived((data.buckets ?? []) as StorageBucketSummary[])
	let selectedBucketId = $state('')
	const objects = $derived((data.objects ?? null) as ListObjectsResponse | null)
	let prefix = $state('')
	const errorMessage = $derived((data.error ?? null) as string | null)

	let selectedKeys = $state<string[]>([])
	let selectedFile = $state<File | null>(null)
	let uploadKey = $state('')

	const invalidateDeps = ['app:dev_tools:storage']

	const deleteEnhance = useEnhance({ successMessage: '削除しました', invalidateDeps })
	const folderEnhance = useEnhance({ successMessage: 'フォルダを作成しました', invalidateDeps })

	$effect(() => {
		const bucketIdFromData: unknown = (data as Record<string, unknown>).selectedBucketId
		const prefixFromData: unknown = (data as Record<string, unknown>).prefix
		selectedBucketId = (typeof bucketIdFromData === 'string' ? bucketIdFromData : null) ?? (buckets[0]?.id ?? '')
		prefix = (typeof prefixFromData === 'string' ? prefixFromData : null) ?? ''
		selectedKeys = []
		selectedFile = null
		uploadKey = ''
		if (typeof document !== 'undefined') {
			const fileInput = document.getElementById('storage-upload-input') as HTMLInputElement | null
			if (fileInput)
				fileInput.value = ''
		}
	})

	$effect(() => {
		if (form?.action === 'delete' && form.success) {
			selectedKeys = []
		}
	})

	const currentBucket = $derived(buckets.find((b) => b.id === selectedBucketId) ?? null)
	const prefixSegments = $derived(prefix.split('/').filter(Boolean))
	const canWrite = $derived(currentBucket?.capabilities.write ?? false)
	const canDelete = $derived(currentBucket?.capabilities.destroy ?? false)
	const canCreateFolder = $derived(currentBucket?.capabilities.createPrefix ?? false)

	function buildUrl(bucket: string, nextPrefix: string) {
		const params = new URLSearchParams()
		if (bucket)
			params.set('bucket', bucket)
		if (nextPrefix)
			params.set('prefix', nextPrefix)
		return `/dev_tools/storage?${params.toString()}`
	}

	async function navigateBucket(bucketId: string) {
		await goto(buildUrl(bucketId, ''))
	}

	async function navigatePrefix(nextPrefix: string) {
		await goto(buildUrl(selectedBucketId, nextPrefix))
	}

	async function goUp() {
		if (!prefix)
			return
		const trimmed = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
		const parts = trimmed.split('/').filter(Boolean)
		parts.pop()
		const next = parts.length > 0 ? `${parts.join('/')}/` : ''
		await navigatePrefix(next)
	}

	function toggleSelection(key: string) {
		if (selectedKeys.includes(key)) {
			selectedKeys = selectedKeys.filter((k) => k !== key)
		} else {
			selectedKeys = [...selectedKeys, key]
		}
	}

	function isSelected(key: string) {
		return selectedKeys.includes(key)
	}

	function onFileChange(event: Event) {
		const target = event.target as HTMLInputElement
		const file = target.files?.[0] ?? null
		selectedFile = file
		if (file) {
			uploadKey = `${prefix}${file.name}`
		} else {
			uploadKey = ''
		}
	}

	const downloadEnhance = () => async ({ result }: { result: { type: string, data?: unknown } }) => {
		if (result.type === 'failure') {
			const message = (typeof result.data === 'object' && result.data !== null && 'error' in result.data && typeof result.data.error === 'string') ? result.data.error : 'ダウンロードURLの生成に失敗しました'
			toast.error(message)
			return
		}
		if (result.type === 'success') {
			let url: string | undefined
			if (typeof result.data === 'object' && result.data !== null && 'url' in result.data) {
				const urlData = result.data.url
				if (typeof urlData === 'object' && urlData !== null && 'url' in urlData && typeof urlData.url === 'string') {
					url = urlData.url
				}
			}
			if (!url) {
				toast.error('ダウンロードURLが取得できませんでした')
				return
			}
			window.open(url, '_blank')
			toast.success('ダウンロード開始')
		}
	}

	const uploadEnhance = () => async ({ result }: { result: { type: string, data?: unknown } }) => {
		if (!selectedFile) {
			toast.error('アップロードするファイルを選択してください')
			return
		}
		if (result.type === 'failure') {
			const message = (typeof result.data === 'object' && result.data !== null && 'error' in result.data && typeof result.data.error === 'string') ? result.data.error : 'アップロードURLの生成に失敗しました'
			toast.error(message)
			return
		}
		if (result.type === 'success') {
			try {
				let url: string | undefined
				if (typeof result.data === 'object' && result.data !== null && 'url' in result.data) {
					const urlData = result.data.url
					if (typeof urlData === 'object' && urlData !== null && 'url' in urlData && typeof urlData.url === 'string') {
						url = urlData.url
					}
				}
				if (!url) {
					toast.error('アップロードURLが取得できませんでした')
					return
				}
				const response = await fetch(url, {
					method: 'PUT',
					body: selectedFile,
					headers: {
						'Content-Type': selectedFile.type || 'application/octet-stream',
					},
				})
				if (!response.ok) {
					throw new Error(`status ${response.status}`)
				}
				toast.success('ファイルをアップロードしました')
				selectedFile = null
				uploadKey = ''
				if (typeof document !== 'undefined') {
					const el = document.getElementById('storage-upload-input') as HTMLInputElement | null
					if (el)
						el.value = ''
				}
				for (const dep of invalidateDeps) {
					await invalidate(dep)
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				toast.error(`アップロードに失敗しました: ${message}`)
			}
		}
	}
</script>

<svelte:head>
	<title>バケットエクスプローラー - 開発者ツール - FOX HOUND</title>
	<meta name='robots' content='noindex' />
</svelte:head>

<div class='container mx-auto px-4 py-8 space-y-6'>
	<div class='flex items-center gap-3'>
		<span class='text-3xl'>🗂️</span>
		<div>
			<h1 class='text-2xl font-bold'>バケットエクスプローラー</h1>
			<p class='text-base-content/70 text-sm'>Object Storage 内のバケットを横断的に閲覧・操作します。</p>
		</div>
	</div>

	{#if errorMessage}
		<div class='alert alert-error'>
			<span>{errorMessage}</span>
		</div>
	{/if}

	<div class='card bg-base-100 shadow'>
		<div class='card-body space-y-4'>
			<div class='flex flex-col gap-3 lg:flex-row lg:items-end'>
				<label class='form-control w-full lg:w-64'>
					<div class='label'>
						<span class='label-text'>バケット</span>
					</div>
					<select class='select select-bordered' bind:value={selectedBucketId} onchange={(e) => navigateBucket((e.target as HTMLSelectElement).value)}>
						{#each buckets as bucket}
							<option value={bucket.id}>{bucket.label}</option>
						{/each}
					</select>
				</label>
				<div class='grid grid-cols-2 gap-2 text-sm lg:flex lg:items-center lg:gap-6'>
					<div>
						<span class='block text-xs opacity-70'>読み取り</span>
						<span class={currentBucket?.capabilities.read ? 'text-success font-semibold' : 'opacity-50'}>{currentBucket?.capabilities.read ? '許可' : '不可'}</span>
					</div>
					<div>
						<span class='block text-xs opacity-70'>アップロード</span>
						<span class={currentBucket?.capabilities.write ? 'text-success font-semibold' : 'opacity-50'}>{currentBucket?.capabilities.write ? '許可' : '不可'}</span>
					</div>
					<div>
						<span class='block text-xs opacity-70'>削除</span>
						<span class={currentBucket?.capabilities.destroy ? 'text-success font-semibold' : 'opacity-50'}>{currentBucket?.capabilities.destroy ? '許可' : '不可'}</span>
					</div>
					<div>
						<span class='block text-xs opacity-70'>フォルダ作成</span>
						<span class={currentBucket?.capabilities.createPrefix ? 'text-success font-semibold' : 'opacity-50'}>{currentBucket?.capabilities.createPrefix ? '許可' : '不可'}</span>
					</div>
				</div>
			</div>

			<div class='flex items-center gap-2 text-sm'>
				<span class='opacity-70'>現在のパス:</span>
				<div class='breadcrumbs text-sm'>
					<ul>
						<li><button class='link' type='button' onclick={() => navigatePrefix('')}>root</button></li>
						{#if prefixSegments.length}
							{#each prefixSegments as segment, index}
								<li>
									<button
										class='link'
										type='button'
										onclick={() => navigatePrefix(`${prefixSegments.slice(0, index + 1).join('/')}/`)}
									>{segment}</button>
								</li>
							{/each}
						{/if}
					</ul>
				</div>
				<button class='btn btn-ghost btn-xs' type='button' onclick={goUp} disabled={!prefix}>一つ上へ</button>
			</div>
		</div>
	</div>

	<div class='grid gap-4 lg:grid-cols-3'>
		<div class='bg-base-100 shadow rounded-box p-4 space-y-3'>
			<h2 class='font-semibold'>フォルダ</h2>
			<div class='space-y-2'>
				{#if objects?.directories?.length}
					{#each objects.directories as dir (dir.key)}
						<button class='btn btn-ghost justify-start w-full' type='button' onclick={() => navigatePrefix(dir.key)}>
							📁 {dir.name || dir.key}
						</button>
					{/each}
				{:else}
					<p class='text-sm opacity-60'>サブフォルダはありません</p>
				{/if}
			</div>
			{#if canCreateFolder}
				<form method='post' action='?/folder' use:enhance={folderEnhance} class='space-y-2'>
					<input type='hidden' name='bucketId' value={selectedBucketId} />
					<label class='form-control'>
						<span class='label-text text-sm'>新しいフォルダ名</span>
						<input class='input input-bordered input-sm' name='prefix' placeholder='reports/' required />
					</label>
					<button class='btn btn-primary btn-sm' type='submit'>フォルダ作成</button>
				</form>
			{/if}
		</div>

		<div class='lg:col-span-2 bg-base-100 shadow rounded-box p-4 space-y-4'>
			<div class='flex flex-wrap items-center gap-2'>
				<h2 class='font-semibold mr-auto'>ファイル ({objects?.objects.length ?? 0})</h2>
				{#if canDelete}
					<form method='post' action='?/delete' use:enhance={deleteEnhance} class='flex items-center gap-2'>
						<input type='hidden' name='bucketId' value={selectedBucketId} />
						{#each selectedKeys as key}
							<input type='hidden' name='keys' value={key} />
						{/each}
						<button class='btn btn-error btn-sm' type='submit' disabled={selectedKeys.length === 0}>選択を削除</button>
					</form>
				{/if}
				{#if canWrite}
					<form method='post' action='?/upload' use:enhance={uploadEnhance} class='flex items-center gap-2'>
						<input type='hidden' name='bucketId' value={selectedBucketId} />
						<input type='hidden' name='key' value={uploadKey} />
						<input type='hidden' name='contentType' value={selectedFile?.type ?? ''} />
						<input id='storage-upload-input' type='file' class='file-input file-input-sm' onchange={onFileChange} />
						<button class='btn btn-primary btn-sm' type='submit' disabled={!selectedFile}>アップロード</button>
					</form>
				{/if}
			</div>

			<div class='overflow-x-auto'>
				<table class='table table-sm'>
					<thead>
						<tr>
							<th>選択</th>
							<th>名前</th>
							<th>サイズ</th>
							<th>Content-Type</th>
							<th>操作</th>
						</tr>
					</thead>
					<tbody>
						{#if objects?.objects.length}
							{#each objects.objects as item (item.key)}
								<tr class={isSelected(item.key) ? 'active' : ''}>
									<td>
										<input type='checkbox' class='checkbox checkbox-sm' checked={isSelected(item.key)} onclick={() => toggleSelection(item.key)} />
									</td>
									<td class='font-mono text-xs break-all'>{item.name}</td>
									<td>{Math.ceil(item.size / 1024)} KB</td>
									<td>{item.contentType ?? 'unknown'}</td>
									<td class='flex gap-2'>
										<form method='post' action='?/download' use:enhance={downloadEnhance}>
											<input type='hidden' name='bucketId' value={selectedBucketId} />
											<input type='hidden' name='key' value={item.key} />
											<button class='btn btn-outline btn-xs' type='submit'>DL</button>
										</form>
										{#if canDelete}
											<button class='btn btn-outline btn-xs btn-error' type='button' onclick={() => toggleSelection(item.key)}>選択</button>
										{/if}
									</td>
								</tr>
							{/each}
						{:else}
							<tr>
								<td colspan='5' class='text-center opacity-60'>ファイルがありません</td>
							</tr>
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</div>
</div>
