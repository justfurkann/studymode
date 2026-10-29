import { ArrowRight, BookOpen, FileText, Layers, ListChecks, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Welcome({ onDemo }: { onDemo: () => void }) {
  return <div className="page welcome">
    <section className="welcome-hero">
      <div><span className="chip chip-accent">Hoş geldin · Üniversite için çalışma alanın</span>
        <h1>Notların biriksin.<br /><span>Eksiklerin değil.</span></h1>
        <p>Ders notunu kısa bir özete dönüştür, kendini test et ve sınav gününe kadar öğrendiklerini tekrar et.</p>
        <div className="btn-row"><button className="btn btn-primary btn-lg" onClick={onDemo}>Örnek notla dene <ArrowRight size={18} /></button><Link to="/not-ekle" className="btn btn-lg">Kendi notumu yükle</Link></div>
        <small>Örneği keşfetmek için hesap veya API anahtarı gerekmiyor.</small>
      </div>
      <div className="welcome-preview" aria-label="Çalışma seti önizlemesi">
        <div className="preview-file"><FileText size={23} /><div><strong>Öğrenme ve bellek.pdf</strong><span>Tek bir not, üç farklı çalışma yolu</span></div></div>
        <div className="preview-summary"><BookOpen size={18} /><div><strong>Özüne odaklan</strong><p>Aktif hatırlama: Notu kapatıp bilgiyi kendi cümlelerinle geri çağır.</p></div></div>
        <div className="preview-question"><span>MİNİ TEST</span><strong>Hangisi aktif hatırlamaya örnektir?</strong><p>✓ Notu kapatıp konuyu bir arkadaşına anlatmak</p></div>
        <div className="preview-reminder"><Layers size={17} /> Bugün öğren. Birkaç gün sonra hatırla.</div>
      </div>
    </section>
    <div className="welcome-features">
      <article><FileText /><h2>1. Notunu getir</h2><p>Dosya yükle veya metin yapıştır. Her konuyu kendi dersinde tut.</p></article>
      <article><Sparkles /><h2>2. Çalışma setini aç</h2><p>Özet, kavramlar, kartlar ve açıklamalı sorularla konunun özünü yakala.</p></article>
      <article><ListChecks /><h2>3. Sınava hazırlan</h2><p>Aralıklı tekrar ve süreli sınav provasıyla nerede zorlandığını gör.</p></article>
    </div>
    <div className="panel welcome-modes"><div><h2>Nasıl başlamak istersin?</h2><p className="muted">Örnek set hazır içerik sunar. Kendi notlarında basit mod cihazında çalışır; yapay zekâ için ücretsiz hesap açabilir veya kendi anahtarını bağlayabilirsin.</p></div><Link className="btn" to="/giris">Ücretsiz hesap aç <ArrowRight size={16} /></Link></div>
  </div>
}
