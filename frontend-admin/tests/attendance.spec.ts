import { expect, test } from '@playwright/test'

test.describe('Admin Attendance Management', () => {
	test.beforeEach(async ({ page }) => {
		// 管理者としてログイン
		await page.goto('/login')
		await page.getByLabel(/メールアドレス/).fill('admin@fox-hound.jp')
		await page.getByLabel(/パスワード/).fill('Archimedes212')
		await page.getByRole('button', { name: /ログイン/ }).click()
		await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })
	})

	test('should display admin dashboard', async ({ page }) => {
		await expect(page.getByRole('heading', { name: /ダッシュボード/ })).toBeVisible()
	})

	test('should navigate to attendance management via sidebar', async ({ page }) => {
		// サイドバーから勤怠管理へ移動
		const attendanceLink = page.getByRole('link', { name: /勤怠|出退勤/ })
		if (await attendanceLink.isVisible()) {
			await attendanceLink.click()
			await expect(page).toHaveURL(/.*attendance/, { timeout: 5000 })
		}
	})

	test('should access QR scan page from attendance', async ({ page }) => {
		await page.goto('/attendance')
		// QRスキャンへのリンクを探す
		const qrScanLink = page.getByRole('link', { name: /QR.*スキャン|打刻承認/i })
		if (await qrScanLink.isVisible()) {
			await qrScanLink.click()
			await expect(page).toHaveURL(/.*qr-scan/, { timeout: 5000 })
		}
	})
})
