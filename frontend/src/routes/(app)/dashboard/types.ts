/**
 * ダッシュボード関連の型定義
 */

export interface KPIMetric {
	id: string
	title: string
	value: number
	previousValue?: number
	unit?: string
	icon: string
	color: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error'
	trend?: 'up' | 'down' | 'neutral'
	trendValue?: number
	description?: string
}

export interface ActivityItem {
	id: string
	user: {
		name: string
		initials: string
		avatar?: string
	}
	action: string
	target?: string
	timestamp: Date
	type: 'create' | 'update' | 'delete' | 'complete' | 'comment'
}

export interface QuickAction {
	id: string
	title: string
	description: string
	icon: string
	color: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error'
	onClick?: () => void
	href?: string
}

export interface ChartDataPoint {
	label: string
	value: number
	color?: string
}

export interface ProgressData {
	title: string
	current: number
	target: number
	color: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error'
	description?: string
}

export interface DashboardData {
	metrics: KPIMetric[]
	activities: ActivityItem[]
	quickActions: QuickAction[]
	progressData: ProgressData[]
	chartData: ChartDataPoint[]
}

export type AnimationState = 'idle' | 'animating' | 'completed'

// AI関連の型定義

export interface AIInsight {
	id: string
	type: 'prediction' | 'anomaly' | 'optimization' | 'alert' | 'recommendation'
	title: string
	description: string
	confidence: number // 0-100%
	priority: 'low' | 'medium' | 'high' | 'critical'
	icon: string
	color: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'
	timestamp: Date
	value?: number
	change?: number
	unit?: string
}

export interface SmartRecommendation {
	id: string
	title: string
	description: string
	category: 'performance' | 'cost' | 'security' | 'workflow' | 'automation'
	impact: 'low' | 'medium' | 'high'
	effort: 'low' | 'medium' | 'high'
	icon: string
	color: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'
	action?: string
	estimatedSavings?: number
	implementationTime?: string
}
