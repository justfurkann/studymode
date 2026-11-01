import {
  ArrowRight,
  AudioLines,
  BookOpenText,
  Brain,
  CalendarClock,
  ClipboardList,
  Coffee,
  FilePlus2,
  Gem,
  Headphones,
  Image as ImageIcon,
  KeyRound,
  LifeBuoy,
  ListChecks,
  MessageSquareText,
  Palette,
  PlayCircle,
  ReceiptText,
  Search,
  Share2,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ZoomableImage } from '../components/ImageViewer'
import { requestTour } from '../lib/tour'

/*
 * /rehber: every feature in plain Turkish, a suggested way to study with them, and how to get the
 * most out of Premium. Short on purpose: a heading and two or three sentences each.
 */

/** Each step with a screenshot of the real screen (public/rehber, light and dark) and a way to go there. */
const FLOW: Array<{ title: string; text: string; shot: number; alt: string; to: string; link: string }> = [
  { title: 'Dersini ve sınav tarihini gir', text: 'Sınavlar sekmesinden vize ve finallerini ekle. Uygulama tekrarları ve günlük planı bu tarihlere göre ayarlar.', shot: 1, alt: 'Sınavlar ekranı: Şimdi bununla başla kartı ve takvim', to: '/sinav', link: 'Sınavlara git' },
  { title: 'Notunu ekle', text: 'PDF, Word, slayt, fotoğraf ya da düz metin. Özet, test, kartlar ve açık uçlu sorular birkaç saniyede hazırlanır.', shot: 2, alt: 'Not ekle ekranı: ders seçimi, başlık ve dosya yükleme', to: '/not-ekle', link: 'Not ekle' },
  { title: 'Özeti oku, sonra kendini test et', text: 'Önce Kavramlar ve Ana noktalar; ardından Test. Yanlışların tek dokunuşla karta dönüşür.', shot: 3, alt: 'Not sayfası: Özet, Test, Kartlar, Anlat adımları ve Tam özet kartı', to: '/dersler', link: 'Notlarıma git' },
  { title: 'Her gün Bugün ekranına bak', text: 'Tekrar bekleyen kartları çevir, "Şimdi bununla başla" önerisine uy. Günde 10-15 dakika yeter.', shot: 4, alt: 'Bugün ekranı: tekrar bekleyen kartlar ve sıradaki adım', to: '/', link: 'Bugün’e git' },
  { title: 'Sınava bir hafta kala prova yap', text: 'Sınav provası gerçek sınava benzeyen bir deneme hazırlar; klasik cevapların da puanlanır. Düşük çıkan konulara geri dön.', shot: 5, alt: 'Sınav provası ekranı: sınav, konular ve soru kaynağı seçimi', to: '/sinav', link: 'Provaya başla' },
]

/** Whether the app is showing its dark theme right now (Settings choice, or the phone's when "system"). */
function useDarkTheme(): boolean {
  const read = () => {
    const forced = document.documentElement.getAttribute('data-theme')
    return forced ? forced === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches === true
  }
  const [dark, setDark] = useState(read)
  useEffect(() => {
    const update = () => setDark(read())
    const media = window.matchMedia?.('(prefers-color-scheme: dark)')
    media?.addEventListener('change', update)
    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      media?.removeEventListener('change', update)
      observer.disconnect()
    }
  }, [])
  return dark
}

const FEATURES: Array<{ icon: LucideIcon; title: string; text: string; to?: string; link?: string }> = [
  { icon: FilePlus2, title: 'Not ekle', text: 'Birden fazla dosyayı tek seferde ekleyebilirsin; her biri ayrı not olur. Taranmış PDF ve fotoğraflardaki yazı da okunur.', to: '/not-ekle', link: 'Not ekle' },
  { icon: BookOpenText, title: 'Özet ve Tam özet', text: 'Kavramlar ve Ana noktalar adım adım; Tam özet ise her şeyi tek sayfada toplar. İstersen yapay zekâ notunu bölüm bölüm anlatan ayrıntılı bir özet yazar.' },
  { icon: ListChecks, title: 'Test', text: 'Çoktan seçmeli sorular ve açıklamaları. Bitince yanlışlarını karta çevirip tekrar sırasına alabilirsin.' },
  { icon: Brain, title: 'Kartlar ve aralıklı tekrar', text: 'Bir kartı bildikçe daha seyrek, zorlandıkça daha sık görürsün. Sınav tarihin yaklaştıkça aralıklar kısalır; böylece sınavdan önce her kart en az iki kez önüne gelir.', to: '/tekrar', link: 'Tekrara başla' },
  { icon: MessageSquareText, title: 'Anlat', text: 'Açık uçlu sorularda konuyu kendi cümlelerinle yazarsın; örnek cevapla karşılaştırırsın. Bir konuyu anlatabiliyorsan gerçekten biliyorsundur.' },
  { icon: Sparkles, title: 'Araçlar', text: 'Not sayfasındaki Araçlar menüsünde hafıza kodlaması (akrostiş, tekerleme, hikâye), iki kavramı karşılaştırma, kavram haritası ve podcast var.' },
  { icon: CalendarClock, title: 'Sınavlar', text: 'Bütün sınav tarihlerin tek listede; hangisine önce çalışman gerektiğini söyler. Takvimi telefonunun takvimine de ekleyebilirsin.', to: '/sinav', link: 'Sınavlara git' },
  { icon: ClipboardList, title: 'Sınav provası', text: 'Konuları, soru türlerini (test, klasik, boşluk doldurma), zorluğu ve süreyi seç; hocanın eski sorularını ya da "hoca ne dedi"yi yaz. Sonuçlar kaydedilir, puan gidişatın görünür.' },
  { icon: Coffee, title: 'Mola', text: 'Tekrar sekmesindeki Mola’da kendi kartlarınla iki dakikalık oyunlar (Eşleştir, Hızlı tur) ve bir odak sayacı var. Oyunlar serini korur.', to: '/tekrar?bolum=mola', link: 'Molaya geç' },
  { icon: Headphones, title: 'Gece kütüphanesi', text: 'Kulaklık düğmesinden yağmur, kafe, şömine ve odak seslerini karıştır. Sayfa değiştirsen de çalmaya devam eder.' },
  { icon: ReceiptText, title: 'Çalışma fişi', text: 'Bugün ekranındaki "Çalışma fişi" günün ya da haftanın çalışmasını kasa fişi gibi bir görsele döker. Hikâyende paylaşabilirsin.' },
  { icon: Share2, title: 'Ders paylaşımı', text: 'Bir dersin notlarını bağlantı ya da QR kodla arkadaşına gönder; o kendi kopyasını alır. İlerlemen ve cevapların paylaşılmaz.' },
  { icon: Trophy, title: 'Başarımlar', text: 'Çalıştıkça açılan hedefler ve sitenin köşelerinde saklı gizli keşifler. Gizliler yalnızca bir ipucu verir; kurcala.', to: '/basarimlar', link: 'Koleksiyona bak' },
  { icon: Trophy, title: 'Seviye ve XP', text: 'Çevirdiğin her kart, bitirdiğin test, sınav provası, hazırladığın not, çalıştığın her gün ve açtığın başarımlar XP getirir. XP biriktikçe seviye atlar, yeni unvanlar alırsın (Çaylak, Kart Ustası, Vize Savaşçısı…).', to: '/basarimlar#seviye', link: 'Seviyeme bak' },
  { icon: Sparkles, title: 'Hangi öğrenci tipisin?', text: '10 soruluk kısa test; nasıl çalıştığını, güçlü yanlarını ve sana özel bir taktiği söyler. Sonucun profiline kaydedilir.', to: '/ogrenci-tipi', link: 'Testi çöz' },
  { icon: Palette, title: 'Görünüm', text: 'Ayarlar’dan açık ya da koyu tema, defter kağıdı (kareli, noktalı, sarı defter…) ve fosforlu kalem rengini seçebilirsin.', to: '/ayarlar', link: 'Ayarlar' },
  { icon: KeyRound, title: 'Yapay zekâ', text: 'Giriş yapınca yapay zekâ ücretsiz: günde 40 istek (VIP’te 150). VIP ve yönetici hesaplarında notlar kendiliğinden daha güçlü Free+ ile hazırlanır, ayrıca seçmen gerekmez. İstersen Ayarlar’dan kendi Claude, ChatGPT ya da Gemini anahtarını bağlayabilirsin; o zaman hakkından düşmez.' },
]

const PREMIUM_TIPS: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: AudioLines, title: 'Sesli not: yolda, sporda, yatmadan önce', text: 'Notunu Deniz ile Mert’in sohbeti olarak dinle. "Stüdyo sesiyle dinle" önce senaryoyu yazdırır, sonra iki gerçek sesle kaydeder; WAV olarak indirebilirsin. Okumaya enerjin olmadığında ya da bir konuyu ilk kez duyarken en çok işe yarar.' },
  { icon: Search, title: 'Akıllı arama: kelimeyle değil anlamla sor', text: 'Notlarını bir kez hazırla, sonra aklındakini kendi cümlenle yaz: "enerji üreten organel" yazınca, o kelimeler geçmese de mitokondri notunu bulur. Kısa ve somut sor; ders adını eklemene gerek yok.' },
  { icon: ImageIcon, title: 'Görsel: şemayı karta çevir', text: 'Zor bir süreci (bir döngü, bir karşılaştırma) çizdir. Beğendiğin görselde "Karta çevir"e bas; görselin özeti tekrar kartlarına eklenir. Görseller studymode.fun etiketiyle iner.' },
  { icon: Gem, title: 'Günlük hak', text: 'Premium’da günde 30 hak var: podcast senaryosu, ses ve görsel birer hak sayılır. Akıllı arama hakkından düşmez. Hakların her gün yenilenir; özet ve testler için normal ücretsiz yapay zekâ her zaman açık.' },
]

export function Guide() {
  const { hash } = useLocation()
  const dark = useDarkTheme()

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' })
  }, [hash])

  return (
    <div className="page page-narrow guide-page">
      <div className="page-header">
        <div>
          <p className="subtle">Nasıl kullanılır?</p>
          <h1>
            <span className="hl">Rehber</span>
          </h1>
        </div>
        <button type="button" className="btn btn-sm" onClick={() => requestTour()}>
          <PlayCircle size={16} /> Turu tekrar başlat
        </button>
      </div>

      <section className="section" aria-labelledby="akis">
        <h2 id="akis">Nasıl ilerlemeli?</h2>
        <ol className="guide-flow">
          {FLOW.map((s, i) => (
            <li key={s.title}>
              <span className="guide-flow-n">{i + 1}</span>
              <div className="guide-flow-body">
                <strong>{s.title}</strong>
                <p>{s.text}</p>
                <Link to={s.to} className="guide-link">
                  {s.link} <ArrowRight size={14} />
                </Link>
              </div>
              <div className="guide-shot">
                <ZoomableImage src={`/rehber/adim-${s.shot}-${dark ? 'dark' : 'light'}.webp`} alt={s.alt} loading="lazy" />
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="section" aria-labelledby="ozellikler">
        <h2 id="ozellikler">Özellikler</h2>
        <div className="guide-grid">
          {FEATURES.map(({ icon: Icon, title, text, to, link }) => (
            <article key={title} className="panel guide-card">
              <span className="guide-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
                {to && (
                  <Link to={to} className="guide-link">
                    {link} <ArrowRight size={14} />
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section guide-premium" id="premium" aria-labelledby="premium-baslik">
        <h2 id="premium-baslik">
          <Gem size={20} aria-hidden /> Premium’u en iyi nasıl kullanırsın?
        </h2>
        <p className="subtle">Premium kodu kullananlarda ve VIP hesaplarda açık (kodu Ayarlar’dan girersin). Notların Google’ın Gemini modelleriyle hazırlanır: metin için Gemini 3.8, ses için iki ayrı stüdyo sesi.</p>
        <div className="guide-grid">
          {PREMIUM_TIPS.map(({ icon: Icon, title, text }) => (
            <article key={title} className="panel guide-card is-premium">
              <span className="guide-icon" aria-hidden="true">
                <Icon size={20} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
        <Link to="/premium" className="btn prem-btn" style={{ alignSelf: 'flex-start' }}>
          <Gem size={16} aria-hidden /> Premium’a git
        </Link>
      </section>

      <p className="subtle guide-foot">
        <LifeBuoy size={15} aria-hidden /> Takıldığın bir yer mi var? Yan menüdeki “Fikir · Hata bildir” ile yaz; okunuyor.
      </p>
    </div>
  )
}
