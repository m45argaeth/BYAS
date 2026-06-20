import type { CombineResult, Rarity } from './types'

const BG: Record<Rarity, [string, string]> = {
  common: ['#475569', '#1e293b'],
  uncommon: ['#059669', '#064e3b'],
  rare: ['#2563eb', '#312e81'],
  legendary: ['#d97706', '#7c2d12'],
}

// Renders the discovery to a 1080x1080 PNG and shares (Web Share API) or downloads it.
export async function shareDiscovery(r: CombineResult, rarityLabel: string): Promise<void> {
  const size = 1080
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const c = canvas.getContext('2d')
  if (!c) return

  const colors = BG[r.rarity] ?? BG.common
  const grad = c.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0, colors[0])
  grad.addColorStop(1, colors[1])
  c.fillStyle = grad
  c.fillRect(0, 0, size, size)

  c.textAlign = 'center'
  c.fillStyle = '#ffffff'
  c.font = '300px serif'
  c.fillText(r.emoji || '✨', size / 2, size / 2 - 40)

  let fs = 110
  c.font = 'bold ' + fs + 'px sans-serif'
  while (c.measureText(r.result).width > size - 140 && fs > 42) {
    fs -= 6
    c.font = 'bold ' + fs + 'px sans-serif'
  }
  c.fillText(r.result, size / 2, size / 2 + 160)

  if (r.formula) {
    c.font = '54px monospace'
    c.fillStyle = 'rgba(255,255,255,0.85)'
    c.fillText(r.formula, size / 2, size / 2 + 248)
  }

  c.font = 'bold 44px sans-serif'
  c.fillStyle = 'rgba(255,255,255,0.9)'
  c.fillText(rarityLabel.toUpperCase(), size / 2, size / 2 + 336)

  c.font = 'bold 50px sans-serif'
  c.fillStyle = '#ffffff'
  c.fillText('⚗️ BYAS', size / 2, size - 80)

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) return
  const file = new File([blob], 'byas-discovery.png', { type: 'image/png' })
  const nav = navigator as Navigator & {
    canShare?: (d?: unknown) => boolean
    share?: (d: unknown) => Promise<void>
  }
  if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: 'BYAS', text: r.result })
      return
    } catch {}
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'byas-discovery.png'
  a.click()
  URL.revokeObjectURL(url)
}
