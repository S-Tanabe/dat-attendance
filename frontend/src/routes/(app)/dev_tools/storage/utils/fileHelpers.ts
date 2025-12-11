export function formatBytes(bytes: number, decimals = 2): string {
	if (bytes === 0)
		return '0 Bytes'

	const k = 1024
	const dm = decimals < 0 ? 0 : decimals
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

	const i = Math.floor(Math.log(bytes) / Math.log(k))

	return `${Number.parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`
}

export function getFileIcon(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase()

	const iconMap: Record<string, string> = {
		// Images
		'jpg': '🖼️',
		'jpeg': '🖼️',
		'png': '🖼️',
		'gif': '🖼️',
		'svg': '🖼️',
		'webp': '🖼️',
		'ico': '🖼️',
		'bmp': '🖼️',

		// Videos
		'mp4': '🎬',
		'avi': '🎬',
		'mov': '🎬',
		'wmv': '🎬',
		'flv': '🎬',
		'mkv': '🎬',
		'webm': '🎬',

		// Audio
		'mp3': '🎵',
		'wav': '🎵',
		'flac': '🎵',
		'aac': '🎵',
		'ogg': '🎵',
		'wma': '🎵',

		// Documents
		'pdf': '📄',
		'doc': '📝',
		'docx': '📝',
		'xls': '📊',
		'xlsx': '📊',
		'ppt': '📊',
		'pptx': '📊',
		'txt': '📃',
		'rtf': '📝',
		'odt': '📝',

		// Code
		'js': '📜',
		'ts': '📜',
		'jsx': '⚛️',
		'tsx': '⚛️',
		'json': '📋',
		'html': '🌐',
		'css': '🎨',
		'scss': '🎨',
		'sass': '🎨',
		'py': '🐍',
		'java': '☕',
		'cpp': '📘',
		'c': '📘',
		'go': '🐹',
		'rs': '🦀',
		'php': '🐘',
		'rb': '💎',
		'swift': '🦉',
		'kt': '🎯',
		'sql': '🗃️',
		'yaml': '📋',
		'yml': '📋',
		'xml': '📋',
		'md': '📝',

		// Archives
		'zip': '📦',
		'rar': '📦',
		'tar': '📦',
		'gz': '📦',
		'7z': '📦',
		'bz2': '📦',

		// Executables
		'exe': '⚙️',
		'msi': '⚙️',
		'app': '⚙️',
		'deb': '⚙️',
		'rpm': '⚙️',

		// Data
		'csv': '📊',
		'db': '🗃️',
		'sqlite': '🗃️',
	}

	return iconMap[ext || ''] || '📄'
}

export function getMimeType(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase()

	const mimeMap: Record<string, string> = {
		// Images
		'jpg': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'png': 'image/png',
		'gif': 'image/gif',
		'svg': 'image/svg+xml',
		'webp': 'image/webp',
		'ico': 'image/x-icon',
		'bmp': 'image/bmp',

		// Videos
		'mp4': 'video/mp4',
		'avi': 'video/x-msvideo',
		'mov': 'video/quicktime',
		'wmv': 'video/x-ms-wmv',
		'flv': 'video/x-flv',
		'mkv': 'video/x-matroska',
		'webm': 'video/webm',

		// Audio
		'mp3': 'audio/mpeg',
		'wav': 'audio/wav',
		'flac': 'audio/flac',
		'aac': 'audio/aac',
		'ogg': 'audio/ogg',
		'wma': 'audio/x-ms-wma',

		// Documents
		'pdf': 'application/pdf',
		'doc': 'application/msword',
		'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'xls': 'application/vnd.ms-excel',
		'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'ppt': 'application/vnd.ms-powerpoint',
		'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'txt': 'text/plain',
		'rtf': 'application/rtf',

		// Code
		'js': 'text/javascript',
		'ts': 'text/typescript',
		'jsx': 'text/jsx',
		'tsx': 'text/tsx',
		'json': 'application/json',
		'html': 'text/html',
		'css': 'text/css',
		'scss': 'text/scss',
		'sass': 'text/sass',
		'py': 'text/x-python',
		'java': 'text/x-java',
		'cpp': 'text/x-c++',
		'c': 'text/x-c',
		'go': 'text/x-go',
		'rs': 'text/x-rust',
		'php': 'text/x-php',
		'rb': 'text/x-ruby',
		'swift': 'text/x-swift',
		'kt': 'text/x-kotlin',
		'sql': 'text/x-sql',
		'yaml': 'text/yaml',
		'yml': 'text/yaml',
		'xml': 'text/xml',
		'md': 'text/markdown',

		// Archives
		'zip': 'application/zip',
		'rar': 'application/x-rar-compressed',
		'tar': 'application/x-tar',
		'gz': 'application/gzip',
		'7z': 'application/x-7z-compressed',
		'bz2': 'application/x-bzip2',

		// Data
		'csv': 'text/csv',
	}

	return mimeMap[ext || ''] || 'application/octet-stream'
}

export function canPreview(filename: string): boolean {
	const ext = filename.split('.').pop()?.toLowerCase()
	const previewableExtensions = [
		'jpg',
		'jpeg',
		'png',
		'gif',
		'svg',
		'webp',
		'bmp',
		'pdf',
		'txt',
		'md',
		'json',
		'xml',
		'yaml',
		'yml',
		'js',
		'ts',
		'jsx',
		'tsx',
		'html',
		'css',
		'scss',
		'sass',
		'py',
		'java',
		'cpp',
		'c',
		'go',
		'rs',
		'php',
		'rb',
		'swift',
		'kt',
		'sql',
	]
	return previewableExtensions.includes(ext || '')
}

export function formatDate(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date
	return new Intl.DateTimeFormat('ja-JP', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
	}).format(d)
}

export function sortFiles<T extends { name: string, size?: number, lastModified?: string }>(
	files: T[],
	sortBy: 'name' | 'size' | 'date',
	ascending = true,
): T[] {
	const sorted = [...files].sort((a, b) => {
		let comparison = 0

		switch (sortBy) {
			case 'name':
				comparison = a.name.localeCompare(b.name)
				break
			case 'size':
				comparison = (a.size || 0) - (b.size || 0)
				break
			case 'date':
				const dateA = a.lastModified ? new Date(a.lastModified).getTime() : 0
				const dateB = b.lastModified ? new Date(b.lastModified).getTime() : 0
				comparison = dateA - dateB
				break
		}

		return ascending ? comparison : -comparison
	})

	return sorted
}

export function filterFiles<T extends { name: string }>(
	files: T[],
	query: string,
): T[] {
	if (!query)
		return files

	const lowerQuery = query.toLowerCase()
	return files.filter((file) =>
		file.name.toLowerCase().includes(lowerQuery),
	)
}

export function getFileExtension(filename: string): string {
	const parts = filename.split('.')
	return parts.length > 1 ? parts.pop()! : ''
}
