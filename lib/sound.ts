'use client'

let enabled = true
let ctx: AudioContext | null = null

const KEY = 'byas_sound'

export function initSound() {
  if (typeof window === 'undefined') return
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'off') enabled = false
  } catch {}
}

export function isSoundOn(): boolean {
  return enabled
}

export function setSoundOn(on: boolean) {
  enabled = on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {}
}

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
    }
    return ctx
  } catch {
    return null
  }
}

function tone(freq: number, durMs: number, type: OscillatorType, gain = 0.06, delayMs = 0) {
  if (!enabled) return
  const ac = getCtx()
  if (!ac) return
  const start = ac.currentTime + delayMs / 1000
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  g.gain.setValueAtTime(gain, start)
  g.gain.exponentialRampToValueAtTime(0.0001, start + durMs / 1000)
  osc.connect(g)
  g.connect(ac.destination)
  osc.start(start)
  osc.stop(start + durMs / 1000)
}

export function playPop() {
  tone(440, 90, 'triangle')
}
export function playError() {
  tone(180, 220, 'sawtooth', 0.05)
}
export function playSuccess() {
  tone(523, 120, 'triangle')
  tone(784, 160, 'triangle', 0.06, 110)
}
export function playUnlock() {
  tone(523, 120, 'triangle')
  tone(659, 120, 'triangle', 0.06, 110)
  tone(988, 240, 'triangle', 0.06, 230)
}
