/*
 * Plays a podcast that arrives in parts: the first part starts as soon as it is ready, the next ones
 * follow in order, and when the player gets ahead of the recording it waits and continues as the
 * next part comes in. One audio element throughout, so a phone that allowed it once keeps allowing it.
 */

export interface AudioLike {
  src: string
  playbackRate: number
  paused: boolean
  play(): Promise<void>
  pause(): void
  onended: ((event: Event) => unknown) | null
}

export interface PartPlayerState {
  /** Part being played (or waited for), 0-based. */
  index: number
  ready: number
  total: number
  playing: boolean
  /** The browser refused to start on its own: show a "Çal" button. */
  blocked: boolean
  /** Played to the end of the last part. */
  finished: boolean
}

/** A tiny silent WAV: played inside the tap so phones let the same element play later. */
export function silentWav(): string {
  const samples = 800
  const bytes = new Uint8Array(44 + samples * 2)
  const view = new DataView(bytes.buffer)
  const text = (offset: number, s: string) => [...s].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true)
  text(8, 'WAVE')
  text(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, 8000, true)
  view.setUint32(28, 16000, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, samples * 2, true)
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return `data:audio/wav;base64,${btoa(binary)}`
}

export class PartPlayer {
  private parts: string[] = []
  private index = 0
  private idle = true
  private state: PartPlayerState
  private stopped = false
  /** The silent unlock sound is playing: its end is not the end of a part. */
  private unlocking = false

  constructor(
    private audio: AudioLike,
    total: number,
    private onChange: (state: PartPlayerState) => void,
    rate = 1,
  ) {
    this.state = { index: 0, ready: 0, total, playing: false, blocked: false, finished: false }
    audio.playbackRate = rate
    audio.onended = () => this.next()
  }

  /** Call inside the tap: unlocks the element on phones. */
  unlock() {
    this.unlocking = true
    this.audio.src = silentWav()
    void this.audio.play().catch(() => undefined)
  }

  setTotal(total: number) {
    this.update({ total })
  }

  setRate(rate: number) {
    this.audio.playbackRate = rate
  }

  addPart(url: string) {
    if (this.stopped) return
    this.parts.push(url)
    this.update({ ready: this.parts.length })
    if (this.idle && this.parts[this.index]) this.playAt(this.index)
  }

  /** "Çal" after a refusal, or resume after a pause. */
  resume() {
    if (this.state.finished) {
      this.update({ finished: false })
      this.playAt(0)
    } else if (this.audio.src && !this.idle && this.audio.paused && !this.state.blocked) {
      void this.audio.play().then(() => this.update({ playing: true }))
    } else if (this.parts[this.index]) this.playAt(this.index)
  }

  pause() {
    this.audio.pause()
    this.update({ playing: false })
  }

  toggle() {
    if (this.state.playing) this.pause()
    else this.resume()
  }

  stop() {
    this.stopped = true
    this.audio.pause()
    this.audio.onended = null
  }

  get current(): PartPlayerState {
    return this.state
  }

  private playAt(i: number) {
    this.unlocking = false
    this.index = i
    this.idle = false
    this.audio.src = this.parts[i]
    this.update({ index: i, playing: true, blocked: false })
    this.audio.play().catch(() => {
      this.idle = true
      this.update({ playing: false, blocked: true })
    })
  }

  private next() {
    if (this.unlocking) {
      this.unlocking = false
      return
    }
    const nextIndex = this.index + 1
    if (nextIndex < this.parts.length) this.playAt(nextIndex)
    else if (nextIndex < this.state.total) {
      // Ahead of the recording: wait for the next part.
      this.index = nextIndex
      this.idle = true
      this.update({ index: nextIndex, playing: false })
    } else {
      this.idle = true
      this.index = 0
      this.update({ playing: false, finished: true })
    }
  }

  private update(patch: Partial<PartPlayerState>) {
    this.state = { ...this.state, ...patch }
    this.onChange(this.state)
  }
}
