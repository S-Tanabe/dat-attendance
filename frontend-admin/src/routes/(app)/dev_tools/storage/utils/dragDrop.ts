export interface DragDropCallbacks {
	onDragEnter?: (e: DragEvent) => void
	onDragLeave?: (e: DragEvent) => void
	onDragOver?: (e: DragEvent) => void
	onDrop?: (e: DragEvent, files: File[]) => void
}

export class DragDropManager {
	private element: HTMLElement
	private callbacks: DragDropCallbacks
	private dragCounter = 0
	private isDragging = false

	constructor(element: HTMLElement, callbacks: DragDropCallbacks) {
		this.element = element
		this.callbacks = callbacks
		this.setupEventListeners()
	}

	private setupEventListeners() {
		this.element.addEventListener('dragenter', this.handleDragEnter.bind(this))
		this.element.addEventListener('dragleave', this.handleDragLeave.bind(this))
		this.element.addEventListener('dragover', this.handleDragOver.bind(this))
		this.element.addEventListener('drop', this.handleDrop.bind(this))
	}

	private handleDragEnter(e: DragEvent) {
		e.preventDefault()
		e.stopPropagation()

		this.dragCounter++
		if (this.dragCounter === 1) {
			this.isDragging = true
			this.callbacks.onDragEnter?.(e)
			this.element.classList.add('drag-over')
		}
	}

	private handleDragLeave(e: DragEvent) {
		e.preventDefault()
		e.stopPropagation()

		this.dragCounter--
		if (this.dragCounter === 0) {
			this.isDragging = false
			this.callbacks.onDragLeave?.(e)
			this.element.classList.remove('drag-over')
		}
	}

	private handleDragOver(e: DragEvent) {
		e.preventDefault()
		e.stopPropagation()

		if (e.dataTransfer) {
			e.dataTransfer.dropEffect = 'copy'
		}

		this.callbacks.onDragOver?.(e)
	}

	private handleDrop(e: DragEvent) {
		e.preventDefault()
		e.stopPropagation()

		this.dragCounter = 0
		this.isDragging = false
		this.element.classList.remove('drag-over')

		const files = this.getFilesFromEvent(e)
		if (files.length > 0) {
			this.callbacks.onDrop?.(e, files)
		}
	}

	private getFilesFromEvent(e: DragEvent): File[] {
		const files: File[] = []

		if (e.dataTransfer?.items) {
			// Use DataTransferItemList interface
			for (let i = 0; i < e.dataTransfer.items.length; i++) {
				const item = e.dataTransfer.items[i]
				if (item.kind === 'file') {
					const file = item.getAsFile()
					if (file) {
						files.push(file)
					}
				}
			}
		} else if (e.dataTransfer?.files) {
			// Use DataTransfer files interface
			for (let i = 0; i < e.dataTransfer.files.length; i++) {
				files.push(e.dataTransfer.files[i])
			}
		}

		return files
	}

	public destroy() {
		this.element.removeEventListener('dragenter', this.handleDragEnter.bind(this))
		this.element.removeEventListener('dragleave', this.handleDragLeave.bind(this))
		this.element.removeEventListener('dragover', this.handleDragOver.bind(this))
		this.element.removeEventListener('drop', this.handleDrop.bind(this))
	}
}

export function initializeDragDrop(
	element: HTMLElement,
	onFilesDropped: (files: File[]) => void,
): DragDropManager {
	return new DragDropManager(element, {
		onDragEnter: () => {
			element.classList.add('drag-active')
		},
		onDragLeave: () => {
			element.classList.remove('drag-active')
		},
		onDrop: (_, files) => {
			element.classList.remove('drag-active')
			onFilesDropped(files)
		},
	})
}

export function formatFileList(files: File[]): string {
	if (files.length === 0)
		return 'ファイルなし'
	if (files.length === 1)
		return files[0].name
	return `${files.length}個のファイル`
}

export function validateFiles(
	files: File[],
	options: {
		maxSize?: number
		allowedTypes?: string[]
		maxFiles?: number
	} = {},
): { valid: File[], errors: string[] } {
	const valid: File[] = []
	const errors: string[] = []

	if (options.maxFiles && files.length > options.maxFiles) {
		errors.push(`最大${options.maxFiles}個のファイルまでアップロード可能です`)
		return { valid, errors }
	}

	for (const file of files) {
		let isValid = true

		if (options.maxSize && file.size > options.maxSize) {
			errors.push(`${file.name}: ファイルサイズが大きすぎます（最大${formatBytes(options.maxSize)}）`)
			isValid = false
		}

		if (options.allowedTypes && options.allowedTypes.length > 0) {
			const ext = file.name.split('.').pop()?.toLowerCase()
			if (!ext || !options.allowedTypes.includes(ext)) {
				errors.push(`${file.name}: 許可されていないファイルタイプです`)
				isValid = false
			}
		}

		if (isValid) {
			valid.push(file)
		}
	}

	return { valid, errors }
}

function formatBytes(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB']
	let i = 0
	let value = bytes

	while (value >= 1024 && i < units.length - 1) {
		value /= 1024
		i++
	}

	return `${value.toFixed(2)} ${units[i]}`
}
