import type { notification, users } from '$lib/generated/client'
import type { RequestEvent } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import {
	getTokensFromCookies,
	serverClient,
	setTokensToCookies,
	withAutoRefresh,
} from '$lib/api/client'
import { fail, redirect } from '@sveltejs/kit'
import { z } from 'zod'

const CATEGORY_OPTIONS = ['system', 'user_action', 'schedule', 'realtime'] as const
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'] as const
const DEFAULT_SOURCE = 'dev-tools'

const CreateNotificationSchema = z.object({
	userIds: z
		.array(z.string().min(1, 'ユーザーIDが不正です'))
		.min(1, '通知対象ユーザーを選択してください'),
	message: z.string().refine((value) => value.trim().length > 0, {
		message: 'メッセージ本文を入力してください',
	}),
	subject: z.string().max(256, '件名は256文字以内で入力してください').optional(),
	category: z.enum(CATEGORY_OPTIONS).optional(),
	priority: z.enum(PRIORITY_OPTIONS).optional(),
	source: z.string().max(120, 'ソースは120文字以内で入力してください').optional(),
	templateId: z.string().max(120, 'テンプレートIDは120文字以内で入力してください').optional(),
	variablesJson: z.string().optional(),
	metadataJson: z.string().optional(),
	scheduledAt: z.string().optional(),
	expiresAt: z.string().optional(),
	channelInput: z.string().optional(),
})

type CreateNotificationInput = z.infer<typeof CreateNotificationSchema>

interface NotificationPageData {
	users: users.UserInfo[]
	total: number
	stats: { active: number, inactive: number }
	error?: string
	categoryOptions: typeof CATEGORY_OPTIONS
	priorityOptions: typeof PRIORITY_OPTIONS
	defaultSource: string
}

async function callWithRefresh<T>(
	event: RequestEvent,
	exec: (client: ReturnType<typeof serverClient>) => Promise<T>,
): Promise<T> {
	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)
	return withAutoRefresh({
		exec: async () => exec(client),
		refresh: async () => {
			if (!refresh_token) {
				throw new Error('no-refresh-token')
			}
			return client.auth.refresh({ refresh_token })
		},
		onRefreshed: (tokens) => setTokensToCookies(event.cookies, tokens),
	})
}

function optionalString(value: FormDataEntryValue | null): string | undefined {
	if (typeof value !== 'string')
		return undefined
	const trimmed = value.trim()
	return trimmed.length === 0 ? undefined : trimmed
}

function parseJsonField(value: string | undefined, fieldName: string) {
	if (!value)
		return undefined
	try {
		const parsed: unknown = JSON.parse(value)
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new Error(`${fieldName} はオブジェクト形式のJSONを指定してください`)
		}
		return parsed as Record<string, unknown>
	} catch (error: unknown) {
		const reason = error instanceof Error ? error.message : `${fieldName} のJSONパースに失敗しました`
		throw new Error(reason)
	}
}

function toIsoString(value: string | undefined) {
	if (!value)
		return undefined
	const trimmed = value.trim()
	if (!trimmed)
		return undefined
	const date = new Date(trimmed)
	if (Number.isNaN(date.getTime())) {
		throw new TypeError('日付の形式が不正です')
	}
	return date.toISOString()
}

function parseChannelInput(value: string | undefined): string[] | undefined {
	if (!value)
		return undefined
	const entries = value
		.split(/[\n,]/)
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0)
	return entries.length > 0 ? entries : undefined
}

export const load: PageServerLoad = async (event) => {
	const parent = await event.parent()
	const user = parent.user
	if (!user?.role?.name || user.role.name !== 'super_admin') {
		throw redirect(302, '/dashboard')
	}

	event.depends('app:dev_tools:notifications')
	const requestEvent = event as unknown as RequestEvent

	try {
		const response = await callWithRefresh(requestEvent, async (client) => client.app.list_users({ page: 1, limit: 100 }))
		const active = response.users.filter((u) => u.is_active).length
		const inactive = response.users.length - active
		const data: NotificationPageData = {
			users: response.users,
			total: response.total,
			stats: { active, inactive },
			categoryOptions: CATEGORY_OPTIONS,
			priorityOptions: PRIORITY_OPTIONS,
			defaultSource: DEFAULT_SOURCE,
		}
		return data
	} catch (error: unknown) {
		const data: NotificationPageData = {
			users: [],
			total: 0,
			stats: { active: 0, inactive: 0 },
			error: error instanceof Error ? error.message : 'ユーザー一覧の取得に失敗しました',
			categoryOptions: CATEGORY_OPTIONS,
			priorityOptions: PRIORITY_OPTIONS,
			defaultSource: DEFAULT_SOURCE,
		}
		return data
	}
}

export const actions: Actions = {
	send: async (event) => {
		const formData = await event.request.formData()
		const rawUserIds = formData
			.getAll('userIds')
			.map((value) => (typeof value === 'string' ? value.trim() : String(value)))
			.filter((value) => value.length > 0)

		const messageValue = formData.get('message')

		const input: CreateNotificationInput = {
			userIds: rawUserIds,
			message: typeof messageValue === 'string' ? messageValue : '',
			subject: optionalString(formData.get('subject')),
			category: optionalString(formData.get('category')) as CreateNotificationInput['category'],
			priority: optionalString(formData.get('priority')) as CreateNotificationInput['priority'],
			source: optionalString(formData.get('source')),
			templateId: optionalString(formData.get('templateId')),
			variablesJson: optionalString(formData.get('variablesJson')),
			metadataJson: optionalString(formData.get('metadataJson')),
			scheduledAt: optionalString(formData.get('scheduledAt')),
			expiresAt: optionalString(formData.get('expiresAt')),
			channelInput: optionalString(formData.get('channelInput')),
		}

		const parsed = CreateNotificationSchema.safeParse(input)
		if (!parsed.success) {
			const issue = parsed.error.issues[0]
			return fail(400, { error: issue?.message ?? '入力値が不正です' })
		}

		let variables: Record<string, unknown> | undefined
		let metadata: Record<string, unknown> | undefined
		let scheduledAt: string | undefined
		let expiresAt: string | undefined
		let channelIds: string[] | undefined

		try {
			variables = parseJsonField(parsed.data.variablesJson, 'リッチ変数')
			metadata = parseJsonField(parsed.data.metadataJson, 'メタデータ')
			scheduledAt = toIsoString(parsed.data.scheduledAt)
			expiresAt = toIsoString(parsed.data.expiresAt)
			channelIds = parseChannelInput(parsed.data.channelInput)
		} catch (error: unknown) {
			return fail(400, { error: error instanceof Error ? error.message : '入力値の変換に失敗しました' })
		}

		const payload: notification.CreateNotificationRequest = {
			userId: parsed.data.userIds[0],
			targetUserIds: parsed.data.userIds,
			message: parsed.data.message,
			subject: parsed.data.subject,
			category: parsed.data.category ?? CATEGORY_OPTIONS[0],
			priority: parsed.data.priority ?? 'normal',
			source: parsed.data.source ?? DEFAULT_SOURCE,
			templateId: parsed.data.templateId,
			variables,
			metadata: {
				...(metadata ?? {}),
				devTool: 'dev_tools.notifications',
			},
			scheduledAt,
			expiresAt,
			channelIds: channelIds ?? undefined,
		}

		try {
			const result = await callWithRefresh(event, async (client) => client.notification.createNotification(payload))
			return {
				success: true,
				result,
				selectionCount: parsed.data.userIds.length,
				primaryUserId: parsed.data.userIds[0],
			}
		} catch (error: unknown) {
			return fail(500, { error: error instanceof Error ? error.message : '通知の送信に失敗しました' })
		}
	},
}
