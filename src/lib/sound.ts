import { getDecor } from './decor'
import { getSettings } from './settings'

/*
 * Tiny synthesized sounds (no audio files). They only play when the student turned them on in
 * Settings, and never throw: a browser without Web Audio simply stays silent.
 *
 * Two styles: short beeps ("Küçük sesler"), or stationery sounds ("Kırtasiye sesleri": paper
 * rustle, a highlighter stroke, a pencil tap), made from filtered noise.
 */

export type SoundName = 'right' | 'wrong' | 'done' | 'flip'

const NOTES: Record<Exclude<SoundName, 'flip'>, Array<[frequency: number, startS: number, lengthS: number]>> = {
  right: [[880, 0, 0.09]],
  wrong: [[220, 0, 0.14]],
  done: [
    [660, 0, 0.1],
    [880, 0.1, 0.1],
    [1320, 0.2, 0.18],
  ],
}

/** One burst of filtered noise: filter sweep from `from` to `to` Hz, loudness envelope as [time, level] points. */
interface Burst {
  start: number
  length: number
  type: BiquadFilterType
  from: number
  to: number
  q: number
  envelope: Array<[number, number]>
}

const STATIONERY: Record<SoundName, Burst[]> = {
  // A highlighter dragged across paper: "şşşt".
  right: [{ start: 0, length: 0.32, type: 'bandpass', from: 4200, to: 6800, q: 1.2, envelope: [[0.03, 0.5], [0.24, 0.42], [0.32, 0]] }],
  // A pencil tapped twice on the desk.
  wrong: [
    { start: 0, length: 0.05, type: 'lowpass', from: 1800, to: 900, q: 1, envelope: [[0.004, 0.9], [0.05, 0]] },
    { start: 0.12, length: 0.05, type: 'lowpass', from: 1600, to: 800, q: 1, envelope: [[0.004, 0.7], [0.05, 0]] },
  ],
  // A notebook page turned.
  done: [
    { start: 0, length: 0.22, type: 'bandpass', from: 1200, to: 3800, q: 0.7, envelope: [[0.05, 0.45], [0.22, 0]] },
    { start: 0.18, length: 0.3, type: 'bandpass', from: 3800, to: 1500, q: 0.7, envelope: [[0.04, 0.55], [0.3, 0]] },
  ],
  // A card flipped over.
  flip: [
    { start: 0, length: 0.08, type: 'bandpass', from: 2400, to: 3600, q: 0.9, envelope: [[0.01, 0.5], [0.08, 0.05]] },
    { start: 0.07, length: 0.12, type: 'bandpass', from: 3600, to: 2000, q: 0.9, envelope: [[0.015, 0.35], [0.12, 0]] },
  ],
}

let context: AudioContext | null = null
let noise: AudioBuffer | null = null

function audio(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  context ??= new Ctor()
  if (context.state === 'suspended') void context.resume()
  return context
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise
  const buffer = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.6), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  noise = buffer
  return buffer
}

function playBursts(ctx: AudioContext, bursts: Burst[]) {
  for (const b of bursts) {
    const t = ctx.currentTime + b.start
    const source = ctx.createBufferSource()
    source.buffer = noiseBuffer(ctx)
    const filter = ctx.createBiquadFilter()
    filter.type = b.type
    filter.Q.value = b.q
    filter.frequency.setValueAtTime(b.from, t)
    filter.frequency.linearRampToValueAtTime(b.to, t + b.length)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    for (const [at, level] of b.envelope) gain.gain.linearRampToValueAtTime(level * 0.35, t + at)
    source.connect(filter).connect(gain).connect(ctx.destination)
    source.start(t, Math.random() * 0.2)
    source.stop(t + b.length + 0.02)
  }
}

export function playSound(name: SoundName) {
  const stationery = getDecor().asmr
  if (!stationery && (name === 'flip' || !getSettings().sounds)) return
  try {
    const ctx = audio()
    if (!ctx) return
    if (stationery) {
      playBursts(ctx, STATIONERY[name])
      return
    }
    for (const [frequency, start, length] of NOTES[name as Exclude<SoundName, 'flip'>]) {
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
