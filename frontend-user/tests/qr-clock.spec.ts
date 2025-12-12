import { expect, test } from '@playwright/test'

test.describe('QR Code Clock', () => {
	test.beforeEach(async ({ page }) => {
		// ログイン
		await page.goto('/login')
		await page.getByLabel(/メールアドレス/).fill('admin@fox-hound.jp')
		await page.getByLabel(/パスワード/).fill('Archimedes212')
		await page.getByRole('button', { name: /ログイン/ }).click()
		await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })
	})

	test('should display QR code page', async ({ page }) => {
		await page.goto('/dashboard/qr')
		// QRコードページが表示されることを確認
		await expect(page.getByText(/QR/i)).toBeVisible({ timeout: 5000 })
	})

	test('should show clock type selection', async ({ page }) => {
		await page.goto('/dashboard/qr')
		// 出勤/退勤の選択が表示されることを確認
		await expect(page.getByRole('button', { name: /出勤/ })).toBeVisible({ timeout: 5000 })
		await expect(page.getByRole('button', { name: /退勤/ })).toBeVisible({ timeout: 5000 })
	})

	test('should generate QR code for clock in', async ({ page }) => {
		await page.goto('/dashboard/qr')
		// 出勤ボタンをクリック
		await page.getByRole('button', { name: /出勤/ }).click()

		// QRコードが生成されることを確認（canvas または img 要素）
		const qrElement = page.locator('canvas, img[alt*="QR"], .qr-code, [data-testid="qr-code"]')
		await expect(qrElement.first()).toBeVisible({ timeout: 10000 })
	})

	test('should show expiration timer', async ({ page }) => {
		await page.goto('/dashboard/qr')
		await page.getByRole('button', { name: /出勤/ }).click()

		// 有効期限タイマーが表示されることを確認
		await expect(page.getByText(/有効期限|残り|秒/)).toBeVisible({ timeout: 10000 })
	})
})
