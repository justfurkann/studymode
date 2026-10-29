import { describe, expect, it } from 'vitest'
import { generateStudySet } from './study'

const NOTES = `# Öğrenme ve bellek
Aktif hatırlama: Bilgiyi bir kaynağa bakmadan zihinden geri çağırma çalışmasıdır.
Aralıklı tekrar: Öğrenilen bilgiyi giderek uzayan zaman aralıklarıyla yeniden gözden geçirmektir.
Çalışma belleği: Bilgilerin kısa süreli olarak tutulup zihinsel işlemlerde kullanıldığı sistemdir.
Uzun süreli bellek: Öğrenilen bilgi ve deneyimlerin daha uzun süre saklandığı bellek sistemidir.
Aktif hatırlama sırasında öğrenci, ders notlarını kapatıp konuyu kendi cümleleriyle açıklamaya çalışır.
Aralıklı tekrar oturumları, tek bir uzun çalışma oturumu yerine farklı günlere dağıtılabilir.
Çalışma belleği aynı anda sınırlı miktarda bilgiyle işlem yapar. Bu nedenle karmaşık konuları küçük parçalara ayırmak öğrenmeyi destekleyebilir.`

describe('generateStudySet', () => {
  it('rejects empty, whitespace-only and very short notes with an actionable message', () => {
    for (const input of ['', '   \n   ', 'Yarın sınav var.']) {
      expect(() => generateStudySet(input)).toThrow(/en az 120 karakter/)
    }
  })

  it('rejects oversized notes rather than silently discarding source material', () => {
    expect(() => generateStudySet('Bellek bilgiyi saklar. '.repeat(20_000))).toThrow(/400.000/)
  })

  it('rejects lists of headings without explanatory sentences', () => {
    expect(() => generateStudySet('Bellek\nDikkat\nÖğrenme\n'.repeat(20))).toThrow(/açıklayıcı cümleler/)
  })

  it('creates a full study set from Turkish academic notes', () => {
    const set = generateStudySet(NOTES)
    expect(set.summary.length).toBeGreaterThanOrEqual(3)
    expect(set.summary.length).toBeLessThanOrEqual(5)
    expect(set.keywords).toContain('aktif hatırlama')
    expect(set.quiz.length).toBeGreaterThanOrEqual(3)
    expect(set.cards.length).toBeGreaterThanOrEqual(4)
    expect(set.practice).toHaveLength(3)
    expect(set.practice.every((task) => task.checklist.length >= 3)).toBe(true)
  })

  it('uses original source passages for summaries and flashcard answers', () => {
    const set = generateStudySet(NOTES)
    for (const excerpt of set.summary) {
      expect(NOTES).toContain(excerpt)
    }
    for (const card of set.cards) {
      expect(NOTES).toContain(card.back)
    }
    expect(set.cards.find((card) => card.front.includes('Aktif hatırlama'))?.back)
      .toBe('Bilgiyi bir kaynağa bakmadan zihinden geri çağırma çalışmasıdır.')
  })

  it('gives unique options, a valid correct answer and supporting source for each quiz question', () => {
    const set = generateStudySet(NOTES)
    for (const question of set.quiz) {
      expect(question.options.length).toBeGreaterThanOrEqual(3)
      expect(new Set(question.options.map((option) => option.toLocaleLowerCase('tr-TR'))).size)
        .toBe(question.options.length)
      expect(question.answerIndex).toBeGreaterThanOrEqual(0)
      expect(question.answerIndex).toBeLessThan(question.options.length)
      expect(question.explanation.toLocaleLowerCase('tr-TR'))
        .toContain(question.options[question.answerIndex].toLocaleLowerCase('tr-TR'))
      const source = question.explanation.replace(/^Notundaki (?:açıklama|cümle): /u, '')
      expect(NOTES).toContain(source)
      if (question.prompt.includes('bu açıklama')) {
        expect(question.prompt.toLocaleLowerCase('tr-TR'))
          .not.toContain(question.options[question.answerIndex].toLocaleLowerCase('tr-TR'))
      }
    }
  })

  it('produces deterministic results for repeated generation', () => {
    expect(generateStudySet(NOTES)).toEqual(generateStudySet(NOTES))
  })

  it('supports prose without colon-separated definitions', () => {
    const prose = 'Hücre zarı, hücreyi dış ortamdan ayırır ve madde geçişini düzenler. Mitokondri, hücrede enerji üretiminde görev alan bir organeldir. Ribozomlar, protein sentezinin gerçekleştiği yapılardır. Çekirdek, genetik bilginin korunmasında ve hücresel faaliyetlerin düzenlenmesinde görev alır.'
    const set = generateStudySet(prose)
    expect(set.summary.length).toBeGreaterThanOrEqual(3)
    expect(set.quiz.length).toBeGreaterThan(0)
    expect(set.cards.length).toBeGreaterThan(0)
    expect(set.quiz.some((question) => question.prompt.includes('_____'))).toBe(true)
    for (const question of set.quiz) {
      expect(prose).toContain(question.explanation.replace('Notundaki cümle: ', ''))
    }
  })

  it('does not invent distractors when a source has no safe alternatives', () => {
    const set = generateStudySet('Bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek bellek.')
    expect(set.quiz).toEqual([])
    expect(set.summary).toHaveLength(1)
    expect(set.practice).toHaveLength(2)
  })

  it('handles Markdown bullets, Windows line endings and Turkish casing', () => {
    const formatted = NOTES.replaceAll('\n', '\r\n- ').replace('Aktif hatırlama:', '**Aktif hatırlama**:')
    const set = generateStudySet(formatted)
    expect(set.keywords).toContain('aktif hatırlama')
    expect(set.summary.every((line) => !line.startsWith('- ') && !line.includes('**'))).toBe(true)
    expect(new Set(set.keywords).size).toBe(set.keywords.length)
  })
})
