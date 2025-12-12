// アバター関連のユーティリティ

/**
 * 名前からイニシャルを生成
 */
export function getInitials(firstName?: string, lastName?: string, displayName?: string, email?: string): string {
	if (firstName && lastName) {
		return `${firstName[0]}${lastName[0]}`.toUpperCase()
	}

	if (displayName) {
		const parts = displayName.trim().split(/\s+/)
		if (parts.length >= 2) {
			return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
		}
		return displayName.slice(0, 2).toUpperCase()
	}

	if (email) {
		return email.slice(0, 2).toUpperCase()
	}

	return 'U'
}

/**
 * イニシャルから背景色を生成（一貫性のある色を生成）
 */
export function getAvatarColor(initials: string): string {
	const colors = [
		'bg-red-500',
		'bg-blue-500',
		'bg-green-500',
		'bg-yellow-500',
		'bg-purple-500',
		'bg-pink-500',
		'bg-indigo-500',
		'bg-teal-500',
	]

	// イニシャルから数値を生成して色を選択
	let hash = 0
	for (let i = 0; i < initials.length; i++) {
		hash = initials.charCodeAt(i) + ((hash << 5) - hash)
	}

	return colors[Math.abs(hash) % colors.length]
}

/**
 * ファイルサイズの検証
 */
export function validateFileSize(file: File, maxSize: number): boolean {
	return file.size <= maxSize
}

/**
 * ファイルタイプの検証
 */
export function validateFileType(file: File): boolean {
	const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
	return allowedTypes.includes(file.type)
}

/**
 * Base64エンコード
 */
export async function fileToBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.readAsDataURL(file)
		reader.onload = () => {
			const result = reader.result as string
			// data:image/jpeg;base64, の部分を削除してBase64部分のみ返す
			const base64 = result.split(',')[1]
			resolve(base64)
		}
		reader.onerror = (error) => reject(error)
	})
}
