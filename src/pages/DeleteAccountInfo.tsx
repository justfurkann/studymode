import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { MAKER } from '../components/MadeBy'
import { MANAGE_HINT } from '../lib/appStore'
import { DELETE_WORD } from '../lib/deleteAccount'
import { SELLER } from '../lib/pricing'
import { useStore } from '../lib/store'

/** Where someone who cannot sign in any more asks for the deletion (the contact on the sales page). */
export const DELETE_SUPPORT_EMAIL = SELLER.email

/**
 * /hesap-sil: a public page (no sign-in needed) on how to delete a StudyMode account, from the phone
 * app or the site, what goes and what stays. Google Play asks for such a page; it matches what
 * /api/delete-account really deletes (HANDOFF Aşama 68).
 */
export function DeleteAccountInfo() {
  const { session } = useStore()
  useEffect(() => {
    const before = document.title
    document.title = 'Hesabı sil · StudyMode'
    return () => {
      document.title = before
    }
  }, [])

  const mail = `mailto:${DELETE_SUPPORT_EMAIL}?subject=${encodeURIComponent('StudyMode hesap silme isteği')}`

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
          Hesabını <span className="hl">sil</span>
        </h1>
        <p className="legal-lead">
          Bu sayfa StudyMode hesabının nasıl silineceğini anlatır. StudyMode’u {MAKER} geliştirir. Site (studymode.fun) ve telefon uygulaması <strong>aynı hesabı</strong> kullanır;
          hesabı bir yerden silersen her yerden silinir.
        </p>

        {session ? (
          <p>
            <Link to="/ayarlar#hesabi-sil" className="btn btn-danger">
              Ayarlar → Hesabı sil
            </Link>
          </p>
        ) : (
          <p className="subtle">
            Hesabını şimdi silmek istersen önce <Link to="/giris">giriş yap</Link>; sonra Ayarlar’ın en altındaki “Hesabı sil” bölümüne git.
          </p>
        )}

        <section>
          <h2>Telefon uygulamasından</h2>
          <ol>
            <li>Uygulamayı aç ve hesabına giriş yap.</li>
            <li>
              Alttaki <strong>Hesap</strong> sekmesine dokun.
            </li>
            <li>
              En alttaki <strong>Hesabı sil…</strong> düğmesine dokun.
            </li>
            <li>Silinecekleri oku; süren bir Premium varsa uyarıyı onayla.</li>
            <li>
              Onay kutusuna <strong>{DELETE_WORD}</strong> yaz ve silmeyi onayla. Hesabın hemen silinir ve oturumun kapanır.
            </li>
          </ol>
          <p className="subtle">
            iPhone’da App Store aboneliğin varsa hesabı silmek aboneliği durdurmaz; önce {MANAGE_HINT} bölümünden iptal et.
          </p>
        </section>

        <section>
          <h2>Siteden (studymode.fun)</h2>
          <ol>
            <li>
              studymode.fun’da <Link to="/giris">giriş yap</Link>.
            </li>
            <li>
              <Link to="/ayarlar#hesabi-sil">Ayarlar</Link> sayfasının en altındaki <strong>Hesabı sil</strong> bölümüne git ve <strong>Hesabımı sil</strong>’e bas.
            </li>
            <li>
              İstersen önce Ayarlar → Verilerin bölümünden yedek indir. Sonra <strong>{DELETE_WORD}</strong> yaz ve onayla.
            </li>
          </ol>
        </section>

        <section>
          <h2>Neler silinir?</h2>
          <p>Silme hemen ve kalıcı olarak yapılır, geri getirilemez:</p>
          <ul>
            <li>Hesabın (ad, e-posta, giriş bilgileri)</li>
            <li>Dersler, notlar, özetler, kartlar, test ve sınav sonuçları, sınav tarihleri</li>
            <li>Seri ve çalışma günleri, okul bilgisi, öğrenci tipi, başarımlar</li>
            <li>Paylaştığın ders bağlantıları (artık açılmaz)</li>
            <li>Gönderdiğin geri bildirimler ve hata kayıtları</li>
            <li>Rolün, yapay zekâ kullanım sayıların ve Premium süren (kalan süre iade edilmez)</li>
          </ul>
        </section>

        <section>
          <h2>Neler kalır?</h2>
          <ul>
            <li>
              <strong>Kullanılmış Premium kodlarının kaydı</strong> (kodun ne zaman kullanıldığı) satış ve iade kayıtları için saklanır; silinen hesapla bağı kopar, kimin kullandığı
              görünmez.
            </li>
            <li>Sunucu ve yedek kayıtlarındaki izler en geç 30 gün içinde kendiliğinden silinir.</li>
          </ul>
        </section>

        <section>
          <h2>Giriş yapamıyorsan</h2>
          <p>
            Şifreni hatırlamıyorsan önce <Link to="/giris">giriş ekranındaki</Link> “Şifremi unuttum” ile yenilemeyi dene. Hesabına hiç ulaşamıyorsan hesabının e-posta adresinden{' '}
            <a href={mail}>{DELETE_SUPPORT_EMAIL}</a> adresine “hesap silme isteği” diye yaz. Hesabın ve ona bağlı bütün veriler en geç 30 gün içinde silinir.
          </p>
        </section>

        <p className="legal-note">
          Ayrıntılar <Link to="/gizlilik">gizlilik politikasında</Link>.
        </p>
      </main>

      <footer className="lp-wrap lp-footer">
        <Brand size={24} />
        <span>Türk üniversite öğrencileri için ders çalışma uygulaması.</span>
        <Link to="/gizlilik" className="lp-footer-quiet">
          Gizlilik
        </Link>
        <Link to="/kullanim-kosullari" className="lp-footer-quiet">
          Kullanım koşulları
        </Link>
        <Link to="/hakkinda">Hakkında</Link>
      </footer>
    </div>
  )
}
