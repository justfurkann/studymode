import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { FeedbackLink } from '../components/Feedback'
import { MAKER, SOCIALS } from '../components/MadeBy'
import { useStore } from '../lib/store'

export const TERMS_UPDATED = '1 Kasım 2026'

/** /kullanim-kosullari: the rules for using StudyMode, in plain Turkish, next to the privacy policy. */
export function Terms() {
  const { session } = useStore()
  useEffect(() => {
    const before = document.title
    document.title = 'Kullanım koşulları · StudyMode'
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
          Kullanım <span className="hl">koşulları</span>
        </h1>
        <p className="subtle">Son güncelleme: {TERMS_UPDATED}</p>
        <p className="legal-lead">
          StudyMode'u kullanarak bu koşulları kabul etmiş olursun. Uzun bir sözleşme değil; uygulamayı herkes için adil ve güvenli tutmak için birkaç kural ve neyi vaat edip neyi
          edemediğimiz. Kişisel verilerinin nasıl işlendiği <Link to="/gizlilik">gizlilik politikasında</Link> anlatılıyor.
        </p>

        <section>
          <h2>StudyMode nedir?</h2>
          <p>
            Ders notlarından özet, test, çalışma kartı ve sınav provası hazırlayan, aralıklı tekrarla çalışmanı planlayan küçük ve bağımsız bir uygulamadır. {MAKER} (M. Furkan Öztürk)
            tarafından geliştirilir ve işletilir.
          </p>
        </section>

        <section>
          <h2>Hesabın</h2>
          <ul>
            <li>Kayıt olurken doğru bilgi ver. Hesabın kişiseldir; başkasıyla paylaşma.</li>
            <li>Şifreni güvende tutmak senin sorumluluğunda. Hesabında izinsiz bir hareket fark edersen bize hemen yaz.</li>
            <li>18 yaşından küçüksen StudyMode'u velinin bilgisi dahilinde kullan.</li>
          </ul>
        </section>

        <section>
          <h2>Kabul edilebilir kullanım</h2>
          <p>Şunları yapmamayı kabul edersin:</p>
          <ul>
            <li>Yasalara aykırı, başkalarının haklarını ihlal eden, nefret söylemi ya da taciz içeren içerik yüklemek veya paylaşmak.</li>
            <li>Paylaşma hakkın olmayan telifli materyalleri (ör. bir kitabın tamamı) paylaşım bağlantısıyla dağıtmak.</li>
            <li>Günlük yapay zekâ hakkını aşmak için birden fazla hesap açmak ya da uygulamaya bot, betik gibi otomatik araçlarla istek göndermek.</li>
            <li>Başka birinin hesabına ya da verisine erişmeye çalışmak, güvenlik önlemlerini aşmaya ya da hizmeti bozmaya çalışmak.</li>
          </ul>
        </section>

        <section>
          <h2>İçeriğin senindir</h2>
          <p>
            Yüklediğin notlar ve yazdığın cevaplar sana aittir. Bunları yalnızca hizmeti sunmak için kullanırız: saklamak, cihazların arasında eşitlemek ve özet, soru gibi çalışma
            malzemesi hazırlamak için yapay zekâ servislerine göndermek. Bir dersi paylaşırsan, bağlantıya sahip olanların o dersin kopyasını görmesine izin vermiş olursun; paylaşımı
            istediğin an kapatabilirsin.
          </p>
        </section>

        <section>
          <h2>Yapay zekâ hakkında</h2>
          <ul>
            <li>Özetler, sorular, puanlar, sesli notlar ve görseller yapay zekâ tarafından hazırlanır ve hatalı olabilir. Önemli bilgileri ders kaynağından ya da hocandan doğrula.</li>
            <li>StudyMode çalışmana yardım eden bir araçtır; sınav başarısını garanti etmez. Tıbbi, hukuki ya da mali konularda tavsiye yerine geçmez.</li>
          </ul>
        </section>

        <section>
          <h2>Ücretsiz hizmet, ücretli Premium ve VIP</h2>
          <ul>
            <li>StudyMode’un temel özellikleri ücretsizdir. Yapay zekânın adil paylaşılması için günlük kullanım hakları vardır; bu sınırları gerektiğinde değiştirebiliriz.</li>
            <li>
              <strong>Ücretli Premium kodla satılır.</strong> Kodu Shopier üzerinden satın alırsın; ödemeyi Shopier alır, kart bilgilerin bize hiç gelmez. Kodu Ayarlar’da ya da Premium
              sayfasında girdiğinde Premium hesabında açılır.
            </li>
            <li>
              Her kod <strong>tek kullanımlıktır</strong> ve süresi kodla belirlenir (ör. 30 gün). Süren devam ederken yeni bir kod girersen süre üstüne eklenir. Süre bitince Premium
              kendiliğinden kapanır; <strong>otomatik yenileme ve tekrarlayan ödeme yoktur</strong>.
            </li>
            <li>
              <strong>İade:</strong> Henüz kullanılmamış bir kodun iadesi, kodun iptal edilmesiyle yapılır; bunun için uygulamadaki “Fikir · Hata bildir” kutusundan ya da Instagram’dan
              yaz. Kod kullanıldığında hizmet hemen başladığı için kullanılmış kodlar iade edilmez; yasadan doğan hakların saklıdır.
            </li>
            <li>Premium’un içeriği (sesli not, akıllı arama, görsel) ve günlük hakları adil kullanım için değişebilir; satın aldığın süre boyunca özellikleri kaldırmayız.</li>
            <li>VIP, davetle verilen ücretsiz bir ayrıcalıktır; kapsamı ve kimlere verildiği değişebilir, gerektiğinde geri alınabilir.</li>
          </ul>
        </section>

        <section>
          <h2>Hizmetin sürekliliği</h2>
          <p>
            StudyMode'u özenle geliştiriyoruz, ama küçük bir proje olarak kesintisiz ya da hatasız çalışacağını garanti edemeyiz. Bakım, güncelleme ya da üçüncü taraf servislerdeki
            (barındırma, veritabanı, yapay zekâ) sorunlar yüzünden zaman zaman erişilemeyebilir. Önemli notlarının kendi kopyasını sakla; <Link to="/ayarlar">Ayarlar</Link>'dan
            verilerini dışa aktarabilirsin.
          </p>
        </section>

        <section>
          <h2>Sorumluluğun sınırı</h2>
          <p>
            Hizmet "olduğu gibi" sunulur. Yürürlükteki hukukun izin verdiği ölçüde, yapay zekâ çıktılarındaki hatalardan, hizmetteki kesintilerden ya da veri kaybından doğabilecek dolaylı
            zararlardan sorumlu tutulamayız. Bu, yasaların hiçbir durumda sınırlanmasına izin vermediği sorumlulukları etkilemez.
          </p>
        </section>

        <section>
          <h2>Hesabın kapatılması</h2>
          <p>
            Hesabını ve verilerini istediğin zaman silebilirsin (<Link to="/gizlilik">gizlilik politikasında</Link> nasıl yapılacağı yazıyor). Bu koşullara açıkça aykırı kullanımda,
            özellikle kötüye kullanım ya da başkalarına zarar verme durumunda, hesabı askıya alabilir ya da kapatabiliriz; mümkünse önce seni uyarırız.
          </p>
        </section>

        <section>
          <h2>Değişiklikler</h2>
          <p>Bu koşulları değiştirirsek tarihi güncelleriz; önemli bir değişiklik olursa uygulamada da duyururuz. Değişiklikten sonra kullanmaya devam etmen yeni koşulları kabul ettiğin anlamına gelir.</p>
        </section>

        <section>
          <h2>Uygulanacak hukuk ve iletişim</h2>
          <p>
            Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır. Soruların, itirazların ya da bildirmek istediğin bir kötüye kullanım için uygulamadaki{' '}
            <FeedbackLink label="Fikir · Hata bildir" /> kutusunu kullanabilir ya da Instagram'dan{' '}
            <a href={SOCIALS[0].url} target="_blank" rel="noopener noreferrer">
              {SOCIALS[0].handle}
            </a>{' '}
            hesabına yazabilirsin.
          </p>
        </section>
      </main>

      <footer className="lp-wrap lp-footer">
        <Brand size={24} />
        <span>Türk üniversite öğrencileri için ders çalışma uygulaması.</span>
        <Link to="/gizlilik" className="lp-footer-quiet">
          Gizlilik
        </Link>
        <Link to="/hakkinda">Hakkında</Link>
      </footer>
    </div>
  )
}
