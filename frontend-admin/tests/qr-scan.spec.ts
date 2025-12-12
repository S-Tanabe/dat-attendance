import { expect, test } from '@playwright/test'

test.describe('Admin QR Code Scanner', () => {
	test.beforeEach(async ({ page }) => {
		// 管理者としてログイン
		await page.goto('/login')
		await page.getByLabel(/メールアドレス/).fill('admin@fox-hound.jp')
		await page.getByLabel(/パスワード/).fill('Archimedes212')
		await page.getByRole('button', { name: /ログイン/ }).click()
		await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })
	})

	test('should display QR scan page', async ({ page }) => {
		await page.goto('/attendance/qr-scan')
		await expect(page.getByText(/QR/i)).toBeVisible({ timeout: 5000 })
	})

	test('should show clock type selection (clock in/out)', async ({ page }) => {
		await page.goto('/attendance/qr-scan')
		// 出勤/退勤ボタンが表示されることを確認
		await expect(page.getByRole('button', { name: /出勤/ })).toBeVisible({ timeout: 5000 })
		await expect(page.getByRole('button', { name: /退勤/ })).toBeVisible({ timeout: 5000 })
	})

	test('should request camera permission for scanning', async ({ page, context }) => {
		// カメラ権限を許可
		await context.grantPermissions(['camera'])

		await page.goto('/attendance/qr-scan')

		// カメラ映像またはスキャナーUIが表示されることを確認
		const scannerUI = page.locator('video, .scanner, .camera-view, [data-testid="scanner"]')
		await expect(scannerUI.first()).toBeVisible({ timeout: 10000 })
	})

	test('should show scan history section', async ({ page }) => {
		await page.goto('/attendance/qr-scan')
		// スキャン履歴セクションが表示されることを確認
		await expect(page.getByText(/履歴|スキャン履歴/)).toBeVisible({ timeout: 5000 })
	})

	test('should show usage instructions', async ({ page }) => {
		await page.goto('/attendance/qr-scan')
		// 使い方説明が表示されることを確認
		await expect(page.getByText(/使い方|手順|ユーザー/)).toBeVisible({ timeout: 5000 })
	})
})
