import { ArrowRight, CalendarClock, Check, FileText, Layers, ListChecks, MessageSquareText, Smartphone, Sparkles } from 'lucide-react'
import { MadeBy } from '../components/MadeBy'
import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { useStore } from '../lib/store'
import { useLoadDemo } from '../lib/useDemo'

const FAQ = [
  {
    q: 'Ücretsiz mi?',
    a: 'Evet. Hesap açınca yapay zekâ ücretsiz çalışır. İstersen ayarlardan kendi Claude, ChatGPT ya da Gemini anahtarını da bağlayabilirsin.',
  },
  {
    q: 'Hesap açmam şart mı?',
    a: 'Örnek notu ve basit modu hesapsız deneyebilirsin; notların o cihazda kalır. Yapay zekâ ve cihazlar arası senkron için ücretsiz hesap gerekir.',
  },
  {
    q: 'Hangi dosyaları yükleyebilirim?',
    a: 'PDF, Word, PowerPoint, TXT ve Markdown dosyaları, telefonla çektiğin fotoğraflar ve taranmış PDF\'ler. Birden fazla dosyayı aynı anda da ekleyebilirsin.',
  },
  {
    q: 'Notlarımı başkası görebilir mi?',
    a: 'Hayır. Notların yalnızca senin hesabına bağlı; başka kullanıcılar göremez.',
  },
  {
    q: 'Telefonda çalışır mı?',
    a: 'Evet. Tarayıcıdan açıp "Ana ekrana ekle" dersen uygulama gibi açılır.',
  },
]

/** The page a logged-out first visitor sees at "/". Also reachable at /tanitim. */
export function Landing() {
  const { session, data } = useStore()
  const loadDemo = useLoadDemo()
  const canDemo = !data.courses.length

  const primary = session ? (
    <Link to="/" className="btn btn-primary btn-lg">
      Uygulamaya dön <ArrowRight size={18} />
    </Link>
  ) : (
    <Link to="/giris?mod=kayit" className="btn btn-primary btn-lg">
      Ücretsiz başla <ArrowRight size={18} />
    </Link>
  )

  return (
    <div className="landing">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <Link to="/tanitim" className="brand-link">
            <Brand size={30} />
          </Link>
          <nav aria-label="Tanıtım">
            <a href="#nasil" className="lp-nav-link">
              Nasıl çalışır
            </a>
            <a href="#sss" className="lp-nav-link">
              Sık sorulanlar
            </a>
            {session ? (
              <Link to="/" className="btn btn-sm">
                Uygulamaya dön
              </Link>
            ) : (
              <Link to="/giris" className="btn btn-sm">
                Giriş yap
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="lp-wrap lp-hero">
          <div className="lp-hero-text">
            <h1>
              Notunu yükle. <span className="hl">Önemlisini</span> biz işaretleyelim.
            </h1>
            <p className="lp-lead">
              PDF, Word, slayt ya da fotoğraf. Özeti, testi ve tekrar kartlarını hazırlıyoruz; vize ve final tarihine göre her gün neyi çalışacağını söylüyoruz.
            </p>
            <div className="lp-ctas">
              {primary}
              {canDemo && (
                <button className="btn btn-lg" onClick={loadDemo}>
                  Örnek notla dene
                </button>
              )}
            </div>
            <p className="lp-fine">
              Yapay zekâ ücretsiz · Kart bilgisi istemez ·{' '}
              <Link to="/not-ekle">Hesapsız kendi notumu dene</Link>
            </p>
            <Link to="/ogrenci-tipi" className="lp-quiz-link">
              <Sparkles size={16} aria-hidden /> Hangi öğrenci tipisin? <span>2 dakikalık test</span> <ArrowRight size={16} aria-hidden />
            </Link>
          </div>

          <div className="lp-demo" aria-label="Örnek çalışma seti">
            <div className="lp-sheet">
              <div className="lp-file">
                <span className="lp-file-icon">
                  <FileText size={18} />
                </span>
                <div className="grow">
                  <b>Öğrenme ve bellek.pdf</b>
                  <small>Psikolojiye Giriş · Vizeye 7 gün</small>
                </div>
                <span className="chip chip-success">
                  <Check size={14} /> Hazır
                </span>
              </div>
              <div className="lp-outs">
                <span>
                  <b>Özet</b>6 kavram
                </span>
                <span>
                  <b>Test</b>5 soru
                </span>
                <span>
                  <b>Kartlar</b>aralıklı tekrar
                </span>
              </div>
            </div>
            <div className="lp-quiz">
              <span className="lp-kicker">Test · Soru 1 / 5</span>
              <p className="lp-q">Hangisi aktif hatırlamaya örnektir?</p>
              <span className="lp-opt">Notların altını tekrar çizmek</span>
              <span className="lp-opt correct">
                <Check size={16} /> Notu kapatıp konuyu kendi sözlerinle anlatmak
              </span>
            </div>
            <div className="lp-flash" aria-hidden="true">
              <span className="lp-kicker">Kart</span>
              <p>Aralıklı tekrar nedir?</p>
              <span className="lp-hint">İpucu: Çalışma oturumlarını…</span>
            </div>
          </div>
        </section>

        <section className="lp-band" id="nasil" aria-labelledby="nasil-baslik">
          <div className="lp-wrap">
            <h2 id="nasil-baslik">Üç adımda sınava hazır</h2>
            <ol className="lp-steps">
              <li>
                <span className="step-num-hl">1</span>
                <h3>Notunu yükle</h3>
                <p>Ders notu, slayt, kitap sayfası fotoğrafı. Uzun notlar bölümlere ayrılıp tek tek işlenir.</p>
              </li>
              <li>
                <span className="step-num-hl">2</span>
                <h3>Adım adım çalış</h3>
                <p>
                  Her not dört adım: <b>Özet</b>, <b>Test</b>, <b>Kartlar</b> ve kendi cümlelerinle <b>Anlat</b>.
                </p>
              </li>
              <li>
                <span className="step-num-hl">3</span>
                <h3>Her gün biraz tekrar et</h3>
                <p>Bugün ekranı, sınavı en yakın ve en zayıf olduğun konuyu öne alır. Unutmaya başladığın kartlar zamanında geri gelir.</p>
              </li>
            </ol>
          </div>
        </section>

        <section className="lp-wrap lp-features" aria-labelledby="ozellik-baslik">
          <h2 id="ozellik-baslik">Ders çalışırken ihtiyacın olanlar</h2>
          <ul>
            <li>
              <CalendarClock size={22} />
              <div>
                <h3>Vize, final, bütünleme</h3>
                <p>Her dersin sınavlarını ve ağırlığını gir. "Biyoloji vizesine 8 gün" gibi geri sayım ve ona göre günlük plan.</p>
              </div>
            </li>
            <li>
              <ListChecks size={22} />
              <div>
                <h3>Sınav provası</h3>
                <p>Seçtiğin notlardan süreli, karışık bir deneme. Her yanlışın kaynağını notunda gösterir.</p>
              </div>
            </li>
            <li>
              <Layers size={22} />
              <div>
                <h3>Aralıklı tekrar kartları</h3>
                <p>Bildiğin kart seyrek, zorlandığın kart sık gelir. Yanlış test cevaplarını tek dokunuşla karta çevir.</p>
              </div>
            </li>
            <li>
              <MessageSquareText size={22} />
              <div>
                <h3>Anlamadığını sor</h3>
                <p>Bir kavram oturmadıysa "Bu konuyu anlamadım" de; notundaki ilgili bölümden daha basit bir açıklama gelir.</p>
              </div>
            </li>
            <li>
              <Smartphone size={22} />
              <div>
                <h3>Telefonda ve bilgisayarda</h3>
                <p>Hesabınla girince notların, kartların ve serin her cihazda aynı.</p>
              </div>
            </li>
          </ul>
        </section>

        <section className="lp-wrap lp-faq" id="sss" aria-labelledby="sss-baslik">
          <h2 id="sss-baslik">Sık sorulanlar</h2>
          <div className="lp-faq-list">
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-wrap">
          <div className="lp-final">
            <h2>
              Sıradaki sınavın ne zaman? <span className="hl">Bugün</span> başla.
            </h2>
            <div className="lp-ctas">
              {primary}
              {canDemo && (
                <button className="btn btn-lg" onClick={loadDemo}>
                  Önce örnekle dene
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-wrap lp-footer">
        <Brand size={24} />
        <span>Türk üniversite öğrencileri için ders çalışma uygulaması.</span>
        <MadeBy />
        <Link to="/gizlilik" className="lp-footer-quiet">Gizlilik</Link>
        <Link to="/giris">Giriş yap</Link>
      </footer>
    </div>
  )
}
