import { AudioLines, Check, Clock, Image as ImageIcon, Mail, MapPin, Phone, Search, ShoppingBag, Sparkles, Ticket, User } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { useStore } from '../lib/store'
import { buyUrl, DELIVERY, formatPrice, PACKAGES, PRICING_UPDATED, SELLER, type PremiumPackage } from '../lib/pricing'

const DESCRIPTION =
  'StudyMode Premium üyelik kodu fiyatları: 1 aylık 50 TL, 4 aylık dönem paketi 150 TL. Tek kullanımlık dijital kod, otomatik yenileme yok. Teslimat, iade ve mesafeli satış sözleşmesi.'

/** Sets the tab title and the search description while the page is open. */
function usePageMeta(title: string, description: string) {
  useEffect(() => {
    const beforeTitle = document.title
    document.title = title
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const created = !meta
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    const beforeDescription = meta.content
    meta.content = description
    return () => {
      document.title = beforeTitle
      if (created) meta?.remove()
      else if (meta) meta.content = beforeDescription
    }
  }, [title, description])
}

function mailto(subject: string) {
  return `mailto:${SELLER.email}?subject=${encodeURIComponent(subject)}`
}

function PackageCard({ pkg }: { pkg: PremiumPackage }) {
  const url = buyUrl(pkg)
  return (
    <article className="price-card" aria-labelledby={`paket-${pkg.id}`}>
      <h3 id={`paket-${pkg.id}`}>{pkg.name}</h3>
      <p className="price-amount">
        <strong>{formatPrice(pkg.price)}</strong>
        <span className="subtle"> · {pkg.days} gün</span>
      </p>
      <p className="subtle">{pkg.note}</p>
      <ul className="price-includes">
        <li>
          <Check size={15} aria-hidden /> Tek kullanımlık Premium kodu
        </li>
        <li>
          <Check size={15} aria-hidden /> {pkg.days} gün Premium, kodu girdiğin an başlar
        </li>
        <li>
          <Check size={15} aria-hidden /> Otomatik yenileme yok
        </li>
      </ul>
      {url ? (
        <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer">
          <ShoppingBag size={16} aria-hidden /> Satın al
        </a>
      ) : (
        <a className="btn" href={mailto(`StudyMode Premium: ${pkg.name}`)}>
          <Mail size={16} aria-hidden /> Satın almak için yaz
        </a>
      )}
    </article>
  )
}

/**
 * /fiyatlar: the public sales page (Shopier asks for one that opens without signing in). What is
 * sold, the prices, delivery, cancellation and refunds, the distance sales contract and the seller.
 * Figures and seller details come from src/lib/pricing.ts.
 */
export function Pricing() {
  const { session } = useStore()
  usePageMeta('Fiyatlar · StudyMode', DESCRIPTION)
  const [monthly, term] = PACKAGES

  return (
    <div className="landing legal-page pricing-page">
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
          Premium <span className="hl">fiyatları</span>
        </h1>
        <p className="subtle">Son güncelleme: {PRICING_UPDATED}</p>
        <p className="legal-lead">
          Satılan ürün: <strong>StudyMode Premium üyelik kodu</strong>. studymode.fun adresindeki ders çalışma uygulamasında Premium özellikleri belirli bir süre açan, tek
          kullanımlık <strong>dijital koddur</strong>. Fiziksel ürün ve kargo yoktur. Ödeme Shopier üzerinden alınır; otomatik yenileme ve tekrarlayan ödeme yoktur.
        </p>

        <section aria-labelledby="paketler">
          <h2 id="paketler">Paketler ve fiyatlar</h2>
          <div className="price-grid">
            {PACKAGES.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} />
            ))}
          </div>
          <p className="subtle">
            Fiyatlar Türk lirası cinsinden, ödenecek toplam tutardır; ek ücret alınmaz. Ödeme Shopier’in güvenli ödeme sayfasında yapılır, kart bilgilerin bize hiç gelmez.
          </p>
        </section>

        <section aria-labelledby="premium-ne">
          <h2 id="premium-ne">Premium’da neler var?</h2>
          <ul className="price-features">
            <li>
              <AudioLines size={17} aria-hidden />
              <span>
                <strong>Sesli not:</strong> notun yapay zekâyla iki kişilik bir sohbete dönüşür ve sesli dinlenir.
              </span>
            </li>
            <li>
              <ImageIcon size={17} aria-hidden />
              <span>
                <strong>Yapay zekâ görselleri:</strong> konuyu anlatan çizimler hazırlanır.
              </span>
            </li>
            <li>
              <Search size={17} aria-hidden />
              <span>
                <strong>Akıllı arama:</strong> notlarında kelimeyle değil anlamla arama.
              </span>
            </li>
            <li>
              <Sparkles size={17} aria-hidden />
              <span>
                <strong>Free+:</strong> notların Google’ın daha güçlü Gemini modeliyle hazırlanır; günde 30 Free+ isteği, ayrıca günde 150 yapay zekâ isteği (ücretsiz hesapta 40).
              </span>
            </li>
          </ul>
          <p className="subtle">
            Uygulamanın temel özellikleri (özet, kart, test, sınav provası, tekrar) Premium olmadan da ücretsizdir. Ayrıntılar <Link to="/premium">Premium sayfasında</Link>.
          </p>
        </section>

        <section aria-labelledby="nasil">
          <h2 id="nasil">Nasıl çalışır?</h2>
          <ol className="price-steps">
            <li>Yukarıdan paketi seç ve Shopier’den satın al.</li>
            <li>
              Premium kodun {DELIVERY.how} {DELIVERY.within} içinde gönderilir.
            </li>
            <li>
              StudyMode’a giriş yap; <strong>Ayarlar → Premium</strong> ya da <strong>Premium</strong> sayfasındaki <strong>“Kodum var”</strong> alanına kodu yaz.
            </li>
            <li>Premium hemen açılır ve süre o an başlar. Premium’un zaten açıksa yeni kodun süresi kalan sürenin üstüne eklenir.</li>
            <li>Süre bitince Premium kendiliğinden kapanır. Otomatik yenileme yoktur; devam etmek istersen yeni bir kod alırsın.</li>
          </ol>
        </section>

        <section aria-labelledby="teslimat">
          <h2 id="teslimat">Teslimat</h2>
          <p>
            <Clock size={16} aria-hidden className="inline-icon" /> Ürün dijitaldir; kargo yoktur. Kod, ödemenin onaylanmasından sonra {DELIVERY.how} <strong>{DELIVERY.within}</strong>{' '}
            içinde gönderilir. Bu sürede ulaşmazsa (gereksiz/spam klasörüne de bak) <a href={mailto('StudyMode Premium kodu ulaşmadı')}>{SELLER.email}</a> adresine yaz ya da{' '}
            <a href={SELLER.phoneHref}>{SELLER.phone}</a> numarasını ara.
          </p>
        </section>

        <section aria-labelledby="iade">
          <h2 id="iade">İptal ve iade</h2>
          <ul>
            <li>
              <strong>Kullanılmamış kod:</strong> 14 gün içinde, gerekçe göstermeden iade isteyebilirsin. Kod iptal edilir ve ödediğin tutarın tamamı, iade isteğinin bize ulaştığı
              günden itibaren en geç 14 gün içinde, ödemeyi yaptığın yöntemle geri ödenir.
            </li>
            <li>
              <strong>Kullanılmış kod:</strong> Kodu uygulamaya girdiğinde Premium hemen açılır, yani dijital hizmetin ifasına senin onayınla başlanmış olur. Mesafeli Sözleşmeler
              Yönetmeliği (madde 15/1-ğ) uyarınca elektronik ortamda anında ifa edilen hizmetlerde cayma hakkı kullanılamadığından, kullanılmış kodlar iade edilmez.
            </li>
            <li>
              Hizmette bizden kaynaklı bir sorun olursa (ör. Premium açılmıyorsa) yaz, gidermek için hemen ilgileniriz. Yasadan doğan hakların saklıdır.
            </li>
            <li>
              İade ve iptal için: <a href={mailto('StudyMode Premium iade')}>{SELLER.email}</a> (sipariş numaranı ve kodu yaz).
            </li>
          </ul>
        </section>

        <section aria-labelledby="satici">
          <h2 id="satici">Satıcı ve iletişim</h2>
          <dl className="seller-card">
            <div>
              <dt>
                <User size={15} aria-hidden /> Satıcı
              </dt>
              <dd>
                {SELLER.name} <span className="subtle">({SELLER.kind})</span>
              </dd>
            </div>
            <div>
              <dt>
                <Mail size={15} aria-hidden /> E-posta
              </dt>
              <dd>
                <a href={`mailto:${SELLER.email}`}>{SELLER.email}</a>
              </dd>
            </div>
            <div>
              <dt>
                <Phone size={15} aria-hidden /> Telefon
              </dt>
              <dd>
                <a href={SELLER.phoneHref}>{SELLER.phone}</a>
              </dd>
            </div>
            <div>
              <dt>
                <MapPin size={15} aria-hidden /> Adres
              </dt>
              <dd>{SELLER.address}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="mesafeli-satis">
          <h2 id="mesafeli-satis">Mesafeli satış sözleşmesi</h2>
          <details className="contract">
            <summary>Sözleşmenin tamamını göster</summary>
            <div className="contract-body">
              <h3>1. Taraflar</h3>
              <p>
                <strong>Satıcı:</strong> {SELLER.name} ({SELLER.kind}). Adres: {SELLER.address}. Telefon: {SELLER.phone}. E-posta: {SELLER.email}.
              </p>
              <p>
                <strong>Alıcı:</strong> Shopier üzerinden sipariş veren kişi; adı, adresi ve iletişim bilgileri sipariş sırasında verdiği bilgilerdir.
              </p>

              <h3>2. Konu</h3>
              <p>
                Bu sözleşme, Alıcı’nın studymode.fun/fiyatlar sayfasında tanıtılan ve Shopier üzerinden elektronik ortamda satın aldığı dijital ürünün satışı ve teslimine ilişkin
                tarafların hak ve yükümlülüklerini, 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümlerine göre düzenler.
              </p>

              <h3>3. Ürün ve fiyat</h3>
              <p>
                Ürün: StudyMode Premium üyelik kodu (tek kullanımlık dijital kod). {monthly.name}: {monthly.days} gün Premium, {formatPrice(monthly.price)}. {term.name}:{' '}
                {term.days} gün Premium, {formatPrice(term.price)}. Belirtilen fiyatlar ödenecek toplam tutardır; teslimat ücreti yoktur. Ödeme Shopier aracılığıyla alınır.
              </p>

              <h3>4. Teslimat</h3>
              <p>
                Ürün fiziksel olarak teslim edilmez. Kod, ödemenin onaylanmasından sonra {DELIVERY.within} içinde, Alıcı’nın siparişte bildirdiği e-posta adresine gönderilir.
                Kod, studymode.fun’da Alıcı’nın hesabında “Kodum var” alanına girildiğinde, paketteki gün sayısı kadar Premium açılır; Premium açıksa süre kalan sürenin üstüne
                eklenir. Otomatik yenileme ve tekrarlayan ödeme yoktur.
              </p>

              <h3>5. Cayma hakkı</h3>
              <p>
                Alıcı, kodu kullanmadığı sürece, sözleşmenin kurulduğu günden itibaren 14 gün içinde hiçbir gerekçe göstermeden ve cezai şart ödemeden cayma hakkını kullanabilir.
                Bunun için Satıcı’ya {SELLER.email} adresinden ya da yazılı olarak bildirimde bulunması yeterlidir. Cayma bildirimi Satıcı’ya ulaştıktan sonra kod iptal edilir ve
                ödenen tutar en geç 14 gün içinde, ödemenin yapıldığı yöntemle iade edilir.
              </p>

              <h3>6. Cayma hakkının istisnası</h3>
              <p>
                Mesafeli Sözleşmeler Yönetmeliği’nin 15. maddesinin 1. fıkrasının (ğ) bendi uyarınca, elektronik ortamda anında ifa edilen hizmetlere ve tüketiciye anında teslim
                edilen gayrimaddi mallara ilişkin sözleşmelerde cayma hakkı kullanılamaz. Alıcı, kodu uygulamaya girdiğinde Premium’un hemen açıldığını ve bu andan itibaren
                hizmetin ifasına kendi onayıyla başlandığını, bu nedenle kullanılmış kodlar için cayma hakkının bulunmadığını kabul eder.
              </p>

              <h3>7. Satıcı’nın yükümlülükleri</h3>
              <p>
                Satıcı, kodu süresinde göndermek ve kodla açılan Premium özelliklerini satın alınan süre boyunca sağlamakla yükümlüdür. Premium’un içeriği ve günlük kullanım hakları
                adil kullanım için değiştirilebilir; satın alınan süre boyunca özellikler kaldırılmaz. Alıcı’nın kanundan doğan hakları saklıdır.
              </p>

              <h3>8. Uyuşmazlıklar</h3>
              <p>
                Bu sözleşmeden doğan uyuşmazlıklarda, Ticaret Bakanlığınca her yıl ilan edilen parasal sınırlar içinde Alıcı’nın yerleşim yerindeki ya da işlemin yapıldığı
                yerdeki tüketici hakem heyetleri, bu sınırları aşan durumlarda tüketici mahkemeleri yetkilidir. Türkiye Cumhuriyeti hukuku uygulanır.
              </p>

              <h3>9. Yürürlük</h3>
              <p>
                Alıcı, siparişi onaylamadan önce bu sözleşmeyi ve <Link to="/kullanim-kosullari">kullanım koşullarını</Link> okuduğunu kabul eder. Sözleşme, siparişin Shopier
                üzerinden onaylanmasıyla yürürlüğe girer.
              </p>
            </div>
          </details>
        </section>

        <p className="legal-note">
          <Ticket size={15} aria-hidden className="inline-icon" /> Kodun var mı? <Link to="/ayarlar">Ayarlar → Premium</Link> bölümünden gir. Kişisel verilerinin nasıl işlendiği{' '}
          <Link to="/gizlilik">gizlilik politikasında</Link>, kullanım kuralları <Link to="/kullanim-kosullari">kullanım koşullarında</Link>.
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
