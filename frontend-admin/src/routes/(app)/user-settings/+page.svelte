<script lang='ts'>
	import type { PageData } from './$types'
	import GeneralTab from './components/GeneralTab.svelte'
	import OtherTab from './components/OtherTab.svelte'

	export let data: PageData

	let activeTab = 'general'
	const profile = data.profile
	const error: string | undefined = data.error

	// GeneralTabコンポーネントからのイベントハンドラー
  // 実際のAPI呼び出しはGeneralTab内で行われる
	async function handleSave() {
	// プロファイル更新後の処理（必要に応じて実装）
	}

	async function handlePasswordChange() {
	// パスワード変更後の処理（必要に応じて実装）
	}

	async function handleAvatarUpload() {
	// アバターアップロード後の処理（必要に応じて実装）
	}

	async function handleAvatarRemove() {
	// アバター削除後の処理（必要に応じて実装）
	}
</script>

<div class='container mx-auto px-4 py-8'>
	<h1 class='text-3xl font-bold mb-8'>ユーザー設定</h1>

	{#if profile}
		<!-- タブメニュー -->
		<div class='tabs tabs-boxed mb-8'>
			<button
				class="tab {activeTab === 'general' ? 'tab-active' : ''}"
				onclick={() => activeTab = 'general'}
			>
				一般
			</button>
			<button
				class="tab {activeTab === 'other' ? 'tab-active' : ''}"
				onclick={() => activeTab = 'other'}
			>
				その他
			</button>
		</div>

		<!-- タブコンテンツ -->
		<div class='mt-4'>
			{#if activeTab === 'general'}
				<GeneralTab
					{profile}
					onSave={handleSave}
					onPasswordChange={handlePasswordChange}
					onAvatarUpload={handleAvatarUpload}
					onAvatarRemove={handleAvatarRemove}
				/>
			{:else if activeTab === 'other'}
				<OtherTab {profile} />
			{/if}
		</div>
	{:else}
		<div class='alert alert-error'>
			<span>{error || 'プロファイルの読み込みに失敗しました'}</span>
		</div>
	{/if}
</div>

<style>
  /* アニメーションスタイル */
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
