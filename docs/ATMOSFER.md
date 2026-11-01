# Çalışma fişi, Gece kütüphanesi, Kırtasiye seti

Ayrı bir oturumda eklendi; Premium çalışmasıyla çakışmasın diye kod ayrı dosyalarda. Devir notuna (HANDOFF.md) işlenecek.

- **Çalışma fişi** (`src/lib/receipt.ts`, `src/components/ReceiptCard.tsx`, `ReceiptButton.tsx`): Bugün sayfasında "Çalışma fişi". Bugünün ya da son 7 günün çalışması kasa fişi olarak 1080×1920 PNG'ye çizilir (canvas, kütüphane yok). İndir ya da telefonda paylaş (Web Share). Fişte not içeriği yok; ders adları ve sayılar var. Çizim kodu yalnızca açılınca yüklenir.
- **Gece kütüphanesi** (`src/lib/ambience.ts`, `src/components/Atmosphere.tsx`): Sol altta kulaklık düğmesi; yağmur, kafe, şömine, odak (kahverengi gürültü). Sesler dosya değil, tarayıcıda gürültüden üretilir (24 kHz, ilk açılışta bir kez). Sayfa değişince çalmaya devam eder; ses seviyeleri hatırlanır. Lo-fi müzik yok (telif ve boyut).
- **Gece kuşu**: 00:00-04:59 arası "Gece kuşu modu" notu (10 sn sonra kendiliğinden gizlenir, kapatılırsa o gece bir daha çıkmaz), PixelSky'da gece göğü ve kayan yıldızlar, fişte "#GECE-VARDİYASI".
- **Kırtasiye seti** (`src/lib/decor.ts`, `src/components/DecorSettings.tsx`, `src/styles/extras.css`): Ayarlar → Görünüm ve ses. Kağıt: kareli (varsayılan), noktalı, mühendislik, sarı defter, düz. Fosforlu kalem: sarı (varsayılan), pembe, nane, lavanta, turuncu; tüm `--hi` vurguları, logo ve karanlık modda ana düğmeler o renge döner. Kırtasiye sesleri: kart çevirme hışırtısı, doğruda fosforlu kalem, yanlışta kalem tıkı, bitişte sayfa çevirme. Hepsi yalnızca bu tarayıcıda (`studymode.decor.v1`).
- Testler: `src/lib/receipt.test.ts`, `src/lib/atmosphere.test.ts`, `tests/extras.spec.ts`.

## Site incelemesi düzeltmeleri (1 Kasım 2026)

- Kavram haritası tanımsız renk değişkenleri (`--ink`, `--muted`) kullanıyordu: çizgiler görünmüyor, karanlık modda yazılar siyah kalıyordu. Tema renklerine bağlandı; telefonda harita okunur boyutta kalıp yana kayıyor.
- Görseller (yapay zekâ görseli, poster, hafıza şeması) dokununca tam ekran açılıyor: ekrana sığdır / tam boyut / indir (`ImageViewer.tsx`).
- Yapay zekâ görselleri 1280 px JPEG'e küçültülüp saklanıyor (`imageStore.ts`); tarayıcı alanı dolarsa en eskiler siliniyor ve kullanıcıya söyleniyor (eskiden sessizce kayboluyordu).
- Hafıza şeması görselleri artık saklanıyor; "Görseli gizle" silmiyor, yalnızca gizliyor (eskiden tekrar göstermek yeni bir yapay zekâ isteği harcıyordu).
- Görsel ve podcast indirme adları Türkçe harf yüzünden "download" oluyordu; `safeFileName` kullanılıyor.
- Kayıt kuyruğu: bağlantı koptuğunda değişiklik kaybolmuyor, internet gelince ya da bir sonraki değişiklikte yeniden gönderiliyor; kaydedilmemiş değişiklik varken sekme kapatılırsa tarayıcı soruyor. Kalıcı hatalar (reddedilen satır) tekrar denenmiyor.
- Not hazırlanırken sekme kapatılırsa tarayıcı soruyor; başka sayfaya geçen kullanıcı iş bitince geri çekilmiyor.
- Yedek indirme: bağlantı hemen iptal edildiği için Safari/Firefox'ta inmeyebiliyordu; dosya adı yerel tarihle.
- Link önizlemesi: `og:image` (public/og.png) ve Twitter kartı eklendi.
- Giriş: "Şifreyi göster". Telefonda klavye kısayolu ipuçları gizli. Sınav takviminde uzun ders adı kesilmiyor. Tekrar ekranına ekran okuyucu başlığı. Telefonda ortam sesi düğmesi üst çubukta.
