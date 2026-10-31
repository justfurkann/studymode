import { getSettings } from './settings'

/*
 * Tiny synthesized sounds (no audio files). They only play when the student turned them on in
 * Settings, and never throw: a browser without Web Audio simply stays silent.
 */

export type SoundName = 'right' | 'wrong' | 'done'

const NOTES: Record<SoundName, Array<[frequency: number, startS: number, lengthS: number]>> = {
  right: [[880, 0, 0.09]],
  wrong: [[220, 0, 0.14]],
  done: [
    [660, 0, 0.1],
    [880, 0.1, 0.1],
    [1320, 0.2, 0.18],
  ],
}

let context: AudioContext | null = null

export function playSound(name: SoundName) {
  if (!getSettings().sounds) return
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    context ??= new Ctor()
    const ctx = context
    if (ctx.state === 'suspended') void ctx.resume()
    for (const [frequency, start, length] of NOTES[name]) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = name === 'wrong' ? 'triangle' : 'sine'
      osc.frequency.value = frequency
      const t = ctx.currentTime + start
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + length + 0.02)
    }
  } catch {
    // Sound is decoration; ignore any failure.
  }
}
