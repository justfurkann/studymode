import { describe, expect, it } from 'vitest'
import { PartPlayer, silentWav, type AudioLike, type PartPlayerState } from './partPlayer'

function fakeAudio(refuse = false) {
  const played: string[] = []
  const audio: AudioLike & { played: string[]; end: () => void } = {
    src: '',
    playbackRate: 1,
    paused: true,
    played,
    onended: null,
    play() {
      if (refuse) return Promise.reject(new Error('NotAllowed'))
      this.paused = false
      played.push(this.src)
      return Promise.resolve()
    },
    pause() {
      this.paused = true
    },
    end() {
      this.paused = true
      this.onended?.(new Event("ended"))
    },
  }
  return audio
}

const flush = () => new Promise((r) => setTimeout(r, 0))

describe('podcast parts play as they arrive', () => {
  it('starts on the first part, follows in order, waits when ahead, finishes', async () => {
    const audio = fakeAudio()
    let state: PartPlayerState | null = null
    const player = new PartPlayer(audio, 3, (s) => (state = s), 1.25)
    expect(audio.playbackRate).toBe(1.25)
    player.unlock()
    // The silent unlock ends before any part: not counted as a part.
    audio.end()
    expect(player.current).toMatchObject({ index: 0, playing: false })
    player.addPart('p1')
    expect(audio.src).toBe('p1')
    expect(state!.playing).toBe(true)
    player.addPart('p2')
    expect(audio.src).toBe('p1')
    audio.end()
    expect(audio.src).toBe('p2')
    // Ahead of the recording: waits for part 3, then plays it.
    audio.end()
    expect(state!).toMatchObject({ index: 2, playing: false, finished: false })
    player.addPart('p3')
    expect(audio.src).toBe('p3')
    audio.end()
    expect(state!).toMatchObject({ finished: true, playing: false, ready: 3 })
    await flush()
    expect(audio.played.filter((s) => s.startsWith('p'))).toEqual(['p1', 'p2', 'p3'])
  })

  it('a phone that refuses to start shows "Çal"; the tap plays the waiting part', async () => {
    const audio = fakeAudio(true)
    let state: PartPlayerState | null = null
    const player = new PartPlayer(audio, 2, (s) => (state = s))
    player.addPart('p1')
    await flush()
    expect(state!.blocked).toBe(true)
    // The tap: now allowed.
    audio.play = function () {
      this.paused = false
      return Promise.resolve()
    }
    player.resume()
    await flush()
    expect(state!).toMatchObject({ blocked: false, playing: true })
    expect(audio.src).toBe('p1')
  })

  it('the unlock sound is a valid tiny WAV', () => {
    const url = silentWav()
    expect(url.startsWith('data:audio/wav;base64,UklGR')).toBe(true)
  })
})
