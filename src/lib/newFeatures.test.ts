import { describe, expect, it } from 'vitest'
import { vertexModels } from '../../api/vertex'
import { isTaskName, parseTaskOutput, userPrompt } from './ai/tasks'
import {
  buildLocalPodcastScript,
  concatenateWavBase64,
  podcastLineToCard,
  splitScriptForTts,
} from './podcastTools'
import {
  cosineSimilarity,
  expandWithClusters,
  matchQuestionToNote,
  normalizeTurkishStem,
  searchNotesSemantic,
} from './semanticSearch'
import type { ExamQuestion, Note } from './types'
import { buildConceptDiagram, renderEducationalPosterDataUrl, visualToCard } from './visualTools'

const sampleNotes: Note[] = [
  {
    id: 'note-mitokondri',
    courseId: 'course-bio',
    title: 'Hücre Organelleri ve Solunum',
    content:
      'Mitokondri çift zarlı bir yapıdır. Oksijenli solunum ile hücrenin ihtiyaç duyduğu ATP sentezini gerçekleştirir. Krista kıvrımları yüzey alanını artırır.',
    createdAt: '2026-04-10T10:00:00.000Z',
    updatedAt: '2026-04-10T10:00:00.000Z',
    generator: 'ai',
    summary: {
      overview: 'Mitokondri ve hücresel ATP üretimi incelenir.',
      points: ['Mitokondri ATP sentezler.', 'Krista zarları solunum enzimlerini taşır.'],
      keyTerms: [
        { term: 'Mitokondri', definition: 'Oksijenli solunumla ATP üreten çift zarlı yapı.' },
        { term: 'Ribozom', definition: 'Protein sentezinden sorumlu zarsız yapı.' },
      ],
      tags: ['biyoloji', 'hücre'],
    },
    questions: [],
    practice: [],
  },
  {
    id: 'note-hukuk',
    courseId: 'course-bio',
    title: 'Anayasa ve Normlar Hiyerarşisi',
    content: 'Normlar hiyerarşisinde kanunlar anayasaya aykırı olamaz. Yasama yetkisi meclise aittir.',
    createdAt: '2026-04-09T10:00:00.000Z',
    updatedAt: '2026-04-09T10:00:00.000Z',
    generator: 'ai',
    summary: {
      overview: 'Anayasa hukuku temel ilkeleri.',
      points: ['Normlar hiyerarşisi piramidi vardır.'],
      keyTerms: [{ term: 'Normlar Hiyerarşisi', definition: 'Hukuk kurallarının ast-üst sıralaması.' }],
      tags: ['hukuk'],
    },
    questions: [],
    practice: [],
  },
]

describe('semanticSearch (Anlamsal Arama & Soru-Not Eşleştirmesi)', () => {
  it('normalizes Turkish suffixes and expands academic concept clusters', () => {
    expect(normalizeTurkishStem('organellerinden')).toBe('organel')
    const expanded = expandWithClusters('enerji üreten organel')
    expect(expanded.has(normalizeTurkishStem('mitokondri'))).toBe(true)
    expect(expanded.has('atp')).toBe(true)
  })

  it('finds the mitochondria note when searching "enerji üreten organel" without verbatim words', () => {
    const hits = searchNotesSemantic(sampleNotes, 'enerji üreten organel', '')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].note.id).toBe('note-mitokondri')
    expect(hits[0].matchType).toBe('semantic')
    expect((hits[0].snippet ?? '').toLowerCase()).toContain('mitokondri')
  })

  it('ranks notes using Gemini embedding cosine similarity when vectors are present', () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1)
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0)

    const hits = searchNotesSemantic(sampleNotes, 'yasama meclis kuralları', '', {
      queryVector: [0.1, 0.95, 0.05],
      noteVectors: {
        'note-mitokondri': [0.95, 0.05, 0.02],
        'note-hukuk': [0.12, 0.94, 0.04],
      },
    })
    expect(hits[0].note.id).toBe('note-hukuk')
  })

  it('matches an exam question to the answering note even without a verbatim source quote', () => {
    const question: ExamQuestion = {
      id: 'q-1',
      type: 'mcq',
      prompt: 'Hücrede enerji üretimi ve oksijenli solunum hangi yapıda gerçekleşir?',
      options: ['Ribozom', 'Mitokondri', 'Lizozom', 'Golgi'],
      answerIndex: 1,
      explanation: 'ATP sentezi burada yapılır.',
      modelAnswer: '',
      source: '',
      noteTitle: '',
    }
    const match = matchQuestionToNote(question, sampleNotes)
    expect(match).not.toBeNull()
    expect(match?.note.id).toBe('note-mitokondri')
    expect(match?.snippet.length).toBeGreaterThan(10)
  })
})

describe('podcastTools (İki Kişilik Podcast & TTS WAV birleştirme)', () => {
  it('builds a two-speaker Deniz & Mert study podcast from a note', () => {
    const script = buildLocalPodcastScript(sampleNotes[0])
    expect(script.title).toContain('Hücre Organelleri')
    expect(script.lines.length).toBeGreaterThanOrEqual(4)
    const speakers = new Set(script.lines.map((l) => l.speaker))
    expect(speakers.has('Deniz')).toBe(true)
    expect(speakers.has('Mert')).toBe(true)

    const card = podcastLineToCard(script.lines[2], script.lines[1], 'course-bio', sampleNotes[0].id)
    expect(card.front).toBe(script.lines[1].text)
    expect(card.back).toBe(script.lines[2].text)
  })

  it('splits dialogue for TTS and concatenates WAV base64 chunks cleanly', () => {
    const script = buildLocalPodcastScript(sampleNotes[0])
    const chunks = splitScriptForTts(script.lines, 180)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
    expect(chunks[0][0].speaker).toBe('Deniz')

    // Create two tiny valid 44-byte header + 4-byte PCM WAV buffers
    function makeTinyWav(pcmBytes: number[]): string {
      const buf = new Uint8Array(44 + pcmBytes.length)
      const view = new DataView(buf.buffer)
      view.setUint32(0, 0x52494646, false) // RIFF
      view.setUint32(4, 36 + pcmBytes.length, true)
      view.setUint32(8, 0x57415645, false) // WAVE
      view.setUint32(40, pcmBytes.length, true)
      pcmBytes.forEach((b, i) => {
        buf[44 + i] = b
      })
      let bin = ''
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i])
      return btoa(bin)
    }

    const wav1 = makeTinyWav([1, 2, 3, 4])
    const wav2 = makeTinyWav([5, 6, 7, 8])
    const mergedB64 = concatenateWavBase64([wav1, wav2])
    const mergedBin = atob(mergedB64)
    expect(mergedBin.length).toBe(44 + 8)
  })
})

describe('visualTools (Kavram Haritası & Fosforlu Poster)', () => {
  it('builds an interactive concept diagram and SVG poster data URL', () => {
    const diagram = buildConceptDiagram(sampleNotes[0])
    expect(diagram.nodes.length).toBeGreaterThanOrEqual(3)
    expect(diagram.centralTopic).toContain('Hücre Organelleri')

    const dataUrl = renderEducationalPosterDataUrl(
      'Mitokondri',
      'Hücresel Enerji Santrali',
      [
        { key: 'Yapı', meaning: 'Çift zarlı organel' },
        { key: 'Krista', meaning: 'Solunum enzimlerini taşıyan iç zar kıvrımı' },
        { key: 'Görev', meaning: 'Oksijenli solunum ile ATP sentezi' },
      ],
      'Hücre Organelleri',
    )
    expect(dataUrl.startsWith('data:image/svg+xml;utf8,')).toBe(true)

    const card = visualToCard(
      {
        title: 'Mitokondri Şeması',
        caption: 'Çift zarlı ATP üretim merkezi',
      },
      'course-bio',
      sampleNotes[0].id,
    )
    expect(card.front).toContain('Mitokondri Şeması')
    expect(card.back).toContain('ATP')
  })
})

describe('AI tasks & Vertex model routing for podcast, tts, image, embed', () => {
  it('registers podcast, tts, image, and embed tasks and validates schemas', () => {
    expect(isTaskName('podcast')).toBe(true)
    expect(isTaskName('tts')).toBe(true)
    expect(isTaskName('image')).toBe(true)
    expect(isTaskName('embed')).toBe(true)

    expect(userPrompt('tts', { lines: [{ speaker: 'Deniz', text: 'Merhaba' }, { speaker: 'Mert', text: 'Selam' }] })).toContain('<tts_dialogue>')
    expect(userPrompt('image', { topic: 'Mitokondri şeması', title: 'Biyoloji', context: 'ATP üretimi', aspectRatio: '16:9' })).toContain('<image_prompt aspect="16:9">')
    expect(userPrompt('embed', { texts: ['Mitokondri ATP üretir'] })).toContain('<embed_texts>')

    const parsedTts = parseTaskOutput('tts', JSON.stringify({ audioBase64: 'AAAA', mimeType: 'audio/wav' }))
    expect(parsedTts).not.toBeNull()
    expect(parsedTts?.mimeType).toBe('audio/wav')

    const parsedEmbed = parseTaskOutput('embed', JSON.stringify({ embeddings: [[0.1, 0.2, 0.3]] }))
    expect(parsedEmbed).not.toBeNull()
    expect(parsedEmbed?.embeddings[0]).toEqual([0.1, 0.2, 0.3])
  })

  it('routes tts, image, and embed to the dedicated Gemini 3.8 / 3.1 / Embedding models on Vertex', () => {
    expect(vertexModels({}, 'tts')).toEqual(['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'])
    expect(vertexModels({}, 'image')).toEqual(['gemini-3.1-flash-lite-image', 'gemini-nano-banana-2.1'])
    expect(vertexModels({}, 'embed')).toEqual(['gemini-embedding-001'])
  })
})

describe('meaning-based search calibration', () => {
  it('keeps vectors short and scores only related notes', async () => {
    const { compactVector, vectorMatchScore, rankNotesByMeaning, EMBED_DIMS } = await import('./semanticSearch')
    expect(compactVector(Array.from({ length: 3072 }, () => 0.123456789))).toHaveLength(EMBED_DIMS)
    expect(compactVector([0.123456789])[0]).toBe(0.12346)
    // Measured: related notes 0.76-0.83, unrelated 0.64-0.72.
    expect(vectorMatchScore(0.7)).toBe(0)
    expect(vectorMatchScore(0.8)).toBeGreaterThan(0.6)
    const mk = (id: string, title: string) => ({ ...sampleNotes[0], id, title, content: title })
    const notes = [mk('a', 'Solunum'), mk('b', 'Osmanlı'), mk('c', 'Fotosentez')]
    const q = [1, 0]
    const vectors = { a: [0.8, Math.sqrt(1 - 0.64)], b: [0.7, Math.sqrt(1 - 0.49)], c: [0.78, Math.sqrt(1 - 0.78 * 0.78)] }
    expect(rankNotesByMeaning(notes, vectors, 'enerji', q).map((h) => h.note.id)).toEqual(['a', 'c'])
    // Nothing related: nothing shown.
    expect(rankNotesByMeaning(notes, { a: [0.7, 0.71] }, 'yapay zekâ', q)).toEqual([])
    // A word in the note always counts.
    expect(rankNotesByMeaning(notes, {}, 'osmanlı', null).map((h) => h.note.id)).toEqual(['b'])
  })
})
