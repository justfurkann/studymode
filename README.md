# studymode

Üniversite öğrencileri için Türkçe bir çalışma alanı. Ders notlarını yükle; kısa özet, mini test, çalışma kartları ve kendini değerlendirebileceğin alıştırmalarla konuyu pekiştir.

## Çalıştırma

Node.js 22.13+ veya 24 LTS gerekir. Doğrulanan ortam: Node.js 24, npm 11.

```sh
npm ci
npm run dev
```

Bulut ortamında varsayılan npm önbelleği yazılamıyorsa `npm ci --cache /workspace/.npm-cache` kullan. Vite varsayılan olarak 5173 portunda çalışır.

```sh
npm test         # Not işleme ve PDF/metin içe aktarma testleri
npm run build    # TypeScript kontrolü ve üretim derlemesi
npm run preview  # Üretim derlemesini çalıştır
npm run test:e2e # Tarayıcıda kullanıcı akışları
```

Tarayıcı testleri bulut ortamındaki `/usr/bin/chromium` yolunu kullanır. Farklı bir kurulumda `PLAYWRIGHT_CHROMIUM_EXECUTABLE` ile Chromium yolunu belirt.

## İlk sürüm

- PDF, TXT ve Markdown yükleme veya doğrudan metin yapıştırma.
- Kaynak notundan önemli cümleleri seçen kısa özet ve kavram listesi.
- Notun içeriğine dayalı çoktan seçmeli mini testler ve cevap açıklamaları.
- Çalışma kartları ve öz değerlendirme alıştırmaları.
- Not arama/silme, tamamlanan testler ve başarı istatistikleri.
- Mobil ekran desteği ve keşfedilebilir bir örnek ders notu.

React + TypeScript + Vite ile geliştirilmiştir. PDF metni, PDF.js ve yerel worker ile tarayıcıda çıkarılır. Yazı tipleri uygulamayla birlikte sunulur.

## Veriler ve sınırlar

Bu prototip harici yapay zekâ veya sunucu kullanmaz. Özetler metinden seçilir; testler tanımlar ve boşluk doldurma cümleleri üzerinden kurallarla oluşturulur. Kaynakta olmayan açıklamalar üretilmez. Az veya uygun olmayan içerikte test oluşturulmayabilir. Ders notunun doğruluğu bağımsız olarak denetlenmez.

Notlar ve test sonuçları bu tarayıcının `localStorage` alanında tutulur; cihazlar arasında eşitlenmez. Tarayıcı verilerini temizlemek kayıtları siler. Alıştırma cevapları geçicidir ve sekme değiştirince temizlenir. Dosya içeriği dışarı gönderilmez.

Dosya sınırları: 10 MiB, 150 PDF sayfası ve 400.000 karakter. En az 120 karakterlik anlamlı not gerekir. Metni seçilebilen PDF’ler desteklenir; taranmış görseller için OCR ve şifreli PDF desteği yoktur.

Sonraki ürün kararları: gerçek yapay zekâ destekli açıklamalar, hesap/senkronizasyon, derslere göre kişiselleştirme ve aralıklı tekrar planı.
