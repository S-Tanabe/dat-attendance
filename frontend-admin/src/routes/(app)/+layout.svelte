<script lang='ts'>
	import { browser } from '$app/environment'
	import { goto } from '$app/navigation'
	import Header from '$lib/components/Header.svelte'
	import { Sidebar, sidebarStore } from '$lib/components/sidebar'
	import ToastHost from '$lib/components/ToastHost.svelte'
	import { clearSentryUser, setSentryUser } from '$lib/monitoring/sentry'
	import { onMount } from 'svelte'

	export let data: { user: import('$lib/generated/client').users.UserProfile | null, isDevelopment: boolean }

	let userData = data.user

	// データが更新されたら userData を更新 + Sentryユーザーコンテキストを更新
	$: {
		userData = data.user
		// ユーザーデータが存在する場合、Sentryにユーザー情報を設定
		if (userData && browser) {
			setSentryUser(
				userData.id,
				userData.email,
				userData.display_name || undefined,
			)
			console.log('[Sentry] User context set:', {
				id: userData.id,
				email: userData.email,
			})
		}
	}

	onMount(() => {
	// クライアントサイドで認証状態を再確認
    // if (!userData) {
    //   // 認証されていない場合は即座にログインページへ
    //   window.location.replace('/login');
    //   return;
    // }

    // // ブラウザバック検知（キャッシュからの復元時のみ）
    // if (browser) {
    //   // ページ表示時の処理
    //   const handlePageShow = (event: PageTransitionEvent) => {
    //     if (event.persisted) {
    //       // キャッシュから復元された場合のみ認証チェック
    //       // この場合はログアウト後のブラウザバックなので、強制的にログインページへ
    //       if (!userData) {
    //         window.location.replace('/login');
    //       }
    //     }
    //   };

    //   window.addEventListener('pageshow', handlePageShow);

    //   // クリーンアップ
    //   return () => {
    //     window.removeEventListener('pageshow', handlePageShow);
    //   };
    // }
	})

	async function handleLogout() {
		// ✅ Sentryユーザーコンテキストをクリア
		clearSentryUser()
		console.log('[Sentry] User context cleared')

		// ログアウト前にサイドバーの状態をクリア
		sidebarStore.reset()

		// その他のユーザー固有のローカルストレージをクリア
		if (browser) {
		// 必要に応じて他のキーもクリア（プロジェクト固有のもの）
      // localStorage.removeItem('other_user_data');
		}

		// ログアウトページへ遷移
		await goto('/logout')
	}
</script>

<div class='min-h-screen flex'>
	<!-- サイドバー -->
	<Sidebar isDevelopment={data.isDevelopment} userRole={userData?.role?.name} />

	<!-- メインコンテンツ -->
	<div class='flex-1 flex flex-col bg-base-200'>
		<!-- ヘッダー -->
		<Header user={userData} onLogout={handleLogout} />

		<!-- コンテンツエリア -->
		<div class='flex-1 overflow-auto p-6'>
			<slot />
		</div>
	</div>
</div>
<ToastHost />
