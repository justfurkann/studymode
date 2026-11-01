# Çalışma fişi, Gece kütüphanesi, Kırtasiye seti

Ayrı bir oturumda eklendi; Premium çalışmasıyla çakışmasın diye kod ayrı dosyalarda. Devir notuna (HANDOFF.md) işlenecek.

- **Çalışma fişi** (`src/lib/receipt.ts`, `src/components/ReceiptCard.tsx`, `ReceiptButton.tsx`): Bugün sayfasında "Çalışma fişi". Bugünün ya da son 7 günün çalışması kasa fişi olarak 1080×1920 PNG'ye çizilir (canvas, kütüphane yok). İndir ya da telefonda paylaş (Web Share). Fişte not içeriği yok; ders adları ve sayılar var. Çizim kodu yalnızca açılınca yüklenir.
- **Gece kütüphanesi** (`src/lib/ambience.ts`, `src/components/Atmosphere.tsx`): Sol altta kulaklık düğmesi; yağmur, kafe, şömine, odak (kahverengi gürültü). Sesler dosya değil, tarayıcıda gürültüden üretilir (24 kHz, ilk açılışta bir kez). Sayfa değişince çalmaya devam eder; ses seviyeleri hatırlanır. Lo-fi müzik yok (telif ve boyut).
- **Gece kuşu**: 00:00-04:59 arası "Gece kuşu modu" notu (15 sn sonra kendiliğinden gizlenir, kapatılırsa o gece bir daha çıkmaz), PixelSky'da gece göğü ve kayan yıldızlar, fişte "#GECE-VARDİYASI".
- **Kırtasiye seti** (`src/lib/decor.ts`, `src/components/DecorSettings.tsx`, `src/styles/extras.css`): Ayarlar → Görünüm ve ses. Kağıt: kareli (varsayılan), noktalı, mühendislik, sarı defter, düz. Fosforlu kalem: sarı (varsayılan), pembe, nane, lavanta, turuncu; tüm `--hi` vurguları, logo ve karanlık modda ana düğmeler o renge döner. Kırtasiye sesleri: kart çevirme hışırtısı, doğruda fosforlu kalem, yanlışta kalem tıkı, bitişte sayfa çevirme. Hepsi yalnızca bu tarayıcıda (`studymode.decor.v1`).
- Testler: `src/lib/receipt.test.ts`, `src/lib/atmosphere.test.ts`, `tests/extras.spec.ts`.
