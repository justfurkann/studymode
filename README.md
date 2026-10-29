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

Ayarlar → Yapay zekâ bölümünden dört seçenek var:

- **Ücretsiz (varsayılan):** Giriş yapmış kullanıcılar için. Tarayıcı `/api/generate` Vercel fonksiyonunu çağırır; fonksiyon Supabase oturumunu doğrular ve Google Gemini'nin ücretsiz katmanını kullanır. Gemini anahtarı yalnızca sunucuda (`GEMINI_API_KEY` ortam değişkeni) durur. Fonksiyon yalnızca sabit görevleri (özet seti, sınav, puanlama) çalıştırır, genel amaçlı bir proxy değildir. Not: Google ücretsiz katmandaki içerikleri ürünlerini geliştirmek için kullanabilir.
- **Claude / ChatGPT / Gemini (kendi anahtarın):** Anahtar yalnızca o tarayıcının `localStorage` alanında tutulur, Supabase'e gönderilmez. İstekler doğrudan tarayıcıdan servise gider; ücret kullanıcının kendi hesabından düşer.

Ücretsiz modu açmak için:
1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) adresinden bir API anahtarı al. Bu projeye **faturalandırma bağlama**: ücretsiz katmanda kota dolarsa yalnızca hata alınır, para çıkmaz. Faturalandırma bağlarsan önce kullanıcı başına bir limit ekle.
2. Vercel → proje → Settings → Environment Variables altına `GEMINI_API_KEY` ekle ve yeniden yayınla. Model adını değiştirmek için isteğe bağlı `GEMINI_MODEL`.

Talimatlar ve çıktı şemaları `src/lib/ai/tasks.ts` içinde; Claude yapılandırılmış çıktı (structured output), ChatGPT ve Gemini JSON modu kullanır ve her cevap aynı şemayla doğrulanır.

## Yayınlama

Statik bir site olarak her yere konabilir. Vercel için `vercel.json`, Netlify için `public/_redirects` SPA yönlendirmelerini içerir. Ortam değişkenlerini (`VITE_SUPABASE_*`) barındırma servisinin panelinden ekle ve Supabase'deki Site URL'yi yayın adresine güncelle.

## Sorun giderme

- **Ücretsiz yapay zekâ "henüz kurulmadı" diyor:** Vercel'de `GEMINI_API_KEY` tanımlı değil ya da eklendikten sonra yeniden yayın yapılmadı. Ortam değişkenleri yalnızca yeni yayınlarda geçerli olur; `main`e gelen her değişiklik yeni bir yayın başlatır ya da Vercel → Deployments → ⋯ → Redeploy kullanılabilir.
- **"Model bulunamadı":** Google model adını değiştirmiş olabilir. Vercel'de `GEMINI_MODEL` değişkenine güncel model adını yaz ve yeniden yayınla.
- **"Kota dolu":** Gemini ücretsiz katmanının dakikalık/günlük sınırı aşıldı; biraz sonra tekrar dene ya da Ayarlar'dan kendi anahtarını bağla.
- **Onay e-postasındaki bağlantı yanlış adrese gidiyor:** Supabase → Authentication → URL Configuration altında Site URL ve Redirect URLs sitenin adresi olmalı.
- **Site bazı internet bağlantılarında açılmıyor (SSL hatası):** Bazı sağlayıcılar `*.vercel.app` adreslerini engelleyebiliyor; kendi alan adı (`studymode.fun`) bu sorunu çözer.

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
