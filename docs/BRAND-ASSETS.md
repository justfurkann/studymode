# StudyMode — Claude entegrasyon paketi

Bu paket, onaylanan İLK sarı S şeritli StudyMode tasarımının web varlıklarını içerir.
Yeni logo üretme; paketteki dosyaları doğrudan kullan.

## Kullanılacak dosyalar

| Dosya | Kullanım |
| --- | --- |
| svg/logo.svg | Açık zeminde ana yatay logo: ikon + yazı |
| svg/logo-dark.svg | Koyu zeminde ana yatay logo |
| svg/wordmark.svg | Açık zeminde yalnızca studymode yazısı |
| svg/wordmark-dark.svg | Koyu zeminde yalnızca studymode yazısı |
| svg/icon.svg | Lacivert kare içindeki sarı S; mobil menü, uygulama, avatar |
| svg/symbol-yellow.svg | Kutusuz sarı S; koyu zeminler için |
| svg/symbol-navy.svg | Kutusuz lacivert S; açık zeminler için |
| svg/symbol-white.svg | Kutusuz açık renk S |
| png/ | Şeffaf PNG karşılıkları; SVG desteklenmeyen yerlerde |
| favicon/ | Tarayıcı ve uygulama simgeleri |
| reference/original-concept.png | Onaylanan ilk sunum; siteye doğrudan yerleştirme |
| preview.html | Açık/koyu zemin ve küçük boyut önizlemesi; tarayıcıda aç |

## Claude'a görev

Mevcut projedeki logoyu bu paketteki logo ile değiştir. Yalnızca marka varlıklarının
entegrasyonunu yap; sayfa tasarımını ve diğer özellikleri değiştirme.

1. Dosyaları projenin public/brand/ dizinine kopyala. Framework'e göre eşdeğer
   statik dosya dizinini kullan; mevcut yolları buna göre güncelle.
2. Header ve geniş yan menüde svg/logo.svg kullan. Koyu temada logo-dark.svg kullan.
3. Mobilde veya dar/kapanmış yan menüde svg/icon.svg kullan. Aynı yerde ayrıca ikinci
   bir studymode yazısı oluşturarak logoyu tekrarlama.
4. SVG içindeki harfler gerçek path'tir. Font kurma, yazıyı CSS/HTML ile yeniden yazma,
   sembolü yeniden çizme, SVG'nin içine PNG gömme.
5. En/boy oranını koru: width:auto; height:32px gibi kullan. Genişlik ve yüksekliği
   birbirinden bağımsız esnetme. Logo konteynerindeki mevcut kısıtları kontrol et.
6. Kırpma, object-fit:cover, filtre ve rastgele gölge uygulama. Logo dosyalarında
   boşluk payı zaten var. Görünür boyutu mobilde ve masaüstünde kontrol et.
7. İkonu favicon olarak bağla; mevcut favicon metadata'sını güncelle. Aşağıdaki
   örnekleri projeye uyarlayarak kullan; mevcut manifest'i silip üstüne yazma.
8. Tema geçişini, menü açılışını ve farklı ekran genişliklerini kontrol et.
9. reference/original-concept.png sunum dosyasıdır. Header'a veya favicon'a koyma.

## Örnek HTML

```html
<a href="/" aria-label="StudyMode ana sayfa">
  <img src="/brand/svg/logo.svg" alt="StudyMode" style="height:32px;width:auto;display:block" />
</a>
<link rel="icon" type="image/svg+xml" href="/brand/favicon/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/brand/favicon/favicon-32.png" />
<link rel="icon" href="/brand/favicon/favicon.ico" sizes="any" />
<link rel="apple-touch-icon" sizes="180x180" href="/brand/favicon/apple-touch-icon.png" />
<!-- Projede manifest yoksa ekle; varsa mevcut manifest'e ikonları taşı. -->
<link rel="manifest" href="/brand/favicon/site.webmanifest" />
```

## Renkler ve kaynak

Lacivert #1B214D · Sarı #FFE34F · Kırık beyaz #F8F8F2.

SVG'ler onaylanan raster tasarımın konturlarından üretilmiş gerçek vektörlerdir.
Orijinal font dosyası kullanılmamıştır; yazılar da şekildir ve font bağımlılığı yoktur.
Web varlıklarında renkler tutarlı düz dolguya çevrilmiştir. Kenar izleme nedeniyle
orijinal raster sunuma göre çok küçük kontur farklılıkları olabilir.
Koyu sürümde study harfleri açık renge çevrilmiş ve d harfinin üst kısmı koyu zeminde
kaybolmasın diye sarı vurgunun üst boşluğu artırılmıştır. S sembolünün ve harflerin
geometrisi korunmuştur.
Manifest ikonları purpose:any içindir; maskable oldukları iddia edilmemektedir.
