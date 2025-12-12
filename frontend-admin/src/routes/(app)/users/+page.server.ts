import type { Actions, PageServerLoad } from './$types'
import { getTokensFromCookies, serverClient, setTokensToCookies, withAutoRefresh } from '$lib/api/client'
import { fail, redirect } from '@sveltejs/kit'
import { z } from 'zod'

const CreateUserSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
	displayName: z.string().min(1),
	firstName: z.string().optional().default(''),
	lastName: z.string().optional().default(''),
	firstNameRomaji: z.string().optional().default(''),
	lastNameRomaji: z.string().optional().default(''),
	timezone: z.string().optional().default(''),
	language: z.string().optional().default(''),
	roleName: z.string().optional(),
})

const UpdateUserSchema = z.object({
	userId: z.string().min(1),
	email: z.string().email().optional(),
	displayName: z.string().min(1).optional(),
	firstName: z.string().optional(),
	lastName: z.string().optional(),
	firstNameRomaji: z.string().optional(),
	lastNameRomaji: z.string().optional(),
	timezone: z.string().optional(),
	language: z.string().optional(),
	roleName: z.string().optional(),
})

const ChangeStatusSchema = z.object({ userId: z.string().min(1), isActive: z.coerce.boolean() })
const ResetPasswordSchema = z.object({ userId: z.string().min(1), newPassword: z.string().min(8) })
const TargetUserSchema = z.object({ userId: z.string().min(1) })

export const load: PageServerLoad = async (event) => {
	const parent = await event.parent()
	const user = parent.user
	if (!user?.role?.name || (user.role.name !== 'admin' && user.role.name !== 'super_admin')) {
		throw redirect(302, '/dashboard')
	}

	const url = event.url
	const page = Number(url.searchParams.get('page') ?? '1')
	const limit = Number(url.searchParams.get('limit') ?? '20')
	event.depends('app:users')

	const client = serverClient(event)
	const { refresh_token } = getTokensFromCookies(event.cookies)

	async function fetchList() {
		const list = await client.app.list_users({ page, limit })
		const roles = await client.app.list_roles()
		return { list, roles }
	}

	try {
		const data = await withAutoRefresh({
			exec: fetchList,
			refresh: async () => {
				if (!refresh_token)
					throw new Error('no-refresh-token')
				return client.auth.refresh({ refresh_token })
			},
			onRefreshed: (t) => setTokensToCookies(event.cookies, t),
		})
		// super_admin はUIから選べないように除外
		const filteredRoles = data.roles.roles.filter((r) => r.name !== 'super_admin')
		// super_admin を一覧から隠す
		const users = data.list.users.filter((u) => u.role !== 'super_admin')
		return {
			page,
			limit,
			users,
			total: data.list.total,
			roles: filteredRoles,
		}
	} catch (e: unknown) {
		return { users: [], total: 0, roles: [], error: e instanceof Error ? e.message : 'ユーザー一覧の取得に失敗しました' }
	}
}

function formDataToObject(fd: FormData): Record<string, unknown> {
	const obj: Record<string, unknown> = {}
	for (const [k, v] of fd.entries()) obj[k] = typeof v === 'string' ? v : v.name
	return obj
}

export const actions: Actions = {
	create: async (event) => {
		const body = formDataToObject(await event.request.formData())
		const parsed = CreateUserSchema.safeParse(body)
		if (!parsed.success)
			return fail(400, { error: parsed.error.issues[0]?.message ?? '入力が不正です' })
		// super_adminは作成禁止
		if (parsed.data.roleName === 'super_admin') {
			return fail(403, { error: 'super_admin は作成できません' })
		}
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		try {
			await withAutoRefresh({
				exec: async () => client.app.create_user(parsed.data),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (t) => setTokensToCookies(event.cookies, t),
			})
			return { ok: true }
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'ユーザー作成に失敗しました' })
		}
	},

	update: async (event) => {
		const body = formDataToObject(await event.request.formData())
		const parsed = UpdateUserSchema.safeParse(body)
		if (!parsed.success)
			return fail(400, { error: parsed.error.issues[0]?.message ?? '入力が不正です' })

		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		try {
			const { userId, roleName, ...rest } = parsed.data
			// 更新
			if (Object.keys(rest).length > 0) {
				await withAutoRefresh({
					exec: async () => client.app.update_user(userId, rest),
					refresh: async () => {
						if (!refresh_token)
							throw new Error('no-refresh-token')
						return client.auth.refresh({ refresh_token })
					},
					onRefreshed: (t) => setTokensToCookies(event.cookies, t),
				})
			}
			// ロール変更
			if (roleName) {
				if (roleName === 'super_admin') {
					return fail(403, { error: 'super_admin への昇格は許可されていません' })
				}
				await withAutoRefresh({
					exec: async () => client.app.update_user_role(parsed.data.userId, { roleName }),
					refresh: async () => {
						if (!refresh_token)
							throw new Error('no-refresh-token')
						return client.auth.refresh({ refresh_token })
					},
					onRefreshed: (t) => setTokensToCookies(event.cookies, t),
				})
			}
			return { ok: true }
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'ユーザー更新に失敗しました' })
		}
	},

	change_status: async (event) => {
		const body = formDataToObject(await event.request.formData())
		const parsed = ChangeStatusSchema.safeParse(body)
		if (!parsed.success)
			return fail(400, { error: parsed.error.issues[0]?.message ?? '入力が不正です' })
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		try {
			await withAutoRefresh({
				exec: async () => client.app.change_user_status(parsed.data.userId, { isActive: parsed.data.isActive }),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (t) => setTokensToCookies(event.cookies, t),
			})
			return { ok: true }
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'ステータス変更に失敗しました' })
		}
	},

	reset_password: async (event) => {
		const body = formDataToObject(await event.request.formData())
		const parsed = ResetPasswordSchema.safeParse(body)
		if (!parsed.success)
			return fail(400, { error: parsed.error.issues[0]?.message ?? '入力が不正です' })
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		try {
			await withAutoRefresh({
				exec: async () => client.app.reset_password(parsed.data.userId, { newPassword: parsed.data.newPassword }),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (t) => setTokensToCookies(event.cookies, t),
			})
			return { ok: true }
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'パスワードリセットに失敗しました' })
		}
	},

	force_logout: async (event) => {
		const body = formDataToObject(await event.request.formData())
		const parsed = TargetUserSchema.safeParse(body)
		if (!parsed.success)
			return fail(400, { error: parsed.error.issues[0]?.message ?? '入力が不正です' })
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		try {
			await withAutoRefresh({
				exec: async () => client.app.force_logout(parsed.data.userId),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (t) => setTokensToCookies(event.cookies, t),
			})
			return { ok: true }
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : '強制ログアウトに失敗しました' })
		}
	},

	delete: async (event) => {
		const body = formDataToObject(await event.request.formData())
		const parsed = TargetUserSchema.safeParse(body)
		if (!parsed.success)
			return fail(400, { error: parsed.error.issues[0]?.message ?? '入力が不正です' })
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		try {
			await withAutoRefresh({
				exec: async () => client.app.delete_user(parsed.data.userId),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (t) => setTokensToCookies(event.cookies, t),
			})
			return { ok: true }
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'ユーザー削除に失敗しました' })
		}
	},

	restore: async (event) => {
		const body = formDataToObject(await event.request.formData())
		const parsed = TargetUserSchema.safeParse(body)
		if (!parsed.success)
			return fail(400, { error: parsed.error.issues[0]?.message ?? '入力が不正です' })
		const client = serverClient(event)
		const { refresh_token } = getTokensFromCookies(event.cookies)
		try {
			await withAutoRefresh({
				exec: async () => client.app.restore_user(parsed.data.userId),
				refresh: async () => {
					if (!refresh_token)
						throw new Error('no-refresh-token')
					return client.auth.refresh({ refresh_token })
				},
				onRefreshed: (t) => setTokensToCookies(event.cookies, t),
			})
			return { ok: true }
		} catch (e: unknown) {
			return fail(400, { error: e instanceof Error ? e.message : 'ユーザー復活に失敗しました' })
		}
	},
}
