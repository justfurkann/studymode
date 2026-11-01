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

## Tam özet (1 Kasım 2026)

- Arkadaş geri bildirimi: "Özetin tamamını tek sayfada göreceğim bir yer yok mu?" Vardı ama en altta, katlı bir düğmenin arkasındaydı.
- Özet sekmesinin en üstünde belirgin "Tam özet" kartı ve alt sekmelerde "Tam özet" (`?adim=tam`, `FullSummary.tsx`): içindekiler, bölümler, ezberlenecekler, nottaki örnekler, "Sınavda dikkat", ana noktalar, kavramlar; "Yazdır / PDF"; "Okudum, teste geç".
- "Ayrıntılı özet hazırla": yeni `detail` görevi (`tasks.ts`, `generateDetailedSummary`). Uzun not 12.000 karakterlik bölümlerle yazılır, her bölüm bir istek (günlük haktan sayılır). Sonuç `summary.detailed` içinde saklanır (jsonb, veritabanı değişikliği yok). Not yeniden hazırlanırsa silinir; not düzenlenirse "yeniden yaz" uyarısı çıkar.
- Sunucuda `detail` için deneme başına 45 sn, toplam 55 sn; tarayıcı 62 sn bekler. Free+'ta hızlı model (gemini-3.8-flash) kullanılır: Gemini 4 Argon kısa bir açıklamada bile ~19 sn sürdüğü için uzun bir anlatım 60 sn'lik Vercel sınırına sığmaz.
- Örnek notta elle yazılmış bir ayrıntılı özet var; giriş yapmayan da sayfanın nasıl göründüğünü görür.

## Hangi öğrenci tipisin? (/ogrenci-tipi, 1 Kasım 2026)

- Hesapsız tanıtım testi. Akış: seviye (ortaokul, lise, üniversite, yüksek lisans, mezun) → üniversite/yüksek lisans ise aranabilir okul listesi (atlanabilir, listede yoksa elle yazılır) → 10 soru → sonuç.
- Puanlama (`src/lib/studentType.ts`): her cevap 4 eksende puan verir (planlı ↔ akışına, anlamaya ↔ sonuca odaklı, grupla ↔ yalnız, gece ↔ sabah) + gizli "estetik"; her soru kendi ortalamasına göre merkezlenir. Sonuç, profile en yakın tip (yön benzerliği). 8 tip: Ajanda Stratejisti, Son Dakika Kahramanı, Gece Kuşu Düşünür, Meraklı Kaşif, Sınıfın Anlatıcısı, Fosforlu Kalem Sanatçısı, Verimlilik Avcısı, Sessiz Maratoncu. Testler: her tip tutarlı cevaplarla çıkıyor; rastgele cevaplarda her tip %4-22.
- Sorular seviyeye göre konuşur (vize/yazılı/sınav, hoca/öğretmen; Türkçe ekler ayrı yazılı: "Vizeye", "Yazılıya").
- Sonuç kartı: özgün animasyonlu karakter (`StudentCharacter.tsx`), açıklama, eksen yüzdeleri, süper güç, kör nokta, sana özel taktik, en iyi çalışma arkadaşı, bütün tiplere uyum. Story görseli 1080×1920 PNG (paylaş / indir), bağlantı sonucu taşır: açan kişi kartı görür, "Sen de çöz".
- Üniversite listesi `src/lib/universities.ts` (sabit, ~208 okul, kısaltmalarla arama). YÖK değişince elle güncellenmeli.
- Girişler: tanıtım sayfasında "Hangi öğrenci tipisin?" bağlantısı, Mola'da kart. Sayfa ayrı yüklenir (lazy).
- Cevaplar hiçbir yere kaydedilmiyor. İstenirse sonuçlar (tip, seviye, okul) Supabase'de sayılabilir ("ODTÜ'de en çok Gece Kuşu var") ama bu yeni bir tablo ve SQL onayı ister.
