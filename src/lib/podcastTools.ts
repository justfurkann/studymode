import type { Card, Note } from './types'

export type PodcastSpeaker = 'Deniz' | 'Mert'

export interface PodcastLine {
  id: string
  speaker: PodcastSpeaker
  role: 'host' | 'student'
  text: string
  highlight: string
}

export interface PodcastScript {
  title: string
  summary: string
  lines: PodcastLine[]
  durationEstimateSec: number
  source: 'ai' | 'local'
}

/**
 * Builds an engaging 2-speaker study podcast script from a note without requiring network calls,
 * so the Podcast tab always opens with a ready-to-play conversation between Deniz (Asistan) and Mert (Öğrenci).
 */
export function buildLocalPodcastScript(note: Note): PodcastScript {
  const title = note.title.trim() || 'Ders Notu'
  const overview =
    note.summary?.overview?.trim() ||
    note.content
      .split(/\n+/)
      .map((s) => s.trim())
      .find((s) => s.length > 30) ||
    `${title} konusunun temel kavramlarını inceliyoruz.`

  const keyTerms = note.summary?.keyTerms ?? []
  const points = note.summary?.points ?? []
  const lines: PodcastLine[] = []

  const push = (speaker: PodcastSpeaker, text: string, highlight = '') => {
    const cleaned = text.replace(/\s+/g, ' ').trim()
    if (!cleaned) return
    lines.push({
      id: `line-${lines.length + 1}`,
      speaker,
      role: speaker === 'Deniz' ? 'host' : 'student',
      text: cleaned,
      highlight: highlight.trim(),
    })
  }

  push(
    'Deniz',
    `Selam Mert! Bugün seninle "${title}" notunun sınavda en çok işine yarayacak noktalarını hızlıca konuşacağız. Hazır mısın?`,
    title,
  )
  push(
    'Mert',
    `Selam Deniz! Tam da bu konuyu tekrar ediyordum. Genel çerçeveyi tek cümlede nasıl özetleriz?`,
  )
  push('Deniz', overview, keyTerms[0]?.term ?? '')

  // Cover up to 4 key terms in conversational back-and-forth
  const selectedTerms = keyTerms.slice(0, 4)
  selectedTerms.forEach((item, idx) => {
    if (idx === 0) {
      push(
        'Mert',
        `Peki burada ilk karşımıza çıkan "${item.term}" kavramını sınavda görsek nasıl hatırlayalım?`,
        item.term,
      )
      push('Deniz', `${item.term} kısaca şu: ${item.definition}`, item.term)
    } else if (idx === 1) {
      push(
        'Mert',
        `Anladım. Bir de notta "${item.term}" geçiyor, onu diğerlerinden ayıran özellik ne?`,
        item.term,
      )
      push(
        'Deniz',
        `Çok iyi soru! ${item.term} için şunu aklında tut: ${item.definition}`,
        item.term,
      )
    } else {
      push(
        'Mert',
        `Süper. Peki "${item.term}" hakkında ne bilmemiz şart?`,
        item.term,
      )
      push('Deniz', `${item.term}: ${item.definition}`, item.term)
    }
  })

  // Cover 2 main points not already identical
  const extraPoints = points.slice(0, 2)
  extraPoints.forEach((pt, idx) => {
    push(
      'Mert',
      idx === 0
        ? 'Hocalar test veya klasik soruda başka hangi detayı yoklamayı sever?'
        : 'Son olarak gözden kaçırmamamız gereken kritik bir nokta var mı?',
    )
    push('Deniz', pt)
  })

  if (note.questions.length > 0) {
    const q = note.questions[0]
    const answer = q.options[q.answerIndex] ?? ''
    if (answer) {
      push(
        'Mert',
        `Hemen kendimi deneyeyim: "${q.prompt}" diye sorulursa cevabımız "${answer}" oluyor değil mi?`,
        answer,
      )
      push(
        'Deniz',
        `Tam isabet! ${q.explanation || `Doğru cevap ${answer}.`} Bu özeti dinledikten sonra hemen Test sekmesinden kendini sınayabilirsin.`,
        answer,
      )
    }
  } else {
    push(
      'Mert',
      'Harika bir özet oldu Deniz, şimdi kartlara ve teste geçip pekiştirebilirim!',
    )
    push(
      'Deniz',
      'Aynen öyle! Kısa bir test çözüp yanlışlarını karta çevirirsen bu konu sınavda garanti.',
    )
  }

  const totalWords = lines.reduce((sum, l) => sum + l.text.split(/\s+/).length, 0)
  const durationEstimateSec = Math.max(30, Math.round((totalWords / 135) * 60))

  return {
    title: `${title} · Sesli Özeti`,
    summary: overview,
    lines,
    durationEstimateSec,
    source: 'local',
  }
}

/**
 * Splits podcast lines into chunks of at most `maxChars` so each Gemini TTS request finishes
 * quickly and returns a WAV well below Vercel's 4.5 MB response limit.
 */
export function splitScriptForTts(lines: PodcastLine[], maxChars = 1200): PodcastLine[][] {
  const chunks: PodcastLine[][] = []
  let current: PodcastLine[] = []
  let currentLen = 0

  for (const line of lines) {
    const lineLen = line.speaker.length + 2 + line.text.length
    if (current.length > 0 && currentLen + lineLen > maxChars) {
      chunks.push(current)
      current = [line]
      currentLen = lineLen
    } else {
      current.push(line)
      currentLen += lineLen
    }
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '')
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'))
  }
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let bin = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(bin)
}

/**
 * Concatenates multiple unary WAV Base64 clips from `gemini-3.8-flash-tts` into a single valid WAV file.
 * Strips the 44-byte RIFF WAV header from every clip after the first and updates the RIFF size headers.
 */
export function concatenateWavBase64(wavBase64Chunks: string[]): string {
  const valid = wavBase64Chunks.map((c) => c.trim()).filter(Boolean)
  if (valid.length === 0) return ''
  if (valid.length === 1) return valid[0]

  const decoded = valid.map(base64ToBytes).filter((b) => b.length > 44)
  if (decoded.length === 0) return valid[0]

  const header = decoded[0].slice(0, 44)
  const pcmParts = decoded.map((b) => b.slice(44))
  const totalPcmBytes = pcmParts.reduce((sum, p) => sum + p.length, 0)

  const combined = new Uint8Array(44 + totalPcmBytes)
  combined.set(header, 0)
  let offset = 44
  for (const part of pcmParts) {
    combined.set(part, offset)
    offset += part.length
  }

  // Update RIFF ChunkSize (bytes 4..7, little-endian: 36 + Subchunk2Size) and Subchunk2Size (bytes 40..43)
  const view = new DataView(combined.buffer, combined.byteOffset, combined.byteLength)
  // Check "RIFF" magic header
  if (combined[0] === 0x52 && combined[1] === 0x49 && combined[2] === 0x46 && combined[3] === 0x46) {
    view.setUint32(4, 36 + totalPcmBytes, true)
    view.setUint32(40, totalPcmBytes, true)
  }

  return bytesToBase64(combined)
}

/** Turns a podcast dialogue exchange into a spaced-repetition flashcard. */
export function podcastLineToCard(
  line: PodcastLine,
  prevLine: PodcastLine | undefined,
  courseId: string,
  noteId: string,
): Omit<Card, 'id' | 'due' | 'interval' | 'ease' | 'reps' | 'lapses' | 'createdAt' | 'updatedAt'> {
  const front =
    prevLine && prevLine.speaker === 'Mert'
      ? prevLine.text
      : line.highlight
        ? `“${line.highlight}” kavramının temel özelliği nedir?`
        : 'Podcast özetindeki bu kritik bilgi nedir?'
  return {
    courseId,
    noteId,
    front,
    back: line.text,
    source: line.highlight || null,
  }
}

/**
 * Which line is being spoken at a point of the recording (0..1), weighting lines by their length.
 * The studio audio has no per-line timestamps; longer lines take longer to say, so this is close.
 */
export function lineAtFraction(lines: Pick<PodcastLine, 'text'>[], fraction: number): number {
  if (!lines.length) return 0
  const weights = lines.map((l) => Math.max(1, l.text.length))
  const total = weights.reduce((s, w) => s + w, 0)
  const target = Math.max(0, Math.min(1, fraction)) * total
  let sum = 0
  for (let i = 0; i < weights.length; i++) {
    sum += weights[i]
    if (target < sum) return i
  }
  return lines.length - 1
}

/** The first line of each studio-voice part (the same split synthesizePodcastTts uses). */
export function partStartLines(lines: PodcastLine[], maxChars = 600): number[] {
  const starts: number[] = []
  let at = 0
  for (const part of splitScriptForTts(lines, maxChars)) {
    starts.push(at)
    at += part.length
  }
  return starts
}
