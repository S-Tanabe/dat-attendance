import net from 'node:net'

export type TrustMode = 'off' | 'warn' | 'enforce'

export type TrustDiagnostics = {
  raw_remote_address: string | null
  xff_chain: string[]
  forwarded_for?: string | null
  trusted_proxy_hits: number
  effective_client_ip: string | null
  decision_source: 'xff' | 'forwarded' | 'remote' | 'cf' | 'true-client' | 'unknown'
  flags: string[]
}

// -- CIDR helpers (IPv4/IPv6, minimal) --
function parseIPv4(ip: string): number | null {
  const m = ip.match(/^(\d{1,3})(?:\.(\d{1,3})){3}$/)
  if (!m) return null
  const parts = ip.split('.').map(n => Number(n))
  if (parts.some(n => n < 0 || n > 255)) return null
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

function parseIPv6ToBigInt(ip: string): bigint | null {
  try {
    // Normalize IPv6 (including IPv4-mapped)
    if (ip.includes('.')) {
      const idx = ip.lastIndexOf(':')
      const v4 = ip.slice(idx + 1)
      const v6 = ip.slice(0, idx)
      const v4n = parseIPv4(v4)
      if (v4n == null) return null
      // ::ffff:0:0/96 mapping
      const hi = BigInt(0xffff)
      const rest = BigInt(v4n)
      // Build as 96-bit ffff + 32-bit IPv4
      // Simplify by expanding v6 via node:net if possible
      const full = net.isIP(v6) === 6 ? expandIPv6(v6) : '::ffff:0:0'
      const base = ipv6ToBigInt(full)
      return base + rest
    }
    return ipv6ToBigInt(expandIPv6(ip))
  } catch {
    return null
  }
}

function expandIPv6(ip: string): string {
  // Very small normalizer; rely on URL parser approach
  if (!ip.includes('::')) return ip
  const parts = ip.split('::')
  const left = parts[0] ? parts[0].split(':') : []
  const right = parts[1] ? parts[1].split(':') : []
  const fill = new Array(8 - (left.length + right.length)).fill('0')
  return [...left, ...fill, ...right].join(':')
}

function ipv6ToBigInt(full: string): bigint {
  const parts = full.split(':').map(p => parseInt(p || '0', 16))
  while (parts.length < 8) parts.push(0)
  return parts.reduce((acc, part) => (acc << BigInt(16)) + BigInt(part), BigInt(0))
}

function isIpInCidr(ip: string, cidr: string): boolean {
  // Accept IPv4/IPv6
  const [range, maskStr] = cidr.split('/')
  const mask = Number(maskStr)
  if (!range || Number.isNaN(mask)) return false
  const ipVer = net.isIP(ip)
  const rangeVer = net.isIP(range)
  if (!ipVer || !rangeVer || ipVer !== rangeVer) return false

  if (ipVer === 4) {
    const ipn = parseIPv4(ip)
    const rangen = parseIPv4(range)
    if (ipn == null || rangen == null) return false
    const maskBits = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0
    return (ipn & maskBits) === (rangen & maskBits)
  } else {
    const ipb = parseIPv6ToBigInt(ip)
    const rangeb = parseIPv6ToBigInt(range)
    if (ipb == null || rangeb == null) return false
    const shift = BigInt(128 - mask)
    const maskb = shift === BigInt(128) ? BigInt(0) : (BigInt(-1) << shift) & ((BigInt(1) << BigInt(128)) - BigInt(1))
    return (ipb & maskb) === (rangeb & maskb)
  }
}

function inAnyCidr(ip: string, cidrs: string[]): boolean {
  return cidrs.some(c => isIpInCidr(ip, c))
}

function sanitizeIp(ip: string | null | undefined): string | null {
  if (!ip) return null
  // IPv6-mapped IPv4: ::ffff:127.0.0.1
  const m = ip.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/i)
  if (m) return m[1]
  return ip
}

export function evaluateClientIpTrust(params: {
  remoteAddress: string | null
  headers: Record<string, string | undefined>
  trustedCidrs: string[]
  mode: TrustMode
}): TrustDiagnostics {
  const flags: string[] = []
  const remote = sanitizeIp(params.remoteAddress)
  const h = (k: string) => params.headers[k.toLowerCase()] || undefined
  const xff = (h('x-forwarded-for') || '').split(',').map(s => s.trim()).filter(Boolean)
  const forwarded = h('forwarded')
  const cf = h('cf-connecting-ip')
  const tcip = h('true-client-ip')

  const trusted = remote ? inAnyCidr(remote, params.trustedCidrs) : false
  if (!trusted && xff.length) flags.push('untrusted_entrypoint_with_xff')

  let decision: TrustDiagnostics['decision_source'] = 'unknown'
  let effective: string | null = null
  let trustedHits = 0
  let forwardedFor: string | null = null

  if (trusted && xff.length) {
    // Walk from rightmost; count trusted proxies
    for (let i = xff.length - 1; i >= 0; i--) {
      const hop = sanitizeIp(xff[i])!
      if (inAnyCidr(hop, params.trustedCidrs)) trustedHits++
      else {
        effective = hop
        decision = 'xff'
        break
      }
    }
    if (!effective) {
      // all hops trusted → use leftmost as client
      effective = sanitizeIp(xff[0])
      decision = 'xff'
    }
  } else if (trusted && forwarded) {
    const m = forwarded.match(/for=\"?\[?([A-Za-z0-9:\.]+)\]?\"?/i)
    if (m && m[1]) {
      effective = sanitizeIp(m[1])
      decision = 'forwarded'
      forwardedFor = effective
    }
  }

  if (!effective && trusted && (cf || tcip)) {
    effective = sanitizeIp(cf || tcip)!
    decision = cf ? 'cf' : 'true-client'
  }

  if (!effective) {
    effective = remote
    decision = 'remote'
  }

  // Basic sanity: if effective looks private but trusted chain claims public, warn
  const isPrivate = (ip?: string | null) => !!ip && (
    /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip) || ip === '127.0.0.1' || ip === '::1'
  )
  if (isPrivate(effective) && trusted && xff.length) flags.push('private_client_ip_from_trusted_chain')

  return {
    raw_remote_address: remote || null,
    xff_chain: xff,
    forwarded_for: forwardedFor,
    trusted_proxy_hits: trustedHits,
    effective_client_ip: effective || null,
    decision_source: decision,
    flags,
  }
}

