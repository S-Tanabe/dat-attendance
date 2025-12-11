import { TrustMode } from './evaluate'

type Thresholds = { critical: number; high: number; medium: number }
type TrustConfig = { mode: TrustMode; cidrs: string[]; thresholds: Thresholds }

function parseThresholdsEnv(): Thresholds {
  try {
    const raw = process.env.IP_TRUST_THRESHOLDS || ''
    if (!raw) return { critical: 80, high: 60, medium: 40 }
    const obj = JSON.parse(raw)
    const c = Number(obj.critical ?? 80)
    const h = Number(obj.high ?? 60)
    const m = Number(obj.medium ?? 40)
    return { critical: c, high: h, medium: m }
  } catch {
    return { critical: 80, high: 60, medium: 40 }
  }
}

const defaultConfig: TrustConfig = {
  mode: ((process.env.IP_TRUST_MODE || 'warn').toLowerCase() as TrustMode) || 'warn',
  cidrs: (process.env.TRUSTED_PROXY_CIDRS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  thresholds: parseThresholdsEnv(),
}

let overrideConfig: Partial<TrustConfig> | null = null

export function getEffectiveTrustConfig(): TrustConfig {
  return {
    mode: (overrideConfig?.mode ?? defaultConfig.mode) as TrustMode,
    cidrs: (overrideConfig?.cidrs ?? defaultConfig.cidrs) as string[],
    thresholds: (overrideConfig?.thresholds ?? defaultConfig.thresholds) as Thresholds,
  }
}

export function getCurrentConfig() {
  return { default: defaultConfig, override: overrideConfig, effective: getEffectiveTrustConfig() }
}

export function setOverrideTrustConfig(p: Partial<TrustConfig> | null) {
  if (p == null) {
    overrideConfig = null
    return
  }
  const out: Partial<TrustConfig> = {}
  if (p.mode && ['off','warn','enforce'].includes(p.mode)) out.mode = p.mode
  if (p.cidrs) out.cidrs = [...p.cidrs]
  if (p.thresholds) {
    const t = p.thresholds as any
    const c = Number(t.critical ?? defaultConfig.thresholds.critical)
    const h = Number(t.high ?? defaultConfig.thresholds.high)
    const m = Number(t.medium ?? defaultConfig.thresholds.medium)
    out.thresholds = { critical: c, high: h, medium: m }
  }
  overrideConfig = Object.keys(out).length ? { ...(overrideConfig ?? {}), ...out } : overrideConfig
}
