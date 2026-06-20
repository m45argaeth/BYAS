'use client'

import type { CombineResult, Rarity } from './types'

const BG: Record<Rarity, [string, string]> = {
  common: ['#475569', '#1e293b'],
  uncommon: ['#10b981', '#065f46'],
  rare: ['#0ea5e9', '#3730a3'],
  legendary: ['#f59e0b', '#c2410c'],
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'discovery'
}

export async function shareDiscovery(result: CombineResult, rarityLabel: string): Promise<void> {
  try {
    const size = 1080
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const colors = BG[result.rarity] ?? BG.common
    const grad = ctx.createLinearGradient(0, 0, size, size)
    grad.addColorStop(0, colors[0])
    grad.addColorStop(1, colors[1])
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    ctx.font = '320px serif'
    ctx.fillText(result.emoji || '✨', size / 2, size / 2 - 120)

    ctx.fillStyle = '#ffffff'
    let nameSize = 110
    ctx.font = 'bold ' + nameSize + 'px sans-serif'
    while (ctx.measureText(result.result).width > size - 160 && nameSize > 40) {
      nameSize -= 6
      ctx.font = 'bold ' + nameSize + 'px sans-serif'
    }
    ctx.fillText(result.result, size / 2, size / 2 + 170)

    if (result.formula) {
      ctx.font = '54px monospace'
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.fillText(result.formula, size / 2, size / 2 + 270)
    }

    ctx.font = 'bold 44px sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.9)'
    ctx.fillText(rarityLabel.toUpperCase(), size / 2, size / 2 + 350)

    ctx.font = 'bold 52px sans-serif'
    ctx.fillStyle = '#ffffff'
    ctx.fillText('⚗️ BYAS', size / 2, size - 90)

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) return
    const file = new File([blob], 'byas-' + slug(result.result) + '.png', { type: 'image/png' })

    const nav = navigator as Navigator & {
      canShare?: (data: unknown) => boolean
      share?: (data: unknown) => Promise<void>
    }
    if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title: 'BYAS', text: result.result + ' — BYAS' })
      return
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
  } catch {
    // ignore share failures
  }
}
