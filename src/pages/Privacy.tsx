import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { FeedbackLink } from '../components/Feedback'
import { MAKER, SOCIALS } from '../components/MadeBy'
import { useStore } from '../lib/store'
import { unlock } from '../lib/achievements'

export const PRIVACY_UPDATED = '1 Kasım 2026'

/** /gizlilik: what StudyMode keeps, why, who processes it, and how to delete it. Plain Turkish. */
export function Privacy() {
  const { session } = useStore()
  useEffect(() => {
    const before = document.title
    document.title = 'Gizlilik politikası · StudyMode'
    return () => {
      document.title = before
    }
  }, [])

  return (
    <div className="landing legal-page">
      <header className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <Link to="/" className="brand-link" aria-label="StudyMode ana sayfa">
            <Brand size={30} />
          </Link>
          <Link to="/" className="btn btn-sm">
            {session ? 'Uygulamaya dön' : 'Uygulamaya git'}
          </Link>
        </div>
      </header>

      <main className="lp-wrap legal">
        <h1>
          Gizlilik <span className="hl">politikası</span>
        </h1>
        <p className="subtle">Son güncelleme: {PRIVACY_UPDATED}</p>
        <p className="legal-lead">
          StudyMode, ders notlarından özet, kart ve test hazırlayan küçük, bağımsız bir uygulamadır. Bu sayfa hangi bilgileri tuttuğumuzu, neden tuttuğumuzu, kimlerin işlediğini ve
          bunları nasıl silebileceğini sade bir dille anlatır. Kısaca: <strong>notların senindir, satılmaz, reklam için kullanılmaz.</strong>
        </p>

        <section>
          <h2>Veri sorumlusu ve iletişim</h2>
          <p>
            StudyMode'u {MAKER} (M. Furkan Öztürk) geliştirir ve işletir. Gizlilikle ilgili her soru, düzeltme ya da silme isteği için uygulamadaki <FeedbackLink label="Fikir · Hata bildir" /> kutusunu
            kullanabilir ya da Instagram'dan{' '}
            <a href={SOCIALS[0].url} target="_blank" rel="noopener noreferrer">
              {SOCIALS[0].handle}
            </a>{' '}
            hesabına yazabilirsin.
          </p>
        </section>

        <section>
          <h2>Hangi bilgileri tutuyoruz?</h2>
          <ul>
            <li>
              <strong>Hesap bilgileri:</strong> ad, soyad ve e-posta adresi. Google ile giriş yaparsan Google'ın bize verdiği ad, e-posta ve profil fotoğrafı bağlantısı. Şifren Supabase
              tarafından şifrelenmiş (hash) olarak saklanır; biz göremeyiz.
            </li>
            <li>
              <strong>Çalışma içeriğin:</strong> derslerin, sınav tarihlerin, yüklediğin notların metni, oluşan özet, kart ve sorular, test ve sınav provası sonuçların, yazılı cevapların.
            </li>
            <li>
              <strong>Kullanım bilgileri:</strong> hangi günler çalıştığın (seri için), günlük ücretsiz yapay zekâ kullanım sayın, hesabının rolü (normal, VIP, yönetici).
            </li>
            <li>
              <strong>Geri bildirim ve hata kayıtları:</strong> bize yazdığın mesajlar ve uygulamada bir hata olursa hatanın teknik açıklaması. Bunlarla birlikte yalnızca hangi sayfada olduğun
              ve cihaz/tarayıcı türü gelir; notlarının içeriği gelmez.
            </li>
            <li>
              <strong>Ziyaret istatistiği:</strong> kaç kişinin hangi sayfaları ziyaret ettiğini Vercel Web Analytics ile sayarız. Bu sayım çerez kullanmaz ve seni kişisel olarak tanımlamaz.
            </li>
            <li>
              <strong>Cihazında kalanlar:</strong> tema, ses, odak sayacı ve oyun rekorları gibi tercihler; hesapsız kullanıyorsan çalışma içeriğinin tamamı. Kendi yapay zekâ anahtarını
              bağlarsan o anahtar yalnızca senin tarayıcında saklanır, sunucumuza hiç gelmez. Premium'daki akıllı arama için notlarının anlamını gösteren sayı dizileri
              ve hazırlanan podcast senaryoları da yalnızca bu cihazda tutulur.
            </li>
          </ul>
        </section>

        <section>
          <h2>Neden kullanıyoruz?</h2>
          <ul>
            <li>Hesabını açmak, giriş yapmanı sağlamak ve notlarını telefonunla bilgisayarın arasında senkronize etmek için.</li>
            <li>Notlarından özet, kart, test ve sınav provası hazırlamak için.</li>
            <li>Aralıklı tekrar, seri ve sınav planını sana göre ayarlamak için.</li>
            <li>Ücretsiz yapay zekânın adil paylaşılması için günlük kullanımı saymak, hataları düzeltmek ve uygulamayı geliştirmek için.</li>
          </ul>
          <p>Bilgilerini reklam için kullanmayız, satmayız ve pazarlama listesine eklemeyiz.</p>
        </section>

        <section>
          <h2>Kimler işliyor?</h2>
          <p>Uygulamayı çalıştırmak için şu hizmet sağlayıcılarla çalışıyoruz; her biri yalnızca kendi işi için gereken bilgiyi görür:</p>
          <ul>
            <li>
              <strong>Supabase:</strong> hesaplar, giriş ve çalışma içeriğinin saklandığı veritabanı.
            </li>
            <li>
              <strong>Vercel:</strong> sitenin barındırılması ve çerezsiz ziyaret istatistiği.
            </li>
            <li>
              <strong>Google (Gemini):</strong> ücretsiz yapay zekâ, yüklediğin notun metnini özet ve soru hazırlamak için Google'ın Gemini modellerine gönderir. Ücretsiz katmanda Google bu
              içerikleri kendi ürünlerini geliştirmek için kullanabilir; bu yüzden kişisel ya da gizli bilgi içeren notları yükleme. Google ile giriş yaparsan girişini de Google doğrular.
            </li>
            <li>
              <strong>Google Cloud (Vertex AI) — Free+:</strong> VIP ve yöneticiler Free+ seçerse notun metni Google Cloud üzerindeki ücretli Gemini modellerine gider. Bu kullanımda
              Google içerikleri kendi ürünlerini geliştirmek için kullanmaz. Premium özellikleri (sesli not, görsel, akıllı arama) de aynı yoldan çalışır: seslendirilecek
              metin, çizilecek kavram ya da aranan cümle bu modellere gider.
            </li>
            <li>
              <strong>Resend:</strong> hesap onayı ve şifre sıfırlama e-postalarının gönderimi.
            </li>
            <li>
              <strong>Kendi anahtarın:</strong> ayarlardan Claude (Anthropic), ChatGPT (OpenAI) ya da Gemini anahtarını bağlarsan notun doğrudan senin tarayıcından o servise gider; o servisin
              kendi gizlilik koşulları geçerlidir.
            </li>
          </ul>
          <p>Bu sağlayıcıların sunucuları yurt dışında olabilir; bilgilerin uygulamayı çalıştırmak için bu sunuculara aktarılır.</p>
        </section>

        <section>
          <h2>Paylaşım bağlantıları</h2>
          <p>
            Bir dersi paylaşırsan, o dersin notları, özetleri, kartları, soruları ve yaklaşan sınav tarihleri, bağlantıya sahip olan herkesin görebileceği bir kopya olarak saklanır. Senin
            ilerlemen, yazılı cevapların, puanların ve e-posta adresin bu kopyaya girmez. Paylaşımı istediğin an kapatabilirsin; kapatınca bağlantı çalışmaz.
          </p>
        </section>

        <section>
          <h2>Ne kadar saklıyoruz, nasıl silersin?</h2>
          <ul>
            <li>Çalışma içeriğin, hesabın açık olduğu sürece saklanır.</li>
            <li>
              Tüm derslerini ve notlarını <Link to="/ayarlar">Ayarlar → Verilerin → Her şeyi sil</Link> ile kendin silebilirsin.
            </li>
            <li>Hesabının tamamen silinmesini istersen bize yaz; en geç 30 gün içinde hesabın ve ona bağlı tüm veriler silinir.</li>
            <li>Hata kayıtları ve istatistikler yalnızca toplu olarak, uygulamayı iyileştirmek için kullanılır.</li>
          </ul>
        </section>

        <section>
          <h2>Kimler görebilir?</h2>
          <p>
            Hesabındaki içerik yalnızca sana görünür; veritabanı her kullanıcının sadece kendi satırlarını görebileceği şekilde kilitlidir. Uygulamayı işleten kişi teknik olarak hesap
            listesini, kullanım sayılarını, geri bildirimleri ve hata kayıtlarını görebilir; notlarının içeriğine bakmaz.
          </p>
        </section>

        <section>
          <h2>Hakların</h2>
          <p>
            6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında; hakkında bilgi işlenip işlenmediğini öğrenme, işlenmişse bilgi isteme, yanlışsa düzeltilmesini, gerekirse silinmesini
            isteme ve itiraz etme haklarına sahipsin. Bu haklar için yukarıdaki iletişim yollarından bize yazabilirsin.
          </p>
        </section>

        <section>
          <h2>Değişiklikler</h2>
          <p>
            Bu politikayı değiştirirsek tarihi güncelleriz; önemli bir değişiklik olursa uygulamada da duyururuz
            {/* Dedektif: the last full stop of the policy is a button. Nobody reads this far. */}
            <button type="button" className="privacy-dot" aria-label="Nokta" onClick={() => unlock('dedektif')}>
              .
            </button>
          </p>
        </section>
      </main>

      <footer className="lp-wrap lp-footer">
        <Brand size={24} />
        <span>Türk üniversite öğrencileri için ders çalışma uygulaması.</span>
        <Link to="/hakkinda">Hakkında</Link>
      </footer>
    </div>
  )
}
