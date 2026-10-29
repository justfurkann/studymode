# studymode

Üniversite öğrencileri için Türkçe çalışma uygulaması. Ders notunu yükle; özet, çalışma kartları, çoktan seçmeli test ve açık uçlu sorular hazırlansın. Kartlar aralıklı tekrar (spaced repetition) ile sınav tarihine göre planlanır.

## Özellikler

- **Dersler ve sınav tarihleri:** Her dersin notları, kartları ve sıradaki sınavı. Sınav yaklaştıkça tekrar aralıkları sıkışır.
- **Not yükleme:** PDF, TXT, Markdown ya da metin yapıştırma. PDF metni tarayıcıda çıkarılır.
- **İki hazırlama modu:**
  - **Yapay zekâ:** Kullanıcının kendi Anthropic API anahtarıyla Claude çağrılır. Özet, kartlar, test soruları (açıklama ve nottan alıntıyla) ve örnek cevaplı açık uçlu sorular üretir.
  - **Basit mod:** Ücretsiz, tamamen cihazda çalışır. Kurallarla nottan cümle seçer; en iyi `Kavram: açıklama` biçimindeki notlarda çalışır.
- **Aralıklı tekrar:** "Bugün" ekranı tekrar bekleyen kartları, yaklaşan sınavları ve düşük puanlı konuları gösterir.
- **Testten karta:** Yanlış yaptığın soruları tek tıkla tekrar kartına çevir.
- **Hesap (isteğe bağlı):** Supabase ile e-posta/şifre girişi ve cihazlar arası senkronizasyon. Supabase ayarlanmadıysa her şey tarayıcıda saklanır.
- Karanlık mod, mobil uyumlu arayüz, ana ekrana eklenebilir (PWA manifest), JSON yedek alma ve geri yükleme.

## Çalıştırma

Node.js 22+ gerekir.

```sh
npm ci
npm run dev
```

```sh
npm test          # birim testleri (Vitest)
npm run test:e2e  # tarayıcı testleri (Playwright)
npm run build     # tip kontrolü + üretim derlemesi
```

Playwright, projede sabitlenen sürümün tarayıcısını bulamazsa `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/yol/chromium` ile mevcut bir Chromium göster.

## Supabase kurulumu (hesap ve senkronizasyon)

1. [supabase.com](https://supabase.com) üzerinde ücretsiz bir proje oluştur.
2. **SQL Editor**'de `supabase/schema.sql` dosyasının içeriğini çalıştır. Tablolar ve Row Level Security kuralları oluşur; herkes yalnızca kendi verisini görebilir.
3. Proje adresi ve **publishable** anahtarı `src/lib/supabase.ts` içinde varsayılan olarak tanımlı. Başka bir projeye bağlanmak için `.env` dosyasında `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` değerlerini ver. Publishable/anon anahtarı tarayıcıya gömülmek için tasarlanmıştır; güvenliği RLS kuralları sağlar. `sb_secret_…` veya `service_role` anahtarını asla koda ya da `.env`'e koyma.
4. **Authentication → URL Configuration** altında Site URL'yi uygulamanın adresi yap (yerelde `http://localhost:5173`). E-posta onayı varsayılan olarak açıktır; arkadaşlarla denerken istersen **Authentication → Providers → Email** altından kapatabilirsin.

Giriş yapmadan önce tarayıcıda oluşturulan veriler, Ayarlar sayfasındaki "Hesabıma taşı" ile hesaba aktarılabilir.

## Yapay zekâ modu

- Anahtar Ayarlar sayfasından girilir, yalnızca o tarayıcının `localStorage` alanında tutulur ve Supabase'e gönderilmez.
- İstekler doğrudan tarayıcıdan Anthropic API'sine gider (`dangerouslyAllowBrowser`). Bu, herkesin kendi anahtarını kullandığı arkadaş-çevresi kullanımı için uygundur. Uygulamayı ortak bir anahtarla herkese açmak istersen anahtarı bir sunucu fonksiyonuna (örn. Supabase Edge Function) taşımak gerekir.
- Model ayarlardan seçilir (varsayılan Claude Opus 5.5; daha ucuz Sonnet 5.5 ve Haiku 5.5 seçenekleri var). Cevaplar şemaya göre doğrulanmış JSON olarak alınır (`src/lib/ai.ts`).

## Yayınlama

Statik bir site olarak her yere konabilir. Vercel için `vercel.json`, Netlify için `public/_redirects` SPA yönlendirmelerini içerir. Ortam değişkenlerini (`VITE_SUPABASE_*`) barındırma servisinin panelinden ekle ve Supabase'deki Site URL'yi yayın adresine güncelle.

## Kod yapısı

```
src/
  lib/          veri modeli, depolama (yerel + Supabase), aralıklı tekrar, yapay zekâ, basit mod
  components/   yerleşim, ortak arayüz parçaları, not sekmeleri
  pages/        Bugün, Dersler, Ders, Not, Not ekle, Tekrar, Ayarlar, Giriş
  styles/       tasarım değişkenleri (açık/koyu tema) ve bileşen stilleri
supabase/       veritabanı şeması
tests/          Playwright uçtan uca testleri
```

## Sınırlar

- Taranmış (görsel) PDF'lerde OCR yok; metni seçilebilen PDF gerekir.
- Basit mod yalnızca nottaki cümleleri seçer; düzensiz notlarda az içerik çıkarabilir.
- Bulut modunda çevrimdışı çalışma yok; yerel modda her şey tarayıcıda.
