// Lightweight Web Audio synth SFX. No asset files needed.
let enabled = true
let ac: AudioContext | null = null

export function initSound(): void {
  if (typeof window === 'undefined') return
  enabled = localStorage.getItem('byas_sound') !== 'off'
}

export function isSoundOn(): boolean {
  return enabled
}

export function setSoundOn(on: boolean): void {
  enabled = on
  if (typeof window !== 'undefined') {
    localStorage.setItem('byas_sound', on ? 'on' : 'off')
  }
}

function ctx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const Ctor = W.AudioContext ?? W.webkitAudioContext
    if (!Ctor) return null
    if (!ac) ac = new Ctor()
    return ac
  } catch {
    return null
  }
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, delay = 0): void {
  const a = ctx()
  if (!a) return
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.value = freq
  o.connect(g)
  g.connect(a.destination)
  const t0 = a.currentTime + delay
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.start(t0)
  o.stop(t0 + dur)
}

export function playPop(): void {
  if (!enabled) return
  tone(420, 0.12, 'triangle', 0.12)
}

export function playSuccess(): void {
  if (!enabled) return
  tone(523, 0.12, 'sine', 0.13)
  tone(659, 0.14, 'sine', 0.13, 0.1)
  tone(784, 0.18, 'sine', 0.13, 0.2)
}

export function playError(): void {
  if (!enabled) return
  tone(200, 0.2, 'sawtooth', 0.1)
}

export function playUnlock(): void {
  if (!enabled) return
  tone(659, 0.12, 'square', 0.1)
  tone(988, 0.22, 'square', 0.1, 0.12)
}
