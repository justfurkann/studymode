import { ArrowRight, BookOpen, Compass, FileText, Layers, ListChecks, PenLine } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Welcome({ onDemo }: { onDemo: () => void }) {
  return (
    <div className="page welcome">
      <section className="welcome-hero">
        <div>
          <span className="chip chip-accent">Hoş geldin · Sıfırdan adım adım öğrenme alanı</span>
          <h1>
            Notların biriksin.
            <br />
            <span>Eksiklerin değil.</span>
          </h1>
          <p>
            Konuda sıfır olsan bile rastgele sorular arasında kaybolma: Önce temel kavramlarla tanış, konuyu madde madde sindir, kartlarla pekiştir, kendini test et ve kendi cümlelerinle anlatarak öğren.
          </p>
          <div className="btn-row">
            <button className="btn btn-primary btn-lg" onClick={onDemo}>
              Örnek notla dene <ArrowRight size={18} />
            </button>
            <Link to="/not-ekle" className="btn btn-lg">
              Kendi notumu yükle
            </Link>
          </div>
          <small>Örneği keşfetmek için hesap veya API anahtarı gerekmiyor.</small>
        </div>
        <div className="welcome-preview" aria-label="Çalışma seti önizlemesi">
          <div className="preview-file">
            <FileText size={23} />
            <div>
              <strong>Öğrenme ve bellek.pdf</strong>
              <span>Sıfırdan başlayanlar için 5 adımlı öğrenme yolu</span>
            </div>
          </div>
          <div className="preview-summary">
            <BookOpen size={18} />
            <div>
              <strong>1–2. Adım: Tanış ve Anla</strong>
              <p>Aktif hatırlama: Notu kapatıp bilgiyi kendi cümlelerinle geri çağır.</p>
            </div>
          </div>
          <div className="preview-question">
            <span>3–4. ADIM: PEKİŞTİR & MİNİ TEST</span>
            <strong>Hangisi aktif hatırlamaya örnektir?</strong>
            <p>✓ Notu kapatıp konuyu bir arkadaşına anlatmak</p>
          </div>
          <div className="preview-reminder">
            <Layers size={17} /> 5. Adımda kendi cümlelerinle anlat, sınav gününe kadar unutma.
          </div>
        </div>
      </section>
      <div className="welcome-features">
        <article>
          <Compass />
          <h2>1. Tanış & Madde Madde Anla</h2>
          <p>Uzun notlarda boğulmadan önce büyük resmi ve temel terimleri tanı, ardından ana noktaları adım adım sindirerek ilerle.</p>
        </article>
        <article>
          <ListChecks />
          <h2>2. Kartlarla Pekiştir & Kendini Sına</h2>
          <p>Öğrendiğin kavramları hızlı kart turuyla hafızanda yokla, açıklamalı mini testle eksiklerini anında karta dönüştür.</p>
        </article>
        <article>
          <PenLine />
          <h2>3. Kendi Cümlelerinle Anlat</h2>
          <p>Konuyu hiç bilmeyen birine anlatır gibi açık uçlu soruları yanıtla, yapay zekâdan geri bildirim al ve aralıklı tekrarla kalıcı öğren.</p>
        </article>
      </div>
      <div className="panel welcome-modes">
        <div>
          <h2>Nasıl başlamak istersin?</h2>
          <p className="muted">
            Örnek set hazır içerik sunar. Kendi notlarında basit mod cihazında çalışır; yapay zekâ için ücretsiz hesap açabilir veya kendi anahtarını bağlayabilirsin.
          </p>
        </div>
        <Link className="btn" to="/giris">
          Ücretsiz hesap aç <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
