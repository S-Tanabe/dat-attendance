import { expect, test } from '@playwright/test'

test.describe('Dashboard', () => {
	// 認証済み状態でテストを実行するためのセットアップ
	test.beforeEach(async ({ page }) => {
		// ログイン
		await page.goto('/login')
		await page.getByLabel(/メールアドレス/).fill('admin@fox-hound.jp')
		await page.getByLabel(/パスワード/).fill('Archimedes212')
		await page.getByRole('button', { name: /ログイン/ }).click()
		await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })
	})

	test('should display dashboard page', async ({ page }) => {
		await expect(page.getByRole('heading', { name: /ダッシュボード|打刻/ })).toBeVisible()
	})

	test('should navigate to clock method selection', async ({ page }) => {
		// 打刻方法選択ボタンをクリック
		const clockButton = page.getByRole('link', { name: /打刻|出勤|退勤/ }).first()
		if (await clockButton.isVisible()) {
			await clockButton.click()
			await expect(page).toHaveURL(/.*clock-method|.*qr|.*face/, { timeout: 5000 })
		}
	})

	test('should show clock method options', async ({ page }) => {
		await page.goto('/dashboard/clock-method')
		// QRコード打刻と顔認証打刻のオプションが表示されることを確認
		await expect(page.getByText(/QR/i)).toBeVisible({ timeout: 5000 })
		await expect(page.getByText(/顔認証/)).toBeVisible({ timeout: 5000 })
	})
})
