<script lang='ts'>
	import type { ActivityItem, AIInsight, ChartDataPoint, KPIMetric, ProgressData, QuickAction, SmartRecommendation } from './types'
	import { onMount } from 'svelte'
	import ActivityTimeline from './components/ActivityTimeline.svelte'
	import AIInsights from './components/AIInsights.svelte'
	import KPICard from './components/KPICard.svelte'
	import MiniChart from './components/MiniChart.svelte'
	import ProgressCircle from './components/ProgressCircle.svelte'
	import QuickActions from './components/QuickActions.svelte'
	import SmartRecommendations from './components/SmartRecommendations.svelte'

	// 現在時刻の表示
	let currentTime = $state(new Date())
	let greeting = $state('')

	// データの状態管理
	let loading = $state(true)
	const error = $state<string | null>(null)

	// ダッシュボードデータ（デモ用）
	const kpiMetrics: KPIMetric[] = [
		{
			id: 'users',
			title: 'アクティブユーザー',
			value: 1247,
			previousValue: 1112,
			icon: 'users',
			color: 'primary',
			trend: 'up',
			trendValue: 12.1,
			description: '前月比',
		},
		{
			id: 'revenue',
			title: '月間売上',
			value: 89420,
			unit: '円',
			previousValue: 76350,
			icon: 'currency-dollar',
			color: 'success',
			trend: 'up',
			trendValue: 17.1,
			description: '前月比',
		},
		{
			id: 'projects',
			title: 'プロジェクト数',
			value: 156,
			previousValue: 142,
			icon: 'chart-bar',
			color: 'secondary',
			trend: 'up',
			trendValue: 9.9,
			description: '今月 +14',
		},
		{
			id: 'completion',
			title: '完了率',
			value: 87,
			unit: '%',
			previousValue: 82,
			icon: 'check-circle',
			color: 'accent',
			trend: 'up',
			trendValue: 6.1,
			description: '今週',
		},
	]

	const progressData: ProgressData[] = [
		{
			title: '月次目標',
			current: 87420,
			target: 100000,
			color: 'primary',
			description: '売上目標',
		},
		{
			title: 'プロジェクト進捗',
			current: 156,
			target: 180,
			color: 'success',
			description: '年間目標',
		},
		{
			title: 'ユーザー獲得',
			current: 1247,
			target: 1500,
			color: 'secondary',
			description: '月間目標',
		},
	]

	const chartData: ChartDataPoint[] = [
		{ label: '1月', value: 65 },
		{ label: '2月', value: 78 },
		{ label: '3月', value: 90 },
		{ label: '4月', value: 81 },
		{ label: '5月', value: 95 },
		{ label: '6月', value: 87 },
		{ label: '7月', value: 103 },
	]

	const revenueChartData: ChartDataPoint[] = [
		{ label: '1週', value: 18500 },
		{ label: '2週', value: 22300 },
		{ label: '3週', value: 25700 },
		{ label: '4週', value: 23200 },
	]

	const activities: ActivityItem[] = [
		{
			id: '1',
			user: { name: '佐藤太郎', initials: 'ST' },
			action: 'プロジェクトを作成しました',
			target: '新規ECサイト開発',
			timestamp: new Date(Date.now() - 5 * 60 * 1000),
			type: 'create',
		},
		{
			id: '2',
			user: { name: '田中花子', initials: 'TH' },
			action: 'レポートを更新しました',
			target: '月次売上分析',
			timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
			type: 'update',
		},
		{
			id: '3',
			user: { name: '鈴木次郎', initials: 'SJ' },
			action: 'タスクを完了しました',
			target: 'UIデザイン',
			timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
			type: 'complete',
		},
		{
			id: '4',
			user: { name: '山田美咲', initials: 'YM' },
			action: 'コメントを追加しました',
			target: 'プロジェクト企画書',
			timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
			type: 'comment',
		},
		{
			id: '5',
			user: { name: '高橋一郎', initials: 'TI' },
			action: 'ファイルを削除しました',
			target: '古いバックアップ',
			timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000),
			type: 'delete',
		},
	]

	const quickActions: QuickAction[] = [
		{
			id: 'new-project',
			title: '新規プロジェクト',
			description: '新しいプロジェクトを開始する',
			icon: 'plus',
			color: 'primary',
			href: '/projects/new',
		},
		{
			id: 'add-user',
			title: 'ユーザー追加',
			description: '新しいチームメンバーを招待',
			icon: 'user-plus',
			color: 'secondary',
			href: '/users/invite',
		},
		{
			id: 'generate-report',
			title: 'レポート生成',
			description: '月次レポートを自動生成',
			icon: 'document-report',
			color: 'accent',
			href: '/reports/generate',
		},
		{
			id: 'settings',
			title: '設定',
			description: 'システム設定を変更',
			icon: 'cog',
			color: 'warning',
			href: '/settings',
		},
		{
			id: 'analytics',
			title: 'アナリティクス',
			description: '詳細な分析データを確認',
			icon: 'chart-bar',
			color: 'success',
			href: '/analytics',
		},
		{
			id: 'calendar',
			title: 'カレンダー',
			description: 'スケジュール管理',
			icon: 'calendar',
			color: 'error',
			href: '/calendar',
		},
	]

	// AI関連ダミーデータ
	const aiInsights: AIInsight[] = [
		{
			id: 'revenue-prediction',
			type: 'prediction',
			title: '売上予測アップデート',
			description: '来月の売上は前月比15%増加すると予測されています。季節的要因と新規顧客の増加が主な要因です。',
			confidence: 92,
			priority: 'high',
			icon: 'chart-bar-square',
			color: 'success',
			timestamp: new Date(),
			value: 103284,
			change: 15.2,
			unit: '円',
		},
		{
			id: 'performance-anomaly',
			type: 'anomaly',
			title: 'パフォーマンス異常検出',
			description: 'システムの応答時間が平均より20%改善しています。最近のインフラ最適化が効果を発揮しています。',
			confidence: 87,
			priority: 'medium',
			icon: 'lightning-bolt',
			color: 'warning',
			timestamp: new Date(),
			value: 0.8,
			change: -20,
			unit: '秒',
		},
		{
			id: 'user-behavior',
			type: 'optimization',
			title: 'ユーザー行動分析',
			description: 'ダッシュボード滞在時間が25%増加。新しいUIデザインの効果が現れています。',
			confidence: 94,
			priority: 'medium',
			icon: 'sparkles',
			color: 'primary',
			timestamp: new Date(),
			value: 4.2,
			change: 25,
			unit: '分',
		},
		{
			id: 'security-alert',
			type: 'alert',
			title: 'セキュリティ状況',
			description: '過去24時間で疑わしいアクセスが3件検出されました。すべて自動でブロック済みです。',
			confidence: 98,
			priority: 'critical',
			icon: 'cpu-chip',
			color: 'error',
			timestamp: new Date(),
			value: 3,
			change: 0,
			unit: '件',
		},
	]

	const smartRecommendations: SmartRecommendation[] = [
		{
			id: 'cache-optimization',
			title: 'キャッシュ最適化の実装',
			description: 'Redis キャッシュレイヤーを導入することで、データベースクエリを40%削減できます。',
			category: 'performance',
			impact: 'high',
			effort: 'medium',
			icon: 'bolt',
			color: 'success',
			action: '実装を開始する',
			estimatedSavings: 45000,
			implementationTime: '2-3日',
		},
		{
			id: 'automated-backup',
			title: '自動バックアップシステム',
			description: '毎日の自動バックアップを設定し、データ損失リスクを99.9%削減します。',
			category: 'security',
			impact: 'high',
			effort: 'low',
			icon: 'shield-check',
			color: 'error',
			action: 'バックアップ設定',
			estimatedSavings: 120000,
			implementationTime: '1日',
		},
		{
			id: 'workflow-automation',
			title: 'ワークフロー自動化',
			description: '承認プロセスを自動化することで、処理時間を60%短縮できます。',
			category: 'workflow',
			impact: 'medium',
			effort: 'medium',
			icon: 'arrow-path',
			color: 'info',
			action: 'ワークフロー設定',
			estimatedSavings: 80000,
			implementationTime: '1週間',
		},
		{
			id: 'cost-optimization',
			title: 'クラウドコスト最適化',
			description: '未使用のリソースを特定し、月額料金を25%削減できます。',
			category: 'cost',
			impact: 'high',
			effort: 'low',
			icon: 'currency-dollar',
			color: 'warning',
			action: 'リソース最適化',
			estimatedSavings: 35000,
			implementationTime: '半日',
		},
		{
			id: 'monitoring-enhancement',
			title: 'モニタリング強化',
			description: 'APM ツールの導入で、問題の早期発見と解決時間の50%短縮を実現。',
			category: 'performance',
			impact: 'medium',
			effort: 'medium',
			icon: 'chart-bar',
			color: 'primary',
			action: 'モニタリング設定',
			estimatedSavings: 60000,
			implementationTime: '3-5日',
		},
	]

	// 時刻更新とあいさつメッセージ
	$effect(() => {
		const interval = setInterval(() => {
			currentTime = new Date()
		}, 1000)

		return () => clearInterval(interval)
	})

	$effect(() => {
		const hour = currentTime.getHours()
		if (hour < 12) {
			greeting = 'おはようございます'
		} else if (hour < 18) {
			greeting = 'こんにちは'
		} else {
			greeting = 'こんばんは'
		}
	})

	onMount(() => {
		// ローディングシミュレーション
		const timer = setTimeout(() => {
			loading = false
		}, 1000)

		return () => clearTimeout(timer)
	})
</script>

<svelte:head>
	<title>ダッシュボード - FOX HOUND</title>
</svelte:head>

<div class='min-h-screen bg-linear-to-br from-base-100 via-base-200/50 to-base-100'>
	{#if loading}
		<!-- ローディング状態 -->
		<div class='flex items-center justify-center min-h-screen'>
			<div class='text-center'>
				<div class='loading loading-spinner loading-lg text-primary mb-4'></div>
				<p class='text-base-content/60'>ダッシュボードを読み込み中...</p>
			</div>
		</div>
	{:else if error}
		<!-- エラー状態 -->
		<div class='flex items-center justify-center min-h-screen'>
			<div class='alert alert-error max-w-md'>
				<svg xmlns='http://www.w3.org/2000/svg' class='stroke-current shrink-0 h-6 w-6' fill='none' viewBox='0 0 24 24'>
					<path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' />
				</svg>
				<span>{error}</span>
			</div>
		</div>
	{:else}
		<!-- メインコンテンツ -->
		<div class='container mx-auto px-6 py-8 space-y-6'>

			<!-- ヘッダーセクション -->
			<div class='bg-base-100/80 backdrop-blur-sm rounded-2xl shadow-xl border border-base-300 p-8'>
				<div class='flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0'>
					<div>
						<h1 class='text-4xl font-bold bg-linear-to-r from-primary to-secondary bg-clip-text text-transparent'>
							{greeting}！
						</h1>
						<p class='text-lg text-base-content/70 mt-2'>
							今日も素晴らしい一日にしましょう
						</p>
					</div>
					<div class='text-right'>
						<div class='text-3xl font-bold text-base-content'>
							{currentTime.toLocaleTimeString('ja-JP', {
								hour: '2-digit',
								minute: '2-digit',
							})}
						</div>
						<div class='text-sm text-base-content/60'>
							{currentTime.toLocaleDateString('ja-JP', {
								year: 'numeric',
								month: 'long',
								day: 'numeric',
								weekday: 'long',
							})}
						</div>
					</div>
				</div>
			</div>

			<!-- KPI メトリクス -->
			<section>
				<div class='mb-6'>
					<h2 class='text-2xl font-bold text-base-content mb-2'>主要指標</h2>
					<p class='text-base-content/60'>システムの重要なメトリクスの概要</p>
				</div>
				<div class='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
					{#each kpiMetrics as metric, index}
						<KPICard {metric} animationDelay={index * 200} />
					{/each}
				</div>
			</section>

			<!-- チャートと進捗セクション -->
			<div class='grid grid-cols-1 xl:grid-cols-3 gap-6'>

				<!-- チャートエリア -->
				<div class='xl:col-span-2 space-y-4'>
					<div class='bg-base-100/80 backdrop-blur-sm rounded-2xl shadow-xl border border-base-300 p-6'>
						<MiniChart
							data={chartData}
							title='プロジェクト完了数（7ヶ月間）'
							height={120}
							type='line'
							color='primary'
							animationDelay={800}
						/>
					</div>

					<div class='bg-base-100/80 backdrop-blur-sm rounded-2xl shadow-xl border border-base-300 p-6'>
						<MiniChart
							data={revenueChartData}
							title='週間売上推移（今月）'
							height={120}
							type='bar'
							color='success'
							animationDelay={1000}
						/>
					</div>
				</div>

				<!-- 進捗サークル -->
				<div class='bg-base-100/80 backdrop-blur-sm rounded-2xl shadow-xl border border-base-300 p-6'>
					<h2 class='text-xl font-bold text-base-content mb-6'>目標達成状況</h2>
					<div class='space-y-6'>
						{#each progressData as progress, index}
							<ProgressCircle
								{progress}
								size='md'
								animationDelay={1200 + index * 300}
							/>
						{/each}
					</div>
				</div>
			</div>

			<!-- AI インサイトとスマート提案セクション -->
			<div class='grid grid-cols-1 xl:grid-cols-2 gap-6 items-start'>
				<!-- AI インサイト -->
				<div class='h-full'>
					<AIInsights insights={aiInsights} animationDelay={1500} />
				</div>

				<!-- スマート提案 -->
				<div class='h-full'>
					<SmartRecommendations recommendations={smartRecommendations} animationDelay={1700} />
				</div>
			</div>

			<!-- アクティビティとクイックアクション -->
			<div class='grid grid-cols-1 xl:grid-cols-2 gap-6'>

				<!-- アクティビティタイムライン -->
				<div class='bg-base-100/80 backdrop-blur-sm rounded-2xl shadow-xl border border-base-300 p-6'>
					<ActivityTimeline {activities} maxItems={5} />
				</div>

				<!-- クイックアクション -->
				<div class='bg-base-100/80 backdrop-blur-sm rounded-2xl shadow-xl border border-base-300 p-6'>
					<QuickActions actions={quickActions} columns={2} />
				</div>
			</div>

			<!-- 統計サマリー -->
			<div class='bg-linear-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-2xl p-8 border border-base-300'>
				<div class='grid grid-cols-2 md:grid-cols-4 gap-6'>
					<div class='text-center'>
						<div class='text-3xl font-bold text-primary mb-2'>99.9%</div>
						<div class='text-sm text-base-content/70'>システム稼働率</div>
					</div>
					<div class='text-center'>
						<div class='text-3xl font-bold text-secondary mb-2'>24/7</div>
						<div class='text-sm text-base-content/70'>サポート体制</div>
					</div>
					<div class='text-center'>
						<div class='text-3xl font-bold text-accent mb-2'>15ms</div>
						<div class='text-sm text-base-content/70'>平均レスポンス</div>
					</div>
					<div class='text-center'>
						<div class='text-3xl font-bold text-success mb-2'>128</div>
						<div class='text-sm text-base-content/70'>アクティブAPI</div>
					</div>
				</div>
			</div>

			<!-- フッター情報 -->
			<div class='text-center py-8'>
				<p class='text-base-content/50 text-sm'>
					最終更新: {new Date().toLocaleString('ja-JP')} |
					システムバージョン: 2.1.0 |
					稼働時間: 99日 15時間 42分
				</p>
			</div>

		</div>
	{/if}
</div>
