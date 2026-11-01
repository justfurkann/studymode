import { useSyncExternalStore } from 'react'

/*
 * "Gece kütüphanesi": background sounds to study with, so nobody needs a rain video in another tab.
 * Every sound is synthesized here from noise (no audio files to download, nothing to license):
 * rain on the window, a quiet café murmur, a crackling fireplace and brown noise for focus.
 * Each one is rendered once into a looping buffer, then mixed with its own volume.
 *
 * The sound keeps playing while the student moves between pages (the engine lives outside React).
 * Volumes are remembered; playback never starts on its own (browsers forbid sound without a tap).
 */

export type Channel = 'yagmur' | 'kafe' | 'somine' | 'kahverengi'

export const CHANNELS: Array<{ id: Channel; label: string; hint: string }> = [
  { id: 'yagmur', label: 'Yağmur', hint: 'Cama vuran yağmur' },
  { id: 'kafe', label: 'Kafe', hint: 'Uzaktan uğultu, fincan sesi' },
  { id: 'somine', label: 'Şömine', hint: 'Çıtırdayan odun' },
  { id: 'kahverengi', label: 'Odak', hint: 'Kahverengi gürültü' },
]

export type Volumes = Record<Channel, number>
export const DEFAULT_VOLUMES: Volumes = { yagmur: 0.6, kafe: 0, somine: 0, kahverengi: 0 }
const KEY = 'studymode.ambience.v1'
/** Length of each loop. Long enough that the ear does not catch the repeat. */
const LOOP_SECONDS = 12
const FADE_SECONDS = 0.6

export type Rng = () => number

/** Small seeded generator, so buffers are reproducible in tests. */
export function seededRng(seed = 1): Rng {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Scales the samples so the loudest one sits at `peak`. */
function normalize(data: Float32Array, peak: number) {
  let max = 0
  for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]))
  if (max > 0) for (let i = 0; i < data.length; i++) data[i] = (data[i] / max) * peak
}

/** Blends the tail into the head, so the loop point has no click. */
function seamless(data: Float32Array, rate: number): Float32Array {
  const fade = Math.min(Math.floor(rate * FADE_SECONDS), Math.floor(data.length / 4))
  const out = data.slice(0, data.length - fade)
  for (let i = 0; i < fade; i++) {
    const w = i / fade
    out[i] = data[i] * w + data[data.length - fade + i] * (1 - w)
  }
  return out
}

function brown(length: number, rng: Rng): Float32Array {
  const data = new Float32Array(length)
  let last = 0
  for (let i = 0; i < length; i++) {
    last = (last + 0.02 * (rng() * 2 - 1)) / 1.02
    data[i] = last
  }
  return data
}

/** One-pole low-pass, in place. */
function lowpass(data: Float32Array, cutoff: number, rate: number) {
  const a = Math.exp((-2 * Math.PI * cutoff) / rate)
  let y = 0
  for (let i = 0; i < data.length; i++) {
    y = (1 - a) * data[i] + a * y
    data[i] = y
  }
}

/** One-pole high-pass, in place. */
function highpass(data: Float32Array, cutoff: number, rate: number) {
  const a = Math.exp((-2 * Math.PI * cutoff) / rate)
  let y = 0
  let prev = 0
  for (let i = 0; i < data.length; i++) {
    y = a * (y + data[i] - prev)
    prev = data[i]
    data[i] = y
  }
}

/** Adds a short decaying burst of noise (a drop, a crackle) at `at`. */
function burst(data: Float32Array, at: number, length: number, level: number, rng: Rng) {
  for (let i = 0; i < length && at + i < data.length; i++) {
    data[at + i] += (rng() * 2 - 1) * level * Math.exp((-6 * i) / length)
  }
}

export function renderChannel(channel: Channel, rate: number, rng: Rng = Math.random, seconds = LOOP_SECONDS): Float32Array {
  const n = Math.floor(rate * (seconds + FADE_SECONDS))
  let data: Float32Array
  if (channel === 'kahverengi') {
    data = brown(n, rng)
    normalize(data, 0.5)
  } else if (channel === 'yagmur') {
    // A steady hiss with a slow swell, plus many small drops hitting the glass.
    data = new Float32Array(n)
    for (let i = 0; i < n; i++) data[i] = rng() * 2 - 1
    lowpass(data, 5200, rate)
    highpass(data, 450, rate)
    for (let i = 0; i < n; i++) data[i] *= 0.55 + 0.15 * Math.sin((2 * Math.PI * i) / (rate * 4.3))
    const drops = Math.floor(seconds * 70)
    for (let d = 0; d < drops; d++) burst(data, Math.floor(rng() * n), Math.floor(rate * (0.002 + rng() * 0.006)), 0.6 + rng() * 1.4, rng)
    normalize(data, 0.45)
  } else if (channel === 'somine') {
    // Low rumble of the fire, sparse crackles and a few bigger pops.
    data = brown(n, rng)
    normalize(data, 0.35)
    const crackles = new Float32Array(n)
    const count = Math.floor(seconds * 9)
    for (let c = 0; c < count; c++) burst(crackles, Math.floor(rng() * n), Math.floor(rate * (0.001 + rng() * 0.004)), rng() < 0.1 ? 2.5 : 0.4 + rng(), rng)
    highpass(crackles, 1500, rate)
    for (let i = 0; i < n; i++) data[i] += crackles[i]
    normalize(data, 0.5)
  } else {
    // Café: several voices as band-limited noise that rises and falls like speech, far away,
    // and now and then a cup touching a saucer.
    data = new Float32Array(n)
    const voice = new Float32Array(n)
    for (let v = 0; v < 5; v++) {
      for (let i = 0; i < n; i++) voice[i] = rng() * 2 - 1
      const low = 280 + rng() * 300
      lowpass(voice, low + 600, rate)
      highpass(voice, low, rate)
      const speed = 2.5 + rng() * 3
      const phase = rng() * Math.PI * 2
      const pause = 0.15 + rng() * 0.2
      for (let i = 0; i < n; i++) {
        const t = i / rate
        const syllable = Math.max(0, Math.sin(2 * Math.PI * speed * t + phase))
        const sentence = Math.max(0, Math.sin(2 * Math.PI * pause * t + phase * 2))
        data[i] += voice[i] * syllable * sentence
      }
    }
    const clinks = Math.floor(seconds / 4)
    for (let c = 0; c < clinks; c++) {
      const at = Math.floor(rng() * (n - rate))
      const pitch = 2600 + rng() * 1400
      const level = 0.25 + rng() * 0.25
      for (let i = 0; i < rate * 0.4; i++) data[at + i] += Math.sin((2 * Math.PI * pitch * i) / rate) * level * Math.exp((-9 * i) / rate)
    }
    normalize(data, 0.4)
  }
  return seamless(data, rate)
}

// ---------- State (shared by every player on the page) ----------

export interface AmbienceState {
  playing: boolean
  volumes: Volumes
}

function readVolumes(): Volumes {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Volumes> | null
    if (!parsed) return DEFAULT_VOLUMES
    const out = { ...DEFAULT_VOLUMES }
    for (const { id } of CHANNELS) {
      const v = Number(parsed[id])
      if (Number.isFinite(v)) out[id] = Math.min(1, Math.max(0, v))
    }
    return out
  } catch {
    return DEFAULT_VOLUMES
  }
}

let state: AmbienceState = { playing: false, volumes: typeof window === 'undefined' ? DEFAULT_VOLUMES : readVolumes() }
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function useAmbience(): AmbienceState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

// ---------- Audio graph ----------

let ctx: AudioContext | null = null
let master: GainNode | null = null
const gains = new Map<Channel, GainNode>()
const sources = new Map<Channel, AudioBufferSourceNode>()

function context(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)
  }
  return ctx
}

/** Perceived loudness grows faster than the slider; squaring feels even. */
const level = (v: number) => v * v * 0.9

/** Renders a channel the first time it is needed (a few tens of ms), then loops it forever. */
function ensureChannel(audio: AudioContext, channel: Channel) {
  if (sources.has(channel) || !master) return
  // 24 kHz is plenty for these sounds (nothing above 12 kHz) and halves the work on phones.
  const rate = Math.min(audio.sampleRate, 24000)
  const data = renderChannel(channel, rate)
  const buffer = audio.createBuffer(1, data.length, rate)
  buffer.getChannelData(0).set(data)
  const gain = audio.createGain()
  gain.gain.value = level(state.volumes[channel])
  gain.connect(master)
  const source = audio.createBufferSource()
  source.buffer = buffer
  source.loop = true
  source.connect(gain)
  source.start(0, Math.random() * LOOP_SECONDS)
  gains.set(channel, gain)
  sources.set(channel, source)
}

function setState(next: AmbienceState) {
  state = next
  emit()
}

export function setVolume(channel: Channel, value: number) {
  const volumes = { ...state.volumes, [channel]: Math.min(1, Math.max(0, value)) }
  try {
    localStorage.setItem(KEY, JSON.stringify(volumes))
  } catch {
    // Blocked storage: the mix lasts for this visit.
  }
  setState({ ...state, volumes })
  if (!ctx || !state.playing) return
  if (volumes[channel] > 0) ensureChannel(ctx, channel)
  gains.get(channel)?.gain.setTargetAtTime(level(volumes[channel]), ctx.currentTime, 0.08)
}

/** Must be called from a tap or click (browser autoplay rules). */
export function play() {
  try {
    const audio = context()
    if (!audio || !master) return
    void audio.resume()
    // Nothing turned up yet: start with rain, the classic.
    if (!CHANNELS.some(({ id }) => state.volumes[id] > 0)) setVolume('yagmur', DEFAULT_VOLUMES.yagmur)
    for (const { id } of CHANNELS) if (state.volumes[id] > 0) ensureChannel(audio, id)
    master.gain.setTargetAtTime(1, audio.currentTime, 0.3)
    setState({ ...state, playing: true })
  } catch {
    // No Web Audio: the player simply stays off.
  }
}

export function pause() {
  if (ctx && master) {
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.15)
    const audio = ctx
    window.setTimeout(() => {
      if (!state.playing) void audio.suspend()
    }, 900)
  }
  setState({ ...state, playing: false })
}

export function toggle() {
  if (state.playing) pause()
  else play()
}
