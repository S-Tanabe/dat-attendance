import { expect, test } from '@playwright/test'

test.describe('Admin Authentication', () => {
	test('should redirect to login when not authenticated', async ({ page }) => {
		await page.goto('/dashboard')
		await expect(page).toHaveURL(/.*login/)
	})

	test('should show login page', async ({ page }) => {
		await page.goto('/login')
		await expect(page.getByRole('heading', { name: /ログイン/ })).toBeVisible()
		await expect(page.getByLabel(/メールアドレス/)).toBeVisible()
		await expect(page.getByLabel(/パスワード/)).toBeVisible()
	})

	test('should show error for invalid credentials', async ({ page }) => {
		await page.goto('/login')
		await page.getByLabel(/メールアドレス/).fill('invalid@example.com')
		await page.getByLabel(/パスワード/).fill('wrongpassword')
		await page.getByRole('button', { name: /ログイン/ }).click()

		await expect(page.getByText(/メールアドレスまたはパスワードが正しくありません|認証に失敗/)).toBeVisible({ timeout: 10000 })
	})

	test('should login successfully with admin credentials', async ({ page }) => {
		await page.goto('/login')
		await page.getByLabel(/メールアドレス/).fill('admin@fox-hound.jp')
		await page.getByLabel(/パスワード/).fill('Archimedes212')
		await page.getByRole('button', { name: /ログイン/ }).click()

		await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })
	})
})
