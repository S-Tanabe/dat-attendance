<script lang='ts'>
	import type {
		DirectoryEntry,
		ListObjectsResponse,
		ObjectEntry,
		StorageBucketSummary,
	} from './api'
	import { enhance } from '$app/forms'
	import { goto, invalidate } from '$app/navigation'
	import { toast } from '$lib/stores/toast'
	import { useEnhance } from '$lib/utils/forms'
	import { tick } from 'svelte'

	const { data, form } = $props()

	const buckets = $derived((data.buckets ?? []) as StorageBucketSummary[])
	let selectedBucketId = $state('')
	const objects = $derived((data.objects ?? null) as ListObjectsResponse | null)
	let prefix = $state('')
	const errorMessage = $derived((data.error ?? null) as string | null)

	let selectedKeys = $state<string[]>([])
	let selectedDirectories = $state<string[]>([])
	let selectedFile = $state<File | null>(null)
	let uploadKey = $state('')
	let viewMode = $state<'list' | 'column'>('column')
	let showDetailModal = $state(false)
	let detailItem = $state<ObjectEntry | DirectoryEntry | null>(null)
	let columnWidths = $state<number[]>([300])
	let columnsData = $state<Array<{ path: string, objects: ListObjectsResponse | null }>>([])
	let selectedItemInColumn = $state<Map<number, string>>(new Map())
	let loadingColumn = $state<number | null>(null)
	let uploadForm = $state<HTMLFormElement | null>(null)

	function resolveActivePrefix(): string {
		if (viewMode === 'column' && columnsData.length > 0) {
			const last = columnsData[columnsData.length - 1]
			return last?.path ?? ''
		}
		return prefix ?? ''
	}

	function normalizePrefixPath(path: string): string {
		if (!path)
			return ''
		return path.endsWith('/') ? path : `${path}/`
	}

	const invalidateDeps = ['app:dev_tools:storage']

	const deleteEnhance = useEnhance({ successMessage: '削除しました', invalidateDeps })

	$effect(() => {
		const bucketIdFromData: unknown = data.selectedBucketId
		const prefixFromData: unknown = data.prefix
		selectedBucketId = (typeof bucketIdFromData === 'string' ? bucketIdFromData : undefined) ?? (buckets[0]?.id ?? '')
		prefix = (typeof prefixFromData === 'string' ? prefixFromData : undefined) ?? ''
		selectedKeys = []
		selectedDirectories = []
		selectedFile = null
		uploadKey = ''
		// Initialize columns data for column view
		columnsData = [{ path: prefix || '', objects }]
		selectedItemInColumn = new Map()

		if (typeof document !== 'undefined') {
			const fileInput = document.getElementById('storage-upload-input') as HTMLInputElement | null
			if (fileInput)
				fileInput.value = ''
		}
	})

	$effect(() => {
		if (form?.action === 'delete' && form.success) {
			selectedKeys = []
			selectedDirectories = []
		}
	})

	const currentBucket = $derived(buckets.find((b) => b.id === selectedBucketId) ?? null)
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

	function setDirectorySelections(keys: string[]) {
		const unique = Array.from(new Set(keys))
		selectedDirectories = unique
	}

	function toggleDirectorySelection(key: string, opts: { multi?: boolean } = {}) {
		if (opts.multi) {
			if (selectedDirectories.includes(key)) {
				selectedDirectories = selectedDirectories.filter((k) => k !== key)
			} else {
				selectedDirectories = [...selectedDirectories, key]
			}
		} else {
			if (selectedDirectories.length === 1 && selectedDirectories[0] === key) {
				selectedDirectories = []
			} else {
				selectedDirectories = [key]
			}
		}
	}

	function isDirectorySelected(key: string) {
		return selectedDirectories.includes(key)
	}

	function handleDirectoryClick(event: MouseEvent, dirKey: string) {
		if (event.detail === 2) {
			return
		}
		const multi = event.metaKey || event.ctrlKey
		toggleDirectorySelection(dirKey, { multi })
		if (!multi) {
			selectedKeys = []
		}
	}

	function isActivationKey(event: KeyboardEvent) {
		return event.key === 'Enter' || event.key === ' '
	}

	async function handleDirectoryKeydown(event: KeyboardEvent, dirKey: string) {
		if (!isActivationKey(event))
			return
		event.preventDefault()
		toggleDirectorySelection(dirKey)
		selectedKeys = []
		if (event.key === 'Enter') {
			await navigatePrefix(dirKey)
		}
	}

	function handleFileKeydown(event: KeyboardEvent, key: string) {
		if (!isActivationKey(event))
			return
		event.preventDefault()
		toggleSelection(key)
	}

	async function handleColumnDirectoryActivate(dirKey: string, columnIndex: number) {
		if (selectedItemInColumn.get(columnIndex) === dirKey) {
			const newSelections = new Map(selectedItemInColumn)
			newSelections.delete(columnIndex)
			for (let i = columnIndex + 1; i < columnsData.length; i++) {
				newSelections.delete(i)
			}
			selectedItemInColumn = newSelections
			setDirectorySelections(Array.from(newSelections.values()))
			columnsData = columnsData.slice(0, columnIndex + 1)
		} else {
			const newSelections = new Map(selectedItemInColumn)
			for (let i = columnIndex + 1; i < columnsData.length; i++) {
				newSelections.delete(i)
			}
			newSelections.set(columnIndex, dirKey)
			selectedItemInColumn = newSelections
			setDirectorySelections(Array.from(newSelections.values()))
			selectedKeys = []

			if (!columnWidths[columnIndex + 1]) {
				updateColumnWidth(columnIndex + 1, 300)
			}

			await loadFolderContents(dirKey, columnIndex)
		}
	}

	async function handleColumnDirectoryKeydown(event: KeyboardEvent, dirKey: string, columnIndex: number) {
		if (!isActivationKey(event))
			return
		event.preventDefault()
		await handleColumnDirectoryActivate(dirKey, columnIndex)
	}

	function handleColumnFileInteraction(event: MouseEvent | KeyboardEvent, item: ObjectEntry, columnIndex: number) {
		if (event instanceof KeyboardEvent) {
			if (!isActivationKey(event))
				return
			event.preventDefault()
		} else {
			event.preventDefault()
		}

		const newSelections = new Map<number, string>()
		for (let i = 0; i < columnIndex; i++) {
			if (selectedItemInColumn.has(i)) {
				newSelections.set(i, selectedItemInColumn.get(i)!)
			}
		}
		selectedItemInColumn = newSelections
		columnsData = columnsData.slice(0, columnIndex + 1)

		const multi = event.metaKey || event.ctrlKey
		if (!multi) {
			if (selectedKeys.includes(item.key)) {
				selectedKeys = []
			} else {
				selectedKeys = [item.key]
			}
		} else {
			if (selectedKeys.includes(item.key)) {
				selectedKeys = selectedKeys.filter((k) => k !== item.key)
			} else {
				selectedKeys = [...selectedKeys, item.key]
			}
		}
	}

	function closeDetailModal() {
		showDetailModal = false
		detailItem = null
	}

	function updateColumnWidth(columnIndex: number, width: number) {
		const next = [...columnWidths]
		next[columnIndex] = width
		columnWidths = next
	}

	function handleResizeHandleKeydown(event: KeyboardEvent, columnIndex: number) {
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault()
			const delta = event.key === 'ArrowLeft' ? -20 : 20
			const currentWidth = columnWidths[columnIndex] ?? 300
			const newWidth = Math.max(200, Math.min(500, currentWidth + delta))
			updateColumnWidth(columnIndex, newWidth)
		}
	}

	async function onFileChange(event: Event) {
		const target = event.target as HTMLInputElement
		const file = target.files?.[0] ?? null
		selectedFile = file

		if (!file) {
			uploadKey = ''
			return
		}

		if (!selectedBucketId) {
			toast.error('アップロード先のバケットが選択されていません')
			selectedFile = null
			uploadKey = ''
			target.value = ''
			return
		}

		const activePrefix = resolveActivePrefix()
		const normalizedPrefix = normalizePrefixPath(activePrefix)
		uploadKey = `${normalizedPrefix}${file.name}`

		await tick()
		uploadForm?.requestSubmit()
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
				selectedKeys = []
				selectedDirectories = []
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

	function getFileIcon(item: ObjectEntry) {
		const contentType = item.contentType || ''
		const filename = item.name
		const ext = filename.split('.').pop()?.toLowerCase()

		// Check MIME type first
		if (contentType.startsWith('image/'))
			return '🖼️'
		if (contentType.startsWith('video/'))
			return '🎬'
		if (contentType.startsWith('audio/'))
			return '🎵'
		if (contentType === 'application/pdf')
			return '📕' // PDF icon
		if (contentType === 'application/json')
			return '📋' // JSON doc icon
		if (contentType.startsWith('application/')) {
			// Extract the type after application/
			const appType = contentType.split('/')[1]?.split(';')[0]
			if (appType === 'zip' || appType === 'x-zip-compressed')
				return '📦'
			if (appType === 'msword' || appType?.includes('document'))
				return '📝'
			if (appType?.includes('sheet') || appType === 'vnd.ms-excel')
				return '📊'
			if (appType?.includes('presentation') || appType === 'vnd.ms-powerpoint')
				return '📽️'
			return '📄' // Generic document for other application types
		}
		if (contentType.startsWith('text/'))
			return '📝'

		// Fallback to extension-based detection
		const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp']
		const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm']
		const audioExts = ['mp3', 'wav', 'flac', 'aac', 'm4a']
		const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz']

		if (imageExts.includes(ext || ''))
			return '🖼️'
		if (videoExts.includes(ext || ''))
			return '🎬'
		if (audioExts.includes(ext || ''))
			return '🎵'
		if (archiveExts.includes(ext || ''))
			return '📦'
		if (ext === 'pdf')
			return '📕'
		if (ext === 'json')
			return '📋'

		return '📎' // Default file icon
	}

	function getCurrentObjectKeys(): string[] {
		const lastColumn = columnsData.length > 0 ? columnsData[columnsData.length - 1] : null
		const columnObjects = lastColumn?.objects?.objects ?? []
		if (columnObjects.length > 0) {
			return columnObjects.map((o) => o.key)
		}
		return objects?.objects?.map((o) => o.key) ?? []
	}

	async function loadFolderContents(folderPath: string, columnIndex: number) {
		if (!selectedBucketId)
			return

		loadingColumn = columnIndex + 1
		selectedKeys = []

		try {
			const response = await fetch(`/dev_tools/storage/api/objects?bucket=${selectedBucketId}&prefix=${folderPath}`)
			const data: unknown = await response.json()

			// Remove columns after the current one and add new column
			columnsData = [
				...columnsData.slice(0, columnIndex + 1),
				{ path: folderPath, objects: data as ListObjectsResponse | null },
			]
		} catch (error) {
			toast.error('フォルダの読み込みに失敗しました')
			console.error('Failed to load folder:', error)
		} finally {
			loadingColumn = null
		}
	}

	// Keyboard shortcuts
	function handleKeyDown(e: KeyboardEvent) {
		// Cmd/Ctrl + A - Select all
		if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
			e.preventDefault()
			selectedKeys = getCurrentObjectKeys()
			selectedDirectories = []
		}

		// Escape - Clear selection
		if (e.key === 'Escape') {
			selectedKeys = []
			selectedDirectories = []
		}

		// Cmd/Ctrl + Delete - Delete selected items
		if (
			(e.metaKey || e.ctrlKey)
			&& e.key === 'Backspace'
			&& canDelete
			&& (selectedKeys.length > 0 || selectedDirectories.length > 0)
		) {
			e.preventDefault()
			const form = document.querySelector('form[action="?/delete"]') as HTMLFormElement
			if (form)
				form.submit()
		}

		// Cmd/Ctrl + 1/2 - Switch view modes
		if ((e.metaKey || e.ctrlKey) && e.key === '1') {
			e.preventDefault()
			viewMode = 'list'
		}
		if ((e.metaKey || e.ctrlKey) && e.key === '2') {
			e.preventDefault()
			viewMode = 'column'
		}

		// Arrow Up - Navigate to parent folder
		if (e.key === 'ArrowUp' && e.altKey) {
			e.preventDefault()
			void goUp()
		}
	}

	$effect(() => {
		if (typeof window !== 'undefined') {
			window.addEventListener('keydown', handleKeyDown)
			return () => window.removeEventListener('keydown', handleKeyDown)
		}
	})
</script>

<svelte:head>
	<title>ストレージ - FOX HOUND</title>
	<meta name='robots' content='noindex' />
</svelte:head>

<div class='storage-container'>
	<!-- Modern Toolbar -->
	<div class='toolbar'>
		<div class='action-buttons'>
			{#if canWrite}
				<button
					class='action-btn'
					onclick={() => document.getElementById('storage-upload-input')?.click()}
					title='アップロード'
					aria-label='アップロード'
				>
					<svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' />
					</svg>
				</button>
			{/if}
			{#if canCreateFolder}
				<button
					class='action-btn'
					onclick={() => {
						const name = prompt('新しいフォルダ名:')
						if (name) {
							const form = document.createElement('form')
							form.method = 'POST'
							form.action = '?/folder'
							const bucketInput = document.createElement('input')
							bucketInput.name = 'bucketId'
							bucketInput.value = selectedBucketId
							const prefixInput = document.createElement('input')
							prefixInput.name = 'prefix'
							prefixInput.value = `${prefix}${name}/`
							form.appendChild(bucketInput)
							form.appendChild(prefixInput)
							document.body.appendChild(form)
							form.submit()
						}
					}}
					title='新規フォルダ'
					aria-label='新規フォルダ'
				>
					<svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z' />
					</svg>
				</button>
			{/if}
			{#if selectedKeys.length === 1 && selectedDirectories.length === 0}
				<button
					class='action-btn'
					onclick={() => {
						const form = document.querySelector('form[action="?/download"]') as HTMLFormElement
						if (form)
							form.submit()
					}}
					title='ダウンロード'
					aria-label='ダウンロード'
				>
					<svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10' />
					</svg>
				</button>
			{/if}
			<button
				class='action-btn'
				onclick={() => {
					if (selectedKeys.length === 1) {
						const item = columnsData
							.flatMap((col) => col.objects?.objects ?? [])
							.find((obj) => selectedKeys.includes(obj.key))
						if (item) {
							detailItem = item
							showDetailModal = true
							return
						}
					}

					if (selectedDirectories.length === 1) {
						const dirKey = selectedDirectories[0]
						const dirFromColumns = columnsData
							.flatMap((col) => col.objects?.directories ?? [])
							.find((dir) => dir.key === dirKey)
						const dirFromList = objects?.directories?.find((dir) => dir.key === dirKey)
						const resolvedDir = dirFromColumns ?? dirFromList
						if (resolvedDir) {
							detailItem = resolvedDir
							showDetailModal = true
							return
						}
					}

					if (selectedItemInColumn.size > 0) {
						const lastSelection = Array.from(selectedItemInColumn.entries()).pop()
						if (lastSelection) {
							const [colIndex, key] = lastSelection
							const dir = columnsData[colIndex]?.objects?.directories?.find((d) => d.key === key)
							if (dir) {
								detailItem = dir
								showDetailModal = true
							}
						}
					}
				}}
				title='詳細'
				aria-label='詳細'
				disabled={selectedKeys.length === 0 && selectedDirectories.length === 0 && selectedItemInColumn.size === 0}
			>
				<svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M15 12a3 3 0 11-6 0 3 3 0 016 0z' />
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' />
				</svg>
			</button>
		</div>

		<div class='view-switcher'>
			<button
				class="view-btn {viewMode === 'list' ? 'active' : ''}"
				onclick={() => viewMode = 'list'}
				aria-label='リスト表示'
			>
				<svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 6h16M4 12h16M4 18h16' />
				</svg>
			</button>
			<button
				class="view-btn {viewMode === 'column' ? 'active' : ''}"
				onclick={() => viewMode = 'column'}
				aria-label='カラム表示'
			>
				<svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2' />
				</svg>
			</button>
		</div>
	</div>

	<!-- Hidden file input for upload -->
	{#if canWrite}
		<form
			method='post'
			action='?/upload'
			use:enhance={uploadEnhance}
			bind:this={uploadForm}
			style='display: none;'
		>
			<input type='hidden' name='bucketId' value={selectedBucketId} />
			<input type='hidden' name='key' value={uploadKey} />
			<input type='hidden' name='contentType' value={selectedFile?.type ?? ''} />
			<input
				id='storage-upload-input'
				type='file'
				onchange={onFileChange}
			/>
		</form>
	{/if}

	<div class='main-container'>
		<!-- Sidebar -->
		<div class='sidebar'>
			<div class='bucket-list'>
				<h3 class='bucket-title'>BUCKETS</h3>
				{#each buckets as bucket}
					<button
						class="bucket-item {selectedBucketId === bucket.id ? 'active' : ''}"
						onclick={() => navigateBucket(bucket.id)}
					>
						<div class='bucket-icon'>
							<svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4' />
							</svg>
						</div>
						<span class='bucket-label'>{bucket.label}</span>
						<div class='bucket-capabilities'>
							{#if bucket.capabilities.write}
								<span class='capability' title='Write'>W</span>
							{/if}
							{#if bucket.capabilities.destroy}
								<span class='capability' title='Delete'>D</span>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		</div>

		<!-- Content Area -->
		<div class='content-area'>
			{#if errorMessage}
				<div class='error-message'>
					{errorMessage}
				</div>
			{/if}

			{#if viewMode === 'list'}
				<div class='list-view'>
					<div class='list-header'>
						<div class='list-col col-name'>名前</div>
						<div class='list-col col-size'>サイズ</div>
						<div class='list-col col-type'>種類</div>
						<div class='list-col col-actions'>操作</div>
					</div>
					<div class='list-body'>
						{#each objects?.directories ?? [] as dir}
							<div
								class="list-item {isDirectorySelected(dir.key) ? 'selected' : ''}"
								role='button'
								tabindex='0'
								aria-label={`フォルダ ${dir.name || dir.key}`}
								aria-pressed={isDirectorySelected(dir.key)}
								onclick={(event) => handleDirectoryClick(event, dir.key)}
								ondblclick={() => navigatePrefix(dir.key)}
								onkeydown={(event) => handleDirectoryKeydown(event, dir.key)}
							>
								<div class='list-col col-name'>
									<span class='file-icon'>📁</span>
									{dir.name || dir.key}
								</div>
								<div class='list-col col-size'>—</div>
								<div class='list-col col-type'>フォルダ</div>
								<div class='list-col col-actions'></div>
							</div>
						{/each}
						{#each objects?.objects ?? [] as item}
							<div
								class="list-item {isSelected(item.key) ? 'selected' : ''}"
								role='button'
								tabindex='0'
								aria-label={`ファイル ${item.name}`}
								aria-pressed={isSelected(item.key)}
								onclick={() => toggleSelection(item.key)}
								onkeydown={(event) => handleFileKeydown(event, item.key)}
							>
								<div class='list-col col-name'>
									<span class='file-icon'>{getFileIcon(item)}</span>
									{item.name}
								</div>
								<div class='list-col col-size'>{Math.ceil(item.size / 1024)} KB</div>
								<div class='list-col col-type'>{item.contentType || 'unknown'}</div>
								<div class='list-col col-actions'>
									<form method='post' action='?/download' use:enhance={downloadEnhance}>
										<input type='hidden' name='bucketId' value={selectedBucketId} />
										<input type='hidden' name='key' value={item.key} />
										<button class='btn-list-action' type='submit' aria-label='ダウンロード'>
											<svg class='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
												<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10' />
											</svg>
										</button>
									</form>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{:else if viewMode === 'column'}
				<div class='column-view'>
					{#each columnsData as columnData, columnIndex}
						{@const dirs = columnData.objects?.directories ?? []}
						{@const files = columnData.objects?.objects ?? []}
						{@const width = columnWidths[columnIndex] || 300}
						<div class='column' style='width: {width}px; min-width: {width}px;'>
							<div class='column-header'>
								{columnData.path ? columnData.path.split('/').pop() || 'ルート' : 'ルート'}
							</div>
							<div class='column-body'>
								{#if loadingColumn === columnIndex}
									<div class='column-loading'>
										<div class='spinner'></div>
									</div>
								{:else}
									{#each dirs as dir}
										<div
											class="column-item {selectedItemInColumn.get(columnIndex) === dir.key ? 'selected' : ''}"
											role='button'
											tabindex='0'
											aria-label={`フォルダ ${dir.name || dir.key}`}
											aria-pressed={selectedItemInColumn.get(columnIndex) === dir.key}
											onclick={() => handleColumnDirectoryActivate(dir.key, columnIndex)}
											onkeydown={(event) => handleColumnDirectoryKeydown(event, dir.key, columnIndex)}
										>
											<svg class='w-4 h-4 shrink-0' fill='currentColor' viewBox='0 0 20 20'>
												<path d='M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z' />
											</svg>
											<span class='file-name'>{dir.name || dir.key}</span>
										</div>
									{/each}
									{#each files as item}
										<div
											class="column-item file {selectedKeys.includes(item.key) ? 'selected' : ''}"
											role='button'
											tabindex='0'
											aria-label={`ファイル ${item.name}`}
											aria-pressed={selectedKeys.includes(item.key)}
											onclick={(event) => handleColumnFileInteraction(event, item, columnIndex)}
											onkeydown={(event) => handleColumnFileInteraction(event, item, columnIndex)}
										>
											<div class='file-icon-wrapper'>
												{#if item.contentType?.startsWith('image/')}
													<span style='font-size: 14px;'>🌄</span>
												{:else if item.contentType === 'application/pdf'}
													<span style='font-size: 14px;'>📕</span>
												{:else if item.contentType === 'application/json'}
													<span style='font-size: 14px;'>📋</span>
												{:else if item.contentType?.startsWith('application/')}
													<span style='font-size: 14px;'>📄</span>
												{:else if item.contentType?.startsWith('text/')}
													<span style='font-size: 14px;'>📝</span>
												{:else if item.contentType?.startsWith('video/')}
													<span style='font-size: 14px;'>🎥</span>
												{:else if item.contentType?.startsWith('audio/')}
													<span style='font-size: 14px;'>🎵</span>
												{:else}
													<span style='font-size: 14px;'>📄</span>
												{/if}
											</div>
											<span class='file-name'>{item.name}</span>
											<span class='file-size'>{Math.ceil(item.size / 1024)}KB</span>
										</div>
									{/each}
									{#if dirs.length === 0 && files.length === 0}
										<div class='column-empty'>Empty</div>
									{/if}
								{/if}
							</div>

							<!-- Resize handle -->
							{#if columnIndex < columnsData.length - 1 || selectedKeys.length > 0}
								<button
									type='button'
									class='resize-handle'
									aria-label={`列${columnIndex + 1}の幅を調整`}
									onmousedown={(e) => {
										e.preventDefault()
										const startX = e.clientX
										const startWidth = width

										const handleMouseMove = (event: MouseEvent) => {
											const diff = event.clientX - startX
											const newWidth = Math.max(200, Math.min(500, startWidth + diff))
											updateColumnWidth(columnIndex, newWidth)
										}

										const handleMouseUp = () => {
											document.removeEventListener('mousemove', handleMouseMove)
											document.removeEventListener('mouseup', handleMouseUp)
										}

										document.addEventListener('mousemove', handleMouseMove)
										document.addEventListener('mouseup', handleMouseUp)
									}}
									onkeydown={(event) => handleResizeHandleKeydown(event, columnIndex)}
								></button>
							{/if}
						</div>
					{/each}

					<!-- Preview Panel -->
					{#if selectedKeys.length > 0}
						{@const selectedFile = columnsData
							.flatMap((col) => col.objects?.objects ?? [])
							.find((obj) => selectedKeys.includes(obj.key))}
						{#if selectedFile}
							<div class='preview-panel'>
								<div class='preview-header'>PREVIEW</div>
								<div class='preview-content'>
									<div class='preview-icon'>
										{#if selectedFile.contentType?.startsWith('image/')}
											<span style='font-size: 64px;'>🌄</span>
										{:else if selectedFile.contentType === 'application/pdf'}
											<span style='font-size: 64px;'>📕</span>
										{:else if selectedFile.contentType === 'application/json'}
											<span style='font-size: 64px;'>📋</span>
										{:else if selectedFile.contentType?.startsWith('video/')}
											<span style='font-size: 64px;'>🎥</span>
										{:else if selectedFile.contentType?.startsWith('audio/')}
											<span style='font-size: 64px;'>🎵</span>
										{:else if selectedFile.contentType?.startsWith('text/')}
											<span style='font-size: 64px;'>📝</span>
										{:else}
											<span style='font-size: 64px;'>📄</span>
										{/if}
									</div>
									<h3 class='preview-name'>{selectedFile.name}</h3>
									<div class='preview-details'>
										<div class='detail-row'>
											<span class='detail-label'>Size</span>
											<span class='detail-value'>{Math.ceil(selectedFile.size / 1024)} KB</span>
										</div>
										<div class='detail-row'>
											<span class='detail-label'>Type</span>
											<span class='detail-value'>{selectedFile.contentType || 'Unknown'}</span>
										</div>
										<div class='detail-row'>
											<span class='detail-label'>Path</span>
											<span class='detail-value path'>{selectedFile.key}</span>
										</div>
									</div>
									<form method='post' action='?/download' use:enhance={downloadEnhance}>
										<input type='hidden' name='bucketId' value={selectedBucketId} />
										<input type='hidden' name='key' value={selectedFile.key} />
										<button class='download-btn' type='submit'>
											<svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
												<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10' />
											</svg>
											Download
										</button>
									</form>
								</div>
							</div>
						{/if}
					{/if}
				</div>
			{/if}

			{#if (selectedKeys.length > 0 || selectedDirectories.length > 0) && canDelete}
				<div class='floating-actions'>
					<form method='post' action='?/delete' use:enhance={deleteEnhance}>
						<input type='hidden' name='bucketId' value={selectedBucketId} />
						{#each selectedKeys as key}
							<input type='hidden' name='keys' value={key} />
						{/each}
						{#each selectedDirectories as dirKey}
							<input type='hidden' name='keys' value={dirKey} />
						{/each}
						<button class='btn-delete' type='submit'>
							<svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
								<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16' />
							</svg>
							削除 ({selectedKeys.length + selectedDirectories.length})
						</button>
					</form>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Detail Modal -->
{#if showDetailModal && detailItem}
	<div
		class='modal-overlay'
		role='button'
		tabindex='0'
		aria-label='詳細モーダルを閉じる'
		onclick={(event) => {
			if (event.target === event.currentTarget) {
				closeDetailModal()
			}
		}}
		onkeydown={(event) => {
			if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
				event.preventDefault()
				closeDetailModal()
			}
		}}
	>
		<div
			class='modal-content'
			role='dialog'
			aria-modal='true'
			aria-labelledby='storage-detail-title'
			tabindex='-1'
		>
			<div class='modal-header'>
				<h2 id='storage-detail-title'>Details</h2>
				<button class='modal-close' onclick={closeDetailModal} aria-label='閉じる'>
					<svg class='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
						<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M6 18L18 6M6 6l12 12' />
					</svg>
				</button>
			</div>
			<div class='modal-body'>
				<div class='detail-icon'>
					{#if detailItem.key?.endsWith('/')}
						<svg class='w-20 h-20' fill='currentColor' viewBox='0 0 20 20'>
							<path d='M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z' />
						</svg>
					{:else if 'contentType' in detailItem && detailItem.contentType?.startsWith('image/')}
						<span style='font-size: 80px;'>🌄</span>
					{:else if 'contentType' in detailItem && detailItem.contentType === 'application/pdf'}
						<span style='font-size: 80px;'>📕</span>
					{:else if 'contentType' in detailItem && detailItem.contentType === 'application/json'}
						<span style='font-size: 80px;'>📋</span>
					{:else if 'contentType' in detailItem && detailItem.contentType?.startsWith('video/')}
						<span style='font-size: 80px;'>🎥</span>
					{:else if 'contentType' in detailItem && detailItem.contentType?.startsWith('audio/')}
						<span style='font-size: 80px;'>🎵</span>
					{:else if 'contentType' in detailItem && detailItem.contentType?.startsWith('text/')}
						<span style='font-size: 80px;'>📝</span>
					{:else}
						<span style='font-size: 80px;'>📄</span>
					{/if}
				</div>
				<h3 class='detail-name'>{detailItem.name || detailItem.key}</h3>
				<div class='detail-info'>
					{#if 'size' in detailItem && detailItem.size !== undefined}
						<div class='info-item'>
							<span class='info-label'>Size</span>
							<span class='info-value'>{Math.ceil(detailItem.size / 1024)} KB</span>
						</div>
					{/if}
					{#if 'contentType' in detailItem && detailItem.contentType}
						<div class='info-item'>
							<span class='info-label'>Type</span>
							<span class='info-value'>{detailItem.contentType}</span>
						</div>
					{/if}
					<div class='info-item'>
						<span class='info-label'>Path</span>
						<span class='info-value mono'>{detailItem.key}</span>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
  /* Use DaisyUI Theme Colors */
  .storage-container {
    height: calc(100vh - 64px); /* Account for app header */
    display: flex;
    flex-direction: column;
    background: var(--b1, oklch(var(--b1)));
    color: var(--bc, oklch(var(--bc)));
    border: 1px solid oklch(var(--b3));
    border-radius: 12px;
    overflow: hidden;
    margin: 8px;
    box-shadow: 0 2px 8px oklch(0 0 0 / 0.1);
  }

  /* Toolbar */
  .toolbar {
    height: 48px;
    background: oklch(var(--b2));
    border-bottom: 1px solid oklch(var(--b3));
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .action-btn {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: oklch(var(--b3));
    border: 1px solid oklch(var(--b3));
    color: oklch(var(--bc));
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover:not(:disabled) {
    background: oklch(var(--p) / 0.2);
    border-color: oklch(var(--p));
    color: oklch(var(--p));
    transform: translateY(-1px);
  }

  .action-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .view-switcher {
    display: flex;
    background: oklch(var(--b3));
    border-radius: 8px;
    padding: 2px;
  }

  .view-btn {
    width: 32px;
    height: 32px;
    border: none;
    background: transparent;
    color: oklch(var(--bc) / 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.2s;
  }

  .view-btn.active {
    background: oklch(var(--p));
    color: oklch(var(--pc));
  }

  .view-btn:hover:not(.active) {
    background: oklch(var(--b3));
    color: oklch(var(--bc));
  }

  /* Main Layout */
  .main-container {
    flex: 1;
    display: flex;
    overflow: hidden;
    border-top: 1px solid oklch(var(--b3));
    position: relative;
  }

  /* Sidebar */
  .sidebar {
    width: 300px;
    background: oklch(var(--b2));
    border-right: 1px solid oklch(var(--b3));
    overflow-y: auto;
    position: relative;
  }

  .sidebar::after {
    content: '';
    position: absolute;
    right: -1px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: oklch(var(--b3) / 0.8);
    box-shadow: 1px 0 0 oklch(var(--b3) / 0.3);
  }

  .bucket-title {
    padding: 16px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: oklch(var(--bc) / 0.5);
  }

  .bucket-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    width: 100%;
    border: none;
    background: transparent;
    color: oklch(var(--bc) / 0.7);
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }

  .bucket-item:hover {
    background: oklch(var(--b3));
    color: oklch(var(--bc));
  }

  .bucket-item.active {
    background: oklch(var(--p) / 0.2);
    color: oklch(var(--p));
    font-weight: 600;
  }

  .bucket-item.active::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: oklch(var(--p));
  }

  .bucket-item.active .bucket-icon {
    color: oklch(var(--p));
  }

  .bucket-icon {
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bucket-label {
    flex: 1;
    text-align: left;
    font-size: 13px;
  }

  .bucket-capabilities {
    display: flex;
    gap: 4px;
  }

  .capability {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    background: oklch(var(--su) / 0.2);
    color: oklch(var(--su));
    font-size: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
  }

  /* Content Area */
  .content-area {
    flex: 1;
    background: oklch(var(--b1));
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
    min-width: 0; /* Allow flex item to shrink */
  }

  /* Column View */
  .column-view {
    display: flex;
    height: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    background: oklch(var(--b1));
    position: relative;
    flex: 1;
    min-width: 0; /* Critical for containing overflow */
  }

  .column {
    display: flex;
    flex-direction: column;
    border-right: 1px solid oklch(var(--b3));
    position: relative;
    flex-shrink: 0;
  }

  .column-header {
    padding: 12px 16px;
    background: oklch(var(--b2));
    border-bottom: 1px solid oklch(var(--b3));
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: oklch(var(--bc) / 0.6);
  }

  .column-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .column-item {
    padding: 8px 16px;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.15s;
    color: oklch(var(--bc));
    position: relative;
  }

  .column-item:hover {
    background: oklch(var(--b2));
    color: oklch(var(--bc));
  }

  .column-item.selected {
    background: oklch(var(--p) / 0.15);
    color: oklch(var(--p));
  }

  .column-item .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .column-item .file-size {
    font-size: 11px;
    color: oklch(var(--bc) / 0.5);
    margin-left: auto;
  }

  .column-empty {
    padding: 32px;
    text-align: center;
    color: oklch(var(--bc) / 0.5);
    font-size: 12px;
  }

  .column-loading {
    padding: 32px;
    text-align: center;
    color: oklch(var(--bc) / 0.5);
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid oklch(var(--b3));
    border-top-color: oklch(var(--p));
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    margin: 0 auto;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* Resize Handle */
  .resize-handle {
    position: absolute;
    right: -3px;
    top: 0;
    bottom: 0;
    width: 6px;
    cursor: col-resize;
    z-index: 10;
    background: transparent;
    transition: background 0.2s;
  }

  .resize-handle:hover {
    background: oklch(var(--p) / 0.3);
  }

  /* Preview Panel */
  .preview-panel {
    min-width: 320px;
    background: oklch(var(--b2));
    display: flex;
    flex-direction: column;
  }

  .preview-header {
    padding: 12px 16px;
    background: oklch(var(--b2));
    border-bottom: 1px solid oklch(var(--b3));
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: oklch(var(--bc) / 0.6);
  }

  .preview-content {
    flex: 1;
    padding: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  .preview-icon {
    color: oklch(var(--bc) / 0.5);
  }

  .preview-name {
    font-size: 18px;
    font-weight: 600;
    text-align: center;
    word-break: break-all;
  }

  .preview-details {
    width: 100%;
    max-width: 300px;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid oklch(var(--b3));
    font-size: 13px;
  }

  .detail-label {
    color: oklch(var(--bc) / 0.5);
    font-weight: 500;
  }

  .detail-value {
    color: oklch(var(--bc));
    text-align: right;
  }

  .detail-value.path {
    font-family: 'SF Mono', Consolas, monospace;
    font-size: 11px;
    word-break: break-all;
  }

  .download-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 24px;
    background: oklch(var(--p));
    color: oklch(var(--pc));
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .download-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px oklch(var(--p) / 0.3);
    opacity: 0.9;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: oklch(var(--b1) / 0.4);
    backdrop-filter: blur(12px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.2s;
  }

  .modal-content {
    background: oklch(var(--b1));
    border: 1px solid oklch(var(--b3));
    border-radius: 16px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 25px 50px -12px oklch(0 0 0 / 0.25);
    animation: slideUp 0.3s;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px;
    border-bottom: 1px solid oklch(var(--b3));
    background: oklch(var(--b2));
    border-radius: 16px 16px 0 0;
  }

  .modal-header h2 {
    font-size: 18px;
    font-weight: 600;
  }

  .modal-close {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: transparent;
    border: none;
    color: oklch(var(--bc) / 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: oklch(var(--er) / 0.1);
    color: oklch(var(--er));
  }

  .modal-body {
    padding: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  }

  .detail-icon {
    color: oklch(var(--p));
    display: flex;
    justify-content: center;
  }

  .detail-name {
    font-size: 20px;
    font-weight: 600;
    text-align: center;
    word-break: break-all;
  }

  .detail-info {
    width: 100%;
  }

  .info-item {
    display: flex;
    justify-content: space-between;
    padding: 16px 0;
    border-bottom: 1px solid oklch(var(--b3));
  }

  .info-item:last-child {
    border-bottom: none;
  }

  .info-label {
    color: oklch(var(--bc) / 0.5);
    font-size: 14px;
  }

  .info-value {
    color: oklch(var(--bc));
    font-size: 14px;
    text-align: right;
  }

  .info-value.mono {
    font-family: 'SF Mono', Consolas, monospace;
    font-size: 12px;
  }

  /* Other view modes styles */
  .list-view {
    padding: 24px;
    overflow: auto;
    height: 100%;
  }

  .floating-actions {
    position: fixed;
    bottom: 24px;
    right: 24px;
    animation: slideUp 0.3s;
  }

  .btn-delete {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: oklch(var(--er));
    color: oklch(var(--erc));
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 4px 16px oklch(var(--er) / 0.3);
    transition: all 0.2s;
  }

  .btn-delete:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px oklch(var(--er) / 0.4);
    opacity: 0.9;
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateX(-10px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @keyframes scaleIn {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .list-view {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .list-header {
    display: flex;
    background: #f6f6f6;
    border-bottom: 1px solid #e0e0e0;
    font-size: 12px;
    font-weight: 500;
    color: #666;
  }

  .list-body {
    flex: 1;
    overflow-y: auto;
  }

  .list-item {
    display: flex;
    border-bottom: 1px solid #f0f0f0;
    cursor: pointer;
    font-size: 13px;
  }

  .list-item:hover {
    background: #f8f8f8;
  }

  .list-item.selected {
    background: #007aff20;
  }

  .list-col {
    padding: 8px 12px;
    display: flex;
    align-items: center;
  }

  .col-name {
    flex: 1;
    gap: 8px;
  }

  .col-size {
    width: 100px;
  }

  .col-type {
    width: 150px;
  }

  .col-actions {
    width: 60px;
  }

  .file-icon {
    font-size: 16px;
  }

  .btn-list-action {
    padding: 2px 4px;
    background: transparent;
    border: 1px solid #c0c0c0;
    border-radius: 2px;
    cursor: pointer;
  }

  .btn-list-action:hover {
    background: #f0f0f0;
  }

  .column-view {
    display: flex;
    height: 100%;
    overflow-x: auto;
  }

  .column {
    display: flex;
    flex-direction: column;
    border-right: 1px solid #e0e0e0;
    min-width: 280px;
    flex-shrink: 0;
  }

  .column-header {
    padding: 8px 12px;
    background: linear-gradient(to bottom, #f6f6f6, #eeeeee);
    border-bottom: 1px solid #e0e0e0;
    font-size: 12px;
    font-weight: 600;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .column-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  .column-item {
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.1s;
    position: relative;
  }

  .column-item:hover {
    background: #f0f0f0;
  }

  .column-item.selected {
    background: linear-gradient(to bottom, #007aff, #0051d5);
    color: white;
  }

  .column-item .file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .column-empty {
    padding: 20px;
    text-align: center;
    color: #999;
    font-size: 12px;
    font-style: italic;
  }

  .info-label {
    color: #666;
    font-weight: 500;
  }

  .column-loading {
    padding: 20px;
    text-align: center;
    color: #666;
    font-size: 13px;
  }

  .floating-actions {
    position: fixed;
    bottom: 40px;
    right: 20px;
  }

  .btn-delete {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    background: #ff3b30;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .btn-delete:hover {
    background: #d70015;
  }

  .error-message {
    padding: 12px;
    margin: 12px;
    background: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c00;
    font-size: 13px;
  }
</style>
