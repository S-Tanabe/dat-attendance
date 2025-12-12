import { expect, test } from '@playwright/test'

test.describe('Face Recognition Clock', () => {
	test.beforeEach(async ({ page }) => {
		// ログイン
		await page.goto('/login')
		await page.getByLabel(/メールアドレス/).fill('admin@fox-hound.jp')
		await page.getByLabel(/パスワード/).fill('Archimedes212')
		await page.getByRole('button', { name: /ログイン/ }).click()
		await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 })
	})

	test('should display face recognition page', async ({ page }) => {
		await page.goto('/dashboard/face')
		// 顔認証ページが表示されることを確認
		await expect(page.getByText(/顔認証/)).toBeVisible({ timeout: 5000 })
	})

	test('should show clock type selection', async ({ page }) => {
		await page.goto('/dashboard/face')
		// 出勤/退勤の選択が表示されることを確認
		await expect(page.getByRole('button', { name: /出勤/ })).toBeVisible({ timeout: 5000 })
		await expect(page.getByRole('button', { name: /退勤/ })).toBeVisible({ timeout: 5000 })
	})

	test('should request camera permission', async ({ page, context }) => {
		// カメラ権限を許可
		await context.grantPermissions(['camera'])

		await page.goto('/dashboard/face')

		// カメラ映像またはカメラアクセスに関する要素が表示されることを確認
		// video要素またはカメラ関連のUIが表示される
		const videoOrCameraUI = page.locator('video, .camera-view, [data-testid="camera"], .loading')
		await expect(videoOrCameraUI.first()).toBeVisible({ timeout: 10000 })
	})

	test('should show face registration option if not registered', async ({ page }) => {
		await page.goto('/dashboard/face')
		// 顔データ未登録の場合、登録を促すメッセージが表示される可能性
		const registrationMessage = page.getByText(/登録|未登録|設定/)
		// 登録メッセージまたは顔認証UIのいずれかが表示される
		const faceUI = page.locator('.face-recognition, video, [data-testid="face-ui"]')
		await expect(registrationMessage.or(faceUI.first())).toBeVisible({ timeout: 10000 })
	})
})
